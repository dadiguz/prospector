import { all, get, json, run } from "./db";
import { firstPhone } from "./whatsapp";

/**
 * Canales de contacto escritos como texto en las fichas
 * (por ejemplo "contacto: WhatsApp 311 267 6044; Instagram @oktoberfestnayarit").
 */
const CAMPOS = ["wa", "whatsapp", "tel", "telefono", "contacto", "canal", "instagram", "ig"];

export function channelsFromFicha(f: Record<string, unknown>): { phones: string[]; instagrams: string[] } {
  const textos = CAMPOS.map((k) => f[k]).filter((v) => typeof v === "string") as string[];
  // Fichas que vienen de una línea de texto: el dato está en la nota.
  if (Object.keys(f).filter((k) => !k.startsWith("_")).every((k) => k === "n" || k === "nota") && typeof f.nota === "string") textos.push(f.nota);
  const phones = new Set<string>();
  const instagrams = new Set<string>();
  for (const t of textos) {
    for (const parte of t.split(/[;|,]| y /)) {
      const p = firstPhone(parte);
      if (p) phones.add(p);
    }
    for (const m of t.matchAll(/(?:instagram\.com\/|(?<![\w.])@)([A-Za-z0-9._]{3,30})/gi)) if (!/\.(com|mx|org)$/i.test(m[1])) instagrams.add(`@${m[1].replace(/\.$/, "")}`);
  }
  return { phones: [...phones], instagrams: [...instagrams] };
}

export function addChannels(orgId: number, f: Record<string, unknown>) {
  const { phones, instagrams } = channelsFromFicha(f);
  for (const p of phones)
    if (!get("SELECT 1 FROM contacts WHERE organization_id = ? AND canal = 'whatsapp' AND replace(replace(replace(valor,' ',''),'-',''),'+','') LIKE ?", orgId, `%${p.slice(-10)}%`))
      run("INSERT INTO contacts (organization_id, canal, valor, nota) VALUES (?, 'whatsapp', ?, 'extraído de la ficha')", orgId, `+${p}`);
  for (const ig of instagrams)
    if (!get("SELECT 1 FROM contacts WHERE organization_id = ? AND canal = 'instagram' AND lower(valor) = lower(?)", orgId, ig))
      run("INSERT INTO contacts (organization_id, canal, valor, nota) VALUES (?, 'instagram', ?, 'extraído de la ficha')", orgId, ig);
}

const g = globalThis as unknown as { __channelsDone?: Set<number> };
/** Una vez por proceso y proyecto: completa los canales de fichas ya guardadas. Idempotente. */
export function backfillChannels(projectId: number) {
  g.__channelsDone ??= new Set();
  if (g.__channelsDone.has(projectId)) return;
  for (const p of all<{ organization_id: number; ficha_json: string }>("SELECT organization_id, ficha_json FROM prospects WHERE project_id = ?", projectId))
    addChannels(p.organization_id, json(p.ficha_json, {}));
  g.__channelsDone.add(projectId);
}
