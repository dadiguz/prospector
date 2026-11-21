import { z } from "zod";
import { markSeen } from "@/lib/vistas";

/** Marca una sección como vista (se llama al salir de ella, también con la pestaña cerrándose). */
export async function POST(req: Request) {
  const p = z.object({ projectId: z.number().int(), seccion: z.enum(["prospectos", "borradores", "respuestas"]) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response("Solicitud inválida", { status: 400 });
  markSeen(p.data.projectId, p.data.seccion);
  return new Response(null, { status: 204 });
}
