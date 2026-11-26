import { NextRequest, NextResponse } from "next/server";
import { resumenAdmin } from "@/lib/admin";
import { conAdmin } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return conAdmin(req, {}, async () => NextResponse.json(await resumenAdmin(), { headers: { "Cache-Control": "no-store" } }));
}
