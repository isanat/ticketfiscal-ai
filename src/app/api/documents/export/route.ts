import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { etiquetaCuenta } from "@/lib/fiscal";

export const runtime = "nodejs";

/** Formatea un número al estilo contable español: 1234,56 */
function num(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export async function GET(req: NextRequest) {
  try {
    const trimestre = req.nextUrl.searchParams.get("trimestre");
    const docs = await db.documento.findMany({
      where: trimestre ? { trimestre } : undefined,
      orderBy: { fechaEmision: "asc" },
    });

    const CABECERA = [
      "Fecha",
      "Nº Factura",
      "Emisor",
      "NIF Emisor",
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
        d.fechaEmision ?? "",
        d.numeroFactura ?? "",
        `"${(d.emisorNombre ?? "").replace(/"/g, '""')}"`,
        d.emisorNif ?? "",
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
    filas.push(`"TOTALES (${docs.length} documentos)";;;;;;${num(totalBase)};;${num(totalIva)};${num(totalIrpf)};${num(totalTotal)};;;`);

    // BOM UTF-8 para que Excel/Sage lo abra correctamente
    const csv = "\uFEFF" + [CABECERA, ...filas].join("\r\n");
    const nombre = `ticketfiscal-${trimestre || "todos"}.csv`;

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
