import { Suspense } from "react";
import { io } from "next/cache";
import { readProfile } from "@/lib/profile";
import { PageTitle } from "@/components/ui";
import { ProfileForm } from "../ajustes/profile-form";

async function BienvenidaContent() {
  await io();
  const profile = readProfile();
  return (
    <div className="max-w-xl">
      <PageTitle sub="Tus datos se guardan solo en esta computadora, en tu carpeta de usuario. De ahí salen el remitente, la firma y tu número en los mensajes.">
        Bienvenido a Prospector
      </PageTitle>
      <ProfileForm profile={profile} from="bienvenida" />
    </div>
  );
}

export default function Bienvenida() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Cargando…</p>}>
      <BienvenidaContent />
    </Suspense>
  );
}
