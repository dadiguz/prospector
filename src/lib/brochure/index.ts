import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { z } from "zod";
import { all, get, json } from "../db";
import { dataDir } from "../paths";
import { readProfile } from "../profile";
import { leerSitio, bajarFoto } from "./scrape";
import { redactarBrochure, type BrochureDoc } from "./content";
import { renderBrochure, type Marca } from "./template";

/**
 * Brochure para un prospecto que respondió: lee su sitio, redacta el contenido, baja sus fotos
 * y exporta PDF + una imagen por página. Todo queda en ~/.prospector/brochures/<prospecto>/.
 */

const run = promisify(execFile);
export const PAGINAS = 6;

export const carpetaBrochure = (prospectId: number) => path.join(dataDir(), "brochures", String(prospectId));

/** Marca de quien vende: ~/.prospector/brochure.json y ~/.prospector/marca/{logo,isotipo}.svg (fuera del repo). */
const MarcaConfig = z.object({
  empresa: z.string().optional(),
  ubicacion: z.string().default(""),
  correo: z.string().optional(),
  sitio: z.string().default(""),
  referencia: z.object({ titulo: z.string(), texto: z.string() }).nullable().default(null),
});

function leerMarca(dir: string): Marca {
  const perfil = readProfile();
  let cfg = MarcaConfig.parse({});
  try {
    cfg = MarcaConfig.parse(JSON.parse(fs.readFileSync(path.join(dataDir(), "brochure.json"), "utf8")));
  } catch {
    /* sin configuración: se usa el perfil */
  }
  const copiar = (nombre: string) => {
    const src = path.join(dataDir(), "marca", nombre);
    if (!fs.existsSync(src)) return null;
    fs.mkdirSync(path.join(dir, "marca"), { recursive: true });
    fs.copyFileSync(src, path.join(dir, "marca", nombre));
    return `marca/${nombre}`;
  };
  const tel = (perfil?.telefono ?? "").replace(/^\+52(\d{3})(\d{3})(\d{4})$/, "+52 $1 $2 $3");
  return {
    empresa: cfg.empresa ?? perfil?.empresa ?? "",
    logo: copiar("logo.svg"),
    isotipo: copiar("isotipo.svg"),
    ubicacion: cfg.ubicacion,
    contacto: { nombre: perfil?.nombre ?? "", telefono: tel, correo: cfg.correo ?? perfil?.correo ?? "", sitio: cfg.sitio },
    referencia: cfg.referencia,
  };
}

