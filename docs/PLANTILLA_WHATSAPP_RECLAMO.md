# Plantilla de WhatsApp para reclamar justificantes

WhatsApp solo permite escribir con texto libre durante las **24 h siguientes al último mensaje del cliente**.
Fuera de esa ventana hace falta una **plantilla aprobada por Meta**. Sin ella, el sistema no envía (el cargo queda
como «Sin canal» y se puede reintentar cuando el cliente escriba).

## Cómo crearla (en Meta, administrador de WhatsApp → Plantillas de mensajes)

- **Categoría:** Utilidad (*Utility*). No marketing: solo reclama un documento de una operación en curso.
- **Nombre:** `reclamo_justificante` (minúsculas, números y guion bajo)
- **Idioma:** Español (`es`)
- **Cuerpo** (4 variables, en este orden):

```
Hola, desde {{1}} necesitamos el justificante de este pago: {{2}} el {{3}} ({{4}}). ¿Puede enviarnos por aquí la foto del ticket o de la factura? Si no tiene justificante, responda «NO TENGO».
```

- **Ejemplos para la revisión de Meta:** {{1}} Gestoría Alboraya · {{2}} 56,10 € · {{3}} 18/07/2026 · {{4}} GASOLINERA LA VIA

## Cómo activarla en la aplicación

En Vercel (producción), añadir:

| Variable | Valor |
|---|---|
| `WHATSAPP_PLANTILLA_RECLAMO` | `reclamo_justificante` |
| `WHATSAPP_PLANTILLA_IDIOMA` | `es` |

Y redesplegar. Si la plantilla cambia de nombre o de variables, hay que cambiar también `parametrosPlantilla` en
`src/lib/reclamaciones.ts`.

## Reglas que aplica el sistema

- Solo lo envía una persona de la gestoría (botón «Reclamar» o «Reclamar todos»); nada se envía solo.
- Máximo **3 avisos por cargo**, separados al menos **72 h**.
- No se reclaman abonos, importes menores de 5 €, ni comisiones, intereses, impuestos, cuotas de la Seguridad Social, etc.
- Si el cliente responde «NO TENGO», la solicitud se cierra como «El cliente no lo tiene».
- Al confirmar la conciliación con un justificante, la solicitud pasa a «Resuelto».
- La gestoría puede marcar un cargo como «Omitido» (no necesita justificante).

## Pendiente de verificar

- Que Meta apruebe la plantilla (puede tardar y puede pedir cambios).
- Que el límite de mensajes de plantilla del número y la verificación del negocio permitan el volumen previsto.
- Que el cliente haya dado su consentimiento para recibir estos avisos (RGPD/LOPDGDD): debe quedar en el contrato de la gestoría.
