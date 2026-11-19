import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { get, run, tx } from "./db";
import { domainOf, emailsIn, isFreeMail, mailboxType, norm, detectEstado } from "./text";
import { inferAttributes, score, type Weight, type LooseFicha } from "./scoring";
import { hookFigure } from "./hook-formula";
import { firstPrice } from "./scoring";
import { currentWeights } from "./project-md";

/**
 * Importador de historial (MVP, sección 10).
 * Lee los archivos de tandas del experimento + un manifiesto curado de envíos y respuestas.
 * Lo que no se puede reconstruir queda marcado "sin atributos".
 */
const Enviado = z.object({ buscar: z.string().optional(), n: z.string().optional(), correo: z.string().optional(), lugar: z.string().optional(), nota: z.string().optional() });
const Manifest = z.object({
  proyecto: z.string(),
  orden_archivos: z.array(z.string()),
  tandas: z.array(z.object({ id: z.string(), fecha: z.string(), con_enlaces: z.boolean(), enfoque: z.string().default(""), enviados: z.array(Enviado) })),
  respuestas: z.array(
    z.object({
      buscar: z.string(),
      clasificacion: z.enum(["interesado", "acuse", "no_ahora", "no", "rebote", "auto_respuesta", "vacia", "baja", "otro"]),
      fecha: z.string(),
      pide: z.enum(["info", "llamada", "reunion", "nada"]).optional(),
      quien: z.string().optional(),
      en_copia: z.string().optional(),
      resumen: z.string(),
      retomar: z.string().optional(),
    }),
  ),
});

type Lista = "A" | "B" | "solo_wa_ig" | "descartado";
type Rec = { nombre: string; ficha: LooseFicha; lista: Lista; motivo?: string; archivo: string; emails: string[]; asunto?: string; cuerpo?: string };

const LIST_MAP: Record<string, Lista> = {
  A_correo_verificado: "A",
  B_correo_verificado_mas_debil: "B",
  reserva_con_correo: "B",
  sin_verificar: "B",
  solo_whatsapp_o_ig: "solo_wa_ig",
  solo_whatsapp: "solo_wa_ig",
  descartados: "descartado",
};

function readRecords(dir: string, archivo: string): Rec[] {
  const data = JSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8"));
  const out: Rec[] = [];
  const push = (item: unknown, lista: Lista) => {
    if (typeof item === "string") {
      const [nombre, ...rest] = item.split(/:\s|\s—\s|\s-\s/);
      const ficha: LooseFicha = { n: nombre.trim(), nota: item };
      const emails = emailsIn(item);
      out.push({ nombre: nombre.trim(), ficha, lista, motivo: lista === "descartado" ? rest.join(": ").trim() || item : undefined, archivo, emails });
      return;
    }
    const f = item as LooseFicha;
    const nombre = String(f.n ?? f.name ?? "").trim();
    if (!nombre) return;
    const emails = [...emailsIn(String(f.to ?? "")), ...emailsIn(String(f.email ?? ""))];
    const lst: Lista = lista === "A" && emails.length === 0 ? "solo_wa_ig" : lista;
    out.push({ nombre, ficha: f, lista: lst, archivo, emails: [...new Set(emails)], asunto: (f.subject ?? f.asunto) as string | undefined, cuerpo: f.body as string | undefined });
  };
  if (Array.isArray(data)) data.forEach((it) => push(it, "A"));
  else for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && LIST_MAP[k]) v.forEach((it) => push(it, LIST_MAP[k]));
  return out;
}

export type ImportSummary = {
  archivos: number;
  fichas: number;
  organizaciones: number;
  enviados: number;
  sinFicha: string[];
  noEncontrados: string[];
  respuestas: Record<string, number>;
};

