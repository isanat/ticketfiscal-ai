// WhatsApp Cloud API (Meta): verificación de firma del webhook, extracción de mensajes,
// descarga de adjuntos y respuestas. Sin SDK: superficie mínima y auditable.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "./env";
import { log } from "./logger";

const GRAPH = "https://graph.facebook.com";
const TIMEOUT_MS = 15_000;

/** Verifica X-Hub-Signature-256 («sha256=<hex>») sobre el cuerpo bruto. */
export function firmaValida(cuerpoBruto: string, cabecera: string | null, appSecret: string): boolean {
  if (!cabecera || !cabecera.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpoBruto, "utf8").digest();
  const recibida = Buffer.from(cabecera.slice(7), "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

const MensajeSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(5),
    type: z.string(),
    image: z.object({ id: z.string().min(1), mime_type: z.string().optional() }).optional(),
    document: z
      .object({ id: z.string().min(1), mime_type: z.string().optional(), filename: z.string().optional() })
      .optional(),
  })
  .passthrough();

export interface MensajeEntrante {
  wamid: string;
  /** Número sin «+», tal y como lo guarda Empresa.whatsapp. */
  numero: string;
  mediaId: string | null;
  nombre: string | null;
  tipo: string;
}

/** Extrae solo mensajes con adjuntos; descarta estados, texto y payloads desconocidos. */
export function extraerMensajes(payload: unknown): MensajeEntrante[] {
  const sobre = z
    .object({
      entry: z.array(
        z.object({
          changes: z.array(z.object({ value: z.object({ messages: z.array(z.unknown()).optional() }).passthrough() })),
        })
      ),
    })
    .safeParse(payload);
  if (!sobre.success) return [];
  const salida: MensajeEntrante[] = [];
  for (const entry of sobre.data.entry) {
    for (const change of entry.changes) {
      for (const raw of change.value.messages ?? []) {
        const r = MensajeSchema.safeParse(raw);
        if (!r.success) continue;
        const m = r.data;
        const mediaId = m.type === "image" ? m.image?.id ?? null : m.type === "document" ? m.document?.id ?? null : null;
        salida.push({
          wamid: m.id,
          numero: m.from.replace(/\D/g, ""),
          mediaId,
          nombre: m.document?.filename ?? null,
          tipo: m.type,
        });
      }
    }
  }
  return salida;
}

function version(): string {
  return process.env.WHATSAPP_API_VERSION || "v21.0";
}

async function graphGet(ruta: string): Promise<Response> {
  return fetch(`${GRAPH}/${version()}/${ruta}`, {
    headers: { Authorization: `Bearer ${config().WHATSAPP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Descarga un adjunto (imagen o PDF) con el token de la app. Limita el tamaño. */
export async function descargarAdjunto(mediaId: string, maxBytes: number): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const meta = await graphGet(mediaId);
    if (!meta.ok) {
      log("warn", "whatsapp.adjunto_fallido", { etapa: "metadatos", status: meta.status });
      return null;
    }
    const info = (await meta.json()) as { url?: string; file_size?: number };
    if (!info.url || (info.file_size ?? 0) > maxBytes) {
      log("warn", "whatsapp.adjunto_fallido", { etapa: "metadatos", motivo: info.url ? "demasiado_grande" : "sin_url" });
      return null;
    }
    const res = await fetch(info.url, {
      headers: { Authorization: `Bearer ${config().WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log("warn", "whatsapp.adjunto_fallido", { etapa: "descarga", status: res.status });
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) {
      log("warn", "whatsapp.adjunto_fallido", { etapa: "descarga", motivo: "tamano_no_valido" });
      return null;
    }
    return { bytes, mime: res.headers.get("content-type") ?? "application/octet-stream" };
  } catch (e) {
    // Red o tiempo de espera: el llamador responde al usuario pidiendo reenvío.
    log("warn", "whatsapp.adjunto_fallido", { etapa: "red", motivo: e instanceof Error ? e.name : "desconocido" });
    return null;
  }
}

/** Envía un texto al número indicado. Errores se registran y no interrumpen el flujo. */
export async function enviarTexto(numero: string, texto: string): Promise<boolean> {
  const c = config();
  if (!c.WHATSAPP_PHONE_NUMBER_ID || !c.WHATSAPP_ACCESS_TOKEN) return false;
  const res = await fetch(`${GRAPH}/${version()}/${c.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: numero, type: "text", text: { body: texto.slice(0, 4000) } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Solo código y tipo del error de Meta (sin mensaje, que puede incluir datos del usuario).
    const e = ((await res.json().catch(() => ({}))) as { error?: { code?: number; type?: string; error_subcode?: number } }).error;
    log("warn", "whatsapp.envio_fallido", { status: res.status, codigo: e?.code, subcodigo: e?.error_subcode, tipo: e?.type });
  }
  return res.ok;
}

/**
 * Variantes equivalentes de un número. En Brasil, WhatsApp puede entregar el remitente sin el «9» de los
 * móviles (55 + DDD + 9 + 8 dígitos ↔ 55 + DDD + 8 dígitos), así que se buscan ambas formas.
 */
export function variantesNumero(numero: string): string[] {
  const n = numero.replace(/\D/g, "");
  const con9 = /^55(\d{2})9(\d{8})$/.exec(n);
  if (con9) return [n, `55${con9[1]}${con9[2]}`];
  const sin9 = /^55(\d{2})([6-9]\d{7})$/.exec(n);
  if (sin9) return [n, `55${sin9[1]}9${sin9[2]}`];
  return [n];
}
