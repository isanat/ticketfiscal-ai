// Utilidades HTTP compartidas por las rutas: respuestas de error uniformes,
// validación de origen (CSRF) e IP del cliente para límites de uso.
import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

export function error(mensaje: string, estado: number, cabeceras?: Record<string, string>): NextResponse {
  return NextResponse.json({ error: mensaje }, { status: estado, headers: cabeceras });
}

/** Parsea y valida un cuerpo JSON. Devuelve el dato o una respuesta 400. */
export async function leerJson<T>(
  req: NextRequest,
  esquema: ZodType<T>,
  maxBytes = 16 * 1024
): Promise<{ ok: true; data: T } | { ok: false; respuesta: NextResponse }> {
  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > maxBytes) return { ok: false, respuesta: error("Petición demasiado grande", 413) };
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return { ok: false, respuesta: error("El cuerpo debe ser JSON válido", 400) };
  }
  const r = esquema.safeParse(cuerpo);
  if (!r.success) {
    const primero = r.error.issues[0];
    const campo = primero?.path.join(".") || "datos";
    return { ok: false, respuesta: error(`Revise el campo «${campo}»: ${primero?.message ?? "no válido"}`, 400) };
  }
  return { ok: true, data: r.data };
}

/**
 * Protección CSRF para métodos que cambian estado: si el navegador envía Origin,
 * debe coincidir con el host de la petición. Las cookies son SameSite=Lax, esto es una
 * capa adicional.
 */
export function origenPermitido(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origen = req.headers.get("origin");
  if (!origen) return true; // clientes no navegador (webhooks firman su propia petición)
  const host = req.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

/** IP del cliente según la cabecera que añade Vercel/proxy. */
export function ipCliente(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "desconocida";
}
