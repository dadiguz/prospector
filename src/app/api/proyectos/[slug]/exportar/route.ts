import { type NextRequest } from "next/server";
import { get } from "@/lib/db";
import { readProject, toMarkdown } from "@/lib/project-md";

/** Descarga el proyecto como .md para compartirlo (sin prospectos ni datos personales). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/proyectos/[slug]/exportar">) {
  const { slug } = await ctx.params;
  const p = get<{ id: number }>("SELECT id FROM projects WHERE slug = ?", decodeURIComponent(slug));
  if (!p) return new Response("No encontrado", { status: 404 });
  return new Response(toMarkdown(readProject(p.id)), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug}.md"` },
  });
}
