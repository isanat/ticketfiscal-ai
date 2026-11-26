import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif editorial para titulares: registo "banca/asesoría" europea
const serifDisplay = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "TicketFiscal AI — Plataforma fiscal para gestorías",
  description:
    "Los justificantes de sus clientes por WhatsApp, convertidos en lotes contables validados (AEAT · RD 1619/2012 · PGC) y listos para a3, Sage o Holded. Multi-empresa, validación NIF/CIF y Modelo 303.",
  keywords: [
    "gestoría",
    "asesoría fiscal",
    "AEAT",
    "IVA",
    "Modelo 303",
    "PGC",
    "VeriFactu",
    "WhatsApp Business",
    "a3",
    "Sage",
    "Holded",
  ],
  authors: [{ name: "TicketFiscal AI" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TicketFiscal AI",
    description:
      "Del WhatsApp del cliente al asiento contable. Plataforma fiscal multi-empresa para gestorías españolas.",
    siteName: "TicketFiscal AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${serifDisplay.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
