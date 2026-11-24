import { htmlToText } from "../gmail/mime";

/**
 * Lee el sitio público de un prospecto para armar su brochure: texto de unas pocas páginas
 * y fotos candidatas con el texto que las rodea. Solo http(s) y hosts públicos.
 */

export type Pagina = { url: string; texto: string };
export type Foto = { url: string; contexto: string };

const MAX_PAGINAS = 6;
const MAX_HTML = 2_000_000;
const AGENTE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

/** Evita leer la red local: localhost, IPs privadas y nombres sin punto. */
export function urlPublica(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
  }
  if (h.startsWith("[")) return null;
  return u;
}

async function traer(url: URL, ms = 12_000): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": AGENTE, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    // Una redirección no puede llevar a la red local.
    if (!urlPublica(res.url || url.toString())) return null;
    return res;
  } catch {
    return null;
  }
}

async function html(url: URL): Promise<string | null> {
  const res = await traer(url);
  if (!res || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HTML) return null;
  return new TextDecoder("utf-8").decode(buf);
}

const limpiar = (s: string) => s.replace(/\s+/g, " ").trim();

function fotosDe(src: string, base: URL): Foto[] {
  const out: Foto[] = [];
  const ver = (ruta: string, idx: number, extra = "") => {
    if (!ruta || ruta.startsWith("data:")) return;
    let u: URL;
    try {
      u = new URL(ruta.trim().replace(/^['"]|['"]$/g, ""), base);
    } catch {
      return;
    }
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u.pathname + u.search)) return;
    if (/(logo|icon|favicon|sprite|whats|facebook|instagram|youtube|tiktok|wallpaper|banner-?bg|pixel)/i.test(u.pathname)) return;
    const despues = htmlToText(src.slice(idx, idx + 700)).slice(0, 160);
    out.push({ url: u.toString(), contexto: limpiar(`${extra} ${decodeURIComponent(u.pathname.split("/").pop() ?? "")} | ${despues}`).slice(0, 220) });
  };
  for (const m of src.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? "";
    ver(m[1], (m.index ?? 0) + m[0].length, /bootstrap|template|image/i.test(alt) ? "" : alt);
  }
  for (const m of src.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) ver(m[1], (m.index ?? 0) + m[0].length);
  for (const m of src.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) ver(m[1], 0, "imagen principal del sitio");
  return out;
}

/** Enlaces internos de la portada (menú), para leer hospedaje, precios, etc. */
function enlacesInternos(src: string, base: URL): URL[] {
  const vistos = new Set<string>();
  const out: URL[] = [];
  for (const m of src.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      u.hash = "";
      if (u.hostname !== base.hostname || vistos.has(u.toString())) continue;
      if (/\.(pdf|jpe?g|png|zip|docx?)$/i.test(u.pathname)) continue;
      vistos.add(u.toString());
      out.push(u);
    } catch {
      /* enlace roto */
    }
  }
  return out;
}

export async function leerSitio(sitio: string, extras: string[] = []): Promise<{ paginas: Pagina[]; fotos: Foto[] }> {
  const inicio = urlPublica(sitio);
  if (!inicio) return { paginas: [], fotos: [] };
  const cola: URL[] = [inicio, ...extras.map(urlPublica).filter((u): u is URL => !!u && u.hostname.replace(/^www\./, "") === inicio.hostname.replace(/^www\./, ""))];
  const paginas: Pagina[] = [];
  const fotos: Foto[] = [];
  const leidas = new Set<string>();
  while (cola.length && paginas.length < MAX_PAGINAS) {
    const u = cola.shift()!;
    const clave = u.toString().replace(/\/$/, "");
    if (leidas.has(clave)) continue;
    leidas.add(clave);
    const src = await html(u);
    if (!src) continue;
    paginas.push({ url: u.toString(), texto: htmlToText(src).slice(0, 6000) });
    fotos.push(...fotosDe(src, u));
    // De la portada se agregan las secciones del menú que suelen tener precios y fotos.
    if (paginas.length === 1) {
      const utiles = enlacesInternos(src, u).filter((x) => /(hosped|caba|habita|hotel|precio|tarifa|paquete|boleto|evento|servicio|galer|atracc|reserv|glamp|villa|camping|campa)/i.test(x.pathname));
      cola.push(...utiles.slice(0, 5));
    }
  }
  // Sin repetidas, en orden de aparición.
  const unicas = new Map<string, Foto>();
  for (const f of fotos) if (!unicas.has(f.url)) unicas.set(f.url, f);
  return { paginas, fotos: [...unicas.values()].slice(0, 80) };
}

/** Descarga una foto elegida (máx. 15 MB, solo imágenes). */
export async function bajarFoto(url: string): Promise<Buffer | null> {
  const u = urlPublica(url);
  if (!u) return null;
  const res = await traer(u, 20_000);
  if (!res || !/^image\/(jpeg|png|webp)/i.test(res.headers.get("content-type") ?? "")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.byteLength > 15_000_000 ? null : buf;
}