export function importHistory(projectId: number, dir: string, opts: { reset?: boolean } = {}): ImportSummary {
  const manifest = Manifest.parse(JSON.parse(fs.readFileSync(path.join(dir, "historial.json"), "utf8")));
  const tandasDir = fs.existsSync(path.join(dir, "tandas")) ? path.join(dir, "tandas") : dir;

  const already = get<{ c: number }>(
    "SELECT COUNT(*) c FROM messages m JOIN prospects p ON p.id = m.prospect_id WHERE p.project_id = ? AND m.estado = 'enviado'",
    projectId,
  )!.c;
  if (already > 0 && !opts.reset) throw new Error(`El proyecto ya tiene ${already} envíos. Usa --reset para reimportar.`);

  const weights: Weight[] = currentWeights(projectId);
  const hook = get<{ formula: string; multiplicador: number; redondeo: number }>(
    "SELECT formula, multiplicador, redondeo FROM hooks WHERE project_id = ? ORDER BY id LIMIT 1",
    projectId,
  );

  return tx(() => {
    if (opts.reset) {
      run("DELETE FROM prospects WHERE project_id = ?", projectId);
      run("DELETE FROM search_runs WHERE project_id = ?", projectId);
      run("DELETE FROM suppression_list WHERE project_id = ? OR (alcance = 'global' AND motivo LIKE 'importado:%')", projectId);
      run("DELETE FROM organizations WHERE id NOT IN (SELECT organization_id FROM prospects)");
    }

    // 1) Fichas de todos los archivos, en orden cronológico (la más reciente gana).
    const runIds = new Map<string, number>();
    const prospectByOrg = new Map<number, number>();
    let fichas = 0;

    const orgFor = (nombre: string, emails: string[], lugar?: string): number => {
      const nn = norm(nombre);
      const byName = get<{ id: number }>("SELECT id FROM organizations WHERE nombre_norm = ?", nn);
      if (byName) return byName.id;
      for (const e of emails) {
        const d = domainOf(e);
        if (!d || isFreeMail(d)) continue;
        const byDomain = get<{ id: number }>("SELECT o.id FROM organizations o, json_each(o.dominios_json) j WHERE j.value = ?", d);
        if (byDomain) return byDomain.id;
      }
      const dominios = [...new Set(emails.map(domainOf).filter((d) => d && !isFreeMail(d)))];
      return Number(
        run(
          "INSERT INTO organizations (nombre, nombre_norm, dominios_json, ciudad, estado) VALUES (?, ?, ?, ?, ?)",
          nombre, nn, JSON.stringify(dominios), lugar ?? null, detectEstado(lugar ?? null),
        ).lastInsertRowid,
      );
    };

    const upsertProspect = (rec: Rec, runId: number): number => {
      const lugar = rec.ficha.lugar as string | undefined;
      const orgId = orgFor(rec.nombre, rec.emails, lugar);
      const primary = rec.emails[0] ?? null;
      const attrs = inferAttributes(rec.ficha, primary);
      const sc = rec.lista === "descartado" ? { score: 0, detalle: [] } : score(attrs, weights);
      const price = firstPrice(rec.ficha.precio);
      const cifra = hook && price ? hookFigure(hook.formula, price, hook.multiplicador, hook.redondeo) : null;
      const ficha = { ...rec.ficha, _archivo: rec.archivo, _cifra_calculada: cifra };
      const existing = prospectByOrg.get(orgId);
      if (existing) {
        // No degradar una ficha con correo a "descartado" por una mención posterior.
        run(
          `UPDATE prospects SET ficha_json = ?, atributos_json = ?, score = ?, score_detalle_json = ?,
             lista = CASE WHEN ? = 'descartado' AND lista <> 'descartado' THEN lista ELSE ? END,
             motivo_descarte = COALESCE(?, motivo_descarte), search_run_id = ?, actualizado_en = datetime('now')
           WHERE id = ?`,
          JSON.stringify(ficha), JSON.stringify(attrs), sc.score, JSON.stringify(sc.detalle), rec.lista, rec.lista, rec.motivo ?? null, runId, existing,
        );
      } else {
        const id = Number(
          run(
            `INSERT INTO prospects (project_id, organization_id, search_run_id, ficha_json, atributos_json, score, score_detalle_json, score_version, lista, motivo_descarte, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            projectId, orgId, runId, JSON.stringify(ficha), JSON.stringify(attrs), sc.score, JSON.stringify(sc.detalle), rec.lista, rec.motivo ?? null,
            rec.lista === "descartado" ? "descartado" : "investigado",
          ).lastInsertRowid,
        );
        prospectByOrg.set(orgId, id);
      }
      for (const e of rec.emails) {
        if (!get("SELECT 1 FROM contacts WHERE organization_id = ? AND valor = ?", orgId, e))
          run(
            "INSERT INTO contacts (organization_id, canal, valor, tipo_buzon, url_fuente, fecha_visto) VALUES (?, 'correo', ?, ?, ?, ?)",
            orgId, e, mailboxType(e), Array.isArray(rec.ficha.fuente) ? String(rec.ficha.fuente[0]) : ((rec.ficha.fuente as string) ?? null), null,
          );
      }
      const wa = (rec.ficha.wa ?? rec.ficha.tel) as string | undefined;
      if (wa && !get("SELECT 1 FROM contacts WHERE organization_id = ? AND valor = ?", orgId, String(wa)))
        run("INSERT INTO contacts (organization_id, canal, valor) VALUES (?, 'whatsapp', ?)", orgId, String(wa));
      for (const raw of [rec.ficha.fuente, rec.ficha.evidencia].flat().filter((u): u is string => typeof u === "string" && u.startsWith("http"))) {
        // "https://sitio/ (mailto y sección de precios; leído el 17-nov)" → URL + nota
        const [url, ...nota] = raw.trim().split(/\s+/);
        const que = nota.join(" ").replace(/^\(|\)$/g, "") || "Fuente citada en la ficha";
        const pid = prospectByOrg.get(orgId)!;
        if (!get("SELECT 1 FROM evidence WHERE prospect_id = ? AND url = ?", pid, url))
          run("INSERT INTO evidence (prospect_id, url, que_demuestra, tipo) VALUES (?, ?, ?, 'verificado')", pid, url, que);
      }
      fichas++;
      return prospectByOrg.get(orgId)!;
    };

    const index: { n: string; rec: Rec; order: number }[] = [];
    manifest.orden_archivos.forEach((archivo, order) => {
      const file = path.join(tandasDir, archivo);
      if (!fs.existsSync(file)) return;
      const runId = Number(
        run("INSERT INTO search_runs (project_id, etiqueta, origen, fecha) VALUES (?, ?, 'importado', datetime('now'))", projectId, archivo.replace(/\.json$/, ""))
          .lastInsertRowid,
      );
      runIds.set(archivo, runId);
      for (const rec of readRecords(tandasDir, archivo)) {
        upsertProspect(rec, runId);
        index.push({ n: norm(rec.nombre), rec, order });
      }
    });

    const find = (buscar: string): Rec | undefined => {
      const q = norm(buscar);
      const hits = index.filter((i) => i.n.includes(q) && i.rec.lista !== "descartado");
      const any = hits.length ? hits : index.filter((i) => i.n.includes(q));
      return any.sort((a, b) => b.order - a.order)[0]?.rec;
    };

    // 2) Envíos por tanda.
    const bitacoraRun = Number(
      run("INSERT INTO search_runs (project_id, etiqueta, origen) VALUES (?, 'Bitácora (sin archivo de tanda)', 'importado')", projectId).lastInsertRowid,
    );
    const sentByKey = new Map<string, number>(); // norm(buscar|n) -> message id
    const sinFicha: string[] = [];
    const noEncontrados: string[] = [];
    let enviados = 0;

    for (const t of manifest.tandas) {
      for (const e of t.enviados) {
        const key = e.buscar ?? e.n!;
        let rec = e.buscar ? find(e.buscar) : undefined;
        if (e.buscar && !rec) noEncontrados.push(`${t.id}: ${e.buscar}`);
        if (!rec) {
          sinFicha.push(`${t.id}: ${e.n ?? e.buscar}`);
          rec = {
            nombre: e.n ?? e.buscar!,
            ficha: { n: e.n ?? e.buscar, lugar: e.lugar, nota: e.nota ?? "Sin atributos: solo aparece en la bitácora." },
            lista: e.correo ? "A" : "B",
            archivo: "bitácora",
            emails: e.correo ? [e.correo.toLowerCase()] : [],
          };
        }
        const pid = upsertProspect(rec, rec.archivo === "bitácora" ? bitacoraRun : runIds.get(rec.archivo) ?? bitacoraRun);
        const para = (e.correo ?? rec.emails[0] ?? null)?.toLowerCase() ?? null;
        const contact = para ? get<{ id: number }>("SELECT c.id FROM contacts c JOIN prospects p ON p.organization_id = c.organization_id WHERE p.id = ? AND c.valor = ?", pid, para) : undefined;
        const msgId = Number(
          run(
            `INSERT INTO messages (prospect_id, contact_id, canal, direccion, para, asunto, cuerpo, estado, tanda, con_enlaces, enviado_en, aprobado_por)
             VALUES (?, ?, 'correo', 'salida', ?, ?, ?, 'enviado', ?, ?, ?, 'owner')`,
            pid, contact?.id ?? null, para, rec.asunto ?? "", rec.cuerpo ?? "", t.id, t.con_enlaces ? 1 : 0, t.fecha,
          ).lastInsertRowid,
        );
        run("UPDATE prospects SET estado = 'enviado', lista = CASE WHEN lista = 'descartado' THEN 'B' ELSE lista END WHERE id = ?", pid);
        sentByKey.set(norm(key), msgId);
        enviados++;
      }
    }

    // 3) Respuestas.
    const respuestas: Record<string, number> = {};
    const ESTADO: Record<string, string | null> = {
      interesado: "interesado", acuse: "interesado", no_ahora: "retomar", no: "cerrado", rebote: "rebote", baja: "cerrado",
      auto_respuesta: null, vacia: null, otro: null,
    };
    for (const r of manifest.respuestas) {
      const msgId = sentByKey.get(norm(r.buscar));
      if (!msgId) {
        noEncontrados.push(`respuesta: ${r.buscar}`);
        continue;
      }
      run(
        `INSERT INTO reply_events (message_id, fecha, clasificacion, confianza, resumen, quien_respondio, en_copia, pide, revisado_por_humano)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, 1)`,
        msgId, r.fecha, r.clasificacion, r.resumen, r.quien ?? null, r.en_copia ?? null, r.pide ?? null,
      );
      const m = get<{ prospect_id: number; contact_id: number | null; para: string | null }>("SELECT prospect_id, contact_id, para FROM messages WHERE id = ?", msgId)!;
      const estado = ESTADO[r.clasificacion];
      if (estado) run("UPDATE prospects SET estado = ? WHERE id = ?", estado, m.prospect_id);
      if (r.clasificacion === "rebote") {
        if (m.contact_id) run("UPDATE contacts SET estado = 'reboto' WHERE id = ?", m.contact_id);
        if (m.para) run("INSERT OR IGNORE INTO suppression_list (valor, tipo, alcance, motivo) VALUES (?, 'correo', 'global', 'importado: rebotó')", m.para);
      }
      if (r.clasificacion === "no" && m.para)
        run(
          "INSERT OR IGNORE INTO suppression_list (valor, tipo, alcance, project_id, motivo) VALUES (?, 'dominio', 'proyecto', ?, 'no interesado')",
          isFreeMail(domainOf(m.para)) ? m.para : domainOf(m.para), projectId,
        );
      if (r.retomar) run("INSERT INTO followups (prospect_id, tipo, motivo) VALUES (?, 'retomar', ?)", m.prospect_id, r.retomar);
      respuestas[r.clasificacion] = (respuestas[r.clasificacion] ?? 0) + 1;
    }

    const organizaciones = get<{ c: number }>("SELECT COUNT(DISTINCT organization_id) c FROM prospects WHERE project_id = ?", projectId)!.c;
    run("INSERT INTO audit_log (quien, que, detalle) VALUES ('owner', 'importar_historial', ?)", `${enviados} envíos desde ${dir}`);
    return { archivos: runIds.size, fichas, organizaciones, enviados, sinFicha, noEncontrados, respuestas };
  });
}
