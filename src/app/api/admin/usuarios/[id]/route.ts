import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cambiarEstadoUsuario } from "@/lib/admin";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ estado: z.enum(["ACTIVA", "SUSPENDIDA"]), motivo: z.string().trim().max(300).optional() });

/** Suspende o reactiva una cuenta (no se borra: al volver no hace falta un alta nueva). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    if (cuerpo.data.estado === "SUSPENDIDA" && (cuerpo.data.motivo ?? "").length < 5) return error("Indique el motivo de la suspensión.", 400);
    const r = await cambiarEstadoUsuario((await params).id, cuerpo.data.estado, cuerpo.data.motivo ?? null, s.usuarioId);
    if (r === "no_existe") return error("Usuario no encontrado", 404);
    if (r === "prohibido") return error("No se puede suspender a un administrador ni a uno mismo.", 403);
    return NextResponse.json({ ok: true });
  });
}