/** Chrome o Chromium instalado (se puede fijar con PROSPECTOR_CHROME). */
function chrome(): string {
  const candidatos = [
    process.env.PROSPECTOR_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter((x): x is string => !!x);
  const c = candidatos.find((x) => fs.existsSync(x));
  if (!c) throw new Error("Para exportar el brochure se necesita Google Chrome instalado.");
  return c;
}

/** Números que aparecen en un texto (2,800.00 → 2800). */
function numeros(texto: string): Set<number> {
  const out = new Set<number>();
  for (const m of texto.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) out.add(Math.round(Number(m[0].replace(/,/g, ""))));
  return out;
}

type Fila = { prospect_id: number; nombre: string; ficha_json: string; project_id: number; resumen: string; asunto: string; cuerpo: string };

export function brochureListo(prospectId: number): { pdf: boolean; paginas: number; actualizado: string | null } {
  const dir = carpetaBrochure(prospectId);
  const pdf = path.join(dir, "brochure.pdf");
  if (!fs.existsSync(pdf)) return { pdf: false, paginas: 0, actualizado: null };
  const paginas = Array.from({ length: PAGINAS }, (_, i) => fs.existsSync(path.join(dir, `pagina-${i + 1}.png`))).filter(Boolean).length;
  return { pdf: true, paginas, actualizado: fs.statSync(pdf).mtime.toISOString() };
}

export async function generarBrochure(replyId: number, indicacion?: string): Promise<{ prospectId: number }> {
  const r = get<Fila>(
    `SELECT p.id prospect_id, o.nombre, p.ficha_json, p.project_id, r.resumen, m.asunto, m.cuerpo
     FROM reply_events r JOIN messages m ON m.id = r.message_id JOIN prospects p ON p.id = m.prospect_id JOIN organizations o ON o.id = p.organization_id
     WHERE r.id = ?`, replyId);
  if (!r) throw new Error("Respuesta no encontrada.");
  const ficha = json<Record<string, unknown>>(r.ficha_json, {});
  const proyecto = get<{ nombre: string; propuesta_valor: string }>("SELECT nombre, propuesta_valor FROM projects WHERE id = ?", r.project_id)!;
  const facts = all<{ tipo: string; afirmacion: string }>("SELECT tipo, afirmacion FROM product_facts WHERE project_id = ?", r.project_id);
  const perfil = readProfile();

  const sitio = String(ficha.sitio_web ?? "");
  const evidencia = (Array.isArray(ficha.evidencia) ? ficha.evidencia : []).map((e) => String((e as { url?: string }).url ?? "")).filter(Boolean);
  const { paginas, fotos } = await leerSitio(sitio, evidencia);

  const doc = await redactarBrochure({
    prospecto: r.nombre,
    ficha,
    proyecto: { nombre: proyecto.nombre, propuesta_valor: proyecto.propuesta_valor, si: facts.filter((f) => f.tipo === "si_afirmar").map((f) => f.afirmacion), no: facts.filter((f) => f.tipo !== "si_afirmar" && f.tipo !== "pendiente").map((f) => f.afirmacion) },
    empresa: perfil?.empresa ?? "",
    respuesta: r.resumen,
    correo: r.cuerpo ? { asunto: r.asunto, cuerpo: r.cuerpo } : null,
    paginas,
    fotos,
    indicacion,
  });

  // Precios: solo los que de verdad aparecen en su sitio o en la ficha.
  const validos = numeros(paginas.map((p) => p.texto).join(" ") + " " + JSON.stringify(ficha.precios ?? ficha.precio ?? []));
  for (const it of doc.catalogo.items) if (it.precio != null && !validos.has(Math.round(it.precio))) it.precio = null;

  const dir = carpetaBrochure(r.prospect_id);
  const tmp = `${dir}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, "fotos"), { recursive: true });

  // Solo se bajan las fotos que se usan, reducidas a 1600 px.
  const usadas = new Set<number>([doc.portada.foto_fondo, ...doc.cambio.fotos.map((f) => f.foto), ...doc.catalogo.items.map((i) => i.foto)].filter((i) => i >= 0 && i < fotos.length));
  const locales: (string | null)[] = fotos.map(() => null);
  await Promise.all(
    [...usadas].map(async (i) => {
      const buf = await bajarFoto(fotos[i].url);
      if (!buf) return;
      try {
        const img = sharp(buf).rotate();
        const meta = await img.metadata();
        if ((meta.width ?? 0) < 300) return;
        await img.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(tmp, "fotos", `${i}.jpg`));
        locales[i] = `fotos/${i}.jpg`;
      } catch {
        /* no era una imagen válida */
      }
    }),
  );

  const marca = leerMarca(tmp);
  let dominio = "";
  try {
    dominio = new URL(sitio).hostname.replace(/^www\./, "");
  } catch {
    /* sin sitio */
  }
  const html = renderBrochure({ ...doc, _dominio: dominio }, locales, marca);
  fs.writeFileSync(path.join(tmp, "brochure.html"), html);
  fs.writeFileSync(path.join(tmp, "contenido.json"), JSON.stringify({ doc, fotos, generado: new Date().toISOString() }, null, 2));

  const bin = chrome();
  const url = `file://${path.join(tmp, "brochure.html")}`;
  const base = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--virtual-time-budget=6000"];
  for (let i = 1; i <= PAGINAS; i++) {
    await run(bin, [...base, "--force-device-scale-factor=1", "--window-size=1080,1350", `--screenshot=${path.join(tmp, `pagina-${i}.png`)}`, `${url}?p=${i}`], { timeout: 60_000 });
  }
  await run(bin, [...base, "--no-pdf-header-footer", `--print-to-pdf=${path.join(tmp, "brochure.pdf")}`, url], { timeout: 90_000 });
  if (!fs.existsSync(path.join(tmp, "brochure.pdf"))) throw new Error("Chrome no generó el PDF.");

  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  return { prospectId: r.prospect_id };
}

export type { BrochureDoc };
