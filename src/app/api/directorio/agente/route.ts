import { z } from "zod";
import { connection } from "next/server";
import { buscarFuentes } from "@/lib/carga-fuentes";

const Body = z.object({ pedido: z.string().trim().min(3).max(1000) });

/** El agente busca de dónde sacar los datos. NDJSON: actividad y, al final, las fuentes. No descarga nada. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Escribe qué buscar." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const r = await buscarFuentes(b.data.pedido, (t) => send({ tipo: "actividad", texto: t }));
        send({ tipo: "fuentes", ...r });
      } catch (e) {
        send({ tipo: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
