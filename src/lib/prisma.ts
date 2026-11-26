// Cliente Prisma singleton. En serverless se reutiliza entre invocaciones calientes.
import { PrismaClient } from "@prisma/client";

const global = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
