import { get, run, tx } from "./db";
import { domainOf, isFreeMail } from "./text";

export type Clasificacion = "interesado" | "acuse" | "no_ahora" | "no" | "rebote" | "auto_respuesta" | "vacia" | "baja" | "otro";

const ESTADO: Partial<Record<Clasificacion, string>> = {
  interesado: "interesado",
  acuse: "interesado",
  no_ahora: "retomar",
  no: "cerrado",
  rebote: "rebote",
  baja: "cerrado",
};

/**
 * Registra una respuesta y aplica sus efectos (sección 6.6):
 * estado del pipeline, contacto rebotado, lista de supresión (rebote y baja: global; "no": del proyecto).
 */
export function recordReplyEvent(r: {
  messageId: number;
  clasificacion: Clasificacion;
  resumen: string;
  fecha?: string;
  confianza?: number;
  quien?: string | null;
  enCopia?: string | null;
  pide?: "info" | "llamada" | "reunion" | "nada" | null;
  gmailMessageId?: string | null;
  revisado?: boolean;
}) {
  const m = get<{ prospect_id: number; contact_id: number | null; para: string | null; project_id: number }>(
    "SELECT m.prospect_id, m.contact_id, m.para, p.project_id FROM messages m JOIN prospects p ON p.id = m.prospect_id WHERE m.id = ?",
    r.messageId,
  );
  if (!m) throw new Error("Mensaje no encontrado.");
  tx(() => {
    run(
      `INSERT INTO reply_events (message_id, fecha, clasificacion, confianza, resumen, quien_respondio, en_copia, pide, revisado_por_humano, gmail_message_id)
       VALUES (?, COALESCE(?, date('now','localtime')), ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.messageId, r.fecha ?? null, r.clasificacion, r.confianza ?? 1, r.resumen, r.quien ?? null, r.enCopia ?? null, r.pide ?? null,
      r.revisado === false ? 0 : 1, r.gmailMessageId ?? null,
    );
    const estado = ESTADO[r.clasificacion];
    if (estado) run("UPDATE prospects SET estado = ?, actualizado_en = datetime('now') WHERE id = ?", estado, m.prospect_id);
    run("UPDATE followups SET estado = 'cancelado' WHERE prospect_id = ? AND estado = 'pendiente' AND tipo <> 'retomar'", m.prospect_id);
    if (r.clasificacion === "rebote") {
      if (m.contact_id) run("UPDATE contacts SET estado = 'reboto' WHERE id = ?", m.contact_id);
      else if (m.para) run("UPDATE contacts SET estado = 'reboto' WHERE lower(valor) = lower(?)", m.para);
      if (m.para) run("INSERT OR IGNORE INTO suppression_list (valor, tipo, alcance, motivo) VALUES (?, 'correo', 'global', 'rebotó')", m.para.toLowerCase());
    }
    if (r.clasificacion === "baja" && m.para)
      run("INSERT OR IGNORE INTO suppression_list (valor, tipo, alcance, motivo) VALUES (?, 'correo', 'global', 'pidió baja')", m.para.toLowerCase());
    if (r.clasificacion === "no" && m.para) {
      const d = domainOf(m.para);
      run(
        "INSERT OR IGNORE INTO suppression_list (valor, tipo, alcance, project_id, motivo) VALUES (?, ?, 'proyecto', ?, 'no interesado')",
        isFreeMail(d) ? m.para.toLowerCase() : d, isFreeMail(d) ? "correo" : "dominio", m.project_id,
      );
    }
  });
}
