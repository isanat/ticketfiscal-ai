// Sesiones revocables en base de datos. La cookie lleva un token aleatorio;
// en BD solo se guarda su hash, así una fuga de la base no permite suplantar sesiones.
import { prisma } from "./prisma";
import { hashToken, nuevoToken } from "./hash";

export const DIAS_SESION = 14;
/** Las sesiones de administrador caducan en horas, no en días. */
export const HORAS_SESION_ADMIN = 8;
/** Las sesiones de soporte (impersonación) son cortas. */
export const MINUTOS_SESION_SOPORTE = 30;

export interface OpcionesSesion {
  ip?: string | null;
  userAgent?: string | null;
  impersonadoPorId?: string | null;
  ttlMs?: number;
  totpVerificadoEn?: Date | null;
}

export interface DatosSesion {
  id: string;
  usuarioId: string;
  totpVerificadoEn: Date | null;
  impersonadoPorId: string | null;
  expiraEn: Date;
}

export async function crearSesion(
  usuarioId: string,
  opciones: OpcionesSesion = {}
): Promise<{ token: string; expiraEn: Date; id: string }> {
  const token = nuevoToken();
  const ttl = opciones.ttlMs ?? DIAS_SESION * 24 * 60 * 60 * 1000;
  const expiraEn = new Date(Date.now() + ttl);
  const fila = await prisma.sesion.create({
    data: {
      usuarioId,
      tokenHash: hashToken(token),
      expiraEn,
      ip: opciones.ip?.slice(0, 64) ?? null,
      userAgent: opciones.userAgent?.slice(0, 200) ?? null,
      impersonadoPorId: opciones.impersonadoPorId ?? null,
      totpVerificadoEn: opciones.totpVerificadoEn ?? null,
    },
    select: { id: true },
  });
  return { token, expiraEn, id: fila.id };
}

/** Datos de la sesión si existe, no está revocada ni caducada. */
export async function datosDeToken(token: string): Promise<DatosSesion | null> {
  if (!token || token.length > 128) return null;
  const s = await prisma.sesion.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, usuarioId: true, expiraEn: true, revocadaEn: true, totpVerificadoEn: true, impersonadoPorId: true },
  });
  if (!s || s.revocadaEn || s.expiraEn.getTime() < Date.now()) return null;
  return {
    id: s.id,
    usuarioId: s.usuarioId,
    totpVerificadoEn: s.totpVerificadoEn,
    impersonadoPorId: s.impersonadoPorId,
    expiraEn: s.expiraEn,
  };
}

export async function usuarioIdDeToken(token: string): Promise<string | null> {
  return (await datosDeToken(token))?.usuarioId ?? null;
}

export async function marcarSegundoFactor(sesionId: string): Promise<void> {
  await prisma.sesion.update({ where: { id: sesionId }, data: { totpVerificadoEn: new Date() } });
}

export async function revocarSesion(token: string): Promise<void> {
  if (!token || token.length > 128) return;
  await prisma.sesion.updateMany({
    where: { tokenHash: hashToken(token), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

export async function revocarSesionPorId(sesionId: string): Promise<boolean> {
  const r = await prisma.sesion.updateMany({ where: { id: sesionId, revocadaEn: null }, data: { revocadaEn: new Date() } });
  return r.count > 0;
}

/** Revoca todas las sesiones de un usuario (suspensión, cambio de contraseña). */
export async function revocarTodasDeUsuario(usuarioId: string): Promise<number> {
  const r = await prisma.sesion.updateMany({ where: { usuarioId, revocadaEn: null }, data: { revocadaEn: new Date() } });
  return r.count;
}
