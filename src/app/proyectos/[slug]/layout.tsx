import { Suspense } from "react";
import { ProjectNav } from "./nav";

export default function ProjectLayout({ children }: LayoutProps<"/proyectos/[slug]">) {
  return (
    <>
      <Suspense fallback={<div className="-mt-2 mb-8 h-[37px] border-b border-line" />}>
        <ProjectNav />
      </Suspense>
      {children}
    </>
  );
}
