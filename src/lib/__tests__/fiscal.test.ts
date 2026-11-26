import { describe, expect, it } from "vitest";
import {
  ExtraccionInvalida,
  fechaIsoValida,
  parseExtraccion,
  trimestreDe,
  validarExtraccion,
  type Extraccion,
} from "@/lib/fiscal";

const EMPRESA_NIF = "12345678Z";
const PROVEEDOR_CIF = "B46283917"; // CIF con dígito de control correcto (muestra del seed)
const HOY = new Date("2026-11-26T12:00:00Z");

/** Extracción base válida: factura completa, IVA 21 %, cuadra. */
function base(cambios: Partial<Extraccion> = {}): Extraccion {
  return {
    estado_documento: "VALIDO",
    tipo_documento: "FACTURA_COMPLETA",
    iva_deducible: true,
    emisor: { nombre: "Proveedor SL", nif_cif: PROVEEDOR_CIF },
    receptor: { nombre: "Cliente", nif_cif: EMPRESA_NIF },
    datos_factura: { numero_factura: "2026/1", fecha_emision: "2026-10-10" },
    desglose_impuestos: [{ base_imponible: 100, porcentaje_iva: 21, cuota_iva: 21 }],
    retencion_irpf: { porcentaje: 0, importe: 0 },
    total_factura: 121,
    cuenta_pgc_sugerida: "600",
    confianza_extraccion: 0.95,
    motivo_revision: null,
    ...cambios,
  } as Extraccion;
}

const val = (e: Extraccion) => validarExtraccion(e, { nifEmpresa: EMPRESA_NIF, hoy: HOY });

describe("validarExtraccion — casos válidos", () => {
  it("factura completa que cuadra es VALIDO y deducible", () => {
    const r = val(base());
    expect(r.estado).toBe("VALIDO");
    expect(r.motivos).toEqual([]);
    expect(r.ivaDeducible).toBe(true);
    expect(r.totalFactura).toBe(121);
    expect(r.fechaEmision).toBe("2026-10-10");
  });

  it("varias líneas de IVA (10 % y 21 %) se conservan y el tipo efectivo se calcula", () => {
    const r = val(
      base({
        desglose_impuestos: [
          { base_imponible: 50, porcentaje_iva: 10, cuota_iva: 5 },
          { base_imponible: 100, porcentaje_iva: 21, cuota_iva: 21 },
        ],
        total_factura: 176,
      })
    );
    expect(r.estado).toBe("VALIDO");
    expect(r.lineas).toHaveLength(2);
    expect(r.baseImponible).toBe(150);
    expect(r.cuotaIva).toBe(26);
    expect(r.porcentajeIva).toBe(17.33);
  });

  it("IRPF correcto: base + IVA − retención = total", () => {
    const r = val(
      base({
        retencion_irpf: { porcentaje: 15, importe: 15 },
        total_factura: 106,
      })
    );
    expect(r.estado).toBe("VALIDO");
    expect(r.irpfImporte).toBe(15);
  });

  it("tolera un céntimo de redondeo en la cuota de línea", () => {
    const r = val(base({ desglose_impuestos: [{ base_imponible: 33.33, porcentaje_iva: 21, cuota_iva: 7.0 }], total_factura: 40.33 }));
    expect(r.estado).toBe("VALIDO");
  });
});

