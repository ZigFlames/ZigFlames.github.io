// ZigFlames Prompt Machine — "Talk to it" AI worker (Cloudflare Workers + OpenRouter).
// The model only PICKS option ids that the page sends and writes a short scene idea.
// It never writes prompt text; the page builds prompts from its own banks. The page
// re-validates everything too, so this worker is the first gate, not the only one.
// Second action ("AI Tighten", body.action === "tighten" or POST /tighten): an editor pass over a finished
// prompt. {prompt, negative, mode} -> {prompt, negative, notes, usage}. Params (--x) are never sent to the
// model; they are re-attached verbatim, last. Output is re-checked (ages, family roles, explicitness, 21+,
// ::weights, length) and the original comes back with a note if the check fails.

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite"; // $0.10/M in, $0.40/M out (OpenRouter, Oct 2026)
const PRICE = { "google/gemini-2.5-flash-lite": [0.10, 0.40], "mistralai/mistral-small-3.2-24b-instruct": [0.075, 0.20], "meta-llama/llama-3.3-70b-instruct": [0.10, 0.32] };
const MAX_BODY = 16 * 1024;
const MAX_TOKENS = 450;
const ALLOWED = [/^https:\/\/(www\.)?zigflames\.com$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const AGE_RE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
const FAMILY_RE = /\b(?:step\w*|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|taboo|free[\s-]?use|non[\s-]?consen\w*|forced|sleeping|asleep|unconscious|drunk|hidden[\s-]?cam\w*)\b/gi;
const SFW_RE = /\b(?:nude|nudity|naked|topless|nipples?|explicit|porn\w*|xxx|sex\w*|pussy|cock\w*|dick\w*|tits?|boobs?|anal|fuck\w*|horny|orgasm\w*|fetish\w*|onlyfans|erotic\w*|lingerie|thong|spicy|hardcore|nsfw)\b/gi;
// ---- tighten core (same code in ai-worker/worker.js and studio/app/assets/ai-tighten.js) ----
var TG_AGE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
var TG_FAMILY = /\b(?:step\w*|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|taboo|free[\s-]?use|non[\s-]?consen\w*|forced|sleeping|asleep|unconscious|drunk|hidden[\s-]?cam\w*)\b/gi;
var TG_NUMAGE = /\b(?:aged?\s+)?\d{1,3}\s*\+?\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?\b|\baged?\s+\d{1,3}\+?/gi;
var TG_EXPL = /\b(?:nude|nudity|naked|topless|bottomless|nipples?|explicit|porn\w*|xxx|sex\w*|pussy|cock\w*|dick\w*|tits?|boobs?|anal|fuck\w*|horny|orgasm\w*|fetish\w*|erotic\w*|lingerie|thong|spicy|hardcore|nsfw|uncensored|cum\w*|penetrat\w*|blowjob\w*|bdsm|genital\w*)\b/gi;
var TG_FILLER = /\b(?:masterpiece|best[\s-]+quality|top[\s-]+quality|octane[\s-]+render|unreal[\s-]+engine(?:\s*\d)?|hyper[\s-]?detailed|8k(?:\s+uhd)?)\b/gi;
var TG_CGI = /\b(?:cartoon\w*|anime|cgi|3d\s+render\w*|pixar|illustrat\w*|cel[\s-]shad\w*|video\s+game|claymation|toon)\b/i;
function tgSplitParams(s) {
  s = String(s || "");
  var m = /(^|\s)--[a-z]/i.exec(s);
  if (!m) return { body: s.trim(), tail: "" };
  var i = m.index + m[1].length;
  return { body: s.slice(0, i).replace(/[\s,]+$/, ""), tail: s.slice(i).trim() };
}
function tgSegs(body) { // Midjourney multi-prompt: "text::2 text::1.5 text"
  var re = /::(-?\d*\.?\d+)?\s*/g, out = [], last = 0, m;
  while ((m = re.exec(body))) { out.push({ text: body.slice(last, m.index).trim(), w: m[1] || "" }); last = re.lastIndex; }
  out.push({ text: body.slice(last).trim(), w: null });
  return out;
}
function tgJoin(segs) { return segs.map(function (s) { return s.w === null ? s.text : s.text + "::" + s.w; }).join(" ").trim(); }
function tgWeights(body) { var a = [], re = /::(-?\d*\.?\d+)?/g, m; while ((m = re.exec(body))) a.push(m[1] || ""); return a; }
function tgPosAvoid(t) { var i = String(t).search(/\bavoid\s*:/i); return i < 0 ? [String(t), ""] : [String(t).slice(0, i), String(t).slice(i)]; }
function tgTidy(t) {
  return String(t || "").replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/\s{2,}/g, " ")
    .replace(/^[\s,;]+/, "").replace(/[\s,;]+$/, "").replace(/\bavoid\s*:\s*,\s*/gi, "avoid: ").replace(/,\s*avoid\s*:\s*$/i, "").trim();
}
function tgNotIn(re, t, origLow) { // drop matches of re that the original text did not already contain
  return String(t).replace(re, function (m) { return origLow.indexOf(m.toLowerCase()) >= 0 ? m : " "; });
}
function tgScrubText(t, origLow) {
  var pa = tgPosAvoid(t), pos = pa[0], av = pa[1];
  pos = pos.replace(TG_AGE, " ").replace(TG_FAMILY, " ");                 // never in the positive prompt
  av = tgNotIn(TG_FAMILY, tgNotIn(TG_AGE, av, origLow), origLow);         // avoid list: keep protective words already there, add none
  var x = pos + av;
  x = tgNotIn(TG_NUMAGE, x, origLow);                                      // no new ages
  x = tgNotIn(TG_EXPL, x, origLow);                                        // never more explicit than the input (SFW: nothing explicit)
  return tgTidy(x);
}
function tgHas21(t) { return /\b21\s*\+/.test(String(t)); }
// Validate a candidate body against the original prompt. Params are always the original tail, verbatim, last.
function tgFinalize(orig, candBody) {
  var o = tgSplitParams(orig), notes = [];
  var cp = tgSplitParams(candBody);
  if (cp.tail) notes.push("Ignored params the AI wrote; kept yours.");
  var c = cp.body;
  if (tgWeights(o.body).join("|") !== tgWeights(c).join("|")) return { ok: false, why: "::weights changed" };
  var low = String(orig).toLowerCase();
  var segs = tgSegs(c).map(function (s) { return { text: tgScrubText(s.text, low), w: s.w }; });
  if (segs.some(function (s, i) { return !s.text && (s.w !== null || i === 0); })) return { ok: false, why: "empty segment" };
  if (tgHas21(o.body + " " + o.tail) && !tgHas21(tgJoin(segs))) {
    var L = segs[segs.length - 1]; L.text = L.text ? L.text + ", adult 21+" : "adult 21+"; notes.push("Kept the adult 21+ tag.");
  }
  var body = tgJoin(segs);
  if (!body) return { ok: false, why: "empty" };
  var out = body + (o.tail ? " " + o.tail : "");
  if (out.length > Math.ceil(String(orig).length * 1.1) + 4) return { ok: false, why: "came back longer" };
  return { ok: true, prompt: out, notes: notes };
}
// Contradictions: when the prompt asks for raw/real skin or real light, drop the polished alternative.
var TG_RAWSKIN = /\b(?:pores|unretouched|imperfections|peach fuzz|natural skin texture|raw skin|skin texture)\b/i;
var TG_POLISH = /\b(?:flawless|airbrush\w*|poreless|porcelain|even[\s-]toned|uniform complexion|glass skin|beauty[\s-]filter\w*|retouched|smooth skin|perfect skin)\b/i;
var TG_REALLIGHT = /\b(?:ordinary|natural|available|practical|window|mixed)\s+(?:\w+\s+)?(?:light|lighting)\b/i;
var TG_STUDIOLIGHT = /\b(?:studio\s+(?:light\w*|softbox\w*)|beauty\s+(?:dish|lighting)|perfect\s+lighting|flawless\s+lighting)\b/i;
var TG_FRAG = /^(?:clear|smooth|even[\s-]toned|flawless|glowing|perfect|radiant|polished)$/i;
function tgNegated(p) { return /^\s*(?:not?|without|zero|avoid)\b/i.test(p); }
function tgContra(allPos) {
  var raw = TG_RAWSKIN.test(allPos), real = TG_REALLIGHT.test(allPos);
  return function (p) { if (tgNegated(p)) return false; return (raw && TG_POLISH.test(p)) || (real && TG_STUDIOLIGHT.test(p)); };
}
function tgIs21(p) { return /\b21\s*\+/.test(p); }
function tgContained(k, list) { for (var i = 0; i < list.length; i++) { if (list[i] === k || (" " + list[i] + " ").indexOf(" " + k + " ") >= 0) return true; } return false; }
function tgNorm(p) { return String(p || "").toLowerCase().replace(/[’]/g, "'").replace(/^\s*(?:a|an|the)\s+/, "").replace(/[^a-z0-9+' ]+/g, " ").replace(/\s+/g, " ").trim(); }
function tgCgi(body) { return tgSegs(body).some(function (s) { return TG_CGI.test(tgPosAvoid(s.text)[0]); }); }
// Free local tighten: dedupe comma phrases (case-insensitive, also phrases already inside a kept phrase),
// drop generic AI filler unless it's a CGI/cartoon prompt, params stay last.
function tgLocal(prompt, negative) {
  var o = tgSplitParams(prompt), cgi = tgCgi(o.body), segs = tgSegs(o.body), prevKept = [], removed = [];
  var contra = tgContra(segs.map(function (s) { return tgPosAvoid(s.text)[0]; }).join(", "));
  segs.forEach(function (s, si) {
    var pa = tgPosAvoid(s.text), kept = [], isTail = s.w === null && segs.length > 1;
    var parts = pa[0].split(/\s*,\s*/);
    parts.forEach(function (p, pi) {
      var raw = p.trim(); if (!raw) return;
      if (!cgi) { var nf = tgTidy(raw.replace(TG_FILLER, " ")); if (nf !== raw) { removed.push(raw); if (!nf) return; raw = nf; } }
      if (contra(raw) || (TG_FRAG.test(raw) && parts[pi + 1] && contra(parts[pi + 1].trim()))) { removed.push(raw); return; }
      var k = tgNorm(raw); if (!k) return;
      var keptK = kept.map(tgNorm);
      if (keptK.indexOf(k) >= 0 || (!tgIs21(raw) && (tgContained(k, keptK) || (isTail && tgContained(k, prevKept))))) { removed.push(raw); return; }
      kept.push(raw);
    });
    var av = "";
    if (pa[1]) {
      var items = pa[1].replace(/^\s*avoid\s*:\s*/i, "").split(/\s*,\s*/), ak = [], seenA = {};
      items.forEach(function (p) { var k = tgNorm(p); if (!k) return; if (seenA[k]) { removed.push(p.trim()); return; } seenA[k] = 1; ak.push(p.trim()); });
      av = ak.length ? "avoid: " + ak.join(", ") : "";
    }
    var txt = kept.join(", ") + (av ? (kept.length ? ", " : "") + av : "");
    if (!txt) txt = s.text;
    s.text = txt; prevKept = prevKept.concat(kept.map(tgNorm));
  });
  var fin = tgFinalize(prompt, tgJoin(segs));
  var neg = String(negative || ""), seenN = {}, nk = [];
  neg.split(/\s*,\s*/).forEach(function (p) { var k = tgNorm(p); if (!k) return; if (seenN[k]) { removed.push(p.trim()); return; } seenN[k] = 1; nk.push(p.trim()); });
  return { prompt: fin.ok ? fin.prompt : prompt, negative: neg ? nk.join(", ") : neg, removed: removed, ok: fin.ok, why: fin.why, notes: fin.notes || [] };
}
// What went away (comma phrases whose count dropped), for the before/after note.
function tgRemoved(before, after) {
  function count(s) { var m = {}; tgSplitParams(s).body.split(/\s*(?:,|::-?\d*\.?\d+)\s*/).forEach(function (p) { var k = tgNorm(p); if (k) m[k] = (m[k] || 0) + 1; }); return m; }
  var a = count(before), b = count(after), out = [], seen = {};
  tgSplitParams(before).body.split(/\s*(?:,|::-?\d*\.?\d+)\s*/).forEach(function (p) { var k = tgNorm(p); if (k && !seen[k] && (b[k] || 0) < a[k]) { seen[k] = 1; out.push(p.trim() + ((b[k] || 0) > 0 || (" " + Object.keys(b).join(" | ") + " ").indexOf(" " + k + " ") >= 0 ? " (dupe)" : "")); } });
  return out;
}
// ---- end tighten core ----

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

const TIGHTEN_SYSTEM = `You are a prompt EDITOR that TIGHTENS photoreal AI image/video prompts by choosing which numbered phrases to keep. Reply with ONE JSON object only, no prose, no markdown:
{"keep":[phrase ids to keep, in the new order],"trim":[[id,"shorter phrase"]],"negative":[negative ids to keep]}
Example: {"keep":[0,2,1,4,7,5],"trim":[[4,"iPhone on a tripod"]],"negative":[0,1]}
Input: {"mode","cgi_style","segments":[{"weight","phrases":[[id,"phrase"],...]}],"negative":[[id,"phrase"],...]}. Segments are Midjourney multi-prompt parts (text::weight); the machine re-adds weights, "avoid:" lists and --params itself.
- "keep": a flat list of ids (numbers only). Ids not listed are dropped. Segments stay as they are; your order is applied inside each segment.
- DROP duplicates and near-duplicates (same idea said twice: keep the more specific one). The LAST segment should drop phrases already said in earlier segments; earlier weighted segments keep their own phrases.
- DROP contradictions: keep the raw/real option, drop the polished one (keep "natural skin texture", drop "airbrushed", "flawless smooth skin", "uniform complexion", "beauty lighting"; keep "ordinary indoor lighting" over "studio lighting").
- DROP filler and generic AI-look words ("masterpiece", "best quality", "octane render", "unreal engine", "hyperdetailed", "8k", "highly detailed") unless cgi_style is true.
- Long prompts usually have 15-30% removable phrases: repeated camera/skin/light wording, generic praise, phrases that say the same as a longer phrase. Remove them.
- Keep one "adult 21+" style tag in the LAST segment.
- ORDER each segment: subject/idea, outfit, setting first; then camera and lighting; then details.
- KEEP every specific detail: outfits, brands, places, rooms, people count, faces/features, hair, tattoos, nails, neon colours, actions; real-camera cues (iPhone, 90s, 24mm/50mm, ISO, film grain, raw, candid, motion blur, sensor noise); raw unpolished skin wording (pores, peach fuzz, sweat, imperfections, unretouched); every "adult 21+" tag.
- "trim" (optional, max 12 pairs): shorten a wordy kept phrase by DELETING words only (no new words), e.g. "shot on iPhone 18 Pro on a tripod" -> "iPhone 18 Pro on a tripod". Keep the specific words.
- "negative": ids of negative phrases to keep (drop only duplicates).
Zig likes: photorealistic, real camera, raw unpolished skin, varied real lighting, nothing generic. Adults 21+ only.`;

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

// ---------- AI Tighten ----------
const MAX_PROMPT = 6000;
async function callModel(env, model, messages, maxTokens, temperature) {
  let r;
  try {
    r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.OPENROUTER_API_KEY, "Content-Type": "application/json", "HTTP-Referer": "https://zigflames.com", "X-Title": "ZigFlames Prompt Machine" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_tokens: maxTokens, temperature }),
    });
  } catch (e) { return { err: "upstream unreachable" }; }
  if (!r.ok) return { err: "upstream " + r.status };
  const data = await r.json().catch(() => null);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  let out = null;
  try { out = JSON.parse(firstObject(String(content || ""))); } catch (e) { console.log("bad json", (data && data.choices && data.choices[0] && data.choices[0].finish_reason) || "", String(content || "").length, String(content || "").slice(-200)); }
  return { out, data, err: out ? "" : "model did not return JSON" };
}
// Details the edit must not lose: brand/proper words, neon colours, camera cues, people counts, 21+.
function keepTokens(body) {
  const pos = tgSegs(body).map((s) => tgPosAvoid(s.text)[0]).join(", ");
  const set = new Map();
  const add = (t) => { const k = t.toLowerCase(); if (!set.has(k)) set.set(k, t); };
  (pos.match(/\b[\w'’]*[A-Z][\w'’+]*/g) || []).filter((w) => !/^(?:NSFW|XXX|AI|UI|CGI|HD|UHD)$/.test(w)).forEach(add);
  (pos.match(/\b[\w-]+\s+neon\b|\bneon\s+[\w-]+/gi) || []).forEach(add);
  (pos.match(/\b(?:\d{2,3}mm|90s|80s|y2k|film grain|raw|iphone|polaroid|disposable camera|camcorder|vhs)\b/gi) || []).forEach(add);
  (pos.match(/\b(?:one|two|three|four|five|six|seven|eight)\b/gi) || []).forEach(add);
  if (tgHas21(pos)) add("21+");
  return [...set.values()];
}
function phraseWith(body, tok) {
  const t = tok.toLowerCase();
  const ph = tgSegs(body).map((s) => tgPosAvoid(s.text)[0]).join(", ").split(/\s*,\s*/);
  return ph.find((p) => p.toLowerCase().includes(t)) || tok;
}
const TRIM_OK = /^(?:shot|on|a|an|the|with|of|very|really|captured|photographed|taken|style|styled|looking|kind|sort|some|that|is|are|and|just|by)$/;
function words(t) { return String(t || "").toLowerCase().replace(/[’]/g, "'").split(/[^a-z0-9+'.\/-]+/).filter(Boolean); }
async function tighten(body, env, ch) {
  const sfw = body.mode !== "18+";
  const prompt = String(body.prompt || "").slice(0, MAX_PROMPT).trim();
  const negative = String(body.negative || "").slice(0, 2000).trim();
  if (!prompt) return json({ error: "empty prompt" }, 400, ch);
  const o = tgSplitParams(prompt), cgi = tgCgi(o.body), segs = tgSegs(o.body), last = segs.length - 1;
  // phrase table; deterministic pre-pass (filler, exact duplicates) before the model sees anything
  const table = [], earlier = [];
  const contra = tgContra(segs.map((s) => tgPosAvoid(s.text)[0]).join(", "));
  const S = segs.map((s, si) => {
    const pa = tgPosAvoid(s.text), ids = [], keptK = [], parts = pa[0].split(/\s*,\s*/);
    parts.forEach((p, pi) => {
      let t = p.trim(); if (!t) return;
      const id = table.length; table.push({ id, seg: si, text: t, orig: t });
      if (!cgi) { t = tgTidy(t.replace(TG_FILLER, " ")); table[id].text = t; if (!t) return; }
      if (contra(t) || (TG_FRAG.test(t) && parts[pi + 1] && contra(parts[pi + 1].trim()))) return;
      const k = tgNorm(t);
      if (!k || keptK.includes(k) || (!tgIs21(t) && (tgContained(k, keptK) || (si === last && last > 0 && tgContained(k, earlier))))) return;
      keptK.push(k); ids.push(id);
    });
    if (si < last) keptK.forEach((k) => earlier.push(k));
    let av = "";
    if (pa[1]) { const u = new Set(), kept = []; pa[1].replace(/^\s*avoid\s*:\s*/i, "").split(/\s*,\s*/).forEach((p) => { const k = tgNorm(p); if (k && !u.has(k)) { u.add(k); kept.push(p.trim()); } }); av = kept.length ? "avoid: " + kept.join(", ") : ""; }
    return { w: s.w, ids, avoid: av };
  });
  const negList = negative ? negative.split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean) : [];
  const input = { mode: sfw ? "SFW" : "18+", cgi_style: cgi, segments: S.map((s) => ({ weight: s.w, phrases: s.ids.map((id) => [id, table[id].text]) })), negative: negList.map((t, i) => [i, t]) };
  const messages = [{ role: "system", content: TIGHTEN_SYSTEM }, { role: "user", content: JSON.stringify(input) }];
  const model = env.MODEL || DEFAULT_MODEL;
  const keep = keepTokens(o.body);
  let best = null, lastErr = "model did not return JSON", tin = 0, tout = 0, why = "";
  for (let attempt = 0; attempt < 2 && !best; attempt++) {
    const r = await callModel(env, model, messages, 700, attempt ? 0.4 : 0.1);
    const u = (r.data && r.data.usage) || {}; tin += u.prompt_tokens || 0; tout += u.completion_tokens || 0;
    if (!r.out) { lastErr = r.err; continue; }
    let flat = r.out.keep;
    if (!Array.isArray(flat) && Array.isArray(r.out.segments)) flat = r.out.segments; // tolerate the nested shape
    flat = (Array.isArray(flat) ? flat : []).flat(2).map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x));
    if (!flat.length) { lastErr = "model kept nothing"; continue; }
    const trim = {};
    if (Array.isArray(r.out.trim)) r.out.trim.forEach((x) => { if (Array.isArray(x) && typeof x[1] === "string") trim[String(parseInt(x[0], 10))] = x[1]; else if (x && typeof x === "object" && typeof (x.value || x.text) === "string") trim[String(parseInt(x.id, 10))] = x.value || x.text; });
    else if (r.out.trim && typeof r.out.trim === "object") Object.keys(r.out.trim).forEach((k) => { if (typeof r.out.trim[k] === "string") trim[k] = r.out.trim[k]; });
    const used = new Set(), putBack = [];
    const kept = S.map((s) => {
      const allow = new Set(s.ids);
      let ids = flat.filter((x) => allow.has(x) && !used.has(x) && used.add(x));
      if (!ids.length) ids = s.ids.slice(); // never empty a segment
      return ids;
    });
    // must-keep details: put a dropped phrase back if its detail is gone everywhere
    const textOf = (id) => {
      const t = table[id].text, tr = trim[String(id)];
      if (typeof tr !== "string" || !tr.trim() || tr.length >= t.length) return t;
      const ow = new Set(words(t)), nw = words(tr);
      if (!nw.length || nw.some((w) => !ow.has(w))) return t; // deletion only
      const nset = new Set(nw);
      if (words(t).some((w) => !nset.has(w) && !TRIM_OK.test(w))) return t; // only filler words may go
      if (keep.some((k) => t.toLowerCase().includes(k.toLowerCase()) && !tr.toLowerCase().includes(k.toLowerCase()))) return t;
      return tgTidy(tr);
    };
    // weighted segments keep their own specific details (Midjourney weights apply per segment)
    S.forEach((s, si) => {
      if (s.w === null) return;
      const segKeep = keepTokens(s.ids.map((id) => table[id].text).join(", "));
      segKeep.forEach((k) => {
        const lk = k.toLowerCase();
        if (kept[si].map(textOf).join(", ").toLowerCase().includes(lk)) return;
        const ph = s.ids.find((id) => table[id].text.toLowerCase().includes(lk));
        if (ph !== undefined && !kept[si].includes(ph)) kept[si].push(ph);
      });
    });
    const all = () => kept.map((ids) => ids.map(textOf).join(", ")).join(", ").toLowerCase();
    keep.forEach((k) => {
      if (all().includes(k.toLowerCase())) return;
      const ph = table.find((p) => S[p.seg].ids.includes(p.id) && p.text.toLowerCase().includes(k.toLowerCase()));
      if (ph) { kept[ph.seg].push(ph.id); putBack.push(k); }
    });
    const cand = S.map((s, si) => ({ text: tgTidy(kept[si].map(textOf).join(", ") + (s.avoid ? ", " + s.avoid : "")), w: s.w }));
    const fin = tgFinalize(prompt, tgJoin(cand));
    if (!fin.ok) { why = fin.why; continue; }
    let neg = negative;
    if (negList.length && Array.isArray(r.out.negative)) {
      const nk = [...new Set(r.out.negative.map((x) => parseInt(x, 10)).filter((x) => x >= 0 && x < negList.length))].sort((a, b) => a - b);
      negList.forEach((t, i) => { if (!nk.includes(i) && (TG_AGE.test(t) || TG_FAMILY.test(t))) nk.push(i); TG_AGE.lastIndex = 0; TG_FAMILY.lastIndex = 0; }); // protective words stay
      if (nk.length) neg = nk.sort((a, b) => a - b).map((i) => negList[i]).join(", ");
    }
    const gone = tgRemoved(prompt, fin.prompt);
    const notes = (gone.length ? ["Removed: " + gone.slice(0, 12).join("; ") + (gone.length > 12 ? " (+" + (gone.length - 12) + " more)" : "")] : []).concat(fin.notes);
    if (putBack.length) notes.push("Kept details: " + putBack.join(", "));
    best = { prompt: fin.prompt, negative: neg, notes };
  }
  const p = PRICE[model] || PRICE[DEFAULT_MODEL];
  const usage = { model, in: tin, out: tout, est_usd: Math.round(((tin * p[0] + tout * p[1]) / 1e6) * 1e6) / 1e6 };
  console.log(JSON.stringify({ action: "tighten", ...usage, ok: !!best }));
  if (!best) {
    const pre = tgFinalize(prompt, tgJoin(S.map((s) => ({ text: tgTidy(s.ids.map((id) => table[id].text).join(", ") + (s.avoid ? ", " + s.avoid : "")), w: s.w }))));
    if (pre.ok && pre.prompt.length < prompt.length) {
      const gone = tgRemoved(prompt, pre.prompt);
      return json({ prompt: pre.prompt, negative, notes: ["AI pass failed (" + (why || lastErr) + ") — applied the rule-based tighten only."].concat(gone.length ? ["Removed: " + gone.slice(0, 12).join("; ")] : [], pre.notes), partial: true, usage }, 200, ch);
    }
    if (!tin && !tout) return json({ error: lastErr }, 502, ch);
    return json({ prompt, negative, notes: ["AI edit didn't pass the checks (" + (why || lastErr) + ") — kept your original."], unchanged: true, usage }, 200, ch);
  }
  best.usage = usage;
  return json(best, 200, ch);
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
    if (!body || typeof body !== "object") return json({ error: "bad JSON" }, 400, ch);
    let path = "/"; try { path = new URL(req.url).pathname.replace(/\/+$/, "") || "/"; } catch (e) {}
    if (body.action === "tighten" || path === "/tighten") return tighten(body, env, ch);
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
