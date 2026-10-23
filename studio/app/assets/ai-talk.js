/* ZigFlames Prompt Machine - "Talk to it" assistant (text + mic + Make it) and My Words bank.
   Loaded on demand by platform-looks.js and mounted into its top card.
   The AI (if connected) only PICKS existing buttons and a short idea; prompt text always comes
   from the machine's own banks. Adults 21+ only; SFW gating and age-word stripping are enforced
   here and again inside PMLooks.ai.apply/make, whatever the AI returns. */
(function () {
  "use strict";
  // Set this to your Cloudflare Worker URL after deploying /ai-worker (e.g. "https://zigflames-ai.<you>.workers.dev").
  // Empty = "AI not connected yet": the free local keyword matcher is used instead.
  var AI_ENDPOINT = "";
  function endpoint() {
    try { if (typeof window.PM_AI_ENDPOINT === "string") return window.PM_AI_ENDPOINT; } catch (e) {}
    try { var o = localStorage.getItem("pm_ai_endpoint"); if (o) return o; } catch (e) {}   // dev/test override
    return AI_ENDPOINT;
  }
  var CSS = ".pmai-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
    ".pmai-title{font-size:15px;font-weight:700;color:#f8fafc}" +
    ".pmai-badge{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.15);color:#cbd5e1}" +
    ".pmai-badge.on{border-color:rgba(52,211,153,.6);color:#6ee7b7}.pmai-badge.off{border-color:rgba(251,191,36,.5);color:#fcd34d}" +
    ".pmai-mic{min-width:44px;font-size:18px}.pmai-mic.rec{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.7)}" +
    ".pmai-make{background:linear-gradient(90deg,#f97316,#ef4444);border-color:transparent;color:#fff;font-size:14px;min-height:44px;padding:8px 18px}" +
    ".pmai-status{margin-top:8px;font-size:12px;color:#94a3b8;line-height:1.5;white-space:pre-line}" +
    ".pmai-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:12px;color:#e2e8f0}" +
    ".pmai-chip button{background:none;border:0;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px}" +
    ".pmai-words{margin-top:10px}.pmai-words summary{cursor:pointer;color:#cbd5e1;font-size:13px;font-weight:600}";
  var state = { text: "", busy: false, rec: null };

  // ---------- My Words bank ----------
  function wKey(api) { return (api && api.myWordsKey) || "pm_mywords_v1"; }
  function getWords(api) { try { var a = JSON.parse(localStorage.getItem(wKey(api)) || "[]"); return Array.isArray(a) ? a.filter(function (w) { return typeof w === "string" && w.trim(); }) : []; } catch (e) { return []; } }
  function setWords(api, a) {
    var seen = {}, out = [];
    a.forEach(function (w) { w = String(w || "").replace(/\s+/g, " ").trim().slice(0, 60); var k = w.toLowerCase(); if (w && !seen[k]) { seen[k] = 1; out.push(w); } });
    try { localStorage.setItem(wKey(api), JSON.stringify(out.slice(0, 200))); } catch (e) {}
    return out;
  }
  function mixOn(api) { try { return localStorage.getItem(api.myMixKey || "pm_mywords_mix_v1") !== "0"; } catch (e) { return true; } }
  function setMix(api, on) { try { localStorage.setItem(api.myMixKey || "pm_mywords_mix_v1", on ? "1" : "0"); } catch (e) {} }

  // ---------- Local keyword matcher (free fallback) ----------
  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  var NEON_ALIAS = { blue: "electric blue", pink: "hot pink", red: "blood red", green: "emerald green", yellow: "gold", lime: "lime green", uv: "UV blacklight", blacklight: "UV blacklight", orange: "orange", purple: "purple", violet: "violet", cyan: "cyan", teal: "teal", magenta: "magenta", gold: "gold", amber: "amber", crimson: "crimson" };
  var STYLE_KW = { club: /\bclub\b/, contest: /\bnigerian(?:\s+contest)?\b/, carib: /\bcaribbean(?:\s+contest)?\b/, sync: /\bsouth\s+indian(?:\s+sync)?\b/, ny: /\b(?:ny|new\s+york)\s+twerk\b/, duo: /\bnoir\s+duo\b/,
    rural: /\brural(?:\s+ebony)?\b/, tryouts: /\b(?:model\s+)?tryouts?\b|\bcasting\b/, sabaddie: /\b(?:south\s+african\s+)?baddie\s+walk\b/, roomwalk: /\broom\s+walk(?:\s+loop)?\b/ };
  var GENERIC = /^(look|style|studio|video|videos|porn|films?|film|media|the|club|creator|aesthetic|premium|content|magazine|editorial|glamour|plus|network|series|cinematic|tv|com|pro|hd|4k|girl|new|real|reality|art|clips?|amateur|polished|thumbnail|gold|red|drama)$/;
  var AGE_WORDS = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|underage\w*|minors?|barely[\s-]+legal|school\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?|baby[\s-]?fac\w*|childlike|kids?|child\w*)\b/gi;
  function esc(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function norm(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function localMatch(text, O) {
    var orig = " " + String(text || "").replace(/[’]/g, "'") + " ", low = orig.toLowerCase();
    var t = low, set = {}, sw = {}, adult = O.mode === "18+";
    function take(re, fn) { var m = t.match(re); if (!m) return false; var r = fn(m); if (r !== false) t = t.replace(re, " , "); return true; }
    // mode / age words never go into the idea
    t = t.replace(/\b(?:18|21)\s*\+|\bnsfw\b|\bsfw\b|\badults?\s+only\b/g, " , ");
    // heat (18+ only, ignored otherwise)
    take(/\b(?:xxx|hardcore|explicit)\b/, function () { if (adult) set.heat = "xxx"; });
    take(/\bspicy\b/, function () { if (adult && !set.heat) set.heat = "spicy"; });
    take(/\b(?:tease|teasing|flirty)\b/, function () { if (adult && !set.heat) set.heat = "tease"; });
    take(/\breal\s+porn(?:\s+look)?\b/, function () { if (adult) sw.realPorn = true; });
    take(/\bno\s+ai(?:\s+look)?\b/, function () { sw.noAi = true; });
    // neon
    var pal = (O.neonPick || []).slice().sort(function (a, b) { return b.length - a.length; });
    var gotNeon = false;
    pal.forEach(function (c) { if (gotNeon) return; var e = esc(c.toLowerCase());
      gotNeon = take(new RegExp("\\b" + e + "\\s+neon\\b|\\bneon\\s+" + e + "\\b"), function () { set.neonPick = c; }); });
    if (!gotNeon) gotNeon = take(/\b(blue|pink|red|green|yellow|lime|uv|blacklight|orange|purple|violet|cyan|teal|magenta|gold|amber|crimson)\s+neon\b|\bneon\s+(blue|pink|red|green|yellow|lime|uv|orange|purple|violet|cyan|teal|magenta|gold|amber|crimson)\b/,
      function (m) { set.neonPick = NEON_ALIAS[m[1] || m[2]]; });
    if (!gotNeon) gotNeon = take(/\b(?:brand|zigflames)\s+neon\b/, function () { set.neon = "brand"; });
    if (!gotNeon) take(/\bneon\b/, function () { set.neon = "rotate"; });
    // room
    take(/\bmessy(?:\s+room)?\b/, function () { set.room = "messy"; });
    take(/\b(?:clean|tidy|neat)\s+room\b/, function () { set.room = "clean"; });
    // people + cast
    take(/\b(?:woman|women|girls?)\s+(?:and|with|\+)\s+(?:a\s+)?(?:man|guy|dude)\b|\bwith\s+(?:a\s+)?(?:man|guy|boyfriend)\b|\bcouple\b/, function () { set.castMix = "mixed"; set.people = 2; });
    take(/\b([1-8]|one|two|three|four|five|six|seven|eight)\s+(?:girls|women|ladies|models|people|adults|friends|baddies)\b/, function (m) { set.people = NUM[m[1]] || parseInt(m[1], 10); });
    take(/\b(?:solo|alone|by\s+herself)\b/, function () { set.people = 1; });
    take(/\b(?:duo|pair)\b/, function () { if (!set.people) set.people = 2; });
    take(/\b(?:squad|crew|girl\s+gang)\b/, function () { if (!set.people) set.people = 3; });
    // faces / eyes
    take(/\bnew\s+(?:girl|woman|face|model|chick)\b|\b(?:fresh|unique|different)\s+faces?\b/, function () { sw.uniqueFaces = true; });
    take(/\b(hazel|green|blue|gray|grey)\s+eyes\b/, function (m) { set.eye = m[1] === "grey" ? "gray" : m[1]; });
    take(/\bheterochromia\b|\btwo[\s-]+colou?red\s+eyes\b/, function () { set.eye = "hetero"; });
    // output + camera (selfie stays in the idea)
    take(/\b(?:video|clip|reel|animate[ds]?)\b/, function () { set.tab = "video"; });
    take(/\b(?:photo|picture|pic|image|still|midjourney|mj)\b/, function () { if (!set.tab) set.tab = "mj"; });
    take(/\b(?:shot\s+on\s+(?:an?\s+)?)?iphone\b|\bphone\s+camera\b/, function () { set.cam = "iphone"; });
    if (/\bselfie\b/.test(t)) set.cam = "iphone";
    // switches that are also scene words: set, keep in the idea
    if (/\bcrowd\b/.test(t)) sw.crowd = true;
    if (/\btwerk\w*\b/.test(t)) sw.twerk = true;
    take(/\bperfect\s+anatomy\b/, function () { sw.anatomy = true; });
    // style
    (O.style || []).forEach(function (c) { if (set.style || !STYLE_KW[c[0]]) return; take(STYLE_KW[c[0]], function () { set.style = c[0]; }); });
    // look: full label / id match beats a single distinctive word
    var best = null, bestScore = 0, flat = norm(t);
    (O.look || []).forEach(function (c) {
      var id = c[0], lb = String(c[1] || ""), sc = 0, nl = norm(lb.replace(/\(.*?\)/g, "")), ni = norm(id);
      if (nl.length >= 4 && flat.indexOf(nl) >= 0) sc = 100 + nl.length;
      else if (ni.length >= 4 && flat.indexOf(ni) >= 0) sc = 90 + ni.length;
      else { var w = lb.toLowerCase().split(/[^a-z0-9+.]+/).filter(function (x) { return x.length >= 4 && !GENERIC.test(x); })[0];
        if (w && new RegExp("\\b" + esc(w) + "\\b").test(t)) sc = w.length; }
      if (sc > bestScore) { bestScore = sc; best = c; }
    });
    if (best) {
      set.look = best[0];
      var words = String(best[1]).toLowerCase().split(/[^a-z0-9+.]+/).filter(function (x) { return x.length >= 3; });
      words.concat([best[0].replace(/-/g, " ")]).forEach(function (w) { t = t.replace(new RegExp("\\b" + esc(w) + "('s)?\\b", "g"), " "); });
      t = t.replace(/\b(?:look|style)\b/g, " ");
    }
    if (Object.keys(sw).length) set.switches = sw;
    // whatever is left is the idea
    var idea = t.split(/[,;\n]+|\s+\band\b\s+(?=[a-z])/).map(function (seg) {
      return seg.replace(/^\s*(?:(?:please|make|me|give|i\s+want|i'd\s+like|can\s+you|create|do|a|an|the|with|and|in|of|some)\b\s*)+/g, "")
        .replace(/\s+(?:please|look|style|vibe|vibes)\s*$/g, "").replace(/\s{2,}/g, " ").trim();
    }).filter(function (seg) { return seg.length > 2 && /[a-z]/.test(seg); })
      .map(function (seg) { var i = low.indexOf(seg); return i >= 0 ? orig.slice(i, i + seg.length) : seg; }) // keep the user's capitals
      .map(function (seg) { return seg.replace(AGE_WORDS, " ").replace(/\s{2,}/g, " ").trim(); }).filter(function (seg) { return seg.length > 2; });
    return { settings: set, idea: idea.join(", "), extra_words: [] };
  }

  // ---------- AI call ----------
  function callAI(url, payload) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || typeof j !== "object") throw new Error("bad JSON");
        return { settings: j.settings && typeof j.settings === "object" && !Array.isArray(j.settings) ? j.settings : {},
          idea: typeof j.idea === "string" ? j.idea : "",
          extra_words: Array.isArray(j.extra_words) ? j.extra_words.filter(function (w) { return typeof w === "string"; }).slice(0, 6) : [] };
      })
      .finally(function () { clearTimeout(timer); });
  }
  function summarize(api, res, idea) {
    var a = res.applied || {}, O = api.options(), parts = [];
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (k === "look") { var l = (O.look || []).filter(function (c) { return c[0] === v; })[0]; v = l ? l[1] : v; }
      if (typeof v === "boolean") v = v ? "on" : "off";
      parts.push(k + ": " + v);
    });
    return (parts.length ? "Set " + parts.join(" · ") : "No buttons changed") + (idea ? "\nIdea: " + idea : "");
  }

  // ---------- UI ----------
  function mount(box, api) {
    if (!box || !api) return;
    var sh = window.PMLooks && window.PMLooks.shared, h = sh && sh.h;
    if (!h) return;
    if (!document.getElementById("pmai-css")) { var st = document.createElement("style"); st.id = "pmai-css"; st.textContent = CSS; document.head.appendChild(st); }
    box.innerHTML = "";
    var url = endpoint();
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var input = h("input", { cls: "pml-in", type: "text", "data-pm": "ai-text", "aria-label": "Tell the machine what you want", autocomplete: "off", enterkeyhint: "go",
      placeholder: "Say or type it: McDonald's uniform, rooftop at night, blue neon, new girl, 18+ spicy",
      on: { input: function (e) { state.text = e.target.value; }, keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); make(); } } } });
    input.value = state.text;
    var status = h("div", { cls: "pmai-status", "data-pm": "ai-status", role: "status", "aria-live": "polite",
      text: url ? "" : "AI not connected yet \u2014 Make it uses the quick keyword matcher (free, on this device)." });
    function say(t) { status.textContent = t; }
    var mic = h("button", { cls: "pml-btn pmai-mic", type: "button", "data-pm": "ai-mic", "aria-label": SR ? "Speak" : "Voice not supported in this browser",
      title: SR ? "Tap and speak" : "Voice input isn't supported in this browser \u2014 type instead", text: "\uD83C\uDFA4", disabled: SR ? null : true,
      on: { click: function () {
        if (!SR) { say("Voice input isn't supported in this browser \u2014 type instead."); return; }
        if (state.rec) { try { state.rec.stop(); } catch (e) {} return; }
        var rec; try { rec = new SR(); } catch (e) { say("Mic unavailable \u2014 type instead."); return; }
        rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        var base = input.value ? input.value.replace(/[,\s]+$/, "") + ", " : "";
        rec.onresult = function (ev) { var t = ""; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; input.value = base + t.trim(); state.text = input.value; };
        rec.onerror = function (ev) { say(ev && ev.error === "not-allowed" ? "Mic permission denied \u2014 allow the mic or type instead." : "Didn't catch that \u2014 try again or type it."); };
        rec.onend = function () { state.rec = null; mic.classList.remove("rec"); mic.setAttribute("aria-pressed", "false"); };
        state.rec = rec; mic.classList.add("rec"); mic.setAttribute("aria-pressed", "true"); say("Listening\u2026 speak now.");
        try { rec.start(); } catch (e) { state.rec = null; mic.classList.remove("rec"); say("Mic unavailable \u2014 type instead."); }
      } } });
    var makeBtn = h("button", { cls: "pml-btn pmai-make", type: "button", "data-pm": "ai-make", text: "Make it", on: { click: function () { make(); } } });

    function make() {
      if (state.busy) return;
      var raw = String(input.value || "").trim();
      if (!raw) { say("Type or say what you want first."); input.focus(); return; }
      if (!api.ready()) { say("Looks are still loading \u2014 try again in a second."); return; }
      var adult = api.isAdult(), notes = [];
      // 21+ floor on the way in: drop age/teen words before anything sees the text.
      var stripped = raw.match(AGE_WORDS);
      var clean = raw.replace(AGE_WORDS, " ");
      if (stripped) notes.push("Adults 21+ only \u2014 removed: " + stripped.join(", ") + ".");
      if (!adult && /\b(?:18\s*\+|nsfw|xxx|spicy|explicit|nude|naked|porn\w*|onlyfans|tease)\b/i.test(clean)) notes.push("18+ words ignored \u2014 switch the machine to NSFW or XXX mode to use them.");
      var O = api.options(), words = getWords(api).map(function (w) { return api.safe(w); }).filter(Boolean).slice(0, 40);
      var payload = { text: clean.slice(0, 400), mode: O.mode, settings: api.current(), options: O, my_words: words, v: (window.PMLooks && window.PMLooks.version) || "" };
      state.busy = true; makeBtn.disabled = true; makeBtn.textContent = url ? "Thinking\u2026" : "Making\u2026";
      var p = url ? callAI(url, payload).then(function (r) { r.source = "ai"; return r; }).catch(function (e) {
        notes.push("AI unavailable (" + (e && e.message || "error") + ") \u2014 used the quick matcher.");
        var r = localMatch(clean, O); r.source = "local"; return r; })
        : Promise.resolve().then(function () { var r = localMatch(clean, O); r.source = "local"; return r; });
      p.then(function (r) {
        var res = api.apply(r.settings || {});
        var ideaParts = [api.safe(r.idea || "", adult, 140)].concat((r.extra_words || []).slice(0, 3).map(function (w) { return api.safe(w, adult, 40); }))
          .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        // The Neon control only recolors neon a look already has; when the user asked for a colour, make sure it shows up.
        if (res.applied && res.applied.neonPick && !/\bneon\b/i.test(ideaParts.join(" "))) ideaParts.push(res.applied.neonPick + " neon glow");
        var idea = api.safe(ideaParts.join(", "), adult, 180);
        var out = api.make(idea);
        var cur = api.current();
        var head = r.source === "ai" ? "AI picked the buttons." : (url ? "" : "AI not connected yet \u2014 used the quick keyword matcher.");
        var ign = (res.ignored || []).length ? "\nIgnored (not on this machine / not allowed): " + res.ignored.join(", ") : "";
        say([head, summarize(api, res, cur.idea)].filter(Boolean).join("\n") + ign + (notes.length ? "\n" + notes.join("\n") : "") + (out ? "" : "\nPick a look first, then Make it."));
        window.dispatchEvent(new CustomEvent("pm:ai-made", { detail: { source: r.source, raw: r, applied: res.applied, ignored: res.ignored, idea: cur.idea, prompt: out } }));
      }).catch(function (e) { say("Something went wrong: " + (e && e.message || e)); })
        .then(function () { state.busy = false; makeBtn.disabled = false; makeBtn.textContent = "Make it"; });
    }

    // My Words
    var chips = h("div", { cls: "pmai-row", "data-pm": "mywords-list", style: "margin-top:8px" });
    var wIn = h("input", { cls: "pml-in", type: "text", "data-pm": "mywords-input", placeholder: "Add your own word or phrase (e.g. glossy lip oil)", "aria-label": "Add a word", autocomplete: "off",
      on: { keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); addWord(); } } } });
    function drawWords() {
      var a = getWords(api); chips.innerHTML = "";
      if (!a.length) chips.appendChild(h("span", { cls: "pml-k", text: "No words yet. Your words get mixed into prompts and sent to the AI as preferred vocabulary." }));
      a.forEach(function (w, i) {
        chips.appendChild(h("span", { cls: "pmai-chip", "data-myword": w }, [w, h("button", { type: "button", "aria-label": "Remove " + w, text: "\u00d7",
          on: { click: function () { var b = getWords(api); b.splice(i, 1); setWords(api, b); drawWords(); } } })]));
      });
      sum.textContent = "My Words (" + a.length + ")";
    }
    function addWord() {
      var raw = String(wIn.value || ""), parts = raw.split(/[,\n]+/), added = [], dropped = [];
      parts.forEach(function (p) { var c = api.safe(p, true, 60); if (c) added.push(c); else if (p.trim()) dropped.push(p.trim()); });
      if (added.length) setWords(api, getWords(api).concat(added));
      wIn.value = ""; drawWords();
      say(added.length ? "Added: " + added.join(", ") + (dropped.length ? "\nNot allowed (adults 21+ only): " + dropped.join(", ") : "") : (dropped.length ? "Not allowed (adults 21+ only): " + dropped.join(", ") : ""));
    }
    var file = h("input", { type: "file", accept: "application/json,.json", style: "display:none", "data-pm": "mywords-file",
      on: { change: function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try { var j = JSON.parse(String(rd.result || "")); var arr = Array.isArray(j) ? j : (j && Array.isArray(j.words) ? j.words : null);
            if (!arr) throw new Error("expected {\"words\":[...]} or [...]");
            var ok = arr.filter(function (w) { return typeof w === "string"; }).map(function (w) { return api.safe(w, true, 60); }).filter(Boolean);
            setWords(api, getWords(api).concat(ok)); drawWords(); say("Imported " + ok.length + " word" + (ok.length === 1 ? "" : "s") + ".");
          } catch (err) { say("Import failed: " + err.message); }
          file.value = "";
        };
        rd.readAsText(f);
      } } });
    var mixBtn = h("button", { cls: "pml-toggle pml-skin" + (mixOn(api) ? " on" : ""), type: "button", "data-pm": "mywords-mix-toggle", "aria-pressed": mixOn(api) ? "true" : "false",
      title: "Mix one of your words into each remix", on: { click: function () { var on = !mixOn(api); setMix(api, on); mixBtn.classList.toggle("on", on); mixBtn.setAttribute("aria-pressed", on ? "true" : "false"); } } },
      [h("span", { cls: "pml-sw" }), "Mix my words in"]);
    var sum = h("summary", { text: "My Words" });
    var det = h("details", { cls: "pmai-words", "data-pm": "mywords" }, [sum,
      h("div", { cls: "pmai-row", style: "margin-top:8px" }, [wIn, h("button", { cls: "pml-btn", type: "button", "data-pm": "mywords-add", text: "Add", on: { click: addWord } })]),
      chips,
      h("div", { cls: "pmai-row", style: "margin-top:8px" }, [mixBtn,
        h("button", { cls: "pml-btn", type: "button", "data-pm": "mywords-export", text: "Export JSON", on: { click: function () {
          var blob = new Blob([JSON.stringify({ app: "zigflames-prompt-machine", type: "my-words", v: 1, words: getWords(api) }, null, 2)], { type: "application/json" });
          var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "zigflames-my-words.json"; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        } } }),
        h("button", { cls: "pml-btn", type: "button", "data-pm": "mywords-import", text: "Import JSON", on: { click: function () { file.click(); } } }), file])
    ]);

    box.appendChild(h("div", { cls: "pmai-row", style: "justify-content:space-between" }, [
      h("div", { cls: "pmai-title", text: "Talk to it" }),
      h("span", { cls: "pmai-badge " + (url ? "on" : "off"), "data-pm": "ai-badge", text: url ? "AI connected" : "AI not connected yet" })]));
    box.appendChild(h("div", { cls: "pmai-row", style: "margin-top:8px" }, [input, mic, makeBtn]));
    box.appendChild(status);
    box.appendChild(det);
    drawWords();
  }

  window.PMAITalk = { mount: mount, localMatch: localMatch, endpoint: endpoint, version: "20261023a" };
})();
