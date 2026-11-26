// Motor de visión: interfaz común con dos proveedores.
//  · glm:    endpoint compatible configurado con ZAI_BASE_URL / ZAI_API_KEY.
//  · gemini: Gemini API (generateContent) con GEMINI_API_KEY.
// Ambos: timeout, reintentos solo ante fallos transitorios, respuesta JSON y registro de tokens.
// Desarrollo: si no hay proveedor configurado se intenta el SDK local (nunca en producción).
import { config } from "./env";
import { log, mensajeError } from "./logger";

export class MotorVisionNoDisponible extends Error {}

/** Parte de la entrada: texto o archivo (imagen o PDF) en base64. */
export type ParteEntrada =
  | { tipo: "texto"; texto: string }
  | { tipo: "archivo"; mime: string; base64: string };

export type Proveedor = "glm" | "gemini";

export interface UsoTokens {
  entrada: number;
  salida: number;
}

const TIMEOUT_MS = 45_000;
const INTENTOS = 3;

class ErrorTransitorio extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintenta solo errores transitorios (red, timeout, 408/429/5xx). Los demás fallan al instante. */
async function conReintentos<T>(proveedor: Proveedor, operacion: () => Promise<T>): Promise<T> {
  let ultimo: unknown = null;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      return await operacion();
    } catch (e) {
      if (e instanceof MotorVisionNoDisponible) throw e;
      ultimo = e;
    }
    log("warn", "vision.reintento", { proveedor, intento, motivo: mensajeError(ultimo) });
    if (intento < INTENTOS) await esperar(600 * 2 ** (intento - 1));
  }
  throw new MotorVisionNoDisponible(`${proveedor}: sin respuesta tras ${INTENTOS} intentos`);
}

/** Traduce el estado HTTP a error transitorio (reintentable) o definitivo. */
function comprobarEstado(res: Response, proveedor: Proveedor): void {
  if (res.ok) return;
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    throw new ErrorTransitorio(`${proveedor} HTTP ${res.status}`);
  }
  throw new MotorVisionNoDisponible(`${proveedor} rechazó la petición (HTTP ${res.status})`);
}

// ------------------------------------------------------------------ GLM

/** Construye el cuerpo OpenAI-compatible con imágenes como data URL. Exportado para tests. */
export function construirPeticionGlm(system: string, partes: ParteEntrada[], modelo: string) {
  const contenido = partes.map((p) => {
    if (p.tipo === "texto") return { type: "text", text: p.texto };
    const url = `data:${p.mime};base64,${p.base64}`;
    return p.mime === "application/pdf"
      ? { type: "file_url", file_url: { url } }
      : { type: "image_url", image_url: { url } };
  });
  return {
    model: modelo,
    messages: [
      { role: "system", content: system },
      { role: "user", content: contenido },
    ],
    thinking: { type: "disabled" },
  };
}

async function llamadaGlm(system: string, partes: ParteEntrada[]): Promise<{ texto: string; uso?: UsoTokens }> {
  const c = config();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${c.ZAI_API_KEY}`,
    "X-Z-AI-From": "Z",
  };
  if (c.ZAI_CHAT_ID) headers["X-Chat-Id"] = c.ZAI_CHAT_ID;
  if (c.ZAI_USER_ID) headers["X-User-Id"] = c.ZAI_USER_ID;
  if (c.ZAI_TOKEN) headers["X-Token"] = c.ZAI_TOKEN;
  const body = JSON.stringify(construirPeticionGlm(system, partes, c.ZAI_MODEL));

  return conReintentos("glm", async () => {
    const res = await fetch(`${c.ZAI_BASE_URL}/chat/completions/vision`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    comprobarEstado(res, "glm");
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const texto = json?.choices?.[0]?.message?.content ?? "";
    if (!texto) throw new MotorVisionNoDisponible("glm no devolvió contenido");
    const uso = json.usage
      ? { entrada: json.usage.prompt_tokens ?? 0, salida: json.usage.completion_tokens ?? 0 }
      : undefined;
    return { texto, uso };
  });
}

// ------------------------------------------------------------------ Gemini

/** Cuerpo de generateContent. Imágenes y PDF como inline_data. Exportado para tests. */
export function construirPeticionGemini(system: string, partes: ParteEntrada[]) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: partes.map((p) =>
          p.tipo === "texto" ? { text: p.texto } : { inline_data: { mime_type: p.mime, data: p.base64 } }
        ),
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  };
}

interface RespuestaGemini {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

/** Extrae texto y tokens de la respuesta de Gemini. Exportado para tests. */
export function extraerRespuestaGemini(json: RespuestaGemini): { texto: string; uso?: UsoTokens } {
  if (json.promptFeedback?.blockReason) {
    throw new MotorVisionNoDisponible(`gemini bloqueó la entrada (${json.promptFeedback.blockReason})`);
  }
  const partes = json.candidates?.[0]?.content?.parts ?? [];
  const texto = partes.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!texto) throw new MotorVisionNoDisponible("gemini no devolvió contenido");
  const u = json.usageMetadata;
  const uso = u
    ? {
        entrada: u.promptTokenCount ?? 0,
        // Los tokens de razonamiento se facturan como salida.
        salida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      }
    : undefined;
  return { texto, uso };
}

async function llamadaGemini(system: string, partes: ParteEntrada[]): Promise<{ texto: string; uso?: UsoTokens }> {
  const c = config();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.GEMINI_MODEL)}:generateContent`;
  const body = JSON.stringify(construirPeticionGemini(system, partes));

  return conReintentos("gemini", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": c.GEMINI_API_KEY ?? "" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    comprobarEstado(res, "gemini");
    return extraerRespuestaGemini((await res.json()) as RespuestaGemini);
  });
}

