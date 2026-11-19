import { norm, mailboxType } from "./text";

/**
 * Scoring (sección 5.4): 0 a 100 = suma de pesos de atributos presentes.
 * Un descalificador duro lo lleva a cero. La ficha muestra por qué tiene ese puntaje.
 */
export type Attributes = Record<string, boolean>;
export type Weight = { clave: string; descripcion: string; peso: number };
export type ScoreLine = { clave: string; descripcion: string; peso: number };

export function score(attrs: Attributes, weights: Weight[], hardDisqualified?: string | null) {
  if (hardDisqualified) return { score: 0, detalle: [{ clave: "descalificado", descripcion: hardDisqualified, peso: 0 }] as ScoreLine[] };
  const detalle: ScoreLine[] = [];
  let total = 0;
  for (const w of weights) {
    if (attrs[w.clave]) {
      total += w.peso;
      detalle.push({ clave: w.clave, descripcion: w.descripcion, peso: w.peso });
    }
  }
  return { score: Math.max(0, Math.min(100, total)), detalle: detalle.sort((a, b) => b.peso - a.peso) };
}

/** Ficha libre (formato de las tandas del experimento). */
export type LooseFicha = Record<string, unknown>;
const txt = (v: unknown): string =>
  v == null ? "" : Array.isArray(v) ? v.map(txt).join(" ") : typeof v === "object" ? JSON.stringify(v) : String(v);

export function firstPrice(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (Array.isArray(v)) {
    const n = v.map((x) => (typeof x === "number" ? x : Number(String(x).replace(/[^\d.]/g, "")))).filter((x) => x > 0);
    return n.length ? Math.max(...n) : null;
  }
  if (typeof v === "string") {
    const m = v.replace(/,/g, "").match(/\d{2,6}/);
    return m ? Number(m[0]) : null;
  }
  return null;
}

/**
 * Atributos estimados desde el texto de una ficha importada (heurística).
 * Las fichas nuevas traen atributos estructurados desde la investigación.
 */
export function inferAttributes(f: LooseFicha, email?: string | null): Attributes {
  const tipo = norm(txt(f.tipo) + " " + txt(f.n ?? f.name) + " " + txt(f.recurrencia));
  const vende = norm(txt(f.vende) + " " + txt(f.cobra));
  const sig = norm(txt(f.siguiente) + " " + txt(f.eventos_2027));
  const tam = norm(txt(f.asistentes) + " " + txt(f.tamano) + " " + txt(f.aforo));
  const all = norm(Object.values(f).map(txt).join(" "));
  const price = firstPrice(f.precio);

  return {
    evento_grande_recurrente:
      /(festival|congreso|conferencia|convencion|expo|summit|cumbre|muestra|fest|copa|concurso|torneo|maraton|gala)/.test(tipo) &&
      /(anual|edicion|cada ano|recurrente|\d+ (a|e)?\s?edicion)/.test(all),
    siguiente_3_12_sin_venta: /(sin venta|aun sin|no esta(n)? a la venta|sin registro abierto|no a la venta|sin boletos)/.test(sig + " " + all),
    dolor_visible:
      /(transferencia|deposito|comprobante|clabe|whatsapp|dm|efectivo|en la puerta|2 plataformas|dos plataformas|paypal|formulario|google forms|luma|extranjera|impuesta)/.test(vende),
    organizacion_con_equipo: /(asociacion|sociedad|colegio|camara|fundacion|productora|a\.?c\.?|s\.?a\.? de c\.?v)/.test(tipo + " " + all),
    boleto_medio_alto: price != null && price >= 500,
    actividades_con_cupo: /(workshop|taller|talleres|masterclass|clinica|curso)/.test(all),
    buzon_nominal_u_operativo: email ? mailboxType(email) !== "generico" : false,
    edicion_reciente: false,
    ya_en_venta_plataforma: /(ya (esta )?a la venta|venta abierta|en venta en|vendido|inscripcion abierta)/.test(sig + " " + vende),
    cartelera_semanal: /(foro|teatro|bar|club|cartelera|piano bar|cabaret)/.test(tipo) && !/(festival|congreso)/.test(tipo),
    tamano_sin_verificar: /suposicion/.test(tam) || tam.trim() === "",
  };
}
