import { all, json } from "./db";
import { currentWeights } from "./project-md";

/**
 * "Análisis de respuestas" (sección 7.7). Las cifras salen de la base, no del modelo.
 * Umbrales de 7.3: 20 entregados por valor, 3 positivos de diferencia, 7 días de espera,
 * tasa suavizada con una Beta de previo débil.
 */
const POSITIVE = new Set(["interesado", "acuse"]);
const NEGATIVE = new Set(["no", "no_ahora", "baja"]);
const PRIOR_A = 1;
const PRIOR_B = 19; // previo ~5%, peso de 20 correos

type MsgRow = { id: number; tanda: string | null; enviado_en: string; con_enlaces: number; atributos_json: string; clasif: string | null; dias: number };

export type Tramo = { tanda: string; enviados: number; entregados: number; positivos: number; negativos: number; auto: number; rebotes: number; dias: number; fresca: boolean };
export type AttrRow = {
  clave: string; descripcion: string; valor: boolean; entregados: number; positivos: number; tasa: number; suavizada: number;
  confianza: "baja" | "media" | "alta"; etiqueta: "hipótesis" | "con evidencia";
};

function classify(rows: MsgRow[]) {
  const enviados = rows.length;
  const rebotes = rows.filter((r) => r.clasif === "rebote").length;
  const positivos = rows.filter((r) => r.clasif && POSITIVE.has(r.clasif)).length;
  const negativos = rows.filter((r) => r.clasif && NEGATIVE.has(r.clasif)).length;
  const auto = rows.filter((r) => r.clasif === "auto_respuesta" || r.clasif === "vacia").length;
  return { enviados, entregados: enviados - rebotes, positivos, negativos, auto, rebotes };
}

export function responseAnalysis(projectId: number) {
  const rows = all<MsgRow>(
    `SELECT m.id, m.tanda, m.enviado_en, m.con_enlaces, p.atributos_json,
       (SELECT r.clasificacion FROM reply_events r WHERE r.message_id = m.id ORDER BY
          CASE r.clasificacion WHEN 'interesado' THEN 0 WHEN 'acuse' THEN 1 WHEN 'rebote' THEN 2 ELSE 3 END LIMIT 1) clasif,
       CAST(julianday('now') - julianday(m.enviado_en) AS INTEGER) dias
     FROM messages m JOIN prospects p ON p.id = m.prospect_id
     WHERE p.project_id = ? AND m.estado = 'enviado' AND m.direccion = 'salida'
     ORDER BY m.enviado_en, m.id`,
    projectId,
  );

  const total = classify(rows);
  const tandas = new Map<string, MsgRow[]>();
  for (const r of rows) {
    const k = r.tanda ?? "Sin tanda";
    tandas.set(k, [...(tandas.get(k) ?? []), r]);
  }
  const tramos: Tramo[] = [...tandas.entries()].map(([tanda, rs]) => {
    const dias = Math.min(...rs.map((r) => r.dias));
    return { tanda, ...classify(rs), dias, fresca: dias < 7 };
  });

  const weights = currentWeights(projectId);
  const delivered = rows.filter((r) => r.clasif !== "rebote");
  const atributos: AttrRow[] = [];
  for (const w of weights) {
    for (const valor of [true, false]) {
      const sub = delivered.filter((r) => Boolean(json<Record<string, boolean>>(r.atributos_json, {})[w.clave]) === valor);
      if (!sub.length) continue;
      const pos = sub.filter((r) => r.clasif && POSITIVE.has(r.clasif)).length;
      const n = sub.length;
      atributos.push({
        clave: w.clave, descripcion: w.descripcion, valor, entregados: n, positivos: pos,
        tasa: pos / n, suavizada: (pos + PRIOR_A) / (n + PRIOR_A + PRIOR_B),
        confianza: n < 20 ? "baja" : n < 60 ? "media" : "alta",
        etiqueta: n >= 20 && pos >= 3 ? "con evidencia" : "hipótesis",
      });
    }
  }

  // Comparaciones sí/no por atributo, con el umbral de 7.3 para proponer un cambio de peso.
  const propuestas: { clave: string; descripcion: string; peso: number; si: AttrRow; no: AttrRow; sugerencia: string }[] = [];
  for (const w of weights) {
    const si = atributos.find((a) => a.clave === w.clave && a.valor);
    const no = atributos.find((a) => a.clave === w.clave && !a.valor);
    if (!si || !no) continue;
    const suficiente = si.entregados >= 20 && no.entregados >= 20 && Math.abs(si.positivos - no.positivos) >= 3;
    if (!suficiente) continue;
    const delta = si.suavizada - no.suavizada;
    const sube = delta > 0.03 && w.peso < 25;
    const baja = delta < -0.03 && w.peso > -30;
    if (sube || baja)
      propuestas.push({ ...w, si, no, sugerencia: sube ? `Subir de ${w.peso} a ${Math.min(w.peso + 5, 30)}` : `Bajar de ${w.peso} a ${Math.max(w.peso - 5, -35)}` });
  }

  const conEnlaces = classify(rows.filter((r) => r.con_enlaces));
  const sinEnlaces = classify(rows.filter((r) => !r.con_enlaces));
  const avisos: string[] = [];
  if (total.positivos < 20) avisos.push(`Muestra chica: ${total.positivos} positivos en ${total.enviados} correos. Casi todo es hipótesis.`);
  const frescas = tramos.filter((t) => t.fresca);
  if (frescas.length) avisos.push(`${frescas.length} tanda(s) llevan menos de 7 días: ${frescas.map((t) => t.tanda).join(", ")}. Sus cifras van a moverse.`);
  if (conEnlaces.enviados && sinEnlaces.enviados)
    avisos.push("Variables mezcladas: quitar los enlaces del cuerpo y cambiar de perfil ocurrieron casi al mismo tiempo; no se puede saber cuál pesó más.");

  return { total, tramos, atributos, propuestas, enlaces: { con: conEnlaces, sin: sinEnlaces }, avisos };
}
