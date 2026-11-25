/** "25 nov 2026, 10:42" a partir de la fecha UTC que guarda SQLite. */
export function fechaCarga(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  return d.toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
