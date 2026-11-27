# TicketFiscal AI — Estado del proyecto y lagunas

Revisión técnica y de producto a fecha de 26-11-2026. Escrita para decidir qué falta antes de lanzar, no para vender.
Cada punto indica si está **hecho y verificado**, **hecho sin verificar contra el servicio real** o **pendiente**.

## 1. Qué hay hecho y verificado

| Área | Estado | Cómo se verificó |
|---|---|---|
| Multi-tenencia (gestoría → empresas → documentos) con aislamiento por gestoría | Hecho | Pruebas e2e locales: un gestor y un cliente no ven datos ajenos (404) |
| Sesiones en base de datos, revocables; scrypt; límites de uso; CSRF por origen; cabeceras/CSP | Hecho | ~40 comprobaciones e2e locales |
| Motor fiscal determinista (NIF/CIF, IVA 0/4/10/21 con varias líneas, IRPF, fechas, confianza) | Hecho | 83+ pruebas unitarias; la IA no puede mejorar el estado que fija el motor |
| Extracción con IA: Gemini, Claude y GLM tras una interfaz común | Hecho | Gemini `gemini-3.5-flash-lite`: 4/4 muestras con 10/10 campos (4–6 s). **Solo 4 imágenes sintéticas** |
| Administración del dueño: aprobación de gestorías, suspensión, usuarios, soporte con suplantación auditada, TOTP + códigos de respaldo | Hecho | ~60 comprobaciones e2e y recorrido con navegador real |
| Conciliación bancaria: importación CSV/Norma 43, sugerencias explicadas, confirmar/deshacer, auditoría | Hecho | 16 comprobaciones e2e + pantalla probada en navegador |
| Despliegue (Vercel) y base de datos (Neon, `aws-eu-central-1`) con migraciones automáticas | Hecho | Despliegues en producción en estado READY |
| CI (tipos, lint, pruebas) | Hecho | Workflow en `.github/workflows/ci.yml` |

## 2. Hecho pero sin verificar contra el servicio real

1. **Norma 43 y extractos reales (CSV/Excel).** Los lectores se probaron con archivos sintéticos (incluidos .xlsx reales generados con otra herramienta) y **nunca con un extracto de un banco español**; las posiciones de Norma 43 no se han contrastado con la especificación oficial (los PDF públicos de Cajamar y Laboral Kutxa no son accesibles desde el entorno de desarrollo). Mitigación: si un archivo no se reconoce, la pantalla ofrece una «firma del formato» (letras → A, cifras → 9, sin datos personales) que el cliente del piloto puede copiar para que se soporte ese banco. Pendiente: contrastar con la especificación oficial y con extractos reales del piloto.
2. **WhatsApp Cloud API (Meta).** Webhook, firma y respuestas implementados; no hay credenciales de Meta cargadas, así que nunca se ha ejecutado de extremo a extremo.
3. **Calidad de extracción con fotos reales.** Las muestras eran limpias. Los tickets reales (arrugados, torcidos, térmicos descoloridos) darán peor resultado; hay que medirlo con un conjunto de, al menos, 100–200 tickets reales etiquetados.
4. **Anthropic.** La clave carece de crédito; el proveedor está implementado y probado con respuestas simuladas, no con llamadas reales.

## 3. Lagunas pendientes

> **Fuera del alcance (decisión del dueño, 27-11-2026):** la conexión bancaria automática (Open Banking). GoCardless cerró las altas nuevas y las alternativas tienen un coste elevado. La conciliación se hace importando el extracto (CSV, Excel o Norma 43).

### 3.1 Cumplimiento y legal (bloqueantes para lanzar con clientes reales)
- **Contrato de encargo del tratamiento (art. 28 RGPD)** y políticas de privacidad, cookies y condiciones de uso: **no existen**. Debe redactarlos un abogado.
- **Subencargados de IA.** Las imágenes de tickets salen hacia el proveedor de visión (Google/Anthropic/z.ai). La base de datos está en Frankfurt, **pero el procesamiento de IA no se garantiza dentro de la UE**. Hay que decidir proveedor y región, firmar sus condiciones de tratamiento y reflejarlo en el contrato. Con GLM (z.ai) hay una cuestión adicional de transferencia internacional que conviene evitar para datos fiscales.
- **Derechos de los interesados** (acceso, rectificación, supresión, portabilidad): sin procedimiento ni herramienta. El borrado lógico y la conservación fiscal deben conciliarse con la supresión.
- **Registro de actividades de tratamiento, evaluación de impacto y brechas de seguridad:** sin documentar.
- **Conservación.** Hoy no se guarda la imagen original (solo datos extraídos y hash). Para algunos usos fiscales las gestorías querrán conservar el justificante; hay que decidirlo (almacenamiento privado cifrado en UE) o dejarlo explícito.

