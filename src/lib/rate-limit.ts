// Límites de uso persistentes en Postgres (válidos entre instancias serverless).
// Ventana fija: al expirar la ventana el contador se reinicia.
import { prisma } from "./prisma";

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reintentoEnSeg: number;
}

export async function consumirLimite(clave: string, maximo: number, ventanaSeg: number): Promise<ResultadoLimite> {
  const ventanaMs = ventanaSeg * 1000;
  const ahora = new Date();
  const filas = await prisma.$queryRaw<Array<{ contador: number; ventanaInicio: Date }>>`
    INSERT INTO "LimiteUso" ("clave", "contador", "ventanaInicio")
    VALUES (${clave}, 1, ${ahora})
    ON CONFLICT ("clave") DO UPDATE SET
      "contador" = CASE
        WHEN "LimiteUso"."ventanaInicio" < ${new Date(ahora.getTime() - ventanaMs)} THEN 1
        ELSE "LimiteUso"."contador" + 1 END,
      "ventanaInicio" = CASE
        WHEN "LimiteUso"."ventanaInicio" < ${new Date(ahora.getTime() - ventanaMs)} THEN ${ahora}
        ELSE "LimiteUso"."ventanaInicio" END
    RETURNING "contador", "ventanaInicio"`;
  const fila = filas[0];
  const transcurrido = ahora.getTime() - fila.ventanaInicio.getTime();
  const reintentoEnSeg = Math.max(1, Math.ceil((ventanaMs - transcurrido) / 1000));
  const permitido = fila.contador <= maximo;
  return { permitido, restantes: Math.max(0, maximo - fila.contador), reintentoEnSeg };
}
