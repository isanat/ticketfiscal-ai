"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LandingView } from "@/components/landing/landing-view";
import { AuthView } from "@/components/auth/auth-view";
import { GestorPortal } from "@/components/fiscal/gestor-portal";
import { ClientePortal } from "@/components/fiscal/cliente-portal";
import { BannerSoporte, GestoriaNoActiva } from "@/components/auth/estado-cuenta";
import type { UsuarioSesion } from "@/lib/types";

type Vista = "cargando" | "landing" | "auth" | "app";

export default function Home() {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("cargando");
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [modoAuth, setModoAuth] = useState<"entrar" | "registro">("entrar");

  const cargarSesion = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setUsuario(json.usuario);
        setVista("app");
        return true;
      }
    } catch {
      // sin sesión: mostrar landing
    }
    setUsuario(null);
    setVista("landing");
    return false;
  }, []);

  useEffect(() => {
    let activo = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (res) => {
        if (!activo) return;
        if (res.ok) {
          const json = await res.json();
          setUsuario(json.usuario);
          setVista("app");
        } else {
          setUsuario(null);
          setVista("landing");
        }
      })
      .catch(() => {
        if (!activo) return;
        setUsuario(null);
        setVista("landing");
      });
    return () => {
      activo = false;
    };
  }, []);

  const salir = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // incluso si falla, cerramos localmente
    }
    setUsuario(null);
    setVista("landing");
    window.scrollTo({ top: 0 });
  }, []);

  // Termina la sesión de soporte y vuelve al panel de administración.
  const salirSoporte = useCallback(async () => {
    try {
      await fetch("/api/soporte/salir", { method: "POST" });
    } finally {
      router.push("/admin");
    }
  }, [router]);

  if (vista === "cargando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-label="Cargando">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-serif text-sm font-bold text-primary-foreground">
            TF
          </span>
          <span className="text-sm">Cargando TicketFiscal AI…</span>
        </div>
      </div>
    );
  }

  if (vista === "auth") {
    return (
      <AuthView
        modoInicial={modoAuth}
        onSuccess={() => {
          void cargarSesion();
        }}
        onVolver={() => {
          setVista("landing");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (vista === "app" && usuario) {
    if (usuario.rol === "GESTOR" && usuario.gestoria?.estado !== "ACTIVA") {
      return <GestoriaNoActiva usuario={usuario} onLogout={salir} />;
    }
    const portal =
      usuario.rol === "GESTOR" ? (
        <GestorPortal usuario={usuario} onLogout={salir} />
      ) : (
        <ClientePortal usuario={usuario} onLogout={salir} />
      );
    return (
      <>
        {usuario.soporte && <BannerSoporte onSalir={salirSoporte} />}
        {portal}
      </>
    );
  }

  return (
    <LandingView
      onEntrar={() => {
        setModoAuth("entrar");
        setVista("auth");
        window.scrollTo({ top: 0 });
      }}
      onRegistro={() => {
        setModoAuth("registro");
        setVista("auth");
        window.scrollTo({ top: 0 });
      }}
    />
  );
}
