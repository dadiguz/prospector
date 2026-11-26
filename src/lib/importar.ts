import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { closeDb, get } from "./db";
import { dataDir, dbPath } from "./paths";
import { exportarTodo, NO_EXPORTAR } from "./exportar";

/**
 * Importa un .zip hecho con "Exportar todo": reemplaza la base y los archivos de la carpeta de datos.
 * Antes guarda lo actual en <datos>/respaldos/. No toca secretos (llave de Claude, Gmail).
 */
function leerZip(buf: Buffer): Map<string, Buffer> {
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("El archivo no es un .zip válido.");
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const out = new Map<string, Buffer>();
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("El .zip está dañado.");
    const metodo = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.subarray(p + 46, p + 46 + nLen).toString("utf8");
    p += 46 + nLen + eLen + cLen;
    if (nombre.endsWith("/")) continue;
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(ini, ini + comp);
    if (metodo === 0) out.set(nombre, Buffer.from(datos));
    else if (metodo === 8) out.set(nombre, zlib.inflateRawSync(datos));
    else throw new Error("El .zip usa una compresión no soportada.");
  }
  return out;
}

function validarBase(archivo: string) {
  let d: DatabaseSync | null = null;
  try {
    d = new DatabaseSync(archivo, { readOnly: true });
    const ok = d.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const t = d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prospects'").get();
    if (ok.integrity_check !== "ok" || !t) throw new Error();
  } catch {
    throw new Error("El archivo no es un respaldo de Prosp.");
  } finally {
    d?.close();
  }
}

export function importarTodo(zip: Buffer): { prospectos: number; respaldo: string } {
  const entradas = leerZip(zip);
  const base = entradas.get("prospector.db");
  if (!base || base.subarray(0, 16).toString("latin1") !== "SQLite format 3\0") {
    throw new Error("El archivo no es un respaldo de Prosp.");
  }
  const dir = path.resolve(dataDir());
  const nueva = path.join(dir, "prospector.db.importando");
  fs.writeFileSync(nueva, base, { mode: 0o600 });
  try {
    validarBase(nueva);
  } catch (e) {
    fs.rmSync(nueva, { force: true });
    throw e;
  }

  // Archivos: rutas dentro de la carpeta de datos, nunca secretos ni logs.
  const archivos: [string, Buffer][] = [];
  for (const [nombre, datos] of entradas) {
    if (!nombre.startsWith("archivos/")) continue;
    const rel = nombre.slice("archivos/".length);
    const destino = path.resolve(dir, rel);
    if (!rel || !destino.startsWith(dir + path.sep) || NO_EXPORTAR.has(rel.split("/")[0])) continue;
    archivos.push([destino, datos]);
  }

  // Copia de lo actual antes de reemplazar.
  const respaldos = path.join(dir, "respaldos");
  fs.mkdirSync(respaldos, { recursive: true });
  const respaldo = path.join(respaldos, `antes-de-importar-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`);
  fs.writeFileSync(respaldo, exportarTodo(), { mode: 0o600 });

  // Cambio de base: síncrono, sin otra petición en medio.
  closeDb();
  for (const f of [dbPath(), `${dbPath()}-wal`, `${dbPath()}-shm`]) fs.rmSync(f, { force: true });
  fs.renameSync(nueva, dbPath());

  // Las carpetas que trae el respaldo (marca, brochures, lotes) se reemplazan enteras.
  const carpetas = new Set(archivos.map(([d]) => path.relative(dir, d).split(path.sep)).filter((p) => p.length > 1).map((p) => p[0]));
  for (const c of carpetas) fs.rmSync(path.join(dir, c), { recursive: true, force: true });
  for (const [destino, datos] of archivos) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, datos);
  }

  const n = get<{ c: number }>("SELECT COUNT(*) c FROM prospects")?.c ?? 0;
  return { prospectos: n, respaldo };
}
