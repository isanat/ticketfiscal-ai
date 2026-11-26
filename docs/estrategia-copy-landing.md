# TicketFiscal AI — Documento estratégico de copy y microcopy

**Ámbito:** landing institucional y microcopy de los portales (gestor y cliente).
**Registro:** institucional y sobrio, terminología de la AEAT, sin anglicismos innecesarios, sin promesas de startup.
**Vigencia:** redactado a partir de las guías y normativa verificadas en noviembre de 2026 (véase la nota final, §7).

---

## 1. Copy deck de la landing

### Hero

**Eyebrow:** Captura documental fiscal para gestorías y asesorías

**H1:** Del WhatsApp del cliente al asiento contable verificado.

**Subheadline:** TicketFiscal AI extrae, valida y clasifica cada factura que las empresas de su cartera le reenvían por WhatsApp, con control aritmético del IVA y exportación directa a a3, Sage y Holded. El despacho revisa; la plataforma teclea.

**CTA principal:** Ver la demostración
**CTA secundario:** Solicitar sesión con un consultor

### Barra de confianza (4 sellos)

- Conforme al RGPD · Encargado del tratamiento
- Datos alojados en la Unión Europea
- Reglamento de facturación · RD 1619/2012
- Preparado para el Modelo 303 · AEAT

### Cómo funciona (3 pasos)

1. **Reenvío por WhatsApp.** El cliente fotografía el ticket o la factura y lo reenvía al número de WhatsApp de la gestoría. Sin aplicaciones, sin altas, sin formación.
2. **Extracción y validación.** La plataforma lee emisor, NIF, fecha, base, cuotas y total, comprueba el dígito de control y cuadra la aritmética del IVA con tolerancia de 0,02 €.
3. **Revisión y exportación.** El gestor valida cada documento en la bandeja de revisión con la imagen del original al lado, y el lote de asientos se exporta a a3, Sage o Holded.

### Funcionalidades (6 tarjetas)

1. **Validación de NIF, NIE y CIF.** Dígito de control verificado carácter a carácter y consulta al VIES de la Comisión Europea, que devuelve razón social y domicilio para el alta del proveedor sin teclear.
2. **Control aritmético del IVA.** Base + cuota − retención = total, con tolerancia de 0,02 €, tipos 21/10/4/0 % e identificación de facturas simplificadas con comprobación de su deducibilidad conforme al art. 97 LIVA.
3. **Multi-empresa de verdad.** Una gestoría, N empresas y N números de WhatsApp autorizados, con aislamiento de datos por empresa y cierre por trimestre.
4. **Exportación a a3, Sage y Holded.** Lote de asientos listo para importar, con la cuenta del PGC propuesta (600, 621–629) y contrapartidas 472 y 4751. Sin hojas de cálculo intermedias.
5. **Conciliación bancaria (en desarrollo).** Remesas de extractos por PSD2 (GoCardless) para casar justificante y pago antes de cerrar cada trimestre.
6. **VeriFactu.** Hoja de ruta alineada con el RD 1007/2023 y la Orden HAC/1177/2024: facturación con trazabilidad, encadenamiento y firma para los clientes del despacho.

### Seguridad y protección de datos

**Título de la sección:** Sus datos, tratados como los trata un despacho.

- **Encargado del tratamiento.** TicketFiscal AI actúa únicamente como Encargado del Tratamiento conforme al art. 28 del RGPD y a la LOPDGDD: la gestoría conserva la condición de Responsable y la relación con sus clientes. Acuerdo de encargo y registro de subencargados —incluido el canal de WhatsApp (Meta Platforms Ireland)— a disposición de su asesoría jurídica o de su delegado de protección de datos.
- **Alojamiento en la Unión Europea.** Los justificantes y las bases de datos residen en centros de datos de la UE (Frankfurt), cifrados en tránsito y en reposo. Sin transferencias internacionales.
- **Minimización de datos.** Solo se extraen los datos fiscales imprescindibles —emisor, NIF, fecha, base, cuotas y total— y se conservan durante el plazo de prescripción de cuatro años (art. 29 LIVA), con eliminación automática a su vencimiento. Ningún justificante se emplea para entrenar modelos de terceros.

