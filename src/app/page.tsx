import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { io } from "next/cache";
import { listProjects } from "@/lib/queries";
import { readProfile } from "@/lib/profile";
import { PageTitle, Empty, Section } from "@/components/ui";
import { ImportProjectForm } from "./import-form";

async function HomeContent() {
  await io();
  const profile = readProfile();
  if (!profile) redirect("/bienvenida");
  const projects = await listProjects();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle sub="Cada proyecto con lo que se ha contactado y quién respondió.">Hola, {profile.nombre.split(" ")[0]}</PageTitle>
        <Link href="/proyectos/nuevo" className="btn btn-primary">Nuevo proyecto</Link>
      </div>
      {projects.length === 0 ? (
        <div id="importar" className="space-y-4">
          <Empty>
            Todavía no hay proyectos.{" "}
            <Link href="/proyectos/nuevo" className="text-accent underline underline-offset-4">Crea uno con el formulario</Link>
            {" "}o importa el .md que te compartieron.
          </Empty>
          <ImportProjectForm />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/proyectos/${p.slug}`} className="card block p-6 transition hover:border-line-strong">
              <h2 className="font-serif text-2xl">{p.nombre}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-2">{p.idea}</p>
              <dl className="mt-6 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-ink-2">Contactados</dt>
                  <dd className="font-serif text-2xl">{p.contactados}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">Respuestas</dt>
                  <dd className="font-serif text-2xl">{p.respuestas}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">Interesados</dt>
                  <dd className="font-serif text-2xl text-ok">{p.interesados}</dd>
                </div>
              </dl>
              {p.borradores > 0 && <p className="mt-4 text-xs text-accent">{p.borradores} borrador(es) por revisar</p>}
            </Link>
          ))}
        </div>
      )}
      {projects.length > 0 && (
        <div id="importar" className="mt-12 scroll-mt-6">
          <Section title="Importar o actualizar un proyecto">
            <ImportProjectForm />
            <p className="mt-2 text-xs text-ink-3">Si el proyecto ya existe, se actualiza su configuración y se conservan prospectos, mensajes y respuestas.</p>
          </Section>
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <HomeContent />
    </Suspense>
  );
}
