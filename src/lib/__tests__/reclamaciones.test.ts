import { describe, expect, it } from "vitest";
import { esNoTengo, esReclamable, parametrosPlantilla, textoReclamo, ventanaAbierta } from "../reclamaciones";

describe("esReclamable", () => {
  it("un cargo normal de importe suficiente sí", () => {
    expect(esReclamable({ importeCent: -5610, descripcion: "GASOLINERA LA VIA" })).toBe(true);
  });
  it("abonos, importes pequeños y cargos sin factura habitual no", () => {
    expect(esReclamable({ importeCent: 10000, descripcion: "Ingreso cliente" })).toBe(false);
    expect(esReclamable({ importeCent: -300, descripcion: "Parking" })).toBe(false);
    for (const d of ["COMISION MANTENIMIENTO", "Intereses deudores", "TGSS cuota autónomos", "AEAT modelo 303", "Liquidación tarjeta"]) {
      expect(esReclamable({ importeCent: -5000, descripcion: d })).toBe(false);
    }
  });
});

describe("ventanaAbierta (24 h de WhatsApp)", () => {
  const ahora = new Date("2026-11-27T12:00:00Z");
  it("abierta si el último mensaje del cliente es de hace menos de 24 h", () => {
    expect(ventanaAbierta(new Date("2026-11-27T01:00:00Z"), ahora)).toBe(true);
  });
  it("cerrada con más de 24 h o sin mensajes", () => {
    expect(ventanaAbierta(new Date("2026-11-26T11:59:00Z"), ahora)).toBe(false);
    expect(ventanaAbierta(null, ahora)).toBe(false);
  });
});

describe("texto de la reclamación", () => {
  const d = { gestoria: "Gestoría Alboraya", importeCent: -5610, fecha: new Date("2026-07-18T00:00:00Z"), descripcion: "  GASOLINERA   LA VIA  " };
  it("incluye importe, fecha en formato español y cómo responder si no hay justificante", () => {
    const t = textoReclamo(d);
    expect(t).toContain("56,10 €");
    expect(t).toContain("18/07/2026");
    expect(t).toContain("GASOLINERA LA VIA");
    expect(t).toContain("NO TENGO");
  });
  it("los parámetros de la plantilla van en orden gestoría, importe, fecha, concepto", () => {
    expect(parametrosPlantilla(d)).toEqual(["Gestoría Alboraya", "56,10 €", "18/07/2026", "GASOLINERA LA VIA"]);
  });
  it("recorta el concepto largo", () => {
    expect(parametrosPlantilla({ ...d, descripcion: "x".repeat(200) })[3]).toHaveLength(40);
  });
});

describe("esNoTengo", () => {
  it("reconoce las respuestas habituales", () => {
    for (const t of ["NO TENGO", "no tengo", " No lo tengo, perdón", "no tengo ticket"]) expect(esNoTengo(t)).toBe(true);
  });
  it("no confunde otros mensajes", () => {
    for (const t of ["tengo el ticket", "hola", "ahora no tengo tiempo, mañana lo envío"]) expect(esNoTengo(t)).toBe(false);
  });
});
