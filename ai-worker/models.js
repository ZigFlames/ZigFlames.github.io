// Model routing for the ZigFlames AI worker (talk, tighten and AI Boost).
// One switch: wrangler var AI_TIER = "free" (default) | "paid".
//   free -> OpenRouter ":free" models only ($0; account limit ~50 free requests/day with no credit purchased,
//           1000/day after a one-time $10 credit purchase; ~20 requests/min). If they all fail, callers return an
//           error and the page uses its free local fallback.
//   paid -> the paid chain (Grok / Gemini Flash Lite) first, then the free chain as a safety net (e.g. on 402).
// Optional override: FREE_MODELS = "id1,id2,..." (wrangler var) to swap free models without a code change.
export const FREE_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",   // fast (~1.5 s), JSON-reliable
  "nvidia/nemotron-3.5-lightning:free",  // fast backup
  "dots-studio/dots-3-note-preview:free",
  "google/gemma-4-31b-it:free",          // good, but often rate-limited upstream
];
// Picker ids for AI Studio chat (paid ones need OpenRouter credit; they answer 402 "needs credit" until then).
export const PAID_MODELS = {
  gemini: "google/gemini-2.5-flash-lite", // $0.10/M in, $0.40/M out
  gpt: "openai/gpt-6-luna",               // $0.10/M in, $0.50/M out (cheapest current GPT on OpenRouter, Oct 2026)
  grok: "x-ai/grok-4.20",                 // $1.25/M in, $2.50/M out, reasoning off
};
// Direct xAI (api.x.ai) for the "grok" pick when the worker secret XAI_API_KEY is set (Oct 26 2026).
// /v1/language-models lists grok-4.20-0309-non-reasoning as the cheapest fast non-reasoning chat model:
// $1.25/M in, $2.50/M out (grok-build-0.1 is $1/$2 but is a reasoning coding model). Override: wrangler var XAI_TEXT_MODEL.
export const XAI_TEXT_MODEL = "grok-4.20-0309-non-reasoning";
export function xaiModel(env) { return "xai:" + String((env && env.XAI_TEXT_MODEL) || XAI_TEXT_MODEL).replace(/^xai:/, ""); }
export function isXai(model) { return /^xai:/.test(model); }
export const PRICE = { "xai:grok-4.20-0309-non-reasoning": [1.25, 2.5], "xai:grok-build-0.1": [1, 2], "x-ai/grok-4.20": [1.25, 2.5], "google/gemini-2.5-flash-lite": [0.10, 0.40], "openai/gpt-6-luna": [0.10, 0.50], "openai/gpt-4o-mini": [0.15, 0.60] };
export function price(model) { return /:free$/.test(model) ? [0, 0] : PRICE[model] || [2, 6]; }
export function tier(env) { return String((env && env.AI_TIER) || "free").toLowerCase() === "paid" ? "paid" : "free"; }
export function freeList(env) {
  const o = String((env && env.FREE_MODELS) || "").split(",").map((s) => s.trim()).filter((s) => /:free$/.test(s));
  return (o.length ? o : FREE_MODELS).slice(0, 4);
}
// pick: "free" | "gemini" | "gpt" | "grok" | undefined. paidDefault: the paid chain for this action.
export function chain(env, pick, paidDefault) {
  // Grok -> xAI direct first, free chain behind it (an xAI error / no credit / daily cap falls back to free, never to paid OpenRouter)
  if (pick === "grok" && env && env.XAI_API_KEY) return { models: [xaiModel(env)].concat(freeList(env).slice(0, 3)), xai: true };
  if (pick && PAID_MODELS[pick]) return { models: [PAID_MODELS[pick]], explicit: pick };
  const free = freeList(env).slice(0, 3);
  if (pick === "free" || tier(env) === "free") return { models: free };
  return { models: (paidDefault || [PAID_MODELS.grok, PAID_MODELS.gemini]).filter(Boolean).concat(free) };
}
// Extra request fields per model: reasoning off where the model allows it (keeps free/Grok calls fast and JSON-clean).
export function extras(model) { if (isXai(model)) return {}; return /^x-ai\/|:free$/.test(model) ? { reasoning: { enabled: false } } : {}; }

// ---- one chat-completions call, routed: "xai:<id>" -> api.x.ai (XAI_API_KEY), anything else -> OpenRouter ----
// xAI text spend is counted in the same site-wide daily $ cap as media (KV SPEND "t:<day>", DAILY_MEDIA_USD_CAP); over the
// cap the xAI call is skipped (callers fall through to the free chain). Returns { ok, status, data, err, capped }.
function dayKey() { return new Date().toISOString().slice(0, 10); }
async function kvTot(env) { try { if (env.SPEND) return JSON.parse((await env.SPEND.get("t:" + dayKey())) || "null") || { usd: 0, n: 0 }; } catch (e) {} return { usd: 0, n: 0 }; }
export async function chatFetch(env, model, body, ms) {
  const x = isXai(model);
  if (x) {
    if (!env.XAI_API_KEY) return { ok: false, status: 0, err: "XAI_API_KEY not set" };
    const cap = parseFloat(env.DAILY_MEDIA_USD_CAP || "3"), tot = await kvTot(env);
    if (tot.usd >= cap) return { ok: false, status: 429, capped: true, err: "daily AI budget reached ($" + cap.toFixed(2) + "/day)" };
  }
  const b = Object.assign({}, body, { model: x ? model.slice(4) : model }, extras(model));
  if (x) delete b.plugins;
  let r;
  try {
    r = await fetch(x ? "https://api.x.ai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(ms || 30000),
      headers: x ? { Authorization: "Bearer " + env.XAI_API_KEY, "Content-Type": "application/json" }
        : { Authorization: "Bearer " + env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://zigflames.com", "X-Title": "ZigFlames Prompt Machine" },
      body: JSON.stringify(b) });
  } catch (e) { return { ok: false, status: 0, err: (x ? "xAI" : "upstream") + " unreachable" }; }
  if (!r.ok) {
    const t = (await r.text().catch(() => "")).slice(0, 300);
    let msg = t; try { const j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || j.message || j.code || t; } catch (e) {}
    console.log("chat", model, r.status, x ? String(msg).slice(0, 200) : "");
    return { ok: false, status: r.status, err: (x ? "xAI " : "upstream ") + r.status + (x && msg ? ": " + String(msg).slice(0, 160) : "") };
  }
  const data = await r.json().catch(() => null);
  if (x && data && data.usage) {
    const p = price(model), u = data.usage, usd = ((u.prompt_tokens || 0) * p[0] + (u.completion_tokens || 0) * p[1]) / 1e6;
    try { if (env.SPEND) { const tot = await kvTot(env); tot.usd = Math.round((tot.usd + usd) * 1e6) / 1e6; tot.n = (tot.n || 0) + 1; tot.xai_text = Math.round(((tot.xai_text || 0) + usd) * 1e6) / 1e6; await env.SPEND.put("t:" + dayKey(), JSON.stringify(tot), { expirationTtl: 60 * 60 * 48 }); } } catch (e) {}
  }
  return { ok: true, status: r.status, data };
}
export function modelLabel(model) { return isXai(model) ? model.slice(4) + " (xAI direct)" : model; }
