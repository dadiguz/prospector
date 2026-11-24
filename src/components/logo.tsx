/** Icono de Prospector (anillo de fulminantes): el mismo archivo que el icono de la app, generado con scripts/icono.mjs. */
export function AppLogo({ size = 24 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
