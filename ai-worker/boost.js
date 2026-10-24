// ZigFlames Prompt Machine — "AI Boost" actions (added Oct 24 2026). Additive: worker.js dispatches these
// action names here BEFORE its talk path; talk + tighten are untouched.
//   chat · cleanup · remix · expand · vocab · trending · looplab · seeds   (text, Grok via OpenRouter, Gemini fallback)
//   providers · image · video · video_status                                (media, provider keys are worker secrets)
// Every input is scrubbed (ages / minors / family roles / "teen"), people are framed adult 21+, and every
// output goes back through the same scrub. Media prompts are refused when minors are implied or a real /
// named person's likeness is asked for. Media spend has a server-side daily cap (KV binding SPEND).

const CHAT_MODEL = "x-ai/grok-4.20";            // $1.25/M in, $2.50/M out (OpenRouter, Oct 2026); reasoning off
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite"; // $0.10/M in, $0.40/M out
const PRICE = { "x-ai/grok-4.20": [1.25, 2.5], "x-ai/grok-4.3": [1.25, 2.5], "google/gemini-2.5-flash-lite": [0.10, 0.40] };

const AGE_RE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\s*girls?|school\s*boys?|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|shota\w*|preteen\w*|adolescen\w*|juvenile\w*|pubescen\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
const FAMILY_RE = /\b(?:step[\s-]?(?:moms?|mommy|mothers?|dads?|daddy|fathers?|sis\w*|bro\w*|daughters?|sons?|famil\w*|parents?|kids?|child\w*|aunt\w*|uncle\w*|cousins?)|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|niece|nephew|taboo|incest\w*|free[\s-]?use|non[\s-]?consen\w*|forced|rape\w*|sleeping|asleep|unconscious|drunk|drugged|hidden[\s-]?cam\w*|voyeur\w*|upskirt\w*)\b/gi;
const SFW_RE = /\b(?:nude|nudity|naked|topless|bottomless|nipples?|explicit|porn\w*|xxx|sex\w*|pussy|cock\w*|dick\w*|tits?|boobs?|anal|fuck\w*|horny|orgasm\w*|fetish\w*|onlyfans|erotic\w*|lingerie|thong|spicy|hardcore|nsfw|uncensored|cum\w*|blowjob\w*)\b/gi;
// minors implied -> refuse media outright (scrubbing alone is not enough for an image)
const MINOR_HARD = /\b(?:child\w*|kids?|minors?|under[\s-]?age\w*|teen\w*|tweens?|preteen\w*|loli\w*|shota\w*|school\s*girls?|schoolboys?|jail[\s-]?bait|barely[\s-]+legal|juvenile\w*|pubescen\w*|adolescen\w*|little\s+girls?|little\s+boys?|baby[\s-]?fac\w*|childlike|(?:[1-9]|1[0-7])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/i;
// real / named person likeness -> refuse media
const LIKENESS_RE = /\b(?:celebrit\w*|celeb|famous\s+(?:person|actress|actor|singer|rapper|model|influencer)|look[\s-]?alike|lookalike|deep[\s-]?fake\w*|face[\s-]?swap\w*|real\s+person|real\s+people|my\s+(?:ex|girlfriend|boyfriend|wife|husband|coworker|neighbou?r|classmate|boss|friend)|likeness\s+of|in\s+the\s+likeness)\b/i;
const NAMED_RE = /\b(?:looks?\s+like|as|of|like|resembling|styled\s+as|dressed\s+as|playing)\s+((?:[A-Z][a-z'’-]+|[A-Z]\.)(?:\s+(?:[A-Z][a-z'’-]+|[A-Z]\.)){1,2})\b/;
const NAME_OK = /^(?:New|Los|Las|San|Santa|Saint|St|Hong|Kuala|Rio|Tel|Buenos|Mexico|Cape|Hip|Old|Art|Film|Grand|Times|Times Square|Golden|Miami|Atlanta|Tokyo|Paris|Berlin|London|Venice|Seoul|Lagos|Dubai|Bali|Ibiza|Brooklyn|Bronx|Harlem|Detroit|Chicago|Houston|Texas|Florida|Kodak|Fuji|Canon|Sony|Nikon|Leica|Iphone|Apple|Nike|Adidas|Gucci|Prada|Versace|Chanel|Balenciaga|Off|Air|Jordan|Yeezy|Supreme|Polaroid|Cinema|Studio|Golden|Blue|Red|Pink|Neon|Black|White|Dark|Night|Summer|Winter|Spring|Fall|Autumn|North|South|East|West|Central|Wall|Sunset|Venice Beach|Miami Beach|Long Beach|Hollywood|Beverly)\b/;

