// Contraseñas (scrypt asíncrono, parámetros explícitos) y hash de tokens de sesión.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const PARAMS: { N: number; r: number; p: number; maxmem: number } = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, params: typeof PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, params, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Formato: scrypt$N$r$p$sal$hash (hex). Permite subir parámetros sin romper hashes antiguos. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("hex"), key.toString("hex")].join("$");
}

export async function verifyPassword(password: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = partes;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = await scryptAsync(password, Buffer.from(saltHex, "hex"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

/** Hash SHA-256 en hex. Se usa para guardar tokens de sesión sin almacenar el token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token opaco de 256 bits para la cookie de sesión. */
export function nuevoToken(): string {
  return randomBytes(32).toString("base64url");
}
