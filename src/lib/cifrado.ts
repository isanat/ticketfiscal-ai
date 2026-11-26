// Cifrado simétrico AES-256-GCM para secretos guardados en base de datos (p. ej. el secreto TOTP).
// La clave vive en ADMIN_ENCRYPTION_KEY (Vercel), nunca en la base de datos.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./env";

function clave(): Buffer {
  const b64 = config().ADMIN_ENCRYPTION_KEY;
  if (!b64) throw new Error("ADMIN_ENCRYPTION_KEY no está configurada");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("ADMIN_ENCRYPTION_KEY debe ser de 32 bytes en base64");
  return k;
}

/** Formato: v1.iv.tag.cifrado (base64url). */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), datos.toString("base64url")].join(".");
}

export function descifrar(token: string): string {
  const [v, iv, tag, datos] = token.split(".");
  if (v !== "v1" || !iv || !tag || !datos) throw new Error("Formato de secreto cifrado no válido");
  const d = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(datos, "base64url")), d.final()]).toString("utf8");
}
