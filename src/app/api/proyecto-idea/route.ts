import { z } from "zod";
import { connection } from "next/server";
import { generarProyecto } from "@/lib/project-gen";

const Body = z.object({ idea: z.string().trim().min(10).max(4000) });

/** Arma un proyecto nuevo desde la idea. NDJSON: una línea por parte lista; nada se guarda. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Describe tu idea con un poco más de detalle." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        await generarProyecto(
          b.data.idea,
          (parte, data) => send({ tipo: "parte", parte, data }),
          (parte, e) => send({ tipo: "error", parte, error: e instanceof Error ? e.message : String(e) }),
        );
        send({ tipo: "fin" });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
