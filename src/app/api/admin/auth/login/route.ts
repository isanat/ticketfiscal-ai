import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fijarCookieSesion } from "@/lib/auth";
import { emailSegundoFactorActivo } from "@/lib/email-codigo";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { error, ipCliente, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { consumirLimite } from "@/lib/rate-limit";
import { estadoTotp } from "@/lib/segundo-factor";
import { crearSesion, HORAS_SESION_ADMIN } from "@/lib/sesiones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.email().max(200).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

let hashFicticio: Promise<string> | null = null;

/** Primer paso del acceso del dueño: e-mail y contraseña. La sesión nace SIN segundo factor verificado. */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const { email, password } = cuerpo.data;

    const porIp = await consumirLimite(`adminlogin:ip:${ipCliente(req)}`, 10, 900);
    const porEmail = await consumirLimite(`adminlogin:email:${email}`, 5, 900);
    if (!porIp.permitido || !porEmail.permitido) {
      return error("Demasiados intentos. Espere unos minutos.", 429, {
        "Retry-After": String(Math.max(porIp.reintentoEnSeg, porEmail.reintentoEnSeg)),
      });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    let valida = false;
    if (usuario) valida = await verifyPassword(password, usuario.passwordHash);
    else {
      hashFicticio ??= hashPassword("ficticio-no-usar");
      await verifyPassword(password, await hashFicticio);
    }
    if (!usuario || !valida || usuario.rol !== "ADMIN" || usuario.estado !== "ACTIVA") {
      log("warn", "admin.login_fallido");
      return error("Credenciales incorrectas", 401);
    }

    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
    const { token, expiraEn } = await crearSesion(usuario.id, {
      ip: ipCliente(req),
      userAgent: req.headers.get("user-agent"),
      ttlMs: HORAS_SESION_ADMIN * 3600 * 1000,
    });
    const res = NextResponse.json({
      estadoTotp: await estadoTotp(usuario.id),
      emailSegundoFactor: emailSegundoFactorActivo(),
      usuario: { nombre: usuario.nombre, email: usuario.email },
    });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  } catch (e) {
    log("error", "admin.login_error", { motivo: mensajeError(e) });
    return error("No se pudo iniciar sesión", 500);
  }
}
