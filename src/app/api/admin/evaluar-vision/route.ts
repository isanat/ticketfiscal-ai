// Endpoint TEMPORAL de evaluación de visión. Solo responde con un token de uso único (EVAL_TOKEN).
// Sin token válido responde 404. Nunca devuelve claves ni contenido de las muestras.
import { readFileSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ejecutarEvaluacion } from "@/lib/evaluacion-vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function tokenValido(recibido: string | null): boolean {
  const esperado = process.env.EVAL_TOKEN ?? "";
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!tokenValido(req.nextUrl.searchParams.get("t"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Diagnóstico: una petición mínima a Gemini, sin devolver la clave.
  if (req.nextUrl.searchParams.get("modo") === "ping") {
    const clave = process.env.GEMINI_API_KEY ?? "";
    const modelo = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const inicio = Date.now();
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo: ok" }] }], generationConfig: { maxOutputTokens: 20 } }),
        signal: AbortSignal.timeout(25000),
      });
      const cuerpo = (await r.text()).slice(0, 300);
      return NextResponse.json({ status: r.status, ms: Date.now() - inicio, modelo, claveConfigurada: clave.length > 0, cuerpo });
    } catch (e) {
      return NextResponse.json({ ms: Date.now() - inicio, modelo, claveConfigurada: clave.length > 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const caso = req.nextUrl.searchParams.get("caso");
  const leer = (archivo: string) => readFileSync(path.join(process.cwd(), "public", "samples", archivo));
  try {
    const prov = req.nextUrl.searchParams.get("proveedor");
    const proveedor = prov === "anthropic" || prov === "gemini" || prov === "glm" ? prov : undefined;
    const informe = await ejecutarEvaluacion(leer, {
      soloIndice: caso === null ? undefined : Number(caso),
      proveedor,
    });
    return NextResponse.json(informe, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
