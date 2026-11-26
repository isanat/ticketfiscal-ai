import { NextRequest, NextResponse } from "next/server";
import { listarEmpresasAdmin } from "@/lib/admin";
import { conAdmin, numeroPagina, textoParam } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () =>
    NextResponse.json(
      await listarEmpresasAdmin({ q: textoParam(req, "q"), estado: textoParam(req, "estado", 12), gestoriaId: textoParam(req, "gestoriaId", 64), pagina: numeroPagina(req) })
    )
  );
}
