// Genera el icono de Prospector: un anillo de 8 fulminantes (como los de pistola de juguete)
// con uno recién disparado: el chispazo sale de ese fulminante con rayos pseudoaleatorios.
// Semilla fija: siempre sale igual. Uso: node scripts/icono.mjs [semilla] > src/app/icon.svg
const seed = Number(process.argv[2] ?? 7);
let s = seed >>> 0;
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const f = (n) => n.toFixed(2);
const C = 34.5, R = 15, N = 8, DISPARADO = 7; // el de arriba a la izquierda
const CREMA = "#faf9f5", FONDO = "#1f1e1d", ROJO = "#c96442", DORADO = "#e8b04a";
const out = [];

// Anillo de plástico
out.push(`<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${ROJO}" stroke-width="5"/>`);
out.push(`<circle cx="${C}" cy="${C}" r="${R - 6.8}" fill="${FONDO}"/>`);

let disparo = null;
for (let i = 0; i < N; i++) {
  const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
  const x = C + Math.cos(a) * R, y = C + Math.sin(a) * R;
  if (i === DISPARADO) {
    // Fulminante reventado: queda el hueco quemado.
    out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5.3" fill="${ROJO}"/>`);
    out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${FONDO}"/>`);
    disparo = { x, y, a };
    continue;
  }
  out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5.3" fill="${ROJO}"/>`);
  out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3.7" fill="${DORADO}"/>`);
  out.push(`<circle cx="${f(x - 1)}" cy="${f(y - 1)}" r="1" fill="${CREMA}" opacity=".7"/>`);
}

// Chispazo: rayos hacia afuera del fulminante disparado, con largos, grosores y ángulos al azar.
const { x, y, a } = disparo;
const rayos = [];
for (let i = 0; i < 9; i++) {
  const d = a + (rand() - 0.5) * 1.9;
  const r0 = 6 + rand() * 1.5;
  const r1 = r0 + 4 + rand() * 9 * (1 - Math.abs(d - a) / 1.2);
  rayos.push(`<line x1="${f(x + Math.cos(d) * r0)}" y1="${f(y + Math.sin(d) * r0)}" x2="${f(x + Math.cos(d) * r1)}" y2="${f(y + Math.sin(d) * r1)}" stroke="${i % 3 ? DORADO : CREMA}" stroke-width="${f(1 + rand() * 1.2)}" stroke-linecap="round"/>`);
}
for (let i = 0; i < 4; i++) {
  const d = a + (rand() - 0.5) * 2.2, r = 13 + rand() * 6;
  rayos.push(`<circle cx="${f(x + Math.cos(d) * r)}" cy="${f(y + Math.sin(d) * r)}" r="${f(0.6 + rand() * 0.7)}" fill="${DORADO}"/>`);
}

console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="${FONDO}"/>
  ${rayos.join("\n  ")}
  ${out.join("\n  ")}
</svg>`);
