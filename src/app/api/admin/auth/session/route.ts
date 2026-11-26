import { NextRequest, NextResponse } from "next/server";
import { conAdmin } from "@/lib/admin-http";
import { VENTANA_STEP_UP_MS } from "@/lib/admin-auth";
import { emailSegundoFactorActivo } from "@/lib/email-codigo";
import { estadoTotp } from "@/lib/segundo-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado de la sesión del dueño. Admite sesión parcial (aún sin segundo factor). */
export async function GET(req: NextRequest) {
  return conAdmin(req, { permitirParcial: true }, async (s) => {
    const t = s.totpVerificadoEn?.getTime() ?? 0;
    return NextResponse.json(
      {
        usuario: { id: s.usuario.id, nombre: s.usuario.nombre, email: s.usuario.email },
        estadoTotp: await estadoTotp(s.usuarioId),
        segundoFactorVerificado: Boolean(s.totpVerificadoEn),
        stepUpVigente: Date.now() - t <= VENTANA_STEP_UP_MS,
        emailSegundoFactor: emailSegundoFactorActivo(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  });
}