function protectMusic(x){return String(x||"").replace(/\b([A-G][#b\u266f\u266d]?\s?)minor\b(?!\s+(?:girls?|boys?|wom[ae]n|m[ae]n|child\w*|kids?|persons?|people|females?|males?|models?))/g,"$1\u0001MNR\u0001").replace(/\bminor(?=\s+(?:keys?|chords?|piano|scales?|progressions?|thirds?|sevenths?|7ths?|pentatonic|harmon\w*|melod\w*|tonality)\b)/gi,"\u0001MNR\u0001")}function restoreMusic(x){return String(x).replace(/\u0001MNR\u0001/g,"minor")}
function scrub(t, adult, max) {
  let x = protectMusic(t).replace(AGE_RE, "").replace(FAMILY_RE, "").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bboys\b/gi, "men").replace(/\bboy\b/gi, "man");
  if (!adult) x = x.replace(SFW_RE, "");
  x = x.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/^\s*,\s*/gm, "");
  return restoreMusic(x).trim().slice(0, max || 4000);
}
const PEOPLE_RE = /\b(?:wom[ae]n|m[ae]n|lady|ladies|guy|guys|female|male|model|models|person|people|couple|she|he|her|him|they|dancer|rapper|singer|actress|actor|influencer|girlfriend|boyfriend|bride|crowd|friends|baddie|baddies|brunette|blonde|redhead|latina|ebony|milf|cougar|curvy|thick)\b/i;
function frame21(p) {
  p = String(p || "");
  if (PEOPLE_RE.test(p) && !/\b21\s*\+|\badults?\b/i.test(p)) p = "adult (21+) " + p.replace(/^\s*(?:a|an)\s+/i, "");
  return p;
}
function strList(a, n, max, adult) {
  return (Array.isArray(a) ? a : []).filter((x) => typeof x === "string" || typeof x === "number").map((x) => scrub(String(x), adult, max)).filter(Boolean).slice(0, n);
}
function firstObj(t) {
  t = String(t || ""); const a = t.indexOf("{"); if (a < 0) return null;
  let d = 0, q = false, esc = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (q) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === "{") d++; else if (c === "}" && --d === 0) { try { return JSON.parse(t.slice(a, i + 1)); } catch (e) { return null; } }
  }
  return null;
}
function J(obj, status, ch) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, ch || {}) }); }

// ---------- shared house rules for every text action ----------
function rules(adult) {
  return [
    "House rules (never break, never mention):",
    "- Every person is a consenting adult, 21 or older. Write 'adult' or '21+' where people appear. Never use the words teen, girl, young, schoolgirl, petite-young or any age under 21; say woman / man.",
    "- No minors, no family roles (step-, sister, mom, daddy...), no non-consent, no sleeping/drunk/hidden-camera, no real or named people (no celebrity names or lookalikes).",
    adult ? "- Adult (18+/21+) mode is ON: sensual and explicit wording about consenting adults is allowed when the user asks for it." : "- SFW mode: keep everything non-explicit (no nudity, no sex words).",
    "- Zig's taste: realistic real-camera photos (iPhone, 35mm, flash, CCTV, 90s camcorder), varied lighting every time (never the same light twice), raw unpolished natural skin with pores and texture most of the time (~75%), real places, specific outfits and brands. Zig's own words and DNA always win over your defaults: keep them verbatim.",
  ].join("\n");
}

async function llm(env, system, user, opt) {
  opt = opt || {};
  const models = opt.models || [env.CHAT_MODEL || CHAT_MODEL, env.MODEL && env.MODEL !== (env.CHAT_MODEL || CHAT_MODEL) ? env.MODEL : FALLBACK_MODEL];
  let lastErr = "no model";
  for (const model of models) {
    const body = { model, messages: [{ role: "system", content: system }].concat(Array.isArray(user) ? user : [{ role: "user", content: typeof user === "string" ? user : JSON.stringify(user) }]),
      max_tokens: opt.maxTokens || 500, temperature: opt.temperature == null ? 0.8 : opt.temperature };
    if (opt.json) body.response_format = { type: "json_object" };
    if (/^x-ai\//.test(model)) body.reasoning = { enabled: false };
    if (opt.plugins && model === models[0]) body.plugins = opt.plugins;
    let r;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), opt.timeout || 25000);
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: ctl.signal,
        headers: { Authorization: "Bearer " + env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://zigflames.com", "X-Title": "ZigFlames Prompt Machine" },
        body: JSON.stringify(body) });
      clearTimeout(to);
    } catch (e) { lastErr = "upstream unreachable"; continue; }
    if (!r.ok) { lastErr = "upstream " + r.status; console.log("boost llm", model, r.status); continue; }
    const data = await r.json().catch(() => null);
    const content = String((data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "");
    const obj = opt.json ? firstObj(content) : null;
    if (opt.json && !obj) { lastErr = "model did not return JSON"; continue; }
    if (!opt.json && !content.trim()) { lastErr = "empty reply"; continue; }
    const u = (data && data.usage) || {}, p = PRICE[model] || [2, 6];
    const est = typeof u.cost === "number" ? u.cost : ((u.prompt_tokens || 0) * p[0] + (u.completion_tokens || 0) * p[1]) / 1e6;
    return { text: content, obj, usage: { model, in: u.prompt_tokens || 0, out: u.completion_tokens || 0, est_usd: Math.round(est * 1e6) / 1e6, fallback: model !== models[0] } };
  }
  return { err: lastErr };
}

