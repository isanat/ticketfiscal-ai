// TicketFiscal AI — Capa de acceso a datos multi-tenant con dos backends:
//  · SQLite + Prisma cuando existe DATABASE_URL y el archivo es accesible
//  · Memoria con la cartera de demostración en cualquier otro caso (serverless)
// Si SQLite falla en runtime, se degrada automáticamente al modo memoria.

import { getDb, tieneSqlite } from "./db";
import { trimestreDe } from "./fiscal";
import { hashPassword } from "./hash";
import {
  SEMILLA_DOCUMENTOS,
  SEMILLA_EMPRESAS,
  SEMILLA_GESTORIAS,
  SEMILLA_USUARIOS,
  createdAtDe,
} from "./seed";
import type { Documento, Empresa, EmpresaResumen, Rol, UsuarioSesion } from "./types";

export type ModoDatos = "sqlite" | "memoria";

export type EntradaDocumento = Omit<Documento, "id" | "createdAt" | "trimestre"> & {
  trimestre?: string | null;
};

interface UsuarioRegistro {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
  gestoriaId: string | null;
  empresaId: string | null;
  createdAt: Date;
}

interface SesionRegistro {
  id: string; // token
  usuarioId: string;
  creadoEn: Date;
  expiraEn: Date;
}

const DIAS_SESION = 30;

// ------------------------------------------------------------------ Memoria

interface EstadoMemoria {
  gestorias: typeof SEMILLA_GESTORIAS;
  usuarios: UsuarioRegistro[];
  empresas: Empresa[];
  documentos: Documento[];
  sesiones: SesionRegistro[];
}

const globalMem = globalThis as unknown as {
  __tfMemoria?: EstadoMemoria;
  __tfFalloSqlite?: boolean;
};

function memoria(): EstadoMemoria {
  if (!globalMem.__tfMemoria) {
    globalMem.__tfMemoria = {
      gestorias: SEMILLA_GESTORIAS.map((g) => ({ ...g })),
      usuarios: SEMILLA_USUARIOS.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: hashPassword(u.password),
        nombre: u.nombre,
        rol: u.rol,
        gestoriaId: u.gestoriaId,
        empresaId: u.empresaId,
        createdAt: new Date("2026-01-05T09:00:00Z"),
      })),
      empresas: SEMILLA_EMPRESAS.map((e) => ({ ...e, createdAt: "2026-01-05T09:00:00.000Z" })),
      documentos: SEMILLA_DOCUMENTOS.map((d) => ({ ...d, createdAt: createdAtDe(d) })),
      sesiones: [],
    };
  }
  return globalMem.__tfMemoria;
}

// ------------------------------------------------------------------ Resguardo

/** Ejecuta una operación contra Prisma; null si SQLite no está disponible. */
async function conPrisma<T>(op: (db: ReturnType<typeof getDb>) => Promise<T>): Promise<T | null> {
  if (!tieneSqlite() || globalMem.__tfFalloSqlite) return null;
  try {
    const db = getDb();
    await asegurarSemilla(db);
    return await op(db);
  } catch (error) {
    console.warn(
      "[store] SQLite no disponible; usando memoria:",
      error instanceof Error ? error.message.split("\n").find((l) => l.trim()) ?? error.message : error
    );
    globalMem.__tfFalloSqlite = true;
    return null;
  }
}

// ------------------------------------------------------------------ Semilla SQLite

let sembrando: Promise<void> | null = null;

