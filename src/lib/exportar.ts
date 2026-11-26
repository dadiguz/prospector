import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { all, db } from "./db";
import { dataDir } from "./paths";

/**
 * "Exportar todo": un .zip con
 * - tablas/<tabla>.csv: cada tabla de la base, para abrir en Excel o Sheets;
 * - prospector.db: copia completa de la base, para restaurar Prosp en otra máquina;
 * - los archivos de la carpeta de datos (ajustes, perfil, marca, brochures).
 * Nunca incluye secretos (llavero, archivo cifrado, sal) ni los logs.
 */
const NO_EXPORTAR = new Set(["secretos.enc.json", ".sal", "logs", "prospector.db", "prospector.db-wal", "prospector.db-shm"]);

type Entrada = { nombre: string; datos: Buffer };

function celda(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Uint8Array ? Buffer.from(v).toString("base64") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tablaCsv(tabla: string): Buffer {
  const cols = all<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, tabla).map((c) => c.name);
  const filas = db().prepare(`SELECT * FROM "${tabla.replace(/"/g, '""')}"`).all() as Record<string, unknown>[];
  const lineas = [cols.map(celda).join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))];
  // BOM para que Excel lea los acentos como UTF-8.
  return Buffer.from("﻿" + lineas.join("\r\n") + "\r\n", "utf8");
}

/** Copia consistente de la base aunque la app esté escribiendo (incluye lo que sigue en el WAL). */
function copiaBase(): Buffer {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "prosp-export-")), "prospector.db");
  try {
    db().prepare("VACUUM INTO ?").run(tmp);
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

function archivos(dir: string, base = ""): Entrada[] {
  const out: Entrada[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!base && NO_EXPORTAR.has(e.name)) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(abs, rel));
    else if (e.isFile()) out.push({ nombre: `archivos/${rel}`, datos: fs.readFileSync(abs) });
  }
  return out;
}

/** Zip mínimo (deflate), suficiente para Finder, Windows y Excel. */
function zip(entradas: Entrada[]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  for (const { nombre, datos } of entradas) {
    const n = Buffer.from(nombre, "utf8");
    const comp = zlib.deflateRawSync(datos);
    const crc = zlib.crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    partes.push(local, n, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(fecha, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(datos.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + comp.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, dir, fin]);
}

export function exportarTodo(): Buffer {
  const tablas = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations' ORDER BY name",
  ).map((t) => t.name);
  return zip([
    ...tablas.map((t) => ({ nombre: `tablas/${t}.csv`, datos: tablaCsv(t) })),
    { nombre: "prospector.db", datos: copiaBase() },
    ...archivos(dataDir()),
  ]);
}
