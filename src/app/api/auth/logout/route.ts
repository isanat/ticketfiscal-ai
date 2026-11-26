import { NextResponse } from "next/server";
import { limpiarCookieSesion, COOKIE_SESION } from "@/lib/auth";
import { borrarSesion } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const cabecera = req.headers.get("cookie") ?? "";
    const token = cabecera
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_SESION}=`))
      ?.split("=")[1];
    if (token) await borrarSesion(token);

    const res = NextResponse.json({ ok: true });
    limpiarCookieSesion(res);
    return res;
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json({ error: "No se pudo cerrar la sesión" }, { status: 500 });
  }
}
