import { NextRequest, NextResponse } from "next/server";
import { requiereRol, usuarioDesdeRequest } from "@/lib/auth";
import { listarEmpresasDeGestoria } from "@/lib/store";

export const runtime = "nodejs";

/** Empresas de la gestoría del asesor autenticado, con métricas del lote. */
export async function GET(req: NextRequest) {
  try {
    const sesion = await usuarioDesdeRequest(req);
    const gestor = requiereRol(sesion, "GESTOR");
    if ("error" in gestor) return gestor.error;

    const gestoriaId = gestor.usuario.gestoria?.id;
    if (!gestoriaId) {
      return NextResponse.json({ error: "La cuenta no tiene gestoría asociada" }, { status: 400 });
    }

    const empresas = await listarEmpresasDeGestoria(gestoriaId);
    return NextResponse.json({ empresas });
  } catch (error) {
    console.error("GET /api/empresas error:", error);
    return NextResponse.json({ error: "No se pudieron listar las empresas" }, { status: 500 });
  }
}
