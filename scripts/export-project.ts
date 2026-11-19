/**
 * Exporta un proyecto a Markdown para compartirlo.
 *   npm run exportar -- <clave-del-proyecto> [archivo.md]
 */
import fs from "node:fs";
import { get } from "../src/lib/db";
import { readProject, toMarkdown } from "../src/lib/project-md";

const [slug, out] = process.argv.slice(2);
if (!slug) throw new Error("Uso: npm run exportar -- <clave-del-proyecto> [archivo.md]");
const p = get<{ id: number }>("SELECT id FROM projects WHERE slug = ?", slug);
if (!p) throw new Error(`No existe el proyecto "${slug}".`);
const md = toMarkdown(readProject(p.id));
if (out) {
  fs.writeFileSync(out, md);
  console.log(`Exportado a ${out}`);
} else process.stdout.write(md);
