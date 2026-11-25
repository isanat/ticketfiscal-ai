import { NextRequest, NextResponse } from "next/server";
import {
  FISCAL_SYSTEM_PROMPT,
  parseExtraccion,
  validarMatematicamente,
  trimestreDe,
  type ExtraccionFiscal,
} from "@/lib/fiscal";
import { validarNifsDocumento } from "@/lib/nif";
import { SEMILLA_DOCUMENTOS } from "@/lib/seed";
import { crearDocumento, eliminarDocumento, listarDocumentos, modoDatos, type EntradaDocumento } from "@/lib/store";
import { visionChat } from "@/lib/zai-server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  imageBase64?: string; // data URL completa (data:image/png;base64,...) o base64 puro
  mimeType?: string;
  imagenNombre?: string;
  clienteNombre?: string;
  clienteNif?: string;
}

/**
 * Modo demostración: si el despliegue no tiene acceso al motor de IA
 * (p. ej. Vercel sin credenciales) y el usuario reenvía una de las muestras
 * conocidas, se devuelve la extracción preconfigurada, claramente etiquetada.
 */
function extraccionDemo(imagenNombre?: string): EntradaDocumento | null {
  if (!imagenNombre) return null;
  const doc = SEMILLA_DOCUMENTOS.find((d) => d.imagenNombre === imagenNombre);
  if (!doc) return null;
  const { id: _id, createdAt: _createdAt, trimestre: _trimestre, ...entrada } = doc;
  return entrada;
}

export async function GET() {
  try {
    const documentos = await listarDocumentos();
    return NextResponse.json({ documentos, modo: modoDatos() });
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

    const clienteNombre = body.clienteNombre || "Juan Pérez García";
    const clienteNif = body.clienteNif || "12345678Z";

    // Llamada al motor de visión con reintento único
    let raw = "";
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
      try {
        raw = await visionChat(FISCAL_SYSTEM_PROMPT, [
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

    // Modo demostración (despliegue sin motor IA): muestra conocida → respuesta simulada
    if (!raw) {
      const demo = extraccionDemo(body.imagenNombre);
      if (demo) {
        const doc = await crearDocumento(demo);
        return NextResponse.json({ documento: doc, avisos: [], simulado: true });
      }
      throw lastError instanceof Error ? lastError : new Error("El motor de visión no respondió");
    }

    // Parsear y validar (matemática AEAT + dígito de control NIF/CIF determinístico)
    const ext = parseExtraccion(raw) as ExtraccionFiscal;
    const validacion = validarMatematicamente(ext);
    const cruceNif = validarNifsDocumento({
      tipoDocumento: ext.tipo_documento,
      emisorNif: ext.emisor?.nif_cif ?? null,
      receptorNif: ext.receptor?.nif_cif ?? null,
    });

    const avisos = [...validacion.avisos, ...cruceNif.avisos];
    const estado =
      validacion.estado === "VALIDO" && cruceNif.avisos.length > 0
        ? "REQUIERE_REVISION"
        : validacion.estado;
    const motivo =
      estado === "REQUIERE_REVISION"
        ? [ext.motivo_revision, ...avisos].filter(Boolean).join(" ")
        : validacion.estado === "ILEGIBLE"
          ? validacion.motivo ?? ext.motivo_revision
          : null;

    const linea = ext.desglose_impuestos[0];
    const doc = await crearDocumento({
      clienteNombre,
      clienteNif,
      estado,
      tipoDocumento: ext.tipo_documento,
      ivaDeducible: Boolean(ext.iva_deducible),
      emisorNombre: ext.emisor?.nombre ?? null,
      emisorNif: ext.emisor?.nif_cif ?? null,
      nifEmisorValido: cruceNif.emisorValido,
      receptorNombre: ext.receptor?.nombre ?? null,
      receptorNif: ext.receptor?.nif_cif ?? null,
      nifReceptorValido: cruceNif.receptorValido,
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
      motivoRevision: motivo,
      mensajeWhatsapp: ext.mensaje_whatsapp_cliente ?? null,
      imagenNombre: body.imagenNombre ?? null,
      trimestre: trimestreDe(ext.datos_factura?.fecha_emision ?? null),
    } satisfies EntradaDocumento);

    return NextResponse.json({ documento: doc, avisos });
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
    await eliminarDocumento(id);
    return NextResponse.json({ ok: true, deleted: id ?? "all" });
  } catch (error) {
    console.error("DELETE /api/documents error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
