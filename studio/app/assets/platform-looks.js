/* Zig Flames Prompt Machine — PLATFORM LOOKS (in-browser, no backend).
 * Data: ./assets/data/looks.json + ./assets/data/variety.json
 * Safety (in code): every prompt includes "adult 21+"; blocklisted words are stripped
 * from the idea box (with a notice) and from every assembled prompt. Params always last.
 */
(function () {
  "use strict";
  var V = "20260925d";
  var STORE = "pm.looks.v1";
  var FALLBACK_P = 0.25; // variety.json rule: fall back to shared pools on a 25% chance

  // ---- Safety -----------------------------------------------------------------
  var BLOCK_RE = /\b(teen(?:age|ager|agers|s)?|step-[a-z]+|step(?:sis|sister|sisters|mom|moms|mother|dad|father|bro|brother|daughter|son|family|kid|kids)\b|schoolgirls?|barely[\s-]+legal|loli(?:ta|con)?|under[\s-]?age|underaged|minors?|child(?:ren|ish)?|kids?|young\s+girls?)\b/gi;
  function hasBlocked(t) { BLOCK_RE.lastIndex = 0; var r = BLOCK_RE.test(String(t || "")); BLOCK_RE.lastIndex = 0; return r; }
  function stripBlocked(t) {
    var found = [];
    var out = String(t || "").replace(BLOCK_RE, function (m) { found.push(m); return " "; });
    out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/^[\s,;.-]+|[\s,;-]+$/g, "");
    return { text: out, removed: found };
  }
  // Drop any comma fragment that still contains a blocked word (belt and braces).
  function scrubList(text) {
    return String(text || "").split(/,\s*/).filter(function (f) { return f && !hasBlocked(f); }).join(", ");
  }
  function scrubProse(text) { return stripBlocked(text).text; }
  function reuseBannedMinor(idea) {
    try {
      if (window.PMHashtags && typeof window.PMHashtags.checkSafety === "function") window.PMHashtags.checkSafety(idea, true);
      return null;
    } catch (e) { return e && e.message ? e.message : "Adults 21+ only."; }
  }

  // ---- Random -------------------------------------------------------------------
  function rnd() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  function seed32() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
  // pick() avoids anything in the recent history for that slot, so back-to-back rolls stay fresh.
  function pick(arr, avoid) {
    if (!arr || !arr.length) return "";
    var bad = Array.isArray(avoid) ? avoid : (avoid ? [avoid] : []);
    var pool = arr.filter(function (x) { return bad.indexOf(x) < 0; });
    if (!pool.length) pool = arr;
    return pool[Math.floor(rnd() * pool.length)];
  }
  var HIST = {};
  function remember(k, v) { var a = HIST[k] || (HIST[k] = []); a.push(v); if (a.length > 4) a.shift(); }
  function fill(tpl, o) { return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }

  // ---- State ----------------------------------------------------------------------
  var S = { looks: null, variety: null, loading: null, el: null, api: null, q: "", group: "All", sel: null, idea: "", groupScene: false, tab: "mj", result: null, last: {}, notice: "" };
  function load() {
    try { var j = JSON.parse(localStorage.getItem(STORE) || "{}"); ["group", "sel", "idea", "groupScene", "tab", "result"].forEach(function (k) { if (j[k] !== undefined) S[k] = j[k]; }); } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ group: S.group, sel: S.sel, idea: S.idea, groupScene: S.groupScene, tab: S.tab, result: S.result })); } catch (e) {}
  }
  function isAdult() { try { return !!(S.api && S.api.current && S.api.current.isAdult); } catch (e) { return false; } }
  function lookById(id) { return (S.looks || []).find(function (l) { return l.id === id; }) || null; }
  function displayLabel(l) {
    // Never show blocklisted words in the UI either (e.g. the RK sub-site brand name).
    if (!hasBlocked(l.label)) return l.label;
    return l.id === "teens-love-huge-cocks" ? "Reality Kings Sub-site (RK craft)" : scrubProse(l.label) || l.id;
  }
  function fetchData() {
    if (S.loading) return S.loading;
    S.loading = Promise.all([
      fetch("./assets/data/looks.json?v=" + V).then(function (r) { if (!r.ok) throw new Error("looks " + r.status); return r.json(); }),
      fetch("./assets/data/variety.json?v=" + V).then(function (r) { if (!r.ok) throw new Error("variety " + r.status); return r.json(); })
    ]).then(function (a) { S.looks = a[0]; S.variety = a[1]; });
    return S.loading;
  }

  // ---- Assembly (follows variety.json assemblyOrder exactly) ----------------------------
  function roll(look) {
    var P = S.variety.pools, L = HIST, r = {};
    r.venue = (look.venues && look.venues.length && rnd() >= FALLBACK_P) ? pick(look.venues, L.venue) : pick(P.venueEvent, L.venue);
    r.wardrobe = (look.wardrobeHints && look.wardrobeHints.length && rnd() >= FALLBACK_P) ? pick(look.wardrobeHints, L.wardrobe) : pick(P.wardrobe, L.wardrobe);
    ["skinTone", "heritageRegion", "faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "complexionDetail", "distinctiveFeature",
      "hairColor", "hairStyle", "hairTexture", "build", "heightFeel", "makeupLevel", "nails", "tattoosPiercings"].forEach(function (k) { r[k] = pick(P[k], L[k]); });
    // ageBand: adult bands only (all 21+); refuse anything that isn't.
    var bands = (P.ageBand || []).filter(function (b) { var n = parseInt(b, 10); return n >= 21; });
    r.ageBand = pick(bands.length ? bands : ["26-32"], L.ageBand);
    Object.keys(r).forEach(function (k) { remember(k, r[k]); });
    if (r.tattoosPiercings === "none") r.tattoosPiercings = "no tattoos or piercings";
    S.last = r;
    return r;
  }
  function realism(look) {
    var b = String(look.realismBlock || "");
    if (S.groupScene) {
      b = b.replace(/one (woman|character) per frame( unless the group toggle is on)?/gi, "group scene, every person a distinct adult 21+ with a unique face");
      if (!/group scene/i.test(b)) b += ", group scene, every person a distinct adult 21+ with a unique face";
    } else {
      b = b.replace(/one (woman|character|person) per frame unless the group toggle is on/gi, "one $1 per frame");
      if (!/one (woman|character|person) per frame/i.test(b)) b += ", one woman per frame";
    }
    return b.replace(/\s*unless the group toggle is on/gi, "");
  }
  function suffixOf(look, seed) {
    var suf = String((look.mj && look.mj.suffix) || "").trim();
    suf = suf.replace(/\s--(tile|repeat|r)\b(\s+\d+)?/gi, "").replace(/\s--seed\s+\d+/gi, "");
    // scrub the --no list too
    suf = suf.replace(/--no\s+(.*)$/i, function (_, list) { return "--no " + scrubList(list); });
    return suf + " --seed " + seed;
  }
  function assembleMJ(look, idea, r, seed) {
    var V2 = S.variety.slotTemplates;
    var head = String(look.mjPrompt || "");
    head = idea ? head.replace("{idea}", idea) : head.replace(/^\{idea\},?\s*/, "").replace("{idea}", "");
    var heritage = fill(V2.heritageFace, r);
    if (S.groupScene) heritage = "lead woman: " + heritage;
    var parts = [
      head,                                   // mjPrompt({idea})
      fill(V2.venue, r),                      // venue
      heritage,                               // heritage/skin + unique face + face picks
      fill(V2.body, r),                       // hair + build + heightFeel + ageBand
      fill(V2.styling, r),                    // wardrobe + makeup + nails + tattoos
      "adult 21+",                            // always, in code
      realism(look)                           // realismBlock
    ];
    var body = scrubList(parts.join(", ").replace(/\s+/g, " ").replace(/,\s*,/g, ","));
    if (!/adult 21\+/.test(body)) body += ", adult 21+";
    return body + " " + suffixOf(look, seed);  // suffix (last) + --seed
  }
  function assembleVideo(look, idea, r) {
    var V2 = S.variety.slotTemplates;
    var t = String(look.promptTemplate || "");
    t = idea ? t.replace("{idea}", idea) : t.replace(/^\{idea\}\s*[—-]\s*/, "").replace("{idea}", "");
    var lead = (S.groupScene ? "Group scene; lead woman: " : "One woman per frame: ") + fill(V2.heritageFace, r) + "; " + fill(V2.body, r) + ".";
    var out = t + " Setting: " + fill(V2.venue, r) + ". " + lead + " Styling: " + fill(V2.styling, r) + ". " +
      "Aspect " + look.aspect + ", clip length " + look.clipLength + ", motion " + ((look.mj && look.mj.motion) || "low") + ". adult 21+.";
    out = scrubProse(out);
    if (!/adult 21\+/.test(out)) out += " adult 21+.";
    return out;
  }
  function bankFor(look, seed) {
    var mj = look.mj || {}, no = "";
    var m = String(mj.suffix || "").match(/--no\s+(.*)$/i); if (m) no = "--no " + scrubList(m[1]);
    return {
      ar: mj.ar ? "--ar " + mj.ar : "", v: mj.model || "", stylize: mj.stylize != null ? "--stylize " + mj.stylize : "",
      chaos: mj.chaos != null ? "--chaos " + mj.chaos : "", weird: mj.weird ? "--weird " + mj.weird : "", q: mj.quality || "",
      style: mj.styleRaw ? "--style raw" : "", seed: "--seed " + seed, no: no, repeat: "", tile: false, realism: false
    };
  }
  function applyBank(bank) {
    try {
      var cur = {}; try { cur = JSON.parse(localStorage.getItem("pm.mj.v1") || "{}") || {}; } catch (e) {}
      var merged = Object.assign({}, cur, bank);
      localStorage.setItem("pm.mj.v1", JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("pm:mj-apply", { detail: bank }));
    } catch (e) {}
  }

  // ---- UI ---------------------------------------------------------------------------
  var CSS = "" +
    ".pml{--acc:var(--mode-accent,#7dd3fc);font-size:14px;color:#e2e8f0}" +
    ".pml *{box-sizing:border-box}" +
    ".pml-card{border:1px solid rgba(255,255,255,.1);background:rgba(8,12,24,.55);border-radius:12px;padding:14px;backdrop-filter:blur(10px)}" +
    ".pml-k{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#64748b}" +
    ".pml-search{width:100%;min-height:44px;font-size:16px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;outline:none}" +
    ".pml-search:focus,.pml-in:focus{border-color:var(--acc)}" +
    ".pml-chips{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px 0 4px;scrollbar-width:thin}" +
    ".pml-chip{flex:0 0 auto;min-height:36px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#cbd5e1;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;cursor:pointer;white-space:nowrap}" +
    ".pml-chip.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.12);box-shadow:0 0 12px rgba(125,211,252,.15)}" +
    ".pml-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;max-height:min(46vh,420px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px 2px 6px 0;margin-top:8px}" +
    ".pml-look{position:relative;min-height:48px;text-align:left;padding:9px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#e2e8f0;font-size:12.5px;line-height:1.25;cursor:pointer;touch-action:manipulation}" +
    ".pml-look:hover{background:rgba(255,255,255,.07)}" +
    ".pml-look.on{border-color:var(--acc);background:rgba(125,211,252,.13);box-shadow:0 0 18px rgba(125,211,252,.18);color:#fff}" +
    ".pml-look[disabled]{opacity:.45;cursor:not-allowed}" +
    ".pml-g{display:block;font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.12em;color:#64748b;margin-top:3px;text-transform:uppercase}" +
    ".pml-tag{display:inline-block;margin-left:6px;padding:1px 5px;border-radius:4px;font-family:ui-monospace,Menlo,monospace;font-size:9px;letter-spacing:.1em;border:1px solid rgba(244,114,182,.5);color:#f9a8d4;vertical-align:1px}" +
    ".pml-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#fbbf24;margin-left:6px;vertical-align:1px;box-shadow:0 0 6px rgba(251,191,36,.6)}" +
    ".pml-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
    ".pml-param{font-family:ui-monospace,Menlo,monospace;font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.4);color:#a5f3fc}" +
    ".pml-in{flex:1 1 240px;min-height:44px;font-size:16px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;outline:none}" +
    ".pml-btn{min-height:40px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation}" +
    ".pml-btn:hover{background:rgba(255,255,255,.1)}" +
    ".pml-tab.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.12)}" +
    ".pml-remix{width:100%;min-height:54px;border-radius:10px;border:0;font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:800;letter-spacing:.3em;color:#05070d;cursor:pointer;background:linear-gradient(90deg,var(--acc),#f1f5f9);box-shadow:0 0 26px rgba(125,211,252,.35);touch-action:manipulation}" +
    ".pml-remix[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none}" +
    ".pml-out{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.55;color:#e2e8f0;background:rgba(0,0,0,.45);border:1px solid rgba(168,85,247,.3);border-radius:10px;padding:12px;margin-top:8px}" +
    ".pml-note{margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);color:#fde68a;font-size:12px}" +
    ".pml-toggle{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);cursor:pointer;font-size:12px;color:#cbd5e1}" +
    ".pml-toggle.on{border-color:var(--acc);color:#fff}" +
    ".pml-sw{width:30px;height:16px;border-radius:9px;background:rgba(255,255,255,.15);position:relative}" +
    ".pml-sw:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#94a3b8;transition:left .15s}" +
    ".pml-toggle.on .pml-sw{background:var(--acc)}.pml-toggle.on .pml-sw:after{left:16px;background:#05070d}" +
    ".pml-htag{font-family:ui-monospace,Menlo,monospace;font-size:11px;padding:3px 7px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#e2e8f0}";

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === "on") Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === "text") e.textContent = v;
      else if (k === "cls") e.className = v;
      else e.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function copy(text, what) {
    var done = function () { toast((what || "Copied") + "", ""); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); return; } } catch (e) {}
    fallback();
    function fallback() { var t = h("textarea", {}); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }
  function toast(t, d) { try { S.api.current.toast(t, d); } catch (e) {} }

  var R = {}; // element refs
  function render() {
    var el = S.el; if (!el) return;
    el.innerHTML = "";
    if (!document.getElementById("pml-css")) document.head.appendChild(h("style", { id: "pml-css", text: CSS }));
    var root = h("div", { cls: "pml", "data-pm": "platform-looks" });
    if (!S.looks) { root.appendChild(h("div", { cls: "pml-card", text: "Loading 120 platform looks…" })); el.appendChild(root); return; }

    // Search + chips + grid
    var top = h("div", { cls: "pml-card" });
    R.search = h("input", { cls: "pml-search", type: "search", placeholder: "Search looks (e.g. vix, gonzo, magazine)…", "aria-label": "Search looks", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search", "data-pm": "looks-search", on: { input: function (e) { S.q = e.target.value; renderGrid(); } } });
    R.search.value = S.q;
    top.appendChild(R.search);
    R.chips = h("div", { cls: "pml-chips", role: "tablist" });
    top.appendChild(R.chips);
    R.grid = h("div", { cls: "pml-grid", "data-pm": "looks-grid" });
    top.appendChild(R.grid);
    R.count = h("div", { cls: "pml-k", style: "margin-top:6px" });
    top.appendChild(R.count);
    root.appendChild(top);

    R.panel = h("div", { cls: "pml-card", style: "margin-top:12px" });
    root.appendChild(R.panel);
    el.appendChild(root);
    renderChips(); renderGrid(); renderPanel();
  }
  function groups() {
    var seen = [], out = ["All"];
    S.looks.forEach(function (l) { if (seen.indexOf(l.group) < 0) seen.push(l.group); });
    return out.concat(seen);
  }
  function renderChips() {
    R.chips.innerHTML = "";
    groups().forEach(function (g) {
      R.chips.appendChild(h("button", { cls: "pml-chip" + (S.group === g ? " on" : ""), type: "button", "data-group": g, text: g, on: { click: function () { S.group = g; save(); renderChips(); renderGrid(); } } }));
    });
  }
  function matches(l) {
    if (S.group !== "All" && l.group !== S.group) return false;
    var q = S.q.trim().toLowerCase(); if (!q) return true;
    return (displayLabel(l) + " " + l.id + " " + l.group + " " + (l.styleName || "") + " " + (l.realismTier || "")).toLowerCase().indexOf(q) >= 0;
  }
  function renderGrid() {
    var adult = isAdult(), n = 0;
    R.grid.innerHTML = "";
    S.looks.forEach(function (l) {
      if (!matches(l)) return; n++;
      var locked = l.adult && !adult;
      var b = h("button", {
        cls: "pml-look" + (S.sel === l.id ? " on" : ""), type: "button", "data-look": l.id, disabled: locked ? true : null,
        title: locked ? "18+ look — switch the machine to NSFW or XXX mode to unlock" : (l.craftOnly ? "style only" : l.summary),
        on: { click: function () { if (locked) return; S.sel = l.id; S.result = null; save(); renderGrid(); renderPanel(); } }
      }, [
        locked ? "🔒 " : null, displayLabel(l),
        l.adult ? h("span", { cls: "pml-tag", text: "18+" }) : null,
        l.craftOnly ? h("span", { cls: "pml-dot", title: "style only", "aria-label": "style only" }) : null,
        h("span", { cls: "pml-g", text: l.group + " · " + l.realismTier })
      ]);
      R.grid.appendChild(b);
    });
    R.count.textContent = n + " look" + (n === 1 ? "" : "s") + (adult ? "" : " · 18+ looks locked until NSFW / XXX mode is on");
  }
  function renderPanel() {
    var P = R.panel; P.innerHTML = "";
    var l = lookById(S.sel);
    if (l && l.adult && !isAdult()) { S.sel = null; l = null; }
    if (!l) { P.appendChild(h("div", { cls: "pml-k", text: "Tap a look to load it" })); return; }
    var mj = l.mj || {};
    P.appendChild(h("div", { cls: "pml-row", style: "justify-content:space-between" }, [
      h("div", {}, [
        h("div", { style: "font-size:18px;font-weight:700;color:#f8fafc", "data-pm": "look-title", text: displayLabel(l) }),
        h("div", { cls: "pml-k", style: "margin-top:2px", text: l.group + " · " + l.realismTier + (l.craftOnly ? " · style only" : "") + (l.adult ? " · 18+" : "") })
      ])
    ]));
    P.appendChild(h("p", { style: "margin:8px 0 10px;color:#94a3b8;font-size:13px;line-height:1.45", text: l.summary }));
    var params = h("div", { cls: "pml-row", "data-pm": "look-params" }, [h("span", { cls: "pml-k", text: "MJ settings" })]);
    [["ar", mj.ar ? "--ar " + mj.ar : ""], ["v", mj.model], ["stylize", "--stylize " + mj.stylize], ["chaos", "--chaos " + mj.chaos],
      ["weird", mj.weird ? "--weird " + mj.weird : ""], ["style", mj.styleRaw ? "--style raw" : ""], ["q", mj.quality]].forEach(function (p) { if (p[1]) params.appendChild(h("span", { cls: "pml-param", text: p[1] })); });
    P.appendChild(params);

    // Idea + group toggle + tabs
    R.idea = h("input", { cls: "pml-in", type: "text", placeholder: "Idea (e.g. twerk)", "aria-label": "Idea", "data-pm": "look-idea", autocomplete: "off", enterkeyhint: "go", on: {
      input: function (e) { S.idea = e.target.value; save(); },
      keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); doRemix(); } }
    } });
    R.idea.value = S.idea;
    var tog = h("button", { cls: "pml-toggle" + (S.groupScene ? " on" : ""), type: "button", "data-pm": "look-group", "aria-pressed": S.groupScene ? "true" : "false", on: { click: function () { S.groupScene = !S.groupScene; save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Group scene"]);
    P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px" }, [R.idea, tog]));
    var tabs = h("div", { cls: "pml-row", style: "margin-top:10px" });
    [["mj", "Midjourney image"], ["video", "Video prompt"]].forEach(function (t) {
      tabs.appendChild(h("button", { cls: "pml-btn pml-tab" + (S.tab === t[0] ? " on" : ""), type: "button", "data-tab": t[0], text: t[1], on: { click: function () { S.tab = t[0]; S.result = null; save(); renderPanel(); } } }));
    });
    P.appendChild(tabs);
    R.note = h("div", { cls: "pml-note", "data-pm": "look-notice", style: S.notice ? "" : "display:none", text: S.notice });
    P.appendChild(R.note);
    P.appendChild(h("button", { cls: "pml-remix", type: "button", "data-pm": "look-remix", style: "margin-top:12px", text: S.result ? "REMIX AGAIN" : "REMIX", on: { click: doRemix } }));

    if (S.result) {
      var res = S.result;
      P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px;justify-content:space-between" }, [
        h("span", { cls: "pml-k", text: (res.tab === "video" ? "Video prompt" : "Midjourney prompt") + " · written to Prompt Output" }),
        h("div", { cls: "pml-row" }, [
          h("button", { cls: "pml-btn", type: "button", "data-pm": "look-copy", text: "Copy", on: { click: function () { copy(res.text, "Prompt copied"); } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "look-again", text: "Remix again", on: { click: doRemix } }),
          h("button", { cls: "pml-btn", type: "button", text: "Open in Prompt Output", on: { click: function () { try { S.api.current.go("output"); } catch (e) {} } } })
        ])
      ]));
      P.appendChild(h("div", { cls: "pml-out", "data-pm": "look-result", text: res.text }));
      if (res.tags && res.tags.length) {
        var tr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-tags" }, [h("span", { cls: "pml-k", text: "Hashtags" })]);
        res.tags.forEach(function (t) { tr.appendChild(h("span", { cls: "pml-htag", text: t })); });
        tr.appendChild(h("button", { cls: "pml-btn", type: "button", text: "Copy tags", on: { click: function () { copy(res.tags.join(" "), "Hashtags copied"); } } }));
        P.appendChild(tr);
      }
    }
  }
  function setNotice(msg) { S.notice = msg || ""; if (R.note) { R.note.textContent = S.notice; R.note.style.display = S.notice ? "" : "none"; } }

  function doRemix() {
    var l = lookById(S.sel); if (!l) return;
    if (l.adult && !isAdult()) { setNotice("This look is 18+. Switch the machine to NSFW or XXX mode to use it."); return; }
    var raw = R.idea ? R.idea.value : S.idea;
    var cleaned = stripBlocked(raw);
    var idea = cleaned.text.slice(0, 200);
    var msg = "";
    if (cleaned.removed.length) msg = "Adults 21+ only — removed: " + cleaned.removed.join(", ") + ".";
    var banned = reuseBannedMinor(idea);
    if (banned) { setNotice("Adults 21+ only. " + banned); return; }
    S.idea = idea; if (R.idea) R.idea.value = idea;
    var r = roll(l), seed = seed32(), text, tags = [];
    if (S.tab === "video") text = assembleVideo(l, idea, r);
    else text = assembleMJ(l, idea, r, seed);
    var ht = l.hashtags || {};
    tags = (ht.safe || []).slice();
    if (isAdult()) (ht.nsfw || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
    tags = tags.filter(function (t) { return !hasBlocked(t); });
    S.result = { text: text, tab: S.tab, look: l.id, seed: S.tab === "video" ? null : seed, roll: r, tags: tags };
    save();
    try { S.api.current.setPrompt(text); } catch (e) {}
    if (S.tab !== "video") applyBank(bankFor(l, seed));
    S.notice = msg;
    renderPanel();
    toast(S.tab === "video" ? "Video prompt remixed" : "Look remixed", displayLabel(l) + " · " + r.skinTone + " " + r.heritageRegion + " · written to Prompt Output");
  }

  function onClearAll() { S.result = null; S.notice = ""; save(); if (S.el) renderPanel(); }

  window.PMLooks = {
    version: V,
    mount: function (el, apiRef) {
      S.el = el; S.api = apiRef; load();
      render();
      fetchData().then(function () { if (S.el === el) render(); }).catch(function (e) {
        if (S.el === el) el.innerHTML = '<div class="pml-card" style="color:#fca5a5">Could not load platform looks (' + String(e.message || e) + '). Refresh to retry.</div>';
      });
    },
    unmount: function (el) { if (S.el === el) { S.el = null; } },
    setAdult: function () { if (S.el && S.looks) { renderGrid(); renderPanel(); } },
    // exposed for tests
    _assembleMJ: function (id, idea, group) { var l = lookById(id); S.groupScene = !!group; var r = roll(l); return assembleMJ(l, stripBlocked(idea).text, r, seed32()); },
    _strip: stripBlocked
  };
  window.addEventListener("pm:clear-all", onClearAll);
})();
