import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sesionDeRequest } from "@/lib/auth";
import { empresaAccesible } from "@/lib/conciliacion-db";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { MAX_POR_PETICION, reclamar } from "@/lib/reclamaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ empresaId: z.string().max(64), movimientoIds: z.array(z.string().max(64)).min(1).max(MAX_POR_PETICION) });

/** La gestoría pide al cliente el justificante de los cargos indicados. Solo el rol gestor. */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || sesion.usuario.rol !== "GESTOR") return error("Solo la gestoría puede reclamar justificantes", 403);
    const lim = await consumirLimite(`reclamar:${sesion.usuarioId}`, 30, 3600);
    if (!lim.permitido) return error("Demasiadas reclamaciones seguidas.", 429, { "Retry-After": String(lim.reintentoEnSeg) });

    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const empresa = await empresaAccesible(sesion, cuerpo.data.empresaId);
    if (!empresa) return error("Empresa no encontrada", 404);

    const resultados = await reclamar(empresa.id, cuerpo.data.movimientoIds, { usuarioId: sesion.usuarioId, soporteAdminId: sesion.soporteAdminId });
    return NextResponse.json({ resultados });
  } catch (e) {
    log("error", "reclamacion.error", { motivo: mensajeError(e) });
    return error("No se pudo enviar la reclamación", 500);
  }
}
