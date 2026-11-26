import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirRol, sesionDeRequest } from "@/lib/auth";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { aEmpresa, cambiarEstadoEmpresa } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ estado: z.enum(["APROBADA", "RECHAZADA"]) });

/**
 * La gestoría aprueba o rechaza el alta de una empresa. Solo una empresa aprobada
 * puede enviar justificantes (web o WhatsApp).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = exigirRol(await sesionDeRequest(req), "GESTOR");
    if (!sesion.ok) return sesion.respuesta;
    const gestoriaId = sesion.sesion.usuario.gestoria?.id;
    if (!gestoriaId) return error("La cuenta no tiene gestoría asociada", 400);

    const { id } = await params;
    if (!id || id.length > 64) return error("Identificador no válido", 400);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const actualizada = await cambiarEstadoEmpresa(gestoriaId, id, cuerpo.data.estado, sesion.sesion.usuarioId);
    if (!actualizada) return error("Empresa no encontrada", 404);
    return NextResponse.json({ empresa: aEmpresa(actualizada) });
  } catch (e) {
    log("error", "empresas.patch_error", { motivo: mensajeError(e) });
    return error("No se pudo actualizar la empresa", 500);
  }
}
