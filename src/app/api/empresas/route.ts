import { NextRequest, NextResponse } from "next/server";
import { exigirRol, sesionDeRequest } from "@/lib/auth";
import { error } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { listarEmpresasDeGestoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Empresas de la gestoría del asesor autenticado, con métricas del lote. */
export async function GET(req: NextRequest) {
  try {
    const sesion = exigirRol(await sesionDeRequest(req), "GESTOR");
    if (!sesion.ok) return sesion.respuesta;
    const gestoriaId = sesion.sesion.usuario.gestoria?.id;
    if (!gestoriaId) return error("La cuenta no tiene gestoría asociada", 400);

    const empresas = await listarEmpresasDeGestoria(gestoriaId);
    return NextResponse.json({ empresas }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("error", "empresas.list_error", { motivo: mensajeError(e) });
    return error("No se pudieron listar las empresas", 500);
  }
}
