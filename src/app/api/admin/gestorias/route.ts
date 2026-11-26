import { NextRequest, NextResponse } from "next/server";
import { listarGestoriasAdmin } from "@/lib/admin";
import { conAdmin, numeroPagina, textoParam } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () =>
    NextResponse.json(await listarGestoriasAdmin({ q: textoParam(req, "q"), estado: textoParam(req, "estado", 20), pagina: numeroPagina(req) }))
  );
}
