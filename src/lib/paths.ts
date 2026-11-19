import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Carpeta de datos del usuario, fuera del repositorio.
 * Mac/Linux: ~/.prospector · Windows: %APPDATA%\Prospector
 * Se puede cambiar con PROSPECTOR_HOME (útil para pruebas).
 */
export function dataDir(): string {
  const override = process.env.PROSPECTOR_HOME;
  const dir = override
    ? override
    : process.platform === "win32"
      ? path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Prospector")
      : path.join(os.homedir(), ".prospector");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export const dbPath = () => path.join(dataDir(), "prospector.db");
export const profilePath = () => path.join(dataDir(), "perfil.json");
export const settingsPath = () => path.join(dataDir(), "ajustes.json");
