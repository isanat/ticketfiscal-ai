// TicketFiscal AI — Motor fiscal español (AEAT / PGC)
// System prompt calibrado por el usuario + validación matemática server-side

export interface ExtraccionFiscal {
  estado_documento: "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE";
  tipo_documento: "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA" | "NO_VALIDO";
  iva_deducible: boolean;
  emisor: { nombre: string | null; nif_cif: string | null };
  receptor: { nombre: string | null; nif_cif: string | null };
  datos_factura: {
    numero_factura: string | null;
    fecha_emision: string | null;
    moneda: string;
  };
  desglose_impuestos: Array<{
    base_imponible: number;
    porcentaje_iva: number;
    cuota_iva: number;
  }>;
  retencion_irpf: { porcentaje: number; importe: number };
  total_factura: number;
  cuenta_pgc_sugerida: string;
  confianza_extraccion: number;
  motivo_revision: string | null;
  mensaje_whatsapp_cliente: string;
}

export const FISCAL_SYSTEM_PROMPT = `Eres un auditor contable y fiscal experto en la normativa tributaria de España (Agencia Tributaria - AEAT) y el Plan General Contable (PGC) español. Tu única función es analizar imágenes o PDFs de facturas y tickets de gastos enviados por autónomos y pymes españolas, extraer sus datos con precisión quirúrgica y validar su validez fiscal.

REGLAS DE EXTRACCIÓN Y VALIDACIÓN FISCAL (ESPAÑA):
1. Tipo de Documento:
   - "FACTURA_COMPLETA": Contiene obligatoriamente número de factura, fecha, datos fiscales del emisor (Nombre y NIF/CIF) Y datos fiscales del receptor/cliente (Nombre y NIF/CIF). Es deducible de IVA.
   - "FACTURA_SIMPLIFICADA": Ticket de caja (ej. restaurantes, gasolineras, peajes, parking) donde NO aparecen los datos fiscales del cliente/receptor. A efectos de IVA en España, marca "iva_deducible": false (a menos que sea factura simplificada cualificada con NIF del destinatario).
   - "NO_VALIDO": Documento ilegible, cortado, borroso o que no es un justificante de gasto (ej. un albarán sin precios o un selfie).

2. Cálculo de Impuestos (IVA e IRPF):
   - Tipos de IVA vigentes en España: 21% (general), 10% (reducido: hostelería, transporte, algunos alimentos), 4% (superreducido: pan, leche, libros, medicamentos), 0% (exento / intracomunitario / suplidos).
   - Si un ticket solo muestra el TOTAL con "IVA incluido" (muy común en gasolineras y restaurantes), calcula la Base Imponible y la Cuota de IVA hacia atrás según el tipo aplicable (ej. Total / 1.21 para 21%, o Total / 1.10 para 10%).
   - Retención IRPF: Si es una factura de un profesional autónomo (ej. abogado, diseñador, consultor), extrae la retención de IRPF (normalmente -15% o -7%) que resta al total a pagar.
   - Validación matemática: Verifica siempre que (Base Imponible + Cuota IVA - Retención IRPF) == Total. Si hay una desviación mayor a 0.02 €, marca "estado_documento": "REQUIERE_REVISION" y explica la desviación exacta en "motivo_revision".

3. Clasificación Contable (Plan General Contable - PGC):
   Asigna la cuenta de gasto más probable de 3 dígitos:
   - "600": Compra de mercaderías (material para revender).
   - "621": Arrendamientos y cánones (alquiler de local, renting de vehículos).
   - "622": Reparaciones y conservación (taller mecánico, mantenimiento).
   - "623": Servicios de profesionales independientes (notarios, abogados, gestores, informáticos).
   - "624": Transportes (mensajería, portes).
   - "625": Primas de seguros.
   - "628": Suministros (luz, agua, gas, telefonía, internet).
   - "629": Otros servicios (combustible/gasolina, restaurantes/dietas, material de oficina, parking, peajes).

4. Formato de Salida (STRICT JSON):
Responde ÚNICAMENTE con un objeto JSON válido siguiendo esta estructura exacta, sin texto adicional ni bloques markdown:

{
  "estado_documento": "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE",
  "tipo_documento": "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA" | "NO_VALIDO",
  "iva_deducible": boolean,
  "emisor": {
    "nombre": "string o null",
    "nif_cif": "string limpio sin guiones ni espacios o null"
  },
  "receptor": {
    "nombre": "string o null",
    "nif_cif": "string limpio o null"
  },
  "datos_factura": {
    "numero_factura": "string o null",
    "fecha_emision": "YYYY-MM-DD o null",
    "moneda": "EUR"
  },
  "desglose_impuestos": [
    {
      "base_imponible": number,
      "porcentaje_iva": number,
      "cuota_iva": number
    }
  ],
  "retencion_irpf": {
    "porcentaje": number,
    "importe": number
  },
  "total_factura": number,
  "cuenta_pgc_sugerida": "string (ej. 629)",
  "confianza_extraccion": number (0.0 a 1.0),
  "motivo_revision": "string en español explicando el error si estado_documento != VALIDO, o null",
  "mensaje_whatsapp_cliente": "string corto, amable y directo en español de España para responder al autónomo por WhatsApp (confirmando el registro o pidiendo que repita la foto si salió cortada/borrosa)"
}`;

