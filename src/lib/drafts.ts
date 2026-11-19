import { all, get, json } from "./db";
import { hookFigure, mxn } from "./hook-formula";
import { firstPrice } from "./scoring";
import { validateEmail, type ValidatorContext } from "./validator";
import { domainOf, isFreeMail } from "./text";
import type { Profile } from "./profile";

/** Generación de borradores desde la plantilla del segmento (sección 6). */

export function validatorContext(projectId: number, ficha?: Record<string, unknown>): ValidatorContext {
  const facts = all<{ afirmacion: string; tipo: string; terminos_json: string }>(
    "SELECT afirmacion, tipo, terminos_json FROM product_facts WHERE project_id = ?", projectId);
  const pick = (t: string) => facts.filter((f) => f.tipo === t).map((f) => ({ afirmacion: f.afirmacion, terminos: json<string[]>(f.terminos_json, []) }));
  const suposiciones = Object.values(ficha ?? {})
    .filter((v): v is string => typeof v === "string" && /SUPOSICI[ÓO]N/.test(v))
    .map((v) => v.replace(/^.*?SUPOSICI[ÓO]N:?\s*/i, ""));
  const idioma = /ingl[eé]s|english/i.test(String(ficha?.idioma ?? "")) && !/espa[nñ]ol/i.test(String(ficha?.idioma ?? "")) ? "en" : "es";
  return { noAfirmar: pick("no_afirmar"), noMencionar: pick("no_mencionar"), suposiciones, idioma };
}

function cleanSaludo(raw: unknown, org: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || /SUPOSICI/i.test(s)) return `Hola, equipo de ${org}:`;
  const main = s.split("(")[0].trim();
  return main.endsWith(":") ? main : `${main}:`;
}

function eventoSiguiente(ficha: Record<string, unknown>): string {
  if (typeof ficha.evento_siguiente === "string" && ficha.evento_siguiente) return ficha.evento_siguiente;
  const asunto = typeof ficha.asunto === "string" ? ficha.asunto : "";
  const m = asunto.match(/\bde (?:la |el |los |las )?(.+)$/i);
  return m ? m[1].trim() : "su siguiente evento";
}

export function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([a-z_]+)\}/g, (all, k) => (vars[k] != null && vars[k] !== "" ? vars[k] : all));
}

export function buildDraft(prospectId: number, profile: Profile) {
  const p = get<{ project_id: number; ficha_json: string; organization_id: number; nombre: string; segment_id: number | null }>(
    `SELECT p.project_id, p.ficha_json, p.organization_id, o.nombre, p.segment_id FROM prospects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ?`,
    prospectId,
  );
  if (!p) throw new Error("Prospecto no encontrado");
  const ficha = json<Record<string, unknown>>(p.ficha_json, {});
  const tpl =
    get<{ id: number; version: number; asunto: string; cuerpo: string }>(
      `SELECT t.id, t.version, t.asunto, t.cuerpo FROM templates t
       WHERE t.project_id = ? AND t.canal = 'correo' AND t.estado = 'activa'
       ORDER BY (t.id = (SELECT template_id FROM segments WHERE id = ?)) DESC, t.id LIMIT 1`,
      p.project_id, p.segment_id ?? -1,
    ) ?? null;
  if (!tpl) throw new Error("El proyecto no tiene plantilla de correo");
  const hook = get<{ formula: string; multiplicador: number; redondeo: number }>(
    "SELECT formula, multiplicador, redondeo FROM hooks WHERE project_id = ? ORDER BY id LIMIT 1", p.project_id);

  const price = firstPrice(ficha.precio ?? ficha.precios);
  const cifra =
    (ficha._cifra_calculada as number | null) ??
    (hook && price ? hookFigure(hook.formula, price, hook.multiplicador, hook.redondeo) : null) ??
    firstPrice(ficha.cifra_por_100);
  const tipo = String(ficha.tipo ?? "") + " " + String(ficha.n ?? ficha.nombre ?? "");
  const queVenden =
    (ficha.que_venden as string) || (/(congreso|concurso|torneo|copa|carrera|marat|curso|summit|convenci)/i.test(tipo) ? "las inscripciones" : "los boletos");
  const observacion = String(ficha.observacion ?? ficha.vimos ?? "").trim();

  const vars: Record<string, string> = {
    saludo: cleanSaludo(ficha.saludo, p.nombre),
    empresa_corta: profile.empresa,
    observacion,
    cifra: cifra ? mxn(cifra) : "",
    evento_siguiente: eventoSiguiente(ficha),
    que_venden: queVenden,
  };
  const asunto = typeof ficha.asunto === "string" && ficha.asunto ? ficha.asunto : render(tpl.asunto, vars);
  const cuerpo = render(tpl.cuerpo, vars).replace(/\n{3,}/g, "\n\n");
  const issues = validateEmail(asunto, cuerpo, validatorContext(p.project_id, ficha));

  const para =
    get<{ valor: string }>(
      "SELECT valor FROM contacts WHERE organization_id = ? AND canal = 'correo' AND estado = 'valido' ORDER BY (tipo_buzon = 'nominal') DESC, id LIMIT 1",
      p.organization_id,
    )?.valor ?? null;
  return { asunto, cuerpo, para, issues, templateId: tpl.id, templateVersion: tpl.version };
}

/**
 * Comprobación de duplicados y supresión (secciones 3.4 y 5.3): por correo y por dominio,
 * en todos los proyectos. Devuelve el motivo si no se debe escribir.
 */
export function contactBlocker(email: string, projectId: number, prospectId?: number): string | null {
  const e = email.toLowerCase();
  const d = domainOf(e);
  const sup = get<{ motivo: string }>(
    `SELECT motivo FROM suppression_list WHERE (valor = ? OR (tipo = 'dominio' AND valor = ?))
       AND (alcance = 'global' OR project_id = ?) LIMIT 1`, e, d, projectId);
  if (sup) return `En la lista de supresión (${sup.motivo}).`;
  const prev = get<{ nombre: string; tanda: string | null }>(
    `SELECT o.nombre, m.tanda FROM messages m JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE m.estado = 'enviado' AND m.direccion = 'salida' AND (lower(m.para) = ? ${isFreeMail(d) ? "" : "OR lower(m.para) LIKE ?"})
       AND (? IS NULL OR m.prospect_id <> ?)
     LIMIT 1`,
    ...(isFreeMail(d) ? [e] : [e, `%@${d}`]), prospectId ?? null, prospectId ?? null,
  );
  if (prev) return `Ya se le escribió a ${prev.nombre}${prev.tanda ? ` (${prev.tanda})` : ""} con este correo o dominio.`;
  return null;
}
