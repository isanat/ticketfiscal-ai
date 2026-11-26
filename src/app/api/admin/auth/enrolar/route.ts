import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";
import { consumirLimite } from "@/lib/rate-limit";
import { activarEnrolamiento, iniciarEnrolamiento } from "@/lib/segundo-factor";
import { marcarSegundoFactor } from "@/lib/sesiones";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paso 1: genera el secreto y el QR. Solo mientras el TOTP no esté activo. */
export async function POST(req: NextRequest) {
  return conAdmin(req, { permitirParcial: true }, async (s) => {
    const r = await iniciarEnrolamiento(s.usuarioId, s.usuario.email);
    if (!r) return error("El autenticador ya está activo.", 409);
    const qr = await QRCode.toDataURL(r.uri, { margin: 1, width: 240 });
    return NextResponse.json({ secreto: r.secreto, uri: r.uri, qr });
  });
}

const Body = z.object({ codigo: z.string().min(6).max(10) });

/** Paso 2: confirma con un código y entrega los 8 códigos de recuperación (una sola vez). */
export async function PUT(req: NextRequest) {
  return conAdmin(req, { permitirParcial: true }, async (s) => {
    const lim = await consumirLimite(`enrolar:${s.usuarioId}`, 8, 900);
    if (!lim.permitido) return error("Demasiados intentos.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const codigos = await activarEnrolamiento(s.usuarioId, cuerpo.data.codigo);
    if (!codigos) return error("Código incorrecto. Compruebe la hora de su móvil.", 401);
    await marcarSegundoFactor(s.sesionId);
    await registrarAuditoria({ usuarioId: s.usuarioId, accion: "admin.totp_activado", entidad: "Usuario", entidadId: s.usuarioId });
    return NextResponse.json({ codigosRespaldo: codigos });
  });
}
