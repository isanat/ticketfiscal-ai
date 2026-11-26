import { NextResponse } from "next/server";
import { limpiarCookieSesion } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  // La sesión es un token firmado (stateless): cerrar sesión consiste en
  // invalidar la cookie en el navegador.
  const res = NextResponse.json({ ok: true });
  limpiarCookieSesion(res);
  return res;
}
