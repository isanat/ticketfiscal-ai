// Formato español de importes y fechas para la interfaz.
const moneda = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "1234,50 €" (con separador de miles a partir de 5 cifras, norma es-ES). */
export const eur = (n: number): string => moneda.format(n);
/** Solo el número con 2 decimales, para columnas con la moneda en la cabecera. */
export const num2 = (n: number): string => decimal.format(n);
/** "2026-08-21" → "21/08/2026". */
export const fechaEs = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
