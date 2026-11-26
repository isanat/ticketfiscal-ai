// Conciliación sobre la base de datos: importación de extractos, vista de coincidencias y confirmación.
import { Prisma } from "@prisma/client";
import { conciliar, puntuar, type DocumentoConciliable, type Movimiento } from "./conciliacion";
import { parseCsvBanco, parseNorma43 } from "./extracto";
import { aCentimos, aEuros } from "./money";
import { prisma } from "./prisma";
import { registrarAuditoria } from "./store";
import type { SesionActiva } from "./auth";

export type FormatoExtracto = "csv" | "n43";

/** La empresa solo es accesible si es de la gestoría del gestor, o es la propia del cliente, y está aprobada. */
export async function empresaAccesible(sesion: SesionActiva, empresaId: string | null | undefined) {
  const u = sesion.usuario;
  const id = u.rol === "CLIENTE" ? u.empresa?.id : empresaId;
  if (!id) return null;
  if (u.rol === "GESTOR") {
    if (u.gestoria?.estado !== "ACTIVA") return null;
    return prisma.empresa.findFirst({ where: { id, gestoriaId: u.gestoria.id, estado: "APROBADA" }, select: { id: true, nombre: true, gestoriaId: true } });
  }
  if (u.rol === "CLIENTE" && u.empresa?.id === id) {
    return prisma.empresa.findFirst({ where: { id, estado: "APROBADA" }, select: { id: true, nombre: true, gestoriaId: true } });
  }
  return null;
}

export async function importarExtracto(empresaId: string, formato: FormatoExtracto, contenido: string, usuarioId: string) {
  const lectura = formato === "n43" ? parseNorma43(contenido) : parseCsvBanco(contenido);
  if (lectura.movimientos.length === 0) return { importados: 0, duplicados: 0, ignoradas: lectura.ignoradas };
  const r = await prisma.movimientoBancario.createMany({
    data: lectura.movimientos.map((m) => ({
      empresaId,
      idExterno: m.idExterno,
      fecha: new Date(`${m.fecha}T00:00:00Z`),
      importe: aEuros(m.importeCent),
      descripcion: m.descripcion,
      origen: formato === "n43" ? ("N43" as const) : ("CSV" as const),
      importadoPorId: usuarioId,
    })),
    skipDuplicates: true,
  });
  return { importados: r.count, duplicados: lectura.movimientos.length - r.count, ignoradas: lectura.ignoradas };
}

