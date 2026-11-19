import { PLANTILLA_PROYECTO, toMarkdown } from "@/lib/project-md";

export async function GET() {
  return new Response(toMarkdown(PLANTILLA_PROYECTO), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": 'attachment; filename="plantilla-proyecto.md"' },
  });
}
