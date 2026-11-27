// Conversión de una hoja de Excel (.xlsx) a CSV de texto. Se ejecuta en el navegador del usuario: al servidor
// solo llega texto plano y pasa por los mismos límites y lectores que un CSV.

export type Celda = string | number | boolean | Date | null | undefined;
export interface Hoja {
  sheet: string;
  data: Celda[][];
}

const MAX_FILAS = 20_000;
const MAX_TEXTO = 300;

const dos = (n: number) => String(n).padStart(2, "0");

/** Una celda como texto de CSV (separador «;»). Fechas dd/mm/aaaa; decimales con coma. */
export function celdaATexto(c: Celda): string {
  let t: string;
  if (c === null || c === undefined || typeof c === "boolean") t = "";
  else if (c instanceof Date) t = Number.isNaN(c.getTime()) ? "" : `${dos(c.getUTCDate())}/${dos(c.getUTCMonth() + 1)}/${c.getUTCFullYear()}`;
  else if (typeof c === "number") t = !Number.isFinite(c) ? "" : Number.isInteger(c) ? String(c) : c.toFixed(2).replace(".", ",");
  else t = c.replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function filasACsv(filas: Celda[][]): string {
  return filas
    .slice(0, MAX_FILAS)
    .map((f) => f.map(celdaATexto).join(";"))
    .filter((l) => l.replace(/;/g, "").trim() !== "")
    .join("\n");
}

const norm = (c: Celda) => String(c ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La hoja que parece un extracto: la primera con una cabecera «fecha» + «importe/cargo/debe»; si no, la más larga. */
export function elegirHoja(hojas: Hoja[]): Celda[][] | null {
  const conCabecera = hojas.find((h) =>
    h.data.slice(0, 60).some((f) => {
      const t = f.map(norm).join("|");
      return t.includes("fecha") && /importe|cargo|debe|amount/.test(t);
    })
  );
  if (conCabecera) return conCabecera.data;
  const mayor = [...hojas].sort((a, b) => b.data.length - a.data.length)[0];
  return mayor && mayor.data.length > 0 ? mayor.data : null;
}

/** .xlsx → texto CSV. La biblioteca se carga solo cuando hace falta. */
export async function xlsxACsv(contenido: ArrayBuffer): Promise<string> {
  const { default: leer } = await import("read-excel-file/universal");
  const hojas = (await leer(contenido)) as Hoja[];
  const filas = elegirHoja(hojas);
  if (!filas) throw new Error("El archivo Excel no tiene datos.");
  return filasACsv(filas);
}
