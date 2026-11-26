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
  title: "TicketFiscal AI — Fiscalidad asistida por IA para gestorías",
  description:
    "IA que lee los justificantes de sus clientes, motor de reglas AEAT que los valida y cruce con el extracto bancario. Lotes contables listos para a3, Sage o Holded.",
  keywords: [
    "gestoría",
    "asesoría fiscal",
    "AEAT",
    "IVA",
    "Modelo 303",
    "PGC",
    "conciliación bancaria",
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
      "Del ticket de WhatsApp al asiento contable, verificado y conciliado con el banco.",
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