// ------------------------------------------------------------------ Selección y coste

/** Proveedor activo según VISION_PROVIDER y las credenciales presentes. */
export function proveedorActivo(c = config()): Proveedor | null {
  const glm = Boolean(c.ZAI_BASE_URL && c.ZAI_API_KEY);
  const gemini = Boolean(c.GEMINI_API_KEY);
  if (c.VISION_PROVIDER === "glm") return glm ? "glm" : null;
  if (c.VISION_PROVIDER === "gemini") return gemini ? "gemini" : null;
  if (glm) return "glm";
  if (gemini) return "gemini";
  return null;
}

/** Coste estimado en USD a partir de tokens y tarifas. Null si no hay tarifas configuradas. */
export function costeEstimadoUsd(uso: UsoTokens, precioEntrada?: number, precioSalida?: number): number | null {
  if (precioEntrada === undefined || precioSalida === undefined) return null;
  return (uso.entrada * precioEntrada + uso.salida * precioSalida) / 1_000_000;
}

/** Solo desarrollo local: SDK con su fichero de configuración. */
async function llamadaSdkLocal(system: string, partes: ParteEntrada[]): Promise<{ texto: string }> {
  const mod: any = await import("z-ai-web-dev-sdk");
  const zai = await (mod.default ?? mod).create();
  const r = await zai.chat.completions.createVision({
    model: config().ZAI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: construirPeticionGlm(system, partes, config().ZAI_MODEL).messages[1].content },
    ],
    thinking: { type: "disabled" },
  });
  const texto: string = r?.choices?.[0]?.message?.content ?? "";
  if (!texto) throw new MotorVisionNoDisponible("SDK local sin contenido");
  return { texto };
}

/**
 * Ejecuta la extracción con el proveedor activo y registra tokens y coste estimado
 * (sin contenido del documento). Devuelve el texto de la respuesta del modelo.
 */
export async function extraerConVision(
  system: string,
  partes: ParteEntrada[],
  opciones: { onUso?: (uso: UsoTokens) => void } = {}
): Promise<string> {
  const c = config();
  const proveedor = proveedorActivo(c);

  if (proveedor) {
    const r = proveedor === "gemini" ? await llamadaGemini(system, partes) : await llamadaGlm(system, partes);
    if (r.uso) {
      opciones.onUso?.(r.uso);
      const coste =
        proveedor === "gemini"
          ? costeEstimadoUsd(r.uso, c.GEMINI_PRECIO_ENTRADA_USD_M, c.GEMINI_PRECIO_SALIDA_USD_M)
          : null;
      log("info", "vision.uso", { proveedor, entrada: r.uso.entrada, salida: r.uso.salida, costeUsd: coste });
    }
    return r.texto;
  }

  if (c.NODE_ENV !== "production") {
    try {
      return (await llamadaSdkLocal(system, partes)).texto;
    } catch (e) {
      log("warn", "vision.sdk_local_no_disponible", { motivo: mensajeError(e) });
    }
  }
  throw new MotorVisionNoDisponible("Motor de visión no configurado (GEMINI_API_KEY o ZAI_BASE_URL/ZAI_API_KEY)");
}
