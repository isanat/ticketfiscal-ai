// Acceso a datos multi-tenant sobre Postgres (Prisma). Toda consulta sobre documentos
// filtra por gestoría o por empresa; no hay consultas globales desde las rutas.
import { Prisma, type Empresa as EmpresaFila } from "@prisma/client";
import { prisma } from "./prisma";
import type { Documento, EmpresaResumen, EstadoEmpresa, LineaImpuesto, RevisionDocumento, Rol, UsuarioSesion } from "./types";
import { trimestreDe } from "./fiscal";

type DocumentoFila = Prisma.DocumentoGetPayload<{ include: { lineas: true } }>;

const n = (d: Prisma.Decimal | number | null | undefined): number =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : d.toNumber();

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function aEmpresa(f: EmpresaFila): Omit<EmpresaResumen, "documentos" | "pendientes" | "ivaDeducible" | "ultimoDocumento"> {
  return {
    id: f.id,
    nombre: f.nombre,
    nif: f.nif,
    direccion: f.direccion,
    ciudad: f.ciudad,
    whatsapp: f.whatsapp,
    gestoriaId: f.gestoriaId,
    estado: f.estado as EstadoEmpresa,
    createdAt: f.createdAt.toISOString(),
  };
}

export function aDocumento(f: DocumentoFila): Documento {
  const desglose: LineaImpuesto[] = [...f.lineas]
    .sort((a, b) => a.orden - b.orden)
    .map((l) => ({ orden: l.orden, baseImponible: n(l.baseImponible), porcentajeIva: n(l.porcentajeIva), cuotaIva: n(l.cuotaIva) }));
  return {
    id: f.id,
    empresaId: f.empresaId,
    estado: f.estado,
    tipoDocumento: f.tipoDocumento,
    ivaDeducible: f.ivaDeducible,
    emisorNombre: f.emisorNombre,
    emisorNif: f.emisorNif,
    nifEmisorValido: f.nifEmisorValido,
    receptorNombre: f.receptorNombre,
    receptorNif: f.receptorNif,
    nifReceptorValido: f.nifReceptorValido,
    numeroFactura: f.numeroFactura,
    fechaEmision: f.fechaEmision ? f.fechaEmision.toISOString().slice(0, 10) : null,
    moneda: f.moneda,
    baseImponible: n(f.baseImponible),
    porcentajeIva: n(f.porcentajeIva),
    cuotaIva: n(f.cuotaIva),
    irpfPorcentaje: n(f.irpfPorcentaje),
    irpfImporte: n(f.irpfImporte),
    totalFactura: n(f.totalFactura),
    cuentaPgc: f.cuentaPgc,
    confianza: f.confianza,
    motivoRevision: f.motivoRevision,
    mensajeWhatsapp: f.mensajeWhatsapp,
    imagenNombre: f.imagenNombre,
    trimestre: f.trimestre,
    desglose,
    revision: f.revision as RevisionDocumento,
    revisadoEn: iso(f.revisadoEn),
    origen: f.origen,
    createdAt: f.createdAt.toISOString(),
  };
}

// ------------------------------------------------------------------ Gestorías y usuarios

export async function listarGestorias(): Promise<Array<{ id: string; nombre: string }>> {
  return prisma.gestoria.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" }, take: 500 });
}

export async function findUsuarioPorEmail(email: string) {
  return prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function registrarGestor(entrada: {
  nombre: string;
  email: string;
  passwordHash: string;
  gestoriaNombre: string;
  gestoriaCif: string | null;
}): Promise<string> {
  const usuario = await prisma.$transaction(async (tx) => {
    const gestoria = await tx.gestoria.create({
      data: { nombre: entrada.gestoriaNombre, cif: entrada.gestoriaCif },
    });
    return tx.usuario.create({
      data: {
        email: entrada.email,
        passwordHash: entrada.passwordHash,
        nombre: entrada.nombre,
        rol: "GESTOR" as Rol,
        gestoriaId: gestoria.id,
      },
    });
  });
  return usuario.id;
}

export async function registrarCliente(entrada: {
  nombre: string;
  email: string;
  passwordHash: string;
  empresa: { nombre: string; nif: string; direccion: string | null; ciudad: string | null; whatsapp: string | null };
  gestoriaId: string | null;
}): Promise<string> {
  const usuario = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: { ...entrada.empresa, gestoriaId: entrada.gestoriaId, estado: "PENDIENTE" },
    });
    return tx.usuario.create({
      data: {
        email: entrada.email,
        passwordHash: entrada.passwordHash,
        nombre: entrada.nombre,
        rol: "CLIENTE" as Rol,
        empresaId: empresa.id,
      },
    });
  });
  return usuario.id;
}