// ---------- text actions ----------
const TEXT = {
  async chat(b, env, adult) {
    const hist = (Array.isArray(b.messages) ? b.messages : []).slice(-8).map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: scrub(m && m.content, adult, 1500) })).filter((m) => m.content);
    if (!hist.length || hist[hist.length - 1].role !== "user") return { err: "empty message", status: 400 };
    const sys = "You are the AI assistant inside Zig's Prompt Machine (an image / video / music prompt studio). Help write and clean up text, build and improve image and video prompts (Midjourney, Grok Imagine, Sora, Kling, Flux), captions and Suno music prompts. Be direct and brief. When you write a prompt, put it alone in a ```prompt fenced block so it can be copied; keep Midjourney --params at the very end.\n" + rules(adult);
    const r = await llm(env, sys, hist, { maxTokens: Math.min(600, parseInt(env.CHAT_MAX_TOKENS || "600", 10)), temperature: 0.7 });
    if (r.err) return r;
    return { reply: scrub(r.text, adult, 6000), usage: r.usage };
  },
  async cleanup(b, env, adult) {
    const text = scrub(b.text, adult, 2000); if (!text) return { err: "empty text", status: 400 };
    const sys = "Clean up the user's idea text for an image/video prompt: fix spelling, grammar and wording, make it clear and vivid, one short paragraph or comma phrases. KEEP every specific detail and every word the user chose (names of places, brands, outfits, colours, camera). Do not add new subjects. Reply JSON {\"text\":\"...\"}.\n" + rules(adult);
    const r = await llm(env, sys, { text, kind: b.kind || "idea" }, { json: true, maxTokens: 400, temperature: 0.3 });
    if (r.err) return r;
    const out = frame21(scrub(r.obj.text, adult, 1500));
    return out ? { text: out, usage: r.usage } : { err: "empty", status: 502 };
  },
  async remix(b, env, adult) {
    const idea = scrub(b.idea || b.text, adult, 1200); if (!idea) return { err: "empty idea", status: 400 };
    const n = Math.max(1, Math.min(8, parseInt(b.count || 5, 10)));
    const sys = "You remix a seed idea into " + n + " FRESH, clearly different variations for photoreal image/video prompts. Each: one sentence of 18-40 words with who (adult 21+), outfit, place, time, action, a specific real camera and a DIFFERENT lighting setup; vary location, light, camera and mood across the set. Keep the user's key words. Reply JSON {\"ideas\":[\"...\"]}.\n" + rules(adult);
    const r = await llm(env, sys, { seed: idea, style: scrub(b.style, adult, 120), count: n }, { json: true, maxTokens: 900, temperature: 1.0 });
    if (r.err) return r;
    const ideas = strList(r.obj.ideas, n, 500, adult).map(frame21);
    return ideas.length ? { ideas, usage: r.usage } : { err: "empty", status: 502 };
  },
  async expand(b, env, adult) {
    const seeds = strList(b.seeds || [b.text], 12, 300, adult); if (!seeds.length) return { err: "empty seeds", status: 400 };
    const n = Math.max(1, Math.min(20, parseInt(b.count || 10, 10)));
    const sys = "You are a seed expander. From the user's seed ideas, invent " + n + " NEW seed ideas (6-16 words each): new scenarios, locations, outfits, camera formats and lighting in the same spirit, never repeats or near-duplicates of each other or the input. Reply JSON {\"seeds\":[\"...\"]}.\n" + rules(adult);
    const r = await llm(env, sys, { seeds, count: n, avoid: strList(b.avoid, 40, 80, adult) }, { json: true, maxTokens: 900, temperature: 1.05 });
    if (r.err) return r;
    const out = strList(r.obj.seeds, n, 240, adult);
    return out.length ? { seeds: out, usage: r.usage } : { err: "empty", status: 502 };
  },
  async vocab(b, env, adult) {
    const cat = scrub(b.category, adult, 60); if (!cat) return { err: "empty category", status: 400 };
    const n = Math.max(5, Math.min(60, parseInt(b.count || 30, 10)));
    const sys = "List " + n + " specific, real, visual items for the vocabulary category the user names (for image prompts). Short chips of 1-5 words, concrete and describable (models, styles, colourways, materials), no numbering, no duplicates, none from the 'have' list. Reply JSON {\"items\":[\"...\"]}.\n" + rules(adult);
    const r = await llm(env, sys, { category: cat, have: strList(b.have, 80, 60, adult), count: n }, { json: true, maxTokens: 800, temperature: 0.7 });
    if (r.err) return r;
    const seen = new Set(), items = strList(r.obj.items, n, 60, adult).filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    return items.length ? { category: cat, items, usage: r.usage } : { err: "empty", status: 502 };
  },
  async trending(b, env, adult) {
    // Live: cheap model + web search (~$0.0075/call, exa 5 results). Fallback: Grok from model knowledge (may lag).
    const today = new Date().toISOString().slice(0, 10);
    const sys = "Today is " + today + ". List 8 dance / TikTok / Reels trends and viral video formats that are popular RIGHT NOW (use the web results; prefer the last 4 weeks). For each: name, a one-line how-it-looks description, a photoreal video prompt idea (under 40 words) with one adult (21+) performer, a real camera and specific lighting, and when it peaked. Reply JSON {\"items\":[{\"name\":\"\",\"how\":\"\",\"prompt\":\"\",\"when\":\"\"}]}.\n" + rules(adult);
    const focus = scrub(b.focus, adult, 120) || "dance and creator video trends", region = scrub(b.region, adult, 60);
    const q = "viral TikTok dance trends " + (region ? region + " " : "") + new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    let r = await llm(env, sys, { focus, region }, { json: true, maxTokens: 2200, temperature: 0.5, timeout: 30000,
      models: [FALLBACK_MODEL, env.CHAT_MODEL || CHAT_MODEL], plugins: [{ id: "web", engine: "exa", max_results: 5, search_prompt: q }] });
    let r2 = r;
    // web search refused (e.g. 402 when OpenRouter credit is empty) -> same models from knowledge, flagged live:false
    if (r2.err) r2 = await llm(env, sys.replace("(use the web results; prefer the last 4 weeks)", "(from your most recent knowledge)"), { focus, region }, { json: true, maxTokens: 2200, temperature: 0.5, timeout: 25000, models: [env.CHAT_MODEL || CHAT_MODEL, FALLBACK_MODEL] });
    if (r2.err) return r2;
    const webOk = !r.err; r = r2;
    const items = (Array.isArray(r.obj.items) ? r.obj.items : []).slice(0, 12).map((x) => ({ name: scrub(x && x.name, adult, 80), how: scrub(x && x.how, adult, 220), prompt: frame21(scrub(x && x.prompt, adult, 500)), when: scrub(x && x.when, adult, 40) })).filter((x) => x.name);
    return items.length ? { items, live: webOk && !r.usage.fallback, usage: r.usage } : { err: "empty", status: 502 };
  },
  async looplab(b, env, adult) {
    const text = scrub(b.text, true, 2000); if (!text) return { err: "empty text", status: 400 };
    const sys = "You are a music-prompt editor. Turn the user's loop / beat idea into: (1) a tight Suno 'Style of Music' prompt under 900 characters with genre, BPM, key, instruments, mix and vibe - NO artist names (describe the sound instead); (2) a song structure (section tags like [Intro] [Verse] [Hook] with bar counts); (3) 3 sample-friendly loop descriptions for chopping on an MPC or phone (4-8 bars, clean loop points, no vocals unless asked, mono low end). Reply JSON {\"genre\":\"\",\"bpm\":90,\"key\":\"\",\"instruments\":[\"\"],\"style\":\"\",\"exclude\":\"\",\"structure\":\"\",\"samples\":[\"\"]}.";
    const r = await llm(env, sys, { idea: text, target: b.target || "suno" }, { json: true, maxTokens: 900, temperature: 0.6 });
    if (r.err) return r;
    const o = r.obj, bpm = Math.max(40, Math.min(220, parseInt(o.bpm, 10) || 0)) || null;
    return { genre: scrub(o.genre, true, 80), bpm, key: scrub(o.key, true, 30), instruments: strList(o.instruments, 12, 60, true), style: scrub(o.style, true, 1000), exclude: scrub(o.exclude, true, 400), structure: String(o.structure || "").replace(/[^\S\n]{2,}/g, " ").slice(0, 1500), samples: strList(o.samples, 5, 400, true), usage: r.usage };
  },
  async seeds(b, env, adult) {
    const sys = "Give 12 short variation details (4-12 words, under 120 characters each) that make each new image of the same prompt look like a DIFFERENT real adult (21+) person and a different real photo: face shape, features, skin texture (raw, unretouched most of the time), hair, expression, framing, and a different lighting each. No names, no ages. Reply JSON {\"details\":[\"...\"]}.\n" + rules(adult);
    const r = await llm(env, sys, { prompt: scrub(b.prompt, adult, 600) }, { json: true, maxTokens: 500, temperature: 1.0 });
    if (r.err) return r;
    const d = strList(r.obj.details, 16, 160, adult);
    return d.length ? { details: d, usage: r.usage } : { err: "empty", status: 502 };
  },
};

