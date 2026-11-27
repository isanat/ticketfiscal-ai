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
  VISION_PROVIDER: z.enum(["auto", "glm", "gemini", "anthropic"]).default("auto"),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  // Haiku por defecto (más barato); Sonnet solo si el Haiku no alcanza la precisión.
  ANTHROPIC_MODEL: z.string().default("claude-haiku-5-5"),
  ANTHROPIC_PRECIO_ENTRADA_USD_M: z.coerce.number().nonnegative().optional(),
  ANTHROPIC_PRECIO_SALIDA_USD_M: z.coerce.number().nonnegative().optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
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
  // Administración del dueño del sistema.
  /** Clave AES-256 en base64 (32 bytes) para cifrar el secreto TOTP. */
  ADMIN_ENCRYPTION_KEY: z.string().min(40).optional(),
  /** E-mail del dueño (pre-aprobado): solo esta dirección puede crear el primer administrador. */
  ADMIN_EMAIL: z.email().optional(),
  /** Token de un solo uso para el primer acceso. Se desactiva al existir un administrador. */
  ADMIN_BOOTSTRAP_TOKEN: z.string().min(24).optional(),
  /** Segundo factor adicional por e-mail. Desactivado hasta tener dominio verificado en Resend. */
  EMAIL_2FA_ACTIVO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RESEND_API_KEY: z.string().min(10).optional(),
  /** Remitente verificado, p. ej. "TicketFiscal AI <seguridad@su-dominio.es>". */
  EMAIL_REMITENTE: z.string().min(5).optional(),
  // Plantilla de WhatsApp (aprobada por Meta) para reclamar justificantes fuera de la ventana de 24 h.
  WHATSAPP_PLANTILLA_RECLAMO: z.string().regex(/^[a-z0-9_]{1,512}$/).optional(),
  WHATSAPP_PLANTILLA_IDIOMA: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/).default("es"),
  // Límite diario de extracciones IA por empresa (control de coste).
  LIMITE_IA_DIARIO_EMPRESA: z.coerce.number().int().positive().default(50),
});

export type Config = z.infer<typeof esquema>;

let cache: Config | null = null;

export function config(): Config {
  if (cache) return cache;
  // Una variable OPCIONAL mal escrita (p. ej. una clave truncada) desactiva solo su función: no debe tirar
  // abajo rutas que no la usan. Las obligatorias sí detienen el arranque. Nunca se registran los valores.
  const entorno: Record<string, string | undefined> = { ...process.env };
  const descartadas: string[] = [];
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const r = esquema.safeParse(entorno);
    if (r.success) {
      if (descartadas.length > 0) console.warn(`[config] variables opcionales inválidas, ignoradas: ${descartadas.join(", ")}`);
      cache = r.data;
      return cache;
    }
    const recuperables = new Set<string>();
    for (const i of r.error.issues) {
      const clave = String(i.path[0] ?? "");
      if (clave && esquema.shape[clave as keyof typeof esquema.shape]?.safeParse(undefined).success) recuperables.add(clave);
    }
    if (recuperables.size === 0) {
      const detalle = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Configuración inválida: ${detalle}`);
    }
    for (const k of recuperables) {
      delete entorno[k];
      descartadas.push(k);
    }
  }
  throw new Error("Configuración inválida");
}

/** true si las credenciales de WhatsApp Cloud API están completas. */
export function whatsappConfigurado(c: Config = config()): boolean {
  return Boolean(
    c.WHATSAPP_VERIFY_TOKEN && c.WHATSAPP_APP_SECRET && c.WHATSAPP_ACCESS_TOKEN && c.WHATSAPP_PHONE_NUMBER_ID
  );
}
