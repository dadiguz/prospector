import { io } from "next/cache";
import { all, get, json } from "./db";
import { currentWeights } from "./project-md";
import type { ScoreLine } from "./scoring";
import type { Issue } from "./validator";

/** Lecturas para las pantallas. `io()` saca estas lecturas del prerender (SQLite es síncrono). */

export type ProjectCard = { id: number; slug: string; nombre: string; idea: string; contactados: number; respuestas: number; interesados: number; borradores: number };

export async function listProjects(): Promise<ProjectCard[]> {
  await io();
  return all<ProjectCard>(`
    SELECT p.id, p.slug, p.nombre, p.idea,
      (SELECT COUNT(*) FROM messages m JOIN prospects x ON x.id = m.prospect_id WHERE x.project_id = p.id AND m.estado = 'enviado' AND m.direccion = 'salida') AS contactados,
      (SELECT COUNT(*) FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects x ON x.id = m.prospect_id
         WHERE x.project_id = p.id AND r.clasificacion NOT IN ('rebote','auto_respuesta','vacia')) AS respuestas,
      (SELECT COUNT(*) FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects x ON x.id = m.prospect_id
         WHERE x.project_id = p.id AND r.clasificacion IN ('interesado','acuse')) AS interesados,
      (SELECT COUNT(*) FROM messages m JOIN prospects x ON x.id = m.prospect_id WHERE x.project_id = p.id AND m.estado IN ('borrador','aprobado')) AS borradores
    FROM projects p WHERE p.estado <> 'archivado' ORDER BY p.id`);
}

export type Project = {
  id: number; slug: string; nombre: string; idea: string; propuesta_valor: string; voz: string;
  metrica_principal: string; conversion: string; meta_actual: string; config_json: string; estado: string;
};
export async function getProject(slug: string): Promise<Project | undefined> {
  await io();
  return get<Project>("SELECT * FROM projects WHERE slug = ?", decodeURIComponent(slug));
}

export async function projectDetail(projectId: number) {
  await io();
  return {
    facts: all<{ id: number; afirmacion: string; tipo: string; evidencia: string; verificado_en: string | null }>(
      "SELECT id, afirmacion, tipo, evidencia, verificado_en FROM product_facts WHERE project_id = ? ORDER BY tipo, id", projectId),
    hooks: all<{ id: number; nombre: string; formula: string; multiplicador: number; redondeo: number; frase: string; supuestos_json: string; condicion: string }>(
      "SELECT * FROM hooks WHERE project_id = ?", projectId),
    segments: all<{ id: number; nombre: string; definicion: string; consultas_json: string; prospectos: number; enviados: number; positivos: number }>(`
      SELECT s.*,
        (SELECT COUNT(*) FROM prospects p WHERE p.segment_id = s.id) prospectos,
        (SELECT COUNT(*) FROM messages m JOIN prospects p ON p.id = m.prospect_id WHERE p.segment_id = s.id AND m.estado = 'enviado') enviados,
        (SELECT COUNT(*) FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects p ON p.id = m.prospect_id WHERE p.segment_id = s.id AND r.clasificacion IN ('interesado','acuse')) positivos
      FROM segments s WHERE s.project_id = ? AND s.estado = 'activo' ORDER BY s.id`, projectId),
    disqualifiers: all<{ regla: string; tipo: string; origen: string }>("SELECT regla, tipo, origen FROM disqualifiers WHERE project_id = ? ORDER BY tipo, id", projectId),
    weights: currentWeights(projectId),
    territory: get<{ excluidos_json: string; excepciones_json: string; motivo: string; vigente_desde: string }>(
      "SELECT * FROM territories WHERE project_id = ? ORDER BY id DESC LIMIT 1", projectId),
    jobs: all<{ id: number; estado: string; mensaje: string | null; creado_en: string; reanudar_despues: string | null; etiqueta: string; pasos: number; hechos: number; costo: number; a: number }>(`
      SELECT j.id, j.estado, j.mensaje, j.creado_en, j.reanudar_despues, r.etiqueta,
        (SELECT COUNT(*) FROM job_steps s WHERE s.job_id = j.id AND s.estado <> 'omitido') pasos,
        (SELECT COUNT(*) FROM job_steps s WHERE s.job_id = j.id AND s.estado = 'hecho') hechos,
        COALESCE((SELECT SUM(costo_usd) FROM usage_log u WHERE u.job_id = j.id), 0) costo,
        (SELECT COUNT(*) FROM prospects p WHERE p.search_run_id = j.search_run_id AND p.lista = 'A') a
      FROM jobs j LEFT JOIN search_runs r ON r.id = j.search_run_id
      WHERE j.project_id = ? ORDER BY j.id DESC LIMIT 5`, projectId),
  };
}

export type ProspectRow = {
  id: number; nombre: string; ciudad: string | null; estado_mx: string | null; lista: string; estado: string;
  score: number | null; score_detalle_json: string; ficha_json: string; motivo_descarte: string | null;
  no_contactar_antes_de: string | null; correo: string | null; whatsapp: string | null; tiene_borrador: number; etiqueta: string | null;
};

