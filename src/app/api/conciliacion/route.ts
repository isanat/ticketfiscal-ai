import { NextRequest, NextResponse } from "next/server";
import { sesionDeRequest } from "@/lib/auth";
import { empresaAccesible, vistaConciliacion } from "@/lib/conciliacion-db";
import { error } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vista de conciliación de una empresa: confirmadas, sugerencias y lo que falta a cada lado. */
export async function GET(req: NextRequest) {
  try {
    const sesion = await sesionDeRequest(req);
    if (!sesion || (sesion.usuario.rol !== "GESTOR" && sesion.usuario.rol !== "CLIENTE")) return error("Sin sesión activa", 401);
    const empresa = await empresaAccesible(sesion, req.nextUrl.searchParams.get("empresaId"));
    if (!empresa) return error("Empresa no encontrada", 404);
    const trimestre = req.nextUrl.searchParams.get("trimestre") ?? undefined;
    if (trimestre && !/^[1-4]T\d{4}$/.test(trimestre)) return error("Trimestre no válido", 400);
    return NextResponse.json(await vistaConciliacion(empresa.id, trimestre), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("error", "conciliacion.vista_error", { motivo: mensajeError(e) });
    return error("No se pudo cargar la conciliación", 500);
  }
}
