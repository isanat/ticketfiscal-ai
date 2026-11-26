import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";
import { consumirLimite } from "@/lib/rate-limit";
import { estadoTotp, verificarSegundoFactor } from "@/lib/segundo-factor";
import { marcarSegundoFactor } from "@/lib/sesiones";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ codigo: z.string().min(6).max(20), codigoEmail: z.string().max(10).optional() });

/** Verifica el segundo factor al iniciar sesión (TOTP o código de recuperación). */
export async function POST(req: NextRequest) {
  return conAdmin(req, { permitirParcial: true }, async (s) => {
    const lim = await consumirLimite(`totp:${s.usuarioId}`, 8, 900);
    if (!lim.permitido) return error("Demasiados intentos. Espere unos minutos.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    if ((await estadoTotp(s.usuarioId)) !== "activo") return error("Primero configure el autenticador.", 409, undefined);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const ok = await verificarSegundoFactor(s.usuarioId, cuerpo.data);
    if (!ok) return error("Código incorrecto o caducado.", 401);
    await marcarSegundoFactor(s.sesionId);
    await registrarAuditoria({ usuarioId: s.usuarioId, accion: "admin.acceso", entidad: "Usuario", entidadId: s.usuarioId });
    return NextResponse.json({ ok: true });
  });
}
