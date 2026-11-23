import { z } from "zod";
import { connection } from "next/server";
import { get } from "@/lib/db";
import { runAssistant } from "@/lib/assistant";
import { NoApiKeyError, PausedError } from "@/lib/llm";

const Body = z.object({
  slug: z.string(),
  seccion: z.enum(["resumen", "prospectos", "borradores", "respuestas", "editar"]),
  filtros: z.object({ lista: z.string().optional(), tag: z.number().int().optional() }).default({}),
  historial: z.array(z.object({ rol: z.enum(["usuario", "asistente"]), texto: z.string() })).max(40).default([]),
  mensaje: z.string().trim().min(1).max(4000),
});

/** Asistente del proyecto. Responde en NDJSON: avisos en vivo ("actividad") y al final la respuesta con propuestas. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  const project = get<{ id: number }>("SELECT id FROM projects WHERE slug = ?", decodeURIComponent(b.data.slug));
  if (!project) return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const r = await runAssistant({
          projectId: project.id, seccion: b.data.seccion, filtros: b.data.filtros, historial: b.data.historial, mensaje: b.data.mensaje,
          onActivity: (texto) => send({ tipo: "actividad", texto }),
        });
        send({ tipo: "fin", projectId: project.id, ...r });
      } catch (e) {
        const msg = e instanceof NoApiKeyError || e instanceof PausedError || e instanceof Error ? e.message : String(e);
        send({ tipo: "error", error: msg });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
