// Configuración validada con zod. Se evalúa de forma perezosa para que `next build`
// y los tests no fallen si una variable opcional no está presente.
import { z } from "zod";

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Variables inyectadas por la integración Neon de Vercel. Ver prisma/schema.prisma.
  STORAGE_POSTGRES_PRISMA_URL: z.string().min(1, "STORAGE_POSTGRES_PRISMA_URL es obligatoria (Neon, pooler)"),
  STORAGE_POSTGRES_URL_NON_POOLING: z.string().min(1).optional(),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SEED_DEMO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Motor de visión (GLM). Obligatorio en producción para extraer justificantes.
  ZAI_BASE_URL: z.string().url().optional(),
  ZAI_API_KEY: z.string().min(1).optional(),
  ZAI_MODEL: z.string().default("glm-5.3-flash"),
  // Proveedor de visión: "auto" usa GLM si hay ZAI_* y si no Gemini si hay GEMINI_API_KEY.
  VISION_PROVIDER: z.enum(["auto", "glm", "gemini"]).default("auto"),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  // Tarifas en USD por millón de tokens (de la tabla oficial vigente). Sin ellas solo se registran tokens.
  GEMINI_PRECIO_ENTRADA_USD_M: z.coerce.number().nonnegative().optional(),
  GEMINI_PRECIO_SALIDA_USD_M: z.coerce.number().nonnegative().optional(),
  ZAI_TOKEN: z.string().optional(),
  ZAI_CHAT_ID: z.string().optional(),
  ZAI_USER_ID: z.string().optional(),
  // WhatsApp Cloud API (Meta). Todas opcionales: sin ellas el webhook responde 503.
  WHATSAPP_VERIFY_TOKEN: z.string().min(8).optional(),
  WHATSAPP_APP_SECRET: z.string().min(8).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(10).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(5).optional(),
  // Límite diario de extracciones IA por empresa (control de coste).
  LIMITE_IA_DIARIO_EMPRESA: z.coerce.number().int().positive().default(50),
});

export type Config = z.infer<typeof esquema>;

let cache: Config | null = null;

export function config(): Config {
  if (cache) return cache;
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuración inválida: ${detalle}`);
  }
  cache = r.data;
  return cache;
}

/** true si las credenciales de WhatsApp Cloud API están completas. */
export function whatsappConfigurado(c: Config = config()): boolean {
  return Boolean(
    c.WHATSAPP_VERIFY_TOKEN && c.WHATSAPP_APP_SECRET && c.WHATSAPP_ACCESS_TOKEN && c.WHATSAPP_PHONE_NUMBER_ID
  );
}
