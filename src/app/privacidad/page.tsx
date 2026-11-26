export const metadata = {
  title: "Política de Privacidad — TicketFiscal AI",
};

export default function PaginaPrivacidad() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <h1 className="font-serif text-3xl font-bold">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: noviembre de 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <p>
          TicketFiscal AI ("nosotros") ofrece un servicio que permite a comerciantes en España
          enviar sus justificantes fiscales (recibos y comprobantes) a través de WhatsApp para su
          procesamiento automático y posterior gestión por su gestoría.
        </p>

        <h2 className="font-serif text-xl font-semibold">1. Datos que tratamos</h2>
        <p>
          Tratamos el número de teléfono de WhatsApp del comerciante, el nombre de su empresa, su
          NIF, y las imágenes o archivos PDF de los justificantes fiscales que nos envía, así como
          los datos extraídos de dichos documentos (importes, fechas, proveedores y conceptos).
        </p>

        <h2 className="font-serif text-xl font-semibold">2. Finalidad del tratamiento</h2>
        <p>
          Los datos se utilizan exclusivamente para identificar al comerciante, procesar sus
          justificantes mediante un motor de visión por IA, registrar los documentos resultantes y
          ponerlos a disposición de la gestoría asignada a su empresa. No utilizamos los datos con
          fines publicitarios ni los cedemos a terceros ajenos a esta finalidad.
        </p>

        <h2 className="font-serif text-xl font-semibold">3. Base legal y conservación</h2>
        <p>
          El tratamiento se basa en la relación contractual con la gestoría del comerciante y en su
          consentimiento al enviar documentos a través de WhatsApp. Los datos se conservan mientras
          la empresa permanezca activa en el servicio y durante el plazo legal de conservación de
          documentos fiscales.
        </p>

        <h2 className="font-serif text-xl font-semibold">4. WhatsApp Business Platform</h2>
        <p>
          La recepción y el envío de mensajes se realiza a través de la API de WhatsApp Business de
          Meta Platforms, Inc. El contenido de los mensajes se transmite de forma cifrada hasta
          nuestros servidores, donde se procesa de forma segura.
        </p>

        <h2 className="font-serif text-xl font-semibold">5. Derechos del titular</h2>
        <p>
          El titular de los datos puede solicitar en cualquier momento el acceso, rectificación,
          supresión u oposición al tratamiento de sus datos, escribiendo al correo de contacto
          indicado en el registro de su empresa o a través de su gestoría.
        </p>

        <h2 className="font-serif text-xl font-semibold">6. Contacto</h2>
        <p>
          Para cualquier consulta sobre esta política de privacidad, puede escribirnos a
          netlinkassist@gmail.com.
        </p>
      </section>
    </main>
  );
}
