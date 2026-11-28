# Backlog y futuro — lo que falta, lo que se aprendió y lo que queda por leer

Actualizado el 28-11-2026. Es una lista de trabajo, no una promesa de fechas. Cada dato externo indica su fuente; lo no verificado está marcado.

## 1. Lo aprendido de las lecturas en profundidad

### 1.1 Formato del QR de VeriFactu (contrastado en 4 implementaciones abiertas)
Las cuatro coinciden (fuentes: [josemmo/Verifactu-PHP `QrGenerator.php`](https://github.com/josemmo/Verifactu-PHP/blob/main/src/Services/QrGenerator.php), [inoguerols/verifactu `qr.ts`](https://github.com/inoguerols/verifactu/blob/main/src/qr.ts), [doscientos-es/verifactu `constants.ts`](https://github.com/doscientos-es/verifactu/blob/main/src/constants.ts), [mdiago/VeriFactu](https://github.com/mdiago/VeriFactu)):

```
https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=<NIF emisor>&numserie=<serie y número>&fecha=DD-MM-AAAA&importe=<total>
```

- Pruebas: `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR`. Una de ellas usa `ValidarQRNoVerifactu` cuando no se remite a la AEAT.
- Fecha `DD-MM-AAAA`; el importe usa punto decimal (el ejemplo de mdiago es `131.4`, otro código usa dos decimales: **no hay un único formato**).
- **No verificado con la especificación oficial** (Orden HAC/1177/2024, «documento del QR»). Ninguno de los repositorios llama al servicio ni parsea su respuesta: **qué devuelve `ValidarQR`, si admite consultas automatizadas y bajo qué condiciones, se desconoce.**
- Idea: leer el QR (analizar la URL, sin dependencias) y, si la AEAT lo permite, comprobar que la factura figura en su registro.

### 1.2 Fuentes oficiales de datos (catálogo [BquantFinance](https://github.com/BquantFinance/Administracion-fuentes-publicas), fichas verificadas el 2026-10-01)
| Fuente | Dato útil | Condiciones |
|---|---|---|
| API de legislación consolidada del BOE (`https://www.boe.es/datosabiertos/api/legislacion-consolidada`) | Textos y metadatos de leyes; sin autenticación; exige cabecera `Accept`; el texto va en XML, los metadatos en JSON | Reutilización libre **con cita de la fuente**; debe indicarse que es solo informativo («Basado en datos de la Agencia Estatal Boletín Oficial del Estado») |
| API de estadísticas del Banco de España (`https://app.bde.es/bierest/resources/srdatosapp`) | Series de tipos de cambio, Euríbor… en JSON/CSV; sin autenticación | Libre con cita; las series diarias se piden por año (`rango=MAX` falla) |
| Servicios web de la AEAT (SII y VERI*FACTU) | Solo para **emitir/remitir** registros; SOAP con certificado | «No son datos abiertos»; no aplica a un producto que solo recibe facturas |

Condiciones generales de reutilización (guía del catálogo, Ley 37/2007 y RD 1495/2011): no alterar la información, citar la fuente y la fecha, no sugerir aval del organismo. **Citar mal puede ser infracción leve (1.000–10.000 €)**: si se reutiliza texto del BOE, la cita debe ir bien hecha. Revisar con un abogado.

### 1.3 Comprobación cruzada de nuestras reglas con la base de conocimiento de [gestor-es](https://github.com/gestor-es/gestor-es) (MIT, **alfa**, verificada por su autor el 08-10-2026; no es una fuente autorizada)
- **Factura simplificada:** límite de 400 € con IVA (3.000 € en comercio minorista), art. 4 RD 1619/2012. Con un tique sin NIF del destinatario no hay deducción de IVA (art. 7.2).
- **Deducción parcial o excluida (arts. 95–96 LIVA):** turismos con presunción del 50 %; exclusiones de alimentación, bebida, espectáculos, atenciones a clientes, viajes, hoteles y restaurantes salvo que el gasto sea deducible en IRPF/IS.
- **Modelo 347:** operaciones anuales con una misma contraparte superiores a 3.005,06 € (con IVA).
- **Calendario:** plazos trimestrales (del 1 al 20 de abril, julio y octubre; enero al 30 para 303/130).
- **Atención — fecha de VeriFactu:** la misma base dice que la AEAT **anunció el 05-10-2026 un aplazamiento hasta octubre de 2028, sin norma publicada**. Contradice las fechas (1-1-2027 / 1-7-2027) de otros documentos nuestros. **Comprobar en el BOE antes de usar cualquier fecha.**
- Formato de sus «fichas de fuente» (`kind`, `ref`, `url`, `quote`, `summary`, `status`, `checked`): buen modelo para que **cada regla nuestra cite su artículo con fecha de comprobación**.

### 1.4 Datos de FacturaScripts (LGPL-3.0)
- `Core/Data/Codpais/ESP/impuestos.csv` (IVA 0/4/10/21, IGIC e IPSI) y `defaultPlan.csv` (PGC completo, 1.661 líneas): sin cabecera de licencia en los propios archivos.
- Existe una API REST (controladores `Api*.php`); **no se leyó su documentación**, ni si hay importación de Norma 43 o soporte de Verifactu.

## 2. Lectura pendiente (cola)

| Qué leer | Por qué no se pudo | Qué hace falta |
|---|---|---|
| `facturascripts.com` (marketplace, documentación de la API, plugins de Verifactu/AEAT) | Dominio fuera de la lista permitida del entorno | Autorizar el dominio o pegar el contenido |
| `legalize.dev/api` (acceso, límites, precio, historial) | Ídem | Ídem |
| Especificación oficial del QR y de Norma 43 (AEAT; PDF de Cajamar y Laboral Kutxa) | Ídem | Ídem |
| Leyes concretas en `legalize-es` (LIVA, RD 1619/2012, RD 1007/2023, Orden HAC/1177/2024) | No se localizaron las rutas (sin acceso a la API de GitHub para listar el árbol) | Clonar el repositorio y buscar por el identificador BOE, **o** usar la API oficial del BOE (preferible) |
| Código de los controladores `Api*.php` de FacturaScripts | No se abrieron | Lectura posterior |
| Textos de LIVA arts. 90–97 y RD 1619/2012 arts. 4, 6, 7 **desde el BOE** | No se obtuvieron | API del BOE o lectura manual, y revisión por un profesional |

«Programar» estas lecturas depende de que se autoricen los dominios o se aporte el contenido; se puede fijar un recordatorio con fecha si se indica una.

## 3. Lo que aún no está hecho

### 3.1 Antes de lanzar con clientes reales (bloqueantes)
- Contrato de encargo del tratamiento (art. 28 RGPD), política de privacidad revisada (hay una página `/privacidad` creada para Meta: revisarla con un abogado), condiciones de uso, RAT, EIPD, procedimiento de brechas.
- Decidir región y proveedor de IA y sus subencargados; reflejarlo en el contrato.
- **Rotar todas las credenciales** (las que pasaron por el chat, el token permanente de Meta, claves de IA, base de datos, tokens y claves de administración); **borrar `EVAL_TOKEN` en Vercel** (producción y preview).
- Recuperación de la cuenta del administrador; restablecimiento de contraseña y verificación de e-mail de gestores y clientes.
- Copias de seguridad externas y prueba de restauración; alertas y monitorización; prueba de carga y de intrusión.
- Dominio propio (también para e-mail 2FA con Resend y para direcciones de archivos).
- Plantilla de WhatsApp aprobada por Meta (`docs/PLANTILLA_WHATSAPP_RECLAMO.md`).

### 3.2 Producto
- **Reglas fiscales (de la comprobación cruzada):** límite de la factura simplificada (400 € / 3.000 €); deducción parcial o excluida (vehículos 50 %, atenciones, hostelería); alerta de umbral del 347 por contraparte; conversión de moneda extranjera.
- Cada aviso con su **artículo y fecha de comprobación** (modelo de fichas), revisado por un profesional.
- Lector de QR (VeriFactu/ATCUD) como primera vía; verificación en la AEAT si se permite.
- Memoria por gestoría (correcciones → reglas) y plan de cuentas propio (puede partir del PGC de FacturaScripts, comprobando licencia).
- Clasificación por líneas del ticket; cabina de cierre trimestral (303, 347, calendario).
- Integraciones directas: FacturaScripts, Holded, a3, Sage (hoy solo CSV).
- Decisión sobre conservar la imagen original (almacenamiento privado cifrado en la UE) y sobre digitalización certificada (alianza u homologación).
- Reclamación de justificantes: responder al cliente al llegar la foto y avisar al gestor; ajustes tras probar con un número real.
- Facturación a las gestorías (cobro), planes y límites.
- Validar el lector de Norma 43 con la especificación y con extractos reales.

### 3.3 Fuera del alcance (decidido)
- Conexión bancaria automática (Open Banking): GoCardless cerró altas y las alternativas cuestan demasiado. Solo importación (CSV, Excel, Norma 43).

### 3.4 Negocio y evidencia
- Una persona que ejerza como gestor/asesor en España que revise las reglas y los documentos (ver §4).
- Comprobantes y tickets reales para pruebas (ver §4).
- Pilotos con 2–3 gestorías; benchmark de precisión; plan financiero; análisis de competidores con demostraciones reales.

## 4. Plan para conseguir validación real

### 4.1 Una persona que ejerza la gestoría en España
Opciones, de menor a mayor compromiso (**ninguna está verificada; son vías a explorar**):
1. **Revisión de pago, acotada.** Contratar unas horas a un gestor o asesor fiscal autónomo (LinkedIn, plataformas de freelance) para revisar: la lista de reglas (documento claro de una página), 20–30 justificantes de ejemplo y las salidas del sistema. Entregable concreto: una lista de «correcto / incorrecto / falta». Presupuesto a pedir, no a suponer.
2. **Socio de diseño.** Ofrecer uso gratuito durante un trimestre a una gestoría pequeña a cambio de una llamada semanal y de que corrijan lo que el sistema hace mal. Preparar una demostración de 5 minutos y una página que explique con honestidad qué hace y qué no.
3. **Colegios y asociaciones profesionales** (colegios de gestores administrativos, de economistas, asociaciones de autónomos): suelen tener canales para contactar a sus miembros. *No verificado:* qué ofrecen a startups.
4. **Comunidad de brasileños en España.** Muchos autónomos y pequeñas empresas de ese colectivo usan gestoría; un contacto allí puede presentarle a su gestor. Sin verificar.
5. **Programas de ENISA, incubadoras o cámaras de comercio**: algunos incluyen mentoría; comprobar cada convocatoria.

### 4.2 Comprobantes y tickets reales
1. **Voluntarios con consentimiento:** fotos de tickets propios, borrando o difuminando datos personales; un formulario sencillo con la finalidad y la posibilidad de retirar el consentimiento.
2. **Pilotos:** compartición voluntaria y anonimizada de justificantes reales dentro del contrato con la gestoría.
3. **Conjunto sintético:** generar cientos de tickets españoles artificiales (distintos comercios, tipos de IVA, formatos, desenfoque, arrugas, rotaciones, sombras) con la **respuesta correcta conocida**, para medir regresiones. Sirve para probar, **no para afirmar una precisión real**.
4. **Imágenes públicas de tickets:** válidas para pruebas internas; no para cifras comerciales ni para publicar.
5. Conjuntos públicos de recibos (SROIE, CORD) son de otros países e idiomas: útiles solo para pruebas de robustez.

> Los tickets reales contienen datos personales (NIF, nombres, hábitos de compra): tratarlos con el mismo rigor que en producción.
