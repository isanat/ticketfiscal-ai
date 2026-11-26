import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { detectarMime, MAX_BYTES_JUSTIFICANTE } from "@/lib/archivos";
import { config, whatsappConfigurado } from "@/lib/env";
import { error } from "@/lib/http";
import { log, mensajeError } from "@/lib/logger";
import { LimiteIaAlcanzado, procesarJustificante } from "@/lib/pipeline";
import { empresaPorWhatsapp, obtenerEmpresa } from "@/lib/store";
import { MotorVisionNoDisponible } from "@/lib/vision";
import { descargarAdjunto, enviarTexto, extraerMensajes, firmaValida, type MensajeEntrante } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CUERPO = 256 * 1024;

/** Verificación del webhook por Meta (GET con hub.challenge). */
export async function GET(req: NextRequest) {
  if (!whatsappConfigurado()) return error("Canal WhatsApp no configurado", 503);
  const p = req.nextUrl.searchParams;
  const token = config().WHATSAPP_VERIFY_TOKEN ?? "";
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }
  return error("Verificación rechazada", 403);
}

/**
 * Recepción de mensajes. Se valida la firma antes de hacer nada, se responde 200 y el
 * procesamiento (descarga, extracción, respuesta) corre tras la respuesta con after().
 */
export async function POST(req: NextRequest) {
  if (!whatsappConfigurado()) return error("Canal WhatsApp no configurado", 503);
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_CUERPO) return error("Petición demasiado grande", 413);

  const secreto = config().WHATSAPP_APP_SECRET ?? "";
  if (!firmaValida(cuerpo, req.headers.get("x-hub-signature-256"), secreto)) {
    log("warn", "whatsapp.firma_invalida");
    return error("Firma no válida", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return error("JSON no válido", 400);
  }

  const mensajes = extraerMensajes(payload);
  after(async () => {
    for (const m of mensajes) {
      try {
        await procesarMensaje(m);
      } catch (e) {
        log("error", "whatsapp.mensaje_error", { motivo: mensajeError(e) });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

async function responder(numero: string, texto: string): Promise<void> {
  try {
    await enviarTexto(numero, texto);
  } catch (e) {
    log("warn", "whatsapp.respuesta_fallida", { motivo: mensajeError(e) });
  }
}

async function procesarMensaje(m: MensajeEntrante): Promise<void> {
  // Número desconocido: no se responde, para no revelar qué números están registrados.
  const empresa = await empresaPorWhatsapp(m.numero);
  if (!empresa) {
    log("info", "whatsapp.numero_desconocido");
    return;
  }
  if (empresa.estado !== "APROBADA") {
    await responder(m.numero, "Su empresa todavía está pendiente de aprobación por su gestoría.");
    return;
  }
  if (!m.mediaId) {
    await responder(m.numero, "Envíeme la foto o el PDF del justificante.");
    return;
  }

  const adjunto = await descargarAdjunto(m.mediaId, MAX_BYTES_JUSTIFICANTE);
  if (!adjunto) {
    await responder(m.numero, "No he podido descargar el archivo. Reenvíelo, por favor.");
    return;
  }
  // El tipo se determina por el contenido, no por el MIME que declara WhatsApp.
  const mime = detectarMime(adjunto.bytes);
  if (!mime) {
    await responder(m.numero, "Formato no admitido. Envíe una imagen JPG, PNG o WEBP, o un PDF.");
    return;
  }

  try {
    const cliente = await obtenerEmpresa(empresa.id);
    if (!cliente) return;
    const r = await procesarJustificante({
      empresa: { id: cliente.id, nombre: cliente.nombre, nif: cliente.nif, gestoriaId: cliente.gestoriaId },
      bytes: adjunto.bytes,
      mime,
      nombreImagen: m.nombre,
      origen: "WHATSAPP",
      whatsappMensajeId: m.wamid,
    });
    if (r.estado === "duplicado") {
      await responder(m.numero, "Ese justificante ya estaba registrado. No lo he vuelto a contar.");
      return;
    }
    await responder(m.numero, r.documento.mensajeWhatsapp ?? "Justificante recibido.");
  } catch (e) {
    if (e instanceof MotorVisionNoDisponible) {
      await responder(m.numero, "Ahora mismo no puedo procesar justificantes. Reenvíelo en unos minutos.");
    } else if (e instanceof LimiteIaAlcanzado) {
      await responder(m.numero, "Ha alcanzado el límite diario de justificantes de su empresa.");
    } else {
      throw e;
    }
  }
}
