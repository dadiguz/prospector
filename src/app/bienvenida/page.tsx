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
      <PageTitle>
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
