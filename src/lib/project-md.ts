import { all, get, json, run, tx } from "./db";
import { norm } from "./text";

/**
 * Proyecto como archivo Markdown: se exporta, se comparte y se importa.
 * El repositorio no trae proyectos; cada equipo importa los suyos.
 * Formato: encabezados "##" fijos, listas con "-", etiquetas entre corchetes y plantillas en bloques de código.
 */
export type Fact = { afirmacion: string; tipo: "si_afirmar" | "no_afirmar" | "no_mencionar" | "pendiente"; evidencia: string; terminos: string[] };
export type ProjectDoc = {
  nombre: string;
  slug: string;
  idea: string;
  propuesta_valor: string;
  empresa: string;
  voz: string;
  metrica_principal: string;
  conversion: string;
  meta_actual: string;
  investigacion: string;
  gmailEtiqueta: string;
  noInsistir: string[];
  facts: Fact[];
  hook: { clave: string; nombre: string; formula: string; multiplicador: number; redondeo: number; frase: string; condicion: string; supuestos: string[] } | null;
  pesos: { clave: string; descripcion: string; peso: number }[];
  descalificadores: { regla: string; tipo: "duro" | "blando"; origen: string }[];
  segmentos: { nombre: string; definicion: string; consultas: string[] }[];
  territorio: { excluidos: string[]; excepciones: string[]; nota: string };
  plantillaCorreo: { asunto: string; cuerpo: string } | null;
  plantillaWhatsapp: string | null;
};

export const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proyecto";
const key = (s: string) => norm(s).replace(/[^a-z ]/g, "").trim();

/* ---------- Escribir ---------- */

const tags = (pairs: [string, string | string[] | undefined][]) =>
  pairs
    .filter(([, v]) => (Array.isArray(v) ? v.length : v))
    .map(([k, v]) => ` [${k}: ${Array.isArray(v) ? v.join(", ") : v}]`)
    .join("");
const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (vacío)");
const fence = (s: string) => "```\n" + s.trim() + "\n```";

export function toMarkdown(d: ProjectDoc): string {
  const fact = (t: Fact["tipo"]) =>
    bullets(d.facts.filter((f) => f.tipo === t).map((f) => f.afirmacion + tags([["evidencia", f.evidencia], ["términos", f.terminos]])));
  const out = [
    `# Proyecto: ${d.nombre}`,
    "",
    `Clave: ${d.slug}`,
    "",
    "## Idea",
    d.idea,
    "",
    "## Propuesta de valor",
    d.propuesta_valor,
    "",
    "## Datos",
    `- Empresa: ${d.empresa}`,
    `- Voz: ${d.voz}`,
    `- Métrica principal: ${d.metrica_principal}`,
    `- Conversión: ${d.conversion}`,
    `- Meta: ${d.meta_actual}`,
    `- Etiqueta de Gmail: ${d.gmailEtiqueta}`,
    "",
    "## Ficha de verdad",
    "### Se puede afirmar",
    fact("si_afirmar"),
    "### No afirmar",
    fact("no_afirmar"),
    "### No mencionar",
    fact("no_mencionar"),
    "### Pendiente de confirmar",
    fact("pendiente"),
    "",
  ];
  if (d.hook) {
    out.push(
      "## Gancho",
      `- Nombre: ${d.hook.nombre}`,
      `- Clave: ${d.hook.clave}`,
      `- Fórmula: ${d.hook.formula}`,
      `- Por cada: ${d.hook.multiplicador}`,
      `- Redondeo: ${d.hook.redondeo}`,
      `- Frase: ${d.hook.frase}`,
      `- Condición: ${d.hook.condicion}`,
      "### Supuestos",
      bullets(d.hook.supuestos),
      "",
    );
  }
  out.push(
    "## Perfil (pesos)",
    bullets(d.pesos.map((p) => `${p.peso > 0 ? "+" : ""}${p.peso} ${p.clave}: ${p.descripcion}`)),
    "",
    "## Descalificadores",
    "### Duros",
    bullets(d.descalificadores.filter((q) => q.tipo === "duro").map((q) => q.regla + tags([["origen", q.origen]]))),
    "### Blandos",
    bullets(d.descalificadores.filter((q) => q.tipo === "blando").map((q) => q.regla + tags([["origen", q.origen]]))),
    "",
    "## Segmentos",
    ...d.segmentos.flatMap((s) => [`### ${s.nombre}`, s.definicion, "", "Consultas:", bullets(s.consultas), ""]),
    "## Territorio",
    `- Excluidos: ${d.territorio.excluidos.join(", ")}`,
    `- Excepciones: ${d.territorio.excepciones.join("; ")}`,
    `- Nota: ${d.territorio.nota}`,
    "",
  );
  if (d.plantillaCorreo) out.push("## Plantilla de correo", `Asunto: ${d.plantillaCorreo.asunto}`, "", fence(d.plantillaCorreo.cuerpo), "");
  if (d.plantillaWhatsapp) out.push("## Plantilla de WhatsApp", fence(d.plantillaWhatsapp), "");
  out.push("## Instrucciones de investigación", d.investigacion || "(vacío)", "", "## Sitios que no hay que insistir", bullets(d.noInsistir), "");
  return out.join("\n");
}

