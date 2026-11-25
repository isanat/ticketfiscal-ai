#!/usr/bin/env python3
"""Genera 4 justificantes españoles realistas (PNG) para la demo del extractor fiscal."""
import asyncio
import os
from playwright.async_api import async_playwright

OUT = "/home/z/my-project/public/samples"
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- Factura A4 base
def a4_invoice(body: str, footer: str = "") -> str:
    return f"""
    <html><head><meta charset="utf-8"><style>
      @page {{ size: A4; }}
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      body {{ width:794px; background:#fff; font-family:'Helvetica','Arial',sans-serif; color:#1a1a1a; padding:48px 56px; }}
      .small {{ font-size:11px; color:#555; }}
    </style></head><body>{body}{footer}</body></html>
    """

FACTURA_COMPLETA = a4_invoice("""
<div style="display:flex; justify-content:space-between; border-bottom:3px solid #1a1a1a; padding-bottom:18px;">
  <div>
    <div style="font-size:26px; font-weight:800; letter-spacing:1px;">DISTRIBUCIONES FERRALLADO, S.L.</div>
    <div style="font-size:12px; color:#333; margin-top:6px; line-height:1.7;">
      C/ Industria, 47 — Nave 3<br>46013 Valencia<br>CIF: <b>B46283917</b><br>Tel. 963 21 44 08
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:34px; font-weight:800;">FACTURA</div>
    <div style="font-size:13px; margin-top:8px; line-height:1.8;">
      Nº: <b>2025/0457</b><br>Fecha: <b>14/03/2025</b>
    </div>
  </div>
</div>
<div style="display:flex; gap:24px; margin-top:26px;">
  <div style="flex:1; background:#f4f4f4; padding:14px 16px; border-radius:4px;">
    <div style="font-size:10px; font-weight:700; letter-spacing:2px; color:#777;">CLIENTE</div>
    <div style="margin-top:6px; font-size:13px; line-height:1.7;">
      <b>JUAN PÉREZ GARCÍA</b><br>
      NIF: <b>12345678Z</b><br>
      Autónomo — Taller mecánico<br>Av. del Puerto, 128, 46022 Valencia
    </div>
  </div>
</div>
<table style="width:100%; margin-top:28px; border-collapse:collapse; font-size:12.5px;">
  <thead>
    <tr style="background:#1a1a1a; color:#fff; text-align:left;">
      <th style="padding:9px 12px;">DESCRIPCIÓN</th>
      <th style="padding:9px 12px; text-align:center;">CANT.</th>
      <th style="padding:9px 12px; text-align:right;">PRECIO</th>
      <th style="padding:9px 12px; text-align:right;">IMPORTE</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:10px 12px;">Pastillas de freno delanteras — Ref. Brembo P85-020<br><span style="color:#666; font-size:11px;">Vehículo: Ford Transit 2.2 TDCI (matrícula 8742-KXW)</span></td>
      <td style="padding:10px 12px; text-align:center;">2</td>
      <td style="padding:10px 12px; text-align:right;">38,50&nbsp;€</td>
      <td style="padding:10px 12px; text-align:right;">77,00&nbsp;€</td>
    </tr>
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:10px 12px;">Líquido de frenos DOT 4 — 1L</td>
      <td style="padding:10px 12px; text-align:center;">1</td>
      <td style="padding:10px 12px; text-align:right;">23,00&nbsp;€</td>
      <td style="padding:10px 12px; text-align:right;">23,00&nbsp;€</td>
    </tr>
  </tbody>
</table>
<div style="display:flex; justify-content:flex-end; margin-top:22px;">
  <table style="font-size:13px; min-width:290px;" >
    <tr><td style="padding:6px 10px; text-align:right;">Base imponible</td><td style="padding:6px 10px; text-align:right; font-weight:600;">100,00&nbsp;€</td></tr>
    <tr style="border-top:1px solid #ddd;"><td style="padding:6px 10px; text-align:right;">IVA (21%)</td><td style="padding:6px 10px; text-align:right; font-weight:600;">21,00&nbsp;€</td></tr>
    <tr style="border-top:2px solid #1a1a1a; font-size:16px;"><td style="padding:10px 10px; text-align:right; font-weight:800;">TOTAL FACTURA</td><td style="padding:10px 10px; text-align:right; font-weight:800;">121,00&nbsp;€</td></tr>
  </table>
</div>
<div style="margin-top:34px; font-size:10.5px; color:#555; line-height:1.8;">
  Pago mediante transferencia bancaria — IBAN ES91 2100 0418 4502 0005 1332<br>
  Factura emitida conforme al RD 1619/2012. Recargo del 1% mensual en caso de impago.
</div>
""")

