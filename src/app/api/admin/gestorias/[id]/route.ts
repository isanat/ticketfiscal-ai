import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cambiarEstadoGestoria, detalleGestoria } from "@/lib/admin";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conAdmin(req, {}, async () => {
    const g = await detalleGestoria((await params).id);
    return g ? NextResponse.json(g) : error("Gestoría no encontrada", 404);
  });
}

const Body = z.object({ estado: z.enum(["ACTIVA", "SUSPENDIDA"]), motivo: z.string().trim().max(300).optional() });

/** Aprueba, suspende o reactiva una gestoría. Al suspender se cierran sus sesiones. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    if (cuerpo.data.estado === "SUSPENDIDA" && (cuerpo.data.motivo ?? "").length < 5) return error("Indique el motivo de la suspensión.", 400);
    const ok = await cambiarEstadoGestoria((await params).id, cuerpo.data.estado, cuerpo.data.motivo ?? null, s.usuarioId);
    return ok ? NextResponse.json({ ok: true }) : error("Gestoría no encontrada", 404);
  });
}
