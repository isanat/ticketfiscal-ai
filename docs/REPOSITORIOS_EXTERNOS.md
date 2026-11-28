# Repositorios y fuentes externas revisados (28-11-2026)

Lectura de páginas públicas hecha por agentes de búsqueda; las cifras son las que mostraban las páginas ese día.
**No se pudo leer** `facturascripts.com` ni `legalize.dev` (hosts fuera de la lista de dominios permitidos del entorno),
y de los repositorios solo se leyeron las páginas principales, no el código. Nada de esto es asesoramiento legal:
las licencias hay que revisarlas con un abogado antes de copiar código.

| Fuente | Qué es | Licencia | Señales | Utilidad para nosotros |
|---|---|---|---|---|
| [FacturaScripts](https://github.com/NeoRazorX/facturascripts) | ERP/contabilidad de código abierto en PHP, con plugins y API | LGPL-3.0 | 508 estrellas, versiones casi mensuales (2026.72, 30-10) | **Destino de exportación** (integración por API/plugin) más que fuente de código. Menciona VIES y validación de NIF; Verifactu, Norma 43, OCR y modelos AEAT **no confirmados** (web no leída) |
| [gestor-es](https://github.com/gestor-es/gestor-es) | Ayudante fiscal local para autónomos y SL: motor de modelos (303, 349, 347, 390, 130, 111, 115…), calendario y base de conocimiento con fichas de fuente legal (explícita / interpretación / discutida) | MIT | **alfa**, 1 estrella, 15 commits; «no es asesoramiento fiscal»; **no cubre Verifactu** | Ideas, no código: la taxonomía de fuentes legales y el calendario. La lógica fiscal no está validada por profesionales |
| [legalize-es](https://github.com/legalize-dev/legalize-es) | Legislación consolidada del BOE en Markdown, una ley por archivo y una reforma por commit | Pipeline MIT; **datos: condiciones de reutilización del BOE, con cita obligatoria** | ~2.000 estrellas; «meramente informativo»; el historial puede estar incompleto | Enlazar cada regla con su artículo y detectar cambios por diff. `legalize.dev/api` **no evaluada** (no accesible) |
| [Administracion-fuentes-publicas](https://github.com/BquantFinance/Administracion-fuentes-publicas) | Catálogo de 102 fuentes de datos públicas con fichas YAML y servidor MCP | CC0 (cada fuente conserva su licencia) | 131 estrellas | Incluye API de legislación consolidada del BOE, series del Banco de España (tipos de cambio, JSON), servicios web de la AEAT (SII y VERI*FACTU, SOAP con certificado) y BORME. **No** incluye validación de NIF, VIES, BCE, lista de entidades bancarias ni PGC |
| [doscientos-es/verifactu](https://github.com/doscientos-es/verifactu) | Biblioteca TypeScript para **emitir** y enviar registros Veri*Factu | **Propia (DAL v1.0): prohíbe modificar, redistribuir u ofrecerla como servicio** | 2 estrellas | **No usable** en un producto SaaS por su licencia |
| [garacil/verifactu](https://github.com/garacil/verifactu) | Módulo Verifactu para Dolibarr (PHP) | GPL-3.0 | 23 estrellas | No reutilizable (copyleft, otro lenguaje) |
| [Tema verifactu](https://github.com/topics/verifactu) | 107 repositorios; destacan josemmo/Verifactu-PHP, mdiago/VeriFactu (C#), inoguerols/verifactu (TypeScript, MIT según su descripción, **no verificado**) y easybytehub/verifactu-lint | Variadas | — | Referencia para entender el formato; ninguno parece ser para **recibir** facturas |

## Qué merece la pena aprovechar

1. **Leer el QR de VeriFactu (lo más valioso).** Ninguna de las páginas documenta el formato del QR; hay que obtenerlo de la
   especificación oficial de la AEAT. Un lector propio (analizar una URL) no necesita dependencias ni licencias. Si la AEAT ofrece una consulta pública
   del QR, se podría **verificar que la factura de un proveedor existe en el registro de la AEAT**: sería un diferencial real. *No verificado:
   formato, disponibilidad ni condiciones de uso de esa consulta.*
2. **Trazabilidad legal de cada regla.** Que cada aviso cite su artículo (LIVA, Reglamento de facturación) y muestre el texto. Mejor
   hacerlo con referencias **revisadas a mano** y, si se quiere el texto, con la API oficial del BOE (legislación consolidada) antes que depender de un tercero.
3. **Tipo de cambio para recibos en otra moneda.** La regla de «recibo extranjero» hoy solo avisa; con las series del Banco de España
   o del BCE se podría **proponer el importe en euros** al gestor. *Licencia y estabilidad de esas series sin verificar.*
4. **Integración con FacturaScripts** como un destino más de exportación (junto a a3, Sage y Holded). Es de código abierto y tiene API; falta leer su documentación.
5. **Calendario y coherencia de modelos** (ideas de gestor-es): la «cabina de cierre trimestral» de la estrategia.

## Qué no hacer

- Copiar código GPL/LGPL o con licencia propia (DAL) a un producto cerrado.
- Depender de proyectos alfa o de una sola persona para la lógica fiscal.
- Presentar el texto de `legalize-es` como oficial: es informativo y exige citar la fuente.

## Pendiente de verificar

- Formato del QR y consulta pública de la AEAT (especificación técnica).
- Licencias exactas de las series del Banco de España y de la API del BOE.
- `legalize.dev/api` y `facturascripts.com` (autorizar los dominios o pegar su contenido).
