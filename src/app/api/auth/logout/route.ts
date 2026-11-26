import { NextRequest, NextResponse } from "next/server";
import { cerrarSesion, limpiarCookieSesion } from "@/lib/auth";
import { error, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    await cerrarSesion(req);
    const res = NextResponse.json({ ok: true });
    limpiarCookieSesion(res);
    return res;
  } catch (e) {
    log("error", "auth.logout_error", { motivo: mensajeError(e) });
    const res = NextResponse.json({ ok: true });
    limpiarCookieSesion(res);
    return res;
  }
}
