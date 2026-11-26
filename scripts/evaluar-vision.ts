// Evaluación de extracción sobre las muestras de public/samples.
// Gabarito leído de las propias imágenes (no de la semilla de demostración).
//
// Uso (la clave solo por variable de entorno, nunca en el código):
//   GEMINI_API_KEY=... bun scripts/evaluar-vision.ts
//   VISION_PROVIDER=glm ZAI_BASE_URL=... ZAI_API_KEY=... bun scripts/evaluar-vision.ts
// Costo: define GEMINI_PRECIO_ENTRADA_USD_M y GEMINI_PRECIO_SALIDA_USD_M con la tabla oficial vigente.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extraerConVision, proveedorActivo, costeEstimadoUsd, type ParteEntrada, type UsoTokens } from "../src/lib/vision";
import { FISCAL_SYSTEM_PROMPT, parseExtraccion, validarExtraccion } from "../src/lib/fiscal";
import { config } from "../src/lib/env";

// La validación no toca la base de datos: basta con que la variable exista.
process.env.STORAGE_POSTGRES_PRISMA_URL ??= "postgresql://evaluacion/no-usada";

const NIF_EMPRESA = "12345678Z"; // empresa de la demo que recibe las facturas de estas muestras

interface Caso {
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

const CASOS: Caso[] = [
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

interface Resultado {
  archivo: string;
  ms: number;
  error?: string;
  aciertos: Record<string, boolean>;
  uso?: UsoTokens;
}

async function evaluarCaso(c: Caso): Promise<Resultado> {
  const base64 = readFileSync(join("public", "samples", c.archivo)).toString("base64");
  const partes: ParteEntrada[] = [
    { tipo: "texto", texto: `Analiza este justificante de gasto de la empresa Taller Pérez e Hijos (NIF ${NIF_EMPRESA}). Devuelve solo el JSON estricto.` },
    { tipo: "archivo", mime: c.mime, base64 },
  ];
  const inicio = Date.now();
  let uso: UsoTokens | undefined;
  try {
    const raw = await extraerConVision(FISCAL_SYSTEM_PROMPT, partes, { onUso: (u) => (uso = u) });
    const ms = Date.now() - inicio;
    const ext = parseExtraccion(raw);
    const r = validarExtraccion(ext, { nifEmpresa: NIF_EMPRESA });
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
    };
  } catch (err) {
    return {
      archivo: c.archivo,
      ms: Date.now() - inicio,
      error: err instanceof Error ? err.message : String(err),
      aciertos: {},
      uso,
    };
  }
}

async function main(): Promise<void> {
  const c = config();
  const proveedor = proveedorActivo(c);
  if (!proveedor) {
    console.error("No hay proveedor de visión configurado (GEMINI_API_KEY o ZAI_BASE_URL/ZAI_API_KEY).");
    process.exit(1);
  }
  console.log(`Proveedor: ${proveedor}${proveedor === "gemini" ? ` (${c.GEMINI_MODEL})` : ""}\n`);

  const resultados: Resultado[] = [];
  for (const caso of CASOS) {
    const r = await evaluarCaso(caso);
    resultados.push(r);
    if (r.error) {
      console.log(`✗ ${r.archivo}: ERROR ${r.error} (${r.ms} ms)`);
      continue;
    }
    const campos = Object.entries(r.aciertos);
    const ok = campos.filter(([, v]) => v).length;
    console.log(`${ok === campos.length ? "✓" : "~"} ${r.archivo}: ${ok}/${campos.length} campos · ${r.ms} ms`);
    for (const [k, v] of campos) if (!v) console.log(`    fallo: ${k}`);
  }

  const totales = resultados.reduce(
    (acc, r) => {
      acc.entrada += r.uso?.entrada ?? 0;
      acc.salida += r.uso?.salida ?? 0;
      return acc;
    },
    { entrada: 0, salida: 0 }
  );
  const campos = resultados.flatMap((r) => Object.values(r.aciertos));
  const aciertoGlobal = campos.length ? (campos.filter(Boolean).length / campos.length) * 100 : 0;
  const coste = costeEstimadoUsd(totales, c.GEMINI_PRECIO_ENTRADA_USD_M, c.GEMINI_PRECIO_SALIDA_USD_M);

  console.log("\n--- Resumen ---");
  console.log(`Acierto por campo: ${aciertoGlobal.toFixed(1)} % (${campos.filter(Boolean).length}/${campos.length})`);
  console.log(`Latencia media: ${Math.round(resultados.reduce((s, r) => s + r.ms, 0) / resultados.length)} ms`);
  console.log(`Tokens: entrada ${totales.entrada} · salida ${totales.salida}`);
  console.log(
    coste === null
      ? "Coste: sin tarifas (define GEMINI_PRECIO_ENTRADA_USD_M y GEMINI_PRECIO_SALIDA_USD_M)"
      : `Coste estimado de las ${CASOS.length} muestras: ${coste.toFixed(6)} USD`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
