import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { getSecret } from "../secrets";
import { readSettings } from "../profile";
import { run } from "../db";

/**
 * Capa LLMProvider (sección 3.2). Vía principal: API key del usuario (decisión 1, sección 13).
 * Los niveles son abstractos; Ajustes los mapea a modelos concretos (sección 8.2).
 */
export type Tier = "alto" | "medio" | "bajo";

export class NoApiKeyError extends Error {
  constructor() {
    super("Falta la API key de Claude. Agrégala en Ajustes.");
  }
}
/** Límite de uso: el job pasa a "en pausa" con hora estimada de reanudación (sección 3.6). */
export class PausedError extends Error {
  constructor(
    message: string,
    public resumeAfter: Date,
  ) {
    super(message);
  }
}

/** USD por millón de tokens [entrada, salida]. Referencia, no factura: confirma en la página de precios. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const WEB_SEARCH_USD = 0.01; // por búsqueda, estimado

export function modelFor(tier: Tier): string {
  const s = readSettings();
  if (s.modoEconomico) {
    if (tier === "alto") return s.modelos.medio;
    if (tier === "medio") return s.modelos.bajo;
  }
  return s.modelos[tier];
}

async function client(): Promise<Anthropic> {
  const apiKey = await getSecret("anthropic_api_key");
  if (!apiKey) throw new NoApiKeyError();
  return new Anthropic({ apiKey, maxRetries: 2 });
}

/** Motivos de error de la lectura web, en palabras del usuario. */
const FETCH_ERRORS: Record<string, string> = {
  url_not_in_prior_context: "la dirección no salió de una búsqueda ni de un enlace (el modelo la adivinó)",
  url_not_accessible: "el sitio no respondió o bloquea la lectura automática",
  url_not_allowed: "sitio bloqueado en este proyecto",
  unsupported_content_type: "tipo de archivo no soportado",
  too_many_requests: "el sitio pidió esperar",
  max_uses_exceeded: "se alcanzó el tope de lecturas para este prospecto",
  content_too_large: "la página es demasiado grande",
  url_too_long: "la dirección es demasiado larga",
  unavailable: "el servicio de lectura no está disponible",
  invalid_tool_input: "dirección mal formada",
};

const SEARCH_ERRORS: Record<string, string> = {
  invalid_tool_input: "consulta mal formada; el modelo la reintenta",
  query_too_long: "consulta demasiado larga",
  max_uses_exceeded: "se alcanzó el tope de búsquedas para este prospecto",
  too_many_requests: "demasiadas búsquedas seguidas",
  unavailable: "el servicio de búsqueda no está disponible",
};

