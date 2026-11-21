import { accessToken, readGmail, GmailNotConnected } from "./oauth";
import { buildMime, htmlToText } from "./mime";
import { domainOf, isFreeMail } from "../text";

/** Cliente mínimo de la API REST de Gmail (sin dependencias). */
const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Llamada a Gmail. Ante límite por minuto (429, o 403 "Quota exceeded"/"rateLimitExceeded") espera y reintenta. */
async function gmail<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  for (let intento = 0; ; intento++) {
    const token = await accessToken();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      method: init?.method ?? (init?.json ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, ...(init?.json ? { "content-type": "application/json" } : {}) },
      body: init?.json ? JSON.stringify(init.json) : init?.body,
    });
    if (res.ok) return (await res.json()) as T;
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const msg = err.error?.message ?? res.statusText;
    if (res.status === 401) throw new GmailNotConnected();
    const limite = res.status === 429 || (res.status === 403 && /quota exceeded|rate ?limit/i.test(msg));
    if (limite && intento < 5) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(ra > 0 ? ra * 1000 : Math.min(2 ** intento * 4000, 60_000));
      continue;
    }
    throw new GmailError(limite ? "Gmail pidió esperar (límite por minuto). Intenta de nuevo en un minuto." : `Gmail ${res.status}: ${msg}`, res.status);
  }
}

export async function account(): Promise<string> {
  const g = await readGmail();
  if (!g?.email) throw new GmailNotConnected();
  return g.email;
}

/** Firma HTML de la cuenta (la que Gmail pondría con "incluir firma"). */
export async function signature(): Promise<string> {
  const email = await account();
  const r = await gmail<{ sendAs?: { sendAsEmail: string; signature?: string; isPrimary?: boolean }[] }>("/settings/sendAs");
  const sa = r.sendAs?.find((s) => s.sendAsEmail.toLowerCase() === email.toLowerCase()) ?? r.sendAs?.find((s) => s.isPrimary);
  return sa?.signature ?? "";
}

/** Etiqueta por nombre; la crea si no existe (incluye la jerarquía "Prospección/Proyecto"). */
const labelCache = new Map<string, string>();
export async function ensureLabel(name: string): Promise<string> {
  if (labelCache.has(name)) return labelCache.get(name)!;
  const r = await gmail<{ labels: { id: string; name: string }[] }>("/labels");
  let found = r.labels.find((l) => l.name === name);
  if (!found) {
    const parent = name.includes("/") ? name.split("/")[0] : null;
    if (parent && !r.labels.some((l) => l.name === parent))
      await gmail("/labels", { json: { name: parent, labelListVisibility: "labelShow", messageListVisibility: "show" } });
    found = await gmail<{ id: string; name: string }>("/labels", { json: { name, labelListVisibility: "labelShow", messageListVisibility: "show" } });
  }
  labelCache.set(name, found.id);
  return found.id;
}

/** ¿Ya hay hilos en Gmail con este correo (o su dominio, si no es correo gratuito)? */
export async function priorThread(email: string): Promise<string | null> {
  const d = domainOf(email);
  const q = isFreeMail(d) ? `(to:${email} OR from:${email})` : `(to:${email} OR from:${email} OR to:@${d} OR from:@${d})`;
  const r = await gmail<{ messages?: { id: string; threadId: string }[] }>(`/messages?maxResults=1&q=${encodeURIComponent(`${q} -in:drafts -in:trash`)}`);
  return r.messages?.[0]?.threadId ?? null;
}

export async function createDraft(o: { to: string; subject: string; body: string; fromName: string; labelName?: string; threadId?: string; inReplyTo?: string; cc?: string }) {
  const from = await account();
  const raw = buildMime({ from, fromName: o.fromName, to: o.to, cc: o.cc, subject: o.subject, body: o.body, signatureHtml: await signature(), inReplyTo: o.inReplyTo, references: o.inReplyTo });
  const d = await gmail<{ id: string; message: { id: string; threadId: string } }>("/drafts", { json: { message: { raw, ...(o.threadId ? { threadId: o.threadId } : {}) } } });
  if (o.labelName) await gmail(`/messages/${d.message.id}/modify`, { json: { addLabelIds: [await ensureLabel(o.labelName)] } });
  return { draftId: d.id, messageId: d.message.id, threadId: d.message.threadId };
}

export async function updateDraft(draftId: string, o: { to: string; subject: string; body: string; fromName: string; threadId?: string }) {
  const from = await account();
  const raw = buildMime({ from, fromName: o.fromName, to: o.to, subject: o.subject, body: o.body, signatureHtml: await signature() });
  const d = await gmail<{ id: string; message: { id: string; threadId: string } }>(`/drafts/${draftId}`, {
    method: "PUT",
    json: { id: draftId, message: { raw, ...(o.threadId ? { threadId: o.threadId } : {}) } },
  });
  return { draftId: d.id, messageId: d.message.id, threadId: d.message.threadId };
}

export async function draftExists(draftId: string): Promise<boolean> {
  try {
    await gmail(`/drafts/${draftId}?format=minimal`);
    return true;
  } catch (e) {
    if (e instanceof GmailError && e.status === 404) return false;
    throw e;
  }
}

export async function sendDraft(draftId: string, labelName?: string) {
  const m = await gmail<{ id: string; threadId: string }>("/drafts/send", { json: { id: draftId } });
  if (labelName) await gmail(`/threads/${m.threadId}/modify`, { json: { addLabelIds: [await ensureLabel(labelName)] } });
  return { messageId: m.id, threadId: m.threadId };
}

