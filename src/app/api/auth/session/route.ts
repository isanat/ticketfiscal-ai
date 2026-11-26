import { NextRequest, NextResponse } from "next/server";
import { usuarioDesdeRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sesion = await usuarioDesdeRequest(req);
    if (!sesion) {
      return NextResponse.json({ error: "Sin sesión activa" }, { status: 401 });
    }
    return NextResponse.json({ usuario: sesion.usuario });
  } catch {
    return NextResponse.json({ error: "Sin sesión activa" }, { status: 401 });
  }
}
