// TicketFiscal AI — Capa de acceso a datos con dos backends:
//  · SQLite + Prisma cuando existe DATABASE_URL y el archivo es accesible
//    (entorno local / servidor propio)
//  · Memoria con datos de demostración en cualquier otro caso (p. ej. Vercel)
// Si SQLite falla en tiempo de ejecución (ruta inexistente, sistema de
// archivos de solo lectura, despliegue serverless…), se degrada
// automáticamente al modo memoria sin romper la demo.
// El resto de la aplicación solo habla con este módulo.

import { getDb, tieneSqlite } from "./db";
import { trimestreDe } from "./fiscal";
import { SEMILLA_DOCUMENTOS } from "./seed";
import type { Documento } from "./types";

export type ModoDatos = "sqlite" | "memoria";

/** Campos editables al crear un documento (id/createdAt/trimestre los gestiona el store). */
export type EntradaDocumento = Omit<Documento, "id" | "createdAt" | "trimestre"> & {
  trimestre?: string | null;
};

interface FilaDocumento {
  id: string;
  clienteNombre: string;
  clienteNif: string;
  estado: string;
  tipoDocumento: string;
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
  trimestre: string | null;
  createdAt: Date | string;
}

function filaADocumento(f: FilaDocumento): Documento {
  return {
    ...f,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
  };
}

// ------------------------------------------------------------------ Modo memoria

interface EstadoMemoria {
  documentos: Documento[];
}

const globalMem = globalThis as unknown as {
  __ticketfiscalMemoria?: EstadoMemoria;
  __ticketfiscalFalloSqlite?: boolean;
};

function memoria(): EstadoMemoria {
  globalMem.__ticketfiscalMemoria ??= {
    documentos: SEMILLA_DOCUMENTOS.map((d) => ({ ...d })),
  };
  return globalMem.__ticketfiscalMemoria;
}

// ------------------------------------------------------------------ Resguardo SQLite

/**
 * Ejecuta una operación contra Prisma y devuelve null si SQLite no está
 * disponible (sin DATABASE_URL, archivo inaccesible, FS de solo lectura…).
 * El primer fallo desactiva SQLite para el resto de la vida del proceso.
 */
async function conPrisma<T>(op: (db: ReturnType<typeof getDb>) => Promise<T>): Promise<T | null> {
  if (!tieneSqlite() || globalMem.__ticketfiscalFalloSqlite) return null;
  try {
    return await op(getDb());
  } catch (error) {
    console.warn(
      "[store] SQLite no disponible en este entorno; cambiando a modo memoria:",
      error instanceof Error ? error.message.split("\n")[0] : error
    );
    globalMem.__ticketfiscalFalloSqlite = true;
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
  // Siembra el lote de demostración la primera vez que la base está vacía.
  // Se re-evalúa en cada llamada (tras un "borrar todo" se vuelve a sembrar).
  sembrando = (async () => {
    if ((await db.documento.count()) > 0) return;
    for (const doc of SEMILLA_DOCUMENTOS) {
      const { id, createdAt, ...resto } = doc;
      await db.documento.create({
        data: { ...resto, id, createdAt: new Date(createdAt) },
      });
    }
  })();
  try {
    await sembrando;
  } finally {
    sembrando = null;
  }
}

// ------------------------------------------------------------------ API pública

export function modoDatos(): ModoDatos {
  return tieneSqlite() && !globalMem.__ticketfiscalFalloSqlite ? "sqlite" : "memoria";
}

export async function listarDocumentos(filtro?: {
  trimestre?: string | null;
}): Promise<Documento[]> {
  const filas = await conPrisma(async (db) => {
    await asegurarSemilla(db);
    return db.documento.findMany({
      where: filtro?.trimestre ? { trimestre: filtro.trimestre } : undefined,
      orderBy: { createdAt: "desc" },
    });
  });

  if (filas !== null) {
    return (filas as unknown as FilaDocumento[]).map(filaADocumento);
  }

  const docs = filtro?.trimestre
    ? memoria().documentos.filter((d) => d.trimestre === filtro.trimestre)
    : [...memoria().documentos];
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function crearDocumento(entrada: EntradaDocumento): Promise<Documento> {
  const trimestre = entrada.trimestre ?? trimestreDe(entrada.fechaEmision);

  const fila = await conPrisma(async (db) => {
    await asegurarSemilla(db);
    return db.documento.create({ data: { ...entrada, trimestre } });
  });
  if (fila !== null) {
    return filaADocumento(fila as unknown as FilaDocumento);
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