async function asegurarSemilla(db: ReturnType<typeof getDb>): Promise<void> {
  if (sembrando) {
    await sembrando;
    return;
  }
  sembrando = (async () => {
    if ((await db.usuario.count()) > 0) return;
    for (const g of SEMILLA_GESTORIAS) {
      await db.gestoria.create({
        data: { id: g.id, nombre: g.nombre, cif: g.cif, ciudad: g.ciudad },
      });
    }
    for (const e of SEMILLA_EMPRESAS) {
      await db.empresa.create({
        data: { ...e, createdAt: new Date("2026-01-05T09:00:00Z") },
      });
    }
    for (const u of SEMILLA_USUARIOS) {
      await db.usuario.create({
        data: {
          id: u.id,
          email: u.email,
          passwordHash: hashPassword(u.password),
          nombre: u.nombre,
          rol: u.rol,
          gestoriaId: u.gestoriaId,
          empresaId: u.empresaId,
          createdAt: new Date("2026-01-05T09:00:00Z"),
        },
      });
    }
    for (const d of SEMILLA_DOCUMENTOS) {
      const { ...resto } = d;
      await db.documento.create({
        data: { ...resto, createdAt: new Date(createdAtDe(d)) },
      });
    }
  })();
  try {
    await sembrando;
  } finally {
    sembrando = null;
  }
}

// ------------------------------------------------------------------ Modo

export function modoDatos(): ModoDatos {
  return tieneSqlite() && !globalMem.__tfFalloSqlite ? "sqlite" : "memoria";
}

// ------------------------------------------------------------------ Gestorías

