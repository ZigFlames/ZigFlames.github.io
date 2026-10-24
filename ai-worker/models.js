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
export const PRICE = { "x-ai/grok-4.20": [1.25, 2.5], "google/gemini-2.5-flash-lite": [0.10, 0.40], "openai/gpt-6-luna": [0.10, 0.50], "openai/gpt-4o-mini": [0.15, 0.60] };
export function price(model) { return /:free$/.test(model) ? [0, 0] : PRICE[model] || [2, 6]; }
export function tier(env) { return String((env && env.AI_TIER) || "free").toLowerCase() === "paid" ? "paid" : "free"; }
export function freeList(env) {
  const o = String((env && env.FREE_MODELS) || "").split(",").map((s) => s.trim()).filter((s) => /:free$/.test(s));
  return (o.length ? o : FREE_MODELS).slice(0, 4);
}
// pick: "free" | "gemini" | "gpt" | "grok" | undefined. paidDefault: the paid chain for this action.
export function chain(env, pick, paidDefault) {
  if (pick && PAID_MODELS[pick]) return { models: [PAID_MODELS[pick]], explicit: pick };
  const free = freeList(env).slice(0, 3);
  if (pick === "free" || tier(env) === "free") return { models: free };
  return { models: (paidDefault || [PAID_MODELS.grok, PAID_MODELS.gemini]).filter(Boolean).concat(free) };
}
// Extra request fields per model: reasoning off where the model allows it (keeps free/Grok calls fast and JSON-clean).
export function extras(model) { return /^x-ai\/|:free$/.test(model) ? { reasoning: { enabled: false } } : {}; }
