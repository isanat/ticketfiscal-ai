// Evaluación de extracción sobre las muestras de public/samples.
// Gabarito leído de las propias imágenes. Lo usan el script local y el endpoint temporal de evaluación.
import { extraerConVision, costeEstimadoUsd, type ParteEntrada, type UsoTokens } from "./vision";
import { FISCAL_SYSTEM_PROMPT, parseExtraccion, validarExtraccion } from "./fiscal";
import { config } from "./env";

export const NIF_EMPRESA_EVAL = "12345678Z"; // empresa de la demo que recibe las facturas de estas muestras

export interface CasoEval {
  archivo: string;
  mime: string;
  esperado: {
    estado: "VALIDO" | "REQUIERE_REVISION";
    tipo: "FACTURA_COMPLETA" | "FACTURA_SIMPLIFICADA";
    emisorNif: string;
    numero: string;
    fecha: string;
    base: number;
    pct: number;
    cuota: number;
    total: number;
    ivaDeducible: boolean;
  };
}

export const CASOS_EVAL: CasoEval[] = [
  {
    archivo: "factura-completa.png",
    mime: "image/png",
    esperado: { estado: "VALIDO", tipo: "FACTURA_COMPLETA", emisorNif: "B46283917", numero: "2025/0457", fecha: "2025-03-14", base: 100, pct: 21, cuota: 21, total: 121, ivaDeducible: true },
  },
  {
    archivo: "ticket-restaurante.png",
    mime: "image/png",
    esperado: { estado: "VALIDO", tipo: "FACTURA_SIMPLIFICADA", emisorNif: "B46912382", numero: "00342", fecha: "2025-03-15", base: 21.82, pct: 10, cuota: 2.18, total: 24, ivaDeducible: false },
  },
  {
    // Caso trampa: CIF con dígito de control erróneo y cuota de IVA que no cuadra (19,05 en vez de 18,05).
    archivo: "factura-error.png",
    mime: "image/png",
    esperado: { estado: "REQUIERE_REVISION", tipo: "FACTURA_COMPLETA", emisorNif: "A28547963", numero: "2025-038912", fecha: "2025-03-31", base: 85.95, pct: 21, cuota: 19.05, total: 105, ivaDeducible: false },
  },
  {
    archivo: "ticket-gasolinera.png",
    mime: "image/png",
    esperado: { estado: "VALIDO", tipo: "FACTURA_SIMPLIFICADA", emisorNif: "B46539128", numero: "07891", fecha: "2025-03-18", base: 46.36, pct: 21, cuota: 9.74, total: 56.1, ivaDeducible: false },
  },
];

const cerca = (a: number | null | undefined, b: number) => a !== null && a !== undefined && Math.abs(a - b) < 0.011;

export interface ResultadoEval {
  archivo: string;
  ms: number;
  error?: string;
  aciertos: Record<string, boolean>;
  valores: Record<string, unknown>;
  uso?: UsoTokens;
}

/** Evalúa un caso. `leer` devuelve los bytes del archivo de muestra. Nunca incluye claves en el resultado. */
export async function evaluarCaso(c: CasoEval, leer: (archivo: string) => Buffer): Promise<ResultadoEval> {
  const base64 = leer(c.archivo).toString("base64");
  const partes: ParteEntrada[] = [
    { tipo: "texto", texto: `Analiza este justificante de gasto de la empresa Taller Pérez e Hijos (NIF ${NIF_EMPRESA_EVAL}). Devuelve solo el JSON estricto.` },
    { tipo: "archivo", mime: c.mime, base64 },
  ];
  const inicio = Date.now();
  let uso: UsoTokens | undefined;
  try {
    const raw = await extraerConVision(FISCAL_SYSTEM_PROMPT, partes, { onUso: (u) => (uso = u) });
    const ms = Date.now() - inicio;
    const r = validarExtraccion(parseExtraccion(raw), { nifEmpresa: NIF_EMPRESA_EVAL });
    const e = c.esperado;
    const linea = r.lineas[0];
    return {
      archivo: c.archivo,
      ms,
      uso,
      aciertos: {
        estado: r.estado === e.estado,
        tipo: r.tipoDocumento === e.tipo,
        emisorNif: r.emisorNif === e.emisorNif,
        numero: r.numeroFactura === e.numero,
        fecha: r.fechaEmision === e.fecha,
        base: cerca(linea?.baseImponible, e.base),
        porcentaje: linea?.porcentajeIva === e.pct,
        cuota: cerca(linea?.cuotaIva, e.cuota),
        total: cerca(r.totalFactura, e.total),
        ivaDeducible: r.ivaDeducible === e.ivaDeducible,
      },
      valores: {
        estado: r.estado,
        tipo: r.tipoDocumento,
        emisorNif: r.emisorNif,
        numero: r.numeroFactura,
        fecha: r.fechaEmision,
        base: linea?.baseImponible,
        porcentaje: linea?.porcentajeIva,
        cuota: linea?.cuotaIva,
        total: r.totalFactura,
        ivaDeducible: r.ivaDeducible,
        motivos: r.motivos,
      },
    };
  } catch (err) {
    return {
      archivo: c.archivo,
      ms: Date.now() - inicio,
      error: err instanceof Error ? err.message : String(err),
      aciertos: {},
      valores: {},
      uso,
    };
  }
}

export interface InformeEval {
  proveedor: string | null;
  modelo?: string;
  resultados: ResultadoEval[];
  resumen: {
    aciertoPct: number;
    aciertos: number;
    campos: number;
    latenciaMediaMs: number;
    tokens: UsoTokens;
    costeUsd: number | null;
  };
}

/** Ejecuta todos los casos y resume. Usa tarifas de entorno si existen. */
export async function ejecutarEvaluacion(leer: (archivo: string) => Buffer): Promise<InformeEval> {
  const c = config();
  const resultados: ResultadoEval[] = [];
  for (const caso of CASOS_EVAL) resultados.push(await evaluarCaso(caso, leer));

  const campos = resultados.flatMap((r) => Object.values(r.aciertos));
  const aciertos = campos.filter(Boolean).length;
  const tokens = resultados.reduce(
    (acc, r) => ({ entrada: acc.entrada + (r.uso?.entrada ?? 0), salida: acc.salida + (r.uso?.salida ?? 0) }),
    { entrada: 0, salida: 0 }
  );
  return {
    proveedor: c.VISION_PROVIDER === "glm" ? "glm" : c.GEMINI_API_KEY ? "gemini" : "glm",
    modelo: c.GEMINI_API_KEY ? c.GEMINI_MODEL : c.ZAI_MODEL,
    resultados,
    resumen: {
      aciertoPct: campos.length ? Math.round((aciertos / campos.length) * 1000) / 10 : 0,
      aciertos,
      campos: campos.length,
      latenciaMediaMs: Math.round(resultados.reduce((s, r) => s + r.ms, 0) / resultados.length),
      tokens,
      costeUsd: costeEstimadoUsd(tokens, c.GEMINI_PRECIO_ENTRADA_USD_M, c.GEMINI_PRECIO_SALIDA_USD_M),
    },
  };
}
