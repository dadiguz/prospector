import { connection } from "next/server";
import { all, json } from "@/lib/db";

/** Búsquedas en curso o en cola (todas los proyectos) y las que terminaron hace poco, para el panel lateral. */
export async function GET() {
  await connection(); // siempre al momento: nunca se prerenderiza
  const rows = all<{
    id: number; estado: string; mensaje: string | null; actividad_json: string; presupuesto_json: string; creado_en: string; actualizado_en: string;
    proyecto: string; slug: string; tag_id: number | null; tag_nombre: string | null; tag_color: string | null;
    pasos: number; hechos: number; costo: number; encontrados: number;
  }>(
    `SELECT j.id, j.estado, j.mensaje, j.actividad_json, j.presupuesto_json, j.creado_en, j.actualizado_en,
       p.nombre proyecto, p.slug,
       l.id tag_id, l.nombre tag_nombre, l.color tag_color,
       (SELECT COUNT(*) FROM job_steps s WHERE s.job_id = j.id AND s.estado <> 'omitido') pasos,
       (SELECT COUNT(*) FROM job_steps s WHERE s.job_id = j.id AND s.estado = 'hecho') hechos,
       COALESCE((SELECT SUM(costo_usd) FROM usage_log u WHERE u.job_id = j.id), 0) costo,
       (SELECT COUNT(*) FROM prospects x WHERE x.search_run_id = j.search_run_id) encontrados
     FROM jobs j JOIN projects p ON p.id = j.project_id LEFT JOIN labels l ON l.search_run_id = j.search_run_id
     WHERE j.estado IN ('pendiente','en_curso','en_pausa')
        OR (j.estado IN ('hecho','fallo','cancelado') AND j.actualizado_en >= datetime('now','-30 minutes'))
     ORDER BY CASE j.estado WHEN 'en_curso' THEN 0 WHEN 'en_pausa' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END, j.id DESC
     LIMIT 12`,
  );
  const busquedas = rows.map((r) => {
    const act = json<{ t: string; texto: string }[]>(r.actividad_json, []);
    const paso = [...act].reverse().find((a) => /^(Investigando a|Buscando candidatos|Faltan)/.test(a.texto));
    const ultima = act[act.length - 1];
    const b = json<{ usd?: number; cuantos?: number }>(r.presupuesto_json, {});
    return {
      id: r.id, estado: r.estado, mensaje: r.mensaje, proyecto: r.proyecto, slug: r.slug,
      tag: r.tag_id ? { id: r.tag_id, nombre: r.tag_nombre ?? "", color: r.tag_color ?? "pizarra" } : null,
      pasos: r.pasos, hechos: r.hechos, costo: r.costo, tope: b.usd ?? null, encontrados: r.encontrados,
      paso: paso?.texto ?? null, ultima: ultima && ultima !== paso ? ultima.texto : null,
    };
  });
  return Response.json({ busquedas }, { headers: { "cache-control": "no-store" } });
}
