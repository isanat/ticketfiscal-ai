// Lectura de extractos bancarios: CSV (formatos habituales de bancos españoles) y Norma 43 (AEB).
// Devuelve movimientos normalizados con un identificador estable para no duplicar al reimportar.
import { createHash } from "node:crypto";

export interface MovimientoLeido {
  /** Identificador estable: mismo extracto importado dos veces produce los mismos ids. */
  idExterno: string;
  fecha: string; // YYYY-MM-DD
  importeCent: number; // negativo = cargo
  descripcion: string;
}

export interface ResultadoLectura {
  movimientos: MovimientoLeido[];
  /** Líneas que no se pudieron interpretar (para avisar al usuario, nunca silenciar). */
  ignoradas: number;
}

const MAX_MOVIMIENTOS = 5000;

function idDe(fecha: string, cent: number, desc: string, ocurrencia: number): string {
  return createHash("sha1").update(`${fecha}|${cent}|${desc.trim().toLowerCase()}|${ocurrencia}`).digest("hex").slice(0, 24);
}

/** Asigna ids estables; dos movimientos idénticos el mismo día reciben ocurrencias distintas. */
export function asignarIdsEstables(items: Array<Omit<MovimientoLeido, "idExterno">>): MovimientoLeido[] {
  const vistos = new Map<string, number>();
  return items.map((m) => {
    const clave = `${m.fecha}|${m.importeCent}|${m.descripcion}`;
    const n = (vistos.get(clave) ?? 0) + 1;
    vistos.set(clave, n);
    return { ...m, idExterno: idDe(m.fecha, m.importeCent, m.descripcion, n) };
  });
}

// ------------------------------------------------------------------ CSV

export function parseImporte(texto: string): number | null {
  let t = texto.trim().replace(/\s|€|EUR/gi, "");
  if (!t) return null;
  let negativo = false;
  if (t.startsWith("(") && t.endsWith(")")) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith("-")) {
    negativo = true;
    t = t.slice(1);
  } else if (t.startsWith("+")) t = t.slice(1);
  if (t.endsWith("-")) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(t)) return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  let normal: string;
  if (coma > -1 && punto > -1) normal = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (coma > -1) normal = t.replace(/\./g, "").replace(",", ".");
  else if (punto > -1 && t.length - punto - 1 === 3 && t.indexOf(".") === punto && t.length > 4) normal = t.replace(".", ""); // 1.234 → miles
  else normal = t;
  const v = Math.round(parseFloat(normal) * 100);
  return Number.isFinite(v) ? (negativo ? -v : v) : null;
}

