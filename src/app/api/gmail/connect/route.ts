import { NextResponse, type NextRequest } from "next/server";
import { authUrl } from "@/lib/gmail/oauth";

/** Inicia el consentimiento de Google. La redirección vuelve a esta misma app (loopback). */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.redirect(await authUrl(req.nextUrl.origin));
  } catch (e) {
    return NextResponse.redirect(new URL(`/ajustes?gmail=${encodeURIComponent((e as Error).message)}`, req.nextUrl.origin));
  }
}
