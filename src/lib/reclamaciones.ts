// Ciclo cerrado de reclamación de justificantes: un cargo bancario sin factura ni ticket se pide al cliente
// por WhatsApp. Siempre lo decide una persona de la gestoría (nada se envía solo) y se limita la insistencia.
import { config } from "./env";
import { log } from "./logger";
import { aCentimos } from "./money";
import { prisma } from "./prisma";
import { registrarAuditoria } from "./store";
import { enviarPlantilla, enviarTexto } from "./whatsapp";

export const MAX_ENVIOS = 3;
/** Entre dos envíos sobre el mismo cargo. */
export const HORAS_ENTRE_ENVIOS = 72;
/** Importe mínimo (en céntimos) que merece una reclamación. */
export const IMPORTE_MINIMO_CENT = 500;
export const MAX_POR_PETICION = 20;
const VENTANA_HORAS = 24;

/** Cargos que no suelen tener factura de proveedor: comisiones, impuestos, cuotas… */
const SIN_JUSTIFICANTE_HABITUAL =
  /comisi[oó]n|intereses?|tgss|seguridad social|agencia tributaria|aeat|hacienda|impuesto|tributo|mantenimiento de cuenta|liquidaci[oó]n|retrocesi[oó]n|devoluci[oó]n/i;

export interface MovimientoReclamable {
  importeCent: number;
  descripcion: string;
}

/** Un cargo (importe negativo) de importe suficiente y que no parece una comisión o un impuesto. */
export function esReclamable(m: MovimientoReclamable): boolean {
  return m.importeCent <= -IMPORTE_MINIMO_CENT && !SIN_JUSTIFICANTE_HABITUAL.test(m.descripcion);
}

export function ventanaAbierta(ultimoMensajeEn: Date | null | undefined, ahora: Date): boolean {
  return Boolean(ultimoMensajeEn) && ahora.getTime() - ultimoMensajeEn!.getTime() < VENTANA_HORAS * 3_600_000;
}

const eurEs = (cent: number) => `${(Math.abs(cent) / 100).toFixed(2).replace(".", ",")} €`;
const fechaEs = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const concepto = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 40);

export interface DatosReclamo {
  gestoria: string;
  importeCent: number;
  fecha: Date;
  descripcion: string;
}

/** Texto libre (dentro de la ventana de 24 h). */
export function textoReclamo(d: DatosReclamo): string {
  return (
    `Hola, desde ${d.gestoria} necesitamos el justificante de este pago: ${eurEs(d.importeCent)} el ${fechaEs(d.fecha)} ` +
    `(${concepto(d.descripcion)}). ¿Puede enviarnos por aquí la foto del ticket o de la factura? ` +
    `Si no tiene justificante, responda «NO TENGO».`
  );
}

/** Parámetros {{1}}…{{4}} de la plantilla: gestoría, importe, fecha, concepto. */
export function parametrosPlantilla(d: DatosReclamo): string[] {
  return [d.gestoria, eurEs(d.importeCent), fechaEs(d.fecha), concepto(d.descripcion)];
}

export type ResultadoEnvio = "enviada" | "sin_canal" | "fuera_de_ventana" | "limite" | "no_reclamable" | "no_existe" | "cerrada";

export interface Emisores {
  texto: typeof enviarTexto;
  plantilla: typeof enviarPlantilla;
  ahora: () => Date;
}
const REAL: Emisores = { texto: enviarTexto, plantilla: enviarPlantilla, ahora: () => new Date() };

interface Actor {
  usuarioId: string;
  soporteAdminId?: string | null;
}

/**
 * Pide al cliente el justificante de los cargos indicados. Devuelve el resultado de cada uno.
 * Comprueba que el cargo es de la empresa, no está conciliado y no se ha reclamado hace poco.
 */
