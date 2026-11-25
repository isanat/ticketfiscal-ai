import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import {
  FISCAL_SYSTEM_PROMPT,
  parseExtraccion,
  validarMatematicamente,
  trimestreDe,
  type ExtraccionFiscal,
} from "@/lib/fiscal";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  imageBase64?: string; // data URL completa (data:image/png;base64,...) o base64 puro
  mimeType?: string;
  imagenNombre?: string;
  clienteNombre?: string;
  clienteNif?: string;
}

async function extraerConIA(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  content: Array<Record<string, unknown>>
): Promise<string> {
  const response = await zai.chat.completions.createVision({
    model: "glm-5.3-flash",
    messages: [
      { role: "system", content: FISCAL_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    thinking: { type: "disabled" },
  });
  return response?.choices?.[0]?.message?.content ?? "";
}

export async function GET() {
  try {
    const documentos = await db.documento.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ documentos });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Error al listar documentos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.imageBase64) {
      return NextResponse.json({ error: "Falta la imagen del justificante" }, { status: 400 });
    }

    // Normalizar a data URL
    let dataUrl = body.imageBase64;
    if (!dataUrl.startsWith("data:")) {
      const mime = body.mimeType || "image/png";
      dataUrl = `data:${mime};base64,${body.imageBase64}`;
    }

    const isPdf = dataUrl.startsWith("data:application/pdf");
    const mediaItem = isPdf
      ? { type: "file_url", file_url: { url: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

    const zai = await ZAI.create();
    const clienteNombre = body.clienteNombre || "Juan Pérez García";
    const clienteNif = body.clienteNif || "12345678Z";

    // Llamada al motor de visión con reintento único
    let raw = "";
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
      try {
        raw = await extraerConIA(zai, [
          {
            type: "text",
            text: `Analiza este justificante de gasto enviado por WhatsApp por el autónomo ${clienteNombre} (NIF ${clienteNif}). Devuelve el JSON estricto.`,
          },
          mediaItem,
        ]);
      } catch (e) {
        lastError = e;
        console.error(`Intento ${attempt + 1} de extracción falló:`, e);
      }
    }
    if (!raw) {
      throw lastError instanceof Error ? lastError : new Error("El motor de visión no respondió");
    }

    // Parsear y validar
    const ext = parseExtraccion(raw) as ExtraccionFiscal;
    const validacion = validarMatematicamente(ext);
    const linea = ext.desglose_impuestos[0];

    const doc = await db.documento.create({
      data: {
        clienteNombre,
        clienteNif,
        estado: validacion.estado,
        tipoDocumento: ext.tipo_documento,
        ivaDeducible: Boolean(ext.iva_deducible),
        emisorNombre: ext.emisor?.nombre ?? null,
        emisorNif: ext.emisor?.nif_cif ?? null,
        receptorNombre: ext.receptor?.nombre ?? null,
        receptorNif: ext.receptor?.nif_cif ?? null,
        numeroFactura: ext.datos_factura?.numero_factura ?? null,
        fechaEmision: ext.datos_factura?.fecha_emision ?? null,
        moneda: ext.datos_factura?.moneda || "EUR",
        baseImponible: linea?.base_imponible ?? 0,
        porcentajeIva: linea?.porcentaje_iva ?? 0,
        cuotaIva: linea?.cuota_iva ?? 0,
        irpfPorcentaje: ext.retencion_irpf?.porcentaje ?? 0,
        irpfImporte: ext.retencion_irpf?.importe ?? 0,
        totalFactura: ext.total_factura ?? 0,
        cuentaPgc: ext.cuenta_pgc_sugerida ?? null,
        confianza: ext.confianza_extraccion ?? 0,
        motivoRevision: validacion.motivo ?? ext.motivo_revision ?? null,
        mensajeWhatsapp: ext.mensaje_whatsapp_cliente ?? null,
        imagenNombre: body.imagenNombre ?? null,
        trimestre: trimestreDe(ext.datos_factura?.fecha_emision ?? null),
      },
    });

    return NextResponse.json({ documento: doc, avisos: validacion.avisos });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo procesar el justificante: ${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      await db.documento.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: id });
    }
    await db.documento.deleteMany({});
    return NextResponse.json({ ok: true, deleted: "all" });
  } catch (error) {
    console.error("DELETE /api/documents error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
