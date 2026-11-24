// Genera el icono de Prospector: un anillo de 8 fulminantes (como los de pistola de juguete),
// con contorno negro y sin fondo. Uso: node scripts/icono.mjs > src/app/icon.svg
const f = (n) => n.toFixed(2);
const C = 32, R = 19, N = 8, CAP = 7, ANILLO = 6, BORDE = 2;
const NEGRO = "#1f1e1d", ROJO = "#c96442", DORADO = "#e8b04a", BRILLO = "#faf9f5";

const pos = Array.from({ length: N }, (_, i) => {
  const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
  return [C + Math.cos(a) * R, C + Math.sin(a) * R];
});
const anillo = (color, extra) => `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${color}" stroke-width="${f(ANILLO + extra * 2)}"/>`;
const caps = (color, r) => pos.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/>`).join("\n  ");

console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${anillo(NEGRO, BORDE)}
  ${caps(NEGRO, CAP + BORDE)}
  ${anillo(ROJO, 0)}
  ${caps(ROJO, CAP)}
  ${pos.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(CAP - 1.8)}" fill="${DORADO}"/>`).join("\n  ")}
  ${pos.map(([x, y]) => `<circle cx="${f(x - 1.6)}" cy="${f(y - 1.6)}" r="1.3" fill="${BRILLO}" opacity=".85"/>`).join("\n  ")}
</svg>`);
