# TicketFiscal AI

> Del WhatsApp del cliente al asiento contable. Plataforma fiscal multi-tenant para gestorías y asesorías españolas: captura de justificantes (web o WhatsApp), extracción con IA, validación determinista según la AEAT (RD 1619/2012) y exportación del lote de asientos (CSV compatible con a3, Sage y Holded).

## Arquitectura

| Capa | Tecnología | Notas |
| --- | --- | --- |
| Aplicación | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 | Rutas de API en Node.js runtime |
| Hosting | Vercel, región `fra1` (Frankfurt, UE) | Despliegue de preview y producción |
| Base de datos | **Neon PostgreSQL** (región UE) | Pooler para runtime, conexión directa para migraciones |
| ORM | Prisma 6 | Migraciones versionadas en `prisma/migrations` |
| Motor de visión | Endpoint GLM (`ZAI_*`) | Timeout, reintentos y sin fallback silencioso en producción |
| Canal WhatsApp | WhatsApp Cloud API (Meta) | Webhook con firma HMAC e idempotencia por `wamid` |

### Principios de diseño

- **La IA extrae; el servidor decide.** Toda regla de validez vive en `src/lib/fiscal.ts`, es determinista y está cubierta por tests. La IA nunca puede rebajar un documento a válido ni escribir el mensaje que recibe el cliente.
- **Dinero en `Decimal(14,2)`** en base de datos y en céntimos enteros en el cálculo. Nunca `Float`.
- **Multi-tenant por construcción.** Cada consulta sobre documentos filtra por gestoría o por empresa. Un documento de otra gestoría responde 404.
- **Borrado lógico y auditoría.** Un registro fiscal no se destruye: se marca como eliminado y queda en `AuditoriaEvento`.
- **Sin estado en memoria.** Sesiones, límites de uso y datos viven en Postgres, así que cualquier instancia serverless ve lo mismo.

## Seguridad implementada

