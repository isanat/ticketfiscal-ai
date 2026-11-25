// Verificación rápida del validador NIF/CIF (no se despliega; solo comprobación manual)
import { validarIdentificadorFiscal } from "../src/lib/nif";

const casos: Array<[string, boolean]> = [
  ["12345678Z", true],   // receptor demo (DNI)
  ["B46283917", true],   // Ferrallado (factura completa)
  ["B46912382", true],   // Bar El Cruce (regenerado)
  ["B46539128", true],   // Gasolinera La Vía (regenerado)
  ["A28547963", false],  // Eléctricas del Sur — dígito erróneo deliberado
  ["B98765432", false],  // antiguo El Cruce — inválido
  ["X1234567L", true],   // NIE válido de ejemplo
  ["b-46283917", true],  // normalización
  ["ESB46283917", true], // prefijo ES
  ["12345678A", false],  // letra de control errónea
];

let fallos = 0;
for (const [nif, esperado] of casos) {
  const r = validarIdentificadorFiscal(nif);
  const ok = r.valido === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "FAIL"} ${nif.padEnd(12)} -> valido=${r.valido} tipo=${r.tipo} ${r.motivo ?? ""}`);
}
console.log(fallos === 0 ? "\nTodos los casos pasan." : `\n${fallos} caso(s) fallidos.`);
process.exit(fallos === 0 ? 0 : 1);
