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
  const leer = (archivo: string) => readFileSync(path.join(process.cwd(), "public", "samples", archivo));
  try {
    const informe = await ejecutarEvaluacion(leer);
    return NextResponse.json(informe, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
