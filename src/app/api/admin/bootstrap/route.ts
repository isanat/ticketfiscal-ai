import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/env";
import { hashPassword } from "@/lib/hash";
import { error, ipCliente, leerJson, origenPermitido } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { consumirLimite } from "@/lib/rate-limit";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_ENCONTRADO = () => new NextResponse("Not found", { status: 404 });

async function disponible(): Promise<boolean> {
  const c = config();
  if (!c.ADMIN_BOOTSTRAP_TOKEN || !c.ADMIN_EMAIL) return false;
  return (await prisma.usuario.count({ where: { rol: "ADMIN" } })) === 0;
}

/** Indica si el primer acceso está disponible (no existe ningún administrador y hay token configurado). */
export async function GET() {
  return (await disponible()) ? NextResponse.json({ disponible: true }) : NO_ENCONTRADO();
}

const Body = z.object({
  token: z.string().min(24).max(200),
  email: z.email().max(200).transform((v) => v.trim().toLowerCase()),
  nombre: z.string().trim().min(3).max(120),
  password: z
    .string()
    .min(12, "La contraseña debe tener al menos 12 caracteres")
    .max(128)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "La contraseña debe incluir letras y números"),
});

/**
 * Crea el primer administrador. Solo si: no existe ninguno, el token coincide y el e-mail es el
 * pre-aprobado (ADMIN_EMAIL). Después se desactiva solo, porque ya existe un administrador.
 */
export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    if (!(await disponible())) return NO_ENCONTRADO();
    const lim = await consumirLimite(`bootstrap:${ipCliente(req)}`, 5, 3600);
    if (!lim.permitido) return error("Demasiados intentos.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const c = config();
    const a = Buffer.from(cuerpo.data.token);
    const b = Buffer.from(c.ADMIN_BOOTSTRAP_TOKEN ?? "");
    const tokenOk = a.length === b.length && timingSafeEqual(a, b);
    const emailOk = cuerpo.data.email === (c.ADMIN_EMAIL ?? "").toLowerCase();
    if (!tokenOk || !emailOk) {
      log("warn", "admin.bootstrap_rechazado");
      return error("Datos de primer acceso no válidos.", 403);
    }
    if (await prisma.usuario.findUnique({ where: { email: cuerpo.data.email }, select: { id: true } })) {
      return error("Ya existe una cuenta con ese e-mail.", 409);
    }
    const u = await prisma.usuario.create({
      data: { email: cuerpo.data.email, nombre: cuerpo.data.nombre, passwordHash: await hashPassword(cuerpo.data.password), rol: "ADMIN" },
    });
    await registrarAuditoria({ usuarioId: u.id, accion: "admin.creado", entidad: "Usuario", entidadId: u.id });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    log("error", "admin.bootstrap_error", { motivo: mensajeError(e) });
    return error("No se pudo completar el primer acceso", 500);
  }
}