/* ---------- Leer ---------- */

type Block = { title: string; lines: string[]; subs: { title: string; lines: string[] }[] };

function blocks(md: string): { title: string; head: string[]; sections: Block[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const head: string[] = [];
  const sections: Block[] = [];
  let inFence = false;
  for (const l of lines) {
    if (l.trim().startsWith("```")) inFence = !inFence;
    const cur = sections[sections.length - 1];
    const target = cur ? (cur.subs.length ? cur.subs[cur.subs.length - 1].lines : cur.lines) : head;
    if (!inFence && /^# /.test(l)) title = l.replace(/^# /, "").replace(/^proyecto:\s*/i, "").trim();
    else if (!inFence && /^## /.test(l)) sections.push({ title: key(l.slice(3)), lines: [], subs: [] });
    else if (!inFence && /^### /.test(l) && cur) cur.subs.push({ title: l.slice(4).trim(), lines: [] });
    else target.push(l);
  }
  return { title, head, sections };
}

const text = (lines: string[]) => lines.join("\n").trim().replace(/^\(vacío\)$/, "");
const items = (lines: string[]) =>
  lines.filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).filter((x) => x && x !== "(vacío)");
function splitTags(item: string): { main: string; tags: Record<string, string> } {
  const t: Record<string, string> = {};
  const main = item.replace(/\s*\[([^\]:]+):\s*([^\]]*)\]/g, (_, k, v) => {
    t[key(k)] = v.trim();
    return "";
  });
  return { main: main.trim(), tags: t };
}
const list = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
function kv(lines: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const it of items(lines)) {
    const i = it.indexOf(":");
    if (i > 0) o[key(it.slice(0, i))] = it.slice(i + 1).trim();
  }
  return o;
}
const fenced = (lines: string[]) => {
  const m = lines.join("\n").match(/```[a-z]*\n([\s\S]*?)\n```/);
  return m ? m[1] : null;
};

