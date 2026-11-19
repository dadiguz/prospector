import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const title = Newsreader({ variable: "--font-title", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Prospector",
  description: "Prospección con evidencia, revisión humana y aprendizaje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${ui.variable} ${title.variable} antialiased`}>
      <body className="min-h-screen">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="font-serif text-2xl tracking-tight text-ink">
              Prospector
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link href="/" className="btn btn-quiet">Inicio</Link>
              <Link href="/ajustes" className="btn btn-quiet">Ajustes</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