### Bloque de credenciales de demostración

**Título:** Véalo trabajar con una cartera de ejemplo.

**Cuerpo:** Entre con las credenciales de demostración en una gestoría ficticia con doce empresas y un trimestre completo de documentación: facturas válidas, pendientes de revisión, ilegibles y descuadres incluidos. Los datos se restauran cada noche, de modo que puede probar cualquier flujo sin riesgo. Sin instalación y sin tarjeta.

**CTA principal:** Entrar en la demostración
**Enlace secundario:** Prefiero una sesión guiada de 20 minutos; un consultor configura con usted su primera empresa real.

*Nota de estrategia:* el gesto profesional no es la "prueba gratis sin compromiso", sino el acceso inmediato a datos verosímiles más la oferta de acompañamiento. Nunca descuentos ni contadores de urgencia.

### Pie de página

**Línea de posicionamiento:** TicketFiscal AI — la capa de captura documental para gestorías y asesorías fiscales españolas.

**Advertencia:** TicketFiscal AI es una herramienta de apoyo a la gestión documental y contable. No constituye asesoramiento fiscal ni sustituye el criterio del profesional responsable, que deberá verificar cada asiento antes de presentar las autoliquidaciones ante la Agencia Tributaria.

---

## 2. Microcopy de los portales

### Portal gestor (sidebar navy)

**Navegación:** Resumen · Empresas · Bandeja de revisión · Exportar. (Más adelante: Proveedores, Ajustes.)

**KPI del panel Resumen** (todos con subtítulo de período: "3T 2026 · Modelo 303"; valores de ejemplo):
- **Documentos del trimestre** — 412
- **Pendientes de revisión** — 27
- **IVA soportado deducible** — 8.431,19 €
- **Retenciones de IRPF** — 512,40 €

**Estados de documento:**
- **Válido** — "Cuadra y el NIF es correcto."
- **A revisar** — siempre con el motivo visible: "Descuadre de 0,14 € entre base + cuota y total." / "NIF con dígito de control no válido." / "Posible duplicado: esta misma factura se recibió el 12/09." / "Factura simplificada sin datos del destinatario: IVA no deducible (art. 97 LIVA)."
- **Ilegible** — "La imagen no permite leer el importe. Se ha pedido al cliente una nueva fotografía."

**Estados vacíos:**
- *Sin empresas:* "Aún no hay empresas asignadas a la gestoría. Dé de alta la primera empresa y vincule el número de WhatsApp autorizado; los justificantes empezarán a llegar solos." — Botón: "Dar de alta una empresa".
- *Sin documentos:* "Sin justificantes en este período. En cuanto la empresa reenvíe su primer ticket por WhatsApp, aparecerá aquí en segundos."
- *Bandeja vacía:* "Bandeja al día: no queda ningún documento pendiente de revisión del 3T 2026." — Enlace: "Ver resumen del trimestre".

**Exportación con confirmación:**
- Botón: "Exportar lote de asientos".
- Diálogo: "Se van a exportar 385 asientos de 12 empresas correspondientes al 3T 2026 (Modelo 303), en formato a3. Los documentos en estado 'A revisar' o 'Ilegible' quedan excluidos." — Botones: "Cancelar" / "Descargar lote".
- Confirmación posterior: "Lote generado: 385 asientos · 8.431,19 € de IVA soportado · archivo a3_3T2026.csv. También disponible en Historial de exportaciones."

### Portal cliente

**Saludo:** "Buenas tardes, Marta. Su gestoría, García & Asociados, ya ha recibido sus justificantes."

**Aviso de envío (permanente):** "Reenvíe la foto del ticket o de la factura por WhatsApp al +34 600 123 456. No hace falta que la recorte ni que rellene nada: aparecerá aquí en unos segundos." — Consejo: "Guarde el número en su agenda con el nombre de la gestoría."

**Estados de sus documentos:**
- "Recibido — pendiente de revisión"
- "Revisado — contabilizado por su gestoría"
- "No se aprecia bien — reenvíe otra foto, con el documento completo en el encuadre"