export function parseMarkdown(md: string): ProjectDoc {
  const { title, head, sections } = blocks(md);
  if (!title) throw new Error('El archivo debe empezar con "# Proyecto: Nombre".');
  const sec = (name: string) => sections.find((s) => s.title.startsWith(key(name)));
  const sub = (b: Block | undefined, name: string) => b?.subs.find((s) => key(s.title).startsWith(key(name)))?.lines ?? [];
  const slugLine = head.find((l) => /^clave:/i.test(l.trim()));
  const datos = kv(sec("Datos")?.lines ?? []);

  const ficha = sec("Ficha de verdad");
  const facts: Fact[] = [];
  for (const [name, tipo] of [["Se puede afirmar", "si_afirmar"], ["No afirmar", "no_afirmar"], ["No mencionar", "no_mencionar"], ["Pendiente", "pendiente"]] as const)
    for (const it of items(sub(ficha, name))) {
      const { main, tags } = splitTags(it);
      facts.push({ afirmacion: main, tipo, evidencia: tags["evidencia"] ?? "", terminos: list(tags["terminos"]) });
    }

  const g = sec("Gancho");
  const gk = kv(g?.lines ?? []);
  const hook = gk["formula"]
    ? {
        nombre: gk["nombre"] ?? "Gancho",
        clave: gk["clave"] || slugify(gk["nombre"] ?? "gancho"),
        formula: gk["formula"],
        multiplicador: Number(gk["por cada"]) || 100,
        redondeo: Number(gk["redondeo"]) || 100,
        frase: gk["frase"] ?? "unos {cifra}",
        condicion: gk["condicion"] ?? "",
        supuestos: items(sub(g, "Supuestos")),
      }
    : null;

  const pesos = items(sec("Perfil")?.lines ?? []).map((it) => {
    const m = it.match(/^([+-]?\d+)\s+([a-z0-9_]+)\s*:\s*(.+)$/i);
    if (!m) throw new Error(`Peso mal escrito: "${it}". Usa "- +20 clave: descripción".`);
    return { peso: Number(m[1]), clave: m[2], descripcion: m[3].trim() };
  });

  const dq = sec("Descalificadores");
  const descalificadores = (["Duros", "Blandos"] as const).flatMap((n) =>
    items(sub(dq, n)).map((it) => {
      const { main, tags } = splitTags(it);
      return { regla: main, tipo: (n === "Duros" ? "duro" : "blando") as "duro" | "blando", origen: tags["origen"] ?? "" };
    }),
  );

  const segmentos = (sec("Segmentos")?.subs ?? []).map((s) => {
    const idx = s.lines.findIndex((l) => /^consultas:?\s*$/i.test(l.trim()));
    const def = idx >= 0 ? s.lines.slice(0, idx) : s.lines.filter((l) => !/^\s*[-*]\s/.test(l));
    return { nombre: s.title, definicion: text(def), consultas: items(idx >= 0 ? s.lines.slice(idx + 1) : s.lines) };
  });

  const terr = kv(sec("Territorio")?.lines ?? []);
  const pc = sec("Plantilla de correo");
  const asunto = pc?.lines.find((l) => /^asunto:/i.test(l.trim()))?.replace(/^\s*asunto:\s*/i, "") ?? "";
  const cuerpoCorreo = pc ? fenced(pc.lines) : null;

  return {
    nombre: title,
    slug: slugLine ? slugify(slugLine.split(":")[1]) : slugify(title),
    idea: text(sec("Idea")?.lines ?? []),
    propuesta_valor: text(sec("Propuesta de valor")?.lines ?? []),
    empresa: datos["empresa"] ?? "",
    voz: datos["voz"] ?? "",
    metrica_principal: datos["metrica principal"] ?? "",
    conversion: datos["conversion"] ?? "",
    meta_actual: datos["meta"] ?? "",
    gmailEtiqueta: datos["etiqueta de gmail"] || `Prospección/${title}`,
    investigacion: text(sec("Instrucciones de investigacion")?.lines ?? []),
    noInsistir: items(sec("Sitios que no")?.lines ?? []),
    facts,
    hook,
    pesos,
    descalificadores,
    segmentos,
    territorio: { excluidos: list(terr["excluidos"]), excepciones: (terr["excepciones"] ?? "").split(";").map((x) => x.trim()).filter(Boolean), nota: terr["nota"] ?? "" },
    plantillaCorreo: cuerpoCorreo ? { asunto, cuerpo: cuerpoCorreo } : null,
    plantillaWhatsapp: fenced(sec("Plantilla de WhatsApp")?.lines ?? []),
  };
}

/* ---------- Base de datos ---------- */

