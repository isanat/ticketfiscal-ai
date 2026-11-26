// Sincroniza los movimientos de una conexión bancaria con la tabla MovimientoBancario.
// El llamador debe haber comprobado que la conexión pertenece a la empresa del usuario.
import { aEuros } from "../money";
import { prisma } from "../prisma";
import { GoCardless } from "./gocardless";
import { ProveedorBancarioNoDisponible, type ProveedorBancario } from "./proveedor";

const VENTANA_DIAS = 90;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function sincronizarConexion(conexionId: string, proveedor: ProveedorBancario = new GoCardless(), ahora = new Date()) {
  const conexion = await prisma.conexionBancaria.findUnique({ where: { id: conexionId } });
  if (!conexion) throw new Error("Conexión no encontrada");
  if (!proveedor.disponible()) throw new ProveedorBancarioNoDisponible("El proveedor bancario no está configurado");

  const { estado, cuentas } = await proveedor.estadoConexion(conexion.referenciaExterna);
  if (estado !== conexion.estado) await prisma.conexionBancaria.update({ where: { id: conexion.id }, data: { estado } });
  if (estado !== "ACTIVA") return { estado, importados: 0, duplicados: 0 };

  const desde = iso(new Date(ahora.getTime() - VENTANA_DIAS * 86_400_000));
  const hasta = iso(ahora);
  let importados = 0;
  let total = 0;
  for (const cuenta of cuentas) {
    const movs = await proveedor.movimientos(cuenta, desde, hasta);
    total += movs.length;
    if (movs.length === 0) continue;
    const r = await prisma.movimientoBancario.createMany({
      data: movs.map((m) => ({
        empresaId: conexion.empresaId,
        idExterno: m.idExterno,
        fecha: new Date(`${m.fecha}T00:00:00Z`),
        importe: aEuros(m.importeCent),
        descripcion: m.descripcion,
        origen: "OPEN_BANKING" as const,
      })),
      skipDuplicates: true,
    });
    importados += r.count;
  }
  return { estado, importados, duplicados: total - importados };
}
