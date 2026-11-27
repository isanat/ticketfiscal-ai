import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sesionDeRequest } from "@/lib/auth";
import { empresaAccesible, importarExtracto, previsualizarExtracto } from "@/lib/conciliacion-db";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENIDO = 2_000_000;
const Body = z.object({
  empresaId: z.string().max(64).optional(),
  formato: z.enum(["csv", "n43", "auto"]).default("auto"),
  /** Solo lee el archivo y devuelve una vista previa, sin guardar nada. */
  soloVista: z.boolean().optional(),
  contenido: z.string().min(10).max(MAX_CONTENIDO),
});

/** Importa un extracto (CSV o Norma 43). Reimportar el mismo extracto no duplica movimientos. */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || (sesion.usuario.rol !== "GESTOR" && sesion.usuario.rol !== "CLIENTE")) return error("Sin sesión activa", 401);
    const cuerpo = await leerJson(req, Body, MAX_CONTENIDO + 4096);
    if (!cuerpo.ok) return cuerpo.respuesta;
    // Las vistas previas no guardan nada, así que admiten más intentos que las importaciones.
    const lim = await consumirLimite(`extracto:${cuerpo.data.soloVista ? "vista" : "importar"}:${sesion.usuarioId}`, cuerpo.data.soloVista ? 120 : 60, 3600);
    if (!lim.permitido) return error("Demasiadas importaciones seguidas.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    const empresa = await empresaAccesible(sesion, cuerpo.data.empresaId);
    if (!empresa) return error("Empresa no encontrada", 404);

    if (cuerpo.data.soloVista) {
      const vista = await previsualizarExtracto(empresa.id, cuerpo.data.formato, cuerpo.data.contenido);
      return NextResponse.json({ vista });
    }
    const r = await importarExtracto(empresa.id, cuerpo.data.formato, cuerpo.data.contenido, sesion.usuarioId);
    if (r.importados === 0 && r.duplicados === 0) {
      return error("No se reconoció ningún movimiento. Compruebe el formato (CSV con cabecera Fecha/Concepto/Importe, o Norma 43).", 422);
    }
    await registrarAuditoria({
      usuarioId: sesion.usuarioId,
      gestoriaId: empresa.gestoriaId,
      accion: "extracto.importado",
      entidad: "Empresa",
      entidadId: empresa.id,
      detalle: { ...r },
      impersonadoPorId: sesion.soporteAdminId,
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    log("error", "conciliacion.importar_error", { motivo: mensajeError(e) });
    return error("No se pudo importar el extracto", 500);
  }
}
