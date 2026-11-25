import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { carpetaLote } from "@/lib/lotes";

export async function GET(_: Request, ctx: RouteContext<"/api/lotes/[id]/[archivo]">) {
  await connection();
  const { id, archivo } = await ctx.params;
  if (!/^\d+$/.test(id) || !/^img-\d+\.jpg$/.test(archivo)) return new Response("No encontrado", { status: 404 });
  const f = path.join(carpetaLote(Number(id)), archivo);
  if (!fs.existsSync(f)) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(f)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
