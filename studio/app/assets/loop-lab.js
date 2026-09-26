/* Zig Flames Prompt Machine — LOOP LAB (in-browser, no backend).
 * Positive + negative music prompts for sample loops and finishing sketches: Grok (Imagine audio), Suno, Generic.
 * All wording, order and presets live in ./assets/data/loop-lab.json so they can be tuned without code changes.
 */
(function () {
  "use strict";
  var V = "20260926a";
  var STORE = "pm.looplab.v1";
  var D = null, loading = null;
  var S = null, EL = null, API = null, R = {};

  // ---- helpers ------------------------------------------------------------------------
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
  function toast(t, d) { try { API.current.toast(t, d); } catch (e) {} }
  function copy(text, what) {
    var done = function () { toast(what || "Copied", ""); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fb); return; } } catch (e) {}
    fb();
    function fb() { var t = h("textarea", {}); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }
  // Seeded RNG so a given Remix roll is stable across re-renders (seed 0 = default wording).
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function newSeed() { var a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 4294967295) + 1; }
  function byId(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i]; return null; }
  function word(item, r) { var w = (item && item.words) || []; if (!w.length) return item ? item.label : ""; return S.seed ? w[Math.floor(r() * w.length)] : w[0]; }
  function uniq(a) { var s = {}; return a.filter(function (x) { var k = String(x).toLowerCase(); if (!x || s[k]) return false; s[k] = 1; return true; }); }
  function listJoin(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  // ---- state --------------------------------------------------------------------------------
  function blank() {
    return { target: "grok", mode: "loop", idea: "", genre: "", bpm: 90, key: "", scale: "minor", loopType: "melody", bars: 4,
      instruments: [], moods: [], textures: [], mix: [], negOff: [], negOn: [], negText: "", seed: 0, preset: null };
  }
  function applyPreset(p, keep) {
    var b = keep ? S : blank(), pk = p.picks || {};
    ["genre", "bpm", "key", "scale", "loopType", "bars"].forEach(function (k) { if (pk[k] != null) b[k] = pk[k]; });
    ["instruments", "moods", "textures", "mix"].forEach(function (k) { b[k] = (pk[k] || []).slice(); });
    b.preset = p.id; b.seed = 0; b.negOff = []; 
    return b;
  }
  function load() {
    var j = null; try { j = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) {}
    if (j && typeof j === "object") { S = Object.assign(blank(), j); return; }
    S = blank(); var p = D.presets[0]; if (p) { var t = S.target, m = S.mode; S = applyPreset(p); S.target = t; S.mode = m; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }

  // ---- idea: swap artist names for sound descriptions (Suno rejects artist names) ------------
  function cleanIdea(raw) {
    var t = String(raw || "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 300), swapped = [];
    var map = D.artistMap || {}, names = Object.keys(map).filter(function (k) { return k.charAt(0) !== "_"; }).sort(function (a, b) { return b.length - a.length; });
    names.forEach(function (n) {
      var re = new RegExp("(^|[^a-z0-9])(" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?:['\u2019]s)?(?=$|[^a-z0-9])", "gi");
      t = t.replace(re, function (m, pre, name) { swapped.push(name); return pre + (map[n] || ""); });
    });
    t = t.replace(/\b(in the style of|style of|like|type beat)\s*(?=,|$)/gi, "").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "");
    return { text: t, swapped: uniq(swapped) };
  }

  // ---- assembly -------------------------------------------------------------------------------
  var DRUM_IDS = ["percussion", "cowbell"], BASS_IDS = ["808", "bass-guitar", "upright-bass", "synth-bass"];
  function build() {
    var r = rng(S.seed || 1), T = D.targets[S.target] || D.targets.generic, sketch = S.mode === "sketch";
    var g = byId(D.genres, S.genre), lt = byId(D.loopTypes, S.loopType) || D.loopTypes[0];
    var idea = cleanIdea(S.idea), notes = [];
    if (idea.swapped.length) notes.push("Artist names swapped for sound descriptions (Suno rejects names): " + idea.swapped.join(", ") + ".");
    // instruments allowed by the loop type
    var ids = S.instruments.slice();
    if (!sketch) {
      if (lt.drumsOnly) ids = ids.filter(function (x) { return DRUM_IDS.indexOf(x) >= 0 || x === "808"; });
      else if (lt.bassOnly) { ids = ids.filter(function (x) { return BASS_IDS.indexOf(x) >= 0; }); if (!ids.length) ids = ["808"]; }
      else if (lt.noDrums) ids = ids.filter(function (x) { return DRUM_IDS.indexOf(x) < 0 && BASS_IDS.indexOf(x) < 0; });
      if (ids.length < S.instruments.length) notes.push(lt.label + ": skipped instrument picks that don't fit this loop type.");
    }
    // Remix: sometimes add one colour instrument from the genre that fits
    var color = null;
    if (S.seed && g && g.colors && r() < 0.6) {
      var ok = g.colors.filter(function (c) {
        if (ids.indexOf(c) >= 0 || !byId(D.instruments, c)) return false;
        if (sketch) return true;
        if (lt.drumsOnly) return DRUM_IDS.indexOf(c) >= 0; if (lt.bassOnly) return BASS_IDS.indexOf(c) >= 0;
        if (lt.noDrums) return DRUM_IDS.indexOf(c) < 0 && BASS_IDS.indexOf(c) < 0; return true;
      });
      if (ok.length) { color = ok[Math.floor(r() * ok.length)]; ids.push(color); }
    }
    var inst = ids.map(function (x) { return word(byId(D.instruments, x), r); }).filter(Boolean);
    if (S.seed && inst.length > 2) { var lead = inst.shift(); inst.sort(function () { return r() - 0.5; }); inst.unshift(lead); }
    var instrumental = sketch ? S.negOff.indexOf("vocals") < 0 : lt.instrumental !== false;
    var bpm = Math.max(40, Math.min(220, parseInt(S.bpm, 10) || 90));
    var slots = {
      idea: idea.text,
      loopType: sketch ? "" : (lt.oneShot ? word(lt, r) + ", each hit isolated" : S.bars + "-bar " + word(lt, r)),
      sketch: "finish my sketch into a full song",
      genre: g ? (function (gw) { return gw + (instrumental && !/instrumental/i.test(gw) ? " instrumental" : ""); })(word(g, r)) : (instrumental ? "instrumental" : ""),
      tempoKey: bpm + " BPM" + (S.key ? ", " + S.key + " " + S.scale : ""),
      instruments: inst.length ? inst[0] + " lead" + (inst.length > 1 ? ", with " + listJoin(inst.slice(1)) : "") : "",
      drums: g && (sketch || S.loopType === "full" || S.loopType === "drums") ? g.drums : "",
      mood: S.moods.length ? listJoin(S.moods) + " mood" : "",
      texture: S.textures.map(function (x) { return word(byId(D.textures, x), r); }).join(", "),
      mix: S.mix.map(function (x) { return word(byId(D.mixNotes, x), r); }).join(", "),
      loopRules: (lt.oneShot ? ["single isolated hits", "short clean tails", "tight to the tempo grid"] : D.loopRules).map(function (x) { return x.replace("{bars}", S.bars); })
        .filter(function (x) { return instrumental || x !== "instrumental"; }).join(", "),
      arrangement: D.arrangement.join(", "),
      sketchRules: D.sketchRules.join(", ")
    };
    var order = D.order[sketch ? "sketch" : "loop"] || [];
    var frags = order.map(function (k) { return slots[k] || ""; }).filter(Boolean);
    var leadName = inst[0] || "lead", colorName = color ? word(byId(D.instruments, color), rng(7)) : (inst[1] || "strings");
    var structure = sketch ? D.structure.map(function (s) { return "[" + s.tag + (s.hint ? ": " + s.hint.replace("{lead}", leadName).replace("{color}", colorName) : "") + "]"; }) : [];
    var positive = frags.join(", "), trimmedPos = false;
    if (S.target === "suno") {
      if (positive.length > T.positiveMax) { var cut = positive.slice(0, T.positiveMax); positive = cut.slice(0, Math.max(cut.lastIndexOf(","), 0)) || cut; trimmedPos = true; }
    } else if (S.target === "grok") {
      if (sketch) positive += ", structure: " + D.structure.map(function (s) { return s.tag.toLowerCase(); }).join(", ");
      positive = T.template.replace("{visual}", T.visual).replace("{positive}", positive);
    } else if (sketch) positive += "\nStructure: " + structure.join(" ");
    if (!frags.length) positive = "";
    // negatives
    var C = D.negatives.catalog, auto = sketch ? D.negatives.autoSketch.slice() : D.negatives.autoLoop.concat(lt.negatives || []);
    if (!sketch && lt.instrumental !== false) auto = auto.concat(D.negatives.autoInstrumental);
    if (sketch) auto = auto.concat(D.negatives.autoInstrumental);
    auto = uniq(auto).filter(function (x) { return C[x]; });
    var pri = D.negatives.priority, rank = function (x) { var i = pri.indexOf(x); return i < 0 ? 999 : i; };
    var on = auto.filter(function (x) { return S.negOff.indexOf(x) < 0; }).sort(function (a, b) { return rank(a) - rank(b); })
      .concat(S.negOn.filter(function (x) { return C[x] && auto.indexOf(x) < 0; }));
    var free = String(S.negText || "").split(/[,\n]+/).map(function (x) { return cleanIdea(x.replace(/^\s*(no|avoid)\s+/i, "")).text; }).filter(Boolean);
    var tags = uniq(on.map(function (x) { return C[x].tag; }).concat(free));
    var negative = tags.join(", "), trimmedNeg = 0;
    if (S.target === "suno" && negative.length > T.negativeMax) {
      var kept = []; tags.forEach(function (t) { var nx = kept.concat([t]).join(", "); if (nx.length <= T.negativeMax) kept.push(t); else trimmedNeg++; });
      negative = kept.join(", ");
    }
    if (S.target === "grok" && negative) negative = T.negativePrefix + negative + ".";
    if (trimmedPos) notes.push("Style trimmed to Suno's " + T.positiveMax + "-character limit.");
    if (trimmedNeg) notes.push(trimmedNeg + " lower-priority exclude tag" + (trimmedNeg > 1 ? "s" : "") + " dropped to fit Suno's " + T.negativeMax + "-character limit.");
    var secs = (S.bars * 4 * 60) / bpm;
    return { positive: positive, negative: negative, structure: structure.join("\n"), auto: auto, notes: notes, secs: secs, bpm: bpm, T: T, sketch: sketch, lt: lt };
  }

  // ---- UI -------------------------------------------------------------------------------------
  var CSS = "" +
    ".pll{--acc:var(--mode-accent,#7dd3fc);font-size:14px;color:#e2e8f0}.pll *{box-sizing:border-box}" +
    ".pll-card{border:1px solid rgba(255,255,255,.1);background:rgba(8,12,24,.55);border-radius:12px;padding:14px;backdrop-filter:blur(10px)}" +
    ".pll-k{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#64748b}" +
    ".pll-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.pll-sec{margin-top:12px}" +
    ".pll-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.pll-scroll{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}" +
    ".pll-chip{flex:0 0 auto;min-height:40px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#cbd5e1;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.04em;cursor:pointer;white-space:nowrap;touch-action:manipulation}" +
    ".pll-chip.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.13);box-shadow:0 0 12px rgba(125,211,252,.15)}" +
    ".pll-chip.neg.on{border-color:rgba(248,113,113,.6);background:rgba(248,113,113,.12)}.pll-chip .a{font-size:9px;opacity:.6;margin-left:5px}" +
    ".pll-btn{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e2e8f0;font-size:12.5px;font-weight:600;cursor:pointer;touch-action:manipulation}" +
    ".pll-btn:hover{background:rgba(255,255,255,.1)}.pll-btn.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.13)}" +
    ".pll-preset{min-height:48px;text-align:left}" +
    ".pll-in,.pll-sel{min-height:44px;font-size:16px;padding:9px 12px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;outline:none}" +
    ".pll-in:focus,.pll-sel:focus{border-color:var(--acc)}.pll-in{width:100%}.pll-sel option{background:#0b1020}" +
    ".pll-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}" +
    ".pll-out{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.55;color:#e2e8f0;background:rgba(0,0,0,.45);border:1px solid rgba(168,85,247,.3);border-radius:10px;padding:12px;margin-top:6px;min-height:52px}" +
    ".pll-out.neg{border-color:rgba(248,113,113,.35)}.pll-cnt{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#94a3b8}.pll-cnt.over{color:#f87171}" +
    ".pll-note{margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);color:#fde68a;font-size:12px}" +
    ".pll-hint{margin-top:4px;color:#94a3b8;font-size:12px;line-height:1.45}" +
    ".pll-remix{min-height:52px;flex:1 1 180px;border-radius:10px;border:0;font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:800;letter-spacing:.25em;color:#05070d;cursor:pointer;background:linear-gradient(90deg,var(--acc),#f1f5f9);box-shadow:0 0 22px rgba(125,211,252,.3);touch-action:manipulation}";

  function chipRow(list, isOn, onTap, opts) {
    opts = opts || {};
    var row = h("div", { cls: "pll-chips" + (opts.scroll ? " pll-scroll" : ""), "data-pm": opts.dp || null });
    list.forEach(function (it) {
      var id = typeof it === "object" ? it.id : it, label = typeof it === "object" ? it.label : String(it);
      row.appendChild(h("button", { cls: "pll-chip" + (opts.neg ? " neg" : "") + (isOn(id) ? " on" : ""), type: "button", "data-v": String(id), "aria-pressed": isOn(id) ? "true" : "false",
        on: { click: function () { onTap(id); } } }, [label, opts.autoMark && opts.autoMark(id) ? h("span", { cls: "a", text: "auto" }) : null]));
    });
    return row;
  }
  function toggleIn(arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
  function changed() { save(); renderControls(); renderOutput(); }

  function render() {
    if (!EL) return;
    EL.innerHTML = "";
    if (!document.getElementById("pll-css")) document.head.appendChild(h("style", { id: "pll-css", text: CSS }));
    var root = h("div", { cls: "pll", "data-pm": "loop-lab" });
    if (!D) { root.appendChild(h("div", { cls: "pll-card", text: "Loading Loop Lab…" })); EL.appendChild(root); return; }
    R.controls = h("div", { cls: "pll-card" });
    R.output = h("div", { cls: "pll-card", style: "margin-top:12px", "data-pm": "ll-output" });
    root.appendChild(R.controls); root.appendChild(R.output); EL.appendChild(root);
    renderControls(); renderOutput();
  }

  function renderControls() {
    var P = R.controls; if (!P) return;
    var sy = window.scrollY; P.innerHTML = "";
    var sketch = S.mode === "sketch";
    // target + mode
    var tr = h("div", { cls: "pll-row", "data-pm": "ll-target", role: "radiogroup", "aria-label": "Target" }, [h("span", { cls: "pll-k", text: "Target" })]);
    ["grok", "suno", "generic"].forEach(function (t) { tr.appendChild(h("button", { cls: "pll-btn" + (S.target === t ? " on" : ""), type: "button", role: "radio", "aria-checked": S.target === t ? "true" : "false", "data-target": t, text: D.targets[t].label, on: { click: function () { S.target = t; changed(); } } })); });
    tr.appendChild(h("span", { style: "width:14px" }));
    tr.appendChild(h("span", { cls: "pll-k", text: "Mode" }));
    [["loop", "Sample loop"], ["sketch", "Finish my sketch"]].forEach(function (m) { tr.appendChild(h("button", { cls: "pll-btn" + (S.mode === m[0] ? " on" : ""), type: "button", "data-mode": m[0], "aria-pressed": S.mode === m[0] ? "true" : "false", text: m[1], on: { click: function () { S.mode = m[0]; S.negOff = []; changed(); } } })); });
    P.appendChild(tr);
    // presets
    var pr = h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: "Presets" })]);
    var prow = h("div", { cls: "pll-chips", "data-pm": "ll-presets" });
    D.presets.forEach(function (p) {
      prow.appendChild(h("button", { cls: "pll-btn pll-preset" + (S.preset === p.id ? " on" : ""), type: "button", "data-preset": p.id, text: p.label, on: { click: function () {
        var keep = { target: S.target, mode: S.mode, idea: S.idea, negOn: S.negOn, negText: S.negText };
        S = Object.assign(applyPreset(p), keep); changed(); toast("Preset loaded", p.label);
      } } }));
    });
    pr.appendChild(prow); P.appendChild(pr);
    // idea
    var idea = h("input", { cls: "pll-in", type: "text", placeholder: sketch ? "Describe your sketch (e.g. slow piano motif in D minor, sad but hopeful)" : "Idea (goes first), e.g. haunting piano motif for a villain entrance",
      "aria-label": "Idea", "data-pm": "ll-idea", autocomplete: "off", enterkeyhint: "done", on: { input: function (e) { S.idea = e.target.value; save(); renderOutput(); } } });
    idea.value = S.idea;
    P.appendChild(h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: "Idea" }), h("div", { style: "margin-top:6px" }, [idea])]));
    // genre / bpm / key
    var gsel = h("select", { cls: "pll-sel", "data-pm": "ll-genre", "aria-label": "Genre", on: { change: function (e) { S.genre = e.target.value; var g = byId(D.genres, S.genre); if (g && !S.preset) S.bpm = g.bpm; S.preset = null; changed(); } } },
      [h("option", { value: "", text: "— genre —" })].concat(D.genres.map(function (g) { return h("option", { value: g.id, text: g.label }); })));
    gsel.value = S.genre;
    var bpm = h("input", { cls: "pll-sel", type: "number", min: "40", max: "220", step: "1", inputmode: "numeric", "data-pm": "ll-bpm", "aria-label": "BPM", style: "width:96px",
      on: { input: function (e) { S.bpm = e.target.value; save(); renderOutput(); }, change: function (e) { var n = parseInt(e.target.value, 10); S.bpm = isNaN(n) ? 90 : Math.max(40, Math.min(220, n)); S.preset = null; changed(); } } });
    bpm.value = S.bpm;
    var ksel = h("select", { cls: "pll-sel", "data-pm": "ll-key", "aria-label": "Key", on: { change: function (e) { S.key = e.target.value; S.preset = null; changed(); } } },
      [h("option", { value: "", text: "any key" })].concat(D.keys.map(function (k) { return h("option", { value: k, text: k }); })));
    ksel.value = S.key;
    var ssel = h("select", { cls: "pll-sel", "data-pm": "ll-scale", "aria-label": "Scale", on: { change: function (e) { S.scale = e.target.value; S.preset = null; changed(); } } }, D.scales.map(function (k) { return h("option", { value: k, text: k }); }));
    ssel.value = S.scale;
    var grid = h("div", { cls: "pll-grid pll-sec" }, [
      h("div", {}, [h("div", { cls: "pll-k", text: "Genre" }), h("div", { style: "margin-top:6px" }, [gsel])]),
      h("div", {}, [h("div", { cls: "pll-k", text: "Key & scale" }), h("div", { cls: "pll-row", style: "margin-top:6px" }, [ksel, ssel])]),
      h("div", {}, [h("div", { cls: "pll-k", text: "BPM" }), h("div", { cls: "pll-row", style: "margin-top:6px" }, [bpm])])
    ]);
    P.appendChild(grid);
    P.appendChild(chipRow(D.bpmPresets, function (v) { return String(S.bpm) === String(v); }, function (v) { S.bpm = v; S.preset = null; changed(); }, { scroll: true, dp: "ll-bpm-presets" }));
    if (!sketch) {
      P.appendChild(h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: "Loop type" }),
        chipRow(D.loopTypes, function (v) { return S.loopType === v; }, function (v) { S.loopType = v; S.negOff = []; S.preset = null; changed(); }, { dp: "ll-looptype" })]));
      P.appendChild(h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: "Loop length (bars)" }),
        chipRow(D.bars.map(function (b) { return { id: b, label: b + (b === 1 ? " bar" : " bars") }; }), function (v) { return Number(S.bars) === Number(v); }, function (v) { S.bars = Number(v); S.preset = null; changed(); }, { dp: "ll-bars" })]));
    }
    [["Instruments", "instruments", D.instruments, "ll-instruments"], ["Mood", "moods", D.moods, "ll-moods"], ["Texture / era", "textures", D.textures, "ll-textures"], ["Mix notes", "mix", D.mixNotes, "ll-mix"]].forEach(function (x) {
      P.appendChild(h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: x[0] }),
        chipRow(x[2], function (v) { return S[x[1]].indexOf(v) >= 0; }, function (v) { toggleIn(S[x[1]], v); S.preset = null; changed(); }, { dp: x[3] })]));
    });
    // negatives
    var b = build(), C = D.negatives.catalog;
    var negList = b.auto.concat(D.negatives.optional.filter(function (x) { return b.auto.indexOf(x) < 0; })).map(function (x) { return { id: x, label: C[x].label }; });
    P.appendChild(h("div", { cls: "pll-sec" }, [h("div", { cls: "pll-k", text: "Negatives (tap to toggle · auto = set by loop type / mode)" }),
      chipRow(negList, function (v) { return b.auto.indexOf(v) >= 0 ? S.negOff.indexOf(v) < 0 : S.negOn.indexOf(v) >= 0; },
        function (v) { if (b.auto.indexOf(v) >= 0) toggleIn(S.negOff, v); else toggleIn(S.negOn, v); changed(); }, { neg: true, dp: "ll-negs", autoMark: function (v) { return b.auto.indexOf(v) >= 0; } })]));
    var nt = h("input", { cls: "pll-in", type: "text", placeholder: "Extra negatives, comma separated (e.g. harpsichord, bright cymbals)", "aria-label": "Extra negatives", "data-pm": "ll-negtext", autocomplete: "off",
      on: { input: function (e) { S.negText = e.target.value; save(); renderOutput(); } } });
    nt.value = S.negText;
    P.appendChild(h("div", { style: "margin-top:8px" }, [nt]));
    if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
  }

  function box(label, text, counter, max, dp, neg) {
    var over = max && text.length > max;
    return h("div", { cls: "pll-sec" }, [
      h("div", { cls: "pll-row", style: "justify-content:space-between" }, [
        h("span", { cls: "pll-k", text: label }),
        h("div", { cls: "pll-row" }, [
          counter ? h("span", { cls: "pll-cnt" + (over ? " over" : ""), "data-pm": dp + "-count", text: text.length + (max ? " / " + max : "") + " chars" }) : null,
          h("button", { cls: "pll-btn", type: "button", "data-pm": dp + "-copy", text: "Copy", disabled: text ? null : true, on: { click: function () { copy(text, label + " copied"); } } })
        ])
      ]),
      h("div", { cls: "pll-out" + (neg ? " neg" : ""), "data-pm": dp, text: text || "—" })
    ]);
  }
  function renderOutput() {
    var P = R.output; if (!P) return;
    P.innerHTML = "";
    var b = build(), T = b.T;
    P.appendChild(h("div", { cls: "pll-row", style: "justify-content:space-between" }, [
      h("span", { cls: "pll-k", text: "Output · " + T.label + " · " + (b.sketch ? "finish my sketch" : "sample loop") }),
      h("span", { cls: "pll-cnt", "data-pm": "ll-duration", text: b.sketch ? b.bpm + " BPM" : (b.lt.oneShot ? "one-shots" : S.bars + " bars at " + b.bpm + " BPM \u2248 " + b.secs.toFixed(1) + " s") })
    ]));
    P.appendChild(h("div", { cls: "pll-hint", "data-pm": "ll-hint", text: b.sketch ? T.sketchHint : T.hint }));
    var notes = b.notes.slice();
    if (S.target === "grok" && !b.sketch && !b.lt.oneShot && T.maxClipSeconds && b.secs > T.maxClipSeconds) notes.push("This loop runs " + b.secs.toFixed(1) + " s; Grok Imagine clips top out around " + T.maxClipSeconds + " s. Pick fewer bars or a faster BPM.");
    notes.forEach(function (n) { P.appendChild(h("div", { cls: "pll-note", text: n })); });
    if (!b.positive) { P.appendChild(h("div", { cls: "pll-out", "data-pm": "ll-positive", text: "Pick a preset or set a genre / instruments / idea to build a prompt." })); }
    else P.appendChild(box("Positive · " + T.positiveLabel, b.positive, true, S.target === "suno" ? T.positiveMax : (S.target === "grok" ? T.positiveSoftMax : 0), "ll-positive"));
    if (b.sketch && S.target === "suno" && b.positive) P.appendChild(box("Structure · " + T.structureLabel, b.structure, true, 0, "ll-structure"));
    P.appendChild(box("Negative · " + T.negativeLabel, b.negative, true, S.target === "suno" ? T.negativeMax : 0, "ll-negative", true));
    if (S.target === "grok") P.appendChild(h("div", { cls: "pll-hint", text: "Grok has no separate negative field: paste the Avoid line at the end of the prompt. Positive wording (constant tempo, seamless loop) does most of the work." }));
    var both = function () {
      if (S.target === "suno") return "Style of Music:\n" + b.positive + (b.sketch ? "\n\nLyrics (structure):\n" + b.structure : "") + "\n\nExclude Styles:\n" + b.negative;
      if (S.target === "grok") return b.positive + (b.negative ? "\n" + b.negative : "");
      return "Prompt: " + b.positive + "\nNegative prompt: " + b.negative;
    };
    P.appendChild(h("div", { cls: "pll-row pll-sec" }, [
      h("button", { cls: "pll-remix", type: "button", "data-pm": "ll-remix", text: "REMIX", on: { click: function () { S.seed = newSeed(); save(); renderOutput(); toast("Remixed", "New wording and instrument roll"); } } }),
      h("button", { cls: "pll-btn", type: "button", "data-pm": "ll-copy-both", text: "Copy both", disabled: b.positive ? null : true, on: { click: function () { copy(both(), "Positive + negative copied"); } } }),
      h("button", { cls: "pll-btn", type: "button", "data-pm": "ll-clear", text: "Clear", on: { click: function () { var t = S.target, m = S.mode; S = blank(); S.target = t; S.mode = m; save(); renderControls(); renderOutput(); toast("Loop Lab cleared", ""); } } })
    ]));
  }

  window.PMLoopLab = {
    version: V,
    mount: function (el, apiRef) {
      EL = el; API = apiRef; render();
      if (!loading) loading = fetch("./assets/data/loop-lab.json?v=" + V).then(function (r) { if (!r.ok) throw new Error("loop-lab " + r.status); return r.json(); }).then(function (j) { D = j; });
      loading.then(function () { if (EL !== el) return; if (!S) load(); render(); }).catch(function (e) {
        if (EL === el) el.innerHTML = '<div class="pll-card" style="color:#fca5a5">Could not load Loop Lab (' + String(e.message || e) + "). Refresh to retry.</div>";
      });
    },
    unmount: function (el) { if (EL === el) EL = null; },
    // test hooks
    _build: function () { return D && S ? build() : null; },
    _state: function () { return S; }
  };
})();
