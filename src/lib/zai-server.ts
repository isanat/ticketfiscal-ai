// TicketFiscal AI — Acceso al motor de visión (GLM) en el servidor.
// Dos vías, en orden:
//  1) z-ai-web-dev-sdk con su fichero .z-ai-config (entorno de desarrollo / self-hosted)
//  2) Llamada directa por fetch usando variables de entorno (despliegues serverless
//     como Vercel, donde el sistema de archivos es de solo lectura y no hay .z-ai-config)

import ZAI from "z-ai-web-dev-sdk";

export type ContenidoVision = Array<Record<string, unknown>>;

interface MensajeChat {
  role: "system" | "user" | "assistant";
  content: unknown;
}

/** ¿Hay credenciales de repuesto configuradas por variables de entorno? */
export function envZaiConfigurado(): boolean {
  return Boolean(process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY);
}

async function llamadaDirecta(messages: MensajeChat[]): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
    "X-Z-AI-From": "Z",
  };
  if (process.env.ZAI_CHAT_ID) headers["X-Chat-Id"] = process.env.ZAI_CHAT_ID;
  if (process.env.ZAI_USER_ID) headers["X-User-Id"] = process.env.ZAI_USER_ID;
  if (process.env.ZAI_TOKEN) headers["X-Token"] = process.env.ZAI_TOKEN;

  const res = await fetch(`${process.env.ZAI_BASE_URL}/chat/completions/vision`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: process.env.ZAI_MODEL || "glm-5.3-flash",
      messages,
      thinking: { type: "disabled" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Motor IA no disponible (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texto = json?.choices?.[0]?.message?.content ?? "";
  if (!texto) throw new Error("El motor de visión no devolvió contenido");
  return texto;
}

/**
 * Envía el system prompt + el contenido multimodal al modelo de visión y
 * devuelve el texto de respuesta.
 */
export async function visionChat(
  system: string,
  contenido: ContenidoVision
): Promise<string> {
  const messages: MensajeChat[] = [
    { role: "system", content: system },
    { role: "user", content: contenido },
  ];

  // 1) SDK con fichero de configuración local
  try {
    const zai = await ZAI.create();
    const r = await zai.chat.completions.createVision({
      model: "glm-5.3-flash",
      messages: messages as never,
      thinking: { type: "disabled" },
    });
    const texto = r?.choices?.[0]?.message?.content ?? "";
    if (texto) return texto;
  } catch {
    // sin fichero .z-ai-config o error de red: probar la vía directa
  }

  // 2) Vía directa para serverless
  if (envZaiConfigurado()) {
    return llamadaDirecta(messages);
  }

  throw new Error("Motor de visión no disponible en este despliegue");
}
