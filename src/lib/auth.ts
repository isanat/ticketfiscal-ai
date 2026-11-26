// TicketFiscal AI — Sesiones con cookie httpOnly.
// El token vive en la tabla Sesion (o en memoria); la cookie solo transporta
// el token opaco, nunca datos del usuario.

import { NextRequest, NextResponse } from "next/server";
import { contextoUsuario, leerSesion } from "./store";
import type { Rol, UsuarioSesion } from "./types";

export const COOKIE_SESION = "tf_sesion";

export function fijarCookieSesion(res: NextResponse, token: string, expiraEn: Date): void {
  res.cookies.set({
    name: COOKIE_SESION,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEn,
  });
}

export function limpiarCookieSesion(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_SESION,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function usuarioDesdeRequest(
  req: NextRequest
): Promise<{ usuario: UsuarioSesion; token: string } | null> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  if (!token) return null;
  const usuarioId = await leerSesion(token);
  if (!usuarioId) return null;
  const usuario = await contextoUsuario(usuarioId);
  if (!usuario) return null;
  return { usuario, token };
}

export function requiereRol(
  sesion: { usuario: UsuarioSesion; token: string } | null,
  rol: Rol
): { usuario: UsuarioSesion; token: string } | { error: NextResponse } {
  if (!sesion) {
    return { error: NextResponse.json({ error: "Sin sesión activa" }, { status: 401 }) };
  }
  if (sesion.usuario.rol !== rol) {
    return {
      error: NextResponse.json(
        { error: "No tiene permisos para esta operación" },
        { status: 403 }
      ),
    };
  }
  return sesion;
}
