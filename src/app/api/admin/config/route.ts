import { NextRequest, NextResponse } from "next/server";
import { conAdmin } from "@/lib/admin-http";
import { config } from "@/lib/env";
import { ESQUEMA_CONFIG, guardarConfiguracion, leerConfiguracion } from "@/lib/configuracion";
import { error, leerJson } from "@/lib/http";
import { registrarAuditoria } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () => {
    const guardada = await leerConfiguracion(true);
    const c = config();
    return NextResponse.json({
      valores: {
        limiteIaDiarioEmpresa: guardada.limiteIaDiarioEmpresa ?? c.LIMITE_IA_DIARIO_EMPRESA,
        proveedorVision: guardada.proveedorVision ?? c.VISION_PROVIDER,
        registroGestoriasAbierto: guardada.registroGestoriasAbierto ?? true,
        avisoGlobal: guardada.avisoGlobal ?? "",
      },
      personalizados: Object.keys(guardada),
    });
  });
}

/** Cambia ajustes no secretos. Acción sensible: exige segundo factor reciente. */
export async function PUT(req: NextRequest) {
  return conAdmin(req, { stepUp: true }, async (s) => {
    const cuerpo = await leerJson(req, ESQUEMA_CONFIG);
    if (!cuerpo.ok) return cuerpo.respuesta;
    if (Object.keys(cuerpo.data).length === 0) return error("Indique al menos un ajuste.", 400);
    const claves = await guardarConfiguracion(cuerpo.data, s.usuarioId);
    await registrarAuditoria({ usuarioId: s.usuarioId, accion: "config.actualizada", entidad: "Configuracion", entidadId: claves.join(","), detalle: cuerpo.data as never });
    return NextResponse.json({ ok: true, claves });
  });
}
