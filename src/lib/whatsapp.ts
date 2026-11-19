/**
 * WhatsApp: solo enlaces wa.me con texto (sección 3.4). El usuario lo envía desde su teléfono.
 * No se automatiza WhatsApp personal.
 */
export function normalizeMxPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  return null;
}

/** Primer teléfono de 10 dígitos que aparezca en un texto libre ("771 775 3355 (su sitio)"). */
export function firstPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(?:\+?52\s?)?(?:\d[\s.-]?){10}/);
  return m ? normalizeMxPhone(m[0]) : null;
}

export function waLink(phone52: string, text: string): string {
  return `https://wa.me/${phone52}?text=${encodeURIComponent(text)}`;
}
