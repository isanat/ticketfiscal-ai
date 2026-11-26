import { NextRequest, NextResponse } from "next/server";
import { usuarioDesdeRequest } from "@/lib/auth";
import { etiquetaCuenta } from "@/lib/fiscal";
import { listarDocumentos, listarEmpresasDeGestoria } from "@/lib/store";

export const runtime = "nodejs";

/** Formatea un número al estilo contable español: 1234,56 */
function num(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export async function GET(req: NextRequest) {
  try {
    // Solo la gestoría exporta el lote de asientos
    const sesion = await usuarioDesdeRequest(req);
    if (!sesion || sesion.usuario.rol !== "GESTOR") {
      return NextResponse.json(
        { error: "Solo la gestoría puede exportar el lote de asientos" },
        { status: 403 }
      );
    }
    const gestoriaId = sesion.usuario.gestoria?.id;
    if (!gestoriaId) {
      return NextResponse.json({ error: "Cuenta sin gestoría asociada" }, { status: 400 });
    }

    const trimestre = req.nextUrl.searchParams.get("trimestre");
    const empresaId = req.nextUrl.searchParams.get("empresaId");

    const empresas = await listarEmpresasDeGestoria(gestoriaId);
    const nombres = new Map(empresas.map((e) => [e.id, e.nombre]));

    const docs = await listarDocumentos({
      gestoriaId,
      empresaId: empresaId ?? undefined,
      trimestre: trimestre ?? undefined,
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
      "% IVA",
      "Cuota IVA",
      "% IRPF",
      "Retención IRPF",
      "Total",
      "Tipo documento",
      "IVA deducible",
      "Estado",
    ].join(";");

    const filas = docs.map((d) =>
      [
        `"${(nombres.get(d.empresaId) ?? "").replace(/"/g, '""')}"`,
        d.fechaEmision ?? "",
        d.numeroFactura ?? "",
        `"${(d.emisorNombre ?? "").replace(/"/g, '""')}"`,
        d.emisorNif ?? "",
        d.nifEmisorValido === true ? "SÍ" : d.nifEmisorValido === false ? "NO" : "",
        d.cuentaPgc ?? "",
        `"${etiquetaCuenta(d.cuentaPgc)}"`,
        num(d.baseImponible),
        num(d.porcentajeIva),
        num(d.cuotaIva),
        num(d.irpfPorcentaje),
        num(d.irpfImporte),
        num(d.totalFactura),
        d.tipoDocumento,
        d.ivaDeducible ? "SÍ" : "NO",
        d.estado,
      ].join(";")
    );

    const totalBase = docs.reduce((s, d) => s + d.baseImponible, 0);
    const totalIva = docs.reduce((s, d) => s + (d.ivaDeducible ? d.cuotaIva : 0), 0);
    const totalIrpf = docs.reduce((s, d) => s + d.irpfImporte, 0);
    const totalTotal = docs.reduce((s, d) => s + d.totalFactura, 0);

    filas.push("");
    // 17 columnas: totales alineados con Base (9), Cuota IVA (11), IRPF (13) y Total (14)
    filas.push(
      [
        `"TOTALES (${docs.length} asientos)"`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        num(totalBase),
        "",
        num(totalIva),
        "",
        num(totalIrpf),
        num(totalTotal),
        "",
        "",
        "",
      ].join(";")
    );

    // BOM UTF-8 para que Excel/Sage lo abra correctamente
    const csv = "\uFEFF" + [CABECERA, ...filas].join("\r\n");
    const sufijo = empresaId ? (nombres.get(empresaId) ?? "empresa") : "todas";
    const nombre = `ticketfiscal-${sufijo}-${trimestre || "todos"}.csv`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .toLowerCase();

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/documents/export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
