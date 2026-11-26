/** Países donde se puede buscar prospectos. Los estados excluidos de un proyecto solo aplican en México. */
export const PAISES = ["México", "Estados Unidos", "Canadá", "España", "Colombia", "Chile", "Argentina", "Perú", "Guatemala"] as const;
export const paisValido = (p: unknown): string => ((PAISES as readonly string[]).includes(String(p)) ? String(p) : "México");
export const esMexico = (pais: string) => pais === "México";
