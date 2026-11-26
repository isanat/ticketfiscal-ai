import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log, mensajeError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salud para monitorización: comprueba la base de datos sin exponer detalles. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("error", "health.db_error", { motivo: mensajeError(e) });
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
