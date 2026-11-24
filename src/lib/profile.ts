import fs from "node:fs";
import { z } from "zod";
import { profilePath, settingsPath } from "./paths";

/** Perfil del usuario (sección 14.2). Vive en ~/.prospector/perfil.json, nunca en el repo. */
export const ProfileSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre completo"),
  correo: z.string().trim().email("Correo no válido"),
  telefono: z.string().trim().min(8, "Incluye lada, por ejemplo +52 …"),
  empresa: z.string().trim().min(1, "Escribe tu empresa"),
  puesto: z.string().trim().default(""),
});
export type Profile = z.infer<typeof ProfileSchema>;

export function readProfile(): Profile | null {
  try {
    const raw = JSON.parse(fs.readFileSync(profilePath(), "utf8"));
    const p = ProfileSchema.safeParse(raw);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

export function writeProfile(p: Profile) {
  fs.writeFileSync(profilePath(), JSON.stringify(p, null, 2) + "\n", { mode: 0o600 });
}

/** Ajustes no secretos: presupuesto, tope diario, modelos por nivel. */
export const SettingsSchema = z.object({
  topeDiario: z.number().int().min(1).max(200).default(30),
  presupuestoBusquedaUsd: z.number().min(0.1).max(100).default(3),
  busquedasWebPorCandidato: z.number().int().min(1).max(10).default(4),
  modoEconomico: z.boolean().default(false),
  busquedasSimultaneas: z.number().int().min(1).max(5).default(3),
  diasSeguimiento: z.number().int().min(1).max(60).default(7),
  modelos: z
    .object({
      alto: z.string().default("claude-opus-5-5"),
      medio: z.string().default("claude-sonnet-5-5"),
      bajo: z.string().default("claude-haiku-5-5"),
    })
    .default({ alto: "claude-opus-5-5", medio: "claude-sonnet-5-5", bajo: "claude-haiku-5-5" }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function readSettings(): Settings {
  try {
    return SettingsSchema.parse(JSON.parse(fs.readFileSync(settingsPath(), "utf8")));
  } catch {
    return SettingsSchema.parse({});
  }
}

export function writeSettings(s: Settings) {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + "\n", { mode: 0o600 });
}
