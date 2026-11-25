import { all } from "@/lib/db";
import type { ProyectoOpcion } from "./cargar";

export function proyectosOpcion(): ProyectoOpcion[] {
  const filas = all<ProyectoOpcion>(
    `SELECT p.slug, p.nombre, json_extract(p.config_json, '$.icono') icono, json_extract(p.config_json, '$.color') color
     FROM projects p WHERE p.estado <> 'archivado' ORDER BY p.id`,
  );
  return JSON.parse(JSON.stringify(filas));
}
