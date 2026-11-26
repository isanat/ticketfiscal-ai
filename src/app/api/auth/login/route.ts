import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fijarCookieSesion } from "@/lib/auth";
import { error, ipCliente, leerJson, origenPermitido } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { crearSesion } from "@/lib/sesiones";
import { contextoUsuarioPorId, findUsuarioPorEmail } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.email().max(200).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

// Hash ficticio para igualar el tiempo de respuesta si el email no existe (evita enumeración).
let hashFicticio: Promise<string> | null = null;

export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const { email, password } = cuerpo.data;

    const ip = await consumirLimite(`login:ip:${ipCliente(req)}`, 30, 900);
    const porEmail = await consumirLimite(`login:email:${email}`, 10, 900);
    if (!ip.permitido || !porEmail.permitido) {
      const reintento = Math.max(ip.reintentoEnSeg, porEmail.reintentoEnSeg);
      return error("Demasiados intentos. Espere unos minutos.", 429, { "Retry-After": String(reintento) });
    }

    const usuario = await findUsuarioPorEmail(email);
    let valida = false;
    if (usuario) {
      valida = await verifyPassword(password, usuario.passwordHash);
    } else {
      hashFicticio ??= hashPassword("ficticio-no-usar");
      await verifyPassword(password, await hashFicticio);
    }
    if (!usuario || !valida) {
      log("warn", "auth.login_fallido");
      return error("Email o contraseña incorrectos", 401);
    }

    const { token, expiraEn } = await crearSesion(usuario.id);
    const contexto = await contextoUsuarioPorId(usuario.id);
    if (!contexto) return error("No se pudo cargar la cuenta", 500);

    const res = NextResponse.json({ usuario: contexto });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  } catch (e) {
    log("error", "auth.login_error", { motivo: mensajeError(e) });
    return error("No se pudo iniciar sesión", 500);
  }
}