describe("validarExtraccion — reglas AEAT", () => {
  it("descuadre aritmético del total → REQUIERE_REVISION", () => {
    const r = val(base({ total_factura: 122 }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/Desviación aritmética/);
  });

  it("cuota de IVA que no corresponde al tipo → REQUIERE_REVISION", () => {
    const r = val(base({ desglose_impuestos: [{ base_imponible: 100, porcentaje_iva: 21, cuota_iva: 15 }], total_factura: 115 }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/no coincide con la base/);
  });

  it("tipo de IVA no español (15 %) → REQUIERE_REVISION", () => {
    const r = val(base({ desglose_impuestos: [{ base_imponible: 100, porcentaje_iva: 15, cuota_iva: 15 }], total_factura: 115 }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/no reconocido/);
  });

  it("CIF del emisor con dígito de control erróneo → REQUIERE_REVISION", () => {
    const r = val(base({ emisor: { nombre: "X", nif_cif: "A28547960" } }));
    expect(r.nifEmisorValido).toBe(false);
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.ivaDeducible).toBe(false);
  });

  it("destinatario distinto de la empresa → no deducible y revisión", () => {
    const r = val(base({ receptor: { nombre: "Otro", nif_cif: "00000000T" } }));
    expect(r.ivaDeducible).toBe(false);
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/no coincide con la empresa/);
  });

  it("factura completa sin número → revisión", () => {
    const r = val(base({ datos_factura: { numero_factura: null, fecha_emision: "2026-10-10" } }));
    expect(r.estado).toBe("REQUIERE_REVISION");
  });

  it("factura simplificada: IVA no deducible con aviso, sin revisión si cuadra", () => {
    const r = val(base({ tipo_documento: "FACTURA_SIMPLIFICADA", receptor: { nombre: null, nif_cif: null } }));
    expect(r.estado).toBe("VALIDO");
    expect(r.ivaDeducible).toBe(false);
    expect(r.avisos.join(" ")).toMatch(/art\. 97 LIVA/);
  });

  it("fecha imposible (31 de febrero) → revisión", () => {
    const r = val(base({ datos_factura: { numero_factura: "1", fecha_emision: "2026-02-31" } }));
    expect(r.fechaEmision).toBeNull();
    expect(r.estado).toBe("REQUIERE_REVISION");
  });

  it("fecha futura → revisión", () => {
    const r = val(base({ datos_factura: { numero_factura: "1", fecha_emision: "2027-01-10" } }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/posterior a hoy/);
  });

  it("retención IRPF que no corresponde al porcentaje → revisión", () => {
    const r = val(base({ retencion_irpf: { porcentaje: 15, importe: 10 }, total_factura: 111 }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos.join(" ")).toMatch(/retención IRPF/);
  });

  it("confianza baja → revisión", () => {
    const r = val(base({ confianza_extraccion: 0.3 }));
    expect(r.estado).toBe("REQUIERE_REVISION");
  });
});

describe("validarExtraccion — la IA no puede rebajar el estado", () => {
  it("si la IA pide revisión sin motivos propios, el documento queda en revisión", () => {
    const r = val(base({ estado_documento: "REQUIERE_REVISION", motivo_revision: "Sello ilegible" }));
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(r.motivos).toEqual(["Sello ilegible"]);
  });

  it("si la IA dice ILEGIBLE, el documento es ILEGIBLE aunque los números cuadren", () => {
    const r = val(base({ estado_documento: "ILEGIBLE", tipo_documento: "NO_VALIDO" }));
    expect(r.estado).toBe("ILEGIBLE");
    expect(r.totalFactura).toBe(0);
  });

  it("el mensaje al cliente lo genera el servidor, no el texto del modelo", () => {
    const r = val(base({ total_factura: 122 }));
    expect(r.mensajeWhatsapp).toMatch(/necesita revisión/);
    expect(r.mensajeWhatsapp).not.toMatch(/Registrado/);
  });
});

describe("parseExtraccion", () => {
  it("extrae el JSON aunque venga envuelto en fences y texto", () => {
    const raw = 'Aquí tiene:\n```json\n{"estado_documento":"VALIDO","tipo_documento":"FACTURA_COMPLETA","total_factura":"121,00","desglose_impuestos":[{"base_imponible":"100","porcentaje_iva":21,"cuota_iva":21}]}\n```';
    const e = parseExtraccion(raw);
    expect(e.total_factura).toBe(121);
    expect(e.desglose_impuestos[0].base_imponible).toBe(100);
  });

  it("valores desconocidos se degradan a revisión, no a válido", () => {
    const e = parseExtraccion('{"estado_documento":"QUIZA","tipo_documento":"OTRO","total_factura":1}');
    expect(e.estado_documento).toBe("REQUIERE_REVISION");
    expect(e.tipo_documento).toBe("NO_VALIDO");
  });

  it("rechaza respuestas sin JSON o malformadas", () => {
    expect(() => parseExtraccion("lo siento, no puedo")).toThrow(ExtraccionInvalida);
    expect(() => parseExtraccion('{"estado_documento": VALIDO}')).toThrow(ExtraccionInvalida);
  });
});

describe("fechas y trimestres", () => {
  it("valida fechas ISO reales", () => {
    expect(fechaIsoValida("2026-02-28")).toBe("2026-02-28");
    expect(fechaIsoValida("2024-02-29")).toBe("2024-02-29");
    expect(fechaIsoValida("2026-02-29")).toBeNull();
    expect(fechaIsoValida("10/10/2026")).toBeNull();
  });

  it("deriva el trimestre de la fecha de devengo", () => {
    expect(trimestreDe("2026-01-01")).toBe("1T2026");
    expect(trimestreDe("2026-06-30")).toBe("2T2026");
    expect(trimestreDe("2026-07-14")).toBe("3T2026");
    expect(trimestreDe("2026-12-31")).toBe("4T2026");
    expect(trimestreDe(null)).toBeNull();
  });
});

describe("mensajeWhatsapp: sin puntos duplicados", () => {
  it("no duplica el punto final del motivo", async () => {
    const { mensajeWhatsapp } = await import("../fiscal");
    const m = mensajeWhatsapp({ estado: "REQUIERE_REVISION", tipoDocumento: "FACTURA_SIMPLIFICADA", ivaDeducible: false, emisorNombre: null, numeroFactura: null, totalFactura: 1, motivos: ["Tipo de IVA del 18 % no reconocido (válidos: 0, 4, 10 y 21 %)."] });
    expect(m).toBe("Recibido, pero necesita revisión: Tipo de IVA del 18 % no reconocido (válidos: 0, 4, 10 y 21 %). Su gestoría lo revisará.");
  });
});