// ---------- media providers ----------
// key: worker secret name. adult: only selectable in 18+ mode (client) and only accepted with mode 18+ (server).
const IMAGE_PROVIDERS = {
  openrouter: { label: "Gemini Flash Image (OpenRouter)", key: "OPENROUTER_API_KEY", adult: false, model: "google/gemini-2.5-flash-image", usd: 0.039, note: "~$0.039/image; needs ≥$1 OpenRouter credit" },
  xai: { label: "Grok Imagine (xAI)", key: "XAI_API_KEY", adult: false, model: "grok-imagine-image", usd: 0.02, note: "$0.02/image (1K)" },
  venice: { label: "Venice · Lustify v8 (uncensored)", key: "VENICE_API_KEY", adult: true, model: "lustify-v8", usd: 0.01, note: "$0.01/image, safe_mode off" },
  venice_grok: { label: "Venice · Grok Imagine (private)", key: "VENICE_API_KEY", adult: true, model: "grok-imagine-image", usd: 0.03, note: "$0.03/image (1K)" },
  fal: { label: "fal.ai · FLUX dev (safety checker off)", key: "FAL_KEY", adult: true, model: "fal-ai/flux/dev", usd: 0.025, note: "$0.025/megapixel" },
  modelslab: { label: "ModelsLab · NSFW V2 (SD)", key: "MODELSLAB_API_KEY", adult: true, model: "nsfwxxx12", usd: 0.0047, note: "$0.0047/image on a $21+/mo plan" },
};
const VIDEO_PROVIDERS = {
  xai: { label: "Grok Imagine Video 1.5 Lite (xAI)", key: "XAI_API_KEY", adult: false, model: "grok-imagine-video-1.5-lite", perSec: { "480p": 0.02, "720p": 0.03 }, note: "$0.02/s 480p · $0.03/s 720p" },
  venice: { label: "Venice · Wan 2.7 Enhanced (uncensored)", key: "VENICE_API_KEY", adult: true, model: "wan-2-7-enhanced-text-to-video", perSec: { "720p": 0.128 }, note: "$0.64 per 5 s at 720p" },
  venice_grok: { label: "Venice · Grok Imagine 1.5 Lite", key: "VENICE_API_KEY", adult: true, model: "grok-imagine-1-5-lite-text-to-video", perSec: { "480p": 0.024, "720p": 0.036 }, note: "$0.12 per 5 s at 480p" },
};
function providerList(env, adult) {
  const m = (P, kind) => Object.keys(P).map((id) => ({ id, kind, label: P[id].label, adult: P[id].adult, ready: !!env[P[id].key], key: P[id].key, note: P[id].note, model: P[id].model, locked: P[id].adult && !adult }));
  return { image: m(IMAGE_PROVIDERS, "image"), video: m(VIDEO_PROVIDERS, "video"), caps: caps(env) };
}
function caps(env) {
  return { day_usd: parseFloat(env.DAILY_MEDIA_USD_CAP || "3"), ip_images: parseInt(env.DAILY_IMAGES_PER_IP || "40", 10), ip_videos: parseInt(env.DAILY_VIDEOS_PER_IP || "6", 10) };
}
const memSpend = new Map();
function dayKey() { return new Date().toISOString().slice(0, 10); }
async function kvGet(env, k) { try { if (env.SPEND) return JSON.parse((await env.SPEND.get(k)) || "null"); } catch (e) {} return memSpend.get(k) || null; }
async function kvPut(env, k, v) { memSpend.set(k, v); try { if (env.SPEND) await env.SPEND.put(k, JSON.stringify(v), { expirationTtl: 60 * 60 * 48 }); } catch (e) {} }
async function capCheck(env, ip, kind, usd) {
  const c = caps(env), d = dayKey();
  const tot = (await kvGet(env, "t:" + d)) || { usd: 0, n: 0 };
  const per = (await kvGet(env, "ip:" + d + ":" + ip)) || { image: 0, video: 0 };
  if (tot.usd + usd > c.day_usd) return "Daily AI media budget reached ($" + c.day_usd.toFixed(2) + "/day). Resets at midnight UTC.";
  if (kind === "image" && per.image >= c.ip_images) return "Daily image limit reached (" + c.ip_images + "/day).";
  if (kind === "video" && per.video >= c.ip_videos) return "Daily video limit reached (" + c.ip_videos + "/day).";
  return "";
}
async function capAdd(env, ip, kind, usd) {
  const d = dayKey();
  const tot = (await kvGet(env, "t:" + d)) || { usd: 0, n: 0 }; tot.usd = Math.round((tot.usd + usd) * 10000) / 10000; tot.n++; await kvPut(env, "t:" + d, tot);
  const pk = "ip:" + d + ":" + ip, per = (await kvGet(env, pk)) || { image: 0, video: 0 }; per[kind] = (per[kind] || 0) + 1; await kvPut(env, pk, per);
  return tot;
}
// Media prompt gate: refuse minors / likeness, scrub, frame adults 21+.
async function mediaPrompt(env, raw, adult) {
  const t = String(raw || "").slice(0, 2500);
  if (!t.trim()) return { err: "empty prompt", status: 400 };
  if (MINOR_HARD.test(t)) return { err: "Refused: adults only (21+). Remove any age / minor wording.", status: 422, refused: "minor" };
  if (LIKENESS_RE.test(t)) return { err: "Refused: no real or named person likeness (celebrities, lookalikes, people you know).", status: 422, refused: "likeness" };
  const nm = NAMED_RE.exec(t);
  if (nm && !NAME_OK.test(nm[1])) return { err: "Refused: \"" + nm[1] + "\" looks like a real person's name. Describe an original adult (21+) character instead.", status: 422, refused: "likeness" };
  if (/\b(?:family|step\w*|sisters?|daddy|mommy|non[\s-]?consen\w*|rape\w*|incest\w*)\b/i.test(t) && adult) return { err: "Refused: no family-role or non-consent scenarios.", status: 422, refused: "policy" };
  // cheap AI screen (Gemini Flash Lite, ~$0.00005) for named real people / minors that regexes miss; fails open to the regex result
  const s = await llm(Object.assign({}, env, { CHAT_MODEL: FALLBACK_MODEL, MODEL: FALLBACK_MODEL }), "Screen an image/video prompt. Reply JSON {\"real_person\":bool,\"minor\":bool}. real_person = it names or asks for the likeness of a real identifiable person (celebrity, public figure, influencer, private individual by name). minor = it implies anyone under 18. Fictional descriptions of unnamed adults are fine.", t.slice(0, 1500), { json: true, maxTokens: 30, temperature: 0, timeout: 8000 });
  if (s.obj && s.obj.minor === true) return { err: "Refused: adults only (21+).", status: 422, refused: "minor" };
  if (s.obj && s.obj.real_person === true) return { err: "Refused: no real or named person likeness.", status: 422, refused: "likeness" };
  let p = scrub(t, adult, 2000);
  p = frame21(p);
  if (!adult) p += ". Tasteful, non-explicit.";
  return { prompt: p, screen_usd: s.usage ? s.usage.est_usd : 0 };
}
const AR = { "9:16": [768, 1344], "3:4": [896, 1152], "1:1": [1024, 1024], "4:3": [1152, 896], "16:9": [1344, 768], "2:3": [832, 1216] };

