"use client";

import { useEffect } from "react";

/**
 * Marca la sección como vista al salir (o al cerrar la pestaña). Mientras estás en ella,
 * lo nuevo sigue resaltado; la siguiente vez ya no.
 */
export function SeenTracker({ projectId, seccion }: { projectId: number; seccion: "prospectos" | "borradores" | "respuestas" }) {
  useEffect(() => {
    let enviado = false;
    const marcar = () => {
      if (enviado) return;
      enviado = true;
      void fetch("/api/vistas", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, seccion }) });
    };
    window.addEventListener("pagehide", marcar);
    return () => {
      window.removeEventListener("pagehide", marcar);
      marcar();
    };
  }, [projectId, seccion]);
  return null;
}
