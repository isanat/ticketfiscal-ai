import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sesionDeRequest } from "@/lib/auth";
import { empresaAccesible } from "@/lib/conciliacion-db";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { omitir } from "@/lib/reclamaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ empresaId: z.string().max(64), movimientoId: z.string().max(64) });

/** El gestor marca un cargo como «no necesita justificante». */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || sesion.usuario.rol !== "GESTOR") return error("Solo la gestoría puede omitir cargos", 403);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const empresa = await empresaAccesible(sesion, cuerpo.data.empresaId);
    if (!empresa) return error("Empresa no encontrada", 404);
    const ok = await omitir(empresa.id, cuerpo.data.movimientoId, { usuarioId: sesion.usuarioId, soporteAdminId: sesion.soporteAdminId });
    return ok ? NextResponse.json({ ok: true }) : error("Movimiento no encontrado", 404);
  } catch (e) {
    log("error", "reclamacion.omitir_error", { motivo: mensajeError(e) });
    return error("No se pudo omitir el cargo", 500);
  }
}