export function readProject(projectId: number): ProjectDoc {
  const p = get<{ slug: string; nombre: string; idea: string; propuesta_valor: string; voz: string; metrica_principal: string; conversion: string; meta_actual: string; config_json: string }>(
    "SELECT * FROM projects WHERE id = ?", projectId)!;
  const cfg = json<{ empresa?: string; investigacion?: string; noInsistir?: string[]; gmail?: { etiqueta?: string } }>(p.config_json, {});
  const h = get<{ clave: string; nombre: string; formula: string; multiplicador: number; redondeo: number; frase: string; condicion: string; supuestos_json: string }>(
    "SELECT * FROM hooks WHERE project_id = ? ORDER BY id LIMIT 1", projectId);
  const terr = get<{ excluidos_json: string; excepciones_json: string; motivo: string }>("SELECT * FROM territories WHERE project_id = ? ORDER BY id DESC LIMIT 1", projectId);
  const correo = get<{ asunto: string; cuerpo: string }>("SELECT asunto, cuerpo FROM templates WHERE project_id = ? AND canal = 'correo' AND estado = 'activa' ORDER BY id LIMIT 1", projectId);
  const wa = get<{ cuerpo: string }>("SELECT cuerpo FROM templates WHERE project_id = ? AND canal = 'whatsapp' AND estado = 'activa' ORDER BY id LIMIT 1", projectId);
  return {
    nombre: p.nombre, slug: p.slug, idea: p.idea, propuesta_valor: p.propuesta_valor, voz: p.voz,
    metrica_principal: p.metrica_principal, conversion: p.conversion, meta_actual: p.meta_actual,
    empresa: cfg.empresa ?? "", investigacion: cfg.investigacion ?? "", noInsistir: cfg.noInsistir ?? [],
    gmailEtiqueta: cfg.gmail?.etiqueta ?? `Prospección/${p.nombre}`,
    facts: all<{ afirmacion: string; tipo: Fact["tipo"]; evidencia: string; terminos_json: string }>(
      "SELECT afirmacion, tipo, evidencia, terminos_json FROM product_facts WHERE project_id = ? ORDER BY id", projectId,
    ).map((f) => ({ afirmacion: f.afirmacion, tipo: f.tipo, evidencia: f.evidencia, terminos: json<string[]>(f.terminos_json, []) })),
    hook: h ? { clave: h.clave, nombre: h.nombre, formula: h.formula, multiplicador: h.multiplicador, redondeo: h.redondeo, frase: h.frase, condicion: h.condicion, supuestos: json<string[]>(h.supuestos_json, []) } : null,
    pesos: all<{ clave: string; descripcion: string; peso: number }>(
      `SELECT clave, descripcion, peso FROM icp_attributes WHERE project_id = ? AND version = (SELECT MAX(version) FROM icp_attributes WHERE project_id = ?) ORDER BY peso DESC, id`,
      projectId, projectId),
    descalificadores: all<{ regla: string; tipo: "duro" | "blando"; origen: string }>("SELECT regla, tipo, origen FROM disqualifiers WHERE project_id = ? ORDER BY id", projectId),
    segmentos: all<{ nombre: string; definicion: string; consultas_json: string }>(
      "SELECT nombre, definicion, consultas_json FROM segments WHERE project_id = ? AND estado = 'activo' ORDER BY id", projectId,
    ).map((s) => ({ nombre: s.nombre, definicion: s.definicion, consultas: json<string[]>(s.consultas_json, []) })),
    territorio: { excluidos: json<string[]>(terr?.excluidos_json, []), excepciones: json<string[]>(terr?.excepciones_json, []), nota: terr?.motivo ?? "" },
    plantillaCorreo: correo ?? null,
    plantillaWhatsapp: wa?.cuerpo ?? null,
  };
}

/**
 * Importa un proyecto. Si ya existe (misma clave), reemplaza su configuración y conserva
 * prospectos, mensajes y respuestas. Devuelve el id y si era nuevo.
 */
