import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { RunningPanel } from "@/components/running-panel";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/toaster";
import { sidebarProjects } from "@/lib/queries";

const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const title = Newsreader({ variable: "--font-title", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Prospector",
  description: "Prospección con evidencia, revisión humana y aprendizaje.",
};

async function SidebarData() {
  return <Sidebar projects={await sidebarProjects()} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${ui.variable} ${title.variable} antialiased`}>
      <body className="min-h-screen">
        <Suspense fallback={<aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-[#f5f3ec] lg:block" />}>
          <SidebarData />
        </Suspense>
        <div className="lg:pl-60">
          <main className="app-main mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 lg:pt-10">{children}</main>
        </div>
        <RunningPanel />
        <Toaster />
      </body>
    </html>
  );
}
