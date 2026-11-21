import { connection } from "next/server";
import { all, get, json } from "@/lib/db";
import { gmailStatus } from "@/lib/gmail/oauth";
import { getThread, hadQuote, header, plainText } from "@/lib/gmail/api";
import { stripQuoted } from "@/lib/gmail/sync";
import { tagsByProspect } from "@/lib/tags";

export type HiloMensaje = { de: string; para: string; cc: string | null; fecha: string; asunto: string; cuerpo: string; citado: boolean; nuestro: boolean };

/** Detalle de una respuesta: hilo completo, quién es el prospecto y la sugerencia de respuesta. */
export async function GET(_req: Request, ctx: RouteContext<"/api/respuestas/[id]">) {
  await connection();
  const id = Number((await ctx.params).id);
  const r = get<{
    id: number; clasificacion: string; fecha: string | null; resumen: string; quien_respondio: string | null; en_copia: string | null;
    pide: string | null; sugerencia: string | null; message_id: number;
  }>("SELECT id, clasificacion, fecha, resumen, quien_respondio, en_copia, pide, sugerencia, message_id FROM reply_events WHERE id = ?", id);
  if (!r) return Response.json({ error: "No encontrada" }, { status: 404 });

  const m = get<{ asunto: string; cuerpo: string; para: string | null; enviado_en: string | null; tanda: string | null; gmail_thread_id: string | null; prospect_id: number }>(
    "SELECT asunto, cuerpo, para, enviado_en, tanda, gmail_thread_id, prospect_id FROM messages WHERE id = ?", r.message_id)!;
  const p = get<{ id: number; nombre: string; lista: string; estado: string; score: number | null; ficha_json: string; organization_id: number; ciudad: string | null; estado_mx: string | null }>(
    `SELECT p.id, o.nombre, p.lista, p.estado, p.score, p.ficha_json, p.organization_id, o.ciudad, o.estado estado_mx
     FROM prospects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ?`, m.prospect_id)!;
  const f = json<Record<string, unknown>>(p.ficha_json, {});
  const txt = (v: unknown) => (v == null ? null : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? null : String(v));
  const contactos = all<{ canal: string; valor: string; estado: string; nota: string | null }>(
    "SELECT canal, valor, estado, nota FROM contacts WHERE organization_id = ? ORDER BY canal, id", p.organization_id);

  // Hilo: de Gmail si está conectado y conocemos el hilo; si no, lo que guardamos.
  let hilo: HiloMensaje[] = [];
  let fuenteHilo: "gmail" | "local" = "local";
  let avisoHilo: string | null = null;
  const g = await gmailStatus();
  if (m.gmail_thread_id && g.conectado) {
    try {
      const t = await getThread(m.gmail_thread_id);
      const yo = (g.email ?? "").toLowerCase();
      hilo = t.messages.map((x) => {
        const de = header(x, "From");
        const completo = plainText(x.payload).trim();
        const limpio = stripQuoted(completo);
        return {
          de,
          para: header(x, "To"),
          cc: header(x, "Cc") || null,
          fecha: new Date(Number(x.internalDate)).toISOString(),
          asunto: header(x, "Subject"),
          cuerpo: limpio || completo,
          citado: limpio.length < completo.length || hadQuote(x.payload),
          nuestro: de.toLowerCase().includes(yo) || Boolean(x.labelIds?.includes("SENT")),
        };
      });
      fuenteHilo = "gmail";
    } catch (e) {
      avisoHilo = `No se pudo leer el hilo de Gmail: ${(e as Error).message}`;
    }
  } else if (!g.conectado) avisoHilo = "Conecta Gmail en Ajustes para ver el hilo completo.";
  else avisoHilo = "Este envío no tiene hilo de Gmail asociado (historial importado sin sincronizar).";

  if (!hilo.length) {
    hilo = [
      { de: "Nosotros", para: m.para ?? "", cc: null, fecha: m.enviado_en ?? "", asunto: m.asunto, cuerpo: m.cuerpo || "(El texto de este correo no se guardó en el historial.)", citado: false, nuestro: true },
      { de: r.quien_respondio ?? "Prospecto", para: "", cc: r.en_copia, fecha: r.fecha ?? "", asunto: `Re: ${m.asunto}`, cuerpo: r.resumen, citado: false, nuestro: false },
    ];
  }

  return Response.json(
    {
      respuesta: r,
      envio: { asunto: m.asunto, para: m.para, enviado_en: m.enviado_en, tanda: m.tanda },
      prospecto: {
        id: p.id, nombre: p.nombre, lista: p.lista, estado: p.estado, score: p.score,
        lugar: txt(f.lugar) ?? ([p.ciudad, p.estado_mx].filter(Boolean).join(", ") || null),
        tipo: txt(f.tipo), comoCobra: txt(f.vende ?? f.cobra ?? f.como_cobra_hoy), siguiente: txt(f.siguiente),
        observacion: txt(f.vimos ?? f.observacion), pegas: txt(f.pegas), tamano: txt(f.asistentes ?? f.tamano),
        contactos, etiquetas: tagsByProspect([p.id]).get(p.id) ?? [],
      },
      hilo,
      fuenteHilo,
      avisoHilo,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
