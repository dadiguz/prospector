import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { leerCarga } from "@/lib/carga";
import { Cargar } from "../cargar";
import { fechaCarga } from "../fecha";
import { proyectosOpcion } from "../proyectos";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const c = leerCarga(Number(id));
  if (!c) notFound();
  const { id: cid, titulo, archivos, creado_en, ...estado } = c;
  return (
    <Cargar
      key={cid}
      proyectos={proyectosOpcion()}
      carga={{ id: cid, titulo, archivos, fecha: fechaCarga(creado_en) }}
      estadoInicial={JSON.parse(JSON.stringify(estado))}
    />
  );
}

export default function Carga({ params }: PageProps<"/directorio/cargar/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
