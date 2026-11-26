import { NextRequest, NextResponse } from "next/server";
import { listarUsuariosAdmin } from "@/lib/admin";
import { conAdmin, numeroPagina, textoParam } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () =>
    NextResponse.json(
      await listarUsuariosAdmin({
        q: textoParam(req, "q"),
        rol: textoParam(req, "rol", 10),
        estado: textoParam(req, "estado", 12),
        gestoriaId: textoParam(req, "gestoriaId", 64),
        pagina: numeroPagina(req),
      })
    )
  );
}