**Aviso educativo (IVA no deducible, art. 97 LIVA):** "Este justificante es una factura simplificada. Para poder deducir el IVA, la ley pide una factura completa o una simplificada con sus datos fiscales y la cuota desglosada (art. 97 de la Ley del IVA). Es un trámite habitual: pida la factura completa en el establecimiento —basta con enseñar el ticket— y reenvíela cuando la reciba. Mientras tanto, el gasto queda registrado, solo que sin IVA deducible."

---

## 3. Terminología fiscal: confirmaciones y correcciones

- **Lote contable** — Ajustar a **"lote de asientos"**. En el despacho se importa "un lote de asientos" a a3 o a Sage; "lote contable" se entiende, pero suena a calco de producto.
- **Cola de revisión** — Ajustar a **"bandeja de revisión"** o "pendientes de revisar". "Cola" es jerga de ingeniería; el asesor trabaja con bandejas (Sede, notificaciones, correo).
- **Liquidación del Modelo 303** — Corregir: **"autoliquidación del Modelo 303"**. La AEAT denomina al 303 "autoliquidación periódica"; "liquidación" designa, en rigor, un acto de la Administración. En la conversación del despacho: "el 303 del trimestre".
- **Base imponible** — Correcto.
- **Cuota de IVA** — Correcto; en gastos conviene precisar **"cuota soportada"** (frente a "devengada", propia de ventas).
- **Retención de IRPF** — Correcto. Formalmente, "retención a cuenta del IRPF"; las practicadas en facturas de gasto se declaran en el Modelo 111 (profesionales) o 115 (arrendamientos).
- **Factura simplificada cualificada** — Término legal vigente y correcto, pero de uso minoritario en el día a día: resérvese para la aclaración (tooltip), no para la etiqueta. Nota importante para el motor de reglas: una simplificada con NIF del destinatario, domicilio y cuota consignada por separado **sí permite deducir** (guía AEAT vigente); el sistema no debe marcar toda simplificada como no deducible, sino comprobar si reúne esos requisitos.
- **Factura completa** — Aunque el Reglamento de facturación la llama simplemente "factura", la propia AEAT emplea "factura completa" en su guía oficial de tipos de factura. Mantenerla en la interfaz es defendible y más claro para el cliente final.
- **Justificante** — Correcto y natural ("justificante del gasto", "justificante contable").
- **Asiento contable** — Correcto; el coloquial es "apunte".
- **VeriFactu 2027** — No fijar año en la comunicación: el calendario ha variado en dos ocasiones y en octubre de 2026 Hacienda anunció un aplazamiento a octubre de 2028 pendiente de BOE. En la tarjeta: "VeriFactu (RD 1007/2023)"; en el plan de producto, seguimiento trimestral del calendario.

---

## 4. Expectativas UX de un gestor español (usuario de a3/Sage)

- **Densidad antes que aire.** El usuario de a3 procesa cientos de líneas por sesión: tablas compactas (30–40 filas visibles), columnas ordenables (fecha, proveedor, NIF, base, cuota, retención, total, estado, cuenta) y filtros persistentes. Un diseño de tarjetas amplias se lee como "juguete".
- **El trimestre es la unidad natural de tiempo.** Selector de período tipo "3T 2026 (Modelo 303)", con opción mensual para empresas en devengo mensual. Y una regla fiscal que no puede fallar: los documentos se imputan por **fecha de devengo**, no por fecha de envío o recepción.
- **Nada de cajas negras.** Cada "A revisar" muestra el motivo exacto y la operación que no cuadra (por ejemplo, "100,00 + 21,00 ≠ 118,00"), con la imagen del original al lado y el dato corregido resaltado. La confianza nace de ver el cálculo, no de fiarse de la IA.
- **Teclado y navegación por lista.** Intro valida y avanza al siguiente documento; flechas para moverse; búsqueda instantánea por NIF o número de factura. El gestor encadena 200 documentos seguidos.
- **Exportación sin fricción.** Formatos nativos de a3 y Sage documentados y estables, que respeten subcuentas y contrapartidas (410, 472, 4751), con recuento de asientos en la confirmación. Cualquier paso intermedio ("abra esta hoja de cálculo y…") destruye la propuesta de valor.
- **Rastro de auditoría.** Quién validó, quién corrigió y cuándo. El despacho responde ante su cliente y, en última instancia, ante la AEAT.