async function genImage(b, env, adult, ip) {
  const id = String(b.provider || "openrouter"), P = IMAGE_PROVIDERS[id];
  if (!P) return { err: "unknown provider", status: 400 };
  if (P.adult && !adult) return { err: "This provider is only available in 18+ mode.", status: 403, locked: true };
  if (!env[P.key]) return { err: "needs key", needs_key: P.key, status: 503, provider: id };
  const g = await mediaPrompt(env, b.prompt, adult); if (g.err) return g;
  const capErr = await capCheck(env, ip, "image", P.usd); if (capErr) return { err: capErr, status: 429, capped: true };
  const ar = AR[b.aspect] ? b.aspect : "9:16", [w, h] = AR[ar];
  let url = "", r, d;
  try {
    if (id === "openrouter") {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://zigflames.com", "X-Title": "ZigFlames Prompt Machine" },
        body: JSON.stringify({ model: P.model, modalities: ["image", "text"], messages: [{ role: "user", content: g.prompt }], image_config: { aspect_ratio: ar } }) });
      d = await r.json().catch(() => null);
      if (r.status === 402) return { err: "OpenRouter needs at least $1 of credit for image output. Add credit at openrouter.ai/settings/credits.", needs_credit: true, status: 402, provider: id };
      const m = d && d.choices && d.choices[0] && d.choices[0].message; url = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url || "";
    } else if (id === "xai") {
      r = await fetch("https://api.x.ai/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + env.XAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: P.model, prompt: g.prompt, n: 1, aspect_ratio: ar, response_format: "url" }) });
      d = await r.json().catch(() => null); url = d && d.data && d.data[0] && (d.data[0].url || (d.data[0].b64_json ? "data:image/jpeg;base64," + d.data[0].b64_json : "")) || "";
    } else if (id === "venice" || id === "venice_grok") {
      r = await fetch("https://api.venice.ai/api/v1/image/generate", { method: "POST", headers: { Authorization: "Bearer " + env.VENICE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: P.model, prompt: g.prompt.slice(0, 1400), negative_prompt: "child, minor, teen, underage, young-looking, cartoon, cgi, plastic skin, watermark, text", width: w, height: h, safe_mode: !adult, format: "webp", hide_watermark: true }) });
      d = await r.json().catch(() => null); url = d && d.images && d.images[0] ? "data:image/webp;base64," + d.images[0] : "";
    } else if (id === "fal") {
      r = await fetch("https://fal.run/" + P.model, { method: "POST", headers: { Authorization: "Key " + env.FAL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: g.prompt, image_size: { width: w, height: h }, num_images: 1, enable_safety_checker: !adult }) });
      d = await r.json().catch(() => null); url = d && d.images && d.images[0] && d.images[0].url || "";
    } else if (id === "modelslab") {
      r = await fetch("https://modelslab.com/api/v6/images/text2img", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: env.MODELSLAB_API_KEY, model_id: P.model, prompt: g.prompt, negative_prompt: "child, minor, teen, underage, young-looking, cartoon, cgi, watermark, text", width: String(Math.min(w, 1024)), height: String(Math.min(h, 1024)), samples: "1", safety_checker: adult ? "no" : "yes" }) });
      d = await r.json().catch(() => null); url = d && d.output && d.output[0] || "";
    }
  } catch (e) { return { err: "provider unreachable", status: 502, provider: id }; }
  if (r && (r.status === 401 || r.status === 403)) return { err: "provider rejected the key (" + P.key + ")", needs_key: P.key, status: 503, provider: id };
  if (!url) return { err: "provider returned no image" + (r ? " (" + r.status + ")" : ""), status: 502, provider: id, detail: String(JSON.stringify(d || "")).slice(0, 200) };
  const tot = await capAdd(env, ip, "image", P.usd);
  return { url, provider: id, model: P.model, prompt: g.prompt, cost: { est_usd: P.usd + (g.screen_usd || 0), note: P.note, today_usd: tot.usd, cap_usd: caps(env).day_usd } };
}

