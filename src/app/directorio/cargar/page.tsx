import { Suspense } from "react";
import { connection } from "next/server";
import { all } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { Cargar, type ProyectoOpcion } from "./cargar";

async function Contenido() {
  await connection();
  const proyectos = all<ProyectoOpcion>(
    `SELECT p.slug, p.nombre, json_extract(p.config_json, '$.icono') icono, json_extract(p.config_json, '$.color') color
     FROM projects p WHERE p.estado <> 'archivado' ORDER BY p.id`,
  );
  return <Cargar proyectos={JSON.parse(JSON.stringify(proyectos))} />;
}

export default function CargarCorreos() {
  return (
    <>
      <PageTitle>Cargar datos</PageTitle>
      <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </>
  );
}