- Sesiones en base de datos con token aleatorio de 256 bits; en BD solo se guarda su hash SHA-256. Logout revoca la sesión.
- Contraseñas con scrypt (parámetros explícitos, comparación en tiempo constante).
- Respuestas de login genéricas y tiempo de respuesta uniforme para evitar enumeración de cuentas.
- Límites de uso persistentes: login, registro, consulta de NIF, gestorías, subida de justificantes y extracciones IA diarias por empresa.
- Protección CSRF por comprobación de `Origin` en métodos que cambian estado, además de cookies `SameSite=Lax`.
- Validación de todas las entradas con `zod`. Los justificantes se identifican por firma binaria (no por extensión ni por el MIME que declara el cliente), con tamaño máximo de 3 MB.
- Cabeceras de seguridad (HSTS, CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`).
- Exportación CSV protegida contra inyección de fórmulas en Excel.
- Webhook de WhatsApp: firma `X-Hub-Signature-256` obligatoria, respuesta 200 inmediata y procesamiento tras la respuesta. Un número desconocido no recibe respuesta, para no revelar qué números están registrados.
- Alta de empresas con aprobación: una empresa nueva queda **pendiente** hasta que su gestoría la aprueba. Solo las empresas aprobadas pueden enviar justificantes.
- Los errores internos no se devuelven al cliente; se registran como logs JSON sin datos personales.

## Flujo de un justificante

1. Llega por la web (simulador de WhatsApp) o por el webhook de WhatsApp.
2. Se valida el tipo real del archivo y su tamaño.
3. Deduplicación por hash SHA-256 de la imagen (no consume IA).
4. Límite diario de extracciones por empresa.
5. Extracción con el motor de visión, con esquema JSON validado.
6. Validación determinista: cuotas por tipo de IVA (0, 4, 10, 21 %), cuadre de base + cuota − retención = total, CIF/NIF con dígito de control, destinatario frente a la empresa, fecha real y no futura, confianza mínima y posible duplicado por número de factura.
7. Persistencia con líneas de IVA, auditoría y mensaje al cliente generado por el servidor.
8. La gestoría revisa: aprueba, rechaza o corrige la cuenta PGC. Después exporta el lote.

## Puesta en marcha local

Requisitos: Node 22+, [Bun](https://bun.sh) y una base de datos PostgreSQL (un proyecto o rama de desarrollo en Neon).

```bash
bun install                      # ejecuta prisma generate
cp .env.example .env             # rellene STORAGE_POSTGRES_PRISMA_URL y STORAGE_POSTGRES_URL_NON_POOLING
bun run db:deploy                # aplica las migraciones
SEED_DEMO=true bun run db:seed   # cartera de demostración (idempotente)
bun run dev                      # http://localhost:3000
```

Cuentas de demostración (solo con `SEED_DEMO=true`):

| Perfil | Email | Contraseña |
| --- | --- | --- |
| Gestoría | `ana@gestoriaalboraya.es` | `demo1234` |
| Cliente | `juan@tallerperez.es` | `demo1234` |

## Despliegue en Vercel con Neon

### 1. Base de datos (Neon)

1. Cree un proyecto en Neon con región **AWS eu-central-1 (Frankfurt)**.
2. Use ramas: `main` para producción y una rama por entorno de preview (Neon permite crear ramas desde la producción en segundos, con datos copiados).
3. De cada rama copie dos cadenas:
   - **Pooled** (host con `-pooler`) → `STORAGE_POSTGRES_PRISMA_URL` (la integración Neon de Vercel ya la incluye con `pgbouncer=true`).
   - **Directa** (sin `-pooler`) → `STORAGE_POSTGRES_URL_NON_POOLING`.

### 2. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Producción | Preview | Obligatoria |
| --- | --- | --- | --- |
| `STORAGE_POSTGRES_PRISMA_URL` | rama `main` (pooled) | rama de preview (pooled) | Sí (la inyecta la integración Neon) |
| `STORAGE_POSTGRES_URL_NON_POOLING` | rama `main` (directa) | rama de preview (directa) | Sí (migraciones) |
| `ZAI_BASE_URL`, `ZAI_API_KEY` | ✔ | ✔ | Sí, para extraer justificantes |
| `DEMO_MODE` | `false` | opcional | No |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | ✔ | opcional | Solo para el canal WhatsApp |

**No active `SEED_DEMO` ni `DEMO_MODE` en producción.** La aplicación falla al arrancar si falta `STORAGE_POSTGRES_PRISMA_URL`; no hay modo memoria.

### 3. Build y migraciones

`vercel-build` ejecuta `prisma migrate deploy && next build`. Cada despliegue aplica las migraciones pendientes antes de publicar. Si una migración falla, el despliegue falla y la versión anterior sigue activa.

Para una base nueva, siembre la demo una sola vez desde su máquina con la `STORAGE_POSTGRES_URL_NON_POOLING` de la rama correspondiente. No la siembre en producción real.

### 4. WhatsApp Cloud API

1. En Meta for Developers cree una app de tipo Business con el producto WhatsApp.
2. Configure el webhook en `https://SU-DOMINIO/api/whatsapp/webhook`, con el **verify token** igual a `WHATSAPP_VERIFY_TOKEN`. Suscríbase al campo `messages`.
3. Copie el **App Secret** (`WHATSAPP_APP_SECRET`), un token permanente de system user (`WHATSAPP_ACCESS_TOKEN`) y el ID del número (`WHATSAPP_PHONE_NUMBER_ID`).
4. Cada empresa debe tener su número en `Empresa.whatsapp` (formato E.164 sin «+»). Se rellena en el registro.

Opcional: `WHATSAPP_API_VERSION` (por defecto `v21.0`). Verifique la versión vigente de la Graph API antes de desplegar.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun run build` | Generar cliente Prisma y build de producción |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` | Tests unitarios (Vitest): reglas fiscales, archivos, CSV, contraseñas, webhook, NIF |
| `bun run db:migrate` | Crear una migración nueva en desarrollo |
| `bun run db:deploy` | Aplicar migraciones (producción) |
| `bun run db:seed` | Sembrar la demo (requiere `SEED_DEMO=true`) |

El CI (`.github/workflows/ci.yml`) valida: lockfile congelado, esquema Prisma, que las migraciones coinciden con el esquema, typecheck, lint, tests y build.

## Limitaciones conocidas

Lo que este repositorio **no** resuelve todavía y conviene decidir antes de cobrar:

- **Almacenamiento de los originales.** Hoy se guardan el hash, el tipo y el tamaño del justificante, no la imagen. Para evidencia fiscal la gestoría necesita verla: conviene un almacén privado en la UE (p. ej. Cloudflare R2 o Vercel Blob en modo privado) con URLs firmadas.
- **Verificación de email** al registrarse. Hoy el email no se confirma.
- **Derechos RGPD** (acceso, portabilidad y supresión). Falta un proceso de exportación y de supresión de datos.
- **Prisma 6.** Prisma 7 existe y cambia la configuración y los adaptadores; la migración es un trabajo aparte.
- **Conciliación bancaria** (GoCardless Bank Account Data) e **integraciones de exportación por API** (a3, Sage, Holded): siguen en la hoja de ruta.
- **Reglas fiscales.** Las reglas están implementadas según la documentación de referencia, pero deben validarse con un asesor fiscal antes de producción, en especial la deducibilidad de facturas simplificadas (art. 97 LIVA) y los plazos de conservación.
- **VeriFactu (RD 1007/2023).** Obliga al software que emite facturas. Este producto captura gastos, así que el impacto directo es menor; confirme las fechas vigentes con su asesor.

## Aviso

Datos de demostración ficticios en la cartera sembrada. Esta herramienta no constituye asesoramiento fiscal ni sustituye el criterio del profesional responsable, que debe verificar cada asiento antes de presentar las autoliquidaciones ante la Agencia Tributaria.
