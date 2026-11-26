import { NextRequest, NextResponse } from "next/server";
import { crearSesionFirmada, fijarCookieSesion } from "@/lib/auth";
import { hashPassword } from "@/lib/hash";
import { validarIdentificadorFiscal } from "@/lib/nif";
import {
  contextoUsuario,
  crearEmpresa,
  crearGestoria,
  crearUsuario,
  findUsuarioPorEmail,
} from "@/lib/store";

export const runtime = "nodejs";

interface BodyRegistro {
  rol?: "GESTOR" | "CLIENTE";
  nombre?: string;
  email?: string;
  password?: string;
  // GESTOR
  gestoriaNombre?: string;
  gestoriaCif?: string;
  // CLIENTE
  nif?: string;
  empresaNombre?: string;
  direccion?: string;
  ciudad?: string;
  whatsapp?: string;
  gestoriaId?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as BodyRegistro;
    const nombre = (b.nombre ?? "").trim();
    const email = (b.email ?? "").trim().toLowerCase();
    const password = b.password ?? "";

    const errores: string[] = [];
    if (nombre.length < 3) errores.push("Indique su nombre y apellidos");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errores.push("El email no es válido");
    if (password.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres");
    if (b.rol !== "GESTOR" && b.rol !== "CLIENTE") errores.push("Seleccione un tipo de cuenta");
    if (errores.length > 0) {
      return NextResponse.json({ error: errores.join(". ") + "." }, { status: 400 });
    }

    if (await findUsuarioPorEmail(email)) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email" },
        { status: 400 }
      );
    }

    let usuarioId: string;

    if (b.rol === "GESTOR") {
      const gestoriaNombre = (b.gestoriaNombre ?? "").trim();
      if (gestoriaNombre.length < 3) {
        return NextResponse.json(
          { error: "Indique el nombre de la gestoría" },
          { status: 400 }
        );
      }
      const gestoria = await crearGestoria({
        nombre: gestoriaNombre,
        cif: b.gestoriaCif?.trim() || null,
      });
      const usuario = await crearUsuario({
        email,
        passwordHash: hashPassword(password),
        nombre,
        rol: "GESTOR",
        gestoriaId: gestoria.id,
      });
      usuarioId = usuario.id;
    } else {
      const nif = (b.nif ?? "").trim().toUpperCase();
      const validacion = validarIdentificadorFiscal(nif);
      if (!validacion.valido) {
        return NextResponse.json(
          { error: validacion.motivo ?? "NIF/CIF no válido" },
          { status: 400 }
        );
      }
      const empresaNombre = (b.empresaNombre ?? "").trim();
      if (empresaNombre.length < 3) {
        return NextResponse.json(
          { error: "Indique el nombre de la empresa" },
          { status: 400 }
        );
      }
      const empresa = await crearEmpresa({
        nombre: empresaNombre,
        nif: validacion.normalizado ?? nif,
        direccion: b.direccion?.trim() || null,
        ciudad: b.ciudad?.trim() || null,
        whatsapp: b.whatsapp?.trim() || null,
        gestoriaId: b.gestoriaId?.trim() || null,
      });
      const usuario = await crearUsuario({
        email,
        passwordHash: hashPassword(password),
        nombre,
        rol: "CLIENTE",
        empresaId: empresa.id,
      });
      usuarioId = usuario.id;
    }

    const contexto = await contextoUsuario(usuarioId);
    const { token, expiraEn } = crearSesionFirmada(usuarioId);

    const res = NextResponse.json({ usuario: contexto }, { status: 201 });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  } catch (error) {
    console.error("POST /api/auth/registro error:", error);
    return NextResponse.json({ error: "No se pudo crear la cuenta" }, { status: 500 });
  }
}
