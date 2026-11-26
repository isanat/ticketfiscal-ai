import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sesionDeRequest } from "@/lib/auth";
import { confirmarConciliacion, deshacerConciliacion, empresaAccesible } from "@/lib/conciliacion-db";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ empresaId: z.string().max(64).optional(), movimientoId: z.string().max(64), documentoId: z.string().max(64) });

export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || (sesion.usuario.rol !== "GESTOR" && sesion.usuario.rol !== "CLIENTE")) return error("Sin sesión activa", 401);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const empresa = await empresaAccesible(sesion, cuerpo.data.empresaId);
    if (!empresa) return error("Empresa no encontrada", 404);
    const r = await confirmarConciliacion(empresa.id, cuerpo.data.movimientoId, cuerpo.data.documentoId, sesion);
    if (r === "no_existe") return error("Movimiento o justificante no encontrado", 404);
    if (r === "importe_distinto") return error("El importe del movimiento no coincide con el del justificante.", 422);
    if (r === "ya_conciliado") return error("Ese movimiento o ese justificante ya está conciliado.", 409);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    log("error", "conciliacion.confirmar_error", { motivo: mensajeError(e) });
    return error("No se pudo confirmar la conciliación", 500);
  }
}

/** Deshace una conciliación confirmada (?movimientoId=…&empresaId=…). */
export async function DELETE(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || (sesion.usuario.rol !== "GESTOR" && sesion.usuario.rol !== "CLIENTE")) return error("Sin sesión activa", 401);
    const empresa = await empresaAccesible(sesion, req.nextUrl.searchParams.get("empresaId"));
    if (!empresa) return error("Empresa no encontrada", 404);
    const movimientoId = req.nextUrl.searchParams.get("movimientoId") ?? "";
    if (!movimientoId || movimientoId.length > 64) return error("Indique el movimiento", 400);
    return (await deshacerConciliacion(empresa.id, movimientoId, sesion)) ? NextResponse.json({ ok: true }) : error("Conciliación no encontrada", 404);
  } catch (e) {
    log("error", "conciliacion.deshacer_error", { motivo: mensajeError(e) });
    return error("No se pudo deshacer la conciliación", 500);
  }
}
