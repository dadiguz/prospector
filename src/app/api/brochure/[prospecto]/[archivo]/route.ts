import fs from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { get } from "@/lib/db";
import { carpetaBrochure } from "@/lib/brochure";

/** Sirve el PDF o una página del brochure de un prospecto. Solo esos nombres de archivo. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/brochure/[prospecto]/[archivo]">) {
  const { prospecto, archivo } = await ctx.params;
  const id = Number(prospecto);
  if (!Number.isInteger(id) || !/^(brochure\.pdf|pagina-[1-6]\.png)$/.test(archivo)) return new Response("No encontrado", { status: 404 });
  const ruta = path.join(carpetaBrochure(id), archivo);
  if (!fs.existsSync(ruta)) return new Response("No encontrado", { status: 404 });
  const org = get<{ nombre: string }>("SELECT o.nombre FROM prospects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ?", id);
  const base = (org?.nombre ?? "brochure").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const pdf = archivo.endsWith(".pdf");
  const nombre = pdf ? `${base}.pdf` : `${base}-${archivo}`;
  const descargar = req.nextUrl.searchParams.has("descargar");
  return new Response(fs.readFileSync(ruta), {
    headers: {
      "content-type": pdf ? "application/pdf" : "image/png",
      "content-disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
      "cache-control": "no-store",
    },
  });
}
