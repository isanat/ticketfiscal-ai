# TicketFiscal AI

> Del WhatsApp del cliente al asiento contable. Plataforma fiscal multi-tenant para gestorías y asesorías españolas: captura de justificantes por WhatsApp, extracción con IA, validación según la AEAT (RD 1619/2012) y exportación del lote de asientos a a3, Sage o Holded.

Sistema SaaS con autenticación y dos portales separados:

- **Portal de gestoría** — una cuenta de asesor gestiona toda su cartera: resumen de la cartera, empresas con sus métricas, bandeja de revisión con el motivo exacto de cada pendiente, autoliquidación del Modelo 303 por tipo de IVA y exportación CSV del lote de asientos.
- **Portal de empresa** — el cliente reenvía la foto del ticket o factura por WhatsApp (simulación fiel del canal real), ve el estado de cada justificante y los avisos educativos (p. ej. IVA no deducible por factura simplificada, art. 97 LIVA).

## Cuentas de demostración

| Perfil | Email | Contraseña |
| --- | --- | --- |
| Gestoría (Ana Ruiz) | `ana@gestoriaalboraya.es` | `demo1234` |
| Cliente — Taller Pérez e Hijos | `juan@tallerperez.es` | `demo1234` |
| Cliente — Panadería Dulce Levante | `marta@panaderiadulce.es` | `demo1234` |
| Cliente — Clínica Dental Sonrisa | `maria@clinicadentalsonrisa.es` | `demo1234` |

Cartera sembrada: 1 gestoría, 3 empresas y 13 justificantes de dos trimestres, con todos los casos que un asesor quiere ver: válidos, descuadres de IVA, CIF con dígito de control erróneo, retención de IRPF del 15 % (art. 100 LIRPF), ilegibles y facturas simplificadas sin derecho a deducción.

## Qué demuestra

| Muestra incluida | Qué pone a prueba |
| --- | --- |
| `factura-completa.png` — Distribuciones Ferrallado, S.L. | Factura completa A4: NIFs de emisor y receptor, IVA 21 %, cuenta 600 del PGC. IVA deducible. |
| `ticket-restaurante.png` — Bar El Cruce | Factura simplificada con IVA 10 % incluido: cálculo retroactivo de la base y detección de **IVA no deducible** (art. 97 LIVA) con aviso para pedir la factura completa. |
| `factura-error.png` — Eléctricas del Sur, S.A. | Factura con **dos trampas**: cuota de IVA que no cuadra con la base (descuadre de 1,00 €) y **CIF con dígito de control erróneo**. El sistema marca `REQUIERE_REVISION` y explica ambos motivos. |
| `ticket-gasolinera.png` — Estación de Servicio La Vía | Ticket de gasóleo con IVA 21 % incluido: desglose retroactivo (base 46,36 € + cuota 9,74 €), cuenta 629. |

### Validación de NIF/CIF con VIES y autocompletado

`GET /api/nif/lookup?nif=…` combina dos capas y alimenta el alta de empresas y gestorías:

1. **Dígito de control determinístico** (TypeScript, sin red): NIF/NIE (letra módulo 23) y CIF (suma ponderada alternativa).
2. **Censo VIES de la Comisión Europea** (REST, sin clave): si el NIF está registrado, devuelve razón social y domicilio para prerrellenar el alta.

El servicio comunica honestamente los tres casos: registrado en VIES (datos cargados), válido pero no registrado (habitual en autónomos sin operaciones intracomunitarias) y dígito de control erróneo (bloquea el alta). Si el VIES no responde, el alta continúa: VIES enriquece, nunca filtra.

## Arquitectura

- **Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui**, tipografía editorial (Source Serif 4 + Geist) y paleta institucional navy/esmeralda
- **Multi-tenant**: 1 gestoría → N empresas → N justificantes, con aislamiento por rol en cada endpoint
- **Autenticación** con cookie httpOnly + sesiones en base de datos y contraseñas con scrypt (`src/lib/hash.ts`)
- **Prisma + SQLite** en local; capa de datos aislada (`src/lib/store.ts`) que degrada a modo memoria en serverless
- **Motor de visión GLM** vía `z-ai-web-dev-sdk` con un system prompt calibrado como auditor AEAT/PGC (`src/lib/fiscal.ts`)
- **Doble validación server-side**, independiente de la IA:
  - `src/lib/fiscal.ts` → matemática AEAT: base + cuota IVA − retención IRPF = total (±0,02 €) y coherencia cuota = base × tipo
  - `src/lib/nif.ts` → validador determinístico de NIF/NIE/CIF (dígito de control en TypeScript)
