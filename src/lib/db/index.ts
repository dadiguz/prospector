import { DatabaseSync } from "node:sqlite";
import { dbPath } from "../paths";
import { migrations } from "./migrations";

type Db = DatabaseSync;
const g = globalThis as unknown as { __prospectorDb?: Db };

function migrate(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const applied = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as { id: number }[]).map((r) => r.id),
  );
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)").run(m.id, m.name);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

/** Conexión única por proceso. Las migraciones corren al abrir. */
export function db(): Db {
  if (!g.__prospectorDb) {
    const conn = new DatabaseSync(dbPath());
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrate(conn);
    g.__prospectorDb = conn;
  }
  return g.__prospectorDb;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function all<T>(sql: string, ...params: SqlParam[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}
export function get<T>(sql: string, ...params: SqlParam[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: SqlParam[]) {
  return db().prepare(sql).run(...params);
}
export type SqlParam = string | number | bigint | null | Uint8Array;

export function audit(quien: string, que: string, detalle = "") {
  run("INSERT INTO audit_log (quien, que, detalle) VALUES (?, ?, ?)", quien, que, detalle);
}

export const json = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
