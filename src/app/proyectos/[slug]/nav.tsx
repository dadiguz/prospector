"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Proyecto" },
  { href: "/prospectos", label: "Prospectos" },
  { href: "/borradores", label: "Borradores" },
  { href: "/respuestas", label: "Respuestas" },
];

export function ProjectNav() {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const base = `/proyectos/${slug}`;
  return (
    <nav className="-mt-2 mb-8 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => {
        const href = base + t.href;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.label}
            href={href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
