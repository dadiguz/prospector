"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/actions";
import { toast } from "./toaster";

/** Botón que llama una acción del servidor con argumentos y muestra el resultado. */
export function ActionButton({
  action,
  children,
  className = "btn",
  confirm,
  pendingLabel = "…",
}: {
  action: () => Promise<FormState | void>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  pendingLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = (await action()) ?? null;
            // Lo que sale bien va a un aviso; los errores además quedan junto al botón.
            if (r?.message) toast(r.message);
            if (r?.error) toast(r.error, "error");
            setMsg(r?.error ? r : null);
          });
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      {msg?.error && <span className="max-w-md text-xs text-bad">{msg.error}</span>}
      {msg?.message && <span className="text-xs text-ok">{msg.message}</span>}
    </span>
  );
}

/** Formulario con estado (errores y avisos en línea). */
export function StatefulForm({
  action,
  children,
  className,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: (state: FormState, pending: boolean) => ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children(state, pending)}
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-bad">{state.error}</p>;
  if (state.message) return <p className="text-sm text-ok">{state.message}</p>;
  return null;
}

export function CopyButton({ text, label = "Copiar", className = "btn" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copiado" : label}
    </button>
  );
}

/** Refresca la vista mientras hay una búsqueda activa. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
