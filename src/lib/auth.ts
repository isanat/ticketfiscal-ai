// Autenticación y autorización por rol. La sesión se valida contra la base de datos
// en cada petición (revocación inmediata).
import { NextRequest, NextResponse } from "next/server";
import { revocarSesion, usuarioIdDeToken, DIAS_SESION } from "./sesiones";
import type { Rol, UsuarioSesion } from "./types";
import { contextoUsuarioPorId } from "./store";

export const COOKIE_SESION = "tf_sesion";

export interface SesionActiva {
  usuario: UsuarioSesion;
  usuarioId: string;
  token: string;
}

function opcionesCookie(expira?: Date) {
  return {
    name: COOKIE_SESION,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expira ? { expires: expira } : {}),
  };
}

export function fijarCookieSesion(res: NextResponse, token: string, expiraEn: Date): void {
  res.cookies.set({ ...opcionesCookie(expiraEn), value: token });
}

export function limpiarCookieSesion(res: NextResponse): void {
  res.cookies.set({ ...opcionesCookie(new Date(0)), value: "", maxAge: 0 });
}

export function tokenDeRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_SESION)?.value ?? null;
}

export async function sesionDeRequest(req: NextRequest): Promise<SesionActiva | null> {
  const token = tokenDeRequest(req);
  if (!token) return null;
  const usuarioId = await usuarioIdDeToken(token);
  if (!usuarioId) return null;
  const usuario = await contextoUsuarioPorId(usuarioId);
  if (!usuario) return null;
  return { usuario, usuarioId, token };
}

export const RESPUESTA_SIN_SESION = (): NextResponse =>
  NextResponse.json({ error: "Sin sesión activa" }, { status: 401 });

/** Exige sesión con el rol indicado. Devuelve la sesión o una respuesta de error. */
export function exigirRol(
  sesion: SesionActiva | null,
  rol: Rol
): { ok: true; sesion: SesionActiva } | { ok: false; respuesta: NextResponse } {
  if (!sesion) return { ok: false, respuesta: RESPUESTA_SIN_SESION() };
  if (sesion.usuario.rol !== rol) {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: "No tiene permisos para esta operación" }, { status: 403 }),
    };
  }
  return { ok: true, sesion };
}

export async function cerrarSesion(req: NextRequest): Promise<void> {
  const token = tokenDeRequest(req);
  if (token) await revocarSesion(token);
}

export { DIAS_SESION };
