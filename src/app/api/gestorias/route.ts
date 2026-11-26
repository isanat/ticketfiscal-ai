import { NextResponse } from "next/server";
import { listarGestorias } from "@/lib/store";

export const runtime = "nodejs";

/** Lista pública de gestorías para el alta de empresas (paso "Su gestoría"). */
export async function GET() {
  try {
    const gestorias = await listarGestorias();
    return NextResponse.json({ gestorias });
  } catch (error) {
    console.error("GET /api/gestorias error:", error);
    return NextResponse.json({ error: "No se pudieron listar las gestorías" }, { status: 500 });
  }
}
