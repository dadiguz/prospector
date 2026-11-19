"use client";

import { saveProfile } from "@/app/actions";
import { StatefulForm, FormMessage } from "@/components/client";
import type { Profile } from "@/lib/profile";

const FIELDS: { name: keyof Profile; label: string; type?: string; placeholder: string }[] = [
  { name: "nombre", label: "Nombre completo", placeholder: "Nombre y apellidos" },
  { name: "correo", label: "Correo de trabajo", type: "email", placeholder: "tu@empresa.com" },
  { name: "telefono", label: "Teléfono (WhatsApp)", type: "tel", placeholder: "+52 …" },
  { name: "empresa", label: "Empresa", placeholder: "Nombre de tu empresa" },
  { name: "puesto", label: "Puesto", placeholder: "Ventas" },
];

export function ProfileForm({ profile, from }: { profile: Profile | null; from?: string }) {
  return (
    <StatefulForm action={saveProfile} className="space-y-4">
      {(state, pending) => (
        <>
          {from && <input type="hidden" name="from" value={from} />}
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="label" htmlFor={f.name}>{f.label}</label>
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                className="input"
                placeholder={f.placeholder}
                defaultValue={state?.fields?.[f.name] ?? profile?.[f.name] ?? ""}
                required={f.name !== "puesto"}
              />
            </div>
          ))}
          <div className="flex items-center gap-4 pt-2">
            <button className={from ? "btn btn-primary" : "btn"} disabled={pending}>{pending ? "Guardando…" : from ? "Continuar" : "Guardar perfil"}</button>
            <FormMessage state={state} />
          </div>
        </>
      )}
    </StatefulForm>
  );
}
