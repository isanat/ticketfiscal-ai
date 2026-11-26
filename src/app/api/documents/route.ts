import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirRol, respuestaGestoriaNoActiva, sesionDeRequest } from "@/lib/auth";
import { error, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { decodificarJustificante, MAX_BYTES_JUSTIFICANTE } from "@/lib/archivos";
import { LimiteIaAlcanzado, procesarJustificante } from "@/lib/pipeline";
import { MotorVisionNoDisponible } from "@/lib/vision";
import { eliminarDocumentoLogico, listarDocumentos, obtenerEmpresa } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRIMESTRE = /^[1-4]T\d{4}$/;

const SubidaBody = z.object({
  imageBase64: z.string().min(1).max(Math.ceil((MAX_BYTES_JUSTIFICANTE * 4) / 3) + 16),
  mimeType: z.string().max(40).optional(),
  imagenNombre: z.string().max(200).optional(),
});

const FiltroQuery = z.object({
  trimestre: z.string().regex(TRIMESTRE).optional(),
  empresaId: z.string().max(64).optional(),
  soloAprobados: z.enum(["1", "0"]).optional(),
});

/** Lista documentos: la gestoría ve su cartera; el cliente, solo los de su empresa. */
export async function GET(req: NextRequest) {
  try {
    const sesion = await sesionDeRequest(req);
    if (!sesion) return error("Sin sesión activa", 401);

    const q = FiltroQuery.safeParse({
      trimestre: req.nextUrl.searchParams.get("trimestre") ?? undefined,
      empresaId: req.nextUrl.searchParams.get("empresaId") ?? undefined,
      soloAprobados: req.nextUrl.searchParams.get("soloAprobados") ?? undefined,
    });
    if (!q.success) return error("Filtros no válidos", 400);

    if (sesion.usuario.rol === "GESTOR") {
      const gestoriaId = sesion.usuario.gestoria?.id;
      if (!gestoriaId) return error("Cuenta sin gestoría asociada", 400);
      if (sesion.usuario.gestoria?.estado !== "ACTIVA") return respuestaGestoriaNoActiva(sesion.usuario.gestoria?.estado);
      const documentos = await listarDocumentos({
        gestoriaId,
        empresaId: q.data.empresaId,
        trimestre: q.data.trimestre,
        soloAprobados: q.data.soloAprobados === "1",
      });
      return NextResponse.json({ documentos }, { headers: { "Cache-Control": "no-store" } });
    }

    const empresaId = sesion.usuario.empresa?.id;
    if (!empresaId) return error("Cuenta sin empresa asociada", 400);
    const documentos = await listarDocumentos({ empresaId, trimestre: q.data.trimestre });
    return NextResponse.json({ documentos }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("error", "documentos.list_error", { motivo: mensajeError(e) });
    return error("Error al listar documentos", 500);
  }
}

/** Subida desde el canal web (simulador de WhatsApp incluido). Solo cliente con empresa aprobada. */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = exigirRol(await sesionDeRequest(req), "CLIENTE");
    if (!sesion.ok) {
      if (sesion.respuesta.status === 403) {
        return error("Los justificantes llegan por el WhatsApp de cada empresa. Entre con la cuenta de cliente para reenviar uno.", 403);
      }
      return sesion.respuesta;
    }
    const empresaId = sesion.sesion.usuario.empresa?.id;
    if (!empresaId) return error("Cuenta sin empresa asociada", 400);

    const limiteUsuario = await consumirLimite(`docs:usuario:${sesion.sesion.usuarioId}`, 60, 3600);
    if (!limiteUsuario.permitido) {
      return error("Ha enviado demasiados justificantes seguidos. Espere unos minutos.", 429, {
        "Retry-After": String(limiteUsuario.reintentoEnSeg),
      });
    }

    const empresa = await obtenerEmpresa(empresaId);
    if (!empresa) return error("No se encontró la empresa", 400);
    if (empresa.estado !== "APROBADA") {
      return error("Su empresa está pendiente de aprobación por su gestoría.", 403);
    }

    const cuerpo = await leerJson(req, SubidaBody, Math.ceil((MAX_BYTES_JUSTIFICANTE * 4) / 3) + 4096);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const archivo = decodificarJustificante(cuerpo.data.imageBase64, cuerpo.data.mimeType);
    if (!archivo.ok) return error(archivo.motivo, 400);

    const r = await procesarJustificante({
      empresa: { id: empresa.id, nombre: empresa.nombre, nif: empresa.nif, gestoriaId: empresa.gestoriaId },
      bytes: archivo.bytes,
      mime: archivo.mime,
      nombreImagen: cuerpo.data.imagenNombre ?? null,
      origen: "WEB",
    });
    return NextResponse.json(
      { documento: r.documento, duplicado: r.estado === "duplicado", simulado: r.simulado },
      { status: r.estado === "creado" ? 201 : 200 }
    );
  } catch (e) {
    if (e instanceof MotorVisionNoDisponible) {
      log("error", "documentos.vision_no_disponible", { motivo: mensajeError(e) });
      return error("El motor de extracción no está disponible ahora. Reintente en unos minutos.", 503);
    }
    if (e instanceof LimiteIaAlcanzado) {
      return error("Ha alcanzado el límite diario de justificantes de su empresa.", 429);
    }
    log("error", "documentos.post_error", { motivo: mensajeError(e) });
    return error("No se pudo procesar el justificante. Inténtelo de nuevo.", 500);
  }
}

/** Retira un documento del lote (borrado lógico). Solo gestoría, solo sus documentos. */
export async function DELETE(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const sesion = exigirRol(await sesionDeRequest(req), "GESTOR");
    if (!sesion.ok) return sesion.respuesta;
    const gestoriaId = sesion.sesion.usuario.gestoria?.id;
    if (!gestoriaId) return error("Cuenta sin gestoría asociada", 400);

    // Sin id no se borra nada: nunca hay un borrado masivo.
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!id || id.length > 64) return error("Indique el documento a retirar", 400);

    const ok = await eliminarDocumentoLogico(id, gestoriaId, sesion.sesion.usuarioId, sesion.sesion.soporteAdminId);
    if (!ok) return error("Documento no encontrado", 404);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    log("error", "documentos.delete_error", { motivo: mensajeError(e) });
    return error("Error al eliminar", 500);
  }
}
