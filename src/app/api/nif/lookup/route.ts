import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, ipCliente } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { normalizarNif, validarIdentificadorFiscal } from "@/lib/nif";
import { consumirLimite } from "@/lib/rate-limit";
import type { RespuestaNifLookup } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RespuestaVies {
  isValid?: boolean;
  name?: string;
  address?: string;
  viesApproximate?: { name?: string; street?: string; postalCode?: string; city?: string };
}

function limpiar(valor: string | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v || v === "---" || v === "-" || v === "—") return null;
  return v.slice(0, 200);
}

/**
 * Censo VIES (Comisión Europea). VIES enriquece, nunca filtra: un NIF válido no
 * registrado en VIES es lo habitual en autónomos sin operaciones intracomunitarias.
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
    if (!res.ok) return { consultable: false, valido: null, nombre: null, direccion: null };
    const json = (await res.json()) as RespuestaVies;

    const calle = limpiar(json.viesApproximate?.street);
    const cp = limpiar(json.viesApproximate?.postalCode);
    const ciudad = limpiar(json.viesApproximate?.city);
    let direccion: string | null = null;
    if (calle || cp || ciudad) {
      direccion = [calle, [cp, ciudad].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    } else {
      direccion = limpiar(json.address);
    }
    const nombre = limpiar(json.name) ?? limpiar(json.viesApproximate?.name);

    return {
      consultable: true,
      valido: Boolean(json.isValid),
      nombre: json.isValid ? nombre : null,
      direccion: json.isValid ? direccion : null,
    };
  } catch {
    return { consultable: false, valido: null, nombre: null, direccion: null };
  }
}

const Query = z.object({ nif: z.string().trim().min(8).max(20) });

export async function GET(req: NextRequest) {
  try {
    const limite = await consumirLimite(`nif:ip:${ipCliente(req)}`, 30, 900);
    if (!limite.permitido) {
      return error("Demasiadas consultas. Espere unos minutos.", 429, { "Retry-After": String(limite.reintentoEnSeg) });
    }
    const q = Query.safeParse({ nif: req.nextUrl.searchParams.get("nif") ?? "" });
    if (!q.success) return error("Indique un NIF/CIF completo", 400);

    const nif = normalizarNif(q.data.nif);
    const validacion = validarIdentificadorFiscal(nif);
    const respuesta: RespuestaNifLookup = {
      nif,
      formatoValido: validacion.valido,
      motivo: validacion.valido ? null : validacion.motivo,
      vies: { consultable: false, valido: null, nombre: null, direccion: null },
    };
    if (validacion.valido) respuesta.vies = await consultarVies(nif);

    return NextResponse.json(respuesta, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("error", "nif.lookup_error", { motivo: mensajeError(e) });
    return error("No se pudo validar el NIF/CIF", 500);
  }
}
