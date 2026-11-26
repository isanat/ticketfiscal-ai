import { NextRequest, NextResponse } from "next/server";
import { error, ipCliente } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { consumirLimite } from "@/lib/rate-limit";
import { listarGestorias } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista pública de gestorías (solo id y nombre) para el alta de empresas. */
export async function GET(req: NextRequest) {
  try {
    const limite = await consumirLimite(`gestorias:ip:${ipCliente(req)}`, 120, 900);
    if (!limite.permitido) {
      return error("Demasiadas consultas", 429, { "Retry-After": String(limite.reintentoEnSeg) });
    }
    const gestorias = await listarGestorias();
    return NextResponse.json({ gestorias }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    log("error", "gestorias.error", { motivo: mensajeError(e) });
    return error("No se pudieron listar las gestorías", 500);
  }
}
