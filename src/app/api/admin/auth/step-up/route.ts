import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";
import { consumirLimite } from "@/lib/rate-limit";
import { verificarSegundoFactor } from "@/lib/segundo-factor";
import { marcarSegundoFactor } from "@/lib/sesiones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ codigo: z.string().min(6).max(20), codigoEmail: z.string().max(10).optional() });

/** Reconfirma la identidad antes de una acción sensible (vale 5 minutos). */
export async function POST(req: NextRequest) {
  return conAdmin(req, {}, async (s) => {
    const lim = await consumirLimite(`stepup:${s.usuarioId}`, 8, 900);
    if (!lim.permitido) return error("Demasiados intentos. Espere unos minutos.", 429, { "Retry-After": String(lim.reintentoEnSeg) });
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    if (!(await verificarSegundoFactor(s.usuarioId, cuerpo.data))) return error("Código incorrecto o caducado.", 401);
    await marcarSegundoFactor(s.sesionId);
    return NextResponse.json({ ok: true });
  });
}
