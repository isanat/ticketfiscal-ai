// Sesiones revocables en base de datos. La cookie lleva un token aleatorio;
// en BD solo se guarda su hash, así una fuga de la base no permite suplantar sesiones.
import { prisma } from "./prisma";
import { hashToken, nuevoToken } from "./hash";

export const DIAS_SESION = 14;

export async function crearSesion(usuarioId: string): Promise<{ token: string; expiraEn: Date }> {
  const token = nuevoToken();
  const expiraEn = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);
  await prisma.sesion.create({
    data: { usuarioId, tokenHash: hashToken(token), expiraEn },
  });
  return { token, expiraEn };
}

/** Devuelve el id de usuario si la sesión existe, no está revocada ni caducada. */
export async function usuarioIdDeToken(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usuarioId: true, expiraEn: true, revocadaEn: true },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn.getTime() < Date.now()) return null;
  return sesion.usuarioId;
}

export async function revocarSesion(token: string): Promise<void> {
  if (!token || token.length > 128) return;
  await prisma.sesion.updateMany({
    where: { tokenHash: hashToken(token), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

/** Revoca todas las sesiones de un usuario (p. ej. tras cambiar contraseña). */
export async function revocarTodasDeUsuario(usuarioId: string): Promise<void> {
  await prisma.sesion.updateMany({
    where: { usuarioId, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}
