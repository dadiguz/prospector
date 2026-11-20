import { all, get, run } from "./db";

/**
 * Etiquetas de prospectos (sección 4.4): de sistema (una por búsqueda o tanda) y de usuario.
 * Los mensajes y respuestas heredan las etiquetas de su prospecto.
 */
export const TAG_COLORS = ["terracota", "salvia", "azul", "ocre", "ciruela", "petroleo", "rosa", "oliva", "pizarra", "arena"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export type Tag = { id: number; nombre: string; color: TagColor; tipo: "sistema" | "usuario"; search_run_id: number | null; total?: number };

function nextColor(projectId: number): TagColor {
  const n = get<{ c: number }>("SELECT COUNT(*) c FROM labels WHERE project_id = ? AND color IS NOT NULL", projectId)!.c;
  return TAG_COLORS[n % TAG_COLORS.length];
}

/** Nombre corto para la etiqueta de una búsqueda o tanda importada. */
export function runTagName(etiqueta: string): string {
  const t = etiqueta.match(/prospectos_t(\w+)/i) ?? etiqueta.match(/^tanda(\d+)/i);
  if (t) return `Tanda ${t[1]}`;
  if (/^bit[aá]cora/i.test(etiqueta)) return "Bitácora";
  const s = etiqueta.replace(/^Búsqueda\s+/, "");
  return s.length > 42 ? `${s.slice(0, 40).trimEnd()}…` : s;
}

/** Crea la etiqueta de una búsqueda si no existe y devuelve su id. */
export function ensureRunTag(runId: number): number {
  const ex = get<{ id: number }>("SELECT id FROM labels WHERE search_run_id = ?", runId);
  if (ex) return ex.id;
  const r = get<{ project_id: number; etiqueta: string }>("SELECT project_id, etiqueta FROM search_runs WHERE id = ?", runId)!;
  let nombre = runTagName(r.etiqueta);
  if (get("SELECT 1 FROM labels WHERE project_id = ? AND nombre = ?", r.project_id, nombre)) nombre = `${nombre} (${runId})`;
  return Number(
    run("INSERT INTO labels (project_id, nombre, tipo, color, search_run_id) VALUES (?, ?, 'sistema', ?, ?)", r.project_id, nombre, nextColor(r.project_id), runId).lastInsertRowid,
  );
}

/** Etiqueta cada prospecto con su búsqueda de origen (también el historial importado). Idempotente. */
export function syncRunTags(projectId: number) {
  for (const r of all<{ id: number }>(
    `SELECT s.id FROM search_runs s WHERE s.project_id = ? AND EXISTS (SELECT 1 FROM prospects p WHERE p.search_run_id = s.id)
       AND NOT EXISTS (SELECT 1 FROM labels l WHERE l.search_run_id = s.id) ORDER BY s.id`,
    projectId,
  ))
    ensureRunTag(r.id);
  run(
    `INSERT OR IGNORE INTO label_links (label_id, prospect_id)
     SELECT l.id, p.id FROM prospects p JOIN labels l ON l.search_run_id = p.search_run_id WHERE p.project_id = ?`,
    projectId,
  );
}

export function tagProspect(prospectId: number, labelId: number) {
  run("INSERT OR IGNORE INTO label_links (label_id, prospect_id) VALUES (?, ?)", labelId, prospectId);
}

export function userTag(projectId: number, nombre: string): number {
  const n = nombre.trim().slice(0, 40);
  const ex = get<{ id: number }>("SELECT id FROM labels WHERE project_id = ? AND nombre = ?", projectId, n);
  if (ex) return ex.id;
  return Number(run("INSERT INTO labels (project_id, nombre, tipo, color) VALUES (?, ?, 'usuario', ?)", projectId, n, nextColor(projectId)).lastInsertRowid);
}

/** Etiquetas visibles del proyecto, las más recientes primero, con su número de prospectos. */
export function projectTags(projectId: number): Tag[] {
  syncRunTags(projectId);
  return all<Tag>(
    `SELECT l.id, l.nombre, COALESCE(l.color, 'pizarra') color, l.tipo, l.search_run_id,
       (SELECT COUNT(*) FROM label_links ll WHERE ll.label_id = l.id AND ll.prospect_id IS NOT NULL) total
     FROM labels l WHERE l.project_id = ? AND (l.search_run_id IS NOT NULL OR l.tipo = 'usuario')
     ORDER BY l.tipo = 'usuario' DESC, l.id DESC`,
    projectId,
  );
}

/** Etiquetas por prospecto, para pintar chips. */
export function tagsByProspect(ids: number[]): Map<number, Tag[]> {
  const m = new Map<number, Tag[]>();
  if (!ids.length) return m;
  for (const r of all<Tag & { prospect_id: number }>(
    `SELECT ll.prospect_id, l.id, l.nombre, COALESCE(l.color, 'pizarra') color, l.tipo, l.search_run_id
     FROM label_links ll JOIN labels l ON l.id = ll.label_id
     WHERE ll.prospect_id IN (${ids.map(() => "?").join(",")}) ORDER BY l.tipo = 'usuario' DESC, l.id DESC`,
    ...ids,
  ))
    m.set(r.prospect_id, [...(m.get(r.prospect_id) ?? []), JSON.parse(JSON.stringify({ id: r.id, nombre: r.nombre, color: r.color, tipo: r.tipo, search_run_id: r.search_run_id }))]);
  return m;
}

/** Fragmento SQL para filtrar por etiqueta (columna de prospecto dada). */
export const tagFilterSql = (col: string) => `(? IS NULL OR EXISTS (SELECT 1 FROM label_links ll WHERE ll.prospect_id = ${col} AND ll.label_id = ?))`;
