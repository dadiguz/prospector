import { z } from "zod";
import { connection } from "next/server";
import { readProfile } from "@/lib/profile";
import { MAX_ENTRADA, agruparIdeas, clasificarTrozo, normalizar, proyectosParaClasificar, trozos, type Registro } from "@/lib/carga";

const Body = z.object({ texto: z.string().min(5).max(MAX_ENTRADA * 4) });

/** Lee y clasifica una carga de correos. NDJSON: avance, registros e ideas. No guarda nada. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "No hay datos para leer." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const partes = trozos(b.data.texto);
        const recortado = b.data.texto.length > MAX_ENTRADA;
        const proyectos = proyectosParaClasificar();
        const empresa = readProfile()?.empresa ?? "";
        send({ tipo: "inicio", total: partes.length, recortado });
        const crudos: Awaited<ReturnType<typeof clasificarTrozo>> = [];
        let hechos = 0;
        // De tres en tres para no saturar la API.
        for (let i = 0; i < partes.length; i += 3) {
          const lote = await Promise.all(
            partes.slice(i, i + 3).map((t) =>
              clasificarTrozo(t, proyectos, empresa).catch((e: Error) => {
                send({ tipo: "aviso", mensaje: `Una parte no se pudo leer: ${e.message}` });
                return [];
              }),
            ),
          );
          for (const l of lote) crudos.push(...l);
          hechos += lote.length;
          send({ tipo: "progreso", hechos, total: partes.length });
        }
        const registros: Registro[] = normalizar(crudos, new Set(proyectos.map((p) => p.slug)));
        send({ tipo: "registros", registros });
        const sinProyecto = registros.filter((r) => r.proyecto === "ninguno" && !r.rebote);
        if (sinProyecto.length) {
          send({ tipo: "pensando" });
          const ideas = await agruparIdeas(sinProyecto, empresa).catch(() => []);
          send({ tipo: "ideas", ideas });
        }
        send({ tipo: "fin" });
      } catch (e) {
        send({ tipo: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