export async function reclamar(
  empresaId: string,
  movimientoIds: string[],
  actor: Actor,
  emisores: Emisores = REAL
): Promise<Array<{ movimientoId: string; resultado: ResultadoEnvio }>> {
  const ids = [...new Set(movimientoIds)].slice(0, MAX_POR_PETICION);
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, whatsapp: true, ultimoMensajeWhatsappEn: true, gestoria: { select: { id: true, nombre: true } } },
  });
  if (!empresa) return ids.map((movimientoId) => ({ movimientoId, resultado: "no_existe" as const }));

  const movs = await prisma.movimientoBancario.findMany({
    where: { id: { in: ids }, empresaId },
    include: { conciliacion: { select: { id: true } }, solicitud: true },
  });
  const porId = new Map(movs.map((m) => [m.id, m]));
  const c = config();
  const salida: Array<{ movimientoId: string; resultado: ResultadoEnvio }> = [];
  let enviadas = 0;

  for (const id of ids) {
    const m = porId.get(id);
    if (!m) {
      salida.push({ movimientoId: id, resultado: "no_existe" });
      continue;
    }
    const ahora = emisores.ahora();
    const cent = aCentimos(m.importe.toNumber());
    if (m.conciliacion || !esReclamable({ importeCent: cent, descripcion: m.descripcion })) {
      salida.push({ movimientoId: id, resultado: "no_reclamable" });
      continue;
    }
    const s = m.solicitud;
    if (s && (s.estado === "RESUELTA" || s.estado === "SIN_JUSTIFICANTE" || s.estado === "OMITIDA")) {
      salida.push({ movimientoId: id, resultado: "cerrada" });
      continue;
    }
    if (s && (s.envios >= MAX_ENVIOS || (s.ultimoEnvioEn && ahora.getTime() - s.ultimoEnvioEn.getTime() < HORAS_ENTRE_ENVIOS * 3_600_000))) {
      salida.push({ movimientoId: id, resultado: "limite" });
      continue;
    }
    if (!empresa.whatsapp || !empresa.gestoria) {
      await guardar(empresa.id, id, { estado: "SIN_CANAL" }, actor.usuarioId);
      salida.push({ movimientoId: id, resultado: "sin_canal" });
      continue;
    }

    const datos: DatosReclamo = { gestoria: empresa.gestoria.nombre, importeCent: cent, fecha: m.fecha, descripcion: m.descripcion };
    let via: "texto" | "plantilla" | null = null;
    let ok = false;
    if (ventanaAbierta(empresa.ultimoMensajeWhatsappEn, ahora)) {
      via = "texto";
      ok = await emisores.texto(empresa.whatsapp, textoReclamo(datos)).catch(() => false);
    } else if (c.WHATSAPP_PLANTILLA_RECLAMO) {
      via = "plantilla";
      ok = await emisores.plantilla(empresa.whatsapp, c.WHATSAPP_PLANTILLA_RECLAMO, c.WHATSAPP_PLANTILLA_IDIOMA, parametrosPlantilla(datos)).catch(() => false);
    }
    if (ok && via) {
      await guardar(empresa.id, id, { estado: "ENVIADA", envios: (s?.envios ?? 0) + 1, ultimoEnvioEn: ahora, via }, actor.usuarioId);
      salida.push({ movimientoId: id, resultado: "enviada" });
      enviadas++;
    } else {
      // Sin ventana abierta y sin plantilla configurada, o Meta lo rechazó: queda anotado para reintentar.
      await guardar(empresa.id, id, { estado: "SIN_CANAL" }, actor.usuarioId);
      salida.push({ movimientoId: id, resultado: via ? "sin_canal" : "fuera_de_ventana" });
    }
  }

  if (enviadas > 0) {
    await registrarAuditoria({
      usuarioId: actor.usuarioId,
      gestoriaId: empresa.gestoria?.id ?? null,
      accion: "reclamacion.enviada",
      entidad: "Empresa",
      entidadId: empresa.id,
      detalle: { enviadas },
      impersonadoPorId: actor.soporteAdminId,
    });
  }
  log("info", "reclamacion.lote", { solicitados: ids.length, enviadas });
  return salida;
}

async function guardar(
  empresaId: string,
  movimientoId: string,
  datos: { estado: "ENVIADA" | "SIN_CANAL"; envios?: number; ultimoEnvioEn?: Date; via?: string },
  usuarioId: string
) {
  await prisma.solicitudJustificante.upsert({
    where: { movimientoId },
    create: { empresaId, movimientoId, creadaPorId: usuarioId, ...datos },
    update: datos,
  });
}

/** El gestor decide que ese cargo no necesita justificante. */
export async function omitir(empresaId: string, movimientoId: string, actor: Actor): Promise<boolean> {
  const m = await prisma.movimientoBancario.findFirst({ where: { id: movimientoId, empresaId }, select: { id: true } });
  if (!m) return false;
  await prisma.solicitudJustificante.upsert({
    where: { movimientoId },
    create: { empresaId, movimientoId, estado: "OMITIDA", creadaPorId: actor.usuarioId },
    update: { estado: "OMITIDA" },
  });
  await registrarAuditoria({
    usuarioId: actor.usuarioId,
    accion: "reclamacion.omitida",
    entidad: "MovimientoBancario",
    entidadId: movimientoId,
    impersonadoPorId: actor.soporteAdminId,
  });
  return true;
}

/** Al confirmar la conciliación, la solicitud queda resuelta. */
export async function resolverPorConciliacion(movimientoId: string): Promise<void> {
  await prisma.solicitudJustificante.updateMany({
    where: { movimientoId, estado: { in: ["PENDIENTE", "ENVIADA", "SIN_CANAL"] } },
    data: { estado: "RESUELTA" },
  });
}

/** Si el cliente contesta «NO TENGO», se cierra la última solicitud enviada. Devuelve true si cerró alguna. */
export async function marcarSinJustificante(empresaId: string): Promise<boolean> {
  const ultima = await prisma.solicitudJustificante.findFirst({
    where: { empresaId, estado: "ENVIADA" },
    orderBy: { ultimoEnvioEn: "desc" },
    select: { id: true },
  });
  if (!ultima) return false;
  await prisma.solicitudJustificante.update({ where: { id: ultima.id }, data: { estado: "SIN_JUSTIFICANTE" } });
  return true;
}

export const esNoTengo = (texto: string) => /^\s*no\s+(lo\s+)?tengo\b/i.test(texto);

/** Estado de las solicitudes de una empresa, por cargo. */
export async function solicitudesDe(empresaId: string) {
  const filas = await prisma.solicitudJustificante.findMany({
    where: { empresaId },
    select: { movimientoId: true, estado: true, envios: true, ultimoEnvioEn: true },
  });
  return new Map(filas.map((f) => [f.movimientoId, f]));
}
