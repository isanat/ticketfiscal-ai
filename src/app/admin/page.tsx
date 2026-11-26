import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "Administración — TicketFiscal AI",
  robots: { index: false, follow: false },
};

export default function PaginaAdmin() {
  return <AdminApp />;
}
