import { z } from "zod";
import { connection } from "next/server";
import { guardarCarga, tituloSugerido, type EstadoCarga } from "@/lib/carga";

const Body = z.object({
  registros: z.array(z.object({ correo: z.string() }).passthrough()).min(1).max(20000),
  ideas: z.array(z.object({}).passthrough()).default([]),
  asignado: z.record(z.string(), z.string()).default({}),
  agregados: z.array(z.string()).default([]),
  segmentos: z.record(z.string(), z.string()).default({}),
});

/** Guarda en el historial una carga que solo vivía en el navegador. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const e = b.data as unknown as EstadoCarga;
  const muestra = e.registros.slice(0, 25).map((r) => [r.negocio, r.descripcion, r.ciudad, r.estado].filter(Boolean).join(" | ")).join("\n");
  const id = guardarCarga(await tituloSugerido(muestra, ""), "", e);
  return Response.json({ id });
}
