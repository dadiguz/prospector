/**
 * Importa el historial de un experimento de prospección hecho a mano.
 *   npm run importar -- <carpeta> [--proyecto clave] [--reset]
 * La carpeta debe tener historial.json y tandas/*.json. Primero importa el proyecto (.md) desde la app.
 * Esos archivos tienen datos personales: viven fuera del repositorio.
 */
import path from "node:path";
import { get } from "../src/lib/db";
import { importHistory } from "../src/lib/importer";
import { dbPath } from "../src/lib/paths";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const pi = args.indexOf("--proyecto");
const slug = pi >= 0 ? args[pi + 1] : undefined;
const dirArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--proyecto");
if (!dirArg) throw new Error("Uso: npm run importar -- <carpeta> [--proyecto clave] [--reset]");
const dir = path.resolve(dirArg);

const project = slug
  ? get<{ id: number }>("SELECT id FROM projects WHERE slug = ?", slug)
  : get<{ id: number }>("SELECT id FROM projects ORDER BY id LIMIT 1");
if (!project) throw new Error("No hay proyecto. Importa primero el .md del proyecto desde la app (Inicio → Importar proyecto).");
const s = importHistory(project.id, dir, { reset });

console.log(`Base: ${dbPath()}`);
console.log(`Archivos de tandas: ${s.archivos} · fichas leídas: ${s.fichas} · organizaciones: ${s.organizaciones}`);
console.log(`Correos enviados importados: ${s.enviados}`);
console.log("Respuestas:", s.respuestas);
if (s.sinFicha.length) console.log(`Sin ficha (marcados "sin atributos"): ${s.sinFicha.length}`);
if (s.noEncontrados.length) console.log(`No encontrados en los archivos:\n  ${s.noEncontrados.join("\n  ")}`);