export function parseFecha(texto: string): string | null {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(t);
  if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

function valida(a: number, mes: number, d: number): string | null {
  const f = new Date(Date.UTC(a, mes - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dividir(linea: string, sep: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else comillas = !comillas;
    } else if (c === sep && !comillas) {
      celdas.push(actual);
      actual = "";
    } else actual += c;
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

/** Norma 43 empieza por un registro «11» (cabecera de cuenta) de 80 posiciones numéricas; todo lo demás se trata como CSV. */
export function detectarFormatoExtracto(contenido: string): "csv" | "n43" {
  const primera = contenido.replace(/^\uFEFF/, "").split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return /^11\d{18}/.test(primera) ? "n43" : "csv";
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ALIAS = {
  fecha: ["fecha operacion", "fecha de operacion", "f. operacion", "fecha", "f.operacion", "fecha contable", "date"],
  concepto: ["concepto", "descripcion", "detalle", "movimiento", "concepto complementario", "description"],
  importe: ["importe", "cantidad", "importe (eur)", "importe eur", "amount"],
  debe: ["debe", "cargo", "cargos", "debit"],
  haber: ["haber", "abono", "abonos", "credit"],
};

export function parseCsvBanco(texto: string): ResultadoLectura {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  let idxCab = lineas.findIndex((l) => {
    const n = sinTildes(l);
    return n.includes("fecha") && (n.includes("importe") || n.includes("debe") || n.includes("cargo") || n.includes("amount"));
  });
  if (idxCab === -1) return { movimientos: [], ignoradas: lineas.length };
  const cab = lineas[idxCab];
  const sep = [";", "\t", ","].map((s) => [s, cab.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const cols = dividir(cab, sep).map(sinTildes);
  const col = (nombres: string[]) => cols.findIndex((c) => nombres.includes(c));
  // Si el título no coincide exactamente (p. ej. «Fecha de operación (dd/mm/aaaa)») se busca por contenido.
  const parcial = (...trozos: string[]) => cols.findIndex((c) => trozos.some((t) => c.includes(t)) && !c.includes("saldo"));
  const iFecha = col(ALIAS.fecha) > -1 ? col(ALIAS.fecha) : parcial("operacion") > -1 ? parcial("operacion") : parcial("fecha");
  const iDesc = col(ALIAS.concepto) > -1 ? col(ALIAS.concepto) : parcial("concepto", "descripcion");
  const iImp = col(ALIAS.importe) > -1 ? col(ALIAS.importe) : parcial("importe");
  const iDebe = col(ALIAS.debe) > -1 ? col(ALIAS.debe) : iImp > -1 ? -1 : parcial("debe", "cargo");
  const iHaber = col(ALIAS.haber) > -1 ? col(ALIAS.haber) : iImp > -1 ? -1 : parcial("haber", "abono");
  if (iFecha === -1 || (iImp === -1 && iDebe === -1 && iHaber === -1)) return { movimientos: [], ignoradas: lineas.length - 1 };

  const items: Array<Omit<MovimientoLeido, "idExterno">> = [];
  let ignoradas = 0;
  for (const l of lineas.slice(idxCab + 1)) {
    const c = dividir(l, sep);
    const fecha = parseFecha(c[iFecha] ?? "");
    let cent: number | null = null;
    if (iImp > -1) cent = parseImporte(c[iImp] ?? "");
    else {
      const debe = iDebe > -1 ? parseImporte(c[iDebe] ?? "") : null;
      const haber = iHaber > -1 ? parseImporte(c[iHaber] ?? "") : null;
      cent = debe ? -Math.abs(debe) : haber ? Math.abs(haber) : null;
    }
    if (!fecha || cent === null || cent === 0) {
      ignoradas++;
      continue;
    }
    items.push({ fecha, importeCent: cent, descripcion: (iDesc > -1 ? c[iDesc] : "").slice(0, 300) });
    if (items.length >= MAX_MOVIMIENTOS) break;
  }
  return { movimientos: asignarIdsEstables(items), ignoradas };
}

// ------------------------------------------------------------------ Norma 43 (AEB)

/**
 * Registros: 22 = movimiento; 23 = concepto complementario del movimiento anterior.
 * Posiciones (base 1) del 22: 11-16 fecha operación AAMMDD, 28 clave D/H (1 = debe, 2 = haber), 29-42 importe (2 decimales).
 */
export function parseNorma43(texto: string): ResultadoLectura {
  const items: Array<Omit<MovimientoLeido, "idExterno">> = [];
  let ignoradas = 0;
  for (const linea of texto.replace(/^﻿/, "").split(/\r?\n/)) {
    if (linea.length < 2) continue;
    const tipo = linea.slice(0, 2);
    if (tipo === "22") {
      const aa = linea.slice(10, 12);
      const mm = linea.slice(12, 14);
      const dd = linea.slice(14, 16);
      const fecha = valida(2000 + Number(aa), Number(mm), Number(dd));
      const importe = linea.slice(28, 42);
      const clave = linea[27];
      if (!fecha || !/^\d{14}$/.test(importe) || (clave !== "1" && clave !== "2")) {
        ignoradas++;
        continue;
      }
      const cent = Number(importe);
      const ref = linea.slice(52, 80).trim();
      items.push({ fecha, importeCent: clave === "1" ? -cent : cent, descripcion: ref });
    } else if (tipo === "23" && items.length > 0) {
      const extra = `${linea.slice(4, 42).trim()} ${linea.slice(42, 80).trim()}`.trim();
      const ult = items[items.length - 1];
      ult.descripcion = `${ult.descripcion} ${extra}`.trim().slice(0, 300);
    }
    if (items.length >= MAX_MOVIMIENTOS) break;
  }
  return { movimientos: asignarIdsEstables(items), ignoradas };
}
