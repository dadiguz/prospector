/**
 * Validador de estilo del primer correo (sección 6.3). Marca lo que falla; no corrige en silencio.
 * "error" bloquea el envío; "aviso" se muestra pero deja mandar.
 */
export type Issue = { nivel: "error" | "aviso"; regla: string; detalle: string };

export type ValidatorContext = {
  noAfirmar: { afirmacion: string; terminos: string[] }[];
  noMencionar: { afirmacion: string; terminos: string[] }[];
  suposiciones?: string[];
  idioma?: "es" | "en";
  esRespuesta?: boolean;
};

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/i;
const DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|mx|io|org|net|art|app|co|info|lat)(?:\.[a-z]{2})?\b/i;
const EXACT_MONEY_RE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g;

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function validateEmail(asunto: string, cuerpo: string, ctx: ValidatorContext): Issue[] {
  const issues: Issue[] = [];
  const body = cuerpo.trim();
  const plain = stripAccents(body);

  // Enlaces y dominios: el conector los convierte en redirecciones de google.com/url.
  const url = body.match(URL_RE);
  if (url) issues.push({ nivel: "error", regla: "Sin enlaces en el cuerpo", detalle: `Quita "${url[0]}". Los enlaces van solo en la firma de Gmail.` });
  else {
    const dom = body.match(DOMAIN_RE);
    if (dom && !dom[0].includes("@"))
      issues.push({ nivel: "error", regla: "Sin dominios escritos", detalle: `"${dom[0]}" se convierte en enlace. Nómbralo como texto, sin dominio.` });
  }

  // Largo: 5 a 8 líneas de contenido (sin saludo ni cierre).
  if (!ctx.esRespuesta) {
    const lines = body.split(/\n/).filter((l) => l.trim().length > 0);
    const words = body.split(/\s+/).length;
    const approxLines = Math.round(words / 14);
    if (approxLines > 9 || lines.length > 9)
      issues.push({ nivel: "aviso", regla: "5 a 8 líneas", detalle: `Mide unas ${approxLines} líneas. Recorta lo que pueda esperar a la llamada.` });
  }

  // Funciones que no se pueden afirmar (ficha de verdad).
  for (const f of ctx.noAfirmar) {
    const hit = f.terminos.find((t) => plain.includes(stripAccents(t)));
    if (hit) issues.push({ nivel: "error", regla: "Ficha de verdad: NO afirmar", detalle: `Menciona "${hit}" (${f.afirmacion}).` });
  }
  for (const f of ctx.noMencionar) {
    const hit = f.terminos.find((t) => plain.includes(stripAccents(t)));
    if (hit) issues.push({ nivel: "error", regla: "No mencionar", detalle: `Menciona "${hit}". ${f.afirmacion}.` });
  }

  // Cifras: aproximadas ("unos $X").
  for (const m of body.matchAll(EXACT_MONEY_RE)) {
    const before = plain.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0);
    if (!/(unos|unas|alrededor|aprox|cerca de|hasta|about|around|roughly)/.test(before))
      issues.push({ nivel: "aviso", regla: "Cifras aproximadas", detalle: `"${m[0]}" suena exacto. Usa "unos ${m[0]}".` });
  }

  // Un solo gancho: más de una cifra de dinero sugiere dos ganchos.
  const money = [...body.matchAll(EXACT_MONEY_RE)].length;
  if (!ctx.esRespuesta && money > 2) issues.push({ nivel: "aviso", regla: "Un solo gancho", detalle: `Hay ${money} cifras. Deja un gancho; lo demás para la llamada.` });

  // Suposiciones presentadas como hechos.
  for (const s of ctx.suposiciones ?? []) {
    const key = stripAccents(s).slice(0, 40);
    if (key.length > 12 && plain.includes(key))
      issues.push({ nivel: "error", regla: "Suposición como hecho", detalle: `El correo afirma algo marcado SUPOSICIÓN: "${s.slice(0, 60)}…".` });
  }
  if (/suposici[oó]n/i.test(body)) issues.push({ nivel: "error", regla: "Suposición como hecho", detalle: "El cuerpo contiene la palabra SUPOSICIÓN." });

  // Cierre y firma: "Saludos cordiales," sin nombre (lo pone la firma de Gmail).
  if (!ctx.esRespuesta && ctx.idioma !== "en" && !/saludos cordiales,?\s*$/i.test(body))
    issues.push({ nivel: "aviso", regla: "Cierre", detalle: 'Termina con "Saludos cordiales," sin escribir el nombre.' });

  // Variables sin llenar.
  const left = body.match(/\{[a-z_]+\}/g);
  if (left) issues.push({ nivel: "error", regla: "Variables sin llenar", detalle: left.join(", ") });

  if (!asunto.trim() && !ctx.esRespuesta) issues.push({ nivel: "error", regla: "Asunto", detalle: "Falta el asunto." });
  if (/\[|\]/.test(asunto)) issues.push({ nivel: "error", regla: "Asunto", detalle: "El asunto tiene corchetes de plantilla." });

  // Ortografía mínima: palabras frecuentes sin acento.
  if (ctx.idioma !== "en" && /\b(tambien|aqui|mas informacion|organizacion)\b/.test(body.toLowerCase()))
    issues.push({ nivel: "aviso", regla: "Acentos", detalle: "Hay palabras sin acento (también, aquí, información, organización)." });

  return issues;
}

export const blocks = (issues: Issue[]) => issues.some((i) => i.nivel === "error");
