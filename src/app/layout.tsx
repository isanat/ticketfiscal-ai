import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "TicketFiscal AI — Del ticket de WhatsApp al asiento contable",
  description:
    "Motor de extracción fiscal con IA para gestorías españolas: lee tickets y facturas por WhatsApp, valida según AEAT (RD 1619/2012), clasifica en el PGC y prepara el Modelo 303.",
  keywords: ["gestoría", "AEAT", "IVA", "Modelo 303", "PGC", "facturas", "autónomos", "WhatsApp"],
  authors: [{ name: "TicketFiscal AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "TicketFiscal AI",
    description: "Del ticket de WhatsApp al asiento contable, con reglas AEAT y PGC.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
