import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * ¿Existe SQLite configurado? En despliegues serverless sin DATABASE_URL
 * (p. ej. Vercel) el sistema funciona en modo memoria con datos de demostración.
 */
export function tieneSqlite(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Cliente Prisma perezoso: solo se instancia cuando hay base de datos. */
export function getDb(): PrismaClient {
  if (!tieneSqlite()) {
    throw new Error("DATABASE_URL no configurada (modo memoria sin SQLite).");
  }
  globalForPrisma.prisma ??= new PrismaClient({ log: ["error"] });
  return globalForPrisma.prisma;
}
