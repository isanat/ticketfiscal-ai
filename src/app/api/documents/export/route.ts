import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirRol, sesionDeRequest } from "@/lib/auth";
import { celdaNumero, celdaTexto } from "@/lib/csv";
import { error } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { aCentimos, aEuros, redondearPct } from "@/lib/money";
import { etiquetaCuenta } from "@/lib/fiscal";
import { listarDocumentos, listarEmpresasDeGestoria } from "@/lib/store";
import type { Documento } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Query = z.object({
  trimestre: z.string().regex(/^[1-4]T\d{4}$/).optional(),
  empresaId: z.string().max(64).optional(),
  soloAprobados: z.enum(["1", "0"]).optional(),
});

const CABECERA = [
  "Empresa",
  "Fecha",
  "Nº Factura",
  "Emisor",
  "NIF Emisor",
  "NIF emisor válido",
  "Cuenta PGC",
  "Descripción cuenta",
  "Base imponible",
  "% IVA efectivo",
  "Cuota IVA",
  "Desglose IVA",
  "% IRPF",
  "Retención IRPF",
  "Total",
  "Tipo documento",
  "IVA deducible",
  "Estado",
  "Revisión",
  "Trimestre",
];

function desgloseTexto(d: Documento): string {
  return d.desglose.map((l) => `${l.porcentajeIva} %: ${celdaNumero(l.baseImponible)} / ${celdaNumero(l.cuotaIva)}`).join(" | ");
}

/** Lote de asientos (CSV). Solo gestoría. Por defecto incluye todo lo no retirado. */
export async function GET(req: NextRequest) {
  try {
    const sesion = exigirRol(await sesionDeRequest(req), "GESTOR");
    if (!sesion.ok) return sesion.respuesta;
    const gestoriaId = sesion.sesion.usuario.gestoria?.id;
    if (!gestoriaId) return error("Cuenta sin gestoría asociada", 400);

    const q = Query.safeParse({
      trimestre: req.nextUrl.searchParams.get("trimestre") ?? undefined,
      empresaId: req.nextUrl.searchParams.get("empresaId") ?? undefined,
      soloAprobados: req.nextUrl.searchParams.get("soloAprobados") ?? undefined,
    });
    if (!q.success) return error("Filtros no válidos", 400);

    const empresas = await listarEmpresasDeGestoria(gestoriaId);
    const nombres = new Map(empresas.map((e) => [e.id, e.nombre]));
    const docs = await listarDocumentos({
      gestoriaId,
      empresaId: q.data.empresaId,
      trimestre: q.data.trimestre,
      soloAprobados: q.data.soloAprobados === "1",
    });

    // Totales en céntimos enteros: sin acumulación de error de coma flotante.
    let baseC = 0;
    let ivaC = 0;
    let irpfC = 0;
    let totalC = 0;
    const filas = docs.map((d) => {
      baseC += aCentimos(d.baseImponible);
      if (d.ivaDeducible) ivaC += aCentimos(d.cuotaIva);
      irpfC += aCentimos(d.irpfImporte);
      totalC += aCentimos(d.totalFactura);
      return [
        celdaTexto(nombres.get(d.empresaId) ?? ""),
        d.fechaEmision ?? "",
        celdaTexto(d.numeroFactura),
        celdaTexto(d.emisorNombre),
        celdaTexto(d.emisorNif),
        d.nifEmisorValido === true ? "SÍ" : d.nifEmisorValido === false ? "NO" : "",
        celdaTexto(d.cuentaPgc),
        celdaTexto(etiquetaCuenta(d.cuentaPgc)),
        celdaNumero(d.baseImponible),
        celdaNumero(redondearPct(d.porcentajeIva)),
        celdaNumero(d.cuotaIva),
        celdaTexto(desgloseTexto(d)),
        celdaNumero(d.irpfPorcentaje),
        celdaNumero(d.irpfImporte),
        celdaNumero(d.totalFactura),
        d.tipoDocumento,
        d.ivaDeducible ? "SÍ" : "NO",
        d.estado,
        d.revision,
        d.trimestre ?? "",
      ].join(";");
    });

    const vacias = (n: number) => Array(n).fill("").join(";");
    const pie = [
      `"TOTALES (${docs.length} documentos)"`,
      vacias(7),
      celdaNumero(aEuros(baseC)),
      "",
      "",
      "",
      "",
      celdaNumero(aEuros(irpfC)),
      "",
      "",
      "",
      "",
    ].join(";");
    const pieIva = `"IVA deducible total";${celdaNumero(aEuros(ivaC))};"Total facturas";${celdaNumero(aEuros(totalC))}`;

    // BOM UTF-8 para que Excel abra bien los acentos; CRLF como exigen las importaciones contables.
    const csv = "﻿" + [CABECERA.join(";"), ...filas, "", pie, pieIva].join("\r\n") + "\r\n";
    const sufijo = q.data.empresaId ? (nombres.get(q.data.empresaId) ?? "empresa") : "todas";
    const nombre = `ticketfiscal-${sufijo}-${q.data.trimestre ?? "todos"}.csv`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .toLowerCase();

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    log("error", "export.error", { motivo: mensajeError(e) });
    return error("No se pudo generar el lote de asientos", 500);
  }
}
