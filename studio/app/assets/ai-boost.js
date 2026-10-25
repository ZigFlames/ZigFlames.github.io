/* Zig's Prompt Machine — ✨ AI Boost (v20261024d)
   window.PMAI.call(action, body, opts) -> Promise<json>  (zigflames-ai worker; endpoint override: localStorage pm_ai_endpoint / window.PM_AI_ENDPOINT)
   window.PMBoost.mount(el, kind, apiRef) / unmount(el) / uniqAI(prompt)
   kinds: studio · remix · expand · vocab · dance · looplab
   Every AI panel has a free local fallback when the AI is unreachable. All AI text is re-checked here (adults 21+, no age / family words). */
(function () {
  "use strict";
  var DEF = "https://zigflames-ai.zigflames.workers.dev";
  // Studio Render (22-model panel) now runs through the worker; show when a free preview stood in for a paid model.
  window.addEventListener("pm-studio-notice", function (ev) {
    var n = document.querySelector("[data-pm=studio-notice]");
    if (!n) { n = document.createElement("div"); n.setAttribute("data-pm", "studio-notice"); n.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;max-width:min(560px,92vw);padding:10px 14px;border-radius:12px;background:rgba(15,10,30,.95);border:1px solid rgba(167,139,250,.5);color:#e9e5ff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)"; document.body.appendChild(n); }
    n.textContent = "\u2139\ufe0f " + String(ev.detail || ""); n.style.display = "block";
    clearTimeout(n._t); n._t = setTimeout(function () { n.style.display = "none"; }, 9000);
  });
  function endpoint() { try { var o = localStorage.getItem("pm_ai_endpoint"); if (o) return o; } catch (e) {} return window.PM_AI_ENDPOINT || DEF; }

  // ---------- safety (client side, mirrors the worker) ----------
  var AGE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
  var FAMILY = /\b(?:step[\s-]?(?:moms?|mommy|mothers?|dads?|daddy|fathers?|sis\w*|bro\w*|daughters?|sons?|famil\w*|parents?|kids?|child\w*|aunt\w*|uncle\w*|cousins?)|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|taboo|free[\s-]?use|non[\s-]?consen\w*|forced|sleeping|asleep|unconscious|hidden[\s-]?cam\w*)\b/gi;
  function protectMusic(x){return String(x||"").replace(/\b([A-G][#b\u266f\u266d]?\s?)minor\b(?!\s+(?:girls?|boys?|wom[ae]n|m[ae]n|child\w*|kids?|persons?|people|females?|males?|models?))/g,"$1\u0001MNR\u0001").replace(/\bminor(?=\s+(?:keys?|chords?|piano|scales?|progressions?|thirds?|sevenths?|7ths?|pentatonic|harmon\w*|melod\w*|tonality)\b)/gi,"\u0001MNR\u0001")}function restoreMusic(x){return String(x).replace(/\u0001MNR\u0001/g,"minor")}
  function safe(t) {
    return restoreMusic(protectMusic(t == null ? "" : t).replace(AGE, "").replace(FAMILY, "").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bboys\b/gi, "men").replace(/\bboy\b/gi, "man")
      .replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/[ \t]{2,}/g, " ")).trim();
  }
  var PEOPLE = /\b(?:woman|women|man|men|person|people|model|dancer|rapper|couple|she|her|he|him|lady|ladies|guy|guys|performer|creator)\b/i;
  function frame21(t) { t = safe(t); return t && PEOPLE.test(t) && !/\b(?:adult|21\+)/i.test(t) ? "adult (21+) " + t : t; }

  // ---------- network ----------
  function call(action, body, opts) {
    opts = opts || {};
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var tm = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, opts.timeout || 25000);
    var payload = Object.assign({ action: action }, body || {});
    return fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(tm);
        var ct = r.headers.get("content-type") || "";
        if (ct.indexOf("video/") === 0) return r.blob().then(function (b) { return { status: "done", url: URL.createObjectURL(b), _status: 200 }; });
        return r.json().catch(function () { return {}; }).then(function (j) { j = j || {}; j._status = r.status; return j; });
      }, function (e) { clearTimeout(tm); return { _status: 0, _offline: true, error: "AI unreachable" }; });
  }
  function aiFailed(j) { return !j || j._offline || j._status === 0 || j._status >= 500 && !j.needs_key || j._status === 429 && !j.capped || j._status === 404; }
  window.PMAI = { call: call, endpoint: endpoint, safe: safe };

  // ---------- local fallback material ----------
  var CAMS = ["shot on iPhone 15, rear camera", "Canon AE-1 on Portra 400", "Sony A7 IV with 35mm f/1.8", "90s camcorder still", "disposable camera with direct flash", "Fujifilm X100V", "Pixel night-mode phone shot", "Contax T2 point-and-shoot", "Ricoh GR III street snap", "Leica M6 on Tri-X 400"];
  var LIGHT = ["harsh overhead fluorescent light", "warm sodium streetlight", "late golden hour backlight", "on-camera direct flash at night", "blue-hour ambient window light", "neon sign spill in red and teal", "overcast soft daylight", "single bare bulb, deep shadows", "candle and phone-screen glow", "hard noon sun with crisp shadows", "dashboard and gas-station canopy light", "mixed tungsten and LED club light"];
  var SKIN = ["raw unretouched skin with visible pores", "natural skin texture, slight shine, no beauty filter", "faint freckles and flyaway hairs, unpolished", "real skin, mild redness and texture, no retouching"];
  var POLISH = ["clean editorial skin, light retouch", "soft glam makeup, natural texture kept"];
  var FRAMES = ["candid medium shot", "low-angle full body", "tight close-up", "over-the-shoulder snapshot", "wide environmental shot", "mirror selfie framing", "off-center casual framing"];
  var FACES = ["round face, wide-set eyes", "square jaw, thick brows", "heart-shaped face, gap tooth", "angular cheekbones, hooded eyes", "oval face, strong nose", "soft features, dimples", "long face, freckles", "high forehead, small chin"];
  var HAIR = ["messy bun", "box braids", "short pixie cut", "long straight dark hair", "loose curls", "bleached buzz cut", "shoulder-length waves", "slick low ponytail"];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function skin() { return Math.random() < 0.75 ? pick(SKIN) : pick(POLISH); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function localVariant(idea) { return frame21([safe(idea).replace(/[.,;\s]+$/, ""), pick(FRAMES), pick(CAMS), pick(LIGHT), skin()].filter(Boolean).join(", ")); }
  function localCleanup(t) {
    t = safe(t).replace(/\b(masterpiece|best quality|8k|ultra detailed|hyper[\s-]?detailed|trending on artstation)\b,?/gi, "").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*([.!?]|$)/g, "$1");
    var seen = {}, out = [];
    t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    t.split(/\s*,\s*/).forEach(function (p) { var k = p.toLowerCase().trim(); if (k && !seen[k]) { seen[k] = 1; out.push(p.trim()); } });
    return frame21(out.join(", "));
  }
  var EXP = ["at 2am under {l}", "in a rain-soaked parking lot", "on a rooftop at blue hour", "inside a corner bodega", "at a backyard cookout", "in a laundromat", "on a city bus at night", "at a roller rink", "in a tattoo shop", "on a fire escape", "in a vintage diner booth", "at a desert gas station"];
  function localExpand(seed, n) { var out = [], sl = safe(seed).toLowerCase(), ex = EXP.filter(function (e) { return !e.split(/\W+/).some(function (w) { return w.length > 3 && sl.indexOf(w) >= 0; }); }); if (!ex.length) ex = EXP; for (var i = 0; i < n; i++) out.push(frame21(safe(seed) + " " + pick(ex).replace("{l}", pick(LIGHT)) + ", " + pick(CAMS) + ", " + pick(LIGHT))); return out; }
  var VOCAB = {
    lighting: LIGHT, light: LIGHT, camera: CAMS, cameras: CAMS, framing: FRAMES, skin: SKIN, hair: HAIR, hairstyles: HAIR, faces: FACES,
    sneakers: ["Nike Air Force 1", "Jordan 4 Retro", "New Balance 550", "Adidas Samba", "Converse Chuck 70", "Vans Old Skool", "Nike Dunk Low", "Asics Gel-Kayano 14", "Puma Suede", "Reebok Club C"],
    locations: EXP.map(function (x) { return x.replace(" under {l}", ""); }), settings: EXP.map(function (x) { return x.replace(" under {l}", ""); }),
    moods: ["bored and unbothered", "mid-laugh", "sleepy late-night calm", "focused and serious", "playful smirk", "tired after a shift", "confident stare"],
    colors: ["burnt orange", "cobalt blue", "oxblood", "mint green", "butter yellow", "charcoal", "lilac", "olive drab", "hot pink"],
    outfits: ["oversized hoodie and bike shorts", "denim jacket over a slip dress", "track suit and gold hoops", "work uniform polo", "leather jacket and cargo pants", "vintage band tee and jeans"]
  };
  function localVocab(cat) { var k = String(cat || "").toLowerCase().trim(); if (VOCAB[k]) return VOCAB[k].slice(); for (var x in VOCAB) if (k.indexOf(x) >= 0 || x.indexOf(k) >= 0) return VOCAB[x].slice(); return []; }
  function localDetails() { var o = []; for (var i = 0; i < 12; i++) o.push([pick(FACES), pick(HAIR), pick(LIGHT), Math.random() < 0.75 ? "raw unretouched skin" : "light retouch"].join(", ")); return o; }

  // ---------- DOM helpers ----------
  var CSS = ".pmai{font-family:inherit;color:#e2e8f0;border:1px solid rgba(34,211,238,.35);background:linear-gradient(135deg,rgba(8,47,73,.45),rgba(76,29,149,.25));border-radius:16px;padding:14px;margin:14px 0}" +
    ".pmai h4{margin:0 0 4px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#67e8f9;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".pmai .sub{font-size:11px;color:#94a3b8;margin:0 0 10px}.pmai .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}" +
    ".pmai textarea,.pmai input,.pmai select{background:rgba(0,0,0,.45);color:#f1f5f9;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit}" +
    ".pmai textarea{width:100%;min-height:64px;resize:vertical;box-sizing:border-box}.pmai input[type=text]{flex:1;min-width:160px}" +
    ".pmai button{cursor:pointer;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;border:1px solid rgba(34,211,238,.45);background:rgba(34,211,238,.12);color:#a5f3fc}" +
    ".pmai button.go{background:linear-gradient(90deg,#22d3ee,#e879f9);color:#0f172a;border-color:transparent}.pmai button:disabled{opacity:.5;cursor:wait}" +
    ".pmai button.sm{padding:3px 8px;font-size:11px;border-radius:8px}.pmai .tab{background:transparent;color:#94a3b8;border-color:rgba(255,255,255,.12)}.pmai .tab.on{background:rgba(232,121,249,.2);color:#f5d0fe;border-color:rgba(232,121,249,.6)}" +
    ".pmai .badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.2);color:#cbd5e1;text-transform:none;letter-spacing:0}" +
    ".pmai .badge.ai{border-color:rgba(34,211,238,.6);color:#67e8f9}.pmai .badge.local{border-color:rgba(251,191,36,.6);color:#fcd34d}.pmai .badge.warn{border-color:rgba(248,113,113,.6);color:#fca5a5}" +
    ".pmai .item{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12.5px;line-height:1.45}" +
    ".pmai .item b{color:#f5d0fe}.pmai .note{font-size:11px;color:#fcd34d;margin:6px 0}.pmai .muted{font-size:11px;color:#94a3b8}" +
    ".pmai .msg{padding:8px 10px;border-radius:10px;margin:6px 0;font-size:13px;white-space:pre-wrap;line-height:1.45}.pmai .msg.u{background:rgba(232,121,249,.12);margin-left:15%}.pmai .msg.a{background:rgba(34,211,238,.10);margin-right:8%}" +
    ".pmai .chat{max-height:340px;overflow:auto}.pmai pre{white-space:pre-wrap;background:rgba(0,0,0,.45);padding:8px;border-radius:8px;font-size:12px;margin:4px 0}" +
    ".pmai .media img,.pmai .media video{max-width:100%;max-height:420px;border-radius:12px;display:block;margin:8px 0}.pmai .err{color:#fca5a5;font-size:12px}";
  function css() { if (document.getElementById("pmai-css")) return; var s = document.createElement("style"); s.id = "pmai-css"; s.textContent = CSS; document.head.appendChild(s); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { var v = attrs[k]; if (v == null || v === false) continue; if (k === "on") for (var ev in v) e.addEventListener(ev, v[ev]); else if (k === "text") e.textContent = v; else if (k === "cls") e.className = v; else if (k in e && k !== "list") e[k] = v; else e.setAttribute(k, v); }
    (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function copy(t, api) { try { navigator.clipboard.writeText(t); } catch (e) {} toast(api, "Copied", String(t).slice(0, 80)); }
  function toast(api, t, d) { try { api.current.toast && api.current.toast(t, d); } catch (e) {} }
  function adult(api) { return !!(api.current && api.current.adult); }
  function mode(api) { return adult(api) ? "18+" : "sfw"; }
  function badge(j, local) {
    if (local) return h("span", { cls: "badge local", text: "Offline fallback · free" });
    var u = j && j.usage, m = u && u.model ? u.model.replace(/^.*\//, "") : "AI";
    return h("span", { cls: "badge ai", text: m + (u && u.free ? " · free $0" : u && u.est_usd != null ? " · ~$" + Number(u.est_usd).toFixed(4) : "") });
  }
  function busy(btn, on, label) { btn.disabled = on; if (on) { btn._t = btn.textContent; btn.textContent = label || "Thinking…"; } else if (btn._t) btn.textContent = btn._t; }
  function itemRow(text, api, extra) {
    return h("div", { cls: "item" }, [h("div", { text: text }), h("div", { cls: "row" }, [h("button", { cls: "sm", text: "Copy", on: { click: function () { copy(text, api); } } })].concat(extra || []))]);
  }

  // ---------- panels ----------
  var P = {};

  // ---------- selection context (pm-context.js) + text-model setting ----------
  var MODEL_KEY = "pm_ai_textmodel";
  var MODELS = [["free", "Free (best free model)"], ["gpt", "GPT (needs OpenRouter credit)"], ["grok", "Grok (needs credit)"], ["gemini", "Gemini Flash Lite (needs credit)"]];
  function textModel() { try { var m = localStorage.getItem(MODEL_KEY); return MODELS.some(function (x) { return x[0] === m; }) ? m : "free"; } catch (e) { return "free"; } }
  function modelSelect() {
    var sel = h("select", { title: "Which AI writes for Remix / Cleanup / Classify. Free costs $0 (50 calls/day). Paid models answer 'needs credit' until OpenRouter credit exists, then the free model and the local fallback take over." }, MODELS.map(function (m) { return h("option", { value: m[0], text: "Model: " + m[1] }); }));
    sel.value = textModel(); sel.addEventListener("change", function () { try { localStorage.setItem(MODEL_KEY, sel.value); } catch (e) {} });
    return sel;
  }
  function ctxOf(api) { try { var c = api.current.getCtx && api.current.getCtx(); return c || (window.PMCtx ? window.PMCtx.read() : null); } catch (e) { return null; } }
  function tierMode(ctx, api) { return ctx ? (ctx.adult ? "18+" : "sfw") : mode(api); }
  function ctxVariant(idea, ctx) {
    if (!ctx || !window.PMCtx) return localVariant(idea);
    var ws = window.PMCtx.words(ctx, 5).slice(0, 5).map(function (x) { return x.w; });
    var parts = [safe(idea).replace(/[.,;\s]+$/, ""), pick(FRAMES)].concat(ws);
    if (ctx.realism) parts.push(pick(CAMS), pick(LIGHT), skin());
    if (ctx.tier === "xxx" && !/explicit|xxx/i.test(parts.join(" "))) parts.push("explicit, uncensored, consenting adults");
    if (ctx.tier === "nsfw" && !/nsfw|nude|lingerie|topless/i.test(parts.join(" "))) parts.push("NSFW, sensual, implied nudity");
    return frame21(shuffleTail(parts).join(", "));
  }
  function shuffleTail(a) { return a.slice(0, 2).concat(shuffle(a.slice(2))); }
  function ensureIdea(api, ctx) {
    var idea = ((api.current.getIdea && api.current.getIdea()) || "").trim(), built = false;
    if (!idea && ctx && window.PMCtx) { idea = window.PMCtx.seed(ctx); built = true; api.current.setIdea && api.current.setIdea(idea); }
    return { idea: idea, built: built };
  }
  function saveWordsUI(words, api) {
    var cats = api.current.categories || [], picked = {}, inBank = {};
    cats.forEach(function (c) { (c.chips || []).forEach(function (x) { if (x && x.text) inBank[String(x.text).toLowerCase()] = 1; }); });
    words = (words || []).map(safe).filter(function (w) { return w && w.length < 80 && !inBank[w.toLowerCase()]; });
    if (!words.length) return null;
    var chips = words.map(function (w) { picked[w] = true; var b = h("button", { cls: "sm tab on", text: w, title: "click to leave this word out" }); b.addEventListener("click", function () { picked[w] = !picked[w]; b.className = "sm tab" + (picked[w] ? " on" : ""); }); return b; });
    var sel = h("select", {}, [h("option", { value: "__new", text: "➕ new category \"AI Words\"" })].concat(cats.map(function (c) { return h("option", { value: c.id, text: c.name }); })));
    var save = h("button", { cls: "go", text: "💾 Save words to Vocab Bank", on: { click: function () {
      var list = words.filter(function (w) { return picked[w]; }); if (!list.length) return toast(api, "No words selected");
      var id = sel.value;
      if (id === "__new") { var ex = (api.current.categories || []).filter(function (c) { return c.name.toLowerCase() === "ai words"; })[0]; id = ex ? ex.id : api.current.addCategory && api.current.addCategory("AI Words"); }
      if (!id || !api.current.massAdd) return toast(api, "Open the Vocab Bank once, then try again");
      setTimeout(function () { var n = api.current.massAdd(id, list.join("\n")); toast(api, "Saved to Vocab Bank", (n || list.length) + " new word" + (list.length === 1 ? "" : "s")); save.textContent = "✅ Saved"; save.disabled = true; }, 30);
    } } });
    return h("div", { cls: "item" }, [h("b", { text: "🧠 New words the AI invented for these selections:" }), h("div", { cls: "row" }, chips), h("div", { cls: "row" }, [sel, save])]);
  }

  P.remix = function (root, api) {
    var out = h("div"), st = h("span"), using = h("div", { cls: "muted" });
    var cnt = h("select", {}, [3, 5, 8].map(function (n) { return h("option", { value: n, text: n + " variations" }); }));
    function showUsing() { var c = ctxOf(api); using.textContent = c && window.PMCtx ? "Using: " + window.PMCtx.summary(c) : ""; return c; }
    var bClean = h("button", { text: "✨ AI Cleanup (empty box = builds a seed first)", title: "Tidies the seed idea box. If the box is empty it first builds a seed from your top selections + Vocab Bank, then cleans it.", on: { click: function () {
      var ctx = showUsing(), e = ensureIdea(api, ctx); if (!e.idea) return toast(api, "Type an idea first");
      var pack = ctx && window.PMCtx ? window.PMCtx.forAI(ctx, 8) : {};
      busy(bClean, true); call("cleanup", { text: e.idea, mode: tierMode(ctx, api), tier: pack.tier, context: pack.context, model: textModel() }).then(function (j) {
        busy(bClean, false); var loc = aiFailed(j) || !j.text, t = loc ? localCleanup(e.idea) : localCleanup(j.text);
        api.current.setIdea && api.current.setIdea(t); st.replaceChildren(badge(j, loc)); toast(api, e.built ? "Seed built from your settings + cleaned" : "Idea cleaned", t.slice(0, 90));
      });
    } } });
    var bVar = h("button", { cls: "go", text: "🎲 AI Remix (uses your settings + Vocab Bank)", title: "Writes fresh variations at your heat tier, style, platform, realism, mood and people, using the Vocab Bank words linked to those selections. Empty box is fine.", on: { click: function () {
      var ctx = showUsing(), e = ensureIdea(api, ctx); if (!e.idea) return toast(api, "Type an idea first");
      var n = +cnt.value, pack = ctx && window.PMCtx ? window.PMCtx.forAI(ctx, 14) : {};
      busy(bVar, true);
      call("remix", { idea: e.idea, count: n, mode: tierMode(ctx, api), tier: pack.tier, context: pack.context, words: pack.words, avoid: pack.avoid, invent: true, model: textModel() }, { timeout: 30000 }).then(function (j) {
        busy(bVar, false); var loc = aiFailed(j) || !(j.ideas && j.ideas.length);
        var list = loc ? Array.apply(null, Array(n)).map(function () { return ctxVariant(e.idea, ctx); }) : j.ideas.map(frame21);
        var notes = [];
        if (e.built) notes.push(h("div", { cls: "note", text: "Empty box → seed built from your settings + Vocab Bank: " + e.idea }));
        if (j && j.usage && j.usage.credit_note) notes.push(h("div", { cls: "note", text: j.usage.credit_note }));
        if (j && j._status === 402) notes.push(h("div", { cls: "note", text: "That paid model needs OpenRouter credit — switch the model back to Free (used the free fallback)." }));
        st.replaceChildren(badge(j, loc), ctx ? h("span", { cls: "badge", text: ctx.tierLabel }) : "");
        var sw = !loc && saveWordsUI(j.newWords, api);
        out.replaceChildren.apply(out, notes.concat(list.map(function (t) { return itemRow(t, api, [h("button", { cls: "sm", text: "Use as idea", on: { click: function () { api.current.setIdea && api.current.setIdea(t); toast(api, "Loaded as idea"); } } })]); })).concat(sw ? [sw] : []));
      });
    } } });
    root.append(h("h4", {}, ["✨ AI Remix (uses your settings + Vocab Bank)", st]),
      h("p", { cls: "sub", text: "No typing needed: leave the seed box empty and it builds a seed from your top selections (heat tier, style, platform, realism, mood, people) plus the Vocab Bank words linked to them. The AI only composes; the app picks which bank words fit. It can also invent new fitting words you can save with one click. Real cameras, varied lighting, raw skin, adults 21+." }),
      h("div", { cls: "row" }, [bVar, cnt, bClean, modelSelect()]), using, out);
    showUsing(); var iv = setInterval(function () { if (!root.isConnected) return clearInterval(iv); showUsing(); }, 2000);
  };

  P.expand = function (root, api) {
    var inp = h("input", { type: "text", placeholder: "seed word or short idea (e.g. dance, samurai, laundromat)" }), out = h("div"), st = h("span");
    var cnt = h("select", {}, [6, 10, 16].map(function (n) { return h("option", { value: n, text: n + " seeds" }); })); cnt.value = "10";
    var b = h("button", { cls: "go", text: "🌱 AI Expand", on: { click: function () {
      var s = inp.value.trim(); if (!s) return toast(api, "Type a seed first");
      var n = +cnt.value; busy(b, true);
      call("expand", { seeds: [s], count: n, mode: mode(api) }).then(function (j) {
        busy(b, false); var loc = aiFailed(j) || !(j.seeds && j.seeds.length), list = loc ? localExpand(s, n) : j.seeds.map(frame21);
        st.replaceChildren(badge(j, loc));
        out.replaceChildren.apply(out, [h("div", { cls: "row" }, [h("button", { cls: "sm", text: "Copy all", on: { click: function () { copy(list.join("\n"), api); } } })])].concat(list.map(function (t) { return itemRow(t, api); })));
      });
    } } });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") b.click(); });
    root.append(h("h4", {}, ["🌱 AI Seed Expander", st]), h("p", { cls: "sub", text: "One seed in, a list of grounded, shootable scene seeds out. Your seed words always stay in." }), h("div", { cls: "row" }, [inp, cnt, b]), out);
  };

  P.vocab = function (root, api) {
    var inp = h("input", { type: "text", placeholder: "new category, e.g. 90s streetwear, gas-station lighting, sneakers" }), out = h("div"), st = h("span");
    var cnt = h("select", {}, [12, 25, 40, 60].map(function (n) { return h("option", { value: n, text: n + " words" }); })); cnt.value = "25";
    function fill(catName, catId, have, btn) {
      busy(btn, true);
      return call("vocab", { category: catName, have: have || [], count: +cnt.value, mode: mode(api) }).then(function (j) {
        busy(btn, false); var loc = aiFailed(j) || !(j.items && j.items.length), items = (loc ? localVocab(catName) : j.items).map(safe).filter(Boolean);
        st.replaceChildren(badge(j, loc));
        if (!items.length) { out.replaceChildren(h("div", { cls: "note", text: "AI is offline and there is no built-in list for \"" + catName + "\" — the category is ready, paste words with Mass Add." })); return; }
        var added = api.current.massAdd ? api.current.massAdd(catId, items.join("\n")) : 0;
        if (api.current.select) api.current.select(catId);
        out.replaceChildren(h("div", { cls: "item" }, [h("b", { text: catName + ": " }), items.join(" · "), h("div", { cls: "muted", text: added + " new chip" + (added === 1 ? "" : "s") + " saved to your bank" })]));
        toast(api, "AI fill complete", added + " new chips in \"" + catName + "\"");
      });
    }
    var bAdd = h("button", { cls: "go", text: "➕ Add Category + AI fill", on: { click: function () {
      var name = safe(inp.value).trim(); if (!name) return toast(api, "Name the category first");
      var cats = api.current.categories || [], ex = cats.filter(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })[0];
      var id = ex ? ex.id : api.current.addCategory(name); inp.value = "";
      fill(name, id, ex ? ex.chips.map(function (c) { return c.text; }) : [], bAdd);
    } } });
    var bSel = h("button", { text: "✨ AI fill selected category", on: { click: function () {
      var c = api.current.current && api.current.current(); if (!c) return toast(api, "Pick a category first");
      fill(c.name, c.id, c.chips.map(function (x) { return x.text; }), bSel);
    } } });
    // ---- 🔗 link categories to the top selections (deterministic; optional one-time AI classify, cached) ----
    var linkBox = h("div"), linkSt = h("span");
    function renderLinks() {
      var cats = api.current.categories || [], C = window.PMCtx;
      if (!C) { linkBox.replaceChildren(h("div", { cls: "muted", text: "pm-context.js not loaded" })); return; }
      var ctx = C.read();
      var rows = cats.map(function (c) {
        var L = C.linkOf(c), auto = C.autoLink(c.name, (c.chips || []).slice(0, 8).map(function (x) { return x.text; })), ai = C.aiLinks()[String(c.name).toLowerCase()];
        var sel = h("select", {}, C.LINKS.map(function (x) { return h("option", { value: x[0], text: x[1] }); }));
        sel.value = c.linkTo || "auto";
        sel.addEventListener("change", function () { api.current.setCategoryMeta && api.current.setCategoryMeta(c.id, { linkTo: sel.value === "auto" ? undefined : sel.value }); setTimeout(renderLinks, 60); });
        var al = h("input", { type: "checkbox", title: "Always use this category, whatever the selections (heat-linked words still stay below their tier)" }); al.checked = !!c.always;
        al.addEventListener("change", function () { api.current.setCategoryMeta && api.current.setCategoryMeta(c.id, { always: al.checked }); setTimeout(renderLinks, 60); });
        var on = C.linkMatches(L.link, ctx) || c.always && !/^heat:/.test(L.link);
        if (L.link === "negative") on = false;
        return h("div", { cls: "row", style: "margin:3px 0;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:3px" }, [
          h("b", { text: c.name, style: "min-width:140px;font-size:12px" }), h("span", { cls: "muted", text: (c.chips || []).length + " words" }), sel,
          h("label", { cls: "muted" }, [al, " always use"]),
          h("span", { cls: "badge" + (on ? " ai" : ""), text: (L.link === "negative" ? "avoid list" : on ? "in play now" : "idle for these selections") }),
          h("span", { cls: "muted", text: "→ " + L.link + " (" + L.src + (L.src !== "auto" ? "; name guess: " + auto : "") + (ai && L.src !== "AI" ? "; AI said: " + ai.link : "") + ")" })]);
      });
      linkBox.replaceChildren.apply(linkBox, [h("div", { cls: "muted", text: "Now: " + C.summary(ctx) })].concat(rows));
    }
    var bClassify = h("button", { text: "🤖 AI classify my categories (one-time, cached)", title: "Asks the AI once to label every category (style / heat / platform / mood / realism / negative / general) from its name + sample words. Saved on this device; remixes never spend calls on it. Your own link choices always win.", on: { click: function () {
      var cats = (api.current.categories || []).filter(function (c) { return (c.chips || []).length || c.name; });
      if (!cats.length) return toast(api, "No categories yet");
      busy(bClassify, true, "Classifying…");
      call("classify", { categories: cats.slice(0, 60).map(function (c) { return { name: safe(c.name), sample: (c.chips || []).slice(0, 8).map(function (x) { return safe(x.text); }).filter(Boolean) }; }), model: textModel() }, { timeout: 45000 }).then(function (j) {
        busy(bClassify, false);
        var loc = aiFailed(j) || !(j.links && j.links.length);
        linkSt.replaceChildren(badge(j, loc));
        if (loc) { toast(api, "AI classify unavailable", "Using the built-in name matching (free)."); renderLinks(); return; }
        window.PMCtx && window.PMCtx.applyClassify(j.links); renderLinks();
        toast(api, "Categories classified", j.links.length + " labels cached on this device");
      });
    } } });
    var linkDet = h("details", { style: "margin-top:10px" }, [h("summary", { style: "cursor:pointer;font-weight:700;color:#67e8f9;font-size:12px" }, ["🔗 Link categories to your selections (style · heat · platform · mood · realism) ", linkSt]),
      h("p", { cls: "sub", text: "Auto links by name (e.g. \"Hip Hop Fits\" → Hip-hop style, \"Boudoir\" → NSFW+, \"Camera\" → Realism, \"Negative Drift\" → avoid list). Pick a link to override, tick \"always use\" for categories that fit everything. Random, Remix and the AI pull every linked word over time." }),
      h("div", { cls: "row" }, [bClassify, modelSelect(), h("button", { cls: "sm", text: "↻ Refresh", on: { click: renderLinks } })]), linkBox]);
    linkDet.addEventListener("toggle", function () { if (linkDet.open) renderLinks(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") bAdd.click(); });
    root.append(h("h4", {}, ["📚 AI Vocabulary Fill", st]), h("p", { cls: "sub", text: "Creates a category and fills it with specific, prompt-ready words — saved straight into your bank (duplicates skipped)." }), h("div", { cls: "row" }, [inp, cnt, bAdd, bSel]), out, linkDet);
  };

  P.dance = function (root, api) {
    var out = h("div"), st = h("span"), focus = h("input", { type: "text", placeholder: "optional focus: dance, transitions, rap video, Atlanta, Afrobeats…" });
    var b = h("button", { cls: "go", text: "🔥 Trending Now (AI)", on: { click: function () {
      busy(b, true, "Searching the web…");
      call("trending", { focus: focus.value, mode: mode(api) }, { timeout: 40000 }).then(function (j) {
        busy(b, false); var loc = aiFailed(j) || !(j.items && j.items.length), items;
        if (loc) items = shuffle(api.current.fallback || []).slice(0, 8).map(function (n) { return { name: n, how: "From your built-in scenario list (offline).", prompt: localVariant(n), when: "" }; });
        else items = j.items;
        st.replaceChildren(badge(j, loc), loc ? "" : h("span", { cls: "badge", text: j.live ? "live web search" : "model knowledge (web search off)" }));
        out.replaceChildren.apply(out, items.map(function (x) {
          var p = frame21(x.prompt || x.name);
          return h("div", { cls: "item" }, [h("b", { text: safe(x.name) }), x.when ? h("span", { cls: "muted", text: "  · " + safe(x.when) }) : "", h("div", { text: safe(x.how || "") }), h("div", { cls: "muted", text: p }),
            h("div", { cls: "row" }, [h("button", { cls: "sm", text: "Use", on: { click: function () { api.current.useScenario && api.current.useScenario(safe(x.name)); toast(api, "Scenario set", safe(x.name)); } } }),
              h("button", { cls: "sm", text: "Copy prompt", on: { click: function () { copy(p, api); } } })])]);
        }));
      });
    } } });
    root.append(h("h4", {}, ["🔥 Trending Now · AI", st]), h("div", { cls: "note", text: "AI-suggested from a live web search — trends move fast, so double-check before you post. Not an official TikTok list." }), h("div", { cls: "row" }, [focus, b]), out);
  };

  P.looplab = function (root, api) {
    var ta = h("textarea", { placeholder: "Describe the loop / beat — or press “Grab Loop Lab output” to pull the prompt built above." }), out = h("div"), st = h("span");
    function grab() {
      var q = function (s) { var e = document.querySelector('[data-pm="' + s + '"]'); return e ? (e.value || e.textContent || "").trim() : ""; };
      var t = [q("ll-positive"), q("ll-structure") && "structure: " + q("ll-structure"), q("ll-negative") && "avoid: " + q("ll-negative")].filter(Boolean).join("\n");
      if (t) ta.value = t; else toast(api, "Build a loop above first, or type one here");
    }
    function localLoop(t) {
      var bpm = (/(\d{2,3})\s*bpm/i.exec(t) || [])[1] || pick(["84", "92", "140", "98"]), key = (/\b([A-G](?:#|b)?\s?(?:minor|major|m|maj)?)\b(?=\s*(?:key|$|,))/.exec(t) || [])[1] || pick(["F minor", "C minor", "A minor", "G minor"]);
      return { genre: "", bpm: +bpm, key: key, instruments: [], style: safe(t).replace(/\n/g, ", ").replace(/,?\s*avoid:\s*[\u2014-]*\s*$/i, "").slice(0, 900), exclude: "vocals, artist names, muddy low end, clipping",
        structure: "[Intro] 4 bars\n[Loop A] 8 bars\n[Loop B] 8 bars\n[Break] 4 bars\n[Loop A] 8 bars\n[Outro] 4 bars",
        samples: ["4-bar main loop at " + bpm + " BPM, clean start on the downbeat, no vocals, mono sub", "8-bar variation with a filter sweep for chopping", "one-shot hits: kick, snare, top hit, tail-free"] };
    }
    var b = h("button", { cls: "go", text: "✨ AI Cleanup → Suno + sampler", on: { click: function () {
      if (!ta.value.trim()) grab(); var t = ta.value.trim(); if (!t) return;
      busy(b, true); call("looplab", { text: t, mode: mode(api) }).then(function (j) {
        busy(b, false); var loc = aiFailed(j) || !j.style, o = loc ? localLoop(t) : j;
        var os = String(o.style || ""), style = [o.genre, o.bpm && !/\d{2,3}\s*bpm/i.test(os) ? o.bpm + " BPM" : "", o.key && os.indexOf(o.key) < 0 ? "key of " + o.key : "", (o.instruments || []).join(", "), os].filter(Boolean).join(", ").slice(0, 1000);
        st.replaceChildren(badge(j, loc));
        var block = function (label, text) { return h("div", { cls: "item" }, [h("b", { text: label }), h("pre", { text: text }), h("button", { cls: "sm", text: "Copy", on: { click: function () { copy(text, api); } } })]); };
        out.replaceChildren(block("Suno · Style of Music", style), block("Suno · Exclude styles", o.exclude || ""), block("Suno · Structure (paste in Lyrics)", o.structure || ""),
          block("MPC / phone sample descriptions", (o.samples || []).map(function (s, i) { return (i + 1) + ". " + s; }).join("\n")));
      });
    } } });
    root.append(h("h4", {}, ["🎛 AI Cleanup · Suno + MPC", st]), h("p", { cls: "sub", text: "Turns the loop idea into a Suno-ready Style (genre · BPM · key · instruments), an Exclude line, a song structure, and sample-friendly loop descriptions for an MPC or phone sampler." }),
      ta, h("div", { cls: "row" }, [h("button", { text: "⤓ Grab Loop Lab output", on: { click: grab } }), b]), out);
  };

  // ----- AI Studio: chat + image + video -----
  var PROVS = null;
  function providers(api) {
    if (PROVS) return Promise.resolve(PROVS);
    return call("providers", { mode: mode(api) }, { timeout: 10000 }).then(function (j) { if (j && j.image) PROVS = j; return j; });
  }
  P.studio = function (root, api) {
    var st = h("span"), body = h("div"), tabs = {}, cur = "chat";
    function tab(k, label) { tabs[k] = h("button", { cls: "tab", text: label, "data-tab": k, on: { click: function () { show(k); } } }); return tabs[k]; }
    var panes = { chat: chatPane(api, st), image: mediaPane(api, "image", st), video: mediaPane(api, "video", st) };
    function show(k) { cur = k; for (var t in tabs) tabs[t].className = "tab" + (t === k ? " on" : ""); body.replaceChildren(panes[k].el); panes[k].show && panes[k].show(); }
    root.append(h("h4", {}, ["🤖 Grok AI Studio", st]), h("p", { cls: "sub", text: "Chat with AI to build prompts (free models by default; Gemini / GPT / Grok when there is credit), then generate images or video. Costs are shown before you click; a daily cap is enforced on the server." }),
      h("div", { cls: "row" }, [tab("chat", "💬 Chat"), tab("image", "🖼 Image"), tab("video", "🎬 Video")]), body);
    show("chat");
    root._pmShow = show;
  };
  function chatPane(api, st) {
    var log = h("div", { cls: "chat" }), msgs = [], ta = h("textarea", { placeholder: "Ask AI: “give me a gas-station-at-night prompt, 90s camcorder, Atlanta summer” …" });
    try { msgs = JSON.parse(sessionStorage.getItem("pmai.chat") || "[]") || []; } catch (e) {}
    function render() {
      log.replaceChildren.apply(log, msgs.map(function (m) {
        var kids = [h("div", { text: m.content })], f = m.role === "assistant" && /```(?:prompt)?\s*\n?([\s\S]*?)```/.exec(m.content);
        if (f) { var p = f[1].trim(); kids = [h("div", { text: m.content.replace(f[0], "").trim() }), h("pre", { text: p }), h("div", { cls: "row" }, [h("button", { cls: "sm", text: "Use in Studio", on: { click: function () { api.current.setPrompt && api.current.setPrompt(p); toast(api, "Prompt loaded into Studio"); } } }), h("button", { cls: "sm", text: "Copy", on: { click: function () { copy(p, api); } } })])]; }
        return h("div", { cls: "msg " + (m.role === "user" ? "u" : "a") }, kids);
      })); log.scrollTop = 1e6; try { sessionStorage.setItem("pmai.chat", JSON.stringify(msgs.slice(-20))); } catch (e) {}
    }
    function localReply(q) { var p = localVariant(q.replace(/^(give me|make|write)\s+(a|an)?\s*/i, "").replace(/\bprompt\b/i, "")); return "AI is offline, so here is a free local build from your words:\n```prompt\n" + p + "\n```"; }
    var MODELS = [["free", "Free (OpenRouter free models)", "$0 · free models, ~50 requests/day site-wide"], ["gemini", "Gemini 2.5 Flash Lite", "~$0.0002 per message · needs OpenRouter credit"], ["gpt", "GPT-6 Luna (OpenAI)", "~$0.0003 per message · needs OpenRouter credit"], ["grok", "Grok 4.20 (xAI)", "~$0.0015 per message · needs OpenRouter credit"]];
    var pick = h("select", { "data-pm": "ai-chat-model", title: "Chat model" }, MODELS.map(function (m) { return h("option", { value: m[0], text: m[1] }); })), pnote = h("span", { cls: "muted", "data-pm": "ai-chat-model-note" });
    try { var sv = localStorage.getItem("pmai.model"); if (sv && MODELS.some(function (m) { return m[0] === sv; })) pick.value = sv; } catch (e) {}
    function pnoteSync(extra) { var m = MODELS.filter(function (x) { return x[0] === pick.value; })[0]; pnote.textContent = (m ? m[2] : "") + (extra ? " · " + extra : ""); }
    pick.addEventListener("change", function () { try { localStorage.setItem("pmai.model", pick.value); } catch (e) {} pnoteSync(); });
    pnoteSync();
    var send = h("button", { cls: "go", text: "Send", on: { click: function () {
      var q = ta.value.trim(); if (!q) return; ta.value = ""; msgs.push({ role: "user", content: q }); render(); busy(send, true);
      var base = { messages: msgs.slice(-8), mode: mode(api), prompt: (api.current.getPrompt && api.current.getPrompt()) || "" };
      function done(j, note) {
        busy(send, false); var loc = aiFailed(j) || !j.reply;
        msgs.push({ role: "assistant", content: (note ? note + "\n\n" : "") + (loc ? localReply(q) : j.reply) }); st.replaceChildren(badge(j, loc)); render();
      }
      call("chat", Object.assign({ model: pick.value }, base)).then(function (j) {
        if (j && j.needs_credit && pick.value !== "free") { // paid model with $0 balance -> say so, answer with Free instead
          var lab = pick.options[pick.selectedIndex].text; pnoteSync("⚠ needs credit");
          return call("chat", Object.assign({ model: "free" }, base)).then(function (j2) { done(j2, "💳 " + lab + " needs OpenRouter credit (balance is $0) — answered with the Free model instead."); });
        }
        done(j);
      });
    } } });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } });
    render();
    return { el: h("div", {}, [log, ta, h("div", { cls: "row" }, [send, h("button", { cls: "sm", text: "Clear chat", on: { click: function () { msgs = []; render(); } } }), pick]), pnote]) };
  }
  function mediaPane(api, kind, st) {
    var ta = h("textarea", { placeholder: kind === "image" ? "Image prompt (adults 21+, no real / named people)" : "Video prompt — describe the motion, camera move and light" });
    var sel = h("select", { "data-pm": "ai-provider-" + kind }), ar = h("select", {}, ["9:16", "1:1", "16:9", "3:4"].map(function (a) { return h("option", { value: a, text: a }); }));
    var dur = h("select", {}, [5, 6, 10].map(function (d) { return h("option", { value: d, text: d + " s" }); })), res = h("select", {}, ["480p", "720p"].map(function (r) { return h("option", { value: r, text: r }); }));
    var cost = h("div", { cls: "muted" }), out = h("div", { cls: "media" }), list = [];
    function price(p) {
      if (!p) return "";
      if (kind === "image") return p.note;
      var m = { xai: { "480p": 0.02, "720p": 0.03 }, venice: { "720p": 0.128 }, venice_grok: { "480p": 0.024, "720p": 0.036 } }[p.id] || {}, r = m[res.value] || m[Object.keys(m)[0]] || 0;
      var d = p.id === "venice" ? (+dur.value > 7 ? 10 : 5) : +dur.value; return "≈ $" + (r * d).toFixed(2) + " for " + d + " s (" + p.note + ")";
    }
    function sync() {
      var p = list.filter(function (x) { return x.id === sel.value; })[0], caps = PROVS && PROVS.caps;
      cost.textContent = (p ? "Cost per call: " + price(p) + (p.ready ? "" : " · needs worker secret " + p.key) : "") + (caps ? " · daily cap $" + caps.day_usd + " site-wide, " + (kind === "image" ? caps.ip_images + " images" : caps.ip_videos + " videos") + " per visitor" : "");
    }
    function fill() {
      providers(api).then(function (j) {
        if (!j || !j[kind]) { sel.replaceChildren(h("option", { text: "AI offline — providers unavailable" })); cost.textContent = "AI is offline. Copy the prompt into Grok Imagine or any generator."; return; }
        list = j[kind]; var a = adult(api), keep = sel.value;
        sel.replaceChildren.apply(sel, list.map(function (p) {
          var lock = p.adult && !a, lab = p.label + (lock ? " — 🔒 18+ mode only" : p.ready ? "" : " — needs key " + p.key);
          return h("option", { value: p.id, text: lab, disabled: lock });
        }));
        var first = list.filter(function (p) { return !(p.adult && !a) && p.ready; })[0] || list.filter(function (p) { return !(p.adult && !a); })[0];
        sel.value = keep && list.some(function (p) { return p.id === keep && !(p.adult && !a); }) ? keep : first ? first.id : "";
        sync();
      });
    }
    [sel, dur, res].forEach(function (e) { e.addEventListener("change", sync); });
    function showErr(j) {
      var m = j.needs_key ? "Needs key: add the worker secret " + j.needs_key + " (wrangler secret put " + j.needs_key + ") to turn this provider on." :
        j.needs_credit ? "Needs credit: " + j.error : j.locked ? "🔒 " + j.error : j.refused ? "🛑 " + j.error : j.capped ? "⏸ Daily cap reached: " + j.error : j._offline ? "AI is offline — copy the prompt into Grok Imagine instead." : "Error: " + (j.error || "unknown") + (j.detail ? " " + j.detail : "");
      out.replaceChildren(h("div", { cls: "err", "data-pm": "ai-media-status", text: m }), h("div", { cls: "row" }, [h("button", { cls: "sm", text: "Copy prompt", on: { click: function () { copy(ta.value, api); } } })]));
    }
    var go = h("button", { cls: "go", text: kind === "image" ? "🖼 Generate image" : "🎬 Generate video", on: { click: function () {
      var p = ta.value.trim() || (api.current.getPrompt && api.current.getPrompt()) || ""; if (!p.trim()) return toast(api, "Type a prompt first"); ta.value = p;
      busy(go, true, kind === "image" ? "Generating…" : "Starting…");
      var body = { prompt: p, provider: sel.value, aspect: ar.value, mode: mode(api) }; if (kind === "video") { body.duration = +dur.value; body.resolution = res.value; }
      call(kind, body, { timeout: kind === "image" ? 90000 : 40000 }).then(function (j) {
        busy(go, false);
        if (!j || j._status !== 200) return showErr(j || {});
        var c = j.cost ? h("div", { cls: "muted", text: (j.cost.est_usd ? "Charged ≈ $" + Number(j.cost.est_usd).toFixed(3) : "Free · $0") + " · " + j.model + " · today $" + Number(j.cost.today_usd || 0).toFixed(2) + " of $" + j.cost.cap_usd + " cap" }) : "";
        if (kind === "image") { var wait = h("div", { cls: "muted", "data-pm": "ai-image-loading", text: j.cost && !j.cost.est_usd ? "Loading free image… (5–30 s)" : "Loading image…" });
          var im = h("img", { src: j.url, alt: "generated", "data-pm": "ai-image-result" }); im.addEventListener("load", function () { wait.remove(); }); im.addEventListener("error", function () { wait.textContent = "The image host didn't answer — click Generate again or copy the prompt."; });
          out.replaceChildren(wait, im, c, h("div", { cls: "row" }, [h("a", { href: j.url, download: "grok-studio.png", text: "Download", style: "color:#67e8f9;font-size:12px" })])); return; }
        var stat = h("div", { cls: "muted", text: "Rendering video… (usually 30–120 s)" }); out.replaceChildren(stat, c);
        var tries = 0; (function poll() {
          if (++tries > 60) { stat.textContent = "Still rendering — try again later."; return; }
          call("video_status", { provider: j.provider, job: j.job, download_url: j.download_url, mode: mode(api) }, { timeout: 60000 }).then(function (s) {
            if (s.status === "done" && s.url) { out.replaceChildren(h("video", { src: s.url, controls: true, autoplay: true, loop: true, muted: true, playsInline: true }), c); }
            else if (s.status === "failed") stat.textContent = "Video failed: " + (s.error || "unknown");
            else setTimeout(poll, 5000);
          });
        })();
      });
    } } });
    var row2 = kind === "video" ? [dur, res] : [];
    return { el: h("div", {}, [ta, h("div", { cls: "row" }, [h("button", { cls: "sm", text: "⤓ Use Studio prompt", on: { click: function () { ta.value = (api.current.getPrompt && api.current.getPrompt()) || ta.value; } } })]),
      h("div", { cls: "row" }, [sel, ar].concat(row2, [go])), cost, h("div", { cls: "muted", text: "Server guards: adults 21+ only · age / minor / family words stripped · refused if a minor is implied · no real or named person likeness. Uncensored providers unlock only in 18+ mode." }), out]),
      show: function () { if (!ta.value) ta.value = (api.current.getPrompt && api.current.getPrompt()) || ""; fill(); } };
  }

  // ---------- Unique Seeds (MJ Param Bank) ----------
  function uniqAI(prompt) {
    var p = prompt || window.__pmLastPrompt || "adult (21+) woman, candid photo";
    return call("seeds", { prompt: p, mode: window.__pmIsAdult ? "18+" : "sfw" }).then(function (j) {
      var loc = aiFailed(j) || !(j.details && j.details.length), d = (loc ? localDetails() : j.details).map(safe).filter(Boolean);
      window.__pmUniqDetails = d; return { details: d, local: loc, usage: j && j.usage };
    });
  }

  // ---------- mount ----------
  function mount(el, kind, api) {
    if (!el || !P[kind]) return; css(); el.replaceChildren();
    var root = h("div", { cls: "pmai", "data-pm": "ai-panel-" + kind }); el.appendChild(root);
    try { P[kind](root, api); } catch (e) { root.textContent = "AI panel failed to load: " + e.message; }
  }
  function unmount(el) { if (el) el.replaceChildren(); }
  window.PMBoost = { mount: mount, unmount: unmount, uniqAI: uniqAI, localDetails: localDetails, providers: function () { PROVS = null; } };
})();
