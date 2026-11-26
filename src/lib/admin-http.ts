// Envoltorio común de las rutas de administración: acceso, paginación y errores.
import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "./admin-auth";
import type { SesionActiva } from "./auth";
import { error } from "./http";
import { log, mensajeError } from "./logger";

export async function conAdmin(
  req: NextRequest,
  opciones: { stepUp?: boolean; permitirParcial?: boolean },
  manejador: (sesion: SesionActiva) => Promise<NextResponse>
): Promise<NextResponse> {
  const r = await exigirAdmin(req, opciones);
  if (!r.ok) return r.respuesta;
  try {
    return await manejador(r.sesion);
  } catch (e) {
    log("error", "admin.error", { ruta: req.nextUrl.pathname, motivo: mensajeError(e) });
    return error("Error interno de la administración", 500);
  }
}

export function numeroPagina(req: NextRequest): number {
  const n = Number(req.nextUrl.searchParams.get("pagina") ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function textoParam(req: NextRequest, nombre: string, max = 100): string | undefined {
  const v = req.nextUrl.searchParams.get(nombre)?.trim();
  return v ? v.slice(0, max) : undefined;
}
