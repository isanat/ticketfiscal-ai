# Competencia y estrategia — cómo destacar

Revisión del 27-11-2026. Separa lo **verificado**, lo **no verificado** y lo que es **opinión**. La lista de competidores que se pegó en la conversación proviene de otro asistente y **no está verificada**; aquí solo se confirma lo que se pudo contrastar.

## 1. Qué se pudo verificar y qué no

| Afirmación | Estado |
|---|---|
| VeriFactu se aplazó: empresas 1-1-2027, autónomos 1-7-2027 (RDL 15/2025); todas las facturas llevarán código QR | Verificado en fuentes secundarias de dic. 2025 ([Xataka](https://www.xatakamovil.com/movil-y-sociedad/gobierno-da-marcha-atras-verifactu-empresas-autonomos-tendran-tiempo-para-adaptarse), [Cuatrecasas](https://www.cuatrecasas.com/es/spain/fiscalidad/art/rdl15-sistemas-informaticos-facturacion-plazo)); contrastar con el BOE (BOE-A-2025-24446) |
| Solo la digitalización certificada con software **homologado por la AEAT** permite destruir el papel | La AEAT mantiene un procedimiento y un listado de software homologado ([sede AEAT](https://sede.agenciatributaria.gob.es/Sede/procedimientos/FZ01.shtml)); la afirmación sobre «destruir el papel» viene de fuentes comerciales; el alcance vigente hay que confirmarlo con un asesor |
| Okticket está homologado por la AEAT | **No verificado.** Comprobar en el listado vigente de la sede electrónica |
| «Kangaroo Files» (Portugal) | **No encontrada** en la búsqueda; no se debe citar |
| Tally (Portugal): captura por WhatsApp/e-mail, agente de IA, contable certificado revisa | Existe ([Tally](https://mytally.io/)); detalles de producto no verificados |
| InvoiceXpress ya usa IA en WhatsApp (para *emitir* facturas) | Verificado en prensa ([Echo Boomer](https://echoboomer.pt/invoicexpress-alarga-funcionalidade-emissao-faturas-inteligencia-artificial-whatsapp/)) |
| Pleo, Payhawk, Captio, Tickelia, Fuell, Holded, Quipu, a3, Sage hacen lo que se dice | **No verificado aquí.** Muchos son gestión de gastos con tarjeta (otro segmento) |

## 2. Dónde estamos peor (sin adornos)

1. **Validez legal de la copia digital.** No guardamos la imagen, así que no ofrecemos «destruya el papel». Quien tenga homologación AEAT ofrece eso; nosotros no. Decisión pendiente: (a) alianza con un proveedor homologado, (b) guardar la imagen solo como soporte, sin prometer sustitución del papel, o (c) homologar el propio software (proceso costoso).
2. **Cero tracción**: ningún piloto ni cliente.
3. **Integración con ERP solo por CSV**: no hay API directa con a3, Holded o Sage.
4. **Un solo canal y un solo país**: WhatsApp y España.
5. **Sin conexión bancaria automática (fuera del alcance)**: solo importación de extractos. GoCardless cerró las altas nuevas y las alternativas cuestan demasiado. Por eso la **facilidad de la importación** es una prioridad de producto.
6. **Precisión medida sobre 4 imágenes sintéticas y 3 reales.** No hay benchmark creíble.

## 3. Dónde podemos ser mejores (el foso)

### A. «Determinista primero, IA después» — leer el QR
Portugal lo hace con el QR/ATCUD de la AT: NIF, fecha, base e IVA llegan estructurados, sin margen de error, y la IA se reserva para lo que el QR no dice. **España va en esa dirección**: con VeriFactu (2027) las facturas llevarán QR. Un lector de QR como **primera vía**, con la IA como respaldo, da: cero alucinación en los datos del QR, menor coste por documento y menor latencia. Es el cambio de arquitectura de mayor impacto. *Limitación:* los tickets de caja actuales (restaurantes, gasolineras) normalmente **no** llevan QR fiscal; el beneficio crece a partir de 2027.

### B. Bucle cerrado: del cargo bancario al justificante reclamado
Ya tenemos conciliación y WhatsApp; falta unirlos: cuando un cargo del extracto no tiene justificante, **pedirlo automáticamente al cliente por WhatsApp** («Vimos un cargo de 56,10 € el 18/07 en Estación La Vía. ¿Nos envía el ticket?») y conciliarlo solo al llegar. Convierte la gestión de «perseguir» en un proceso sin intervención. Requiere plantillas de mensaje aprobadas por Meta (fuera de la ventana de 24 h) y un planificador.

### C. Memoria por gestoría
Cada corrección del gestor (cuenta PGC, tipo de IVA, deducibilidad de un proveedor) debe **aprenderse** y aplicarse a los siguientes tickets de ese proveedor en esa gestoría. Es un foso de datos real: cuantas más correcciones, mejor y más difícil de copiar. Hoy solo se sugieren 8 cuentas PGC fijas: hace falta importar el **plan de cuentas de cada gestoría** y aprender sobre él.

### D. Líneas de ticket, no solo totales
Un ticket de supermercado mezcla IVA 4 %, 10 % y 21 %. El modelo ya admite varias líneas de IVA; falta que la extracción las lea de forma fiable y las clasifique por línea (alimentación frente a limpieza, etc.). Es donde la IA aporta más que el QR.

### E. Cabina de cierre trimestral para el gestor
No solo capturar: **«¿está este cliente listo para presentar el 303?»** Comprobaciones previas (cuadre de bases y cuotas, justificantes pendientes, cargos sin documento), alerta de umbrales del 347, clientes atrasados, calendario de plazos. Convierte la herramienta en el panel de trabajo del gestor.

### F. Confianza demostrable
Panel de precisión por campo con intervalos, motivo explicado de cada aviso, registro de auditoría, y un **benchmark publicado** con un conjunto abierto de tickets españoles. Para ENISA y para las gestorías es más convincente que cualquier adjetivo.

### G. Integración directa con el software de la gestoría
API/exportación nativa a Holded y a3 (y Sage) en vez de CSV. Reduce fricción en la adopción.

## 4. Qué no hacer

- **No competir en gestión de gastos con tarjeta** (Pleo/Payhawk): otro negocio, otra regulación, otro capital.
- **No ir a Portugal antes de tener tracción en España.** Allí el QR ya hace parte del trabajo y hay jugadores locales fuertes; requiere SAF-T, ATCUD y SNC.
- **No prometer «destruya el papel»** sin homologación.

## 5. Hoja de ruta propuesta

| Prioridad | Qué | Esfuerzo | Depende de |
|---|---|---|---|
| 1 | Piloto con 2–3 gestorías y benchmark real de precisión | M (mayormente no técnico) | Contrato de encargo y política de privacidad |
| 2 | Lector de QR primero (VeriFactu/ATCUD) con IA de respaldo | M | Ejemplos reales de QR |
| 3 | Bucle cerrado: reclamar justificantes por WhatsApp | M | Plantillas Meta aprobadas, tarea programada |
| 4 | Memoria por gestoría + plan de cuentas propio | M | Datos de correcciones |
| 5 | Cabina de cierre trimestral (303/347) | M | — |
| 6 | Integraciones nativas (Holded, a3) | M–L | Acceso a sus APIs |
| 7 | Decisión de digitalización certificada (alianza u homologación) | L | Asesoría legal |
| 8 | Importación de extractos más fácil (varios archivos, vista previa, más formatos, guía de descarga) | S–M | — |

## 6. Qué cambia en el mensaje comercial

Frase defendible hoy: *«La IA lee; las reglas deciden; el banco confirma.»* Lo que **no** se puede decir todavía: «homologado», «sustituye al papel», «conexión bancaria automática» (fuera del alcance), «precisión del X %».

## 7. Pendiente de verificar antes de usar esto en una solicitud

- Estado actual del BOE de VeriFactu (fechas y convalidación).
- Listado vigente de software homologado en la AEAT.
- Funcionalidades y precios reales de cada competidor, con demostraciones.
