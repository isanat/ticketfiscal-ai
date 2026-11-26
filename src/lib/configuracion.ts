// Ajustes NO secretos editables desde la administración (tabla Configuracion).
// Las claves de API y credenciales viven en variables de entorno de Vercel, nunca aquí.
import { z } from "zod";
import { prisma } from "./prisma";

export const ESQUEMA_CONFIG = z
  .object({
    /** Extracciones IA que puede hacer una empresa por día. */
    limiteIaDiarioEmpresa: z.number().int().min(1).max(10_000),
    /** Proveedor de visión por defecto (las credenciales siguen en Vercel). */
    proveedorVision: z.enum(["auto", "glm", "gemini", "anthropic"]),
    /** Permite que nuevas gestorías se den de alta solas (siguen pendientes de aprobación). */
    registroGestoriasAbierto: z.boolean(),
    /** Aviso visible para todos los usuarios (vacío = sin aviso). */
    avisoGlobal: z.string().max(200),
  })
  .partial();

export type ConfigEditable = z.infer<typeof ESQUEMA_CONFIG>;
export type ClaveConfig = keyof ConfigEditable;

let cache: { en: number; datos: Record<string, unknown> } | null = null;
const TTL_MS = 30_000;

export async function leerConfiguracion(forzar = false): Promise<Record<string, unknown>> {
  if (!forzar && cache && Date.now() - cache.en < TTL_MS) return cache.datos;
  const filas = await prisma.configuracion.findMany();
  const datos: Record<string, unknown> = {};
  for (const f of filas) datos[f.clave] = f.valor;
  cache = { en: Date.now(), datos };
  return datos;
}

/** Valor de un ajuste, o el valor por defecto si no existe o la base no responde. */
export async function valorConfig<T>(clave: ClaveConfig, porDefecto: T): Promise<T> {
  try {
    const v = (await leerConfiguracion())[clave];
    return v === undefined || v === null ? porDefecto : (v as T);
  } catch {
    return porDefecto;
  }
}

export async function guardarConfiguracion(cambios: ConfigEditable, usuarioId: string): Promise<string[]> {
  const claves = Object.keys(cambios) as ClaveConfig[];
  await prisma.$transaction(
    claves.map((clave) =>
      prisma.configuracion.upsert({
        where: { clave },
        update: { valor: cambios[clave] as never, actualizadoPor: usuarioId },
        create: { clave, valor: cambios[clave] as never, actualizadoPor: usuarioId },
      })
    )
  );
  cache = null;
  return claves;
}

export function invalidarCacheConfiguracion(): void {
  cache = null;
}