### 3.2 Seguridad y operación
- Rotar **todos** los secretos que se pegaron en el chat durante el desarrollo (token de Vercel, clave de Neon, PAT de GitHub, clave de Gemini, contraseña de la base de datos). Se dijo que lo hará el equipo de producción antes del lanzamiento; es condición de lanzamiento.
- `ADMIN_BOOTSTRAP_TOKEN`, `ADMIN_ENCRYPTION_KEY` y `EVAL_TOKEN` se generaron en el entorno de pruebas y se compartieron en el chat: **sustituir**. `EVAL_TOKEN` ya no hace nada (el endpoint se eliminó) pero debe borrarse de Vercel.
- **Recuperación de la cuenta del administrador:** no hay flujo de recuperación si se pierden el autenticador y los códigos de respaldo.
- **Copias de seguridad y recuperación ante desastres:** Neon ofrece historial limitado (en este proyecto 6 horas). Definir copias externas, RPO/RTO y probar una restauración.
- **Monitorización y alertas:** hay registros estructurados, pero no hay alertas ni panel de errores (p. ej. Sentry), ni de latencia/coste de IA por gestoría.
- **Verificación de e-mail en el alta** y restablecimiento de contraseña de gestores/clientes: no implementados. El segundo factor por e-mail está programado pero **desactivado** hasta tener dominio verificado en Resend.
- **Pruebas de carga y de intrusión:** no realizadas. Una auditoría externa antes de manejar datos de terceros es recomendable.
- **Protección de los dominios de Vercel** (SSO de previsualización): decisión pendiente del dueño.
- **Prisma 7:** se mantiene Prisma 6.19 por decisión consciente; planificar la migración.

### 3.3 Producto
- **Cobro y planes:** no hay facturación a las gestorías (Stripe u otro). Requiere decisión de precios y autorización.
- **Portal del cliente:** no incluye aún la conciliación; el componente ya admite el modo cliente.
- **Conciliación:** solo cargos (gastos) y emparejamiento 1 a 1. Faltan pagos parciales/agrupados (un cargo que paga varias facturas), comisiones, y reglas por proveedor recurrente.
- **Exportación contable:** formato CSV genérico para a3/Sage/Holded verificado con la estructura documentada, **no importado en los programas reales**. Probar con un cliente real de cada software.
- **Modelo 303:** hay un resumen de bases y cuotas por tipo; no es una autoliquidación presentable ni sustituye al gestor.
- **VeriFactu:** afecta a quien *emite* facturas; este producto captura gastos, por lo que el impacto directo es menor. No se afirma cumplimiento; confirmar con un asesor las fechas y el alcance vigentes.
- **Idiomas y accesibilidad:** solo español. No se ha hecho una auditoría WCAG formal.
- **Datos de demostración:** el sembrado de demostración (`SEED_DEMO`) debe permanecer desactivado en producción; ya lo está. La portada ya no muestra credenciales de demostración.

### 3.4 Negocio
- **Sin clientes ni pilotos:** es la mayor debilidad para cualquier financiador o comprador. Ver `POSICIONAMIENTO_ENISA_GESTORIAS.md`.
- **Costes unitarios sin medir** (el dueño decidió no medirlos por ahora): sin ellos no se puede fijar precio con margen.
- **Competencia no analizada con rigor.**

## 4. Orden recomendado

1. Rotar secretos y fijar los de producción (condición de lanzamiento).
2. Documentación legal con abogado y decisión sobre región/proveedor de IA.
3. Piloto con 2–3 gestorías reales: medir extracción con fotos reales, probar importación en su software y la conciliación con su banco (Norma 43 real).
4. Alertas, copias de seguridad y recuperación del administrador.
5. Cobro.
