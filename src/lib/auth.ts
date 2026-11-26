// Autenticación y autorización por rol. La sesión se valida contra la base de datos
// en cada petición (revocación inmediata).
import { NextRequest, NextResponse } from "next/server";
import { datosDeToken, revocarSesion, revocarTodasDeUsuario, DIAS_SESION } from "./sesiones";
import type { Rol, UsuarioSesion } from "./types";
import { contextoUsuarioPorId } from "./store";

export const COOKIE_SESION = "tf_sesion";

export interface SesionActiva {
  usuario: UsuarioSesion;
  usuarioId: string;
  token: string;
  sesionId: string;
  /** Última verificación del segundo factor (solo administradores). */
  totpVerificadoEn: Date | null;
  /** Administrador que abrió esta sesión de soporte, si lo es. */
  soporteAdminId: string | null;
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
  const datos = await datosDeToken(token);
  if (!datos) return null;
  const usuario = await contextoUsuarioPorId(datos.usuarioId);
  if (!usuario) return null;
  // Una suspensión corta el acceso de inmediato, incluso con sesión abierta.
  if (usuario.suspendida) {
    await revocarTodasDeUsuario(datos.usuarioId);
    return null;
  }
  if (datos.impersonadoPorId) usuario.soporte = true;
  return {
    usuario,
    usuarioId: datos.usuarioId,
    token,
    sesionId: datos.id,
    totpVerificadoEn: datos.totpVerificadoEn,
    soporteAdminId: datos.impersonadoPorId,
  };
}

export const RESPUESTA_SIN_SESION = (): NextResponse =>
  NextResponse.json({ error: "Sin sesión activa" }, { status: 401 });

export function respuestaGestoriaNoActiva(estado?: string): NextResponse {
  return NextResponse.json(
    {
      error:
        estado === "SUSPENDIDA"
          ? "Su gestoría está suspendida. Contacte con soporte."
          : "Su gestoría está pendiente de aprobación por el equipo de TicketFiscal.",
      codigo: estado === "SUSPENDIDA" ? "GESTORIA_SUSPENDIDA" : "GESTORIA_PENDIENTE",
    },
    { status: 403 }
  );
}

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
  // Una gestoría pendiente de aprobación o suspendida no accede a datos de su cartera.
  if (rol === "GESTOR" && sesion.usuario.gestoria?.estado !== "ACTIVA") {
    return { ok: false, respuesta: respuestaGestoriaNoActiva(sesion.usuario.gestoria?.estado) };
  }
  return { ok: true, sesion };
}

export async function cerrarSesion(req: NextRequest): Promise<void> {
  const token = tokenDeRequest(req);
  if (token) await revocarSesion(token);
}

export { DIAS_SESION };