FACTURA_ERROR = a4_invoice("""
<div style="display:flex; justify-content:space-between; border-bottom:3px solid #0e6b3f; padding-bottom:18px;">
  <div>
    <div style="font-size:26px; font-weight:800; letter-spacing:1px; color:#0e6b3f;">ELÉCTRICAS DEL SUR, S.A.</div>
    <div style="font-size:12px; color:#333; margin-top:6px; line-height:1.7;">
      Suministro de energía eléctrica<br>Av. de la Energía, 12 — 41020 Sevilla<br>CIF: <b>A28547963</b><br>Atención al cliente: 901 10 10 10
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:22px; font-weight:800;">FACTURA DE SUMINISTRO</div>
    <div style="font-size:13px; margin-top:8px; line-height:1.8;">
      Nº factura: <b>2025-038912</b><br>Fecha de emisión: <b>31/03/2025</b><br>Periodo: 01/03/2025 – 31/03/2025
    </div>
  </div>
</div>
<div style="display:flex; gap:24px; margin-top:26px;">
  <div style="flex:1; background:#f2f7f4; padding:14px 16px; border-radius:4px; border-left:4px solid #0e6b3f;">
    <div style="font-size:10px; font-weight:700; letter-spacing:2px; color:#555;">DATOS DEL TITULAR</div>
    <div style="margin-top:6px; font-size:13px; line-height:1.7;">
      <b>JUAN PÉREZ GARCÍA</b><br>
      NIF: <b>12345678Z</b><br>
      CUPS: ES0031405234812003XN<br>Contrato: 0445-8871 · Peaje 2.0TD
    </div>
  </div>
  <div style="width:280px; background:#fafafa; padding:14px 16px; border-radius:4px; font-size:12px; line-height:2;">
    <b>Detalle del consumo</b><br>
    Potencia contratada (P1/P2): 5,5 / 6,4 kW<br>
    Consumo periodo: 312 kWh<br>
    Lectura: 45.108 → 45.420
  </div>
</div>
<table style="width:100%; margin-top:26px; border-collapse:collapse; font-size:12.5px;">
  <tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 12px;">Potencia y energía — Peajes y cargos</td><td style="padding:8px 12px; text-align:right;">28,64&nbsp;€</td></tr>
  <tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 12px;">Energía consumida (312 kWh × 0,1041&nbsp;€/kWh)</td><td style="padding:8px 12px; text-align:right;">32,48&nbsp;€</td></tr>
  <tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 12px;">Alquiler de contador</td><td style="padding:8px 12px; text-align:right;">1,52&nbsp;€</td></tr>
  <tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 12px;">Mantenimiento y otros servicios</td><td style="padding:8px 12px; text-align:right;">23,31&nbsp;€</td></tr>
</table>
<div style="display:flex; justify-content:flex-end; margin-top:20px;">
  <table style="font-size:13px; min-width:300px;">
    <tr><td style="padding:6px 10px; text-align:right;">Base imponible</td><td style="padding:6px 10px; text-align:right; font-weight:600;">85,95&nbsp;€</td></tr>
    <tr style="border-top:1px solid #ddd;"><td style="padding:6px 10px; text-align:right;">IVA (21%)</td><td style="padding:6px 10px; text-align:right; font-weight:600;">19,05&nbsp;€</td></tr>
    <tr style="border-top:2px solid #0e6b3f; font-size:16px;"><td style="padding:10px 10px; text-align:right; font-weight:800; color:#0e6b3f;">TOTAL A PAGAR</td><td style="padding:10px 10px; text-align:right; font-weight:800;">105,00&nbsp;€</td></tr>
  </table>
</div>
<div style="margin-top:30px; font-size:10.5px; color:#555; line-height:1.8;">
  Domiciliación bancaria: IBAN ES76 0049 1500 0512 3456 7892<br>
  Esta factura se emite conforme al RD 1619/2012. Conservar para poder ejercer sus derechos de garantía.
</div>
""")

