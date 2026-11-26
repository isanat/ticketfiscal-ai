# Posicionamiento: innovación, gestorías y ENISA

Documento de trabajo. **No es una solicitud ni garantiza ninguna ayuda.** Todo lo que no está medido está marcado como hipótesis.

## 1. El problema

Las gestorías pierden horas cada trimestre en tres tareas que no aportan criterio: teclear los datos de tickets y facturas que reciben por WhatsApp o en papel, perseguir a los clientes por justificantes que faltan, y comprobar a mano que el IVA y los NIF cuadran. Los clientes no cambian de hábitos: mandan fotos.

*(Falta cifrar el problema con datos propios: horas/trimestre por cliente y tasa de justificantes que faltan. Esa medición debe salir de los pilotos, no de estimaciones de terceros.)*

## 2. La propuesta

TicketFiscal AI lleva el justificante del cliente al asiento contable, y lo cruza con el banco:

1. El cliente envía la foto (WhatsApp o portal).
2. La IA lee los datos; **un motor de reglas determinista decide la validez fiscal** (NIF/CIF, IVA por tipos, retenciones, fechas). La IA nunca puede dar por bueno un justificante.
3. El extracto bancario se cruza con los justificantes: cada coincidencia propuesta explica sus motivos y la confirma una persona.
4. La gestoría revisa solo las excepciones y exporta un lote para a3, Sage o Holded.

## 3. Dónde está la innovación (y dónde no)

Conviene ser preciso: leer un ticket con IA ya lo hacen otras herramientas. Lo defendible es la combinación:

| Elemento | Por qué importa | Estado |
|---|---|---|
| **IA que lee + reglas que deciden** | Los modelos de visión fallan sin avisar; la validez fiscal no puede depender de ellos. Con reglas explicables cada aviso cita su causa y es auditable | Implementado y probado |
| **Conciliación justificante ↔ movimiento bancario** | Detecta gasto sin factura antes del cierre; convierte «perseguir tickets» en una lista concreta | Implementado con CSV/Norma 43; Open Banking pendiente |
| **Persona en el bucle + trazabilidad** | Auditoría de cada cambio, borrado lógico, duplicados por huella: un registro fiscal no se destruye | Implementado |
| **Canal del cliente = WhatsApp** | Cero fricción de adopción para el cliente final | Implementado; **sin credenciales de Meta no se ha ejecutado de extremo a extremo** |

Lo que **no** es innovador y no debe presentarse como tal: el OCR en sí, la exportación CSV, el multi-empresa.

## 4. Competencia (por verificar)

Existen herramientas de captura de gastos y contabilidad con OCR (plataformas internacionales de gestión de gastos y contabilidad, y los ERP/contables locales con módulos propios). **No se ha hecho aquí un análisis comparativo verificado**; antes de afirmar «somos distintos» hay que revisar, con acceso a demostraciones reales, qué cubren hoy en: validación fiscal española (NIF, retenciones), conciliación bancaria, canal WhatsApp y precios para gestorías. La diferenciación que se defiende arriba es una hipótesis hasta entonces.

## 5. Encaje con ENISA (según fuentes secundarias; verificar en enisa.es)

Las condiciones siguientes proceden de guías de terceros ([Intelectium](https://www.intelectium.com/en/post/enisa-startups-espana), [Premoney](https://www.premoney.es/blog/enisa), [IDR Consulting](https://idrconsulting.com/financiacion/enisa/emprendedoras-digitales), [Extremadura Empresarial](https://www.extremaduraempresarial.es/ayuda/enisa-emprendedoras-digitales/)); no se pudo acceder a la web oficial desde este entorno. **Confirme la convocatoria vigente antes de planificar nada.**

- Son **préstamos participativos** (no subvenciones), sin garantías reales ni personales, entre unos 25.000 € y 1.500.000 € según la línea, con carencia larga. Hay que devolverlos.
- Requisitos que repiten las guías: pyme con domicilio social en España; proyecto viable técnica y económicamente con **modelo de negocio innovador**; **fondos propios al menos iguales al préstamo** (según varias guías); excluidos sectores inmobiliario y financiero; con importes altos, cuentas auditadas.
- **Líneas distintas con criterios distintos.** La línea *Emprendedoras Digitales* exige liderazgo femenino y las fuentes **discrepan** sobre cómo se define (presencia en dirección, o más del 20 % del capital, o mayoría). Si la sociedad no cumple, esa línea no es para ustedes. Hay otras líneas (p. ej., jóvenes emprendedores, con límite de edad del fundador, y crecimiento) cuyos criterios habría que comprobar.

**Puntos fuertes frente a esos criterios:** producto funcionando y no solo una idea; tecnología con una ventaja explicable; mercado concreto.
**Puntos débiles que hay que resolver antes de solicitar:**
1. **Sin tracción**: ningún cliente ni piloto. ENISA valora equipo, mercado y evidencia de demanda.
2. **Sin plan financiero** (precios, costes de IA por documento, margen) ni fondos propios definidos.
3. **Riesgo regulatorio** sin cerrar: RGPD y subencargados de IA (ver `ESTADO_Y_LAGUNAS.md`).
4. **Dependencia de proveedores externos** (IA, WhatsApp, Open Banking) sin plan de contingencia más allá del proveedor intercambiable.

## 6. Plan de 90 días para ser financiable y vendible

| Semanas | Objetivo | Evidencia que produce |
|---|---|---|
| 1–2 | Rotar secretos, textos legales con abogado, decidir región/proveedor de IA | Riesgo regulatorio acotado |
| 2–8 | **2–3 pilotos con gestorías reales**, con cartas de intención | Demanda demostrada |
| 2–8 | Medir en los pilotos: precisión de extracción con fotos reales, horas ahorradas por cliente/trimestre, % de justificantes pendientes detectados por la conciliación | Métricas propias, no hipótesis |
| 6–10 | Importación probada en a3/Sage/Holded y Norma 43 real | Integración verificada |
| 8–12 | Modelo de precios con coste unitario real y margen; plan financiero a 3 años | Documento para ENISA y para inversores |
| 10–12 | Solicitud (si la línea y los requisitos encajan) | — |

## 7. Mensaje para las gestorías

- **Qué resuelve:** menos tecleo y menos persecución; se revisan solo las excepciones.
- **Qué no promete:** no sustituye al gestor ni presenta declaraciones; la responsabilidad sigue siendo de la gestoría. No se promete un ahorro concreto hasta medirlo en un piloto.
- **Qué pide:** unos pocos clientes difíciles durante un trimestre, y feedback sobre las excepciones.
- **Garantías que sí puede dar hoy:** base de datos en la UE, trazabilidad de cada cambio, aislamiento entre gestorías, no se almacena la imagen del justificante. **Debe revelar** que la imagen se envía a un proveedor de IA para su lectura.

## 8. Qué no afirmar

- «Cumple el RGPD» o «certificado»: no hay documentación ni auditoría que lo respalde.
- «Los datos no salen de la UE»: la base de datos sí está en Frankfurt, el procesamiento de IA no se garantiza allí.
- «Preparado para VeriFactu»: el producto no emite facturas.
- Cifras de ahorro o precisión general: solo las medidas en pilotos con datos reales.
- «Conexión bancaria automática»: hoy solo hay importación de extractos.