async function genVideo(b, env, adult, ip) {
  const id = String(b.provider || "xai"), P = VIDEO_PROVIDERS[id];
  if (!P) return { err: "unknown provider", status: 400 };
  if (P.adult && !adult) return { err: "This provider is only available in 18+ mode.", status: 403, locked: true };
  if (!env[P.key]) return { err: "needs key", needs_key: P.key, status: 503, provider: id };
  const g = await mediaPrompt(env, b.prompt, adult); if (g.err) return g;
  let res = P.perSec[b.resolution] ? b.resolution : Object.keys(P.perSec)[0];
  let dur = Math.max(1, Math.min(10, parseInt(b.duration || 5, 10)));
  if (id === "venice") dur = dur > 7 ? 10 : 5;
  const usd = Math.round(P.perSec[res] * dur * 100) / 100;
  const capErr = await capCheck(env, ip, "video", usd); if (capErr) return { err: capErr, status: 429, capped: true };
  const ar = ["9:16", "16:9", "1:1"].includes(b.aspect) ? b.aspect : "9:16";
  let r, d, job = "", dl = "";
  try {
    if (id === "xai") {
      r = await fetch("https://api.x.ai/v1/videos/generations", { method: "POST", headers: { Authorization: "Bearer " + env.XAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: P.model, prompt: g.prompt, duration: dur, aspect_ratio: ar, resolution: res }) });
      d = await r.json().catch(() => null); job = d && d.request_id || "";
    } else {
      r = await fetch("https://api.venice.ai/api/v1/video/queue", { method: "POST", headers: { Authorization: "Bearer " + env.VENICE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: P.model, prompt: g.prompt.slice(0, 2400), duration: dur + "s", resolution: res, aspect_ratio: ar }) });
      d = await r.json().catch(() => null); job = d && d.queue_id || ""; dl = d && d.download_url || "";
    }
  } catch (e) { return { err: "provider unreachable", status: 502, provider: id }; }
  if (r && (r.status === 401 || r.status === 403)) return { err: "provider rejected the key (" + P.key + ")", needs_key: P.key, status: 503, provider: id };
  if (r && r.status === 422) return { err: "Provider refused the prompt (content policy).", status: 422, provider: id };
  if (!job) return { err: "provider did not start the job" + (r ? " (" + r.status + ")" : ""), status: 502, provider: id, detail: String(JSON.stringify(d || "")).slice(0, 200) };
  const tot = await capAdd(env, ip, "video", usd);
  return { job, download_url: dl, provider: id, model: P.model, prompt: g.prompt, duration: dur, resolution: res, cost: { est_usd: usd, note: P.note, today_usd: tot.usd, cap_usd: caps(env).day_usd } };
}

