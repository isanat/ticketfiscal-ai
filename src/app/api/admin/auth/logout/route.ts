import { NextRequest, NextResponse } from "next/server";
import { cerrarSesion, limpiarCookieSesion } from "@/lib/auth";
import { error, origenPermitido } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!origenPermitido(req)) return error("Origen no permitido", 403);
  await cerrarSesion(req);
  const res = NextResponse.json({ ok: true });
  limpiarCookieSesion(res);
  return res;
}
