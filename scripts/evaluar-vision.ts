// Evaluación local de extracción. Misma lógica que el endpoint (src/lib/evaluacion-vision.ts).
//   GEMINI_API_KEY=... bun scripts/evaluar-vision.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ejecutarEvaluacion } from "../src/lib/evaluacion-vision";

process.env.STORAGE_POSTGRES_PRISMA_URL ??= "postgresql://evaluacion/no-usada";

ejecutarEvaluacion((archivo) => readFileSync(join("public", "samples", archivo)))
  .then((informe) => {
    console.log(`Proveedor: ${informe.proveedor} ${informe.modelo ?? ""}\n`);
    for (const r of informe.resultados) {
      if (r.error) {
        console.log(`✗ ${r.archivo}: ERROR ${r.error} (${r.ms} ms)`);
        continue;
      }
      const campos = Object.entries(r.aciertos);
      const ok = campos.filter(([, v]) => v).length;
      console.log(`${ok === campos.length ? "✓" : "~"} ${r.archivo}: ${ok}/${campos.length} campos · ${r.ms} ms`);
      for (const [k, v] of campos) if (!v) console.log(`    fallo: ${k}`);
    }
    const s = informe.resumen;
    console.log("\n--- Resumen ---");
    console.log(`Acierto por campo: ${s.aciertoPct} % (${s.aciertos}/${s.campos})`);
    console.log(`Latencia media: ${s.latenciaMediaMs} ms`);
    console.log(`Tokens: entrada ${s.tokens.entrada} · salida ${s.tokens.salida}`);
    console.log(s.costeUsd === null ? "Coste: sin tarifas configuradas" : `Coste estimado: ${s.costeUsd.toFixed(6)} USD`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
