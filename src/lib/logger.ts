// Logs estructurados (JSON) sin datos personales ni cuerpos de petición.
type Nivel = "info" | "warn" | "error";

export function log(nivel: Nivel, evento: string, datos: Record<string, unknown> = {}): void {
  const linea = JSON.stringify({ t: new Date().toISOString(), nivel, evento, ...datos });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else console.log(linea);
}

/** Extrae un mensaje seguro (sin pila ni datos de usuario) de un error desconocido. */
export function mensajeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 300);
  return "error desconocido";
}
