import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirRol, sesionDeRequest } from "@/lib/auth";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { CUENTAS_PGC } from "@/lib/fiscal";
import { actualizarRevision, aDocumento } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    revision: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]).optional(),
    cuentaPgc: z
      .string()
      .refine((c) => c in CUENTAS_PGC, "Cuenta PGC no reconocida")
      .nullable()
      .optional(),
    motivoRevision: z.string().trim().max(500).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Indique al menos un cambio");

/** Revisión humana: aprobar, rechazar, corregir cuenta PGC. Solo gestoría, solo sus documentos. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = exigirRol(await sesionDeRequest(req), "GESTOR");
    if (!sesion.ok) return sesion.respuesta;
    const gestoriaId = sesion.sesion.usuario.gestoria?.id;
    if (!gestoriaId) return error("Cuenta sin gestoría asociada", 400);

    const { id } = await params;
    if (!id || id.length > 64) return error("Identificador no válido", 400);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const actualizado = await actualizarRevision(id, gestoriaId, sesion.sesion.usuarioId, cuerpo.data, sesion.sesion.soporteAdminId);
    if (!actualizado) return error("Documento no encontrado", 404);
    return NextResponse.json({ documento: aDocumento(actualizado) });
  } catch (e) {
    log("error", "documentos.patch_error", { motivo: mensajeError(e) });
    return error("No se pudo actualizar el documento", 500);
  }
}