/** Contexto del usuario para el frontend (sin hash). Se usa en login, registro y sesión. */
export async function contextoUsuarioPorId(usuarioId: string): Promise<UsuarioSesion | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { gestoria: true, empresa: true },
  });
  if (!u) return null;
  const base: UsuarioSesion = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol as Rol };
  if (u.gestoria) base.gestoria = { id: u.gestoria.id, nombre: u.gestoria.nombre };
  if (u.empresa) {
    base.empresa = {
      id: u.empresa.id,
      nombre: u.empresa.nombre,
      nif: u.empresa.nif,
      ciudad: u.empresa.ciudad,
      estado: u.empresa.estado as EstadoEmpresa,
    };
  }
  return base;
}

// ------------------------------------------------------------------ Empresas

export async function listarEmpresasDeGestoria(gestoriaId: string): Promise<EmpresaResumen[]> {
  const empresas = await prisma.empresa.findMany({
    where: { gestoriaId },
    orderBy: { nombre: "asc" },
  });
  if (empresas.length === 0) return [];
  const ids = empresas.map((e) => e.id);
  const base = { empresaId: { in: ids }, eliminadoEn: null };

  const [totales, pendientes, iva, ultimos] = await Promise.all([
    prisma.documento.groupBy({ by: ["empresaId"], where: base, _count: { _all: true } }),
    prisma.documento.groupBy({
      by: ["empresaId"],
      where: { ...base, revision: "PENDIENTE", NOT: { estado: "VALIDO" } },
      _count: { _all: true },
    }),
    prisma.documento.groupBy({
      by: ["empresaId"],
      where: { ...base, ivaDeducible: true },
      _sum: { cuotaIva: true },
    }),
    prisma.documento.groupBy({ by: ["empresaId"], where: base, _max: { fechaEmision: true } }),
  ]);
  const porId = <T extends { empresaId: string }>(filas: T[]) => new Map(filas.map((f) => [f.empresaId, f]));
  const mTot = porId(totales);
  const mPend = porId(pendientes);
  const mIva = porId(iva);
  const mUlt = porId(ultimos);

  return empresas.map((e) => ({
    ...aEmpresa(e),
    documentos: mTot.get(e.id)?._count._all ?? 0,
    pendientes: mPend.get(e.id)?._count._all ?? 0,
    ivaDeducible: n(mIva.get(e.id)?._sum.cuotaIva ?? 0),
    ultimoDocumento: mUlt.get(e.id)?._max.fechaEmision?.toISOString().slice(0, 10) ?? null,
  }));
}

/** Mensaje de conflicto si el NIF o el WhatsApp ya pertenecen a otra empresa (antes de insertar). */
export async function conflictoEmpresa(nif: string, whatsapp: string | null): Promise<string | null> {
  const e = await prisma.empresa.findFirst({
    where: { OR: [{ nif }, ...(whatsapp ? [{ whatsapp }] : [])] },
    select: { nif: true },
  });
  if (!e) return null;
  return e.nif === nif
    ? "Ya existe una empresa registrada con ese NIF/CIF. Contacte con su gestoría."
    : "Ese número de WhatsApp ya está asociado a otra empresa.";
}

export async function obtenerEmpresa(id: string): Promise<EmpresaFila | null> {
  return prisma.empresa.findUnique({ where: { id } });
}

export async function empresaPorWhatsapp(numero: string): Promise<EmpresaFila | null> {
  return prisma.empresa.findUnique({ where: { whatsapp: numero } });
}

export async function cambiarEstadoEmpresa(
  gestoriaId: string,
  empresaId: string,
  estado: "APROBADA" | "RECHAZADA",
  usuarioId: string
): Promise<EmpresaFila | null> {
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, gestoriaId } });
  if (!empresa) return null;
  const actualizada = await prisma.empresa.update({ where: { id: empresaId }, data: { estado } });
  await registrarAuditoria({ usuarioId, gestoriaId, accion: `empresa.${estado.toLowerCase()}`, entidad: "Empresa", entidadId: empresaId });
  return actualizada;
}

// ------------------------------------------------------------------ Documentos

export interface FiltroDocumentos {
  gestoriaId?: string;
  empresaId?: string;
  trimestre?: string | null;
  soloAprobados?: boolean;
}

function whereDocumentos(f: FiltroDocumentos): Prisma.DocumentoWhereInput {
  return {
    eliminadoEn: null,
    ...(f.empresaId ? { empresaId: f.empresaId } : {}),
    ...(f.gestoriaId ? { empresa: { gestoriaId: f.gestoriaId } } : {}),
    ...(f.trimestre ? { trimestre: f.trimestre } : {}),
    ...(f.soloAprobados ? { revision: "APROBADO" } : {}),
  };
}

