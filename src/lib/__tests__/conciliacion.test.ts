import { describe, expect, it } from "vitest";
import { conciliar, normalizar, palabrasClave, puntuar, similitudNombre, type DocumentoConciliable, type Movimiento } from "@/lib/conciliacion";
import { parseCsvBanco, parseFecha, parseImporte, parseNorma43 } from "@/lib/extracto";

const mov = (id: string, fecha: string, euros: number, descripcion: string): Movimiento => ({ id, fecha, importeCent: Math.round(euros * 100), descripcion });
const doc = (id: string, fecha: string | null, euros: number, emisor: string | null, numero: string | null = null): DocumentoConciliable => ({
  id, fechaEmision: fecha, totalCent: Math.round(euros * 100), emisorNombre: emisor, numeroFactura: numero,
});

describe("texto", () => {
  it("normaliza acentos, formas societarias y signos", () => {
    expect(normalizar("Distribuciones Ferrallado, S.L.")).toBe("distribuciones ferrallado");
    expect(normalizar("Eléctricas del Sur, S.A.")).toBe("electricas del sur");
  });
  it("descarta palabras genéricas de movimientos bancarios", () => {
    expect(palabrasClave("COMPRA TARJ. 4512 REPSOL VALENCIA")).toEqual(["repsol"]);
  });
  it("la similitud mide contención del nombre más corto", () => {
    expect(similitudNombre("TRANSFERENCIA A DISTRIBUCIONES FERRALLADO SL", "Distribuciones Ferrallado, S.L.")).toBe(1);
    expect(similitudNombre("RECIBO ENDESA ENERGIA", "Distribuciones Ferrallado, S.L.")).toBe(0);
  });
});

describe("puntuación", () => {
  it("importe distinto no puntúa", () => {
    expect(puntuar(mov("m", "2026-03-14", -120, "x"), doc("d", "2026-03-14", 121, null))).toBeNull();
  });
  it("un abono no se concilia con un gasto", () => {
    expect(puntuar(mov("m", "2026-03-14", 121, "x"), doc("d", "2026-03-14", 121, null))).toBeNull();
  });
  it("importe + fecha + nombre + nº de factura da confianza máxima y explica los motivos", () => {
    const r = puntuar(mov("m", "2026-03-15", -121, "TRF DISTRIBUCIONES FERRALLADO FRA 2025/0457"), doc("d", "2026-03-14", 121, "Distribuciones Ferrallado, S.L.", "2025/0457"))!;
    expect(r.puntuacion).toBe(1);
    expect(r.motivos.join(" ")).toMatch(/Importe exacto/);
    expect(r.motivos.join(" ")).toMatch(/nº de factura/);
  });
  it("fechas muy distantes penalizan por debajo del umbral", () => {
    const r = puntuar(mov("m", "2026-09-01", -121, "x"), doc("d", "2026-03-14", 121, null))!;
    expect(r.puntuacion).toBeLessThan(0.6);
  });
});

describe("conciliar", () => {
  it("empareja cada cargo con su justificante y lista lo que falta a cada lado", () => {
    const movs = [
      mov("m1", "2026-03-15", -121, "TRANSFERENCIA DISTRIBUCIONES FERRALLADO"),
      mov("m2", "2026-03-18", -56.1, "COMPRA TARJ REPSOL"),
      mov("m3", "2026-03-20", -300, "CARGO SIN JUSTIFICANTE"),
      mov("m4", "2026-03-21", 1000, "INGRESO CLIENTE"),
    ];
    const docs = [
      doc("d1", "2026-03-14", 121, "Distribuciones Ferrallado, S.L."),
      doc("d2", "2026-03-18", 56.1, "Estación de Servicio REPSOL"),
      doc("d3", "2026-03-10", 24, "Bar El Cruce"),
    ];
    const r = conciliar(movs, docs);
    expect(r.pares.map((p) => `${p.movimientoId}-${p.documentoId}`).sort()).toEqual(["m1-d1", "m2-d2"]);
    expect(r.movimientosSinDocumento.map((m) => m.id)).toEqual(["m3"]); // el abono no cuenta
    expect(r.documentosSinMovimiento.map((d) => d.id)).toEqual(["d3"]);
  });

  it("con dos justificantes del mismo importe elige por fecha y nombre, sin repetir", () => {
    const movs = [mov("m1", "2026-04-02", -100, "TRF PROVEEDOR UNO"), mov("m2", "2026-05-03", -100, "TRF PROVEEDOR DOS")];
    const docs = [doc("dA", "2026-05-02", 100, "Proveedor Dos"), doc("dB", "2026-04-01", 100, "Proveedor Uno")];
    const r = conciliar(movs, docs);
    expect(r.pares.find((p) => p.movimientoId === "m1")?.documentoId).toBe("dB");
    expect(r.pares.find((p) => p.movimientoId === "m2")?.documentoId).toBe("dA");
    expect(new Set(r.pares.map((p) => p.documentoId)).size).toBe(2);
  });

  it("un solo movimiento no cubre dos justificantes iguales", () => {
    const r = conciliar([mov("m1", "2026-04-02", -50, "x")], [doc("d1", "2026-04-02", 50, null), doc("d2", "2026-04-02", 50, null)]);
    expect(r.pares).toHaveLength(1);
    expect(r.documentosSinMovimiento).toHaveLength(1);
  });

  it("es determinista", () => {
    const movs = [mov("m1", "2026-04-02", -50, "x"), mov("m2", "2026-04-02", -50, "x")];
    const docs = [doc("d1", "2026-04-02", 50, null), doc("d2", "2026-04-02", 50, null)];
    expect(conciliar(movs, docs)).toEqual(conciliar(movs, docs));
  });
});

