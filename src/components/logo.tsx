/** Semilla de Prospector: la misma figura que el icono de la app. */
export function SeedLogo({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="var(--accent)" />
      <g transform="translate(0 2.5) rotate(32 32 30)">
        <path d="M32 9C40.5 15 46.5 29 45 41.5C43.8 51 20.2 51 19 41.5C17.5 29 23.5 15 32 9Z" fill="#faf9f5" />
        <path d="M32 16.5C38 21.5 41.5 31 40.4 40.5C39.6 46.5 24.4 46.5 23.6 40.5C22.5 31 26 21.5 32 16.5Z" fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".35" />
      </g>
    </svg>
  );
}
