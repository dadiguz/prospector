import { get, run } from "./db";

/** Última visita a cada sección de un proyecto: los contadores del menú cuentan lo nuevo desde entonces. */
export type Seccion = "prospectos" | "borradores" | "respuestas";

export function lastSeen(projectId: number, seccion: Seccion): string | null {
  return get<{ v: string }>("SELECT visto_en v FROM vistas WHERE project_id = ? AND seccion = ?", projectId, seccion)?.v ?? null;
}

export function markSeen(projectId: number, seccion: Seccion) {
  run(
    "INSERT INTO vistas (project_id, seccion, visto_en) VALUES (?, ?, datetime('now')) ON CONFLICT(project_id, seccion) DO UPDATE SET visto_en = excluded.visto_en",
    projectId, seccion,
  );
}

/** ¿Llegó después de la última visita? Fechas de SQLite en UTC ("YYYY-MM-DD HH:MM:SS"). */
export const esNuevo = (creado: string | null | undefined, desde: string | null) => Boolean(creado && desde && creado > desde);
