import { NextRequest, NextResponse } from "next/server";
import { conAdmin } from "@/lib/admin-http";
import { emailSegundoFactorActivo, enviarCodigoEmail } from "@/lib/email-codigo";
import { error } from "@/lib/http";
import { consumirLimite } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Envía un código por e-mail. Solo funciona cuando el segundo factor por e-mail está activo. */
export async function POST(req: NextRequest) {
  return conAdmin(req, { permitirParcial: true }, async (s) => {
    if (!emailSegundoFactorActivo()) return error("El código por e-mail no está activo.", 409);
    const lim = await consumirLimite(`emailcod:${s.usuarioId}`, 5, 900);
    if (!lim.permitido) return error("Demasiadas solicitudes.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    const ok = await enviarCodigoEmail(s.usuarioId, s.usuario.email, "admin", "Verificación de seguridad de la administración");
    return ok ? NextResponse.json({ enviado: true }) : error("No se pudo enviar el e-mail.", 502);
  });
}
