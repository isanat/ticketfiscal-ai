// TOTP (RFC 6238, HMAC-SHA1, 30 s, 6 dígitos) compatible con Google Authenticator, Authy y 1Password.
// Implementación propia y mínima, verificada contra los vectores de prueba de la RFC.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const PERIODO_S = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decode(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpio) {
    const i = ALFABETO.indexOf(c);
    if (i === -1) throw new Error("Base32 no válido");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto de 160 bits, en base32. */
export function nuevoSecreto(): string {
  return base32Encode(randomBytes(20));
}

export function pasoDe(ahoraMs: number = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / PERIODO_S);
}

/** Código de 6 dígitos para un paso (intervalo de 30 s). */
export function codigoTotp(secretoBase32: string, paso: number, digitos = 6): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = createHmac("sha1", base32Decode(secretoBase32)).update(contador).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digitos).padStart(digitos, "0");
}

/**
 * Verifica un código con tolerancia de ±1 intervalo (desfase de reloj).
 * Devuelve el paso aceptado, o null. Rechaza pasos ya usados (anti-reutilización).
 */
export function verificarTotp(
  secretoBase32: string,
  codigo: string,
  opciones: { ventana?: number; ultimoPaso?: number; ahoraMs?: number } = {}
): number | null {
  const limpio = codigo.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) return null;
  const ventana = opciones.ventana ?? 1;
  const actual = pasoDe(opciones.ahoraMs);
  const recibido = Buffer.from(limpio);
  for (let p = actual - ventana; p <= actual + ventana; p++) {
    if (p <= (opciones.ultimoPaso ?? 0)) continue;
    const esperado = Buffer.from(codigoTotp(secretoBase32, p));
    if (esperado.length === recibido.length && timingSafeEqual(esperado, recibido)) return p;
  }
  return null;
}

/** URI otpauth:// que lee la app autenticadora al escanear el QR. */
export function uriOtpauth(secretoBase32: string, cuenta: string, emisor = "TicketFiscal AI"): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  return `otpauth://totp/${etiqueta}?secret=${secretoBase32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=${PERIODO_S}`;
}
