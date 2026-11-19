import crypto from "node:crypto";
import { z } from "zod";
import { getSecret, setSecret, deleteSecret } from "../secrets";

/**
 * OAuth de Google para la API de Gmail (sección 3.4, camino "API directa").
 * Cliente OAuth tipo "App de escritorio" del Google Cloud de cada usuario; redirección de loopback a esta app.
 * Credenciales y tokens viven en el llavero (secreto "gmail_oauth"), nunca en la base ni en archivos del repo.
 */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]; // leer hilos, borradores, enviar, etiquetas. No borra.

const Stored = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  refreshToken: z.string().optional(),
  email: z.string().optional(),
  conectadoEn: z.string().optional(),
});
export type GmailStored = z.infer<typeof Stored>;

export async function readGmail(): Promise<GmailStored | null> {
  const raw = await getSecret("gmail_oauth");
  if (!raw) return null;
  try {
    return Stored.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function writeGmail(v: GmailStored) {
  await setSecret("gmail_oauth", JSON.stringify(v));
}

export async function saveClient(clientId: string, clientSecret: string) {
  const prev = await readGmail();
  const sameClient = prev?.clientId === clientId;
  await writeGmail({ clientId, clientSecret, ...(sameClient ? { refreshToken: prev?.refreshToken, email: prev?.email, conectadoEn: prev?.conectadoEn } : {}) });
}

export async function gmailStatus(): Promise<{ configurado: boolean; conectado: boolean; email?: string }> {
  const g = await readGmail();
  return { configurado: Boolean(g?.clientId), conectado: Boolean(g?.refreshToken), email: g?.email };
}

/* PKCE + state en memoria (un solo proceso local; expiran a los 10 minutos). */
const g = globalThis as unknown as { __gmailPending?: Map<string, { verifier: string; redirectUri: string; at: number }>; __gmailToken?: { token: string; exp: number } };
const pending = (g.__gmailPending ??= new Map());

export async function authUrl(origin: string): Promise<string> {
  const cfg = await readGmail();
  if (!cfg) throw new Error("Primero guarda el Client ID y el Client secret en Ajustes.");
  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${origin}/api/gmail/callback`;
  for (const [k, v] of pending) if (Date.now() - v.at > 10 * 60_000) pending.delete(k);
  pending.set(state, { verifier, redirectUri, at: Date.now() });
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function handleCallback(state: string, code: string): Promise<string> {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || Date.now() - p.at > 10 * 60_000) throw new Error("La solicitud expiró o no es válida. Vuelve a conectar desde Ajustes.");
  const cfg = await readGmail();
  if (!cfg) throw new Error("Faltan las credenciales del cliente OAuth.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code",
      code_verifier: p.verifier,
    }),
  });
  const tok = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !tok.access_token) throw new Error(`Google rechazó la conexión: ${tok.error_description ?? tok.error ?? res.status}`);
  if (!tok.refresh_token) throw new Error("Google no entregó un token de actualización. Quita el acceso de Prospector en tu cuenta de Google y vuelve a conectar.");
  g.__gmailToken = { token: tok.access_token, exp: Date.now() + (tok.expires_in ?? 3600) * 1000 - 60_000 };
  const prof = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${tok.access_token}` } });
  const email = ((await prof.json()) as { emailAddress?: string }).emailAddress ?? "";
  await writeGmail({ ...cfg, refreshToken: tok.refresh_token, email, conectadoEn: new Date().toISOString() });
  return email;
}

export class GmailNotConnected extends Error {
  constructor() {
    super("Gmail no está conectado. Conéctalo en Ajustes.");
  }
}

export async function accessToken(): Promise<string> {
  if (g.__gmailToken && g.__gmailToken.exp > Date.now()) return g.__gmailToken.token;
  const cfg = await readGmail();
  if (!cfg?.refreshToken) throw new GmailNotConnected();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: "refresh_token" }),
  });
  const tok = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !tok.access_token) {
    if (tok.error === "invalid_grant") {
      await writeGmail({ clientId: cfg.clientId, clientSecret: cfg.clientSecret });
      throw new Error("Google revocó el acceso. Vuelve a conectar Gmail en Ajustes.");
    }
    throw new Error(`No se pudo renovar el acceso a Gmail (${tok.error ?? res.status}).`);
  }
  g.__gmailToken = { token: tok.access_token, exp: Date.now() + (tok.expires_in ?? 3600) * 1000 - 60_000 };
  return tok.access_token;
}

/** Revoca el acceso en Google y borra todo del llavero. */
export async function disconnect() {
  const cfg = await readGmail();
  if (cfg?.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cfg.refreshToken)}`, { method: "POST" }).catch(() => null);
  }
  g.__gmailToken = undefined;
  await deleteSecret("gmail_oauth");
}
