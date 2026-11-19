import { NextResponse, type NextRequest } from "next/server";
import { handleCallback } from "@/lib/gmail/oauth";
import { audit } from "@/lib/db";
import { readProfile } from "@/lib/profile";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const back = (msg: string) => NextResponse.redirect(new URL(`/ajustes?gmail=${encodeURIComponent(msg)}`, req.nextUrl.origin));
  if (p.get("error")) return back(p.get("error") === "access_denied" ? "Cancelaste la conexión con Google." : `Google devolvió: ${p.get("error")}`);
  const state = p.get("state");
  const code = p.get("code");
  if (!state || !code) return back("Respuesta incompleta de Google.");
  try {
    const email = await handleCallback(state, code);
    audit(email, "gmail_conectado");
    const perfil = readProfile()?.correo?.toLowerCase();
    return back(perfil && perfil !== email.toLowerCase() ? `Conectado como ${email}, que no es el correo de tu perfil (${perfil}).` : `Conectado como ${email}.`);
  } catch (e) {
    return back((e as Error).message);
  }
}
