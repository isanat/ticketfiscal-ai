// TicketFiscal AI — Validación determinística de identificadores fiscales españoles
// Roadmap: "Antes de aprobar el documento, validar el dígito verificador del
// NIF/CIF en TypeScript (no confiar solo en la IA)". Próximo hito: censo VIES/AEAT.

export interface ResultadoNif {
  valido: boolean;
  tipo: "NIF" | "NIE" | "CIF" | null;
  normalizado: string | null;
  motivo: string | null;
}

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const LETRAS_CONTROL_CIF = "JABCDEFGHI";
const LETRAS_ORGANIZACION = "ABCDEFGHJKLMNPQRSUVW";
// Letras de organización cuyo dígito de control debe ser numérico / alfabético
const CONTROL_DIGITO = new Set(["A", "B", "E", "H"]);
const CONTROL_LETRA = new Set(["P", "Q", "S", "N", "W", "R"]);

/** Normaliza: mayúsculas, sin puntos/guiones/espacios y sin prefijo "ES". */
export function normalizarNif(entrada: string | null | undefined): string {
  if (!entrada) return "";
  return entrada
    .toUpperCase()
    .replace(/[\s.\-/]/g, "")
    .replace(/^ES/, "")
    .trim();
}

function sumaDigitos(n: number): number {
  return String(n)
    .split("")
    .reduce((s, d) => s + Number(d), 0);
}

/** Dígito de control numérico esperado para las 7 cifras de un CIF. */
export function controlCifEsperado(sieteDigitos: string): string {
  const d = sieteDigitos.split("").map(Number);
  const sumA = d[1] + d[3] + d[5]; // posiciones pares
  const sumB =
    sumaDigitos(d[0] * 2) + sumaDigitos(d[2] * 2) + sumaDigitos(d[4] * 2) + sumaDigitos(d[6] * 2);
  const total = sumA + sumB;
  return String((10 - (total % 10)) % 10);
}

/**
 * Valida un NIF (persona física), NIE (extranjero) o CIF (sociedad) español
 * mediante su dígito/letra de control. Determinístico: misma entrada,
 * mismo resultado, sin red ni IA.
 */
export function validarIdentificadorFiscal(entrada: string | null | undefined): ResultadoNif {
  const nif = normalizarNif(entrada);
  if (!nif) {
    return { valido: false, tipo: null, normalizado: null, motivo: "No figura ningún NIF/CIF" };
  }

  // --- NIE: X/Y/Z + 7 dígitos + letra ---
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  if (nie) {
    const prefijo = { X: "0", Y: "1", Z: "2" }[nie[1] as "X" | "Y" | "Z"];
    const numero = Number(prefijo + nie[2]);
    const esperada = LETRAS_DNI[numero % 23];
    const valido = esperada === nie[3];
    return {
      valido,
      tipo: "NIE",
      normalizado: nif,
      motivo: valido
        ? null
        : `NIE inválido: la letra de control debería ser «${esperada}» y figura «${nie[3]}»`,
    };
  }

  // --- NIF/DNI: 8 dígitos + letra ---
  const dni = /^(\d{8})([A-Z])$/.exec(nif);
  if (dni) {
    const esperada = LETRAS_DNI[Number(dni[1]) % 23];
    const valido = esperada === dni[2];
    return {
      valido,
      tipo: "NIF",
      normalizado: nif,
      motivo: valido
        ? null
        : `NIF inválido: la letra de control debería ser «${esperada}» y figura «${dni[2]}»`,
    };
  }

  // --- CIF: letra de organización + 7 dígitos + control ---
  const cif = /^([A-Z])(\d{7})([0-9A-J])$/.exec(nif);
  if (cif && LETRAS_ORGANIZACION.includes(cif[1])) {
    const digito = controlCifEsperado(cif[2]);
    const letra = LETRAS_CONTROL_CIF[Number(digito)];
    const control = cif[3];
    let valido: boolean;
    if (CONTROL_DIGITO.has(cif[1])) {
      valido = control === digito;
    } else if (CONTROL_LETRA.has(cif[1])) {
      valido = control === letra;
    } else {
      valido = control === digito || control === letra;
    }
    return {
      valido,
      tipo: "CIF",
      normalizado: nif,
      motivo: valido
        ? null
        : `CIF inválido: el dígito de control debería ser «${digito}» (o letra «${letra}») y figura «${control}»`,
    };
  }

  return {
    valido: false,
    tipo: null,
    normalizado: nif,
    motivo: "Formato de NIF/CIF español no reconocido",
  };
}

/**
 * Cruce determinístico de la extracción de la IA con el validador.
 * Devuelve avisos y si procede forzar el estado REQUIERE_REVISION.
 */
export interface CruceNif {
  emisorValido: boolean | null;
  receptorValido: boolean | null;
  avisos: string[];
}

export function validarNifsDocumento(input: {
  tipoDocumento: string;
  emisorNif: string | null;
  receptorNif: string | null;
}): CruceNif {
  const avisos: string[] = [];
  const emisor = validarIdentificadorFiscal(input.emisorNif);
  const receptor = validarIdentificadorFiscal(input.receptorNif);

  // Un justificante siempre debe identificar fiscalmente al emisor
  if (!input.emisorNif) {
    avisos.push("El justificante no incluye el NIF/CIF del emisor (obligatorio, RD 1619/2012).");
  } else if (!emisor.valido && emisor.motivo) {
    avisos.push(`Validación determinística: ${emisor.motivo}.`);
  }

  // En factura completa, los datos fiscales del receptor son obligatorios
  if (input.tipoDocumento === "FACTURA_COMPLETA") {
    if (!input.receptorNif) {
      avisos.push("Factura completa sin NIF del receptor: no permite deducir IVA con seguridad.");
    } else if (!receptor.valido && receptor.motivo) {
      avisos.push(`Validación determinística: ${receptor.motivo}.`);
    }
  }

  return {
    emisorValido: input.emisorNif ? emisor.valido : null,
    receptorValido: input.receptorNif ? receptor.valido : null,
    avisos,
  };
}
