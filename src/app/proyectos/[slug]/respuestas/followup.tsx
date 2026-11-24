"use client";

import { useState, useTransition } from "react";
import { setFollowupDays } from "@/app/actions";
import { toast } from "@/components/toaster";

/** A los cuántos días sin respuesta aparece alguien en "Dar seguimiento". */
export function FollowupDays({ dias }: { dias: number }) {
  const [valor, setValor] = useState(String(dias));
  const [pending, start] = useTransition();
  const n = Number(valor);
  const cambio = Number.isInteger(n) && n >= 1 && n <= 60 && n !== dias;
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!cambio) return;
        start(async () => {
          const r = await setFollowupDays(n);
          if (r?.error) toast(r.error, "error");
          else if (r?.message) toast(r.message);
        });
      }}
    >
      <span>Dar seguimiento a los</span>
      <input
        type="number"
        min={1}
        max={60}
        className="input text-center"
        style={{ width: "4.5rem", height: "2rem" }}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        aria-label="Días sin respuesta"
      />
      <span>días sin respuesta</span>
      {cambio && (
        <button className="btn btn-sm btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      )}
    </form>
  );
}
