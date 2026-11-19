/**
 * Gancho cuantitativo (sección 2.2, apéndice): fórmula del proyecto evaluada con el precio del prospecto.
 * Evaluador propio y cerrado: números, la variable P, + - * / y paréntesis. Nada de eval().
 */
export function evalFormula(formula: string, P: number): number {
  const expr = formula.includes("=") ? formula.split("=").slice(1).join("=") : formula;
  const tokens = expr.match(/\d+(?:\.\d+)?|[A-Za-z_]+|[()+\-*/]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function primary(): number {
    const t = next();
    if (t === undefined) throw new Error("Fórmula incompleta");
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("Falta ')'");
      return v;
    }
    if (t === "-") return -primary();
    if (/^\d/.test(t)) return Number(t);
    if (t === "P") return P;
    throw new Error(`Variable desconocida: ${t}`);
  }
  function product(): number {
    let v = primary();
    while (peek() === "*" || peek() === "/") v = next() === "*" ? v * primary() : v / primary();
    return v;
  }
  function sum(): number {
    let v = product();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + product() : v - product();
    return v;
  }
  const v = sum();
  if (i !== tokens.length) throw new Error("Sobran términos en la fórmula");
  return v;
}

/** Cifra aproximada: por cada `multiplicador` boletos, redondeada a `redondeo`. */
export function hookFigure(formula: string, price: number, multiplicador = 100, redondeo = 100): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const perUnit = evalFormula(formula, price);
  if (!Number.isFinite(perUnit) || perUnit <= 0) return null;
  return Math.round((perUnit * multiplicador) / redondeo) * redondeo;
}

export const mxn = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
