// Motor de visión (GLM). Producción: endpoint HTTP configurado por variables de entorno,
// con timeout y reintentos. Desarrollo: SDK local si no hay variables.
import { config } from "./env";
import { log, mensajeError } from "./logger";

export class MotorVisionNoDisponible extends Error {}

type Contenido = Array<Record<string, unknown>>;
interface Mensaje {
  role: "system" | "user";
  content: unknown;
}

const TIMEOUT_MS = 45_000;
const INTENTOS = 3;

class ErrorTransitorio extends Error {}

async function llamadaHttp(messages: Mensaje[]): Promise<string> {
  const c = config();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${c.ZAI_API_KEY}`,
    "X-Z-AI-From": "Z",
  };
  if (c.ZAI_CHAT_ID) headers["X-Chat-Id"] = c.ZAI_CHAT_ID;
  if (c.ZAI_USER_ID) headers["X-User-Id"] = c.ZAI_USER_ID;
  if (c.ZAI_TOKEN) headers["X-Token"] = c.ZAI_TOKEN;
  const body = JSON.stringify({ model: c.ZAI_MODEL, messages, thinking: { type: "disabled" } });

  let ultimo: unknown = null;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const res = await fetch(`${c.ZAI_BASE_URL}/chat/completions/vision`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        throw new ErrorTransitorio(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        // Error de petición o de credenciales: no se reintenta.
        throw new MotorVisionNoDisponible(`Motor de visión rechazó la petición (HTTP ${res.status})`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const texto = json?.choices?.[0]?.message?.content ?? "";
      if (!texto) throw new MotorVisionNoDisponible("El motor no devolvió contenido");
      return texto;
    } catch (e) {
      if (e instanceof MotorVisionNoDisponible) throw e;
      ultimo = e; // transitorio: red, timeout o 5xx
    }
    log("warn", "vision.reintento", { intento, motivo: mensajeError(ultimo) });
    if (intento < INTENTOS) await new Promise((r) => setTimeout(r, 600 * 2 ** (intento - 1)));
  }
  throw new MotorVisionNoDisponible(`El motor de visión no respondió tras ${INTENTOS} intentos`);
}

/** Solo desarrollo local: SDK con su fichero de configuración. Nunca en producción. */
async function llamadaSdkLocal(messages: Mensaje[]): Promise<string> {
  const mod: any = await import("z-ai-web-dev-sdk");
  const zai = await (mod.default ?? mod).create();
  const r = await zai.chat.completions.createVision({
    model: config().ZAI_MODEL,
    messages,
    thinking: { type: "disabled" },
  });
  const texto: string = r?.choices?.[0]?.message?.content ?? "";
  if (!texto) throw new MotorVisionNoDisponible("SDK local sin contenido");
  return texto;
}

export async function extraerConVision(system: string, contenido: Contenido): Promise<string> {
  const messages: Mensaje[] = [
    { role: "system", content: system },
    { role: "user", content: contenido },
  ];
  const c = config();
  if (c.ZAI_BASE_URL && c.ZAI_API_KEY) return llamadaHttp(messages);
  if (c.NODE_ENV !== "production") {
    try {
      return await llamadaSdkLocal(messages);
    } catch (e) {
      log("warn", "vision.sdk_local_no_disponible", { motivo: mensajeError(e) });
    }
  }
  throw new MotorVisionNoDisponible("Motor de visión no configurado (ZAI_BASE_URL / ZAI_API_KEY)");
}
