// Genera el icono de Prospector: una chispa hecha de rayos con largos y grosores pseudoaleatorios.
// Semilla fija: siempre sale el mismo icono. Uso: node scripts/icono-chispa.mjs [semilla] > src/app/icon.svg
const seed = Number(process.argv[2] ?? 7);
let s = seed >>> 0;
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); // LCG
const C = 32;
const f = (n) => n.toFixed(2);
const out = [];

// Rayos finos alrededor: ángulo con algo de ruido, largo y grosor al azar; más largos cerca de los ejes.
const N = 18;
for (let i = 0; i < N; i++) {
  const a = (i / N) * Math.PI * 2 + (rand() - 0.5) * 0.12;
  const eje = Math.pow(Math.abs(Math.cos(2 * a)), 6); // 1 en los 4 ejes, 0 en las diagonales
  const r0 = 9 + rand() * 3;
  const r1 = Math.min(25, r0 + 3 + rand() * 6 + eje * 9);
  const w = 0.8 + rand() * 0.9;
  const op = 0.3 + rand() * 0.4;
  out.push(`<line x1="${f(C + Math.cos(a) * r0)}" y1="${f(C + Math.sin(a) * r0)}" x2="${f(C + Math.cos(a) * r1)}" y2="${f(C + Math.sin(a) * r1)}" stroke="#faf9f5" stroke-width="${f(w)}" stroke-linecap="round" opacity="${f(op)}"/>`);
}
// Chispas sueltas
for (let i = 0; i < 4; i++) {
  const a = rand() * Math.PI * 2;
  const r = 17 + rand() * 6;
  out.push(`<circle cx="${f(C + Math.cos(a) * r)}" cy="${f(C + Math.sin(a) * r)}" r="${f(0.7 + rand() * 0.9)}" fill="#faf9f5" opacity="${f(0.5 + rand() * 0.5)}"/>`);
}
// Estrella central de 4 puntas (lo que se lee en 16 px)
const L = 19, k = 3.6;
const star = `M${C} ${C - L}C${C + 1.2} ${C - k} ${C + k} ${C - 1.2} ${C + L} ${C}C${C + k} ${C + 1.2} ${C + 1.2} ${C + k} ${C} ${C + L}C${C - 1.2} ${C + k} ${C - k} ${C + 1.2} ${C - L} ${C}C${C - k} ${C - 1.2} ${C - 1.2} ${C - k} ${C} ${C - L}Z`;

console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#c96442"/>
  ${out.join("\n  ")}
  <path d="${star}" fill="#faf9f5"/>
</svg>`);
