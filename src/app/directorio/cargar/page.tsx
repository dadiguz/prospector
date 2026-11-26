import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { listarCargas } from "@/lib/carga";
import { PageTitle } from "@/components/ui";
import { fechaCarga } from "./fecha";
import { ListaCargas } from "./lista";
import { AgenteCarga } from "./agente";

async function Contenido() {
  await connection();
  const cargas = listarCargas().map((c) => ({ ...c, fecha: fechaCarga(c.creado_en) }));
  return <ListaCargas cargas={cargas} />;
}

export default function Cargas() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <PageTitle>Cargar datos</PageTitle>
        <Link href="/directorio/cargar/nueva" className="btn btn-primary mt-3"><Plus size={15} /> Nueva carga</Link>
      </div>
      <AgenteCarga />
      <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </>
  );
}
