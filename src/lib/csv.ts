// CSV para Excel/a3/Sage/Holded. Protege contra inyección de fórmulas: los textos que
// empiezan por = + - @ o tabulador se neutralizan (el emisor de un ticket lo controla un tercero).

/** Escapa un valor de texto para una celda CSV con separador «;». */
export function celdaTexto(valor: string | null | undefined): string {
  let s = valor ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Número en formato contable español, sin separadores de miles. */
export function celdaNumero(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