function ventanaTrimestre(trimestre: string | undefined): { desde: Date; hasta: Date } | null {
  const m = /^([1-4])T(\d{4})$/.exec(trimestre ?? "");
  if (!m) return null;
  const t = Number(m[1]);
  const a = Number(m[2]);
  const inicio = Date.UTC(a, (t - 1) * 3, 1);
  const fin = Date.UTC(a, t * 3, 0);
  // Los pagos pueden llegar semanas después de la factura: se amplía la ventana de movimientos.
  return { desde: new Date(inicio - 7 * 86_400_000), hasta: new Date(fin + 70 * 86_400_000) };
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function vistaConciliacion(empresaId: string, trimestre?: string) {
  const ventana = ventanaTrimestre(trimestre);
  const [movs, docs, confirmadas] = await Promise.all([
    prisma.movimientoBancario.findMany({
      where: { empresaId, ...(ventana ? { fecha: { gte: ventana.desde, lte: ventana.hasta } } : {}) },
      orderBy: { fecha: "asc" },
      take: 3000,
    }),
    prisma.documento.findMany({
      where: { empresaId, eliminadoEn: null, estado: { not: "ILEGIBLE" }, ...(trimestre ? { trimestre } : {}) },
      select: { id: true, fechaEmision: true, totalFactura: true, emisorNombre: true, numeroFactura: true },
      take: 3000,
    }),
    prisma.conciliacion.findMany({
      where: { movimiento: { empresaId } },
      select: { id: true, movimientoId: true, documentoId: true, puntuacion: true, motivos: true },
    }),
  ]);

  const movPorId = new Map(movs.map((m) => [m.id, m]));
  const docPorId = new Map(docs.map((d) => [d.id, d]));
  const movVista = (m: (typeof movs)[number]) => ({ id: m.id, fecha: dia(m.fecha), importe: m.importe.toNumber(), descripcion: m.descripcion });
  const docVista = (d: (typeof docs)[number]) => ({
    id: d.id,
    fechaEmision: d.fechaEmision ? dia(d.fechaEmision) : null,
    total: d.totalFactura.toNumber(),
    emisorNombre: d.emisorNombre,
    numeroFactura: d.numeroFactura,
  });

  const confirmados = confirmadas
    .filter((c) => movPorId.has(c.movimientoId) && docPorId.has(c.documentoId))
    .map((c) => ({
      id: c.id,
      movimiento: movVista(movPorId.get(c.movimientoId)!),
      documento: docVista(docPorId.get(c.documentoId)!),
      puntuacion: c.puntuacion,
      motivos: c.motivos as string[],
    }));
  const movUsados = new Set(confirmadas.map((c) => c.movimientoId));
  const docUsados = new Set(confirmadas.map((c) => c.documentoId));

  const movimientos: Movimiento[] = movs
    .filter((m) => !movUsados.has(m.id))
    .map((m) => ({ id: m.id, fecha: dia(m.fecha), importeCent: aCentimos(m.importe.toNumber()), descripcion: m.descripcion }));
  const documentos: DocumentoConciliable[] = docs
    .filter((d) => !docUsados.has(d.id) && d.totalFactura.toNumber() > 0)
    .map((d) => ({ id: d.id, fechaEmision: d.fechaEmision ? dia(d.fechaEmision) : null, totalCent: aCentimos(d.totalFactura.toNumber()), emisorNombre: d.emisorNombre, numeroFactura: d.numeroFactura }));

  const r = conciliar(movimientos, documentos);
  const mv = new Map(movs.map((m) => [m.id, m]));
  const dv = new Map(docs.map((d) => [d.id, d]));
  const sugerencias = r.pares.map((p) => ({
    movimiento: movVista(mv.get(p.movimientoId)!),
    documento: docVista(dv.get(p.documentoId)!),
    puntuacion: p.puntuacion,
    confianza: p.confianza,
    motivos: p.motivos,
  }));

  const cargos = movs.filter((m) => m.importe.toNumber() < 0).length;
  return {
    confirmados,
    sugerencias,
    movimientosSinDocumento: r.movimientosSinDocumento.map((m) => movVista(mv.get(m.id)!)),
    documentosSinMovimiento: r.documentosSinMovimiento.map((d) => docVista(dv.get(d.id)!)),
    resumen: {
      cargos,
      conciliados: confirmados.length,
      sugeridos: sugerencias.length,
      cargosSinJustificante: r.movimientosSinDocumento.length,
      justificantes: docs.length,
      justificantesSinCargo: r.documentosSinMovimiento.length,
    },
  };
}

/** Confirma un vínculo. La puntuación se recalcula en el servidor: no se confía en el cliente. */
export async function confirmarConciliacion(
  empresaId: string,
  movimientoId: string,
  documentoId: string,
  sesion: SesionActiva
): Promise<"ok" | "no_existe" | "importe_distinto" | "ya_conciliado"> {
  const [m, d] = await Promise.all([
    prisma.movimientoBancario.findFirst({ where: { id: movimientoId, empresaId } }),
    prisma.documento.findFirst({ where: { id: documentoId, empresaId, eliminadoEn: null } }),
  ]);
  if (!m || !d) return "no_existe";
  const r = puntuar(
    { id: m.id, fecha: dia(m.fecha), importeCent: aCentimos(m.importe.toNumber()), descripcion: m.descripcion },
    { id: d.id, fechaEmision: d.fechaEmision ? dia(d.fechaEmision) : null, totalCent: aCentimos(d.totalFactura.toNumber()), emisorNombre: d.emisorNombre, numeroFactura: d.numeroFactura }
  );
  if (!r) return "importe_distinto";
  try {
    const c = await prisma.conciliacion.create({
      data: { movimientoId, documentoId, puntuacion: r.puntuacion, motivos: r.motivos, decididoPorId: sesion.usuarioId },
    });
    await registrarAuditoria({
      usuarioId: sesion.usuarioId,
      gestoriaId: (await prisma.empresa.findUnique({ where: { id: empresaId }, select: { gestoriaId: true } }))?.gestoriaId ?? null,
      accion: "conciliacion.confirmada",
      entidad: "Conciliacion",
      entidadId: c.id,
      detalle: { movimientoId, documentoId, puntuacion: r.puntuacion },
      impersonadoPorId: sesion.soporteAdminId,
    });
    return "ok";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "ya_conciliado";
    throw e;
  }
}

export async function deshacerConciliacion(empresaId: string, movimientoId: string, sesion: SesionActiva): Promise<boolean> {
  const c = await prisma.conciliacion.findFirst({ where: { movimientoId, movimiento: { empresaId } }, select: { id: true } });
  if (!c) return false;
  await prisma.conciliacion.delete({ where: { id: c.id } });
  await registrarAuditoria({
    usuarioId: sesion.usuarioId,
    accion: "conciliacion.deshecha",
    entidad: "Conciliacion",
    entidadId: c.id,
    impersonadoPorId: sesion.soporteAdminId,
  });
  return true;
}
