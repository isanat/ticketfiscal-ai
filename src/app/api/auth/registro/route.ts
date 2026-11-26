import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fijarCookieSesion } from "@/lib/auth";
import { error, ipCliente, leerJson, origenPermitido } from "@/lib/http";
import { hashPassword } from "@/lib/hash";
import { log, mensajeError } from "@/lib/logger";
import { validarIdentificadorFiscal } from "@/lib/nif";
import { consumirLimite } from "@/lib/rate-limit";
import { crearSesion } from "@/lib/sesiones";
import { conflictoEmpresa, contextoUsuarioPorId, findUsuarioPorEmail, listarGestorias, registrarCliente, registrarGestor } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const comun = {
  nombre: z.string().trim().min(3, "Indique su nombre y apellidos").max(120),
  email: z.email("El email no es válido").max(200).transform((v) => v.trim().toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "La contraseña debe incluir letras y números"),
};

const Body = z.discriminatedUnion("rol", [
  z.object({
    rol: z.literal("GESTOR"),
    ...comun,
    gestoriaNombre: z.string().trim().min(3, "Indique el nombre de la gestoría").max(160),
    gestoriaCif: textoOpcional(20),
  }),
  z.object({
    rol: z.literal("CLIENTE"),
    ...comun,
    nif: z.string().trim().min(8, "Indique un NIF/CIF completo").max(20),
    empresaNombre: z.string().trim().min(3, "Indique el nombre de la empresa").max(160),
    direccion: textoOpcional(200),
    ciudad: textoOpcional(100),
    whatsapp: textoOpcional(20),
    gestoriaId: textoOpcional(64),
  }),
]);

function campoDuplicado(e: unknown): string | null {
  if (typeof e !== "object" || e === null || (e as { code?: string }).code !== "P2002") return null;
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  const texto = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (texto.includes("email")) return "Ya existe una cuenta con ese email.";
  if (texto.includes("nif")) return "Ya existe una empresa registrada con ese NIF/CIF. Contacte con su gestoría.";
  if (texto.includes("whatsapp")) return "Ese número de WhatsApp ya está asociado a otra empresa.";
  return "Ya existe un registro con esos datos.";
}

export async function POST(req: NextRequest) {
  try {
    if (!origenPermitido(req)) return error("Origen no permitido", 403);
    const limite = await consumirLimite(`registro:ip:${ipCliente(req)}`, 10, 3600);
    if (!limite.permitido) {
      return error("Demasiados registros desde esta conexión. Inténtelo más tarde.", 429, {
        "Retry-After": String(limite.reintentoEnSeg),
      });
    }
    const cuerpo = await leerJson(req, Body);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const b = cuerpo.data;

    if (await findUsuarioPorEmail(b.email)) {
      return error("Ya existe una cuenta con ese email.", 409);
    }
    const passwordHash = await hashPassword(b.password);

    let usuarioId: string;
    if (b.rol === "GESTOR") {
      usuarioId = await registrarGestor({
        nombre: b.nombre,
        email: b.email,
        passwordHash,
        gestoriaNombre: b.gestoriaNombre,
        gestoriaCif: b.gestoriaCif ? b.gestoriaCif.toUpperCase() : null,
      });
    } else {
      const nif = validarIdentificadorFiscal(b.nif);
      if (!nif.valido || !nif.normalizado) {
        return error(nif.motivo ?? "NIF/CIF no válido", 400);
      }
      if (b.gestoriaId) {
        const existe = (await listarGestorias()).some((g) => g.id === b.gestoriaId);
        if (!existe) return error("La gestoría seleccionada no existe", 400);
      }
      const whatsapp = b.whatsapp ? b.whatsapp.replace(/\D/g, "") : null;
      if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) {
        return error("El número de WhatsApp debe incluir el prefijo de país (p. ej. 34600111222)", 400);
      }
      const conflicto = await conflictoEmpresa(nif.normalizado, whatsapp);
      if (conflicto) return error(conflicto, 409);
      usuarioId = await registrarCliente({
        nombre: b.nombre,
        email: b.email,
        passwordHash,
        empresa: {
          nombre: b.empresaNombre,
          nif: nif.normalizado,
          direccion: b.direccion,
          ciudad: b.ciudad,
          whatsapp,
        },
        gestoriaId: b.gestoriaId,
      });
    }

    const { token, expiraEn } = await crearSesion(usuarioId);
    const contexto = await contextoUsuarioPorId(usuarioId);
    const res = NextResponse.json({ usuario: contexto }, { status: 201 });
    fijarCookieSesion(res, token, expiraEn);
    return res;
  } catch (e) {
    const duplicado = campoDuplicado(e);
    if (duplicado) return error(duplicado, 409);
    log("error", "auth.registro_error", { motivo: mensajeError(e) });
    return error("No se pudo crear la cuenta", 500);
  }
}

