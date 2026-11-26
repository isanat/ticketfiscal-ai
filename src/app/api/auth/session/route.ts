import { NextRequest, NextResponse } from "next/server";
import { RESPUESTA_SIN_SESION, sesionDeRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return RESPUESTA_SIN_SESION();
  return NextResponse.json({ usuario: sesion.usuario }, { headers: { "Cache-Control": "no-store" } });
}
