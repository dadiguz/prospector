import { z } from "zod";
import { connection } from "next/server";
import { readProfile } from "@/lib/profile";
import {
  MAX_ENTRADA, agregarACarga, guardarCarga, tituloSugerido, agruparIdeas, clasificarGiros, clasificarTrozo, esMismoRubro, gruposPorGiro,
  leerEstructurado, normalizar, proyectosParaClasificar, trozos, type ClasGiro, type Registro,
} from "@/lib/carga";
import { descargarFuente } from "@/lib/carga-fuentes";

const Body = z.object({
  texto: z.string().max(15_000_000).optional(),
  url: z.string().url().max(2000).optional(),
  titulo: z.string().trim().max(120).optional(),
  archivos: z.array(z.string().max(200)).max(50).optional(),
  /** Si viene, lo nuevo se suma a esa carga en lugar de crear otra. */
  cargaId: z.number().int().optional(),
});

/** Lee (de texto o de una liga) y clasifica una carga de correos; la guarda en el historial. NDJSON con el avance. */
export async function POST(req: Request) {
  await connection();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || (!b.data.url && (b.data.texto ?? "").trim().length < 5)) return Response.json({ error: "No hay datos para leer." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        let texto = b.data.texto ?? "";
        let archivos = (b.data.archivos ?? []).join(", ");
        if (b.data.url) {
          const d = await descargarFuente(b.data.url, (t) => send({ tipo: "actividad", texto: t }));
          texto = d.texto;
          archivos = d.archivo;
        }
        const proyectos = proyectosParaClasificar();
        const empresa = readProfile()?.empresa ?? "";
        const slugs = new Set(proyectos.map((p) => p.slug));
        const tabla = leerEstructurado(texto);
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
          const partes = trozos(texto);
          send({ tipo: "inicio", total: partes.length, recortado: texto.length > MAX_ENTRADA });
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
        if (!registros.length) {
          send({ tipo: "vacio" });
          return;
        }
        const sinProyecto = registros.filter((r) => r.proyecto === "ninguno" && !r.rebote);
        send({ tipo: "pensando" });
        if (b.data.cargaId) {
          const ideas = sinProyecto.length ? await agruparIdeas(sinProyecto, empresa, proyectos).catch(() => []) : [];
          const n = agregarACarga(b.data.cargaId, registros, ideas);
          send({ tipo: "agregado", id: b.data.cargaId, nuevos: n });
          return;
        }
        const [ideas, titulo] = await Promise.all([
          sinProyecto.length ? agruparIdeas(sinProyecto, empresa, proyectos).catch(() => []) : Promise.resolve([]),
          b.data.titulo || tituloSugerido(texto.slice(0, 4000), archivos),
        ]);
        const id = guardarCarga(titulo, archivos, { registros, ideas, asignado: Object.fromEntries(registros.map((r) => [r.correo, r.proyecto])), agregados: [], segmentos: {} });
        send({ tipo: "guardado", id });
      } catch (e) {
        send({ tipo: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
