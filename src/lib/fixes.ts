import { stripMissing } from "./drafts";
export { ARREGLOS_AUTO } from "./fix-labels";


const CIERRE_RE = /^(saludos|un saludo|atentamente|cordialmente|gracias|muchas gracias|quedo (atento|atenta|al pendiente)|abrazos?|best|regards)\b/i;

function arreglarCierre(cuerpo: string): string {
  const lineas = cuerpo.replace(/\s+$/, "").split("\n");
  // Quita al final: líneas vacías, un nombre suelto (firma escrita a mano) y fórmulas de despedida.
  for (let i = 0; i < 3 && lineas.length > 1; i++) {
    const ult = lineas[lineas.length - 1].trim();
    const esNombre = ult.length > 0 && ult.length <= 40 && ult.split(/\s+/).length <= 3 && !/[.,:;?!]$/.test(ult) && i === 0 && CIERRE_RE.test(lineas[lineas.length - 2]?.trim() ?? "");
    if (!ult || esNombre || CIERRE_RE.test(ult)) lineas.pop();
    else break;
  }
  return `${lineas.join("\n").replace(/\s+$/, "")}\n\nSaludos cordiales,`;
}

function arreglarCifras(cuerpo: string): string {
  return cuerpo.replace(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, (m, idx: number) => {
    const antes = cuerpo.slice(Math.max(0, idx - 25), idx).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return /(unos|unas|alrededor|aprox|cerca de|hasta|about|around|roughly)/.test(antes) ? m : `unos ${m}`;
  });
}

const ACENTOS: [RegExp, string][] = [
  [/\btambien\b/gi, "también"],
  [/\baqui\b/gi, "aquí"],
  [/\bmas informacion\b/gi, "más información"],
  [/\borganizacion\b/gi, "organización"],
];

function arreglarAcentos(cuerpo: string): string {
  let out = cuerpo;
  for (const [re, bien] of ACENTOS) out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() ? bien[0].toUpperCase() + bien.slice(1) : bien));
  return out;
}

/** Aplica los arreglos automáticos pedidos. Devuelve el correo nuevo (el validador se corre después). */
export function aplicarArreglos(asunto: string, cuerpo: string, reglas: string[], nombre?: string): { asunto: string; cuerpo: string } {
  let a = asunto;
  let c = cuerpo;
  if (reglas.includes("Variables sin llenar")) ({ asunto: a, cuerpo: c } = stripMissing(a, c, nombre));
  if (reglas.includes("Cifras aproximadas")) c = arreglarCifras(c);
  if (reglas.includes("Acentos")) c = arreglarAcentos(c);
  if (reglas.includes("Cierre")) c = arreglarCierre(c);
  return { asunto: a, cuerpo: c };
}
