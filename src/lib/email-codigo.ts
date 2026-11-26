// Código de un solo uso por e-mail (segundo factor adicional del administrador).
// Desactivado mientras EMAIL_2FA_ACTIVO no sea "true" (requiere dominio verificado en Resend).
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "./env";
import { prisma } from "./prisma";

const VIGENCIA_MIN = 10;
const MAX_INTENTOS = 5;

const hashCodigo = (c: string) => createHash("sha256").update(c).digest("hex");

export function emailSegundoFactorActivo(): boolean {
  const c = config();
  return c.EMAIL_2FA_ACTIVO && Boolean(c.RESEND_API_KEY && c.EMAIL_REMITENTE);
}

async function enviar(destino: string, codigo: string, motivo: string): Promise<boolean> {
  const c = config();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: c.EMAIL_REMITENTE,
      to: [destino],
      subject: "Código de verificación de TicketFiscal AI",
      text: `Su código de verificación es ${codigo}. Caduca en ${VIGENCIA_MIN} minutos.\n\nMotivo: ${motivo}\n\nSi no lo ha solicitado, cambie su contraseña y avise a soporte.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok;
}

/** Genera, guarda (solo el hash) y envía un código. Invalida los anteriores del mismo propósito. */
export async function enviarCodigoEmail(usuarioId: string, email: string, proposito: string, motivo: string): Promise<boolean> {
  if (!emailSegundoFactorActivo()) return false;
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.codigoEmail.updateMany({ where: { usuarioId, proposito, usadoEn: null }, data: { usadoEn: new Date() } });
  await prisma.codigoEmail.create({
    data: { usuarioId, proposito, hash: hashCodigo(codigo), expiraEn: new Date(Date.now() + VIGENCIA_MIN * 60_000) },
  });
  return enviar(email, codigo, motivo);
}

export async function verificarCodigoEmail(usuarioId: string, proposito: string, codigo: string): Promise<boolean> {
  if (!/^\d{6}$/.test(codigo)) return false;
  const fila = await prisma.codigoEmail.findFirst({
    where: { usuarioId, proposito, usadoEn: null, expiraEn: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!fila || fila.intentos >= MAX_INTENTOS) return false;
  const a = Buffer.from(fila.hash);
  const b = Buffer.from(hashCodigo(codigo));
  const ok = a.length === b.length && timingSafeEqual(a, b);
  await prisma.codigoEmail.update({
    where: { id: fila.id },
    data: ok ? { usadoEn: new Date() } : { intentos: { increment: 1 } },
  });
  return ok;
}
