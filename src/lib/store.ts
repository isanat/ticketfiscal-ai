// TicketFiscal AI — Capa de acceso a datos con dos backends:
//  · SQLite + Prisma cuando existe DATABASE_URL (entorno local / servidor propio)
//  · Memoria con datos de demostración cuando no (p. ej. Vercel sin base de datos)
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

const globalMem = globalThis as unknown as { __ticketfiscalMemoria?: EstadoMemoria };

function memoria(): EstadoMemoria {
  globalMem.__ticketfiscalMemoria ??= {
    documentos: SEMILLA_DOCUMENTOS.map((d) => ({ ...d })),
  };
  return globalMem.__ticketfiscalMemoria;
}

// ------------------------------------------------------------------ Semilla SQLite

let sembrando: Promise<void> | null = null;

async function asegurarSemilla(): Promise<void> {
  if (!tieneSqlite()) return;
  if (sembrando) {
    await sembrando;
    return;
  }
  // Siembra el lote de demostración la primera vez que la base está vacía.
  // Se re-evalúa en cada llamada (tras un "borrar todo" se vuelve a sembrar).
  sembrando = (async () => {
    const db = getDb();
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
  return tieneSqlite() ? "sqlite" : "memoria";
}

export async function listarDocumentos(filtro?: {
  trimestre?: string | null;
}): Promise<Documento[]> {
  if (!tieneSqlite()) {
    const docs = filtro?.trimestre
      ? memoria().documentos.filter((d) => d.trimestre === filtro.trimestre)
      : [...memoria().documentos];
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await asegurarSemilla();
  const db = getDb();
  const filas = await db.documento.findMany({
    where: filtro?.trimestre ? { trimestre: filtro.trimestre } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return (filas as unknown as FilaDocumento[]).map(filaADocumento);
}

export async function crearDocumento(entrada: EntradaDocumento): Promise<Documento> {
  const trimestre = entrada.trimestre ?? trimestreDe(entrada.fechaEmision);
  if (!tieneSqlite()) {
    const doc: Documento = {
      ...entrada,
      trimestre,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    memoria().documentos.unshift(doc);
    return doc;
  }
  await asegurarSemilla();
  const db = getDb();
  const fila = await db.documento.create({
    data: { ...entrada, trimestre },
  });
  return filaADocumento(fila as unknown as FilaDocumento);
}

export async function eliminarDocumento(id?: string | null): Promise<void> {
  if (!tieneSqlite()) {
    const m = memoria();
    m.documentos = id ? m.documentos.filter((d) => d.id !== id) : [];
    return;
  }
  await asegurarSemilla();
  const db = getDb();
  if (id) {
    await db.documento.delete({ where: { id } });
  } else {
    await db.documento.deleteMany({});
  }
}