- **Imputación por fecha de devengo**: el trimestre fiscal (1T–4T) se deriva de la fecha de emisión del documento, no de la fecha de envío

```
src/
  app/
    page.tsx                      # Enrutador de vistas: landing → auth → portal (según sesión)
    api/auth/{login,registro,logout,session}/  # Autenticación con cookie httpOnly
    api/gestorias/route.ts        # Listado público para el alta de empresas
    api/nif/lookup/route.ts       # Dígito de control + censo VIES con autocompletado
    api/empresas/route.ts         # Empresas de la gestoría (solo rol GESTOR)
    api/documents/route.ts        # POST extracción IA (rol CLIENTE) · GET por rol · DELETE (GESTOR)
    api/documents/export/route.ts # Lote de asientos CSV (a3/Sage/Holded, solo GESTOR)
  lib/
    auth.ts                       # Sesiones: cookies httpOnly + helpers de rol
    hash.ts                       # scrypt para contraseñas
    fiscal.ts                     # System prompt auditor AEAT/PGC + validación matemática
    nif.ts                        # Validación determinística NIF/NIE/CIF
    store.ts                      # Capa de datos multi-tenant: SQLite/Prisma o memoria
    zai-server.ts                 # Motor de visión (SDK o fetch directo por env vars)
    seed.ts                       # Cartera de demostración multi-tenant
  components/
    landing/                      # Landing institucional
    auth/                         # Entrar / Crear cuenta con NIF lookup en vivo
    fiscal/
      gestor-portal.tsx           # Sidebar navy: resumen, empresas, bandeja, exportar
      cliente-portal.tsx          # WhatsApp + historial del cliente
      whatsapp-chat.tsx           # Canal WhatsApp con tarjeta fiscal
prisma/schema.prisma              # Gestoria, Usuario, Empresa, Documento, Sesion
scripts/gen_receipts.py           # Regenera las muestras PNG (Playwright)
```

## Puesta en marcha

```bash
bun install          # ejecuta prisma generate (postinstall)
cp .env.example .env # DATABASE_URL apunta a SQLite local
bun run db:push      # crea la base de datos
bun run dev          # http://localhost:3000
```

La primera vez, la cartera de demostración (gestoría, empresas, usuarios y justificantes) se siembra automáticamente.

### Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | No | SQLite en local. **Sin ella, la app arranca en modo memoria** (ideal para Vercel). |
| `ZAI_BASE_URL`, `ZAI_API_KEY` | No | Motor de visión en serverless. En local el SDK lee su `.z-ai-config`. Opcionales: `ZAI_TOKEN`, `ZAI_CHAT_ID`, `ZAI_USER_ID`, `ZAI_MODEL`. |

## Despliegue en Vercel

El despliegue funciona sin configurar nada:

- **Sin `DATABASE_URL`**: la capa de datos arranca en *modo memoria* con la cartera de demostración completa (el login funciona; los datos se reinician en cada arranque en frío). Conectar Supabase/Neon (PostgreSQL) solo requiere cambiar el provider de Prisma y la `DATABASE_URL` — la lógica fiscal y la UI no se tocan.
- **Sin credenciales del motor IA**: la extracción de las muestras conocidas responde en *modo demostración* (respuesta preconfigurada, etiquetada como simulada en la interfaz). Sube las variables `ZAI_*` en el proyecto de Vercel para activar la extracción real.

## Hoja de ruta

- [x] **Validación NIF/CIF determinística** — dígito de control verificado en TypeScript antes de aprobar el documento.
- [x] **Multi-tenant con autenticación** — 1 gestoría → N empresas, portales separados y aislamiento por rol. *Pendiente de producción: migrar a PostgreSQL (Supabase/Neon).*
- [x] **Censo VIES** — consulta en vivo con autocompletado de razón social y domicilio.
- [ ] **Conciliación bancaria** — GoCardless Bank Account Data: cruce del extracto real del banco español con los justificantes recibidos.
- [ ] **VeriFactu (RD 1007/2023)** — seguimiento trimestral del calendario; las reglas AEAT ya aplicadas hoy.
- [ ] **RGPD en producción** — contrato de Encargado del Tratamiento con cada gestoría (el hosting ya está en la UE).

## Aviso

Demo con **datos ficticios**. No constituye asesoramiento fiscal ni sustituye el criterio del profesional responsable, que deberá verificar cada asiento antes de presentar las autoliquidaciones ante la Agencia Tributaria. Las validaciones implementan reglas generales (RD 1619/2012, LIVA, LIRPF, PGC).