# ---------------------------------------------------------------- Tickets térmicos
THERMAL_CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#e9e5df; padding:26px 40px; font-family:'Courier New', monospace; }
.paper {
  width:330px; background:#fdfdfa; color:#111; padding:22px 20px 28px;
  box-shadow:0 3px 14px rgba(0,0,0,.22);
  transform:rotate(.5deg);
  font-size:12.5px; line-height:1.55;
  position:relative;
}
.paper::after {
  content:''; position:absolute; left:0; right:0; bottom:-8px; height:16px;
  background:linear-gradient(45deg, transparent 33.333%, #fdfdfa 33.333%, #fdfdfa 66.667%, transparent 66.667%),
             linear-gradient(-45deg, transparent 33.333%, #fdfdfa 33.333%, #fdfdfa 66.667%, transparent 66.667%);
  background-size:14px 28px; background-position:0 -14px;
}
.center { text-align:center; }
.bold { font-weight:700; }
.big { font-size:15px; }
.hr { border-top:1px dashed #999; margin:8px 0; }
.row { display:flex; justify-content:space-between; }
.right { text-align:right; }
"""

def thermal(inner: str) -> str:
    return f"<html><head><meta charset='utf-8'><style>{THERMAL_CSS}</style></head><body><div class='paper'>{inner}</div></body></html>"

TICKET_RESTAURANTE = thermal("""
<div class="center bold big">BAR - RESTAURANTE<br>EL CRUCE</div>
<div class="center">C/ Mayor, 23 - 46980 Paterna (Valencia)<br>NIF: B98765432<br>Tel. 961 52 30 14</div>
<div class="hr"></div>
<div class="center bold">FACTURA SIMPLIFICADA</div>
<div class="row"><span>Ticket nº:</span><span>00342</span></div>
<div class="row"><span>Fecha:</span><span>15/03/2025 14:32</span></div>
<div class="row"><span>Mesa:</span><span>07 / Camarero: 2</span></div>
<div class="hr"></div>
<div class="row"><span>2 x Menú del día</span><span>22,00 €</span></div>
<div class="row"><span>2 x Refresco</span><span>2,00 €</span></div>
<div class="hr"></div>
<div class="row"><span class="bold">TOTAL</span><span class="bold big">24,00 €</span></div>
<div class="hr"></div>
<div class="center small-line">IVA 10% incluido<br>Base: 21,82 € &nbsp; Cuota: 2,18 €</div>
<div class="hr"></div>
<div class="center">¡Gracias por su visita!<br>Solicite factura completa si la necesita</div>
""")

TICKET_GASOLINERA = thermal("""
<div class="center bold big">ESTACIÓN DE SERVICIO<br>LA VÍA, S.L.</div>
<div class="center">Autovía A-3, km 14 - Salar<br>NIF: B46539127<br>Surtidor 4 - Gasóleo A</div>
<div class="hr"></div>
<div class="center bold">FACTURA SIMPLIFICADA</div>
<div class="row"><span>Ticket nº:</span><span>07891</span></div>
<div class="row"><span>Fecha:</span><span>18/03/2025 09:17</span></div>
<div class="hr"></div>
<div class="row"><span>Producto:</span><span>Gasóleo A</span></div>
<div class="row"><span>Litros:</span><span>44,00 L</span></div>
<div class="row"><span>Precio/L:</span><span>1,275 €</span></div>
<div class="hr"></div>
<div class="row"><span class="bold">TOTAL</span><span class="bold big">56,10 €</span></div>
<div class="hr"></div>
<div class="center">IVA 21% incluido en el precio<br>Pago con tarjeta</div>
<div class="hr"></div>
<div class="center">Gracias por su confianza</div>
""")

async def main():
    jobs = [
        ("factura-completa.png", FACTURA_COMPLETA, 794, 1123),
        ("factura-error.png", FACTURA_ERROR, 794, 1123),
        ("ticket-restaurante.png", TICKET_RESTAURANTE, 420, 700),
        ("ticket-gasolinera.png", TICKET_GASOLINERA, 420, 700),
    ]
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name, html, w, h in jobs:
            page = await browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            await page.set_content(html)
            el = await page.query_selector("body")
            await el.screenshot(path=os.path.join(OUT, name))
            await page.close()
            print("OK", name)
        await browser.close()

asyncio.run(main())