describe("lectura de extractos", () => {
  it("interpreta importes españoles y con signo", () => {
    expect(parseImporte("1.234,56")).toBe(123456);
    expect(parseImporte("-121,00")).toBe(-12100);
    expect(parseImporte("(56,10)")).toBe(-5610);
    expect(parseImporte("12.50")).toBe(1250);
    expect(parseImporte("1,234.56")).toBe(123456);
    expect(parseImporte("abc")).toBeNull();
  });
  it("interpreta fechas dd/mm/aaaa y valida el calendario", () => {
    expect(parseFecha("14/03/2026")).toBe("2026-03-14");
    expect(parseFecha("2026-03-14")).toBe("2026-03-14");
    expect(parseFecha("31/02/2026")).toBeNull();
  });
  it("lee un CSV con punto y coma, cabecera tras líneas de título y columna única de importe", () => {
    const csv = ["Extracto de cuenta", "Fecha operación;Concepto;Importe;Saldo", '14/03/2026;"TRF FERRALLADO, S.L.";-121,00;1.000,00', "15/03/2026;INGRESO;500,00;1.500,00", "xx;roto;1;1"].join("\n");
    const r = parseCsvBanco(csv);
    expect(r.movimientos).toHaveLength(2);
    expect(r.movimientos[0]).toMatchObject({ fecha: "2026-03-14", importeCent: -12100, descripcion: "TRF FERRALLADO, S.L." });
    expect(r.ignoradas).toBe(1);
  });
  it("lee columnas Debe/Haber separadas", () => {
    const r = parseCsvBanco("Fecha;Concepto;Debe;Haber\n01/04/2026;Recibo luz;56,10;\n02/04/2026;Cobro;;300,00");
    expect(r.movimientos.map((m) => m.importeCent)).toEqual([-5610, 30000]);
  });
  it("los ids son estables entre importaciones y distinguen movimientos idénticos", () => {
    const csv = "Fecha;Concepto;Importe\n01/04/2026;CAFE;-2,00\n01/04/2026;CAFE;-2,00";
    const a = parseCsvBanco(csv).movimientos;
    const b = parseCsvBanco(csv).movimientos;
    expect(a.map((m) => m.idExterno)).toEqual(b.map((m) => m.idExterno));
    expect(new Set(a.map((m) => m.idExterno)).size).toBe(2);
  });
  it("devuelve vacío y cuenta las líneas si no hay cabecera reconocible", () => {
    const r = parseCsvBanco("hola\nmundo");
    expect(r.movimientos).toEqual([]);
    expect(r.ignoradas).toBe(2);
  });
  it("lee Norma 43: movimientos, signo por clave D/H y concepto complementario (registro 23)", () => {
    const l22 = (aamm: string, dd: string, clave: string, cent: number, ref: string) =>
      "22" + "    " + "0001" + aamm + dd + aamm + dd + "02" + "001" + clave + String(cent).padStart(14, "0") + "0000000001" + ref.padEnd(12) + "".padEnd(16);
    const l23 = (c1: string) => "2301" + c1.padEnd(38) + "".padEnd(38);
    const n43 = [l22("2603", "14", "1", 12100, "REF1"), l23("DISTRIBUCIONES FERRALLADO SL"), l22("2603", "15", "2", 50000, "REF2")].join("\n");
    const r = parseNorma43(n43);
    expect(r.movimientos).toHaveLength(2);
    expect(r.movimientos[0]).toMatchObject({ fecha: "2026-03-14", importeCent: -12100 });
    expect(r.movimientos[0].descripcion).toContain("DISTRIBUCIONES FERRALLADO SL");
    expect(r.movimientos[1]).toMatchObject({ fecha: "2026-03-15", importeCent: 50000 });
  });
});
