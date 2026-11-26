import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sesionDeRequest } from "@/lib/auth";
import { empresaAccesible, importarExtracto } from "@/lib/conciliacion-db";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENIDO = 2_000_000;
const Body = z.object({
  empresaId: z.string().max(64).optional(),
  formato: z.enum(["csv", "n43"]),
  contenido: z.string().min(10).max(MAX_CONTENIDO),
});

/** Importa un extracto (CSV o Norma 43). Reimportar el mismo extracto no duplica movimientos. */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = await sesionDeRequest(req);
    if (!sesion || (sesion.usuario.rol !== "GESTOR" && sesion.usuario.rol !== "CLIENTE")) return error("Sin sesión activa", 401);
    const lim = await consumirLimite(`extracto:${sesion.usuarioId}`, 20, 3600);
    if (!lim.permitido) return error("Demasiadas importaciones seguidas.", 429, { "Retry-After": String(lim.reintentoEnSeg) });

    const cuerpo = await leerJson(req, Body, MAX_CONTENIDO + 4096);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const empresa = await empresaAccesible(sesion, cuerpo.data.empresaId);
    if (!empresa) return error("Empresa no encontrada", 404);

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
      detalle: { formato: cuerpo.data.formato, ...r },
      impersonadoPorId: sesion.soporteAdminId,
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    log("error", "conciliacion.importar_error", { motivo: mensajeError(e) });
    return error("No se pudo importar el extracto", 500);
  }
}
