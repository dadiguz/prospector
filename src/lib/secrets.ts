import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./paths";

/**
 * Secretos (API key de Claude, token de Gmail): sección 14.3.
 * 1) Llavero del sistema (Keychain / Credential Manager / Secret Service).
 * 2) Si no hay llavero: archivo cifrado en la carpeta de datos (AES-256-GCM).
 *    Esto evita que la llave quede en texto plano, pero no protege contra
 *    un programa que corra como el mismo usuario.
 * Nunca en .env, en el repo, en la base, en logs ni en el perfil.
 */
const SERVICE = "Prospector";
export type SecretName = "anthropic_api_key" | "gmail_oauth";

async function keyring() {
  try {
    const mod = await import("@napi-rs/keyring");
    return mod.Entry;
  } catch {
    return null;
  }
}

const vaultFile = () => path.join(dataDir(), "secretos.enc.json");
function vaultKey(): Buffer {
  const saltFile = path.join(dataDir(), ".sal");
  if (!fs.existsSync(saltFile)) fs.writeFileSync(saltFile, crypto.randomBytes(32), { mode: 0o600 });
  const salt = fs.readFileSync(saltFile);
  return crypto.scryptSync(`${os.userInfo().username}@${os.hostname()}`, salt, 32);
}
function readVault(): Record<string, string> {
  try {
    const { iv, tag, data } = JSON.parse(fs.readFileSync(vaultFile(), "utf8"));
    const d = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8"));
  } catch {
    return {};
  }
}
function writeVault(v: Record<string, string>) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(v), "utf8"), c.final()]);
  fs.writeFileSync(
    vaultFile(),
    JSON.stringify({ iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }),
    { mode: 0o600 },
  );
}

export async function getSecret(name: SecretName): Promise<string | null> {
  const Entry = await keyring();
  if (Entry) {
    try {
      const v = new Entry(SERVICE, name).getPassword();
      if (v) return v;
    } catch {
      /* sin llavero: usar archivo */
    }
  }
  return readVault()[name] ?? null;
}

export async function setSecret(name: SecretName, value: string): Promise<"llavero" | "archivo_cifrado"> {
  const Entry = await keyring();
  if (Entry) {
    try {
      new Entry(SERVICE, name).setPassword(value);
      const v = readVault();
      if (name in v) {
        delete v[name];
        writeVault(v);
      }
      return "llavero";
    } catch {
      /* cae al archivo cifrado */
    }
  }
  writeVault({ ...readVault(), [name]: value });
  return "archivo_cifrado";
}

export async function deleteSecret(name: SecretName) {
  const Entry = await keyring();
  if (Entry) {
    try {
      new Entry(SERVICE, name).deleteCredential();
    } catch {
      /* no existía */
    }
  }
  const v = readVault();
  if (name in v) {
    delete v[name];
    writeVault(v);
  }
}

/** sk-ant-…a1b2 */
export function mask(secret: string): string {
  return secret.length <= 12 ? "••••" : `${secret.slice(0, 7)}…${secret.slice(-4)}`;
}
