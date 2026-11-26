// Aritmética monetaria en céntimos enteros para evitar errores de coma flotante.

/** Euros (number) → céntimos enteros, con redondeo half-up. */
export function aCentimos(euros: number): number {
  if (!Number.isFinite(euros)) throw new Error("Importe no finito");
  return Math.round((euros + Number.EPSILON * Math.sign(euros)) * 100);
}

/** Céntimos → euros con 2 decimales. */
export function aEuros(centimos: number): number {
  return Math.round(centimos) / 100;
}

/** Formato contable español: 1234,56 */
export function formatoEs(euros: number): string {
  return euros.toFixed(2).replace(".", ",");
}

/** Porcentaje con 2 decimales. */
export function redondearPct(valor: number): number {
  return Math.round(valor * 100) / 100;
}