**Qué le haría desconfiar de inmediato:** totales que se corrigen solos sin registro del cambio; ausencia de la imagen original junto al dato extraído; marketing de "IA mágica" sin validación determinista visible; anglicismos o interfaz parcialmente en inglés; no identificar al encargado del tratamiento; y confundir fecha de recepción con fecha de devengo.

---

## 5. Checklist: MVP frente a profesional

1. **Estética de mensajería** (verde WhatsApp, tono jocoso) — Sustituida por navy institucional, esmeralda fiscal y titulares de serifa: el color comunica banca y despacho, no chat.
2. **Demo de juguete** ("Juan Pérez", tickets de 4 €) — Sustituida por una cartera ficticia verosímil: doce empresas, NIF válidos, descuadres, duplicados e ilegibles de un trimestre real.
3. **Página única con pestañas y sin acceso** — Sustituida por portal con autenticación, selector de gestoría y aislamiento por empresa visible y auditable.
4. **Copy de startup y anglicismos** — Sustituido por terminología AEAT en la interfaz ("autoliquidación", "base imponible", "devengo") y registro institucional.
5. **Silencio jurídico** — Sustituido por sección de RGPD con encargado del tratamiento, alojamiento en la UE y minimización, más pie con advertencia de verificación profesional.

---

## 6. VIES y autocompletado: comunicar los tres resultados

Principio rector: el VIES **enriquece, no filtra**. Nunca bloquea el flujo de trabajo ni se presenta como registro censal: cada Estado miembro lo actualiza a su ritmo.

**Caso A — NIF válido y registrado en el VIES.** Chip "Proveedor verificado en el VIES" junto al campo. Texto: "Razón social y domicilio cargados del registro VIES de la Comisión Europea. Revise los datos y confirme el alta del proveedor." (Campos prerrellenados y editables, con la marca de origen "VIES".)

**Caso B — NIF con formato y dígito de control correctos, sin registro en el VIES.** Indicador neutro, nunca rojo: "NIF válido, no registrado en el VIES". Texto: "El dígito de control es correcto. No figura en el VIES, algo habitual en autónomos y sociedades que no realizan operaciones intracomunitarias. La factura es igualmente válida como gasto; complete manualmente el alta del proveedor." — Es el caso más frecuente y el que más daño hace si se comunica como error.

**Caso C — Dígito de control no válido.** Error real, en rojo, que bloquea la contabilización. Etiqueta: "NIF no válido". Texto: "El dígito de control no se corresponde con el número leído. Compruebe la imagen original: lo habitual es una O confundida con un 0, o viceversa. El documento queda pendiente de revisión hasta que se corrija."

**Caso D (operativo) — Servicio VIES no disponible.** El servicio de la Comisión cae con cierta frecuencia. Texto: "El servicio VIES no responde ahora mismo. El documento sigue procesándose con normalidad; la consulta del proveedor se reintentará automáticamente." (Estado visible en la ficha del proveedor; nunca un bloqueo de la bandeja.)

---

## 7. Nota de vigencia normativa (noviembre de 2026)

- **Factura simplificada:** guía AEAT de tipos de factura: emitible hasta 400 € IVA incluido (3.000 € en ventas al por menor, hostelería y otros supuestos tasados); la deducción con factura simplificada exige NIF del destinatario, domicilio y cuota repercutida consignada por separado (art. 97 LIVA y RD 1619/2012, tras las modificaciones del RD 1007/2023).
- **VeriFactu:** RD 1007/2023 y Orden HAC/1177/2024; calendario sucesivamente aplazado. Nota informativa de Hacienda de 5 de octubre de 2026 que prevé la adaptación de los sistemas antes del 6 de octubre de 2028, pendiente de publicación en el BOE. Recomendación: no imprimir años en la landing.
- **Conservación de justificantes:** cuatro años (art. 29 LIVA y art. 19 RD 1619/2012), base de la política de retención comunicada en el apartado de RGPD.
