// TicketFiscal AI — Hash de contraseñas (scrypt, sin dependencias externas)
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

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

export function nuevoTokenSesion(): string {
  return randomBytes(48).toString("hex");
}
