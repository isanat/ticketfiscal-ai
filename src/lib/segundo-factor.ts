// Segundo factor del administrador: alta de TOTP, verificación, códigos de recuperación
// y, cuando está activo, código adicional por e-mail.
import { createHash, randomBytes } from "node:crypto";
import { cifrar, descifrar } from "./cifrado";
import { emailSegundoFactorActivo, verificarCodigoEmail } from "./email-codigo";
import { prisma } from "./prisma";
import { nuevoSecreto, uriOtpauth, verificarTotp } from "./totp";

export type EstadoTotp = "sin_configurar" | "pendiente" | "activo";

const hashRespaldo = (c: string) => createHash("sha256").update(c.toLowerCase().replace(/\s|-/g, "")).digest("hex");

export async function estadoTotp(usuarioId: string): Promise<EstadoTotp> {
  const t = await prisma.totpAdmin.findUnique({ where: { usuarioId }, select: { activado: true } });
  if (!t) return "sin_configurar";
  return t.activado ? "activo" : "pendiente";
}

/** Crea (o reemplaza si aún no está activo) el secreto. Devuelve el secreto y la URI para el QR. */
export async function iniciarEnrolamiento(usuarioId: string, cuenta: string): Promise<{ secreto: string; uri: string } | null> {
  const previo = await prisma.totpAdmin.findUnique({ where: { usuarioId }, select: { activado: true } });
  if (previo?.activado) return null; // ya activo: no se puede reemplazar sin pasar por la administración
  const secreto = nuevoSecreto();
  await prisma.totpAdmin.upsert({
    where: { usuarioId },
    update: { secretoCifrado: cifrar(secreto), ultimoPaso: BigInt(0) },
    create: { usuarioId, secretoCifrado: cifrar(secreto) },
  });
  return { secreto, uri: uriOtpauth(secreto, cuenta) };
}

/** Confirma el alta con un código y devuelve 8 códigos de recuperación (se muestran una sola vez). */
export async function activarEnrolamiento(usuarioId: string, codigo: string): Promise<string[] | null> {
  const t = await prisma.totpAdmin.findUnique({ where: { usuarioId } });
  if (!t || t.activado) return null;
  const paso = verificarTotp(descifrar(t.secretoCifrado), codigo);
  if (paso === null) return null;
  const codigos = Array.from({ length: 8 }, () => {
    const h = randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
  await prisma.$transaction([
    prisma.totpAdmin.update({ where: { usuarioId }, data: { activado: true, ultimoPaso: BigInt(paso) } }),
    prisma.codigoRespaldoAdmin.deleteMany({ where: { usuarioId } }),
    prisma.codigoRespaldoAdmin.createMany({ data: codigos.map((c) => ({ usuarioId, hash: hashRespaldo(c) })) }),
  ]);
  return codigos;
}

async function verificarTotpActivo(usuarioId: string, codigo: string): Promise<boolean> {
  const t = await prisma.totpAdmin.findUnique({ where: { usuarioId } });
  if (!t?.activado) return false;
  const paso = verificarTotp(descifrar(t.secretoCifrado), codigo, { ultimoPaso: Number(t.ultimoPaso) });
  if (paso === null) return false;
  // Actualización condicional: dos peticiones simultáneas con el mismo código no pasan las dos.
  const r = await prisma.totpAdmin.updateMany({ where: { usuarioId, ultimoPaso: { lt: BigInt(paso) } }, data: { ultimoPaso: BigInt(paso) } });
  return r.count === 1;
}

async function verificarRespaldo(usuarioId: string, codigo: string): Promise<boolean> {
  if (!/^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(codigo.trim())) return false;
  const r = await prisma.codigoRespaldoAdmin.updateMany({
    where: { usuarioId, hash: hashRespaldo(codigo), usadoEn: null },
    data: { usadoEn: new Date() },
  });
  return r.count === 1;
}

/**
 * Verifica el segundo factor completo: TOTP (o código de recuperación) y, si el e-mail está activo,
 * también el código recibido por e-mail.
 */
export async function verificarSegundoFactor(
  usuarioId: string,
  entrada: { codigo: string; codigoEmail?: string }
): Promise<boolean> {
  const limpio = entrada.codigo.trim();
  const primero = /^\d[\d\s]{5,}$/.test(limpio) ? await verificarTotpActivo(usuarioId, limpio) : await verificarRespaldo(usuarioId, limpio);
  if (!primero) return false;
  if (emailSegundoFactorActivo()) {
    return verificarCodigoEmail(usuarioId, "admin", entrada.codigoEmail ?? "");
  }
  return true;
}