export async function listarGestorias(): Promise<Array<{ id: string; nombre: string }>> {
  const filas = await conPrisma(async (db) => db.gestoria.findMany({ orderBy: { nombre: "asc" } }));
  if (filas !== null) return filas.map((g) => ({ id: g.id, nombre: g.nombre }));
  return memoria().gestorias
    .map((g) => ({ id: g.id, nombre: g.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function crearGestoria(entrada: {
  nombre: string;
  cif?: string | null;
  ciudad?: string | null;
}): Promise<{ id: string; nombre: string }> {
  const fila = await conPrisma(async (db) =>
    db.gestoria.create({
      data: { nombre: entrada.nombre, cif: entrada.cif ?? null, ciudad: entrada.ciudad ?? null },
    })
  );
  if (fila !== null) return { id: fila.id, nombre: fila.nombre };

  const id = crypto.randomUUID();
  memoria().gestorias.push({
    id,
    nombre: entrada.nombre,
    cif: entrada.cif ?? null,
    ciudad: entrada.ciudad ?? null,
  });
  return { id, nombre: entrada.nombre };
}

// ------------------------------------------------------------------ Usuarios

export async function findUsuarioPorEmail(email: string): Promise<UsuarioRegistro | null> {
  const emailNorm = email.trim().toLowerCase();
  const fila = await conPrisma((db) =>
    db.usuario.findUnique({ where: { email: emailNorm } })
  );
  if (fila !== null) return fila as UsuarioRegistro;

  return memoria().usuarios.find((u) => u.email === emailNorm) ?? null;
}

export async function crearUsuario(entrada: {
  email: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
  gestoriaId?: string | null;
  empresaId?: string | null;
}): Promise<UsuarioRegistro> {
  const data = {
    email: entrada.email.trim().toLowerCase(),
    passwordHash: entrada.passwordHash,
    nombre: entrada.nombre,
    rol: entrada.rol,
    gestoriaId: entrada.gestoriaId ?? null,
    empresaId: entrada.empresaId ?? null,
  };
  const fila = await conPrisma(async (db) => db.usuario.create({ data }));
  if (fila !== null) return fila as UsuarioRegistro;

  const usuario: UsuarioRegistro = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  memoria().usuarios.push(usuario);
  return usuario;
}

/** Contexto público del usuario (para la sesión del frontend). */
export async function contextoUsuario(usuarioId: string): Promise<UsuarioSesion | null> {
  const construir = (u: UsuarioRegistro | null): UsuarioSesion | null => {
    if (!u) return null;
    const base: UsuarioSesion = {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
    };
    if (u.rol === "GESTOR") {
      const g = memoria().gestorias.find((x) => x.id === u.gestoriaId);
      if (g) base.gestoria = { id: g.id, nombre: g.nombre };
    } else {
      const e = memoria().empresas.find((x) => x.id === u.empresaId);
      if (e) base.empresa = { id: e.id, nombre: e.nombre, nif: e.nif, ciudad: e.ciudad };
    }
    return base;
  };

  const fila = await conPrisma(async (db) =>
    db.usuario.findUnique({
      where: { id: usuarioId },
      include: { gestoria: true, empresa: true },
    })
  );
  if (fila !== null) {
    const base: UsuarioSesion = {
      id: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      rol: fila.rol as Rol,
    };
    if (fila.rol === "GESTOR" && fila.gestoria) {
      base.gestoria = { id: fila.gestoria.id, nombre: fila.gestoria.nombre };
    } else if (fila.empresa) {
      base.empresa = {
        id: fila.empresa.id,
        nombre: fila.empresa.nombre,
        nif: fila.empresa.nif,
        ciudad: fila.empresa.ciudad,
      };
    }
    return base;
  }

  return construir(memoria().usuarios.find((u) => u.id === usuarioId) ?? null);
}

// ------------------------------------------------------------------ Sesiones

export async function crearSesion(usuarioId: string): Promise<{ token: string; expiraEn: Date }> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiraEn = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);

  const ok = await conPrisma(async (db) => {
    await db.sesion.create({
      data: { id: token, usuarioId, expiraEn },
    });
    return true;
  });
  if (ok !== null) return { token, expiraEn };

  memoria().sesiones.push({
    id: token,
    usuarioId,
    creadoEn: new Date(),
    expiraEn,
  });
  return { token, expiraEn };
}

export async function leerSesion(token: string): Promise<string | null> {
  const ahora = new Date();
  const fila = await conPrisma(async (db) =>
    db.sesion.findUnique({ where: { id: token } })
  );
  if (fila !== null) {
    if (fila.expiraEn <= ahora) {
      await db.sesion.delete({ where: { id: token } }).catch(() => undefined);
      return null;
    }
    return fila.usuarioId;
  }

  const m = memoria();
  const idx = m.sesiones.findIndex((s) => s.id === token);
  if (idx === -1) return null;
  if (m.sesiones[idx].expiraEn <= ahora) {
    m.sesiones.splice(idx, 1);
    return null;
  }
  return m.sesiones[idx].usuarioId;
}

export async function borrarSesion(token: string): Promise<void> {
  await conPrisma(async (db) => {
    await db.sesion.deleteMany({ where: { id: token } });
    return true;
  });
  const m = memoria();
  m.sesiones = m.sesiones.filter((s) => s.id !== token);
}

// ------------------------------------------------------------------ Empresas

function filaAEmpresa(f: {
  id: string;
  nombre: string;
  nif: string;
  direccion: string | null;
  ciudad: string | null;
  whatsapp: string | null;
  gestoriaId: string | null;
  createdAt: Date;
}): Empresa {
  return { ...f, createdAt: f.createdAt.toISOString() };
}

export async function listarEmpresasDeGestoria(
  gestoriaId: string
): Promise<EmpresaResumen[]> {
  const resumir = (empresas: Empresa[], docs: Documento[]): EmpresaResumen[] =>
    empresas.map((e) => {
      const propios = docs.filter((d) => d.empresaId === e.id);
      return {
        ...e,
        documentos: propios.length,
        pendientes: propios.filter(
          (d) => d.estado === "REQUIERE_REVISION" || d.estado === "ILEGIBLE"
        ).length,
        ivaDeducible: propios
          .filter((d) => d.ivaDeducible)
          .reduce((s, d) => s + d.cuotaIva, 0),
        ultimoDocumento: propios
          .map((d) => d.fechaEmision)
          .filter(Boolean)
          .sort()
          .pop() ?? null,
      };
    });

  const resultado = await conPrisma(async (db) => {
    const empresas = await db.empresa.findMany({
      where: { gestoriaId },
      orderBy: { nombre: "asc" },
    });
    const docs = await db.documento.findMany({
      where: { empresa: { gestoriaId } },
    });
    return { empresas, docs };
  });
  if (resultado !== null) {
    const empresas = resultado.empresas.map(filaAEmpresa);
    const docs = resultado.docs as unknown as Documento[];
    return resumir(empresas, docs);
  }

  const m = memoria();
  return resumir(
    m.empresas.filter((e) => e.gestoriaId === gestoriaId),
    m.documentos
  );
}

export async function crearEmpresa(entrada: {
  nombre: string;
  nif: string;
  direccion?: string | null;
  ciudad?: string | null;
  whatsapp?: string | null;
  gestoriaId?: string | null;
}): Promise<Empresa> {
  const data = {
    nombre: entrada.nombre,
    nif: entrada.nif,
    direccion: entrada.direccion ?? null,
    ciudad: entrada.ciudad ?? null,
    whatsapp: entrada.whatsapp ?? null,
    gestoriaId: entrada.gestoriaId ?? null,
  };
  const fila = await conPrisma(async (db) => db.empresa.create({ data }));
  if (fila !== null) return filaAEmpresa(fila);

  const empresa: Empresa = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  memoria().empresas.push(empresa);
  return empresa;
}

export async function obtenerEmpresa(id: string): Promise<Empresa | null> {
  const fila = await conPrisma((db) => db.empresa.findUnique({ where: { id } }));
  if (fila !== null) return filaAEmpresa(fila);
  return memoria().empresas.find((e) => e.id === id) ?? null;
}

// ------------------------------------------------------------------ Documentos

interface FiltroDocumentos {
  gestoriaId?: string;
  empresaId?: string;
  trimestre?: string | null;
}

export async function listarDocumentos(filtro: FiltroDocumentos = {}): Promise<Documento[]> {
  const where = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.gestoriaId ? { empresa: { gestoriaId: filtro.gestoriaId } } : {}),
    ...(filtro.trimestre ? { trimestre: filtro.trimestre } : {}),
  };

  const filas = await conPrisma(async (db) => {
    await asegurarSemilla(db);
    return db.documento.findMany({ where, orderBy: { createdAt: "desc" } });
  });
  if (filas !== null) {
    return (filas as unknown as Array<Documento & { createdAt: Date }>).map((f) => ({
      ...f,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    }));
  }

  const m = memoria();
  return m.documentos
    .filter((d) => {
      if (filtro.empresaId && d.empresaId !== filtro.empresaId) return false;
      if (filtro.trimestre && d.trimestre !== filtro.trimestre) return false;
      if (filtro.gestoriaId) {
        const emp = m.empresas.find((e) => e.id === d.empresaId);
        if (!emp || emp.gestoriaId !== filtro.gestoriaId) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function crearDocumento(entrada: EntradaDocumento): Promise<Documento> {
  const trimestre = entrada.trimestre ?? trimestreDe(entrada.fechaEmision);
  const fila = await conPrisma(async (db) => {
    await asegurarSemilla(db);
    return db.documento.create({ data: { ...entrada, trimestre } });
  });
  if (fila !== null) {
    return {
      ...(fila as unknown as Documento & { createdAt: Date }),
      createdAt: fila.createdAt.toISOString(),
    };
  }

  const doc: Documento = {
    ...entrada,
    trimestre,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  memoria().documentos.unshift(doc);
  return doc;
}

export async function eliminarDocumento(id?: string | null): Promise<void> {
  const ok = await conPrisma(async (db) => {
    await asegurarSemilla(db);
    if (id) {
      await db.documento.delete({ where: { id } });
    } else {
      await db.documento.deleteMany({});
    }
    return true;
  });
  if (ok !== null) return;

  const m = memoria();
  m.documentos = id ? m.documentos.filter((d) => d.id !== id) : [];
}
