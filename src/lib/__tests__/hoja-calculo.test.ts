import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { celdaATexto, elegirHoja, filasACsv, xlsxACsv } from "../hoja-calculo";
import { parseCsvBanco } from "../extracto";

const fixture = (n: string) => {
  const b = readFileSync(path.join(__dirname, "fixtures", n));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe("celdaATexto", () => {
  it("formatea fechas, decimales y escapa lo necesario", () => {
    expect(celdaATexto(new Date(Date.UTC(2026, 6, 15)))).toBe("15/07/2026");
    expect(celdaATexto(-56.1)).toBe("-56,10");
    expect(celdaATexto(1250)).toBe("1250");
    expect(celdaATexto('Bar "El Cruce"; Madrid')).toBe('"Bar ""El Cruce""; Madrid"');
    expect(celdaATexto(null)).toBe("");
    expect(celdaATexto(Number.NaN)).toBe("");
  });
});

describe("filasACsv / elegirHoja", () => {
  it("descarta filas vacías y limita el texto", () => {
    expect(filasACsv([["a", "b"], [null, null], ["c", "d"]])).toBe("a;b\nc;d");
  });
  it("elige la hoja con cabecera de extracto y, si no, la más larga", () => {
    const portada = { sheet: "Portada", data: [["Banco"], ["Resumen"]] };
    const mov = { sheet: "Mov", data: [["x"], ["Fecha", "Concepto", "Importe"], ["1", "a", "2"]] };
    expect(elegirHoja([portada, mov])).toBe(mov.data);
    expect(elegirHoja([portada, { sheet: "B", data: [["u"], ["v"], ["w"]] }])).toHaveLength(3);
    expect(elegirHoja([{ sheet: "vacía", data: [] }])).toBeNull();
  });
});

describe("xlsx real (generado con openpyxl)", () => {
  it("varias hojas, preámbulo y fechas reales: lee los 4 movimientos con importes y fechas correctos", async () => {
    const csv = await xlsxACsv(fixture("extracto-hojas.xlsx"));
    const r = parseCsvBanco(csv);
    expect(r.movimientos.map((m) => [m.fecha, m.importeCent])).toEqual([
      ["2026-07-15", -2400],
      ["2026-07-18", -5610],
      ["2026-08-02", 125000],
      ["2026-08-05", -123456],
    ]);
    expect(r.movimientos[0].descripcion).toBe("COMPRA TARJ BAR EL CRUCE");
  });
  it("columnas Cargo/Abono y fecha en texto", async () => {
    const r = parseCsvBanco(await xlsxACsv(fixture("extracto-cargo-abono.xlsx")));
    expect(r.movimientos.map((m) => [m.fecha, m.importeCent])).toEqual([["2026-03-05", -1240], ["2026-03-06", 10000]]);
  });
  it("un archivo que no es un .xlsx falla con error, no con datos inventados", async () => {
    await expect(xlsxACsv(new TextEncoder().encode("esto no es un xlsx").buffer as ArrayBuffer)).rejects.toThrow();
  });
});
