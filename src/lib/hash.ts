// TicketFiscal AI — Hash de contraseñas y tokens de sesión firmados (sin dependencias)
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const LONGITUD_CLAVE = 64;

export function hashPassword(password: string): string {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(password, sal, LONGITUD_CLAVE).toString("hex");
  return `${sal}:${hash}`;
}

export function verifyPassword(password: string, almacenado: string): boolean {
  const [sal, hash] = almacenado.split(":");
  if (!sal || !hash) return false;
  const calculado = scryptSync(password, sal, LONGITUD_CLAVE);
  const esperado = Buffer.from(hash, "hex");
  if (esperado.length !== calculado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

// ------------------------------------------------------------------ Sesiones

const SECRETO = process.env.SESSION_SECRET ?? "ticketfiscal-demo-hmac-2026";
export const DIAS_SESION = 30;

/**
 * Token de sesión con firma HMAC: `usuarioId.expiraEnMs.firma`.
 * Stateless: cualquier instancia (incluidas lambdas serverless sin estado
 * compartido) puede validarlo sin tocar la base de datos.
 */
export function firmarToken(usuarioId: string, expiraEnMs: number): string {
  const firma = createHmac("sha256", SECRETO).update(`${usuarioId}.${expiraEnMs}`).digest("hex");
  return `${usuarioId}.${expiraEnMs}.${firma}`;
}

export function verificarToken(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [usuarioId, expiraStr, firma] = partes;
  const expiraEnMs = Number(expiraStr);
  if (!usuarioId || !Number.isFinite(expiraEnMs)) return null;
  if (expiraEnMs < Date.now()) return null;
  const esperada = createHmac("sha256", SECRETO).update(`${usuarioId}.${expiraStr}`).digest("hex");
  try {
    const a = Buffer.from(firma, "hex");
    const b = Buffer.from(esperada, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? usuarioId : null;
  } catch {
    return null;
  }
}

export function nuevaExpiracionSesion(): Date {
  return new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);
}
