// Guarda de acceso para las rutas de administración.
//  · Solo rol ADMIN; cualquier otro recibe 404 (no se revela que la ruta existe).
//  · La sesión exige segundo factor verificado (salvo rutas de alta del TOTP: permitirParcial).
//  · Las acciones sensibles exigen "step-up": segundo factor verificado en los últimos 5 minutos.
import { NextRequest, NextResponse } from "next/server";
import { sesionDeRequest, type SesionActiva } from "./auth";
import { origenPermitido } from "./http";

export const VENTANA_STEP_UP_MS = 5 * 60 * 1000;

export type ResultadoAdmin = { ok: true; sesion: SesionActiva } | { ok: false; respuesta: NextResponse };

const no = (estado: number, error: string, codigo?: string): ResultadoAdmin => ({
  ok: false,
  respuesta: NextResponse.json({ error, ...(codigo ? { codigo } : {}) }, { status: estado }),
});

export async function exigirAdmin(
  req: NextRequest,
  opciones: { stepUp?: boolean; permitirParcial?: boolean } = {}
): Promise<ResultadoAdmin> {
  if (!origenPermitido(req)) return no(403, "Origen no permitido");
  const sesion = await sesionDeRequest(req);
  if (!sesion || sesion.usuario.rol !== "ADMIN") {
    return { ok: false, respuesta: new NextResponse("Not found", { status: 404 }) };
  }
  if (!opciones.permitirParcial && !sesion.totpVerificadoEn) {
    return no(401, "Falta verificar el segundo factor.", "TOTP_REQUERIDO");
  }
  if (opciones.stepUp) {
    const t = sesion.totpVerificadoEn?.getTime() ?? 0;
    if (Date.now() - t > VENTANA_STEP_UP_MS) {
      return no(403, "Confirme de nuevo su identidad para continuar.", "STEP_UP");
    }
  }
  return { ok: true, sesion };
}
