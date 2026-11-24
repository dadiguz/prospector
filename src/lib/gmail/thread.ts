import { getThread, header, plainText } from "./api";
import { stripQuoted } from "./sync";

export type MensajeHilo = { de: string; nuestro: boolean; fecha: string; texto: string };

/** Lee un hilo de Gmail como conversación: quién escribió, cuándo y qué (sin el texto citado). */
export async function leerHilo(threadId: string, miCorreo: string): Promise<MensajeHilo[]> {
  const t = await getThread(threadId);
  return t.messages.map((m) => {
    const de = header(m, "From") ?? "";
    return {
      de,
      nuestro: de.toLowerCase().includes(miCorreo.toLowerCase()),
      fecha: new Date(Number(m.internalDate)).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      texto: stripQuoted(plainText(m.payload)).trim().slice(0, 2500) || m.snippet,
    };
  });
}
