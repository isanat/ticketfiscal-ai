"use client";

import { Clock, LifeBuoy, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UsuarioSesion } from "@/lib/types";

/** Pantalla para una gestoría que aún no está activa (pendiente de aprobación o suspendida). */
export function GestoriaNoActiva({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const suspendida = usuario.gestoria?.estado === "SUSPENDIDA";
  const Icono = suspendida ? ShieldAlert : Clock;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 pt-8 text-center">
          <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${suspendida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            <Icono className="h-6 w-6" />
          </span>
          <h1 className="font-serif text-2xl font-semibold">{suspendida ? "Cuenta suspendida" : "Estamos verificando su gestoría"}</h1>
          <p className="text-sm text-muted-foreground">
            {suspendida
              ? `El acceso de ${usuario.gestoria?.nombre ?? "su gestoría"} está suspendido. Contacte con el equipo de TicketFiscal para reactivarlo; sus datos se conservan.`
              : `Hemos recibido el alta de ${usuario.gestoria?.nombre ?? "su gestoría"}. Verificamos cada gestoría antes de activar su cartera de clientes. Le avisaremos en cuanto esté lista.`}
          </p>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

/** Aviso fijo mientras un administrador está dentro de la cuenta por motivos de soporte. */
export function BannerSoporte({ onSalir }: { onSalir: () => void }) {
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-sky-800 px-4 py-2 text-xs text-white">
      <span className="flex items-center gap-2">
        <LifeBuoy className="h-4 w-4" />
        Sesión de soporte: el equipo de TicketFiscal está viendo esta cuenta. Todo queda registrado y termina solo a los 30 minutos.
      </span>
      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onSalir}>
        Salir de soporte
      </Button>
    </div>
  );
}