/** Comprobación posterior al envío (sección 3.4, regla 4): sin redirecciones google.com/url y con firma. */
export async function verifySent(messageId: string, expectSignature: boolean) {
  const m = await gmail<{ raw: string }>(`/messages/${messageId}?format=raw`);
  const text = Buffer.from(m.raw, "base64url").toString("utf8");
  const decoded = text + decodeBase64Parts(text);
  const problemas: string[] = [];
  if (/google\.com\/url\?/i.test(decoded)) problemas.push("Gmail envolvió enlaces en google.com/url");
  if (expectSignature && !/gmail_signature/.test(decoded)) problemas.push("No se encontró la firma");
  return { ok: problemas.length === 0, problemas };
}
function decodeBase64Parts(mime: string): string {
  const out: string[] = [];
  for (const m of mime.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/gi)) out.push(Buffer.from(m[1].replace(/\s/g, ""), "base64").toString("utf8"));
  return out.join("\n");
}

export type ThreadMessage = {
  id: string;
  internalDate: string;
  snippet: string;
  labelIds?: string[];
  payload: { headers: { name: string; value: string }[]; mimeType: string; body?: { data?: string }; parts?: ThreadMessage["payload"][] };
};

export async function getThread(threadId: string) {
  return gmail<{ id: string; messages: ThreadMessage[] }>(`/threads/${threadId}?format=full`);
}

const META = ["From", "Subject", "Cc", "Auto-Submitted", "X-Autoreply", "X-Autorespond", "Precedence"].map((h) => `metadataHeaders=${h}`).join("&");
/** Hilo solo con cabeceras (ligero); el cuerpo se pide aparte y solo para respuestas nuevas. */
export async function getThreadMeta(threadId: string) {
  return gmail<{ id: string; messages: ThreadMessage[] }>(`/threads/${threadId}?format=metadata&${META}`);
}
export async function getMessage(id: string) {
  return gmail<ThreadMessage>(`/messages/${id}?format=full`);
}

export async function currentHistoryId(): Promise<string> {
  return (await gmail<{ historyId: string }>("/profile")).historyId;
}

/** Hilos con mensajes nuevos desde `startHistoryId`. null si el historial ya expiró (hay que revisar todo). */
export async function threadsChangedSince(startHistoryId: string): Promise<{ threads: Set<string>; historyId: string } | null> {
  const threads = new Set<string>();
  let pageToken: string | undefined;
  let last = startHistoryId;
  try {
    do {
      const r = await gmail<{ history?: { messagesAdded?: { message: { threadId: string } }[] }[]; historyId: string; nextPageToken?: string }>(
        `/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) threads.add(a.message.threadId);
      last = r.historyId;
      pageToken = r.nextPageToken;
    } while (pageToken);
  } catch (e) {
    if (e instanceof GmailError && e.status === 404) return null;
    throw e;
  }
  return { threads, historyId: last };
}

/**
 * Mapa destinatario → hilo de los enviados con la etiqueta del proyecto, con UNA sola búsqueda paginada
 * (las búsquedas cuestan mucha cuota; leer cabeceras de un mensaje cuesta poco).
 */
export async function sentThreadsByRecipient(labelName: string, after: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const q = `in:sent label:"${labelName}" after:${after.replace(/-/g, "/")}`;
  let pageToken: string | undefined;
  do {
    const r = await gmail<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }>(
      `/messages?maxResults=500&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    for (const m of r.messages ?? []) {
      const meta = await gmail<{ payload: { headers: { name: string; value: string }[] } }>(
        `/messages/${m.id}?format=metadata&metadataHeaders=To&metadataHeaders=Cc`,
      );
      for (const h of meta.payload.headers)
        for (const addr of h.value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
          const k = addr.toLowerCase();
          if (!map.has(k)) map.set(k, m.threadId);
        }
    }
    pageToken = r.nextPageToken;
  } while (pageToken);
  return map;
}

export async function findSentThread(to: string): Promise<string | null> {
  const r = await gmail<{ messages?: { id: string; threadId: string }[] }>(`/messages?maxResults=1&q=${encodeURIComponent(`in:sent to:${to}`)}`);
  return r.messages?.[0]?.threadId ?? null;
}

export const header = (m: ThreadMessage, name: string) => m.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

export function plainText(p: ThreadMessage["payload"]): string {
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const part of p.parts ?? []) {
    const t = plainText(part);
    if (t) return t;
  }
  if (p.mimeType === "text/html" && p.body?.data) {
    // Correos solo en HTML: se corta donde Gmail pone la cita y se conservan los saltos de línea.
    const html = Buffer.from(p.body.data, "base64url").toString("utf8").split(/<(?:div|blockquote)[^>]*class="[^"]*gmail_quote/i)[0];
    return htmlToText(html.replace(/<div[^>]*class="[^"]*gmail_signature[\s\S]*$/i, ""));
  }
  return "";
}

/** ¿El mensaje traía texto citado o firma que se ocultó al mostrarlo? (solo para mostrar una nota) */
export function hadQuote(p: ThreadMessage["payload"]): boolean {
  if (p.mimeType === "text/html" && p.body?.data) return /gmail_quote/i.test(Buffer.from(p.body.data, "base64url").toString("utf8"));
  return (p.parts ?? []).some(hadQuote);
}