async function videoStatus(b, env, adult, ch) {
  const id = String(b.provider || "xai"), P = VIDEO_PROVIDERS[id];
  if (!P) return J({ error: "unknown provider" }, 400, ch);
  if (!env[P.key]) return J({ error: "needs key", needs_key: P.key }, 503, ch);
  const job = String(b.job || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80); if (!job) return J({ error: "no job" }, 400, ch);
  try {
    if (id === "xai") {
      const r = await fetch("https://api.x.ai/v1/videos/" + job, { headers: { Authorization: "Bearer " + env.XAI_API_KEY } });
      const d = await r.json().catch(() => null) || {};
      if (d.status === "done" && d.video && d.video.url) return J({ status: "done", url: d.video.url }, 200, ch);
      if (d.status === "failed" || d.status === "expired") return J({ status: "failed", error: "generation failed" }, 200, ch);
      return J({ status: "pending" }, 200, ch);
    }
    const r = await fetch("https://api.venice.ai/api/v1/video/retrieve", { method: "POST", headers: { Authorization: "Bearer " + env.VENICE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model: P.model, queue_id: job }) });
    const ct = r.headers.get("Content-Type") || "";
    if (ct.includes("video/mp4")) return new Response(r.body, { status: 200, headers: Object.assign({ "Content-Type": "video/mp4", "Cache-Control": "no-store" }, ch) });
    const d = await r.json().catch(() => null) || {};
    if (r.status === 422) return J({ status: "failed", error: "provider refused (content policy)" }, 200, ch);
    if (!r.ok) return J({ status: "failed", error: "provider " + r.status }, 200, ch);
    if (d.status === "COMPLETED") return J({ status: "done", url: String(b.download_url || "") }, 200, ch);
    return J({ status: "pending", eta_ms: Math.max(0, (d.average_execution_time || 0) - (d.execution_duration || 0)) }, 200, ch);
  } catch (e) { return J({ status: "pending", error: "unreachable" }, 200, ch); }
}

export const BOOST_ACTIONS = new Set(["chat", "cleanup", "remix", "expand", "vocab", "trending", "looplab", "seeds", "providers", "image", "video", "video_status"]);
export async function boost(body, env, ch, req) {
  const a = body.action, adult = body.mode === "18+";
  const ip = (req && req.headers.get("CF-Connecting-IP")) || "anon";
  if (a === "providers") return J(providerList(env, adult), 200, ch);
  if (a === "video_status") return videoStatus(body, env, adult, ch);
  let out;
  if (a === "image") out = await genImage(body, env, adult, ip);
  else if (a === "video") out = await genVideo(body, env, adult, ip);
  else out = await TEXT[a](body, env, adult);
  if (out.err) { const s = out.status || 502; const e = Object.assign({ error: out.err }, out); delete e.err; delete e.status; return J(e, s, ch); }
  if (out.usage) console.log(JSON.stringify(Object.assign({ action: a }, out.usage)));
  return J(out, 200, ch);
}
