// Conciliación bancaria: cruza los movimientos del extracto con los justificantes recibidos.
// Motor puro (sin red ni base de datos) y explicable: cada coincidencia lleva sus motivos.
// Solo considera cargos (gastos). Asignación 1 a 1: un movimiento cubre un justificante.

export interface Movimiento {
  id: string;
  /** Fecha de operación, YYYY-MM-DD. */
  fecha: string;
  /** Importe en céntimos. Negativo = cargo (gasto), positivo = abono. */
  importeCent: number;
  descripcion: string;
}

export interface DocumentoConciliable {
  id: string;
  fechaEmision: string | null;
  totalCent: number;
  emisorNombre: string | null;
  numeroFactura: string | null;
}

export interface Par {
  movimientoId: string;
  documentoId: string;
  /** 0–1. ≥ 0,8 = confianza alta; ≥ 0,6 = sugerencia. */
  puntuacion: number;
  confianza: "ALTA" | "MEDIA";
  motivos: string[];
}

export interface ResultadoConciliacion {
  pares: Par[];
  /** Cargos del banco sin justificante: lo que el cliente debe aportar. */
  movimientosSinDocumento: Movimiento[];
  /** Justificantes sin cargo bancario: pagados en efectivo, por otra cuenta o aún no cargados. */
  documentosSinMovimiento: DocumentoConciliable[];
}

export const UMBRAL_SUGERENCIA = 0.6;
export const UMBRAL_ALTA = 0.8;
const TOLERANCIA_CENT = 2;

// ------------------------------------------------------------------ Texto

const PALABRAS_VACIAS = new Set([
  "compra", "tarj", "tarjeta", "recibo", "transferencia", "trf", "pago", "cargo", "adeudo", "bizum", "factura", "fra",
  "sociedad", "limitada", "anonima", "para", "con", "del", "los", "las", "por", "sepa", "domiciliacion", "comision",
  "valencia", "madrid", "barcelona", "sevilla", "espana", "spain", "visa", "mastercard", "debito", "credito", "ref",
]);

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?\s?l\.?\s?u?|s\.?\s?a\.?\s?u?|s\.?\s?l\.?\s?p|s\.?\s?c)\b\.?/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function palabrasClave(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !PALABRAS_VACIAS.has(t));
}

/** Proporción de palabras del nombre más corto que aparecen en el otro (contención). 0–1. */
export function similitudNombre(a: string, b: string): number {
  const ta = new Set(palabrasClave(a));
  const tb = new Set(palabrasClave(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / Math.min(ta.size, tb.size);
}

// ------------------------------------------------------------------ Puntuación

function dias(desde: string, hasta: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(hasta) - d(desde)) / 86_400_000);
}

const eur = (c: number) => `${(Math.abs(c) / 100).toFixed(2).replace(".", ",")} €`;

/** Puntúa un par (movimiento, documento). Devuelve null si el importe no coincide. */
export function puntuar(m: Movimiento, d: DocumentoConciliable): { puntuacion: number; motivos: string[] } | null {
  if (m.importeCent >= 0) return null;
  const diff = Math.abs(Math.abs(m.importeCent) - d.totalCent);
  if (diff > TOLERANCIA_CENT) return null;

  let p = 0.55;
  const motivos: string[] = [diff === 0 ? `Importe exacto (${eur(d.totalCent)})` : `Importe casi exacto (${eur(m.importeCent)} frente a ${eur(d.totalCent)})`];
  if (diff > 0) p -= 0.05;

  if (d.fechaEmision) {
    const delta = dias(d.fechaEmision, m.fecha); // >0: el cargo es posterior a la factura
    if (delta >= -2 && delta <= 3) {
      p += 0.25;
      motivos.push(delta === 0 ? "Misma fecha que el justificante" : `Cargo ${Math.abs(delta)} día(s) ${delta > 0 ? "después" : "antes"} del justificante`);
    } else if (delta > 3 && delta <= 35) {
      p += 0.15;
      motivos.push(`Cargo ${delta} días después de la factura (plazo habitual de pago)`);
    } else if (delta > 35 && delta <= 70) {
      p += 0.05;
      motivos.push(`Cargo ${delta} días después de la factura`);
    } else {
      p -= 0.2;
      motivos.push("Fechas muy distantes");
    }
  }

  if (d.emisorNombre) {
    const s = similitudNombre(m.descripcion, d.emisorNombre);
    if (s > 0) {
      p += Math.min(0.2, s * 0.2);
      motivos.push(`El concepto menciona al emisor (${Math.round(s * 100)} % de coincidencia)`);
    }
  }
  if (d.numeroFactura && d.numeroFactura.replace(/\W/g, "").length >= 4 && normalizar(m.descripcion).replace(/ /g, "").includes(normalizar(d.numeroFactura).replace(/ /g, ""))) {
    p += 0.15;
    motivos.push("El nº de factura aparece en el concepto");
  }
  return { puntuacion: Math.max(0, Math.min(1, Math.round(p * 100) / 100)), motivos };
}

// ------------------------------------------------------------------ Conciliación

export function conciliar(movimientos: Movimiento[], documentos: DocumentoConciliable[]): ResultadoConciliacion {
  const candidatos: Array<Par & { _m: number; _d: number }> = [];
  movimientos.forEach((m, mi) => {
    documentos.forEach((d, di) => {
      const r = puntuar(m, d);
      if (r && r.puntuacion >= UMBRAL_SUGERENCIA) {
        candidatos.push({
          movimientoId: m.id,
          documentoId: d.id,
          puntuacion: r.puntuacion,
          confianza: r.puntuacion >= UMBRAL_ALTA ? "ALTA" : "MEDIA",
          motivos: r.motivos,
          _m: mi,
          _d: di,
        });
      }
    });
  });

  // Asignación voraz por puntuación descendente; empates por orden estable (determinista).
  candidatos.sort((a, b) => b.puntuacion - a.puntuacion || a._m - b._m || a._d - b._d);
  const usadosM = new Set<number>();
  const usadosD = new Set<number>();
  const pares: Par[] = [];
  for (const c of candidatos) {
    if (usadosM.has(c._m) || usadosD.has(c._d)) continue;
    usadosM.add(c._m);
    usadosD.add(c._d);
    const { _m, _d, ...par } = c;
    void _m;
    void _d;
    pares.push(par);
  }

  return {
    pares,
    movimientosSinDocumento: movimientos.filter((m, i) => m.importeCent < 0 && !usadosM.has(i)),
    documentosSinMovimiento: documentos.filter((_, i) => !usadosD.has(i)),
  };
}
