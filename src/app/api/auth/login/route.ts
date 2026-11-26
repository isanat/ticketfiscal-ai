import { NextRequest, NextResponse } from "next/server";
import { crearSesionFirmada, fijarCookieSesion } from "@/lib/auth";
import { verifyPassword } from "@/lib/hash";
import { contextoUsuario, findUsuarioPorEmail } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Indique su email y su contraseña" },
        { status: 400 }
      );
    }

    const usuario = await findUsuarioPorEmail(email);
    if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const { token, expiraEn } = crearSesionFirmada(usuario.id);
    const contexto = await contextoUsuario(usuario.id);
    if (!contexto) throw new Error("No se pudo cargar el contexto del usuario");

    const res = NextResponse.json({ usuario: contexto });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