export async function listProspects(projectId: number, lista: string, soloPendientes: boolean) {
  await io();
  const rows = all<ProspectRow>(
    `SELECT p.id, o.nombre, o.ciudad, o.estado AS estado_mx, p.lista, p.estado, p.score, p.score_detalle_json, p.ficha_json,
       p.motivo_descarte, p.no_contactar_antes_de,
       (SELECT valor FROM contacts c WHERE c.organization_id = o.id AND c.canal = 'correo' AND c.estado = 'valido' ORDER BY c.id LIMIT 1) correo,
       (SELECT valor FROM contacts c WHERE c.organization_id = o.id AND c.canal = 'whatsapp' ORDER BY c.id LIMIT 1) whatsapp,
       (SELECT COUNT(*) FROM messages m WHERE m.prospect_id = p.id AND m.estado IN ('borrador','aprobado')) tiene_borrador,
       r.etiqueta
     FROM prospects p JOIN organizations o ON o.id = p.organization_id LEFT JOIN search_runs r ON r.id = p.search_run_id
     WHERE p.project_id = ? AND p.lista = ? ${soloPendientes ? "AND p.estado IN ('investigado','en_espera','borrador')" : ""}
     ORDER BY CASE p.estado WHEN 'investigado' THEN 0 WHEN 'borrador' THEN 1 WHEN 'en_espera' THEN 2 ELSE 3 END, p.score DESC, p.id DESC
     LIMIT 300`,
    projectId, lista,
  );
  const counts = all<{ lista: string; total: number; pendientes: number }>(
    `SELECT lista, COUNT(*) total, SUM(estado IN ('investigado','en_espera','borrador')) pendientes FROM prospects WHERE project_id = ? GROUP BY lista`,
    projectId,
  );
  return { rows, counts };
}

export async function prospectEvidence(prospectId: number) {
  await io();
  return all<{ url: string; que_demuestra: string; cita: string | null; tipo: string }>(
    "SELECT url, que_demuestra, cita, tipo FROM evidence WHERE prospect_id = ? ORDER BY id", prospectId);
}

export type DraftRow = {
  id: number; prospect_id: number; nombre: string; para: string | null; asunto: string; cuerpo: string; estado: string;
  validacion_json: string; score: number | null; ficha_json: string; creado_en: string;
};
export async function listDrafts(projectId: number) {
  await io();
  const drafts = all<DraftRow>(
    `SELECT m.id, m.prospect_id, o.nombre, m.para, m.asunto, m.cuerpo, m.estado, m.validacion_json, p.score, p.ficha_json, m.creado_en
     FROM messages m JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND m.estado IN ('borrador','aprobado') AND m.direccion = 'salida'
     ORDER BY m.estado = 'aprobado' DESC, p.score DESC, m.id`,
    projectId,
  );
  const enviadosHoy = get<{ c: number }>(
    `SELECT COUNT(*) c FROM messages m JOIN prospects p ON p.id = m.prospect_id
     WHERE p.project_id = ? AND m.estado = 'enviado' AND date(m.enviado_en) = date('now','localtime')`, projectId)!.c;
  return { drafts: drafts.map((d) => ({ ...d, issues: json<Issue[]>(d.validacion_json, []) })), enviadosHoy };
}

export type ReplyRow = {
  id: number; nombre: string; clasificacion: string; fecha: string | null; resumen: string; quien_respondio: string | null;
  pide: string | null; sugerencia: string | null; tanda: string | null; para: string | null; prospect_id: number; message_id: number;
  revisado_por_humano: number; confianza: number | null;
};
export async function listReplies(projectId: number) {
  await io();
  const replies = all<ReplyRow>(
    `SELECT r.id, o.nombre, r.clasificacion, r.fecha, r.resumen, r.quien_respondio, r.pide, r.sugerencia, m.tanda, m.para, p.id prospect_id, m.id message_id,
            r.revisado_por_humano, r.confianza
     FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? ORDER BY r.fecha DESC, r.id DESC`, projectId);
  const sinRespuesta = all<{ message_id: number; nombre: string; tanda: string | null; para: string | null; dias: number }>(
    `SELECT m.id message_id, o.nombre, m.tanda, m.para, CAST(julianday('now') - julianday(m.enviado_en) AS INTEGER) dias
     FROM messages m JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND m.estado = 'enviado' AND m.direccion = 'salida'
       AND NOT EXISTS (SELECT 1 FROM reply_events r WHERE r.message_id = m.id)
     ORDER BY m.enviado_en DESC, m.id DESC`, projectId);
  const retomar = all<{ nombre: string; motivo: string; fecha: string | null }>(
    `SELECT o.nombre, f.motivo, f.fecha FROM followups f JOIN prospects p ON p.id = f.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND f.estado = 'pendiente' ORDER BY f.fecha`, projectId);
  return { replies, sinRespuesta, retomar };
}

export const scoreLines = (s: string) => json<ScoreLine[]>(s, []);
