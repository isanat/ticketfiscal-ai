import { NextRequest, NextResponse } from "next/server";
import { listarSesionesAdmin } from "@/lib/admin";
import { conAdmin, numeroPagina, textoParam } from "@/lib/admin-http";
import { error } from "@/lib/http";
import { revocarSesionPorId } from "@/lib/sesiones";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () =>
    NextResponse.json(await listarSesionesAdmin({ usuarioId: textoParam(req, "usuarioId", 64), pagina: numeroPagina(req) }))
  );
}

/** Revoca una sesión concreta (cierra el acceso de ese dispositivo). */
export async function DELETE(req: NextRequest) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const id = textoParam(req, "id", 64);
    if (!id) return error("Indique la sesión", 400);
    const ok = await revocarSesionPorId(id);
    if (!ok) return error("Sesión no encontrada", 404);
    await registrarAuditoria({ usuarioId: s.usuarioId, accion: "sesion.revocada", entidad: "Sesion", entidadId: id });
    return NextResponse.json({ ok: true });
  });
}