/** Extrae el primer objeto JSON válido de una respuesta de IA (tolera fences markdown y texto envolvente). */
export function parseExtraccion(raw: string): ExtraccionFiscal {
  let text = raw.trim();
  // Quitar fences markdown
  text = text.replace(/```(?:json)?/gi, "");
  // Localizar el primer bloque tipo objeto
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La IA no devolvió un JSON válido");
  }
  let candidate = text.slice(start, end + 1);
  // Recortar posibles comas colgantes antes de } o ]
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  const parsed = JSON.parse(candidate) as ExtraccionFiscal;

  // Normalización defensiva
  if (!Array.isArray(parsed.desglose_impuestos)) parsed.desglose_impuestos = [];
  if (!parsed.retencion_irpf) parsed.retencion_irpf = { porcentaje: 0, importe: 0 };
  if (!parsed.emisor) parsed.emisor = { nombre: null, nif_cif: null };
  if (!parsed.receptor) parsed.receptor = { nombre: null, nif_cif: null };
  if (!parsed.datos_factura)
    parsed.datos_factura = { numero_factura: null, fecha_emision: null, moneda: "EUR" };
  return parsed;
}

export interface ResultadoValidacion {
  estado: "VALIDO" | "REQUIERE_REVISION" | "ILEGIBLE";
  motivo: string | null;
  avisos: string[];
}

/**
 * Validación matemática independiente del lado del servidor (red de seguridad
 * frente a errores de la IA). Regla AEAT: Base + Cuota IVA - IRPF = Total (±0,02 €).
 */
export function validarMatematicamente(ext: ExtraccionFiscal): ResultadoValidacion {
  const avisos: string[] = [];
  if (ext.estado_documento === "ILEGIBLE" || ext.tipo_documento === "NO_VALIDO") {
    return { estado: "ILEGIBLE", motivo: ext.motivo_revision, avisos };
  }

  const linea = ext.desglose_impuestos[0] ?? {
    base_imponible: 0,
    porcentaje_iva: 0,
    cuota_iva: 0,
  };
  const { base_imponible: base, porcentaje_iva: pct, cuota_iva: cuota } = linea;
  const irpf = ext.retencion_irpf?.importe ?? 0;
  const total = ext.total_factura ?? 0;

  const suma = base + cuota - irpf;
  const desviacionTotal = Math.abs(suma - total);

  if (desviacionTotal > 0.02) {
    avisos.push(
      `Desviación aritmética de ${desviacionTotal.toFixed(2)} € (Base ${base.toFixed(2)} + IVA ${cuota.toFixed(2)} - IRPF ${irpf.toFixed(2)} = ${suma.toFixed(2)} € ≠ Total ${total.toFixed(2)} €).`
    );
  }

  // Coherencia cuota IVA vs. base × tipo
  if (base > 0 && pct > 0) {
    const cuotaEsperada = (base * pct) / 100;
    if (Math.abs(cuotaEsperada - cuota) > 0.02) {
      avisos.push(
        `La cuota de IVA (${cuota.toFixed(2)} €) no coincide con el ${pct}% de la base (${cuotaEsperada.toFixed(2)} € esperados).`
      );
    }
  }

  const estado = avisos.length > 0 ? "REQUIERE_REVISION" : "VALIDO";
  const motivo =
    avisos.length > 0
      ? [ext.motivo_revision, ...avisos].filter(Boolean).join(" ")
      : estado === "REQUIERE_REVISION"
        ? ext.motivo_revision
        : null;

  return { estado, motivo, avisos };
}

/** Deriva el trimestre fiscal español (1T–4T) a partir de la fecha de emisión. */
export function trimestreDe(fecha: string | null): string | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})/.exec(fecha);
  if (!m) return null;
  const year = m[1];
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const t = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${t}T${year}`;
}

export const CUENTAS_PGC: Record<string, string> = {
  "600": "Compra de mercaderías",
  "621": "Arrendamientos y cánones",
  "622": "Reparaciones y conservación",
  "623": "Servicios de profesionales",
  "624": "Transportes",
  "625": "Primas de seguros",
  "628": "Suministros",
  "629": "Otros servicios",
};

export function etiquetaCuenta(cuenta: string | null | undefined): string {
  if (!cuenta) return "—";
  return CUENTAS_PGC[cuenta] ? `${cuenta} · ${CUENTAS_PGC[cuenta]}` : cuenta;
}