/** Llamada mínima para validar la llave: listar un modelo no consume tokens. */
export async function validateApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0 }).models.list({ limit: 1 });
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "La llave no es válida." };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: "La llave no tiene permisos." };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: "No hay conexión con la API." };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Error ${e.status}: ${e.message}` };
    return { ok: false, error: String(e) };
  }
}

type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export type Consumo = { costoUsd: number; tokensEntrada: number; tokensSalida: number; busquedasWeb: number };

function logUsage(paso: string, model: string, usage: UsageLike, ms: number, jobId?: number): Consumo {
  const [pin, pout] = PRICES[model] ?? [0, 0];
  const busquedas = usage.server_tool_use?.web_search_requests ?? 0;
  const costo =
    (usage.input_tokens * pin + (usage.cache_read_input_tokens ?? 0) * pin * 0.1 + usage.output_tokens * pout) / 1e6 +
    busquedas * WEB_SEARCH_USD;
  run(
    `INSERT INTO usage_log (job_id, paso, proveedor, modelo, tokens_entrada, tokens_salida, tokens_cache, busquedas_web, costo_usd, duracion_ms)
     VALUES (?, ?, 'anthropic_api', ?, ?, ?, ?, ?, ?, ?)`,
    jobId ?? null,
    paso,
    model,
    usage.input_tokens,
    usage.output_tokens,
    usage.cache_read_input_tokens ?? 0,
    busquedas,
    costo,
    ms,
  );
  return { costoUsd: costo, tokensEntrada: usage.input_tokens, tokensSalida: usage.output_tokens, busquedasWeb: busquedas };
}

function toPaused(e: unknown): never {
  if (e instanceof Anthropic.RateLimitError) {
    const ra = Number(e.headers?.get?.("retry-after") ?? 60);
    throw new PausedError("Límite de uso de la API. Se reanuda solo.", new Date(Date.now() + Math.max(ra, 30) * 1000));
  }
  if (e instanceof Anthropic.APIError && e.status === 529) {
    throw new PausedError("La API está saturada. Se reanuda en unos minutos.", new Date(Date.now() + 5 * 60_000));
  }
  throw e;
}

/**
 * Investigación con búsqueda y lectura web del lado del servidor.
 * Devuelve texto libre con URLs; la normalización a ficha la hace `extract` con un modelo barato.
 * Los modelos de nivel alto/medio usan el respaldo del servidor ante rechazos ("fallbacks").
 */
export async function research(opts: {
  tier: Tier;
  system: string;
  prompt: string;
  maxSearches: number;
  paso: string;
  jobId?: number;
  blockedDomains?: string[];
  /** Avisos en vivo: qué busca o qué página lee. */
  onActivity?: (texto: string) => void;
}): Promise<{ text: string; urls: string[]; consumo: Consumo }> {
  const c = await client();
  const model = modelFor(opts.tier);
  const blocked = (opts.blockedDomains ?? []).slice(0, 64);
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches, ...(blocked.length ? { blocked_domains: blocked } : {}) },
    // max_content_tokens: cada página se lee hasta ~8,000 tokens; las páginas enormes eran la mayor parte del costo.
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.maxSearches * 2, max_content_tokens: 8000, ...(blocked.length ? { blocked_domains: blocked } : {}) },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const total: Consumo = { costoUsd: 0, tokensEntrada: 0, tokensSalida: 0, busquedasWeb: 0 };
  const supportsFallback = !model.includes("haiku");
  let final: Anthropic.Beta.BetaMessage | null = null;
  const urls = new Set<string>();
  let text = "";

  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    let res: Anthropic.Beta.BetaMessage;
    try {
      const stream = c.beta.messages.stream({
          model,
          max_tokens: 32000,
          system: opts.system,
          output_config: { effort: "medium" },
          tools,
          messages,
          ...(supportsFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
        });
      if (opts.onActivity) {
        const avisar = opts.onActivity;
        stream.on("contentBlock", (b) => {
          if (b.type === "server_tool_use") {
            const input = (b.input ?? {}) as { query?: string; url?: string };
            if (b.name === "web_search" && input.query) avisar(`Buscando “${input.query}”`);
            else if (b.name === "web_fetch" && input.url) avisar(`Leyendo ${input.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80)}`);
          } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
            avisar(`${b.content.length} resultados encontrados`);
          } else if (b.type === "web_fetch_tool_result") {
            const c = b.content as { type?: string; error_code?: string; url?: string };
            if (c?.type?.includes("error")) avisar(`No se pudo leer: ${FETCH_ERRORS[c.error_code ?? ""] ?? c.error_code ?? "error desconocido"}`);
          } else if (b.type === "web_search_tool_result" && !Array.isArray(b.content)) {
            const c = b.content as { error_code?: string };
            avisar(`La búsqueda falló: ${SEARCH_ERRORS[c.error_code ?? ""] ?? c.error_code ?? "error desconocido"}`);
          }
        });
      }
      res = await stream.finalMessage();
    } catch (e) {
      toPaused(e);
    }
    const u = logUsage(opts.paso, res.model ?? model, res.usage as UsageLike, Date.now() - t0, opts.jobId);
    total.costoUsd += u.costoUsd;
    total.tokensEntrada += u.tokensEntrada;
    total.tokensSalida += u.tokensSalida;
    total.busquedasWeb += u.busquedasWeb;
    final = res;
    // El texto y las fuentes de cada turno se juntan: con pausas, la lista puede quedar en un turno anterior.
    for (const block of res.content) {
      if (block.type === "text") {
        text += block.text;
        for (const cit of block.citations ?? []) if ("url" in cit && cit.url) urls.add(cit.url);
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") urls.add(r.url);
      }
    }
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  if (!final) throw new Error("Sin respuesta del modelo");
  if (final.stop_reason === "refusal") throw new Error("El modelo no quiso completar esta investigación.");
  if (!text.trim()) throw new Error(`El modelo no devolvió texto (terminó por ${final.stop_reason}).`);
  return { text, urls: [...urls], consumo: total };
}

/** Extracción con salida estructurada validada por Zod. */
export async function extract<S extends z.ZodType>(opts: {
  tier: Tier;
  system: string;
  prompt: string;
  schema: S;
  paso: string;
  jobId?: number;
  maxTokens?: number;
}): Promise<{ data: z.infer<S>; consumo: Consumo }> {
  const c = await client();
  const model = modelFor(opts.tier);
  const t0 = Date.now();
  let res;
  try {
    res = await c.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.prompt }],
    });
  } catch (e) {
    toPaused(e);
  }
  const consumo = logUsage(opts.paso, model, res.usage as UsageLike, Date.now() - t0, opts.jobId);
  if (res.stop_reason === "refusal") throw new Error("El modelo rechazó la extracción.");
  if (res.parsed_output == null) throw new Error("La respuesta no cumplió el formato esperado.");
  return { data: res.parsed_output as z.infer<S>, consumo };
}

/** Texto libre (borradores de respuesta, análisis). */
export async function write(opts: { tier: Tier; system: string; prompt: string; paso: string; jobId?: number }) {
  const c = await client();
  const model = modelFor(opts.tier);
  const t0 = Date.now();
  let res;
  try {
    res = await c.messages
      .stream({
        model,
        max_tokens: 16000,
        system: opts.system,
        output_config: { effort: opts.tier === "alto" ? "high" : "medium" },
        messages: [{ role: "user", content: opts.prompt }],
      })
      .finalMessage();
  } catch (e) {
    toPaused(e);
  }
  logUsage(opts.paso, model, res.usage as UsageLike, Date.now() - t0, opts.jobId);
  if (res.stop_reason === "refusal") throw new Error("El modelo no quiso redactar esto.");
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