export function importProject(d: ProjectDoc): { id: number; nuevo: boolean } {
  if (!d.propuesta_valor) throw new Error('Falta la sección "## Propuesta de valor".');
  if (!d.segmentos.length) throw new Error('Falta al menos un segmento en "## Segmentos".');
  if (!d.pesos.length) throw new Error('Falta "## Perfil (pesos)".');
  return tx(() => {
    const prev = get<{ id: number; config_json: string }>("SELECT id, config_json FROM projects WHERE slug = ?", d.slug);
    const cfg = { ...json<Record<string, unknown>>(prev?.config_json, {}), empresa: d.empresa, investigacion: d.investigacion, noInsistir: d.noInsistir, gmail: { etiqueta: d.gmailEtiqueta } };
    let id: number;
    if (prev) {
      id = prev.id;
      run(
        "UPDATE projects SET nombre = ?, idea = ?, propuesta_valor = ?, voz = ?, metrica_principal = ?, conversion = ?, meta_actual = ?, config_json = ?, estado = 'activo' WHERE id = ?",
        d.nombre, d.idea, d.propuesta_valor, d.voz, d.metrica_principal, d.conversion, d.meta_actual, JSON.stringify(cfg), id);
      run("DELETE FROM product_facts WHERE project_id = ?", id);
      run("DELETE FROM disqualifiers WHERE project_id = ?", id);
      run("DELETE FROM territories WHERE project_id = ?", id);
    } else {
      id = Number(
        run(
          "INSERT INTO projects (slug, nombre, idea, propuesta_valor, voz, metrica_principal, conversion, meta_actual, config_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          d.slug, d.nombre, d.idea, d.propuesta_valor, d.voz, d.metrica_principal, d.conversion, d.meta_actual, JSON.stringify(cfg),
        ).lastInsertRowid,
      );
    }
    for (const f of d.facts)
      run("INSERT INTO product_facts (project_id, afirmacion, tipo, evidencia, terminos_json) VALUES (?, ?, ?, ?, ?)", id, f.afirmacion, f.tipo, f.evidencia, JSON.stringify(f.terminos));
    for (const q of d.descalificadores) run("INSERT INTO disqualifiers (project_id, regla, tipo, origen) VALUES (?, ?, ?, ?)", id, q.regla, q.tipo, q.origen);
    run("INSERT INTO territories (project_id, usuario, excluidos_json, excepciones_json, motivo) VALUES (?, 'owner', ?, ?, ?)",
      id, JSON.stringify(d.territorio.excluidos), JSON.stringify(d.territorio.excepciones), d.territorio.nota);

    // Pesos: nueva versión solo si cambiaron (quedan registrados como versión del algoritmo).
    const actuales = all<{ clave: string; peso: number; descripcion: string }>(
      "SELECT clave, peso, descripcion FROM icp_attributes WHERE project_id = ? AND version = (SELECT MAX(version) FROM icp_attributes WHERE project_id = ?)", id, id);
    const firma = (xs: { clave: string; peso: number; descripcion: string }[]) => JSON.stringify([...xs].sort((a, b) => a.clave.localeCompare(b.clave)).map((x) => [x.clave, x.peso, x.descripcion]));
    if (firma(actuales) !== firma(d.pesos)) {
      const v = (get<{ v: number | null }>("SELECT MAX(version) v FROM icp_attributes WHERE project_id = ?", id)?.v ?? 0) + 1;
      for (const w of d.pesos) run("INSERT INTO icp_attributes (project_id, clave, descripcion, peso, version) VALUES (?, ?, ?, ?, ?)", id, w.clave, w.descripcion, w.peso, v);
      run("INSERT INTO algorithm_versions (project_id, cambios_json, evidencia, aprobado_por) VALUES (?, ?, 'Importado desde .md', 'owner')", id, JSON.stringify({ pesos: d.pesos }));
    }

    let hookId: number | null = null;
    if (d.hook) {
      const h = get<{ id: number }>("SELECT id FROM hooks WHERE project_id = ? AND clave = ?", id, d.hook.clave);
      if (h) {
        hookId = h.id;
        run("UPDATE hooks SET nombre = ?, formula = ?, multiplicador = ?, redondeo = ?, frase = ?, supuestos_json = ?, condicion = ? WHERE id = ?",
          d.hook.nombre, d.hook.formula, d.hook.multiplicador, d.hook.redondeo, d.hook.frase, JSON.stringify(d.hook.supuestos), d.hook.condicion, h.id);
      } else {
        hookId = Number(run("INSERT INTO hooks (project_id, clave, nombre, formula, multiplicador, redondeo, frase, supuestos_json, condicion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          id, d.hook.clave, d.hook.nombre, d.hook.formula, d.hook.multiplicador, d.hook.redondeo, d.hook.frase, JSON.stringify(d.hook.supuestos), d.hook.condicion).lastInsertRowid);
      }
    }

    const upsertTpl = (canal: "correo" | "whatsapp", asunto: string, cuerpo: string): number => {
      const t = get<{ id: number; asunto: string; cuerpo: string; version: number }>("SELECT id, asunto, cuerpo, version FROM templates WHERE project_id = ? AND canal = ? AND estado = 'activa' ORDER BY id LIMIT 1", id, canal);
      if (t && t.asunto === asunto && t.cuerpo === cuerpo) return t.id;
      if (t) run("UPDATE templates SET estado = 'archivada' WHERE id = ?", t.id);
      return Number(run("INSERT INTO templates (project_id, clave, canal, asunto, cuerpo, version) VALUES (?, ?, ?, ?, ?, ?)",
        id, canal === "correo" ? "correo_principal" : "whatsapp", canal, asunto, cuerpo, (t?.version ?? 0) + 1).lastInsertRowid);
    };
    const tplId = d.plantillaCorreo ? upsertTpl("correo", d.plantillaCorreo.asunto, d.plantillaCorreo.cuerpo) : null;
    if (d.plantillaWhatsapp) upsertTpl("whatsapp", "", d.plantillaWhatsapp);

    const vivos = new Set<number>();
    for (const s of d.segmentos) {
      const ex = get<{ id: number }>("SELECT id FROM segments WHERE project_id = ? AND nombre = ?", id, s.nombre);
      if (ex) {
        run("UPDATE segments SET definicion = ?, consultas_json = ?, hook_id = ?, template_id = ?, estado = 'activo' WHERE id = ?", s.definicion, JSON.stringify(s.consultas), hookId, tplId, ex.id);
        vivos.add(ex.id);
      } else {
        vivos.add(Number(run("INSERT INTO segments (project_id, nombre, definicion, consultas_json, hook_id, template_id) VALUES (?, ?, ?, ?, ?, ?)",
          id, s.nombre, s.definicion, JSON.stringify(s.consultas), hookId, tplId).lastInsertRowid));
      }
    }
    for (const s of all<{ id: number }>("SELECT id FROM segments WHERE project_id = ?", id)) if (!vivos.has(s.id)) run("UPDATE segments SET estado = 'archivado' WHERE id = ?", s.id);

    for (const h of d.noInsistir) run("INSERT OR IGNORE INTO blocked_hosts (host, motivo) VALUES (?, 'Indicado en el proyecto')", h);
    run("INSERT OR IGNORE INTO labels (project_id, nombre, tipo) VALUES (?, ?, 'sistema')", id, d.gmailEtiqueta);
    run("INSERT INTO audit_log (quien, que, detalle) VALUES ('owner', 'importar_proyecto', ?)", `${d.nombre} (${prev ? "actualizado" : "nuevo"})`);
    return { id, nuevo: !prev };
  });
}

/** Plantilla en blanco para empezar un proyecto. */
export const PLANTILLA_PROYECTO: ProjectDoc = {
  nombre: "Mi producto",
  slug: "mi-producto",
  idea: "Qué quieres lograr con esta prospección, en una o dos frases.",
  propuesta_valor: "Qué es, para quién y por qué le conviene, en un párrafo.",
  empresa: "Tu empresa (ciudad)",
  voz: "Directa y concreta",
  metrica_principal: "Clientes nuevos por mes",
  conversion: "Primer pedido",
  meta_actual: "Cerrar el primer cliente",
  investigacion: "Qué datos buscar de cada prospecto además de lo básico (por ejemplo: cómo cobran hoy, cuándo es su siguiente temporada, precios).",
  gmailEtiqueta: "Prospección/Mi producto",
  noInsistir: [],
  facts: [
    { afirmacion: "Función que sí existe y puedes prometer", tipo: "si_afirmar", evidencia: "dónde lo comprobaste", terminos: [] },
    { afirmacion: "Función que NO existe", tipo: "no_afirmar", evidencia: "", terminos: ["palabra que el validador bloquea"] },
  ],
  hook: { clave: "ahorro", nombre: "Ahorro estimado", formula: "ahorro = 0.05 * P", multiplicador: 100, redondeo: 100, frase: "unos {cifra} por cada 100 ventas", condicion: "", supuestos: ["Supuesto de la fórmula; P es el precio del prospecto"] },
  pesos: [
    { clave: "dolor_visible", descripcion: "Se ve el problema que resolvemos", peso: 30 },
    { clave: "tamano_adecuado", descripcion: "Tamaño adecuado para nuestro producto", peso: 20 },
    { clave: "ya_tiene_solucion", descripcion: "Ya usa una solución parecida", peso: -30 },
  ],
  descalificadores: [{ regla: "Gobierno", tipo: "duro", origen: "" }],
  segmentos: [{ nombre: "Primer segmento", definicion: "Tipo de prospecto, dolor y territorio.", consultas: ["frase de búsqueda 1", "frase de búsqueda 2"] }],
  territorio: { excluidos: [], excepciones: [], nota: "" },
  plantillaCorreo: {
    asunto: "Una idea para {que_venden} de {evento_siguiente}",
    cuerpo: "{saludo}\n\nSomos {empresa_corta}. {observacion} Con nuestro producto… unos {cifra}.\n\n¿Con quién nos convendría platicarlo?\n\nSaludos cordiales,",
  },
  plantillaWhatsapp: "Hola, {nombre}. Soy {mi_nombre}, de {empresa_corta}.\n\n{observacion_corta} y quería ver si les interesa…\n\n¿Le puedo platicar unos minutos?",
};

/** Pesos vigentes (última versión) del perfil del proyecto. */
export function currentWeights(projectId: number) {
  return all<{ clave: string; descripcion: string; peso: number }>(
    "SELECT clave, descripcion, peso FROM icp_attributes WHERE project_id = ? AND version = (SELECT MAX(version) FROM icp_attributes WHERE project_id = ?) ORDER BY peso DESC, id",
    projectId, projectId,
  );
}
