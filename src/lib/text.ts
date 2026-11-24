/** Utilidades de texto: normalización para deduplicar, correos, dominios y estados de México. */

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export function emailsIn(s: string | null | undefined): string[] {
  return [...new Set((s ?? "").match(EMAIL_RE)?.map((e) => e.toLowerCase().replace(/\.$/, "")) ?? [])];
}
export function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}
const FREE = new Set(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.mx", "live.com", "icloud.com", "prodigy.net.mx"]);
export const isFreeMail = (domain: string) => FREE.has(domain);

/** Tipo de buzón (sección 4.1, contacts.tipo_buzon). */
export function mailboxType(email: string): "nominal" | "operativo" | "generico" {
  const local = email.split("@")[0].toLowerCase();
  if (/^(info|contacto|contact|hola|hello|admin|ventas|sales|informes)$/.test(local)) return "generico";
  if (/^(tienda|staff|eventos|events|comercial|capacitacion|alianzas|reservas|reserve|comunidad|direccion|prensa)/.test(local)) return "operativo";
  return "nominal";
}

export const ESTADOS_MX: Record<string, string[]> = {
  Aguascalientes: ["aguascalientes", "ags"],
  "Baja California": ["baja california", "ensenada", "tijuana", "mexicali", "rosarito", "tecate"],
  "Baja California Sur": ["baja california sur", "la paz", "los cabos", "cabo san lucas", "san jose del cabo", "todos santos"],
  Campeche: ["campeche"],
  Chiapas: ["chiapas", "tuxtla", "san cristobal"],
  Chihuahua: ["chihuahua", "cd juarez", "ciudad juarez"],
  "Ciudad de México": ["cdmx", "ciudad de mexico", "polanco", "condesa", "coyoacan", "xochimilco", "roma norte"],
  Coahuila: ["coahuila", "saltillo", "torreon", "parras", "laguna", "monclova"],
  Colima: ["colima", "manzanillo"],
  Durango: ["durango"],
  "Estado de México": ["estado de mexico", "edomex", "toluca", "interlomas", "naucalpan", "tepotzotlan", "la marquesa", "metepec"],
  Guanajuato: ["guanajuato", "leon", "san miguel de allende", "sma", "irapuato", "celaya"],
  Guerrero: ["guerrero", "acapulco", "taxco", "zihuatanejo"],
  Hidalgo: ["hidalgo", "pachuca", "tasquillo", "huasca"],
  Jalisco: ["jalisco", "guadalajara", "zapopan", "tlaquepaque", "puerto vallarta", "chapala", "ajijic", "gdl"],
  Michoacán: ["michoacan", "morelia"],
  Morelos: ["morelos", "cuernavaca"],
  Nayarit: ["nayarit", "tepic", "bucerias", "punta de mita", "sayulita", "nuevo vallarta"],
  "Nuevo León": ["nuevo leon", "monterrey", "san pedro garza", "mty"],
  Oaxaca: ["oaxaca", "huatulco"],
  Puebla: ["puebla", "cholula", "atlixco"],
  Querétaro: ["queretaro", "qro", "tequisquiapan", "bernal"],
  "Quintana Roo": ["quintana roo", "cancun", "tulum", "playa del carmen", "cozumel", "puerto morelos", "bacalar", "chetumal"],
  "San Luis Potosí": ["san luis potosi", "slp"],
  Sinaloa: ["sinaloa", "mazatlan", "culiacan", "los mochis"],
  Sonora: ["sonora", "hermosillo", "san carlos", "guaymas"],
  Tabasco: ["tabasco", "villahermosa"],
  Tamaulipas: ["tamaulipas", "tampico", "reynosa"],
  Tlaxcala: ["tlaxcala"],
  Veracruz: ["veracruz", "xalapa", "orizaba", "cordoba"],
  Yucatán: ["yucatan", "merida"],
  Zacatecas: ["zacatecas"],
};

/** Detecta el estado a partir de un lugar libre ("Puebla, Puebla (Hotel…)"). El más específico gana. */
export function detectEstado(lugar: string | null | undefined): string | null {
  if (!lugar) return null;
  const n = ` ${norm(lugar)} `;
  let best: { estado: string; len: number } | null = null;
  for (const [estado, keys] of Object.entries(ESTADOS_MX)) {
    for (const k of keys) {
      if (n.includes(` ${k} `) || n.includes(` ${k},`) || n.includes(` ${k}`)) {
        if (!best || k.length > best.len) best = { estado, len: k.length };
      }
    }
  }
  return best?.estado ?? null;
}

/** Búsqueda en listas: todas las palabras de `q` aparecen en alguno de los textos, sin importar acentos ni mayúsculas. */
export function coincide(q: string | null | undefined, ...textos: (string | null | undefined)[]): boolean {
  const palabras = norm(q ?? "").split(" ").filter(Boolean);
  if (!palabras.length) return true;
  const hay = norm(textos.filter(Boolean).join(" "));
  return palabras.every((p) => hay.includes(p));
}
