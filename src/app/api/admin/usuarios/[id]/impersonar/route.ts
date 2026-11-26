import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conAdmin } from "@/lib/admin-http";
import { fijarCookieSesion } from "@/lib/auth";
import { error, ipCliente, leerJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { crearSesion, MINUTOS_SESION_SOPORTE } from "@/lib/sesiones";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_VUELTA = "tf_admin_vuelta";

const Body = z.object({ motivo: z.string().trim().min(10, "Describa el motivo del soporte (mín. 10 caracteres)").max(300) });

/**
 * Abre una sesión de soporte como otro usuario. Exige segundo factor reciente y un motivo.
 * Dura 30 minutos, queda auditada y la interfaz del usuario muestra un aviso.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const { id } = await params;
    const u = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, rol: true, estado: true, gestoriaId: true, nombre: true, empresa: { select: { gestoriaId: true } } },
    });
    if (!u) return error("Usuario no encontrado", 404);
    if (u.rol === "ADMIN") return error("No se puede entrar como otro administrador.", 403);
    if (u.estado !== "ACTIVA") return error("La cuenta está suspendida. Reactívela primero.", 409);

    const ttlMs = MINUTOS_SESION_SOPORTE * 60 * 1000;
    const { token, expiraEn } = await crearSesion(u.id, {
      ip: ipCliente(req),
      userAgent: req.headers.get("user-agent"),
      impersonadoPorId: s.usuarioId,
      ttlMs,
    });
    await registrarAuditoria({
      usuarioId: s.usuarioId,
      gestoriaId: u.gestoriaId ?? u.empresa?.gestoriaId ?? null,
      accion: "soporte.inicio",
      entidad: "Usuario",
      entidadId: u.id,
      detalle: { motivo: cuerpo.data.motivo, minutos: MINUTOS_SESION_SOPORTE },
    });
    const res = NextResponse.json({ ok: true, expiraEn });
    // Se conserva la sesión de administrador en una cookie aparte para poder volver.
    res.cookies.set({ name: COOKIE_VUELTA, value: s.token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiraEn });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  });
}
