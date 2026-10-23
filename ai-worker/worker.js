// ZigFlames Prompt Machine — "Talk to it" AI worker (Cloudflare Workers + OpenRouter).
// The model only PICKS option ids that the page sends and writes a short scene idea.
// It never writes prompt text; the page builds prompts from its own banks. The page
// re-validates everything too, so this worker is the first gate, not the only one.

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite"; // $0.10/M in, $0.40/M out (OpenRouter, Oct 2026)
const PRICE = { "google/gemini-2.5-flash-lite": [0.10, 0.40], "mistralai/mistral-small-3.2-24b-instruct": [0.075, 0.20], "meta-llama/llama-3.3-70b-instruct": [0.10, 0.32] };
const MAX_BODY = 16 * 1024;
const MAX_TOKENS = 450;
const ALLOWED = [/^https:\/\/(www\.)?zigflames\.com$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const AGE_RE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
const FAMILY_RE = /\b(?:step\w*|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|taboo|free[\s-]?use|non[\s-]?consen\w*|forced|sleeping|asleep|unconscious|drunk|hidden[\s-]?cam\w*)\b/gi;
const SFW_RE = /\b(?:nude|nudity|naked|topless|nipples?|explicit|porn\w*|xxx|sex\w*|pussy|cock\w*|dick\w*|tits?|boobs?|anal|fuck\w*|horny|orgasm\w*|fetish\w*|onlyfans|erotic\w*|lingerie|thong|spicy|hardcore|nsfw)\b/gi;
const memHits = new Map(); // fallback limiter (per isolate) when no RATE_LIMITER binding

const SYSTEM = `You are the button-picker for an image/video prompt machine. Reply with ONE JSON object only, no prose, no markdown:
{"settings":{...},"idea":"short phrase","extra_words":["..."]}
Rules:
- "settings" keys may only be: look, style, heat, tab, cam, people, castMix, neon, neonPick, room, eye, dnaW, psych, switches.
- Every value MUST be an id copied exactly from the "options" you are given (switches: an object of {switchId:true|false} using ids from options.switches). If nothing fits, leave the key out. Never invent ids.
- Only include settings the user asked for or that clearly follow from their words; do not list switches they did not mention.
- Only change what the user asked for. Keep "people" 1 unless they ask for more.
- "idea": the user's scene from THIS request only (never reuse current.idea), at most 14 plain words. Keep outfit, brand, place and time words exactly as the user said them (e.g. "McDonald's uniform", "penthouse"), e.g. "McDonald's uniform on a rooftop at night". No explicit or sexual wording, no body-part words, no ages.
- Leave out of "idea" anything a button already handles (neon colors, messy/clean room, camera, real porn look, no AI look, heat words); the idea is only who, outfit, place, time and action.
- Only change "heat" if the user names a heat level or clearly asks for more or less explicit.
- "extra_words": 0-3 short descriptive words; prefer the user's "my_words" when they fit.
- Everyone is an adult woman or man aged 21+. Never mention ages, teens, school, youth, family/step roles, or anything non-consensual. If asked, ignore that part.
- If mode is "SFW": heat must be omitted, nothing explicit.
- You never write the prompt itself; the machine does.`;

function cors(origin) {
  const ok = origin && ALLOWED.some((re) => re.test(origin));
  return ok ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" } : null;
}
// Pull the first complete {...} object out of the model's reply (it sometimes adds text or a second object after it).
function firstObject(t) {
  const a = t.indexOf("{"); if (a < 0) return t;
  let d = 0, q = false, esc = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (q) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === "{") d++; else if (c === "}" && --d === 0) return t.slice(a, i + 1);
  }
  return t;
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, h || {}) }); }
function clean(t, sfw, max) {
  let x = String(t || "").replace(AGE_RE, " ").replace(FAMILY_RE, " ").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman");
  if (sfw) x = x.replace(SFW_RE, " ");
  return x.replace(/[^\p{L}\p{N}\s,.'&-]/gu, " ").replace(/\s{2,}/g, " ").trim().slice(0, max || 120);
}
function ids(list) { return Array.isArray(list) ? list.map((c) => (Array.isArray(c) ? c[0] : c)).filter((v) => v !== undefined && v !== null) : []; }
function validate(out, options, sfw) {
  const s = out && typeof out.settings === "object" && out.settings && !Array.isArray(out.settings) ? out.settings : {};
  const res = {};
  for (const k of ["look", "style", "heat", "tab", "cam", "castMix", "neon", "neonPick", "room", "eye", "dnaW", "psych"]) {
    if (s[k] === undefined) continue;
    if (k === "heat" && sfw) continue;
    const allow = ids(options && options[k]).map(String);
    if (allow.includes(String(s[k]))) res[k] = s[k];
  }
  if (s.people !== undefined) { const n = parseInt(s.people, 10); if (ids(options && options.people).includes(n)) res.people = n; }
  if (s.switches && typeof s.switches === "object") {
    const allow = ids(options && options.switches), sw = {};
    for (const k of Object.keys(s.switches)) if (allow.includes(k) && typeof s.switches[k] === "boolean") sw[k] = s.switches[k];
    if (Object.keys(sw).length) res.switches = sw;
  }
  const extra = Array.isArray(out && out.extra_words) ? out.extra_words.filter((w) => typeof w === "string").map((w) => clean(w, sfw, 40)).filter(Boolean).slice(0, 3) : [];
  return { settings: res, idea: clean(out && out.idea, sfw, 120), extra_words: extra };
}
function slimOptions(o) { // keep the request small: ids + short labels only
  const out = {};
  for (const k of ["look", "style", "heat", "tab", "cam", "people", "castMix", "neon", "neonPick", "room", "eye", "dnaW", "psych", "switches"]) {
    if (!Array.isArray(o && o[k])) continue;
    out[k] = o[k].slice(0, 200).map((c) => (Array.isArray(c) ? [String(c[0]).slice(0, 40), String(c[1] || "").slice(0, 40)] : c));
  }
  return out;
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const ch = cors(origin);
    if (req.method === "OPTIONS") return ch ? new Response(null, { status: 204, headers: ch }) : new Response(null, { status: 403 });
    if (!ch) return json({ error: "origin not allowed" }, 403);
    if (req.method !== "POST") return json({ error: "POST only" }, 405, ch);
    if (!env.OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY not set" }, 500, ch);

    // rate limit per IP
    const ip = req.headers.get("CF-Connecting-IP") || "anon";
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "slow down — try again in a minute" }, 429, ch);
    } else {
      const now = Date.now(), win = 60000, lim = parseInt(env.RATE_LIMIT_PER_MIN || "20", 10);
      const arr = (memHits.get(ip) || []).filter((t) => now - t < win); arr.push(now); memHits.set(ip, arr);
      if (memHits.size > 5000) memHits.clear();
      if (arr.length > lim) return json({ error: "slow down — try again in a minute" }, 429, ch);
    }

    const len = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (len > MAX_BODY) return json({ error: "request too large" }, 413, ch);
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "request too large" }, 413, ch);
    let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad JSON" }, 400, ch); }
    const sfw = body.mode !== "18+";
    const text = String(body.text || "").replace(AGE_RE, " ").replace(FAMILY_RE, " ").slice(0, 400).trim();
    if (!text) return json({ error: "empty text" }, 400, ch);
    const options = slimOptions(body.options || {});
    const user = { mode: sfw ? "SFW" : "18+", text, current: body.settings || {}, my_words: (Array.isArray(body.my_words) ? body.my_words : []).slice(0, 40).map((w) => clean(w, sfw, 40)).filter(Boolean), options };

    const model = env.MODEL || DEFAULT_MODEL;
    let out, data, lastErr = "model did not return JSON";
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      let r;
      try {
        r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://zigflames.com", "X-Title": "ZigFlames Prompt Machine" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(user) }],
            response_format: { type: "json_object" }, max_tokens: MAX_TOKENS, temperature: 0.3 }),
        });
      } catch (e) { lastErr = "upstream unreachable"; continue; }
      if (!r.ok) { lastErr = "upstream " + r.status; continue; }
      data = await r.json().catch(() => null);
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      try { out = JSON.parse(firstObject(String(content || ""))); } catch (e) { out = null; console.log("bad json", String(content || "").slice(0, 300)); }
    }
    if (!out) return json({ error: lastErr }, 502, ch);
    const result = validate(out, options, sfw);
    const u = (data && data.usage) || {}, p = PRICE[model] || PRICE[DEFAULT_MODEL];
    const cost = ((u.prompt_tokens || 0) * p[0] + (u.completion_tokens || 0) * p[1]) / 1e6;
    result.usage = { model, in: u.prompt_tokens || 0, out: u.completion_tokens || 0, est_usd: Math.round(cost * 1e6) / 1e6 };
    console.log(JSON.stringify(result.usage));
    return json(result, 200, ch);
  },
};
