import { NextRequest, NextResponse } from "next/server";
import { estadoIntegraciones } from "@/lib/admin";
import { conAdmin } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Solo indica si cada integración está configurada. Nunca devuelve valores ni claves. */
export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () => NextResponse.json({ integraciones: estadoIntegraciones() }, { headers: { "Cache-Control": "no-store" } }));
}
