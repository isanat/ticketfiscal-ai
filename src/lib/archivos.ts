// Validación de justificantes subidos: tipo real por firma binaria (no por extensión o
// por el MIME declarado por el cliente) y tamaño máximo.

export const MAX_BYTES_JUSTIFICANTE = 3 * 1024 * 1024; // 3 MB (límite de cuerpo de Vercel con base64)

export type MimeJustificante = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function detectarMime(buf: Buffer): MimeJustificante | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

/**
 * Acepta una data URL o base64 puro y devuelve los bytes validados.
 * Errores con mensaje para el usuario; nunca lanza por datos externos.
 */
export function decodificarJustificante(
  entrada: string,
  mimeDeclarado?: string
): { ok: true; bytes: Buffer; mime: MimeJustificante } | { ok: false; motivo: string } {
  let base64 = entrada.trim();
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(base64);
  if (m) base64 = m[2];
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) return { ok: false, motivo: "El archivo no está codificado en base64." };
  // Tamaño binario estimado antes de decodificar (evita asignar memoria innecesaria).
  const estimado = Math.floor((base64.length * 3) / 4);
  if (estimado > MAX_BYTES_JUSTIFICANTE) {
    return { ok: false, motivo: "El justificante supera el tamaño máximo de 3 MB." };
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { ok: false, motivo: "El archivo está vacío." };
  const mime = detectarMime(bytes);
  if (!mime) return { ok: false, motivo: "Formato no admitido. Use JPG, PNG, WEBP o PDF." };
  if (mimeDeclarado && mimeDeclarado !== mime && !(mimeDeclarado === "image/jpg" && mime === "image/jpeg")) {
    return { ok: false, motivo: "El tipo del archivo no coincide con su contenido." };
  }
  return { ok: true, bytes, mime };
}
