import { NextRequest, NextResponse } from "next/server";
import { normalizarNif, validarIdentificadorFiscal } from "@/lib/nif";
import type { RespuestaNifLookup } from "@/lib/types";

export const runtime = "nodejs";

interface RespuestaVies {
  isValid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
  viesApproximate?: {
    name?: string;
    street?: string;
    postalCode?: string;
    city?: string;
  };
}

function limpiar(valor: string | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v || v === "---" || v === "-" || v === "—") return null;
  return v;
}

/**
 * Consulta el censo VIES de la Comisión Europea (REST, sin clave).
 * VIES enriquece, nunca filtra: un NIF válido no registrado en VIES es lo
 * habitual en autónomos sin operaciones intracomunitarias.
 */
async function consultarVies(nif: string): Promise<RespuestaNifLookup["vies"]> {
  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/ES/vat/${encodeURIComponent(nif)}`,
      {
        signal: AbortSignal.timeout(9000),
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return { consultable: false, valido: null, nombre: null, direccion: null };
    }
    const json = (await res.json()) as RespuestaVies;

    let nombre = limpiar(json.name);
    let calle = limpiar(json.viesApproximate?.street);
    const cp = limpiar(json.viesApproximate?.postalCode);
    const ciudad = limpiar(json.viesApproximate?.city);
    let direccion: string | null = null;
    if (calle || cp || ciudad) {
      direccion = [calle, [cp, ciudad].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    } else {
      direccion = limpiar(json.address);
    }
    if (!nombre) nombre = limpiar(json.viesApproximate?.name);

    return {
      consultable: true,
      valido: Boolean(json.isValid),
      nombre: json.isValid ? nombre : null,
      direccion: json.isValid ? direccion : null,
    };
  } catch {
    // El servicio VIES cae con cierta frecuencia: no debe bloquear el alta.
    return { consultable: false, valido: null, nombre: null, direccion: null };
  }
}

export async function GET(req: NextRequest) {
  try {
    const nifParam = req.nextUrl.searchParams.get("nif") ?? "";
    const nif = normalizarNif(nifParam);
    if (nif.length < 8) {
      return NextResponse.json(
        { error: "Indique un NIF/CIF completo" },
        { status: 400 }
      );
    }

    const validacion = validarIdentificadorFiscal(nif);
    const respuesta: RespuestaNifLookup = {
      nif,
      formatoValido: validacion.valido,
      motivo: validacion.valido ? null : validacion.motivo,
      vies: { consultable: false, valido: null, nombre: null, direccion: null },
    };

    if (validacion.valido) {
      respuesta.vies = await consultarVies(nif);
    }

    return NextResponse.json(respuesta, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/nif/lookup error:", error);
    return NextResponse.json({ error: "No se pudo validar el NIF/CIF" }, { status: 500 });
  }
}
