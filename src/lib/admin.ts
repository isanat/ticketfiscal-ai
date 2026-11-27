// Servicios de la administración del dueño: listados con filtros, cambios de estado con auditoría,
// panel de uso e integraciones. Nada de aquí devuelve secretos ni hashes.
import { Prisma } from "@prisma/client";
import { config } from "./env";
import { prisma } from "./prisma";
import { revocarTodasDeUsuario } from "./sesiones";
import { registrarAuditoria } from "./store";

export const TAM_PAGINA = 25;

export interface Pagina<T> {
  filas: T[];
  total: number;
  pagina: number;
  paginas: number;
}

function pagina(p: number | undefined): { skip: number; take: number; pagina: number } {
  const n = Math.max(1, Math.floor(p ?? 1));
  return { skip: (n - 1) * TAM_PAGINA, take: TAM_PAGINA, pagina: n };
}

const cierra = <T>(filas: T[], total: number, p: number): Pagina<T> => ({
  filas,
  total,
  pagina: p,
  paginas: Math.max(1, Math.ceil(total / TAM_PAGINA)),
});

// ------------------------------------------------------------------ Resumen y uso

export async function resumenAdmin() {
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [gestorias, empresas, usuarios, docsTotal, docs30, porDia, usoProv, usoDia, topEmpresas, pendientes] = await Promise.all([
    prisma.gestoria.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.empresa.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.usuario.groupBy({ by: ["rol", "estado"], _count: { _all: true } }),
    prisma.documento.count({ where: { eliminadoEn: null } }),
    prisma.documento.count({ where: { eliminadoEn: null, createdAt: { gte: hace30 } } }),
    prisma.$queryRaw<Array<{ dia: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS dia, count(*)::int AS n
      FROM "Documento" WHERE "createdAt" >= ${hace30} AND "eliminadoEn" IS NULL GROUP BY 1 ORDER BY 1`,
    prisma.usoVision.groupBy({
      by: ["proveedor", "modelo", "ok"],
      where: { createdAt: { gte: hace30 } },
      _count: { _all: true },
      _sum: { entrada: true, salida: true, ms: true },
    }),
    prisma.$queryRaw<Array<{ dia: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS dia, count(*)::int AS n
      FROM "UsoVision" WHERE "createdAt" >= ${hace30} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ empresa: string; n: number }>>`
      SELECT e."nombre" AS empresa, count(*)::int AS n
      FROM "Documento" d JOIN "Empresa" e ON e."id" = d."empresaId"
      WHERE d."createdAt" >= ${hace30} AND d."eliminadoEn" IS NULL
      GROUP BY e."nombre" ORDER BY n DESC LIMIT 5`,
    prisma.gestoria.count({ where: { estado: "PENDIENTE" } }),
  ]);

  const cuenta = <K extends string>(filas: Array<{ _count: { _all: number } } & Record<K, string>>, k: K) =>
    Object.fromEntries(filas.map((f) => [f[k], f._count._all]));
  const porRol: Record<string, { total: number; suspendidos: number }> = {};
  for (const u of usuarios) {
    const r = (porRol[u.rol] ??= { total: 0, suspendidos: 0 });
    r.total += u._count._all;
    if (u.estado === "SUSPENDIDA") r.suspendidos += u._count._all;
  }
  const llamadas = usoProv.reduce((s, f) => s + f._count._all, 0);
  const errores = usoProv.filter((f) => !f.ok).reduce((s, f) => s + f._count._all, 0);

  return {
    gestorias: cuenta(gestorias, "estado"),
    empresas: cuenta(empresas, "estado"),
    usuarios: porRol,
    documentos: { total: docsTotal, ultimos30d: docs30, porDia },
    ia: {
      llamadas30d: llamadas,
      errores30d: errores,
      tokensEntrada30d: usoProv.reduce((s, f) => s + (f._sum.entrada ?? 0), 0),
      tokensSalida30d: usoProv.reduce((s, f) => s + (f._sum.salida ?? 0), 0),
      porProveedor: usoProv.map((f) => ({
        proveedor: f.proveedor,
        modelo: f.modelo,
        ok: f.ok,
        llamadas: f._count._all,
        entrada: f._sum.entrada ?? 0,
        salida: f._sum.salida ?? 0,
        msMedio: f._count._all ? Math.round((f._sum.ms ?? 0) / f._count._all) : 0,
      })),
      porDia: usoDia,
    },
    topEmpresas,
    pendientesDeAprobacion: pendientes,
  };
}

// ------------------------------------------------------------------ Gestorías

export async function listarGestoriasAdmin(f: { q?: string; estado?: string; pagina?: number }) {
  const where: Prisma.GestoriaWhereInput = {
    ...(f.estado ? { estado: f.estado as never } : {}),
    ...(f.q ? { OR: [{ nombre: { contains: f.q, mode: "insensitive" } }, { cif: { contains: f.q, mode: "insensitive" } }, { usuarios: { some: { email: { contains: f.q, mode: "insensitive" } } } }] } : {}),
  };
  const p = pagina(f.pagina);
  const [filas, total] = await Promise.all([
    prisma.gestoria.findMany({
      where,
      orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
      skip: p.skip,
      take: p.take,
      include: { _count: { select: { empresas: true, usuarios: true } }, usuarios: { select: { email: true, nombre: true, ultimoAcceso: true }, take: 1, orderBy: { createdAt: "asc" } } },
    }),
    prisma.gestoria.count({ where }),
  ]);
  return cierra(
    filas.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      cif: g.cif,
      ciudad: g.ciudad,
      estado: g.estado,
      motivoSuspension: g.motivoSuspension,
      createdAt: g.createdAt,
      empresas: g._count.empresas,
      usuarios: g._count.usuarios,
      contacto: g.usuarios[0] ?? null,
    })),
    total,
    p.pagina
  );
}

export async function detalleGestoria(id: string) {
  const g = await prisma.gestoria.findUnique({
    where: { id },
    include: {
      usuarios: { select: { id: true, nombre: true, email: true, estado: true, ultimoAcceso: true, createdAt: true } },
      empresas: { select: { id: true, nombre: true, nif: true, estado: true, createdAt: true, _count: { select: { documentos: true } } }, orderBy: { nombre: "asc" } },
    },
  });
  if (!g) return null;
  return {
    id: g.id,
    nombre: g.nombre,
    cif: g.cif,
    ciudad: g.ciudad,
    estado: g.estado,
    motivoSuspension: g.motivoSuspension,
    createdAt: g.createdAt,
    usuarios: g.usuarios,
    empresas: g.empresas.map((e) => ({ id: e.id, nombre: e.nombre, nif: e.nif, estado: e.estado, createdAt: e.createdAt, documentos: e._count.documentos })),
  };
}

export async function cambiarEstadoGestoria(id: string, estado: "ACTIVA" | "SUSPENDIDA", motivo: string | null, adminId: string): Promise<boolean> {
  const g = await prisma.gestoria.findUnique({ where: { id }, select: { estado: true, usuarios: { select: { id: true } } } });
  if (!g) return false;
  await prisma.gestoria.update({ where: { id }, data: { estado, motivoSuspension: estado === "SUSPENDIDA" ? motivo : null } });
  // Al suspender se cierran las sesiones de sus gestores: el corte es inmediato.
  if (estado === "SUSPENDIDA") for (const u of g.usuarios) await revocarTodasDeUsuario(u.id);
  await registrarAuditoria({
    usuarioId: adminId,
    gestoriaId: id,
    accion: estado === "ACTIVA" ? (g.estado === "PENDIENTE" ? "gestoria.aprobada" : "gestoria.reactivada") : "gestoria.suspendida",
    entidad: "Gestoria",
    entidadId: id,
    detalle: { estadoAnterior: g.estado, motivo },
  });
  return true;
}

// ------------------------------------------------------------------ Usuarios

export async function listarUsuariosAdmin(f: { q?: string; rol?: string; estado?: string; gestoriaId?: string; pagina?: number }) {
  const where: Prisma.UsuarioWhereInput = {
    ...(f.rol ? { rol: f.rol as never } : {}),
    ...(f.estado ? { estado: f.estado as never } : {}),
    ...(f.gestoriaId ? { OR: [{ gestoriaId: f.gestoriaId }, { empresa: { gestoriaId: f.gestoriaId } }] } : {}),
    ...(f.q ? { AND: [{ OR: [{ nombre: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] }] } : {}),
  };
  const p = pagina(f.pagina);
  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      select: {
        id: true, nombre: true, email: true, rol: true, estado: true, motivoSuspension: true, ultimoAcceso: true, createdAt: true,
        gestoria: { select: { id: true, nombre: true, estado: true } },
        empresa: { select: { id: true, nombre: true, nif: true, estado: true, gestoria: { select: { id: true, nombre: true } } } },
      },
    }),
    prisma.usuario.count({ where }),
  ]);
  return cierra(filas, total, p.pagina);
}

/** Suspende o reactiva una cuenta. Un administrador no puede suspenderse a sí mismo ni a otro. */
export async function cambiarEstadoUsuario(id: string, estado: "ACTIVA" | "SUSPENDIDA", motivo: string | null, adminId: string): Promise<"ok" | "no_existe" | "prohibido"> {
  const u = await prisma.usuario.findUnique({ where: { id }, select: { rol: true, estado: true, gestoriaId: true, empresa: { select: { gestoriaId: true } } } });
  if (!u) return "no_existe";
  if (u.rol === "ADMIN" || id === adminId) return "prohibido";
  await prisma.usuario.update({
    where: { id },
    data: estado === "SUSPENDIDA" ? { estado, motivoSuspension: motivo, suspendidoEn: new Date() } : { estado, motivoSuspension: null, suspendidoEn: null },
  });
  if (estado === "SUSPENDIDA") await revocarTodasDeUsuario(id);
  await registrarAuditoria({
    usuarioId: adminId,
    gestoriaId: u.gestoriaId ?? u.empresa?.gestoriaId ?? null,
    accion: estado === "SUSPENDIDA" ? "usuario.suspendido" : "usuario.reactivado",
    entidad: "Usuario",
    entidadId: id,
    detalle: { estadoAnterior: u.estado, motivo },
  });
  return "ok";
}

// ------------------------------------------------------------------ Empresas

export async function listarEmpresasAdmin(f: { q?: string; estado?: string; gestoriaId?: string; pagina?: number }) {
  const where: Prisma.EmpresaWhereInput = {
    ...(f.estado ? { estado: f.estado as never } : {}),
    ...(f.gestoriaId ? { gestoriaId: f.gestoriaId } : {}),
    ...(f.q ? { OR: [{ nombre: { contains: f.q, mode: "insensitive" } }, { nif: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const p = pagina(f.pagina);
  const [filas, total] = await Promise.all([
    prisma.empresa.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { gestoria: { select: { id: true, nombre: true } }, _count: { select: { documentos: true } }, usuarios: { select: { id: true, email: true } } },
    }),
    prisma.empresa.count({ where }),
  ]);
  return cierra(
    filas.map((e) => ({
      id: e.id, nombre: e.nombre, nif: e.nif, ciudad: e.ciudad, whatsapp: e.whatsapp, estado: e.estado, motivoSuspension: e.motivoSuspension,
      createdAt: e.createdAt, gestoria: e.gestoria, documentos: e._count.documentos, usuarios: e.usuarios,
    })),
    total,
    p.pagina
  );
}

export async function actualizarEmpresaAdmin(
  id: string,
  cambios: { estado?: "APROBADA" | "RECHAZADA" | "SUSPENDIDA"; gestoriaId?: string | null; motivo?: string | null },
  adminId: string
): Promise<"ok" | "no_existe" | "gestoria_no_existe"> {
  const e = await prisma.empresa.findUnique({ where: { id }, select: { estado: true, gestoriaId: true, usuarios: { select: { id: true } } } });
  if (!e) return "no_existe";
  if (cambios.gestoriaId) {
    const g = await prisma.gestoria.findUnique({ where: { id: cambios.gestoriaId }, select: { id: true } });
    if (!g) return "gestoria_no_existe";
  }
  await prisma.empresa.update({
    where: { id },
    data: {
      ...(cambios.estado ? { estado: cambios.estado, motivoSuspension: cambios.estado === "SUSPENDIDA" ? cambios.motivo ?? null : null } : {}),
      ...(cambios.gestoriaId !== undefined ? { gestoriaId: cambios.gestoriaId } : {}),
    },
  });
  if (cambios.estado === "SUSPENDIDA") for (const u of e.usuarios) await revocarTodasDeUsuario(u.id);
  await registrarAuditoria({
    usuarioId: adminId,
    gestoriaId: cambios.gestoriaId ?? e.gestoriaId,
    accion: cambios.estado ? `empresa.${cambios.estado.toLowerCase()}` : "empresa.reasignada",
    entidad: "Empresa",
    entidadId: id,
    detalle: { estadoAnterior: e.estado, gestoriaAnterior: e.gestoriaId, ...cambios },
  });
  return "ok";
}

// ------------------------------------------------------------------ Auditoría y sesiones

export async function listarAuditoriaAdmin(f: { accion?: string; entidad?: string; usuarioId?: string; desde?: Date; hasta?: Date; pagina?: number }) {
  const where: Prisma.AuditoriaEventoWhereInput = {
    ...(f.accion ? { accion: { startsWith: f.accion } } : {}),
    ...(f.entidad ? { entidad: f.entidad } : {}),
    ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}),
    ...(f.desde || f.hasta ? { createdAt: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lte: f.hasta } : {}) } } : {}),
  };
  const p = pagina(f.pagina);
  const [filas, total] = await Promise.all([
    prisma.auditoriaEvento.findMany({
      where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take,
      include: { usuario: { select: { nombre: true, email: true, rol: true } } },
    }),
    prisma.auditoriaEvento.count({ where }),
  ]);
  return cierra(
    filas.map((a) => ({
      id: a.id, accion: a.accion, entidad: a.entidad, entidadId: a.entidadId, detalle: a.detalle, createdAt: a.createdAt,
      gestoriaId: a.gestoriaId, impersonadoPorId: a.impersonadoPorId,
      usuario: a.usuario ? { nombre: a.usuario.nombre, email: a.usuario.email, rol: a.usuario.rol } : null,
    })),
    total,
    p.pagina
  );
}

export async function listarSesionesAdmin(f: { usuarioId?: string; pagina?: number }) {
  const where: Prisma.SesionWhereInput = { revocadaEn: null, expiraEn: { gt: new Date() }, ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}) };
  const p = pagina(f.pagina);
  const [filas, total] = await Promise.all([
    prisma.sesion.findMany({
      where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take,
      select: { id: true, createdAt: true, expiraEn: true, ip: true, userAgent: true, impersonadoPorId: true, usuario: { select: { id: true, nombre: true, email: true, rol: true } } },
    }),
    prisma.sesion.count({ where }),
  ]);
  return cierra(filas, total, p.pagina);
}

// ------------------------------------------------------------------ Integraciones (solo estado, nunca valores)

export function estadoIntegraciones() {
  const c = config();
  const hay = (...v: Array<string | undefined | boolean>) => v.every(Boolean);
  return [
    { clave: "base_de_datos", nombre: "Base de datos (Neon)", configurada: hay(c.STORAGE_POSTGRES_PRISMA_URL), detalle: "Variables STORAGE_POSTGRES_*" },
    { clave: "gemini", nombre: "Gemini", configurada: hay(c.GEMINI_API_KEY), detalle: `Modelo: ${c.GEMINI_MODEL}` },
    { clave: "anthropic", nombre: "Claude (Anthropic)", configurada: hay(c.ANTHROPIC_API_KEY), detalle: `Modelo: ${c.ANTHROPIC_MODEL}` },
    { clave: "glm", nombre: "GLM (ZAI)", configurada: hay(c.ZAI_BASE_URL, c.ZAI_API_KEY), detalle: `Modelo: ${c.ZAI_MODEL}` },
    { clave: "whatsapp", nombre: "WhatsApp Cloud API", configurada: hay(c.WHATSAPP_VERIFY_TOKEN, c.WHATSAPP_APP_SECRET, c.WHATSAPP_ACCESS_TOKEN, c.WHATSAPP_PHONE_NUMBER_ID), detalle: "Verify token, App Secret, token de acceso e ID de número" },
    { clave: "email", nombre: "E-mail (Resend)", configurada: hay(c.RESEND_API_KEY, c.EMAIL_REMITENTE), detalle: c.EMAIL_2FA_ACTIVO ? "Código por e-mail ACTIVO" : "Código por e-mail desactivado (falta dominio verificado)" },
    { clave: "admin_cifrado", nombre: "Clave de cifrado del administrador", configurada: hay(c.ADMIN_ENCRYPTION_KEY), detalle: "ADMIN_ENCRYPTION_KEY" },
  ];
}
