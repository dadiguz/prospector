/**
 * Arreglos automáticos para las reglas del validador que se pueden corregir sin reescribir el correo.
 * Lo demás (largo, gancho, ficha de verdad…) lo propone el asistente para que lo revises.
 */
export const ARREGLOS_AUTO: Record<string, string> = {
  "Variables sin llenar": "Quitar frases con variables",
  Cierre: 'Cerrar con "Saludos cordiales,"',
  "Cifras aproximadas": 'Agregar "unos" a la cifra',
  Acentos: "Corregir acentos",
};