export async function listarDocumentos(f: FiltroDocumentos = {}, limite = 2000): Promise<Documento[]> {
  const filas = await prisma.documento.findMany({
    where: whereDocumentos(f),
    include: { lineas: true },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
  return filas.map(aDocumento);
}

export async function obtenerDocumentoDeGestoria(id: string, gestoriaId: string): Promise<DocumentoFila | null> {
  return prisma.documento.findFirst({
    where: { id, eliminadoEn: null, empresa: { gestoriaId } },
    include: { lineas: true },
  });
}

export async function buscarDuplicadoPorNumero(
  empresaId: string,
  emisorNif: string,
  numeroFactura: string
): Promise<{ id: string; numeroFactura: string | null } | null> {
  return prisma.documento.findFirst({
    where: { empresaId, emisorNif, numeroFactura, eliminadoEn: null },
    select: { id: true, numeroFactura: true },
  });
}

export async function buscarPorHashImagen(empresaId: string, imagenHash: string): Promise<DocumentoFila | null> {
  return prisma.documento.findFirst({
    where: { empresaId, imagenHash, eliminadoEn: null },
    include: { lineas: true },
  });
}

export interface NuevoDocumento {
  empresaId: string;
  estado: "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE";
  tipoDocumento: "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA" | "NO_VALIDO";
  ivaDeducible: boolean;
  emisorNombre: string | null;
  emisorNif: string | null;
  nifEmisorValido: boolean | null;
  receptorNombre: string | null;
  receptorNif: string | null;
  nifReceptorValido: boolean | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  moneda: string;
  lineas: Array<{ orden: number; baseImponible: number; porcentajeIva: number; cuotaIva: number }>;
  baseImponible: number;
  porcentajeIva: number;
  cuotaIva: number;
  irpfPorcentaje: number;
  irpfImporte: number;
  totalFactura: number;
  cuentaPgc: string | null;
  confianza: number;
  motivoRevision: string | null;
  mensajeWhatsapp: string | null;
  imagenNombre: string | null;
  imagenMime: string;
  imagenBytes: number;
  imagenHash: string;
  origen: "WEB" | "WHATSAPP";
  whatsappMensajeId: string | null;
}

export async function crearDocumento(entrada: NuevoDocumento): Promise<DocumentoFila> {
  const { lineas, fechaEmision, ...resto } = entrada;
  return prisma.documento.create({
    data: {
      ...resto,
      fechaEmision: fechaEmision ? new Date(`${fechaEmision}T00:00:00Z`) : null,
      trimestre: trimestreDe(fechaEmision),
      lineas: {
        create: lineas.map((l) => ({
          orden: l.orden,
          baseImponible: l.baseImponible,
          porcentajeIva: l.porcentajeIva,
          cuotaIva: l.cuotaIva,
        })),
      },
    },
    include: { lineas: true },
  });
}

export async function actualizarRevision(
  documentoId: string,
  gestoriaId: string,
  usuarioId: string,
  cambios: { revision?: RevisionDocumento; cuentaPgc?: string | null; motivoRevision?: string | null }
): Promise<DocumentoFila | null> {
  const doc = await prisma.documento.findFirst({ where: { id: documentoId, eliminadoEn: null, empresa: { gestoriaId } } });
  if (!doc) return null;
  const actualizado = await prisma.documento.update({
    where: { id: documentoId },
    data: {
      ...(cambios.revision ? { revision: cambios.revision, revisadoEn: new Date(), revisadoPorId: usuarioId } : {}),
      ...(cambios.cuentaPgc !== undefined ? { cuentaPgc: cambios.cuentaPgc } : {}),
      ...(cambios.motivoRevision !== undefined ? { motivoRevision: cambios.motivoRevision } : {}),
    },
    include: { lineas: true },
  });
  await registrarAuditoria({
    usuarioId,
    gestoriaId,
    accion: "documento.revisado",
    entidad: "Documento",
    entidadId: documentoId,
    detalle: { cambios: { ...cambios } },
  });
  return actualizado;
}

/** Borrado lógico: el registro fiscal se conserva y queda en auditoría. */
export async function eliminarDocumentoLogico(documentoId: string, gestoriaId: string, usuarioId: string): Promise<boolean> {
  const r = await prisma.documento.updateMany({
    where: { id: documentoId, eliminadoEn: null, empresa: { gestoriaId } },
    data: { eliminadoEn: new Date() },
  });
  if (r.count === 0) return false;
  await registrarAuditoria({ usuarioId, gestoriaId, accion: "documento.eliminado", entidad: "Documento", entidadId: documentoId });
  return true;
}

// ------------------------------------------------------------------ Auditoría

export async function registrarAuditoria(e: {
  usuarioId?: string | null;
  gestoriaId?: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  detalle?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditoriaEvento.create({
    data: {
      usuarioId: e.usuarioId ?? null,
      gestoriaId: e.gestoriaId ?? null,
      accion: e.accion,
      entidad: e.entidad,
      entidadId: e.entidadId,
      detalle: e.detalle ?? Prisma.JsonNull,
    },
  });
}
