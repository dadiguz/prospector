import { io } from "next/cache";
import { all, get, json } from "./db";
import { currentWeights } from "./project-md";
import { syncRunTags, tagFilterSql } from "./tags";
import { backfillChannels } from "./channels";
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
  syncRunTags(projectId);
  return {
    facts: all<{ id: number; afirmacion: string; tipo: string; evidencia: string; verificado_en: string | null }>(
      "SELECT id, afirmacion, tipo, evidencia, verificado_en FROM product_facts WHERE project_id = ? ORDER BY tipo, id", projectId),
    hooks: all<{ id: number; nombre: string; formula: string; multiplicador: number; redondeo: number; frase: string; supuestos_json: string; condicion: string }>(
      "SELECT * FROM hooks WHERE project_id = ?", projectId),
    segments: all<{ id: number; nombre: string; definicion: string; consultas_json: string; prospectos: number; enviados: number; positivos: number; activos: number }>(`
      SELECT s.*,
        (SELECT COUNT(*) FROM prospects p WHERE p.segment_id = s.id) prospectos,
        (SELECT COUNT(*) FROM messages m JOIN prospects p ON p.id = m.prospect_id WHERE p.segment_id = s.id AND m.estado = 'enviado') enviados,
        (SELECT COUNT(*) FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects p ON p.id = m.prospect_id WHERE p.segment_id = s.id AND r.clasificacion IN ('interesado','acuse')) positivos,
        (SELECT COUNT(*) FROM jobs j WHERE j.project_id = s.project_id AND j.estado IN ('pendiente','en_curso','en_pausa')
           AND json_extract(j.presupuesto_json, '$.segmentId') = s.id) activos
      FROM segments s WHERE s.project_id = ? AND s.estado = 'activo' ORDER BY s.id`, projectId),
    disqualifiers: all<{ regla: string; tipo: string; origen: string }>("SELECT regla, tipo, origen FROM disqualifiers WHERE project_id = ? ORDER BY tipo, id", projectId),
    weights: currentWeights(projectId),
    territory: get<{ excluidos_json: string; excepciones_json: string; motivo: string; vigente_desde: string }>(
      "SELECT * FROM territories WHERE project_id = ? ORDER BY id DESC LIMIT 1", projectId),
    jobs: all<{ id: number; estado: string; mensaje: string | null; creado_en: string; reanudar_despues: string | null; etiqueta: string; pasos: number; hechos: number; costo: number; a: number; actividad_json: string; tag_id: number | null; tag_color: string | null; tag_nombre: string | null; encontrados: number }>(`
      SELECT j.id, j.estado, j.mensaje, j.creado_en, j.reanudar_despues, r.etiqueta, j.actividad_json,
        (SELECT l.id FROM labels l WHERE l.search_run_id = j.search_run_id) tag_id,
        (SELECT l.color FROM labels l WHERE l.search_run_id = j.search_run_id) tag_color,
        (SELECT l.nombre FROM labels l WHERE l.search_run_id = j.search_run_id) tag_nombre,
        (SELECT COUNT(*) FROM prospects p WHERE p.search_run_id = j.search_run_id) encontrados,
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
  no_contactar_antes_de: string | null; creado_en: string; correo: string | null; whatsapp: string | null; tiene_borrador: number; etiqueta: string | null;
};

export type Canal = "correo" | "whatsapp";
const HAS_CORREO = "EXISTS (SELECT 1 FROM contacts c WHERE c.organization_id = p.organization_id AND c.canal = 'correo' AND c.estado = 'valido')";
const HAS_WA = "EXISTS (SELECT 1 FROM contacts c WHERE c.organization_id = p.organization_id AND c.canal = 'whatsapp')";
const canalSql = (canal: Canal | null) => (canal === "correo" ? `AND ${HAS_CORREO}` : canal === "whatsapp" ? `AND ${HAS_WA}` : "");

export async function listProspects(projectId: number, lista: string, soloPendientes: boolean, tag: number | null = null, canal: Canal | null = null) {
  await io();
  backfillChannels(projectId);
  const pend = soloPendientes ? "AND p.estado IN ('investigado','en_espera','borrador')" : "";
  // "todos": todas las listas menos los descartados.
  const listaSql = lista === "todos" ? "p.lista <> 'descartado' AND ? = 'todos'" : "p.lista = ?";
  const rows = all<ProspectRow & { instagram: string | null }>(
    `SELECT p.id, o.nombre, o.ciudad, o.estado AS estado_mx, p.lista, p.estado, p.score, p.score_detalle_json, p.ficha_json,
       p.motivo_descarte, p.no_contactar_antes_de, p.creado_en,
       (SELECT valor FROM contacts c WHERE c.organization_id = o.id AND c.canal = 'correo' AND c.estado = 'valido' ORDER BY c.id LIMIT 1) correo,
       (SELECT valor FROM contacts c WHERE c.organization_id = o.id AND c.canal = 'whatsapp' ORDER BY c.id LIMIT 1) whatsapp,
       (SELECT valor FROM contacts c WHERE c.organization_id = o.id AND c.canal = 'instagram' ORDER BY c.id LIMIT 1) instagram,
       (SELECT COUNT(*) FROM messages m WHERE m.prospect_id = p.id AND m.estado IN ('borrador','aprobado')) tiene_borrador,
       r.etiqueta
     FROM prospects p JOIN organizations o ON o.id = p.organization_id LEFT JOIN search_runs r ON r.id = p.search_run_id
     WHERE p.project_id = ? AND ${listaSql} AND ${tagFilterSql("p.id")} ${pend} ${canalSql(canal)}
     ORDER BY CASE p.estado WHEN 'investigado' THEN 0 WHEN 'borrador' THEN 1 WHEN 'en_espera' THEN 2 ELSE 3 END, CASE p.lista WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END, p.score DESC, p.id DESC
     LIMIT 300`,
    projectId, lista, tag, tag,
  );
  const counts = all<{ lista: string; total: number; pendientes: number }>(
    `SELECT lista, COUNT(*) total, SUM(estado IN ('investigado','en_espera','borrador')) pendientes FROM prospects p
     WHERE project_id = ? AND ${tagFilterSql("p.id")} ${canalSql(canal)} GROUP BY lista`,
    projectId, tag, tag,
  );
  // Cuántos de la lista actual se pueden contactar por cada canal (para los botones de filtro).
  const canales = all<{ correo: number; whatsapp: number }>(
    `SELECT SUM(${HAS_CORREO}) correo, SUM(${HAS_WA}) whatsapp FROM prospects p
     WHERE p.project_id = ? AND ${listaSql} AND ${tagFilterSql("p.id")} ${pend}`,
    projectId, lista, tag, tag,
  )[0];
  return { rows, counts, canales: { correo: canales?.correo ?? 0, whatsapp: canales?.whatsapp ?? 0 } };
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
export async function listDrafts(projectId: number, tag: number | null = null) {
  await io();
  const drafts = all<DraftRow>(
    `SELECT m.id, m.prospect_id, o.nombre, m.para, m.asunto, m.cuerpo, m.estado, m.validacion_json, p.score, p.ficha_json, m.creado_en
     FROM messages m JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND m.estado IN ('borrador','aprobado') AND m.direccion = 'salida' AND ${tagFilterSql("p.id")}
     ORDER BY m.estado = 'aprobado' DESC, p.score DESC, m.id`,
    projectId, tag, tag,
  );
  const enviadosHoy = get<{ c: number }>(
    `SELECT COUNT(*) c FROM messages m JOIN prospects p ON p.id = m.prospect_id
     WHERE p.project_id = ? AND m.estado = 'enviado' AND date(m.enviado_en) = date('now','localtime')`, projectId)!.c;
  return { drafts: drafts.map((d) => ({ ...d, issues: json<Issue[]>(d.validacion_json, []) })), enviadosHoy };
}

export type ReplyRow = {
  id: number; nombre: string; clasificacion: string; fecha: string | null; resumen: string; quien_respondio: string | null;
  pide: string | null; sugerencia: string | null; tanda: string | null; para: string | null; prospect_id: number; message_id: number;
  revisado_por_humano: number; confianza: number | null; creado_en: string | null;
};
export async function listReplies(projectId: number, tag: number | null = null) {
  await io();
  const replies = all<ReplyRow>(
    `SELECT r.id, o.nombre, r.clasificacion, r.fecha, r.resumen, r.quien_respondio, r.pide, r.sugerencia, m.tanda, m.para, p.id prospect_id, m.id message_id,
            r.revisado_por_humano, r.confianza, r.creado_en
     FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND ${tagFilterSql("p.id")} ORDER BY r.fecha DESC, r.id DESC`, projectId, tag, tag);
  const sinRespuesta = all<{ message_id: number; nombre: string; tanda: string | null; para: string | null; seguimiento: string | null; dias: number }>(
    `SELECT m.id message_id, o.nombre, m.tanda, m.para, m.seguimiento, CAST(julianday('now') - julianday(m.enviado_en) AS INTEGER) dias
     FROM messages m JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND m.estado = 'enviado' AND m.direccion = 'salida'
       AND NOT EXISTS (SELECT 1 FROM reply_events r WHERE r.message_id = m.id) AND ${tagFilterSql("p.id")}
     ORDER BY m.enviado_en DESC, m.id DESC`, projectId, tag, tag);
  const retomar = all<{ nombre: string; motivo: string; fecha: string | null }>(
    `SELECT o.nombre, f.motivo, f.fecha FROM followups f JOIN prospects p ON p.id = f.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE p.project_id = ? AND f.estado = 'pendiente' ORDER BY f.fecha`, projectId);
  return { replies, sinRespuesta, retomar };
}

export const scoreLines = (s: string) => json<ScoreLine[]>(s, []);

export type SidebarProject = { slug: string; nombre: string; pendientes: number; borradores: number; respuestas: number; buscando: number };

/** Proyectos con lo que necesita atención, para el menú lateral. */
export async function sidebarProjects(): Promise<SidebarProject[]> {
  await io();
  // Contadores = lo nuevo desde la última visita a cada sección (tabla vistas).
  const visto = (sec: string) => `COALESCE((SELECT v.visto_en FROM vistas v WHERE v.project_id = p.id AND v.seccion = '${sec}'), p.creado_en)`;
  return all<SidebarProject>(`
    SELECT p.slug, p.nombre,
      (SELECT COUNT(*) FROM prospects x WHERE x.project_id = p.id AND x.lista <> 'descartado' AND x.creado_en > ${visto("prospectos")}) pendientes,
      (SELECT COUNT(*) FROM messages m JOIN prospects x ON x.id = m.prospect_id
         WHERE x.project_id = p.id AND m.estado IN ('borrador','aprobado') AND m.creado_en > ${visto("borradores")}) borradores,
      (SELECT COUNT(*) FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects x ON x.id = m.prospect_id
         WHERE x.project_id = p.id AND r.creado_en > ${visto("respuestas")}) respuestas,
      (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.estado IN ('pendiente','en_curso','en_pausa')) buscando
    FROM projects p WHERE p.estado <> 'archivado' ORDER BY p.id`);
}
