import { NextRequest, NextResponse } from "next/server";
import { fijarCookieSesion, sesionDeRequest } from "@/lib/auth";
import { error, origenPermitido } from "@/lib/http";
import { datosDeToken, revocarSesionPorId } from "@/lib/sesiones";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_VUELTA = "tf_admin_vuelta";

/** Cierra la sesión de soporte y restaura la sesión del administrador. */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req)) return error("Origen no permitido", 403);
  const sesion = await sesionDeRequest(req);
  if (!sesion?.soporteAdminId) return error("No hay una sesión de soporte activa", 409);

  await revocarSesionPorId(sesion.sesionId);
  await registrarAuditoria({ usuarioId: sesion.soporteAdminId, accion: "soporte.fin", entidad: "Usuario", entidadId: sesion.usuarioId });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_VUELTA, value: "", path: "/", maxAge: 0 });
  // Solo se restaura la sesión del administrador si sigue siendo válida y es suya.
  const vuelta = req.cookies.get(COOKIE_VUELTA)?.value;
  const datos = vuelta ? await datosDeToken(vuelta) : null;
  if (vuelta && datos && datos.usuarioId === sesion.soporteAdminId) {
    fijarCookieSesion(res, vuelta, datos.expiraEn);
  } else {
    res.cookies.set({ name: "tf_sesion", value: "", path: "/", maxAge: 0 });
  }
  return res;
}
