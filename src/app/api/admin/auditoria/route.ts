import { NextRequest, NextResponse } from "next/server";
import { listarAuditoriaAdmin } from "@/lib/admin";
import { conAdmin, numeroPagina, textoParam } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fecha = (v?: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () =>
    NextResponse.json(
      await listarAuditoriaAdmin({
        accion: textoParam(req, "accion", 60),
        entidad: textoParam(req, "entidad", 40),
        usuarioId: textoParam(req, "usuarioId", 64),
        desde: fecha(textoParam(req, "desde", 30)),
        hasta: fecha(textoParam(req, "hasta", 30)),
        pagina: numeroPagina(req),
      })
    )
  );
}
