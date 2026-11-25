import { z } from "zod";
import { connection } from "next/server";
import { readProfile } from "@/lib/profile";
import { MAX_ENTRADA, agruparIdeas, clasificarGiros, clasificarTrozo, esMismoRubro, gruposPorGiro, leerEstructurado, normalizar, proyectosParaClasificar, trozos, type ClasGiro, type Registro } from "@/lib/carga";

const Body = z.object({ texto: z.string().min(5).max(15_000_000) });

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
        const proyectos = proyectosParaClasificar();
        const empresa = readProfile()?.empresa ?? "";
        const slugs = new Set(proyectos.map((p) => p.slug));
        const tabla = leerEstructurado(b.data.texto);
        let crudos: Parameters<typeof normalizar>[0] = [];
        if (tabla) {
          // Datos con columnas: se lee directo y el modelo solo clasifica cada giro una vez.
          const grupos = gruposPorGiro(tabla);
          const clas = new Map<number, ClasGiro>();
          const pendientes: number[] = [];
          grupos.forEach((g, i) => (esMismoRubro(g[0].giro) ? clas.set(i, { proyecto: "mismo_rubro", segmento: "", razon: "Hace lo mismo que nosotros", idea: "" }) : pendientes.push(i)));
          const lotes: number[][] = [];
          for (let i = 0; i < pendientes.length; i += 80) lotes.push(pendientes.slice(i, i + 80));
          send({ tipo: "inicio", total: lotes.length, recortado: false, negocios: tabla.length, giros: grupos.length });
          let hechos = 0;
          for (let i = 0; i < lotes.length; i += 3) {
            await Promise.all(
              lotes.slice(i, i + 3).map(async (lote) => {
                try {
                  const r = await clasificarGiros(lote.map((k) => grupos[k]), proyectos, empresa);
                  lote.forEach((k, j) => { const c = r.get(j); if (c) clas.set(k, c); });
                } catch (e) {
                  send({ tipo: "aviso", mensaje: `Una parte no se pudo clasificar: ${(e as Error).message}` });
                }
                hechos++;
                send({ tipo: "progreso", hechos, total: lotes.length });
              }),
            );
          }
          crudos = grupos.flatMap((g, i) => {
            const c = clas.get(i) ?? { proyecto: "ninguno", segmento: "", razon: "", idea: "" };
            return g.map((r) => ({ ...r, ...c, proyecto: c.proyecto === "ninguno" && !r.giro && !r.negocio ? "sin_info" : c.proyecto }));
          });
        } else {
          const partes = trozos(b.data.texto);
          send({ tipo: "inicio", total: partes.length, recortado: b.data.texto.length > MAX_ENTRADA });
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
        }
        const registros: Registro[] = normalizar(crudos, slugs);
        send({ tipo: "registros", registros });
        const sinProyecto = registros.filter((r) => r.proyecto === "ninguno" && !r.rebote);
        if (sinProyecto.length) {
          send({ tipo: "pensando" });
          const ideas = await agruparIdeas(sinProyecto, empresa, proyectos).catch(() => []);
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
