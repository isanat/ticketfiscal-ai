import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actualizarEmpresaAdmin } from "@/lib/admin";
import { conAdmin } from "@/lib/admin-http";
import { error, leerJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    estado: z.enum(["APROBADA", "RECHAZADA", "SUSPENDIDA"]).optional(),
    gestoriaId: z.string().max(64).nullable().optional(),
    motivo: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.estado !== undefined || b.gestoriaId !== undefined, "Indique un cambio");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    if (cuerpo.data.estado === "SUSPENDIDA" && (cuerpo.data.motivo ?? "").length < 5) return error("Indique el motivo de la suspensión.", 400);
    const r = await actualizarEmpresaAdmin((await params).id, cuerpo.data, s.usuarioId);
    if (r === "no_existe") return error("Empresa no encontrada", 404);
    if (r === "gestoria_no_existe") return error("La gestoría indicada no existe", 400);
    return NextResponse.json({ ok: true });
  });
}
