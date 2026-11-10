/* Zig's Prompt Machine — Fashion Editorial · T-Shirt Studio (v20261110b)
   Universal clothing-artwork workstation. Works for every Prompt Machine user (nothing is tied to one account).
   Flow: Create / Import artwork -> Send to T-Shirt Studio -> Customize -> Preview on a shirt -> Prepare DTF -> Export.
   - Artwork arrives from anywhere (window.PMTee.send in pm-tee-bridge.js), file upload / drag-drop / paste, the on-device
     artwork library, saved designs, or Grok Imagine (through the site worker). The ORIGINAL file is stored untouched;
     edits (background removal, AI variations) create new copies, "Reset to original" always works.
   - Vocabulary: reads and writes the ONE existing Vocabulary Bank (React context passed in api.current.vocab) — no copy.
   - Two separate outputs: T-Shirt Mockup PNG (art on a garment) and DTF Artwork PNG (isolated art only, transparent,
     exact inches x PPI pixels, 300 PPI pHYs metadata). "Print-ready" only when every check of the chosen preset passes.
   - Fit & print quality (v20261110b): Crop to Fill (free), AI Extend (Grok outpaint, ~$0.02), AI Upscale (ESRGAN on the device, free;
     honest "Smooth enlarge (not AI)" fallback that never counts as real detail), Smart Fit, and a live PPI readout.
   Adults 21+ only in any AI prompt; no real-person likeness (enforced again by the worker). */
(function () {
  "use strict";
  var V = "20261110b";
  var DEF_EP = "https://zigflames-ai.zigflames.workers.dev";
  function endpoint() { try { var o = localStorage.getItem("pm_ai_endpoint"); if (o) return o; } catch (e) {} return window.PM_AI_ENDPOINT || DEF_EP; }
  function call(action, body, timeout) {
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, timeout || 30000);
    return fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action }, body)), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(tm); return r.json().catch(function () { return {}; }).then(function (j) { j = j || {}; j._status = r.status; return j; }); },
        function () { clearTimeout(tm); return { _status: 0, error: "AI unreachable" }; });
  }
  function T() { return window.PMTee; }
  function J(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function SJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function uniq(a) { var s = {}; return a.filter(function (x) { var k = String(x).toLowerCase(); if (!x || s[k]) return false; s[k] = 1; return true; }); }
  // same guards as the rest of the machine (adults 21+, no minors / family roles / likeness)
  var AGE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\s*girls?|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|shota\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
  var FAMILY = /\b(?:step[\s-]?\w+|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|incest\w*|taboo|non[\s-]?consen\w*|forced|rape\w*)\b/gi;
  var LIKE = /\b(?:celebrit\w*|celeb|look[\s-]?alike|lookalike|deep[\s-]?fake\w*|face[\s-]?swap\w*|real\s+person|likeness)\b/gi;
  function safe(t) { return String(t == null ? "" : t).replace(AGE, "").replace(FAMILY, "").replace(LIKE, "").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bboys\b/gi, "men").replace(/\bboy\b/gi, "man").replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/[ \t]{2,}/g, " ").trim(); }

  // ---------- constants ----------
  var SHIRTS = [["black", "#121214", "Black"], ["white", "#f4f4f1", "White"], ["heather", "#8d9096", "Heather gray"], ["charcoal", "#3a3c41", "Charcoal"], ["navy", "#1b2440", "Navy"], ["royal", "#2148b8", "Royal"],
    ["red", "#b4212b", "Red"], ["maroon", "#5b1a25", "Maroon"], ["forest", "#1f4b31", "Forest"], ["olive", "#5a5d30", "Olive"], ["sand", "#d9c8a6", "Sand"], ["pink", "#f2b5c7", "Pink"], ["gold", "#e2a52a", "Gold"], ["purple", "#4b2a7a", "Purple"]];
  var PLACE = { front: { label: "Front", w: 12, h: 14, cx: 500, top: 292 }, back: { label: "Back", w: 12, h: 14, cx: 500, top: 250 }, chest: { label: "Left chest", w: 4, h: 4, cx: 628, top: 300 } };
  var PXIN = 28; // mockup px per inch (shirt body ~20 in wide at the chest -> to-scale preview)
  var MAXIN = 15;
  var PRESETS = {
    dtf: { label: "Generic DTF supplier (300 PPI, transparent PNG, max 15×15 in)", min: 300, semi: true },
    dtf_lenient: { label: "DTF supplier that accepts 150 PPI minimum", min: 150, semi: true },
    dtf_strict: { label: "Strict DTF (300 PPI, no semi-transparent pixels)", min: 300, semi: false },
    custom: { label: "Custom minimum PPI", min: 300, semi: true }
  };
  var FONTS = ["Bebas Neue", "Anton", "Oswald", "Permanent Marker", "Bungee", "Black Ops One", "UnifrakturMaguntia", "Pacifico", "Rubik Mono One", "Monoton", "Playfair Display", "IBM Plex Sans", "Impact"];
  var FX = [["none", "Original colors"], ["pop", "Pop (punchy color)"], ["mono", "Black & white"], ["stencil", "1-color stencil (ink)"], ["duotone", "Duotone (2 inks)"], ["posterize", "Posterize (screen-print look)"], ["vintage", "Vintage faded"], ["distress", "Distressed / cracked print"], ["halftone", "Halftone dots"], ["invert", "Invert"]];
  var STARTER = [
    { name: "Apparel & Garments", color: "#f59e0b", link: "style:fashion", words: ["classic crew-neck tee", "oversized heavyweight tee", "boxy cropped tee", "vintage washed tee", "ringer tee", "long-sleeve tee", "pullover hoodie", "zip hoodie", "crewneck sweatshirt", "tank top", "baseball jersey", "varsity jacket", "coach jacket", "trucker hat", "dad hat", "beanie", "tote bag", "garment-dyed cotton", "6.5 oz heavyweight cotton", "acid wash", "pigment dyed", "drop shoulder", "raw hem", "streetwear capsule drop"] },
    { name: "Print Methods", color: "#22d3ee", link: "off", words: ["DTF transfer (direct-to-film)", "screen print", "plastisol ink", "water-based ink", "discharge print", "DTG (direct-to-garment)", "puff print", "embroidery", "chenille patch", "heat transfer vinyl (HTV)", "sublimation (polyester)", "foil print", "glow-in-the-dark ink", "reflective ink", "full front print", "oversized back print", "left chest print", "sleeve print", "neck print"] },
    { name: "Graphic Styles", color: "#c084fc", link: "off", words: ["bold vector illustration", "vintage distressed graphic", "90s bootleg rap-tee collage", "airbrush art", "tattoo flash", "old-English blackletter", "graffiti tag lettering", "chrome 3D lettering", "halftone pop art", "risograph print", "anime-inspired line art", "comic ink and color", "psychedelic 70s poster", "Y2K chrome", "gothic streetwear", "retro sunset badge", "collegiate arch lettering", "minimal line art", "woodcut engraving", "sticker-bomb collage", "stencil street art", "neon sign glow", "pixel art", "flaming script lettering", "iced-out diamond style"] },
    { name: "Tee Subjects & Motifs", color: "#fb7185", link: "off", words: ["flaming skull", "roses and thorns", "money stacks", "diamond chain", "lion crest", "eagle crest", "praying hands", "dice and playing cards", "lowrider car", "boombox", "vintage microphone", "vinyl record", "city skyline", "palm trees and sunset", "koi fish", "dragon", "tiger head", "black panther", "snake and dagger", "angel wings", "crown", "lightning bolt", "flames", "cherub", "hourglass", "astronaut", "robot", "barbed wire heart"] }
  ];
  var CLOTH_RE = /cloth|apparel|garment|shirt|\btees?\b|hood|sweat|jacket|fashion|wardrobe|outfit|sneaker|footwear|streetwear|merch|print|dtf|screen|graphic|typograph|font|letter|logo|brand|design|motif|subject|color|palette|style|pattern|fabric|accessor|hat|cap/i;

  // ---------- state ----------
  var api = null, root = null, D = null, hist = [], fut = [], sel = 0, tool = "move", tab = "art", dirty = false, mounted = false, guides = true;
  var cache = {};      // asset id -> {rec, img, w, h}
  var procCache = {};  // key -> canvas (preview-res processed)
  var els = {};
  function newDesign() { return { id: T().uid("design"), name: "Untitled design", shirt: "black", custom: "", placement: "front", printW: 12, printH: 14, preset: "dtf", customMin: 300, layers: [], createdAt: Date.now(), updatedAt: Date.now() }; }
  function shirtHex() { if (D.shirt === "custom") return D.custom || "#444444"; var s = SHIRTS.filter(function (x) { return x[0] === D.shirt; })[0]; return s ? s[1] : "#121214"; }
  function snap() { return JSON.stringify({ D: D, sel: sel }); }
  function commit(label) { hist.push(snap()); if (hist.length > 80) hist.shift(); fut = []; dirty = true; D.updatedAt = Date.now(); autosave(); }
  function undo() { if (!hist.length) return msg("Nothing to undo"); fut.push(snap()); var s = JSON.parse(hist.pop()); D = s.D; sel = s.sel; afterChange(); }
  function redo() { if (!fut.length) return msg("Nothing to redo"); hist.push(snap()); var s = JSON.parse(fut.pop()); D = s.D; sel = s.sel; afterChange(); }
  var asT = 0;
  function autosave() { clearTimeout(asT); asT = setTimeout(function () { T().db.put("kv", { id: "current", design: JSON.parse(JSON.stringify(D)), sel: sel, at: Date.now() }).catch(function () {}); }, 400); }
  function L() { return D.layers[sel] || null; }
  function msg(t, d) { try { api.current.toast(t, d); } catch (e) {} if (els.status) { els.status.textContent = t + (d ? " — " + d : ""); } }

  // ---------- assets ----------
  function loadAsset(id) {
    if (!id) return Promise.resolve(null);
    if (cache[id] && cache[id].img) return Promise.resolve(cache[id]);
    if (cache[id] && cache[id].p) return cache[id].p;
    var p = T().db.get("assets", id).then(function (rec) {
      if (!rec) return null;
      return new Promise(function (res) {
        var u = URL.createObjectURL(rec.blob), im = new Image();
        im.onload = function () { cache[id] = { rec: rec, img: im, w: im.naturalWidth, h: im.naturalHeight, url: u }; res(cache[id]); };
        im.onerror = function () { res(null); }; im.src = u;
      });
    });
    cache[id] = { p: p }; return p;
  }
  function A(id) { return cache[id] && cache[id].img ? cache[id] : null; }
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function toBlob(c, type, q) { return new Promise(function (res) { c.toBlob(function (b) { res(b); }, type || "image/png", q); }); }

  // ---------- pixel styles (pure JS so Safari matches Chrome) ----------
  function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hash(x, y) { var n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function styleKey(l) { return JSON.stringify([l.fx || "none", l.adj || {}, l.c1 || "", l.c2 || "", l.lv || 4, l.amt == null ? 50 : l.amt]); }
  function needsProc(l) { var a = l.adj || {}; return (l.fx && l.fx !== "none") || a.bri || a.con || a.sat; }
  function applyStyle(c, l) { // in-place on canvas c (any resolution; effects use normalized coords so preview == export)
    if (!needsProc(l)) return c;
    var x = c.getContext("2d", { willReadFrequently: true }), W = c.width, H = c.height, id = x.getImageData(0, 0, W, H), d = id.data;
    var a = l.adj || {}, bri = (a.bri || 0) * 2.55, con = (a.con || 0), cf = (259 * (con + 255)) / (255 * (259 - con)), sat = 1 + (a.sat || 0) / 100;
    var fx = l.fx || "none", c1 = hexRgb(l.c1 || "#ffffff"), c2 = hexRgb(l.c2 || "#d61f2c"), lv = clamp(l.lv || 4, 2, 8), amt = (l.amt == null ? 50 : l.amt) / 100;
    if (fx === "pop") { sat *= 1.45; cf *= 1.18; }
    var hs = Math.max(4, Math.round(Math.max(W, H) / (40 + (1 - amt) * 80))); // halftone cell (normalized: ~40-120 cells across)
    for (var y = 0, i = 0; y < H; y++) for (var xx = 0; xx < W; xx++, i += 4) {
      if (d[i + 3] === 0) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2];
      r = cf * (r - 128) + 128 + bri; g = cf * (g - 128) + 128 + bri; b = cf * (b - 128) + 128 + bri;
      var Lm = 0.299 * r + 0.587 * g + 0.114 * b;
      if (sat !== 1) { r = Lm + (r - Lm) * sat; g = Lm + (g - Lm) * sat; b = Lm + (b - Lm) * sat; }
      if (fx === "mono") { r = g = b = Lm; }
      else if (fx === "invert") { r = 255 - r; g = 255 - g; b = 255 - b; }
      else if (fx === "posterize") { var st = 255 / (lv - 1); r = Math.round(r / st) * st; g = Math.round(g / st) * st; b = Math.round(b / st) * st; }
      else if (fx === "stencil") { if (Lm < 255 * (0.25 + amt * 0.5)) { r = c1[0]; g = c1[1]; b = c1[2]; } else d[i + 3] = 0; }
      else if (fx === "duotone") { var t = clamp(Lm / 255, 0, 1); r = c2[0] + (c1[0] - c2[0]) * t; g = c2[1] + (c1[1] - c2[1]) * t; b = c2[2] + (c1[2] - c2[2]) * t; }
      else if (fx === "vintage") { var sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r = sr * 0.75 + 40; g = sg * 0.75 + 32; b = sb * 0.75 + 22; d[i + 3] = d[i + 3] * (0.86 + 0.14 * vnoise(xx / W * 300, y / H * 300)); }
      else if (fx === "distress") { var n = vnoise(xx / W * 22, y / H * 22) * 0.55 + vnoise(xx / W * 140, y / H * 140) * 0.3 + hash(Math.floor(xx / W * 700), Math.floor(y / H * 700)) * 0.15; if (n > 1 - amt * 0.55) d[i + 3] = 0; }
      else if (fx === "halftone") { var cx = (Math.floor(xx / hs) + 0.5) * hs, cy = (Math.floor(y / hs) + 0.5) * hs, dist = Math.hypot(xx - cx, y - cy) / (hs * 0.7071), rr = Math.sqrt(clamp(1 - Lm / 255, 0, 1)); if (dist <= rr && rr > 0.12) { r = c1[0]; g = c1[1]; b = c1[2]; } else d[i + 3] = 0; }
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255);
    }
    x.putImageData(id, 0, 0); return c;
  }
  // processed bitmap for drawing: preview (<=1400 px) or full resolution (export)
  function layerBitmap(l, full) {
    var a = A(l.asset); if (!a) return null;
    var maxS = full ? 1e9 : 1400, sc = Math.min(1, maxS / Math.max(a.w, a.h));
    if (!needsProc(l) && sc === 1) return a.img;
    var key = l.asset + "|" + (full ? "F" : "P") + "|" + styleKey(l);
    if (procCache[key]) return procCache[key];
    var c = canvas(a.w * sc, a.h * sc), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(a.img, 0, 0, c.width, c.height); applyStyle(c, l);
    if (!full) { var ks = Object.keys(procCache); if (ks.length > 24) ks.slice(0, 8).forEach(function (k) { delete procCache[k]; }); }
    procCache[key] = c; return c;
  }

  // ---------- text ----------
  function fontStr(l, px) { return (l.bold === false ? "" : "bold ") + Math.max(1, px) + "px \"" + (l.font || "Bebas Neue") + "\", Impact, sans-serif"; }
  function textMetrics(ctx, l, px) { ctx.font = fontStr(l, px); var ls = (l.ls || 0) * px / 100, w = 0, chars = Array.from(l.text || ""); chars.forEach(function (ch) { w += ctx.measureText(ch).width + ls; }); return { w: Math.max(1, w - ls), chars: chars, ls: ls }; }
  function drawText(ctx, l, W, H) {
    var px = (l.size || 0.12) * H, m = textMetrics(ctx, l, px), arc = (l.arc || 0) * Math.PI / 180, sw = (l.sw || 0) / 100 * px;
    ctx.save(); ctx.translate(l.x * W, l.y * H); ctx.rotate((l.rot || 0) * Math.PI / 180);
    ctx.font = fontStr(l, px); ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
    function put(ch, x0, y0, ang) { ctx.save(); ctx.translate(x0, y0); if (ang) ctx.rotate(ang); if (sw > 0) { ctx.strokeStyle = l.stroke || "#000"; ctx.lineWidth = sw * 2; ctx.strokeText(ch, 0, 0); } ctx.fillStyle = l.color || "#fff"; ctx.fillText(ch, 0, 0); ctx.restore(); }
    ctx.textAlign = "left";
    if (Math.abs(arc) < 0.01) { var x0 = -m.w / 2; m.chars.forEach(function (ch) { put(ch, x0, 0, 0); x0 += ctx.measureText(ch).width + m.ls; }); }
    else { var R = m.w / Math.abs(arc), dir = arc > 0 ? 1 : -1, a0 = -Math.abs(arc) / 2, acc = 0; ctx.textAlign = "center";
      m.chars.forEach(function (ch) { var cw = ctx.measureText(ch).width, a = a0 + (acc + cw / 2) / R; acc += cw + m.ls; var x0 = Math.sin(a) * R, y0 = dir * (R - Math.cos(a) * R); put(ch, x0, y0 - dir * (R - Math.cos(Math.abs(arc) / 2) * R) / 2, a * dir); }); }
    ctx.restore();
  }
  // layer box in artboard fractions (center, half sizes, rotation) for hit tests and checks
  function layerBox(l, W, H, ctx, tight) {
    if (l.t === "img") { var a = A(l.asset); if (!a) return null; var w = l.s * W, h = w * a.h / a.w; return { cx: l.x * W, cy: l.y * H, hw: w / 2, hh: h / 2, rot: l.rot || 0 }; }
    var px = (l.size || 0.12) * H, m = textMetrics(ctx || measCtx(), l, px), ext = Math.abs(l.arc || 0) > 1 ? m.w * Math.abs(l.arc) / 360 : 0;
    return { cx: l.x * W, cy: l.y * H, hw: m.w / 2 + (tight ? 0 : px * 0.1), hh: px * (tight ? 0.5 : 0.62) + ext, rot: l.rot || 0 };
  }
  var _mc; function measCtx() { if (!_mc) _mc = canvas(4, 4).getContext("2d"); return _mc; }

  // ---------- artboard (the print area, 0..1 coords) ----------
  function drawArtboard(ctx, W, H, full, only) {
    D.layers.forEach(function (l) {
      if (l.hidden || (only && l !== only)) return;
      if (l.t === "img") {
        var bm = layerBitmap(l, full), a = A(l.asset); if (!bm || !a) return;
        var w = l.s * W, h = w * a.h / a.w;
        ctx.save(); ctx.translate(l.x * W, l.y * H); ctx.rotate((l.rot || 0) * Math.PI / 180); if (l.flip) ctx.scale(-1, 1);
        if (l.fill) { ctx.fillStyle = l.fill; ctx.beginPath(); if (l.fillShape === "circle") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); else if (l.fillShape === "round" && ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12); else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); }
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.globalAlpha = l.op == null ? 1 : l.op; ctx.drawImage(bm, -w / 2, -h / 2, w, h); ctx.restore();
      } else drawText(ctx, l, W, H);
    });
  }

  // ---------- shirt mockup ----------
  function shirtPath(ctx, back) {
    ctx.beginPath();
    ctx.moveTo(410, 150);
    ctx.bezierCurveTo(330, 160, 285, 172, 238, 196);   // left shoulder
    ctx.bezierCurveTo(170, 260, 120, 340, 92, 418);    // left sleeve top
    ctx.lineTo(212, 478);                              // left sleeve hem
    ctx.bezierCurveTo(228, 440, 240, 400, 252, 362);   // underarm
    ctx.bezierCurveTo(250, 560, 244, 800, 240, 1040);  // left side
    ctx.bezierCurveTo(420, 1056, 580, 1056, 760, 1040);// hem
    ctx.bezierCurveTo(756, 800, 750, 560, 748, 362);   // right side
    ctx.bezierCurveTo(760, 400, 772, 440, 788, 478);
    ctx.lineTo(908, 418);
    ctx.bezierCurveTo(880, 340, 830, 260, 762, 196);
    ctx.bezierCurveTo(715, 172, 670, 160, 590, 150);
    if (back) ctx.bezierCurveTo(560, 172, 440, 172, 410, 150); else ctx.bezierCurveTo(570, 232, 430, 232, 410, 150);
    ctx.closePath();
  }
  function lum(hex) { var c = hexRgb(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function drawShirt(ctx, back) {
    var col = shirtHex(), light = lum(col) > 0.6;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14; shirtPath(ctx, back); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    ctx.save(); shirtPath(ctx, back); ctx.clip();
    var g = ctx.createLinearGradient(240, 0, 760, 0); g.addColorStop(0, "rgba(0,0,0,0.22)"); g.addColorStop(0.18, "rgba(0,0,0,0.04)"); g.addColorStop(0.5, "rgba(255,255,255,0.05)"); g.addColorStop(0.82, "rgba(0,0,0,0.04)"); g.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1100);
    // soft folds (wide, faint, layered strokes)
    ctx.strokeStyle = light ? "#000" : "#fff"; ctx.lineCap = "round";
    [[46, 0.018], [28, 0.022], [14, 0.02]].forEach(function (pass) { ctx.lineWidth = pass[0]; ctx.globalAlpha = pass[1] * (light ? 1.4 : 1);
      [[300, 620, 330, 900], [690, 640, 668, 940], [430, 960, 520, 1010]].forEach(function (f) { ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.quadraticCurveTo((f[0] + f[2]) / 2 + 18, (f[1] + f[3]) / 2, f[2], f[3]); ctx.stroke(); }); });
    ctx.globalAlpha = 1; ctx.restore();
    // collar rib + seams
    ctx.save(); ctx.strokeStyle = light ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.16)"; ctx.lineWidth = 3;
    ctx.beginPath(); if (back) { ctx.moveTo(410, 150); ctx.bezierCurveTo(440, 172, 560, 172, 590, 150); } else { ctx.moveTo(410, 150); ctx.bezierCurveTo(430, 232, 570, 232, 590, 150); } ctx.stroke();
    ctx.lineWidth = 14; ctx.strokeStyle = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = light ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(110, 404); ctx.lineTo(222, 458); ctx.moveTo(890, 404); ctx.lineTo(778, 458); ctx.moveTo(244, 1022); ctx.bezierCurveTo(420, 1038, 580, 1038, 756, 1022); ctx.stroke();
    ctx.restore();
  }
  function printRect() { var p = PLACE[D.placement] || PLACE.front, w = D.printW * PXIN, h = D.printH * PXIN; return { x: p.cx - w / 2, y: p.top, w: w, h: h }; }
  function renderMockup(ctx, scale, showGuides) {
    ctx.save(); ctx.scale(scale, scale);
    ctx.fillStyle = "#1b1b20"; ctx.fillRect(0, 0, 1000, 1100);
    var back = D.placement === "back";
    drawShirt(ctx, back);
    var r = printRect(), ss = Math.min(4, scale * 2), off = canvas(r.w * ss, r.h * ss), ox = off.getContext("2d");
    drawArtboard(ox, off.width, off.height, false);
    ctx.save(); shirtPath(ctx, back); ctx.clip(); ctx.globalAlpha = 0.97; ctx.drawImage(off, r.x, r.y, r.w, r.h); ctx.restore();
    if (showGuides) {
      ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = lum(shirtHex()) > 0.6 ? "rgba(124,58,237,0.75)" : "rgba(250,204,21,0.7)"; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]); ctx.font = "600 15px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = ctx.strokeStyle; ctx.fillText(D.printW + " × " + D.printH + " in print area", r.x, r.y - 8);
      var l = L(); if (l) { var b = layerBox(l, r.w, r.h, ox); if (b) { ctx.translate(r.x + b.cx, r.y + b.cy); ctx.rotate(b.rot * Math.PI / 180); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1.5; ctx.strokeRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2); ctx.fillStyle = "#38bdf8"; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) { ctx.fillRect(k[0] * b.hw - 5, k[1] * b.hh - 5, 10, 10); }); } }
      ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.scale(scale, scale); ctx.font = "600 18px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText((PLACE[D.placement] || PLACE.front).label.toUpperCase() + " · " + (D.shirt === "custom" ? "custom" : (SHIRTS.filter(function (x) { return x[0] === D.shirt; })[0] || [0, 0, ""])[2]) + " tee", 24, 1080); ctx.restore();
  }
  var rq = 0;
  function draw() { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; if (!els.stage) return; var c = els.stage, x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height); renderMockup(x, c.width / 1000, guides); updatePpi(); }); }

  // ---------- background removal (on-device, free) ----------
  function pixels(src) { var c = canvas(src.width || src.w, src.height || src.h), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src.img || src, 0, 0); return { c: c, x: x, id: x.getImageData(0, 0, c.width, c.height) }; }
  function borderInfo(d, W, H) {
    var buckets = {}, n = 0, tot = 0, step = Math.max(1, Math.floor((W + H) / 900));
    function add(i) { tot++; if (d[i + 3] < 200) return; n++; var k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4), b = buckets[k] || (buckets[k] = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; }
    for (var x = 0; x < W; x += step) { add(x * 4); add(((H - 1) * W + x) * 4); }
    for (var y = 0; y < H; y += step) { add(y * W * 4); add((y * W + W - 1) * 4); }
    var list = Object.keys(buckets).map(function (k) { var b = buckets[k]; return { n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] }; }).sort(function (a, b) { return b.n - a.n; });
    return { opaque: tot ? n / tot : 0, cols: list.filter(function (b) { return b.n >= n * 0.05; }).slice(0, 4).map(function (b) { return b.c; }) };
  }
  function bgRemove(id, W, H, opt) { // opt: {mode:'auto'|'point'|'global', x, y, tol}
    var d = id.data, N = W * H, thr = clamp(opt.tol || 30, 1, 120) * 2.2, thr2 = thr * thr, soft = thr * 1.7, soft2 = soft * soft, cols;
    if (opt.mode === "auto") cols = borderInfo(d, W, H).cols; else { var i0 = (opt.y * W + opt.x) * 4; cols = [[d[i0], d[i0 + 1], d[i0 + 2]]]; }
    if (!cols.length) return 0;
    function dist2(p) { var i = p * 4, best = 1e9; for (var k = 0; k < cols.length; k++) { var dr = d[i] - cols[k][0], dg = d[i + 1] - cols[k][1], db = d[i + 2] - cols[k][2], v = dr * dr + dg * dg + db * db; if (v < best) best = v; } return best; }
    var rem = new Uint8Array(N), count = 0;
    if (opt.mode === "global") { for (var p = 0; p < N; p++) if (d[p * 4 + 3] && dist2(p) <= thr2) { rem[p] = 1; count++; } }
    else {
      var q = new Uint32Array(N), qh = 0, qt = 0;
      function push(p) { if (rem[p]) return; if (d[p * 4 + 3] === 0 || dist2(p) <= thr2) { rem[p] = 1; q[qt++] = p; count++; } }
      if (opt.mode === "auto") { for (var x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (var y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); } }
      else push(opt.y * W + opt.x);
      while (qh < qt) { var p2 = q[qh++], px = p2 % W; if (px > 0) push(p2 - 1); if (px < W - 1) push(p2 + 1); if (p2 >= W) push(p2 - W); if (p2 < N - W) push(p2 + W); }
    }
    // soften + de-fringe the 1-2 px edge next to the removed area (anti-aliased cut, no halo of the old background)
    for (var p3 = 0; p3 < N; p3++) {
      if (rem[p3] || !d[p3 * 4 + 3]) continue;
      var x3 = p3 % W, nb = (x3 > 0 && rem[p3 - 1]) || (x3 < W - 1 && rem[p3 + 1]) || (p3 >= W && rem[p3 - W]) || (p3 < N - W && rem[p3 + W]);
      if (!nb) continue;
      var dd = dist2(p3); if (dd >= soft2) continue;
      var a = clamp((Math.sqrt(dd) - thr) / (soft - thr), 0.15, 1), i3 = p3 * 4, bc = cols[0];
      for (var c = 0; c < 3; c++) d[i3 + c] = clamp((d[i3 + c] - bc[c] * (1 - a)) / a, 0, 255);
      d[i3 + 3] = Math.round(d[i3 + 3] * a);
    }
    for (var p4 = 0; p4 < N; p4++) if (rem[p4]) d[p4 * 4 + 3] = 0;
    return count;
  }
  function saveWork(canvasEl, l, note) {
    return toBlob(canvasEl, "image/png").then(function (b) {
      var orig = A(l.orig) || A(l.asset), rec = { id: T().uid("art"), kind: "work", parent: l.orig, blob: b, type: "image/png", w: canvasEl.width, h: canvasEl.height, name: (orig && orig.rec.name || "Artwork") + " · " + note, source: "T-Shirt Studio edit", createdAt: Date.now() };
      return T().db.put("assets", rec).then(function () { return loadAsset(rec.id); }).then(function () { return rec; });
    });
  }
  function runBg(opt) {
    var l = L(); if (!l || l.t !== "img") return msg("Pick an image layer first");
    var a = A(l.asset); if (!a) return;
    msg("Removing background…");
    setTimeout(function () {
      var P = pixels(a), n = bgRemove(P.id, P.c.width, P.c.height, opt);
      if (!n) return msg("Nothing matched — raise the tolerance or click the background color");
      P.x.putImageData(P.id, 0, 0);
      saveWork(P.c, l, "bg removed").then(function (rec) { commit(); l.asset = rec.id; afterChange(); msg("Background removed", Math.round(n / (P.c.width * P.c.height) * 100) + "% of pixels cleared · original kept (Reset to original any time)"); });
    }, 30);
  }

  // ---------- DTF checks ----------
  function preset() { var p = PRESETS[D.preset] || PRESETS.dtf; return { id: D.preset, label: p.label, min: D.preset === "custom" ? clamp(+D.customMin || 300, 72, 1200) : p.min, semi: p.semi, ppi: 300 }; }
  function exportPx() { return { w: Math.round(D.printW * 300), h: Math.round(D.printH * 300) }; }
  function lname(l, i) { return l.t === "txt" ? "Text \"" + String(l.text || "").slice(0, 18) + "\"" : "Image " + (i + 1) + (A(l.asset) ? " (" + (function (n) { return n.length > 44 ? n.slice(0, 43) + "…" : n; })(A(l.asset).rec.name) + ")" : ""); }
  function corners(b) { var r = b.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) { var x = k[0] * b.hw, y = k[1] * b.hh; return [b.cx + x * c - y * s, b.cy + x * s + y * c]; }); }
  var bcache = {};
  function cutOff(l) { // pixel test: draw the layer alone on a canvas with a 30% margin; any ink in the margin = clipped in the DTF file
    var W = 400, H = Math.round(400 * D.printH / D.printW), mx = Math.round(W * 0.3), my = Math.round(H * 0.3), c = canvas(W + 2 * mx, H + 2 * my), x = c.getContext("2d", { willReadFrequently: true });
    x.translate(mx, my); drawArtboard(x, W, H, false, l);
    var d = x.getImageData(0, 0, c.width, c.height).data, cw = c.width, n = 0;
    for (var y = 0; y < c.height; y++) { var inY = y >= my - 1 && y <= my + H; for (var xx = 0; xx < cw; xx++) { if (inY && xx >= mx - 1 && xx <= mx + W) continue; if (d[(y * cw + xx) * 4 + 3] > 24) { if (++n > 3) return true; } } }
    return false;
  }
  function analyze() {
    var P = preset(), px = exportPx(), out = [], fail = 0;
    function add(st, t) { out.push({ st: st, t: t }); if (st === "fail") fail++; }
    var vis = D.layers.filter(function (l) { return !l.hidden; });
    add(D.printW <= MAXIN && D.printH <= MAXIN && D.printW > 0 && D.printH > 0 ? "ok" : "fail", "Print size " + D.printW + " × " + D.printH + " in (max " + MAXIN + " × " + MAXIN + " in)");
    add("ok", "DTF file will be " + px.w + " × " + px.h + " px at 300 PPI · PNG with transparency · artwork only, no shirt");
    if (!vis.length) add("fail", "No artwork yet — import or generate an image, or add text");
    var mc = measCtx(), W = 1000, H = 1000 * D.printH / D.printW;
    vis.forEach(function (l) {
      var i = D.layers.indexOf(l), nm = lname(l, i), b = layerBox(l, W, H, mc, true);
      if (l.t === "img") {
        var a = A(l.asset); if (!a) return add("fail", nm + ": image still loading");
        var inW = l.s * D.printW, inH = inW * a.h / a.w, M = meta(a), eff = Math.round(a.w / inW), real = Math.round(M.detailW / inW), rw = M.detailW, rh = M.detailW * a.h / a.w;
        if (M.up === "smooth" && real < eff) add("info", nm + ": file is " + eff + " PPI, but it was smooth-enlarged (NOT AI) — only " + real + " PPI of real detail, and that is what counts here");
        if (real >= P.min) add("ok", nm + ": " + real + " PPI at " + inW.toFixed(1) + " × " + inH.toFixed(1) + " in (needs " + P.min + "+)" + (M.up === "ai" ? " · AI-upscaled ×" + M.upX + " on the device (AI-made detail — zoom in and check faces / text)" : ""));
        else add("fail", nm + ": only " + real + " PPI" + (real < eff ? " of real detail" : "") + " at " + inW.toFixed(1) + " in wide — below " + P.min + " PPI. The export upscales it (soft / pixelated), so it is NOT print-ready. Sharp at " + P.min + " PPI up to " + (rw / P.min).toFixed(1) + " × " + (rh / P.min).toFixed(1) + " in — " + (M.up === "ai" && M.upX >= 3.9 ? "it is already AI-upscaled ×" + M.upX + " (the honest limit), so print it smaller or use a bigger original." : "shrink it, use a bigger original, or run 🔍 AI Upscale in ② Customize."));
        if (M.fit === "freefill") add("info", nm + ": the side bands are a free blurred mirror fill (not AI) — soft on purpose");
        else if (M.edgeW) { var ep = Math.round(M.edgeW / inW); add(ep >= P.min * 0.5 ? "info" : "warn", nm + ": AI-extended bands carry ≈ " + ep + " PPI of real detail (Grok paints at ~1K) — softer than the middle" + (M.fit === "regrok" ? "; Grok re-drew the whole frame, so details may differ from your original" : "")); }
        var bk = l.asset + styleKey(l), bi = bcache[bk]; if (!bi) { var bm = layerBitmap(l, false); bi = bm ? borderInfo(pixels(bm).id.data, bm.width, bm.height) : { opaque: 0 }; bcache[bk] = bi; }
        if (l.fill) add("info", nm + ": background shape (" + l.fill + ") is ON by your choice — it prints as a solid " + (l.fillShape || "box"));
        else if (bi.opaque > 0.6 && !l.keepBox) add("fail", nm + ": still has a solid background (" + Math.round(bi.opaque * 100) + "% of its edge is opaque) — a box will print around it. Use Remove background, or tick \"Keep this box on purpose\".");
        else if (bi.opaque > 0.6) add("info", nm + ": solid edge kept on purpose");
        else add("ok", nm + ": background is transparent");
      } else {
        var fs = fontStr(l, 40); var fok = !document.fonts || document.fonts.check(fs);
        add(fok ? "ok" : "warn", nm + ": text renders sharp at 300 PPI" + (fok ? "" : " (font still loading — wait a second)"));
      }
      if (l.t === "img" && l.cover && covers(l, A(l.asset))) { var cg = A(l.asset), vis2 = 1 / (l.s * (l.s * areaR() / (cg.w / cg.h))); var trim = Math.round((1 - vis2) * 100); add("info", nm + ": fills the print area edge to edge" + (trim > 0 ? " — " + trim + "% of the photo is trimmed at the edges on purpose (drag it on the shirt to reposition)" : " (cropped / extended to the exact shape)")); }
      else if (b && cutOff(l)) add("fail", nm + ": part of it is outside the print area and will be cut off in the print file — move or shrink it");
    });
    if (vis.length) {
      var c = canvas(1000, 1000 * D.printH / D.printW), x = c.getContext("2d", { willReadFrequently: true }); drawArtboard(x, c.width, c.height, false);
      var d = x.getImageData(0, 0, c.width, c.height).data, z = 0, o = 0, s = 0; for (var k = 3; k < d.length; k += 4) { if (d[k] === 0) z++; else if (d[k] === 255) o++; else s++; }
      var tot = d.length / 4;
      var boxed = vis.some(function (l) { return l.t === "img" && (l.keepBox || l.fill); });
      if (z / tot > 0.02) add("ok", "Transparency: " + Math.round(z / tot * 100) + "% of the print area is transparent (nothing prints there)");
      else if (boxed) add("info", "Transparency: " + Math.round(z / tot * 100) + "% — the photo fills the whole print area edge to edge, by your choice (a full " + D.printW + " × " + D.printH + " in film patch; heavier feel than cut-out art)");
      else add("fail", "Transparency: " + Math.round(z / tot * 100) + "% of the print area is transparent (nothing prints there)");
      var semi = s / Math.max(1, s + o);
      if (!P.semi) add(semi > 0.01 ? "warn" : "ok", "≈" + Math.round(semi * 1000) / 10 + "% semi-transparent pixels (screen estimate, edges count extra) — this preset needs solid pixels only; the exact count is measured on export and decides PRINT-READY. Glows / soft shadows: use a stencil or posterize style.");
      else add(semi > 0.08 ? "warn" : "ok", "≈" + Math.round(semi * 1000) / 10 + "% semi-transparent pixels" + (semi > 0.08 ? " — soft glows / shadows can print faded or with a white-ink halo; most DTF shops accept it" : ""));
    }
    return { items: out, ready: !fail && vis.length > 0, preset: P, px: px };
  }

  // ---------- PNG encoder (tiles, so 4500×4500 works even where the browser caps canvas size) + 300 PPI pHYs ----------
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bufs) { var c = 0xffffffff; bufs.forEach(function (b) { for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); }); return (c ^ 0xffffffff) >>> 0; }
  function u32(v) { return new Uint8Array([v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]); }
  function chunk(type, data) { var t = new TextEncoder().encode(type); return [u32(data.length), t, data, u32(crc32([t, data]))]; }
  function pngFromIDAT(W, H, idat, ppi) {
    var ih = new Uint8Array(13); ih.set(u32(W), 0); ih.set(u32(H), 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
    var ppm = Math.round(ppi / 0.0254), ph = new Uint8Array(9); ph.set(u32(ppm), 0); ph.set(u32(ppm), 4); ph[8] = 1;
    var parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])].concat(chunk("IHDR", ih), chunk("pHYs", ph), chunk("tEXt", new TextEncoder().encode("Software\u0000ZigFlames Prompt Machine T-Shirt Studio")), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0)));
    return new Blob(parts, { type: "image/png" });
  }
  function encodePNG(W, H, drawStrip, ppi, onProgress) {
    var stats = { zero: 0, full: 0, semi: 0 };
    if (!window.CompressionStream) return Promise.reject(new Error("This browser is too old to build a large PNG (needs CompressionStream). Update Safari / Chrome."));
    var cs = new CompressionStream("deflate"), wr = cs.writable.getWriter(), outP = new Response(cs.readable).arrayBuffer();
    var sh = Math.max(1, Math.min(H, Math.floor(3.5e6 / W))), c = canvas(W, sh), x = c.getContext("2d", { willReadFrequently: true }), y0 = 0;
    function step() {
      if (y0 >= H) return wr.close();
      var h = Math.min(sh, H - y0); x.clearRect(0, 0, W, sh); drawStrip(x, y0, h);
      var d = x.getImageData(0, 0, W, h).data, row = W * 4, out = new Uint8Array(h * (row + 1));
      for (var y = 0; y < h; y++) {
        var o = y * (row + 1), s = y * row; out[o] = 1; // filter: Sub
        for (var k = 0; k < row; k++) out[o + 1 + k] = (d[s + k] - (k >= 4 ? d[s + k - 4] : 0)) & 255;
        for (var a = 3; a < row; a += 4) { var v = d[s + a]; if (v === 0) stats.zero++; else if (v === 255) stats.full++; else stats.semi++; }
      }
      y0 += h; if (onProgress) onProgress(y0 / H);
      return wr.write(out).then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }).then(step);
    }
    return step().then(function () { return outP; }).then(function (buf) { return { blob: pngFromIDAT(W, H, new Uint8Array(buf), ppi), stats: stats }; });
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 120000);
  }
  function slug(s) { return String(s || "design").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "design"; }
  function fontsReady() {
    var fams = uniq(D.layers.filter(function (l) { return l.t === "txt"; }).map(function (l) { return l.font || "Bebas Neue"; }));
    if (!document.fonts || !fams.length) return Promise.resolve();
    return Promise.all(fams.map(function (f) { return document.fonts.load("bold 40px \"" + f + "\"").catch(function () {}); })).then(function () {});
  }
  function exportDTF() {
    var an = analyze(), px = an.px;
    if (!D.layers.some(function (l) { return !l.hidden; })) return msg("Nothing to export yet");
    els.dtfOut.replaceChildren(h("div", { cls: "muted", text: "Building " + px.w + " × " + px.h + " px PNG at 300 PPI… (big files take a few seconds)" }));
    return fontsReady().then(function () {
      return encodePNG(px.w, px.h, function (ctx, y0) { ctx.save(); ctx.translate(0, -y0); drawArtboard(ctx, px.w, px.h, true); ctx.restore(); }, 300, function (f) { var m = els.dtfOut.firstChild; if (m) m.textContent = "Building DTF file… " + Math.round(f * 100) + "%"; });
    }).then(function (r) {
      var exactSemi = r.stats.semi / Math.max(1, r.stats.semi + r.stats.full);
      if (!an.preset.semi && exactSemi > 0.01) { an.ready = false; an.items.push({ st: "fail", t: "Exact count: " + (exactSemi * 100).toFixed(1) + "% semi-transparent pixels — over this preset's 1% limit" }); }
      var tot = px.w * px.h, name = slug(D.name) + "_DTF_" + D.printW + "x" + D.printH + "in_" + px.w + "x" + px.h + "px_300ppi_" + (an.ready ? "PRINT-READY" : "NEEDS-PREP") + ".png";
      download(r.blob, name);
      window.__pmTeeLastExport = { kind: "dtf", name: name, w: px.w, h: px.h, bytes: r.blob.size, ready: an.ready, stats: r.stats, items: an.items };
      els.dtfOut.replaceChildren(h("div", { cls: an.ready ? "ready" : "prep", text: (an.ready ? "✅ PRINT-READY for " + an.preset.label : "⚠ Exported, but NEEDS PREP — not print-ready for " + an.preset.label + " (see the checks above)") }),
        h("div", { cls: "muted", text: "Saved " + name + " · " + px.w + " × " + px.h + " px · " + (r.blob.size / 1048576).toFixed(1) + " MB · 300 PPI tag · " + Math.round(r.stats.zero / tot * 100) + "% transparent · " + (exactSemi * 100).toFixed(1) + "% of ink pixels semi-transparent · artwork only (no shirt)" }));
      return r;
    }).catch(function (e) { els.dtfOut.replaceChildren(h("div", { cls: "prep", text: "DTF export failed: " + (e && e.message || e) })); });
  }
  function exportMockup() {
    return fontsReady().then(function () {
      var c = canvas(2000, 2200), x = c.getContext("2d"); renderMockup(x, 2, false); return toBlob(c, "image/png");
    }).then(function (b) {
      var name = slug(D.name) + "_MOCKUP_" + (D.shirt === "custom" ? "custom" : D.shirt) + "-tee_" + D.placement + ".png";
      download(b, name); window.__pmTeeLastExport = { kind: "mockup", name: name, w: 2000, h: 2200, bytes: b.size };
      msg("Mockup saved", name + " (preview only — send the DTF file to the printer)"); return b;
    });
  }

  // ---------- Fit & print quality: Crop to Fill · AI Extend · AI Upscale · Smart Fit (v20261110b) ----------
  // Crop to Fill + saliency + free edge fill run on the device ($0). AI Extend = Grok Imagine edit (outpaint) through the worker,
  // ~$0.02 (xAI's own usage figure is shown). AI Upscale = ESRGAN (UpscalerJS esrgan-slim, TensorFlow.js) on the device ($0);
  // if the model can't load it falls back to a "Smooth enlarge (not AI)" and the DTF checks keep judging the REAL detail.
  // Asset metadata: detailW = width in px of real detail (AI upscales count, plain resampling never does); edgeW = detail width of
  // AI-extended bands; up = "ai" | "smooth"; fit = "extend" | "regrok" | "freefill".
  var FIT = { note: "", banner: "", busy: "", cancel: null };
  var UPS = { tf: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js", up: "https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/umd/upscaler.min.js",
    x2: "https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x2/index.min.js", x4: "https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x4/index.min.js" };
  var jsP = {};
  function loadJs(u) { if (!jsP[u]) jsP[u] = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = u; s.async = true; s.crossOrigin = "anonymous"; s.onload = function () { res(); }; s.onerror = function () { delete jsP[u]; rej(new Error("couldn't download the AI upscaler (" + u.split("/npm/")[1].split("/")[0] + ")")); }; document.head.appendChild(s); }); return jsP[u]; }
  function ratioTxt(w, h) { var r = w / h, best = "", be = 9; [[1, 1], [4, 5], [5, 4], [6, 7], [7, 6], [3, 4], [4, 3], [2, 3], [3, 2], [9, 16], [16, 9], [1, 2], [2, 1], [5, 7], [7, 5]].forEach(function (p) { var e = Math.abs(Math.log(r / (p[0] / p[1]))); if (e < be) { be = e; best = p[0] + ":" + p[1]; } }); return be < 0.03 ? best : r.toFixed(2) + ":1"; }
  function areaR() { return D.printW / D.printH; }
  function meta(a) { var r = (a && a.rec) || {}; return { detailW: r.detailW || (a ? a.w : 0), edgeW: r.edgeW, up: r.up, upX: r.upX, fit: r.fit }; }
  function coverGeom(a) { var ia = a.w / a.h, R = areaR(), s = Math.max(1, ia / R); return { s: s, hf: s * R / ia }; }
  function covers(l, a) { if (!a || (l.rot || 0) % 360) return false; var hf = l.s * areaR() / (a.w / a.h), e = 0.002; return l.x - l.s / 2 <= e && l.x + l.s / 2 >= 1 - e && l.y - hf / 2 <= e && l.y + hf / 2 >= 1 - e; }
  function clampCover(l) { var a = A(l.asset); if (!l.cover || !a || (l.rot || 0) % 360) return; var hf = l.s * areaR() / (a.w / a.h); if (l.s >= 1) l.x = clamp(l.x, 1 - l.s / 2, l.s / 2); if (hf >= 1) l.y = clamp(l.y, 1 - hf / 2, hf / 2); }
  function edgeOpaque(l) { var bk = l.asset + styleKey(l), bi = bcache[bk]; if (!bi) { var bm = layerBitmap(l, false); bi = bm ? borderInfo(pixels(bm).id.data, bm.width, bm.height) : { opaque: 0 }; bcache[bk] = bi; } return bi.opaque; }
  // simple saliency: edges + color contrast + skin tone, center-weighted -> subject center and box (image fractions)
  function saliency(img, w0, h0) {
    var S = 80, sc = S / Math.max(w0, h0), w = Math.max(8, Math.round(w0 * sc)), hh = Math.max(8, Math.round(h0 * sc));
    var c = canvas(w, hh), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, hh);
    var d = x.getImageData(0, 0, w, hh).data, n = w * hh, L = new Float32Array(n), mr = 0, mg = 0, mb = 0, na = 0, i, xx, y;
    for (i = 0; i < n; i++) { L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; if (d[i * 4 + 3] > 40) { mr += d[i * 4]; mg += d[i * 4 + 1]; mb += d[i * 4 + 2]; na++; } }
    na = Math.max(1, na); mr /= na; mg /= na; mb /= na;
    var G = new Float32Array(n), C = new Float32Array(n), gmax = 1e-6, cmax = 1e-6;
    for (y = 0; y < hh; y++) for (xx = 0; xx < w; xx++) { i = y * w + xx; var l0 = L[y * w + Math.max(0, xx - 1)], l1 = L[y * w + Math.min(w - 1, xx + 1)], u0 = L[Math.max(0, y - 1) * w + xx], u1 = L[Math.min(hh - 1, y + 1) * w + xx];
      G[i] = Math.hypot(l1 - l0, u1 - u0); var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; C[i] = Math.sqrt((r - mr) * (r - mr) + (g - mg) * (g - mg) + (b - mb) * (b - mb)); if (G[i] > gmax) gmax = G[i]; if (C[i] > cmax) cmax = C[i]; }
    var Sal = new Float32Array(n), vals = [];
    for (y = 0; y < hh; y++) for (xx = 0; xx < w; xx++) { i = y * w + xx; var r2 = d[i * 4], g2 = d[i * 4 + 1], b2 = d[i * 4 + 2], skin = r2 > 95 && g2 > 40 && b2 > 20 && r2 > g2 && r2 > b2 && r2 - Math.min(g2, b2) > 15 && Math.abs(r2 - g2) > 15 ? 1 : 0;
      var dx = xx / w - 0.5, dy = y / hh - 0.5, cb = Math.exp(-(dx * dx + dy * dy) / (2 * 0.3 * 0.3));
      Sal[i] = d[i * 4 + 3] < 40 ? 0 : (0.35 * G[i] / gmax + 0.65 * C[i] / cmax) * (1 + 0.8 * skin) * (0.3 + 0.7 * cb); vals.push(Sal[i]); }
    vals.sort(function (p, q) { return p - q; }); var thr = vals[Math.floor(vals.length * 0.75)] || 0;
    var px = new Float32Array(w), py = new Float32Array(hh), tot = 0, sx = 0, sy = 0;
    for (y = 0; y < hh; y++) for (xx = 0; xx < w; xx++) { var v = Sal[y * w + xx] - thr; if (v <= 0) continue; px[xx] += v; py[y] += v; tot += v; sx += v * (xx + 0.5); sy += v * (y + 0.5); }
    if (!tot) return { cx: 0.5, cy: 0.5, x0: 0.3, x1: 0.7, y0: 0.3, y1: 0.7 };
    function pct(arr, q) { var acc = 0; for (var k = 0; k < arr.length; k++) { acc += arr[k]; if (acc >= q * tot) return (k + 0.5) / arr.length; } return 1; }
    return { cx: sx / tot / w, cy: sy / tot / hh, x0: pct(px, 0.04), x1: pct(px, 0.96), y0: pct(py, 0.04), y1: pct(py, 0.96) };
  }
  function cropPlan(a, flip) {
    var g = coverGeom(a), sal = saliency(a.img, a.w, a.h), vw = 1 / g.s, vh = 1 / g.hf; // visible fraction of the photo
    var cx = flip ? 1 - sal.cx : sal.cx, x0 = flip ? 1 - sal.x1 : sal.x0, x1 = flip ? 1 - sal.x0 : sal.x1;
    var wx0 = clamp(cx - vw / 2, 0, 1 - vw), wy0 = clamp(sal.cy - vh / 2, 0, 1 - vh);
    // never trim the top of the subject first (heads / faces sit at the top): pull the window up to the subject's top edge
    if (vh < 0.999 && sal.y0 - 0.03 < wy0) wy0 = clamp(sal.y0 - 0.03, 0, 1 - vh);
    if (vw < 0.999 && x0 - 0.02 < wx0 && x1 + 0.02 <= wx0 + vw) wx0 = clamp(x0 - 0.02, 0, 1 - vw);
    if (vw < 0.999 && x1 + 0.02 > wx0 + vw && x0 - 0.02 >= wx0) wx0 = clamp(x1 + 0.02 - vw, 0, 1 - vw);
    var keeps = x0 >= wx0 && x1 <= wx0 + vw && sal.y0 >= wy0 && sal.y1 <= wy0 + vh;
    return { g: g, sal: sal, cx: cx, wx0: wx0, wy0: wy0, vw: vw, vh: vh, lost: 1 - vw * vh, keeps: keeps, sides: vw < 0.999 ? "left & right" : "top & bottom" };
  }
  function cropToFill(l, plan) {
    var a = A(l.asset); if (!a) return msg("Image still loading");
    plan = plan || cropPlan(a, l.flip);
    commit(); var g = plan.g; l.rot = 0; l.s = g.s;
    var wcx = plan.wx0 + plan.vw / 2, wcy = plan.wy0 + plan.vh / 2;
    l.x = clamp(0.5 - (wcx - 0.5) * g.s, 1 - g.s / 2, g.s / 2); l.y = clamp(0.5 - (wcy - 0.5) * g.hf, 1 - g.hf / 2, g.hf / 2);
    l.cover = true; l.keepBox = true;
    var t = plan.lost < 0.005 ? "Crop to Fill: the photo already matches the " + D.printW + " × " + D.printH + " in shape — now edge to edge." :
      "Crop to Fill: the photo now covers the whole " + D.printW + " × " + D.printH + " in area. " + Math.round(plan.lost * 100) + "% trimmed off the " + plan.sides + ", centered on the subject" + (plan.keeps ? "" : " (part of the subject is trimmed — try AI Extend)") + ". Drag it on the shirt to reposition; it stays filled.";
    FIT.note = t; FIT.banner = ""; afterChange(); msg("Cropped to fill", "free · on your device"); return t;
  }
  // free on-device fill for the bands: blurred cover + soft mirrored copies (NOT AI)
  function blurDraw(x, src, dx, dy, dw, dh, k) { var t = canvas(Math.max(2, dw / k), Math.max(2, dh / k)), tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(src, 0, 0, t.width, t.height); var t2 = canvas(Math.max(2, t.width / 2), Math.max(2, t.height / 2)); t2.getContext("2d").drawImage(t, 0, 0, t2.width, t2.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(t2, dx, dy, dw, dh); }
  function freeFill(img, W, H, FW, FH, ox, oy, noCenter) {
    var c = canvas(FW, FH), x = c.getContext("2d"), cs = Math.max(FW / W, FH / H);
    blurDraw(x, img, (FW - W * cs) / 2, (FH - H * cs) / 2, W * cs, H * cs, Math.max(8, Math.max(FW, FH) / 40));
    x.save(); x.globalAlpha = 0.8;
    var m = function (tx, ty, sx, sy) { x.save(); x.translate(tx, ty); x.scale(sx, sy); blurDraw(x, img, 0, 0, W, H, Math.max(3, Math.max(FW, FH) / 300)); x.restore(); };
    if (ox > 0.5) { m(ox, oy, -1, 1); m(ox + 2 * W, oy, -1, 1); }
    if (oy > 0.5) { m(ox, oy, 1, -1); m(ox, oy + 2 * H, 1, -1); }
    x.restore(); if (!noCenter) x.drawImage(img, ox, oy, W, H); return c;
  }
  function grayOf(src, w, h) { var c = canvas(w, h), x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h); var d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for (var i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return g; }
  // find where the original photo sits inside Grok's result (Grok sometimes zooms out): mean-normalized SAD, coarse-to-fine
  function register(G, gw, gh, img, W, H, FW, FH) {
    function search(S, s0, s1, ss, win, step) {
      var k = S / Math.max(gw, gh), sw = Math.round(gw * k), sh = Math.round(gh * k), gd = grayOf(G, sw, sh), I = new Float64Array((sw + 1) * (sh + 1)), best = { e: 1e9 };
      for (var y = 0; y < sh; y++) { var row = 0; for (var x = 0; x < sw; x++) { row += gd[y * sw + x]; I[(y + 1) * (sw + 1) + x + 1] = I[y * (sw + 1) + x + 1] + row; } }
      for (var s = s0; s <= s1 + 1e-9; s += ss) {
        var tw = Math.round(W / FW * sw * s), th = Math.round(H / FH * sh * s); if (tw < 10 || th < 10 || tw > sw || th > sh) continue;
        var td = grayOf(img, tw, th), tm = 0, idx = [], tv = []; for (var ty = 1; ty < th - 1; ty += step) for (var tx = 1; tx < tw - 1; tx += step) { idx.push(ty * sw + tx); tv.push(td[ty * tw + tx]); tm += td[ty * tw + tx]; }
        tm /= tv.length; for (var q = 0; q < tv.length; q++) tv[q] -= tm;
        var xa = 0, xb = sw - tw, ya = 0, yb = sh - th;
        if (win) { var ex = win.x * k, ey = win.y * k; xa = Math.max(0, Math.round(ex - win.r)); xb = Math.min(sw - tw, Math.round(ex + win.r)); ya = Math.max(0, Math.round(ey - win.r)); yb = Math.min(sh - th, Math.round(ey + win.r)); }
        for (var py = ya; py <= yb; py++) for (var px = xa; px <= xb; px++) {
          var sum = I[(py + th) * (sw + 1) + px + tw] - I[py * (sw + 1) + px + tw] - I[(py + th) * (sw + 1) + px] + I[py * (sw + 1) + px], gm = sum / (tw * th), e = 0, base = py * sw + px, lim = best.e * tv.length;
          for (var j = 0; j < tv.length; j++) { var dd = gd[base + idx[j]] - gm - tv[j]; e += dd < 0 ? -dd : dd; if (e > lim) break; }
          e /= tv.length; if (e < best.e) best = { e: e, x: px / k, y: py / k, w: tw / k, h: th / k, s: s };
        }
      }
      return best;
    }
    var c1 = search(112, 0.5, 1.1, 0.02, null, 2); if (!c1.w) return null;
    var c2 = search(448, Math.max(0.45, c1.s - 0.024), c1.s + 0.024, 0.004, { x: c1.x, y: c1.y, r: 10 }, 3);
    var b = c2.w && c2.e <= c1.e * 1.6 ? c2 : c1; return b.e <= 22 ? b : (b.fail = true, b);
  }
  function featherCanvas(img, W, H, sides, fp) {
    var c = canvas(W, H), x = c.getContext("2d"); x.drawImage(img, 0, 0, W, H); if (fp < 1) return c;
    x.globalCompositeOperation = "destination-out";
    function g(x0, y0, x1, y1, rx, ry, rw, rh) { var gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(rx, ry, rw, rh); }
    if (sides.l) g(0, 0, fp, 0, 0, 0, fp, H); if (sides.r) g(W, 0, W - fp, 0, W - fp, 0, fp, H); if (sides.t) g(0, 0, 0, fp, 0, 0, W, fp); if (sides.b) g(0, H, 0, H - fp, 0, H - fp, W, fp);
    return c;
  }
  function saveFit(c, l, note, extra, jpeg) {
    return toBlob(c, jpeg ? "image/jpeg" : "image/png", jpeg ? 0.95 : undefined).then(function (b) {
      if (!b) throw new Error("this device couldn't save a " + c.width + " × " + c.height + " px image");
      var orig = A(l.orig) || A(l.asset), rec = Object.assign({ id: T().uid("art"), kind: "work", parent: l.orig, blob: b, type: b.type, w: c.width, h: c.height, name: (orig && orig.rec.name || "Artwork") + " · " + note, source: "T-Shirt Studio " + note, createdAt: Date.now() }, extra || {});
      return T().db.put("assets", rec).then(function () { return loadAsset(rec.id); }).then(function () { return rec; });
    });
  }
  function hasAlpha(img, w, h) { var s = Math.min(1, 256 / Math.max(w, h)), c = canvas(w * s, h * s), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height); var d = x.getImageData(0, 0, c.width, c.height).data; for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true; return false; }
  function busy(t) { FIT.busy = t || ""; if (els.fitBusy) els.fitBusy.textContent = FIT.busy; if (els.fitBtns) els.fitBtns.forEach(function (b) { b.disabled = !!FIT.busy; }); }
  // AI Extend: pad to the print-area shape, Grok paints the bands, original pixels kept in the middle. New layer on top; old one hidden (Undo restores).
  function aiExtend(l) {
    var a = A(l.asset); if (!a) return Promise.resolve(msg("Image still loading"));
    var R = areaR(), ia = a.w / a.h; if (Math.abs(Math.log(ia / R)) < 0.012) { FIT.note = "AI Extend: the photo already has the " + D.printW + " × " + D.printH + " shape — nothing to extend."; renderTab(); return Promise.resolve({ skipped: true }); }
    var k0 = 1, W = a.w, H = a.h, FW, FH; if (ia > R) { FW = W; FH = Math.round(W / R); } else { FH = H; FW = Math.round(H * R); }
    var cap = Math.min(1, 4500 / Math.max(FW, FH)); if (cap < 1) { k0 = cap; W = Math.round(W * cap); H = Math.round(H * cap); FW = Math.round(FW * cap); FH = Math.round(FH * cap); }
    var ox = Math.round((FW - W) / 2), oy = Math.round((FH - H) / 2), sides = ia > R ? "top and bottom" : "left and right", M = meta(a);
    var src = canvas(W, H); src.getContext("2d").drawImage(a.img, 0, 0, W, H);
    var k = 1024 / Math.max(FW, FH), pw = Math.round(FW * k), ph = Math.round(FH * k), pc = canvas(pw, ph), px = pc.getContext("2d");
    px.fillStyle = "#808080"; px.fillRect(0, 0, pw, ph); px.globalAlpha = 0.35; blurDraw(px, src, 0, 0, pw, ph, 24); px.globalAlpha = 1; px.drawImage(src, ox * k, oy * k, W * k, H * k);
    busy("AI Extend: Grok is painting the " + sides + " bands… (10-30 s, ≈ $0.02)"); FIT.banner = "";
    return call("tee_extend", { imageUrl: pc.toDataURL("image/jpeg", 0.88), sides: sides, contentMode: adultMode() ? "18+" : "sfw" }, 120000).then(function (j) {
      if (!j || j._status !== 200 || !j.ok || !j.url) {
        var why = j && (j.error || j.code) || "no reply";
        busy("Grok didn't extend it — making a free edge fill…");
        var c = freeFill(src, W, H, FW, FH, ox, oy);
        return saveFit(c, l, "free edge fill", { fit: "freefill", detailW: Math.round(FW * Math.min(1, M.detailW / (a.w * k0))), edgeW: 0 }, !hasAlpha(src, W, H)).then(function (rec) {
          FIT.banner = "🛡 Grok did NOT extend this (" + String(why).slice(0, 140) + "). Used a FREE blurred mirror fill for the " + sides + " bands instead — NOT AI, $0. The middle is your untouched photo.";
          return { rec: rec, how: "freefill", cost: 0 };
        });
      }
      busy("Lining Grok's result up with your original…");
      return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("Grok's image couldn't be opened")); }; im.src = j.url; }).then(function (G) {
        var gw = G.naturalWidth, gh = G.naturalHeight, m = register(G, gw, gh, src, W, H, FW, FH), c = canvas(FW, FH), x = c.getContext("2d"), how, edgeW;
        window.__pmTeeLastReg = m && { e: +m.e.toFixed(2), s: m.s, x: m.x, y: m.y, w: m.w, h: m.h, fail: !!m.fail, gw: gw, gh: gh, G: j.url.length < 3e6 ? j.url : "" };
        if (m && !m.fail) {
          var f = W / m.w, cw = FW / f, ch = FH / f, cx = m.x + m.w / 2 - cw / 2, cy = m.y + m.h / 2 - ch / 2;
          cx = cw <= gw ? clamp(cx, 0, gw - cw) : (gw - cw) / 2; cy = ch <= gh ? clamp(cy, 0, gh - ch) : (gh - ch) / 2;
          // tone-match Grok's paint to the original inside the footprint
          var gs = canvas(gw, gh), gx = gs.getContext("2d", { willReadFrequently: true }); gx.drawImage(G, 0, 0);
          var t1 = canvas(32, 32).getContext("2d", { willReadFrequently: true }), t2 = canvas(32, 32).getContext("2d", { willReadFrequently: true }); t1.drawImage(src, 0, 0, 32, 32); t2.drawImage(G, m.x, m.y, m.w, m.h, 0, 0, 32, 32);
          var d1 = t1.getImageData(0, 0, 32, 32).data, d2 = t2.getImageData(0, 0, 32, 32).data, s1 = [0, 0, 0], s2 = [0, 0, 0]; for (var i = 0; i < d1.length; i += 4) for (var ch3 = 0; ch3 < 3; ch3++) { s1[ch3] += d1[i + ch3]; s2[ch3] += d2[i + ch3]; }
          var gain = s1.map(function (v, q) { return clamp((v + 1) / (s2[q] + 1), 0.85, 1.18); });
          if (gain.some(function (v) { return Math.abs(v - 1) > 0.01; })) { var gd = gx.getImageData(0, 0, gw, gh); for (var p = 0; p < gd.data.length; p += 4) { gd.data[p] = gd.data[p] * gain[0]; gd.data[p + 1] = gd.data[p + 1] * gain[1]; gd.data[p + 2] = gd.data[p + 2] * gain[2]; } gx.putImageData(gd, 0, 0); }
          if (cw > gw + 1 || ch > gh + 1) x.drawImage(freeFill(src, W, H, FW, FH, ox, oy, true), 0, 0);
          x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(gs, -cx * f, -cy * f, gw * f, gh * f);
          var px0 = (m.x - cx) * f, py0 = (m.y - cy) * f, fp = Math.round(Math.min(W, H) * 0.03);
          x.drawImage(featherCanvas(src, W, H, { l: px0 > 1, r: px0 + W < FW - 1, t: py0 > 1, b: py0 + H < FH - 1 }, fp), px0, py0, W, H);
          how = m.s < 0.97 ? "regrok-aligned" : "extend"; edgeW = Math.round(Math.min(cw, gw)) ;
        } else {
          x.imageSmoothingQuality = "high"; x.drawImage(G, 0, 0, FW, FH); how = "regrok"; edgeW = gw;
        }
        var dW = how === "regrok" ? Math.min(FW, gw) : Math.round(FW * Math.min(1, M.detailW / (a.w * k0)));
        return saveFit(c, l, how === "regrok" ? "Grok redraw" : "AI extended", { fit: how === "regrok" ? "regrok" : "extend", detailW: dW, edgeW: edgeW, upX: M.upX, up: M.up }, !hasAlpha(src, W, H)).then(function (rec) {
          var cst = j.cost && j.cost.est_usd ? Number(j.cost.est_usd) : 0.02;
          if (how === "regrok") FIT.banner = "⚠ Grok re-drew the whole frame instead of keeping your photo in place, so details may differ from your original. It's a new layer — Undo (or delete it) to go back. Cost ≈ $" + cst.toFixed(3) + ".";
          return { rec: rec, how: how, cost: cst, engine: j.engine };
        });
      });
    }).then(function (r) {
      busy("");
      commit(); var n = JSON.parse(JSON.stringify(l)); n.asset = r.rec.id; n.s = 1; n.x = 0.5; n.y = 0.5; n.rot = 0; n.cover = true; n.keepBox = true; l.hidden = true;
      var i = D.layers.indexOf(l); D.layers.splice(i + 1, 0, n); sel = i + 1;
      var eppi = r.rec.edgeW ? Math.round(r.rec.edgeW / D.printW) : 0;
      FIT.note = r.how === "freefill" ? "Free edge fill: the photo now fills " + D.printW + " × " + D.printH + " in; the " + sides + " bands are a blurred mirror of your photo (not AI)." :
        "AI Extend (" + (r.engine || "Grok Imagine") + ", ≈ $" + r.cost.toFixed(3) + "): Grok painted the " + sides + " bands so the photo fills " + D.printW + " × " + D.printH + " in" + (r.how === "regrok" ? "." : " — your original pixels are kept in the middle.") + (eppi ? " The new bands carry about " + eppi + " PPI of real detail (softer than the middle)." : "");
      FIT.note += " New layer on top · your original layer is hidden (Undo brings it back).";
      afterChange(); msg(r.how === "freefill" ? "Free edge fill (not AI)" : "AI Extend done", r.how === "freefill" ? "$0" : "≈ $" + r.cost.toFixed(3)); return r;
    }).catch(function (e) { busy(""); FIT.banner = "AI Extend failed: " + (e && e.message || e); renderTab(); return { err: String(e && e.message || e) }; });
  }
  // bake a Crop-to-Fill layer down to its visible pixels (used before upscaling so only what prints is upscaled)
  function bakeCover(l) {
    var a = A(l.asset); if (!a || !l.cover || !covers(l, a)) return Promise.resolve(null);
    var hf = l.s * areaR() / (a.w / a.h), left = l.x - l.s / 2, top = l.y - hf / 2, u0 = clamp(-left / l.s, 0, 1), u1 = clamp((1 - left) / l.s, 0, 1), v0 = clamp(-top / hf, 0, 1), v1 = clamp((1 - top) / hf, 0, 1);
    if (l.flip) { var t = u0; u0 = 1 - u1; u1 = 1 - t; }
    if (u0 < 0.002 && u1 > 0.998 && v0 < 0.002 && v1 > 0.998) return Promise.resolve(null);
    var sx = Math.round(u0 * a.w), sy = Math.round(v0 * a.h), sw = Math.max(1, Math.round((u1 - u0) * a.w)), sh = Math.max(1, Math.round((v1 - v0) * a.h)), c = canvas(sw, sh), M = meta(a);
    c.getContext("2d").drawImage(a.img, sx, sy, sw, sh, 0, 0, sw, sh);
    return saveFit(c, l, "cropped", { detailW: M.detailW * sw / a.w, edgeW: M.edgeW ? M.edgeW * (u1 - u0) : M.edgeW, up: M.up, upX: M.upX, fit: M.fit }, !hasAlpha(c, sw, sh)).then(function (rec) { l.asset = rec.id; l.s = 1; l.x = 0.5; l.y = 0.5; l.cover = true; return rec; });
  }
  function upscaleNeed(l) { var a = A(l.asset), P = preset(); if (!a) return null; var inW = l.s * D.printW, px = a.w / inW; return { a: a, inW: inW, px: px, min: P.min, need: P.min / px }; }
  function smoothEnlarge(src, tw, th) { var cur = src, cw = src.width, chh = src.height; while (cw * 2 < tw) { var t = canvas(cw * 2, chh * 2), x = t.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, t.width, t.height); cur = t; cw = t.width; chh = t.height; } var o = canvas(tw, th), ox = o.getContext("2d"); ox.imageSmoothingQuality = "high"; ox.drawImage(cur, 0, 0, tw, th); return o; }
  function aiUpscale(l, opt) {
    opt = opt || {};
    var pre = l.cover && covers(l, A(l.asset)) ? (commit(), bakeCover(l)) : Promise.resolve(null);
    return pre.then(function (baked) {
      var q = upscaleNeed(l); if (!q) return { err: "Image still loading" };
      if (q.need <= 1.02) { FIT.note = "AI Upscale: not needed — already " + Math.round(q.px) + " PPI at " + q.inW.toFixed(1) + " in wide (needs " + q.min + ")."; if (baked) afterChange(); else renderTab(); return { skipped: true, ppi: Math.round(q.px) }; }
      var a = q.a, M = meta(a), alpha = hasAlpha(a.img, a.w, a.h), factor = q.need <= 2 ? 2 : 4, mp = a.w * a.h / 1e6, note2 = "", noAI = "";
      if (factor === 4 && mp > 1.0) { factor = 2; note2 = " (4× is too heavy for a " + mp.toFixed(1) + " MP photo on a phone, so 2×)"; }
      if (mp * 4 > 24) noAI = "the photo is too large (" + mp.toFixed(1) + " MP) for the on-device AI model";
      var src = canvas(a.w, a.h); src.getContext("2d").drawImage(a.img, 0, 0);
      var tw = Math.round(a.w * Math.min(q.need, factor)), th = Math.round(tw * a.h / a.w);
      if (tw * th > 16e6) { var sc = Math.sqrt(16e6 / (tw * th)); tw = Math.round(tw * sc); th = Math.round(th * sc); }
      var ctl = window.AbortController ? new AbortController() : null; FIT.cancel = ctl;
      busy("AI Upscale: loading the free on-device AI model (first time ≈ 2 MB)…"); FIT.banner = "";
      var t0 = Date.now();
      return (noAI ? Promise.reject(new Error(noAI)) : loadJs(UPS.tf)).then(function () { return loadJs(UPS.up); }).then(function () { return loadJs(factor === 4 ? UPS.x4 : UPS.x2); }).then(function () {
        var model = factor === 4 ? window.ESRGANSlim4x : window.ESRGANSlim2x; if (!window.Upscaler || !model) throw new Error("AI upscaler didn't start");
        var up = new window.Upscaler({ model: model });
        busy("AI Upscale " + factor + "×: working on your device… 0%");
        return up.upscale(src, { patchSize: 128, padding: 8, output: "base64", signal: ctl ? ctl.signal : undefined, progress: function (p) { busy("AI Upscale " + factor + "× (ESRGAN, on your device): " + Math.round(p * 100) + "% · don't close the tab"); } })
          .then(function (b64) { try { up.dispose && up.dispose(); } catch (e) {} return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("upscaled image couldn't be opened")); }; im.src = /^data:/.test(b64) ? b64 : "data:image/png;base64," + b64; }); });
      }).then(function (im) {
        var c = canvas(tw, th), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, tw, th);
        if (alpha) { var al = smoothEnlarge(src, tw, th).getContext("2d").getImageData(0, 0, tw, th).data, dd = x.getImageData(0, 0, tw, th); for (var i = 3; i < dd.data.length; i += 4) dd.data[i] = al[i]; x.putImageData(dd, 0, 0); }
        var ux = tw / a.w;
        return saveFit(c, l, "AI upscaled " + factor + "×", { up: "ai", upX: Math.round(((M.upX || 1) * ux) * 100) / 100, detailW: Math.min(tw, Math.round(M.detailW * ux)), edgeW: M.edgeW ? Math.round(M.edgeW * ux) : M.edgeW, fit: M.fit, upModel: "ESRGAN-slim " + factor + "× (UpscalerJS · TensorFlow.js)", upSecs: Math.round((Date.now() - t0) / 1000) }, !alpha).then(function (rec) { return { rec: rec, ai: true, factor: factor, ux: ux }; });
      }, function (e) {
        if (e && (e.name === "AbortError" || /abort/i.test(e.message || ""))) throw new Error("cancelled");
        // honest fallback: plain resample, never counted as real detail
        busy("AI model unavailable — smooth enlarge (not AI)…");
        var c = smoothEnlarge(src, tw, th), ux = tw / a.w;
        return saveFit(c, l, "smooth enlarged (not AI)", { up: "smooth", upX: Math.round(((M.upX || 1) * ux) * 100) / 100, detailW: M.detailW, edgeW: M.edgeW, fit: M.fit }, !alpha).then(function (rec) {
          FIT.banner = "🛡 The AI upscaler couldn't run here (" + String(e && e.message || e).slice(0, 120) + "). Did a Smooth enlarge instead — NOT AI: it only makes the file bigger, it adds no real detail, so the print checks still judge the original sharpness.";
          return { rec: rec, ai: false, factor: ux, ux: ux };
        });
      }).then(function (r) {
        busy(""); FIT.cancel = null; if (!baked) commit(); l.asset = r.rec.id; var q2 = upscaleNeed(l), dppi = Math.round(r.rec.detailW / q2.inW);
        FIT.note = (r.ai ? "AI Upscale (ESRGAN " + r.factor + "×, free, on your device" + (r.rec.upSecs ? ", " + r.rec.upSecs + " s" : "") + ")" + note2 + ": " + a.w + " × " + a.h + " → " + r.rec.w + " × " + r.rec.h + " px = " + Math.round(q2.px) + " PPI at " + q2.inW.toFixed(1) + " in wide."
          : "Smooth enlarge (NOT AI): " + a.w + " × " + a.h + " → " + r.rec.w + " × " + r.rec.h + " px, but real detail stays ≈ " + dppi + " PPI.") +
          (r.ai && q2.px < q.min - 0.5 ? " Still under " + q.min + " PPI — the most AI can honestly do here; print smaller (≤ " + (r.rec.w / q.min).toFixed(1) + " in wide) for full sharpness." : "") + (r.ai ? " AI-made detail: zoom in and check faces and text." : "") + (baked ? " (Crop locked in first so only the printed part was upscaled — Undo to reposition.)" : "");
        afterChange(); msg(r.ai ? "AI Upscale done" : "Smooth enlarge (not AI)", "free · $0"); return r;
      });
    }).catch(function (e) { busy(""); FIT.cancel = null; FIT.banner = "Upscale stopped: " + (e && e.message || e); renderTab(); return { err: String(e && e.message || e) }; });
  }
  function smartFit(l) {
    var a = A(l.asset); if (!a) return Promise.resolve(msg("Image still loading"));
    var R = areaR(), ia = a.w / a.h, mis = Math.abs(Math.log(ia / R)), plan = cropPlan(a, l.flip), steps = [], why = [];
    var shapeTxt = "Your photo is " + ratioTxt(a.w, a.h) + (ia > R ? " (wider)" : ia < R ? " (taller)" : "") + "; the print area is " + D.printW + " × " + D.printH + " in (" + ratioTxt(D.printW, D.printH) + ").";
    var p, cut = edgeOpaque(l) < 0.6 && hasAlpha(a.img, a.w, a.h);
    if (cut) { why.push("This is cut-out art with a transparent background, so there are no photo strips to fill — it only checked sharpness."); steps.push("✓ Kept your layout"); p = Promise.resolve(); }
    else if (mis < 0.035 || (plan.keeps && plan.lost < 0.5) || (plan.keeps && !navigator.onLine)) {
      cropToFill(l, plan); steps.push("✂ Cropped to fill");
      why.push(mis < 0.035 ? "The shapes almost match, so a tiny trim (" + Math.round(plan.lost * 100) + "%) fills it — free." : "Cropping keeps the whole subject (only background trimmed off the " + plan.sides + ", " + Math.round(plan.lost * 100) + "%) — free, no AI needed.");
      p = Promise.resolve();
    } else {
      why.push(plan.keeps ? "Cropping would throw away " + Math.round(plan.lost * 100) + "% of the photo, so it extended the scene instead." : "Cropping would cut off part of the subject on the " + plan.sides + ", so it extended the scene instead.");
      p = aiExtend(l).then(function (r) { if (r && r.err) throw new Error(r.err); steps.push(r && r.how === "freefill" ? "🪞 Free edge fill (Grok refused)" : "🧩 AI Extend (≈ $" + (r && r.cost ? r.cost.toFixed(3) : "0.02") + ")"); });
    }
    return p.then(function () {
      var l2 = L(), q = upscaleNeed(l2); if (!q) return;
      var P = preset();
      if (q.px >= P.min - 0.5) { why.push("Sharpness: " + Math.round(q.px) + " PPI at " + D.printW + " × " + D.printH + " in — already sharp, no upscale."); return; }
      var lowMsg = "Sharpness: only " + Math.round(q.px) + " PPI at this size (needs " + P.min + ")";
      return aiUpscale(l2).then(function (r) {
        if (r && r.err) { why.push(lowMsg + " — upscale didn't finish (" + r.err + ")."); return; }
        steps.push(r && r.ai ? "🔍 AI Upscale " + r.factor + "×" : "↗ Smooth enlarge (not AI)");
        var q2 = upscaleNeed(L()), dppi = Math.round(meta(A(L().asset)).detailW / q2.inW);
        why.push(lowMsg + ", so it " + (r && r.ai ? "AI-upscaled it " + r.factor + "× on your device (free) → " + Math.round(q2.px) + " PPI." : "smooth-enlarged it (not AI) — real detail is still ≈ " + dppi + " PPI."));
        if (q.need > 4.05) why.push("⚠ This photo is soft for " + D.printW + " × " + D.printH + " in: it needed " + q.need.toFixed(1) + "× and AI can only honestly add 4×. It will print soft — use a bigger original or a smaller print size.");
      });
    }).then(function () {
      FIT.note = "🪄 Smart Fit: " + steps.join(" → ") + ". " + shapeTxt + " " + why.join(" ");
      renderTab(); window.__pmTeeLastFit = { steps: steps, note: FIT.note }; return { steps: steps, note: FIT.note };
    }).catch(function (e) { busy(""); FIT.banner = "Smart Fit stopped: " + (e && e.message || e); renderTab(); return { err: String(e && e.message || e) }; });
  }
  // always-visible print quality readout (stage column), updates on every redraw
  function quality(l) {
    var a = A(l.asset); if (!a) return null; var P = preset(), M = meta(a), inW = l.s * D.printW, inH = inW * a.h / a.w, px = a.w / inW, dt = M.detailW / inW, hf = l.s * areaR() / (a.w / a.h);
    var g = dt >= P.min - 0.5 ? ["ok", "✅ Sharp"] : dt >= P.min * 0.66 ? ["warn", "Good from arm's length, soft up close"] : dt >= P.min * 0.45 ? ["warn", "⚠ Soft"] : ["fail", "✗ Blurry / pixelated"];
    var strips = !l.cover && !covers(l, a) && (l.s < 0.985 || hf < 0.985) && edgeOpaque(l) > 0.6 && Math.abs(Math.log((a.w / a.h) / areaR())) > 0.03;
    return { px: Math.round(px), dt: Math.round(dt), min: P.min, g: g, inW: inW, inH: inH, M: M, strips: strips };
  }
  function ppiText() {
    var l = L(); if (!l || l.t !== "img") { l = D.layers.filter(function (x) { return x.t === "img" && !x.hidden; }).slice(-1)[0]; }
    if (!l) return { cls: "", t: "📏 Print quality: add a photo to see its PPI at " + D.printW + " × " + D.printH + " in" };
    var q = quality(l); if (!q) return { cls: "", t: "📏 Print quality: loading…" };
    var t = "📏 Print quality @ " + D.printW + " × " + D.printH + " in area: " + q.dt + " PPI" + (q.dt !== q.px ? " real detail (file " + q.px + " PPI" + (q.M.up === "smooth" ? ", smooth-enlarged, not AI" : "") + ")" : "") + " · needs " + q.min + " · " + q.g[1];
    if (q.M.up === "ai") t += " · AI-upscaled ×" + q.M.upX;
    if (q.M.edgeW) t += " · AI-extended edges ≈ " + Math.round(q.M.edgeW / q.inW) + " PPI";
    if (q.strips) { var aa = A(l.asset); t += " · empty strips " + (aa.w / aa.h > areaR() ? "top & bottom" : "left & right") + " — try Smart Fit"; }
    return { cls: q.g[0], t: t };
  }
  function updatePpi() { if (!els.ppi) return; var r = ppiText(); els.ppi.className = "ppi " + r.cls; els.ppi.textContent = r.t; }
  function fitPanel(l) {
    var sizes = [[12, 14, "12 × 14 (full front)"], [15, 15, "15 × 15 (max)"], [11, 14, "11 × 14"], [10, 12, "10 × 12"], [10, 10, "10 × 10"], [4, 4, "4 × 4 (chest)"]], cur = D.printW + "x" + D.printH;
    if (!sizes.some(function (s) { return s[0] + "x" + s[1] === cur; })) sizes.unshift([D.printW, D.printH, D.printW + " × " + D.printH + " (current)"]);
    var sz = select(sizes.map(function (s) { return [s[0] + "x" + s[1], s[2] + " in"]; }), cur, function (v) { var p = v.split("x"); commit(); D.printW = +p[0]; D.printH = +p[1]; FIT.note = ""; var l2 = L(); if (l2 && l2.cover) { var a2 = A(l2.asset), g = a2 && coverGeom(a2); if (g) { l2.s = g.s; clampCover(l2); } } afterChange(); }, "Print size the fit tools aim at");
    var b1 = btn("🪄 Smart Fit", function () { smartFit(l); }, "go", "Checks your photo against the print size and picks: Crop to Fill (free) if the subject survives the crop, otherwise AI Extend (≈ $0.02), then AI Upscale (free) if it's under the PPI your printer needs.");
    var b2 = btn("✂ Crop to Fill · free", function () { cropToFill(l); }, "", "Zooms the photo to cover the whole print area, centered on the subject. Drag to reposition.");
    var b3 = btn("🧩 AI Extend · ≈ $0.02", function () { aiExtend(l); }, "", "Grok Imagine paints new scene into the empty strips so nothing is cut off. Your original pixels stay in the middle; new layer with Undo.");
    var b4 = btn("🔍 AI Upscale · free", function () { aiUpscale(l); }, "", "ESRGAN AI upscaler running on your device (free). Enlarges to the PPI your printer needs (max 4×).");
    els.fitBtns = [b1, b2, b3, b4]; els.fitBusy = h("div", { cls: "status", "data-pm": "tee-fit-busy", text: FIT.busy });
    var q = quality(l);
    ap(els.fitBox = h("div", { cls: "fitbox", "data-pm": "tee-fit" }), h("h4", { text: "Fit & print quality" }),
      h("div", { cls: "row" }, [h("span", { cls: "muted", text: "Print size:" }), sz, q ? h("span", { cls: "muted", text: "photo " + ratioTxt(A(l.asset).w, A(l.asset).h) + " · area " + ratioTxt(D.printW, D.printH) }) : null]),
      h("div", { cls: "row" }, [b1, b2, b3, b4, FIT.cancel ? btn("Stop", function () { try { FIT.cancel.abort(); } catch (e) {} }, "sm") : null]),
      h("div", { cls: "muted", text: "Smart Fit is free unless it needs AI Extend (≈ $0.02, Grok — the cost is shown after). Crop to Fill and AI Upscale run on your device for $0. Your original is never changed." }),
      els.fitBusy, FIT.banner ? h("div", { cls: "banner", "data-pm": "tee-fit-banner", text: FIT.banner }) : null, FIT.note ? h("div", { cls: "fitnote", "data-pm": "tee-fit-note", text: FIT.note }) : null);
    if (FIT.busy) busy(FIT.busy);
    return els.fitBox;
  }

  // ---------- DOM helpers ----------
  function h(tag, at, kids) {
    var e = document.createElement(tag); at = at || {};
    for (var k in at) { var v = at[k]; if (v == null || v === false) continue;
      if (k === "cls") e.className = v; else if (k === "text") e.textContent = v; else if (k === "on") { for (var ev in v) e.addEventListener(ev, v[ev]); }
      else if (k === "style") e.style.cssText = v; else if (k in e && k !== "list" && k !== "type") { try { e[k] = v; } catch (x) { e.setAttribute(k, v); } } else e.setAttribute(k, v === true ? "" : v); }
    (kids || []).forEach(function (c) { if (c == null || c === false || c === "") return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function ap(el) { for (var i = 1; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false || c === "") continue; el.append(c); } }
  function btn(text, fn, cls, title) { return h("button", { type: "button", cls: cls || "", text: text, title: title || null, on: { click: function (e) { e.preventDefault(); fn(e); } } }); }
  var editing = false;
  function begin() { if (!editing) { commit(); editing = true; } }
  function end() { editing = false; }
  function slider(label, val, min, max, step, fn, fmt) {
    var out = h("span", { cls: "val", text: fmt ? fmt(val) : String(val) });
    var r = h("input", { type: "range", min: min, max: max, step: step, value: val, on: { input: function () { begin(); var v = +r.value; out.textContent = fmt ? fmt(v) : String(v); fn(v); draw(); }, change: function () { end(); refreshChecksSoon(); } } });
    r.setAttribute("aria-label", label);
    return h("label", { cls: "sl" }, [h("span", { text: label }), r, out]);
  }
  function colorIn(label, val, fn) { var c = h("input", { type: "color", value: val || "#ffffff", on: { input: function () { begin(); fn(c.value); draw(); }, change: function () { end(); refreshChecksSoon(); } } }); return h("label", { cls: "ci" }, [h("span", { text: label }), c]); }
  function select(opts, val, fn, title) { var s = h("select", { title: title || null, on: { change: function () { fn(s.value); } } }, opts.map(function (o) { return h("option", { value: o[0], text: o[1] }); })); s.value = val; return s; }

  var CSS = ".pmtee{font-family:'IBM Plex Sans',system-ui,sans-serif;color:#f5f0e8;font-size:13px}.pmtee *{box-sizing:border-box}.pmtee h4{font:600 15px 'IBM Plex Sans',sans-serif;margin:10px 0 6px;color:#fde68a}.pmtee .flow{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 10px}.pmtee .flow button{font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#cbd5e1;cursor:pointer}.pmtee .flow button.on{background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;border-color:transparent}.pmtee .flow i{opacity:.5;font-style:normal;align-self:center}.pmtee .wrap{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:14px;align-items:start}@media(max-width:900px){.pmtee .wrap{grid-template-columns:1fr}}.pmtee .stagecol{position:sticky;top:8px}@media(max-width:900px){.pmtee .stagecol{position:static}}@media(min-width:901px){.pmtee .tbody{max-height:calc(100vh - 150px);overflow:auto;padding-right:4px}}.pmtee canvas.stage{width:100%;height:auto;border-radius:14px;border:1px solid rgba(255,255,255,.1);touch-action:none;background:#1b1b20;display:block}.pmtee canvas.stage.tool{cursor:crosshair}.pmtee .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.pmtee button{font:600 12px 'IBM Plex Sans',sans-serif;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f1f5f9;cursor:pointer}.pmtee button:hover{border-color:#c084fc}.pmtee button:disabled{opacity:.45;cursor:default}.pmtee button.go{background:linear-gradient(90deg,#7c3aed,#db2777);border-color:transparent;color:#fff}.pmtee button.gold{background:linear-gradient(90deg,#f59e0b,#ef4444);border-color:transparent;color:#fff}.pmtee button.on{background:#7c3aed;border-color:#c084fc}.pmtee button.sm{padding:3px 7px;font-size:11px}.pmtee .tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}.pmtee .tabs button{flex:1 1 auto;font-size:11.5px;padding:6px 7px}.pmtee .panel{background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px;min-height:300px}.pmtee .muted{color:#94a3b8;font-size:12px;line-height:1.45}.pmtee .sl{display:grid;grid-template-columns:96px 1fr 52px;gap:8px;align-items:center;margin:4px 0;font-size:12px}.pmtee .sl input{width:100%}.pmtee .val{text-align:right;color:#cbd5e1;font-variant-numeric:tabular-nums}.pmtee .ci{display:inline-flex;gap:6px;align-items:center;font-size:12px;margin-right:10px}.pmtee .ci input{width:34px;height:26px;border:none;background:none;padding:0}.pmtee select,.pmtee input[type=text],.pmtee input[type=number],.pmtee textarea{background:#0b0b10;color:#f5f0e8;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;font:13px 'IBM Plex Sans',sans-serif;max-width:100%}.pmtee textarea{width:100%;min-height:70px;resize:vertical}.pmtee input[type=number]{width:76px}.pmtee .sw{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0}.pmtee .sw.on{border-color:#facc15;box-shadow:0 0 0 2px #facc15}.pmtee .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}.pmtee .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:6px;font-size:11px;overflow:hidden}.pmtee .card img{width:100%;aspect-ratio:1;object-fit:contain;background:repeating-conic-gradient(#2a2a30 0 25%,#1d1d22 0 50%) 0 0/16px 16px;border-radius:6px;display:block}.pmtee .card .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:4px 0 2px;color:#e2e8f0}.pmtee .drop{border:2px dashed rgba(192,132,252,.5);border-radius:12px;padding:14px;text-align:center;color:#cbd5e1;margin:8px 0}.pmtee .drop.over{background:rgba(124,58,237,.18)}.pmtee .chip{display:inline-flex;align-items:center;gap:4px;margin:2px;padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);font-size:11.5px;cursor:pointer;color:#e2e8f0}.pmtee .chip.on{background:rgba(124,58,237,.45);border-color:#c084fc}.pmtee .chip.lock{background:rgba(245,158,11,.35);border-color:#f59e0b}.pmtee .chip b{font-weight:400;opacity:.7;cursor:pointer}.pmtee .cat{margin:8px 0;padding:6px 8px;border-left:3px solid #7c3aed;background:rgba(255,255,255,.02);border-radius:6px}.pmtee .cat .hd{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:12px;margin-bottom:3px}.pmtee .chk{list-style:none;padding:0;margin:6px 0}.pmtee .chk li{padding:5px 8px;margin:3px 0;border-radius:8px;font-size:12px;line-height:1.4}.pmtee .chk li.ok{background:rgba(34,197,94,.1);border-left:3px solid #22c55e}.pmtee .chk li.fail{background:rgba(239,68,68,.12);border-left:3px solid #ef4444}.pmtee .chk li.warn{background:rgba(245,158,11,.12);border-left:3px solid #f59e0b}.pmtee .chk li.info{background:rgba(56,189,248,.08);border-left:3px solid #38bdf8}.pmtee .ready{font:700 15px 'IBM Plex Sans',sans-serif;color:#86efac;background:rgba(34,197,94,.12);border:1px solid #22c55e;border-radius:10px;padding:8px 10px;margin:6px 0}.pmtee .prep{font:700 14px 'IBM Plex Sans',sans-serif;color:#fcd34d;background:rgba(245,158,11,.12);border:1px solid #f59e0b;border-radius:10px;padding:8px 10px;margin:6px 0}.pmtee .banner{background:rgba(239,68,68,.15);border:1px solid #ef4444;color:#fecaca;border-radius:10px;padding:8px 10px;margin:6px 0;font-weight:600}.pmtee .layer{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:8px;border:1px solid rgba(255,255,255,.08);margin:3px 0;cursor:pointer}.pmtee .layer.on{border-color:#38bdf8;background:rgba(56,189,248,.08)}.pmtee .layer span{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.pmtee .status{min-height:18px;color:#fde68a;font-size:12px;margin:6px 2px}.pmtee .res img{max-width:100%;border-radius:10px;display:block;margin:6px 0;background:repeating-conic-gradient(#2a2a30 0 25%,#1d1d22 0 50%) 0 0/16px 16px}.pmtee .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,197,94,.15);border:1px solid #22c55e;color:#bbf7d0}.pmtee .badge.free{background:rgba(239,68,68,.15);border-color:#ef4444;color:#fecaca}.pmtee .strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}.pmtee .strip canvas{width:100%;border-radius:8px;cursor:pointer;border:2px solid transparent}.pmtee .strip canvas.on{border-color:#facc15}.pmtee .ppi{font:600 12px 'IBM Plex Sans',sans-serif;padding:6px 9px;border-radius:9px;margin:4px 0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#e2e8f0}.pmtee .ppi.ok{border-color:#22c55e;background:rgba(34,197,94,.1)}.pmtee .ppi.warn{border-color:#f59e0b;background:rgba(245,158,11,.1)}.pmtee .ppi.fail{border-color:#ef4444;background:rgba(239,68,68,.1)}.pmtee .fitbox{border:1px solid rgba(192,132,252,.35);border-radius:12px;padding:4px 10px 8px;margin:8px 0;background:rgba(124,58,237,.07)}.pmtee .fitnote{background:rgba(56,189,248,.08);border-left:3px solid #38bdf8;border-radius:8px;padding:7px 9px;margin:6px 0;font-size:12px;line-height:1.45}.pmtee .cue{background:linear-gradient(90deg,rgba(244,114,182,.14),rgba(124,58,237,.14));border:1px solid rgba(244,114,182,.35);border-radius:12px;padding:8px 10px;margin:4px 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}";
  var FONT_URL = "https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Black+Ops+One&family=Bungee&family=Monoton&family=Oswald:wght@600;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@700&family=Rubik+Mono+One&family=UnifrakturMaguntia&display=swap";
  function css() {
    if (!document.getElementById("pmtee-css")) { var s = document.createElement("style"); s.id = "pmtee-css"; s.textContent = CSS; document.head.appendChild(s); }
    if (!document.getElementById("pmtee-fonts")) { var l = document.createElement("link"); l.id = "pmtee-fonts"; l.rel = "stylesheet"; l.href = FONT_URL; l.onload = function () { if (document.fonts) document.fonts.ready.then(function () { draw(); }); }; document.head.appendChild(l); }
  }

  // ---------- layers ----------
  function fitLayer(l, a) {
    var art = a.h / a.w, maxS = Math.min(0.92, 0.92 * (D.printH / D.printW) / art);
    l.s = Math.max(0.05, maxS); l.x = 0.5; l.y = Math.min(0.5, 0.04 + (l.s * D.printW * art) / D.printH / 2);
  }
  function addImageLayer(rec, opts) {
    opts = opts || {};
    return loadAsset(rec.id).then(function (a) {
      if (!a) return msg("Couldn't open that image");
      commit();
      var l = { t: "img", asset: rec.id, orig: rec.kind === "original" ? rec.id : (rec.parent || rec.id), x: 0.5, y: 0.45, s: 0.8, rot: 0, fx: "none", adj: {}, c1: "#ffffff", c2: "#d61f2c", lv: 4, amt: 50 };
      fitLayer(l, a);
      if (opts.replace && L() && L().t === "img") { var o = L(); l.x = o.x; l.y = o.y; l.s = o.s; l.rot = o.rot; D.layers[sel] = l; }
      else { D.layers.push(l); sel = D.layers.length - 1; }
      if (!D.name || D.name === "Untitled design") D.name = (a.rec.name || "Design").slice(0, 40);
      afterChange(); msg("Artwork added to the shirt", a.w + " × " + a.h + " px · original kept untouched");
      if (tab === "art") { tab = "edit"; renderTab(); }
    });
  }
  function addText() {
    commit();
    D.layers.push({ t: "txt", text: "ZIG FLAMES", font: "Bebas Neue", size: 0.14, color: lum(shirtHex()) > 0.6 ? "#111111" : "#ffffff", stroke: "#d61f2c", sw: 0, x: 0.5, y: 0.86, rot: 0, arc: 0, ls: 4 });
    sel = D.layers.length - 1; tab = "edit"; afterChange(); fontsReady().then(draw);
  }
  function moveLayer(i, dir) { var j = i + dir; if (j < 0 || j >= D.layers.length) return; commit(); var t = D.layers[i]; D.layers[i] = D.layers[j]; D.layers[j] = t; sel = j; afterChange(); }
  function delLayer(i) { commit(); D.layers.splice(i, 1); sel = Math.max(0, Math.min(sel, D.layers.length - 1)); afterChange(); }
  function dupLayer(i) { commit(); var c = JSON.parse(JSON.stringify(D.layers[i])); c.x = Math.min(0.95, c.x + 0.04); c.y = Math.min(0.95, c.y + 0.04); D.layers.splice(i + 1, 0, c); sel = i + 1; afterChange(); }
  function preload() { return Promise.all(D.layers.filter(function (l) { return l.t === "img"; }).map(function (l) { return Promise.all([loadAsset(l.asset), loadAsset(l.orig)]); })); }
  function afterChange() { preload().then(function () { draw(); renderTab(); refreshStageControls(); refreshChecksSoon(); }); }

  // ---------- stage interaction (drag to move, wheel / pinch to resize, click tools) ----------
  function stagePt(e) { var r = els.stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 1000, y: (e.clientY - r.top) / r.height * 1100 }; }
  function toArt(p) { var r = printRect(); return { x: (p.x - r.x) / r.w, y: (p.y - r.y) / r.h, r: r }; }
  function hit(p) {
    var r = printRect(), mc = measCtx();
    for (var i = D.layers.length - 1; i >= 0; i--) {
      var l = D.layers[i]; if (l.hidden) continue; var b = layerBox(l, r.w, r.h, mc); if (!b) continue;
      var dx = p.x - r.x - b.cx, dy = p.y - r.y - b.cy, a = -b.rot * Math.PI / 180, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= b.hw + 8 && Math.abs(ly) <= b.hh + 8) return i;
    }
    return -1;
  }
  function imgPx(l, p) { // stage point -> pixel in the layer's image
    var a = A(l.asset), r = printRect(); if (!a) return null; var w = l.s * r.w, hh = w * a.h / a.w;
    var dx = p.x - r.x - l.x * r.w, dy = p.y - r.y - l.y * r.h, an = -(l.rot || 0) * Math.PI / 180, lx = dx * Math.cos(an) - dy * Math.sin(an), ly = dx * Math.sin(an) + dy * Math.cos(an);
    if (l.flip) lx = -lx; var u = (lx + w / 2) / w, v = (ly + hh / 2) / hh; if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
    return { x: Math.floor(u * a.w), y: Math.floor(v * a.h) };
  }
  var ptrs = {}, drag = null;
  function bindStage(c) {
    c.addEventListener("pointerdown", function (e) {
      var p = stagePt(e); c.setPointerCapture && c.setPointerCapture(e.pointerId); ptrs[e.pointerId] = p;
      if (tool === "erase" || tool === "key") {
        var l = L(); var q = l && l.t === "img" ? imgPx(l, p) : null;
        if (!q) return msg("Click on the image you selected");
        var m = tool; tool = "move"; c.classList.remove("tool"); runBg({ mode: m === "erase" ? "point" : "global", x: q.x, y: q.y, tol: +(els.tol ? els.tol.value : 30) }); return;
      }
      var ids = Object.keys(ptrs);
      if (ids.length === 2 && L()) { var a0 = ptrs[ids[0]], b0 = ptrs[ids[1]]; drag = { pinch: true, d0: Math.hypot(a0.x - b0.x, a0.y - b0.y), s0: L().t === "img" ? L().s : L().size }; return; }
      var i = hit(p); if (i >= 0 && i !== sel) { sel = i; renderTab(); }
      var l2 = L(); if (i < 0 || !l2) { drag = null; draw(); return; }
      commit(); drag = { p0: p, x0: l2.x, y0: l2.y }; draw();
    });
    c.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return; var p = stagePt(e); ptrs[e.pointerId] = p; var l = L(); if (!drag || !l) return;
      if (drag.pinch) { var ids = Object.keys(ptrs); if (ids.length < 2) return; var a = ptrs[ids[0]], b = ptrs[ids[1]], f = Math.hypot(a.x - b.x, a.y - b.y) / (drag.d0 || 1); if (l.t === "img") l.s = clamp(drag.s0 * f, 0.03, 2); else l.size = clamp(drag.s0 * f, 0.02, 0.8); draw(); return; }
      var r = printRect(); l.x = clamp(drag.x0 + (p.x - drag.p0.x) / r.w, -0.5, 1.5); l.y = clamp(drag.y0 + (p.y - drag.p0.y) / r.h, -0.5, 1.5); if (l.cover) clampCover(l); draw();
    });
    function up(e) { delete ptrs[e.pointerId]; if (drag) { drag = null; renderTab(); refreshChecksSoon(); } }
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", function (e) { var l = L(); if (!l) return; e.preventDefault(); begin(); var f = e.deltaY < 0 ? 1.04 : 1 / 1.04; if (l.t === "img") l.s = clamp(l.s * f, 0.03, 2); else l.size = clamp(l.size * f, 0.02, 0.8); draw(); clearTimeout(c._wt); c._wt = setTimeout(function () { end(); renderTab(); refreshChecksSoon(); }, 300); }, { passive: false });
  }

  // ---------- vocabulary (the ONE existing Vocabulary Bank) ----------
  function VB() { return (api && api.current && api.current.vocab) || null; }
  function cats() { var v = VB(); return v && Array.isArray(v.categories) ? v.categories : (window.PMCtx ? window.PMCtx.categories() : []); }
  function clothCats(all) { return cats().filter(function (c) { return all || CLOTH_RE.test(c.name || "") || /style:fashion/.test(c.linkTo || "") || STARTER.some(function (s) { return s.name.toLowerCase() === String(c.name).toLowerCase(); }); }); }
  var PK = "pm_tee_picks_v1";
  function picks() { return J(PK, []); }
  function setPicks(p) { SJ(PK, p.slice(0, 40)); }
  function togglePick(w, cat) { var p = picks(), i = p.findIndex(function (x) { return x.w.toLowerCase() === w.toLowerCase(); }); if (i >= 0) p.splice(i, 1); else p.push({ w: w, cat: cat, lock: false }); setPicks(p); }
  function seedStarter(force) {
    var v = VB(); if (!v || !v.addCategory || !v.massAdd) return 0;
    if (!force && J("pm_tee_seeded_v1", 0)) return 0;
    var have = {}; cats().forEach(function (c) { have[String(c.name).toLowerCase()] = 1; }); var n = 0;
    STARTER.forEach(function (s) { if (have[s.name.toLowerCase()]) return; var id = v.addCategory(s.name, s.color); v.massAdd(id, s.words.join("\n")); if (v.setCategoryMeta) v.setCategoryMeta(id, { linkTo: s.link }); n++; });
    SJ("pm_tee_seeded_v1", 1); return n;
  }
  function remixPicks() {
    var p = picks(), keep = p.filter(function (x) { return x.lock; }), pool = [];
    clothCats(false).forEach(function (c) { if (/print method/i.test(c.name)) return; (c.chips || []).forEach(function (x) { if (x && x.text) pool.push({ w: x.text, cat: c.name }); }); });
    if (!pool.length) STARTER.forEach(function (s) { if (s.link !== "off" || s.name !== "Print Methods") s.words.forEach(function (w) { pool.push({ w: w, cat: s.name }); }); });
    var n = Math.max(3, Math.min(8, p.length - keep.length || 5)), have = {}; keep.forEach(function (x) { have[x.w.toLowerCase()] = 1; });
    // one per category first (variety), then random
    var byCat = {}; shuffle(pool).forEach(function (x) { (byCat[x.cat] = byCat[x.cat] || []).push(x); });
    var fresh = []; Object.keys(byCat).forEach(function (k) { var x = byCat[k][0]; if (fresh.length < n && !have[x.w.toLowerCase()]) { fresh.push(x); have[x.w.toLowerCase()] = 1; } });
    shuffle(pool).forEach(function (x) { if (fresh.length < n && !have[x.w.toLowerCase()]) { fresh.push(x); have[x.w.toLowerCase()] = 1; } });
    setPicks(keep.concat(fresh.map(function (x) { return { w: safe(x.w), cat: x.cat, lock: false }; })));
  }
  function subjectProfile() { // "Subject Profile" = the Character builder's current picks (no body / heat fields)
    var s = (api.current && api.current.state) || J("flux-character-builder:draft", {}) || {};
    function v(k) { var x = s[k]; return Array.isArray(x) ? x.filter(Boolean).slice(0, 3).join(", ") : (typeof x === "string" ? x : ""); }
    var who = [v("gender"), v("role")].filter(Boolean).join(" "), hair = [v("hairColor"), v("hairStyle") || v("hairCut")].filter(Boolean).join(" ");
    var wear = [v("top"), v("bottom"), v("footwear")].filter(Boolean).join(", "), parts = [];
    if (who) parts.push("original adult (21+) " + who + " character");
    if (hair) parts.push(hair + " hair"); if (wear) parts.push("wearing " + wear); if (v("accessories")) parts.push(v("accessories"));
    if (v("expression")) parts.push(v("expression") + " expression"); if (v("styleTag")) parts.push(v("styleTag")); if (v("colorPalette")) parts.push(v("colorPalette") + " palette"); if (v("era")) parts.push(v("era"));
    return safe(parts.join(", "));
  }

  // ---------- Grok ----------
  var G = J("pm_tee_grok_v1", { idea: "", subject: "", text: "", style: "", method: "DTF transfer (direct-to-film)", bg: "white", prompts: [], cur: 0, title: "" });
  function saveG() { SJ("pm_tee_grok_v1", G); }
  function adultMode() { return !!(api.current && api.current.adult); }
  function localPrompts(n, remix) {
    var p = picks().map(function (x) { return x.w; }), out = [];
    var styles = STARTER[2].words;
    for (var i = 0; i < n; i++) {
      var ws = p.filter(function (x, k) { return picks()[k] && picks()[k].lock; }).concat(shuffle(p.filter(function (x, k) { return !(picks()[k] && picks()[k].lock); })).slice(0, 4));
      out.push(safe([G.subject || "", G.idea || "", ws.join(", "), (G.style || pick(styles)), G.text ? "bold legible lettering that reads \"" + G.text + "\"" : "no text",
        "T-shirt graphic for " + (G.method || "DTF transfer") + ", isolated on a " + (G.bg === "black" ? "pure flat black" : G.bg === "green" ? "pure flat chroma green" : "pure flat white") + " background, centered, bold clean edges, high contrast, limited color palette that pops on a " + shirtName() + " shirt, no shirt, no mockup, no watermark"].filter(Boolean).join(", ")));
    }
    return out;
  }
  function shirtName() { return D.shirt === "custom" ? "custom-color" : (SHIRTS.filter(function (x) { return x[0] === D.shirt; })[0] || [0, 0, "black"])[2].toLowerCase(); }
  function writePrompts(remix, b) {
    if (remix) remixPicks();
    var ps = picks(), body = { idea: G.idea, subject: G.subject, text: G.text, style: G.style, method: G.method, shirt: shirtName(), bg: G.bg, words: ps.map(function (x) { return x.w; }), locked: ps.filter(function (x) { return x.lock; }).map(function (x) { return x.w; }), count: 3, remix: !!remix, mode: adultMode() ? "18+" : "sfw", model: "grok" };
    if (!body.idea && !body.words.length && !body.subject && !body.text) { msg("Type an idea or pick some Vocabulary Bank words first"); return Promise.resolve(); }
    if (b) { b.disabled = true; b._t = b.textContent; b.textContent = "Grok is writing…"; }
    return call("tee", body, 40000).then(function (j) {
      if (b) { b.disabled = false; b.textContent = b._t; }
      var ok = j && j._status === 200 && Array.isArray(j.prompts) && j.prompts.length;
      G.prompts = ok ? j.prompts : localPrompts(3, remix); G.cur = 0; G.title = ok ? (j.title || "") : ""; G.src = ok ? ((j.usage && j.usage.model) || "Grok") + (j.usage && j.usage.est_usd ? " · ≈ $" + j.usage.est_usd.toFixed(4) : "") + (j.usage && j.usage.credit_note ? " · " + j.usage.credit_note : "") : "on-device (AI unreachable: " + (j && j.error || "no reply") + ") · free";
      saveG(); renderTab(); msg(ok ? "Grok wrote " + G.prompts.length + " shirt-art prompts" : "AI didn't answer — built prompts on-device from your picks (free)");
    });
  }
  function refDataUrl(l) { // selected art -> white-backed JPEG <= 1024 px for Grok edit
    var a = A(l.asset), bm = layerBitmap(l, false); if (!a || !bm) return "";
    var sc = Math.min(1, 1024 / Math.max(bm.width, bm.height)), c = canvas(bm.width * sc, bm.height * sc), x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.88);
  }
  function grokImage(prompt, ref, b, label, after) {
    if (!prompt) return msg("Write or pick a prompt first");
    if (b) { b.disabled = true; b._t = b.textContent; b.textContent = "Grok Imagine is drawing… (10-40 s)"; }
    els.gout.replaceChildren(h("div", { cls: "muted", text: "Waiting for Grok Imagine… " + (ref ? "(edit from your art, ≈ $0.04)" : "(≈ $0.02)") }));
    return call("studio_render", { model: "grok-imagine", mode: "image", prompt: prompt, aspectRatio: "1:1", contentMode: adultMode() ? "18+" : "sfw", imageUrl: ref || undefined }, 120000).then(function (j) {
      if (b) { b.disabled = false; b.textContent = b._t; }
      if (!j || j._status !== 200 || j.ok === false || !j.url) { els.gout.replaceChildren(h("div", { cls: "banner", text: "Grok didn't make an image: " + (j && (j.error || j.notice) || "no reply") + (j && j.filter ? " (blocked by the safety rules)" : "") })); return; }
      var im = h("img", { src: j.url, alt: label || "Grok art", "data-pm-tee": "no" });
      var cost = h("div", { cls: "muted", text: (j.cost && j.cost.est_usd ? "Charged ≈ $" + Number(j.cost.est_usd).toFixed(3) : "Free · $0") + (j.cost && j.cost.cap_usd ? " · site today $" + Number(j.cost.today_usd || 0).toFixed(2) + " of $" + j.cost.cap_usd + " cap" : "") });
      if (j.fallback) {
        // honest: this is NOT a Grok image
        var use = btn("Use this free preview anyway", function () { use.disabled = true; T().loadBlob(j.url).then(function (bl) { if (!bl) throw new Error("couldn't copy the preview"); return T().addAsset(bl, { source: "Free preview (Pollinations) — not Grok", prompt: prompt, name: "Free preview" }); }).then(function (rec) { return addImageLayer(rec); }).catch(function (e) { msg(e.message); use.disabled = false; }); }, "sm");
        els.gout.replaceChildren(h("div", { cls: "banner", text: "🛡 Grok did NOT make this — " + (j.notice || "Grok failed") + " This is a FREE Pollinations preview, not Grok." }), h("span", { cls: "badge free", text: "Engine: " + (j.engine || "Free preview · Pollinations") }), h("div", { cls: "res" }, [im]), cost, h("div", { cls: "row" }, [use]));
        return;
      }
      els.gout.replaceChildren(h("span", { cls: "badge", text: "✅ Engine: " + (j.engine || "Grok Imagine (xAI)") }), h("div", { cls: "res" }, [im]), cost, h("div", { cls: "muted", text: "Copying it into your artwork library…" }));
      return T().loadBlob(j.url).then(function (bl) {
        if (!bl) throw new Error("Grok made it, but the image couldn't be copied — open it and use Import");
        return T().addAsset(bl, { source: "Grok Imagine (xAI)" + (ref ? " · variation" : ""), prompt: j.prompt || prompt, name: label || G.title || "Grok art" });
      }).then(function (rec) {
        window.__pmTeeLastGrok = { engine: j.engine, provider: j.provider, cost: j.cost, w: rec.w, h: rec.h, asset: rec.id };
        els.gout.lastChild.textContent = "Added to your design and artwork library (" + rec.w + " × " + rec.h + " px). Next: remove its background in ② Customize.";
        return after ? after(rec) : addImageLayer(rec);
      }).catch(function (e) { els.gout.lastChild.textContent = e.message; });
    });
  }

  // ---------- library + saved designs ----------
  var thumbs = {};
  function thumbUrl(rec) { if (!thumbs[rec.id]) thumbs[rec.id] = URL.createObjectURL(rec.blob); return thumbs[rec.id]; }
  function saveDesign() {
    var c = canvas(300, 330), x = c.getContext("2d"); renderMockup(x, 0.3, false);
    var rec = { id: D.id, name: D.name || "Untitled design", data: JSON.parse(JSON.stringify(D)), thumb: c.toDataURL("image/jpeg", 0.8), createdAt: D.createdAt, updatedAt: Date.now() };
    return T().db.put("designs", rec).then(function () { dirty = false; msg("Design saved on this device", rec.name + " — reopen it any time from ① Artwork"); if (tab === "art") renderTab(); }).catch(function (e) { msg("Save failed: " + e.message); });
  }
  function openDesign(rec) { commit(); D = JSON.parse(JSON.stringify(rec.data)); sel = 0; afterChange(); msg("Opened design", rec.name); }
  function importFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!list.length) return msg("That isn't an image file (PNG, JPG, WEBP)");
    return list.reduce(function (p, f) { return p.then(function () { return T().addAsset(f, { source: "Import", name: f.name.replace(/\.[a-z0-9]+$/i, "") }).then(function (rec) { return addImageLayer(rec); }); }); }, Promise.resolve()).catch(function (e) { msg(e.message); });
  }
  function onPaste(e) {
    if (!mounted || !root || !root.isConnected) return;
    var items = (e.clipboardData && e.clipboardData.items) || [], fs = [];
    for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) fs.push(items[i].getAsFile());
    if (fs.length) { e.preventDefault(); importFiles(fs); }
  }

  // ---------- tabs ----------
  var TABS = [["art", "① Create / Import"], ["edit", "② Customize"], ["grok", "③ Grok + Vocab"], ["prev", "④ Preview"], ["dtf", "⑤ DTF + Export"]];
  function renderTab() {
    if (!els.body) return;
    Object.keys(els.tabs).forEach(function (k) { els.tabs[k].className = k === tab ? "on" : ""; });
    els.flow.querySelectorAll("button").forEach(function (b) { b.className = b.getAttribute("data-t") === tab ? "on" : ""; });
    var f = { art: tabArt, edit: tabEdit, grok: tabGrok, prev: tabPrev, dtf: tabDtf }[tab] || tabArt, st = els.body.scrollTop;
    els.body.replaceChildren(); f(els.body); els.body.scrollTop = st;
  }
  function tabArt(el) {
    var fi = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true, style: "display:none", on: { change: function () { importFiles(fi.files); fi.value = ""; } } });
    var drop = h("div", { cls: "drop", text: "Drop images here · or paste (Ctrl/⌘+V) · PNG with transparency is best for logos" });
    ["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); if (ev === "drop") importFiles(e.dataTransfer.files); }); });
    var url = h("input", { type: "text", placeholder: "…or paste an image link (https://…)", style: "flex:1;min-width:180px" });
    var name = h("input", { type: "text", value: D.name || "", placeholder: "Design name", on: { change: function () { commit(); D.name = name.value.trim() || "Untitled design"; } } });
    ap(el, fi,
      h("h4", { text: "Create or import artwork" }),
      h("div", { cls: "row" }, [btn("⬆ Import image", function () { fi.click(); }, "go", "Upload a photo, illustration, logo, or an image you made in the Grok app"), btn("🎨 Create with Grok", function () { tab = "grok"; renderTab(); }), btn("🔤 Add text only", addText)]),
      drop,
      h("div", { cls: "row" }, [url, btn("Fetch", function () { var u = url.value.trim(); if (!/^https?:\/\//.test(u)) return msg("Paste a full https:// link"); T().send(u, { source: "Link", navigate: false, name: "Linked image" }).then(function (a) { return T().db.del("kv", "pending").then(function () { return addImageLayer(a); }); }).catch(function () {}); })]),
      h("div", { cls: "muted", text: "Made something in the Grok app? Save it to your phone, then Import it here. Anything shown in the Prompt Machine (AI Studio renders, Grok Imagine results, Gallery, characters, previews) has a 👕 button that sends it here — the original file is kept untouched." }),
      h("h4", { text: "Design" }),
      h("div", { cls: "row" }, [name, btn("💾 Save design", saveDesign, "go"), btn("✚ New design", function () { if (D.layers.length && dirty && !confirm("Start a new design? Unsaved changes stay in Undo only.")) return; commit(); D = newDesign(); sel = 0; afterChange(); })]));
    var dz = h("div", { cls: "grid", text: "Loading…" }), lib = h("div", { cls: "grid", text: "Loading…" });
    ap(el, h("h4", { text: "Saved designs (open to keep editing)" }), dz, h("h4", { text: "Artwork library (untouched originals)" }), lib);
    T().db.all("designs").then(function (ds) {
      dz.replaceChildren.apply(dz, ds.length ? ds.map(function (r) { return h("div", { cls: "card", "data-pm": "tee-design" }, [h("img", { src: r.thumb, alt: r.name, "data-pm-tee": "no" }), h("div", { cls: "nm", text: r.name }), h("div", { cls: "muted", text: new Date(r.updatedAt).toLocaleDateString() }), h("div", { cls: "row" }, [btn("Open", function () { openDesign(r); }, "sm go"), btn("✕", function () { if (confirm("Delete saved design \"" + r.name + "\" from this device?")) T().db.del("designs", r.id).then(renderTab); }, "sm")])]); }) : [h("div", { cls: "muted", text: "No saved designs yet — 💾 Save design keeps one on this device." })]);
    }).catch(function (e) { dz.textContent = e.message; });
    T().db.all("assets").then(function (as) {
      as = as.filter(function (a) { return a.kind === "original"; });
      lib.replaceChildren.apply(lib, as.length ? as.map(function (r) { return h("div", { cls: "card", "data-pm": "tee-asset" }, [h("img", { src: thumbUrl(r), alt: r.name, "data-pm-tee": "no" }), h("div", { cls: "nm", text: r.name, title: r.source + " · " + r.w + "×" + r.h }), h("div", { cls: "muted", text: r.source.slice(0, 26) + " · " + r.w + "×" + r.h }), h("div", { cls: "row" }, [btn("➕ Use", function () { addImageLayer(r); }, "sm go"), btn("✕", function () { if (confirm("Remove this image from the library on this device?")) T().db.del("assets", r.id).then(renderTab); }, "sm")])]); }) : [h("div", { cls: "muted", text: "Empty — import or send artwork and it shows up here." })]);
    }).catch(function (e) { lib.textContent = e.message; });
  }
  function tabEdit(el) {
    ap(el, h("h4", { text: "Layers (top = printed on top)" }));
    if (!D.layers.length) ap(el, h("div", { cls: "muted", text: "No artwork yet. Import or generate an image in ① / ③, or add text." }));
    D.layers.slice().reverse().forEach(function (l) {
      var i = D.layers.indexOf(l);
      ap(el, h("div", { cls: "layer" + (i === sel ? " on" : ""), on: { click: function () { sel = i; renderTab(); draw(); } } }, [h("span", { text: (l.t === "img" ? "🖼 " : "🔤 ") + lname(l, i) + (l.hidden ? " (hidden)" : "") }),
        btn("▲", function (e) { e.stopPropagation(); moveLayer(i, 1); }, "sm"), btn("▼", function (e) { e.stopPropagation(); moveLayer(i, -1); }, "sm"), btn(l.hidden ? "👁‍🗨" : "👁", function (e) { e.stopPropagation(); commit(); l.hidden = !l.hidden; afterChange(); }, "sm"), btn("⧉", function (e) { e.stopPropagation(); dupLayer(i); }, "sm", "Duplicate"), btn("✕", function (e) { e.stopPropagation(); delLayer(i); }, "sm", "Delete layer")]));
    });
    ap(el, h("div", { cls: "row" }, [btn("🔤 Add text", addText), btn("🖼 Add image", function () { tab = "art"; renderTab(); })]));
    var l = L(); if (!l) return;
    ap(el, h("h4", { text: "Position & size" }),
      slider("Left / right", Math.round(l.x * 100), -20, 120, 1, function (v) { l.x = v / 100; }, function (v) { return v + "%"; }),
      slider("Up / down", Math.round(l.y * 100), -20, 120, 1, function (v) { l.y = v / 100; }, function (v) { return v + "%"; }),
      l.t === "img" ? slider("Size", Math.round(l.s * 100), 3, 150, 1, function (v) { l.s = v / 100; }, function (v) { return (v / 100 * D.printW).toFixed(1) + " in"; }) : slider("Text size", Math.round(l.size * 100), 2, 60, 1, function (v) { l.size = v / 100; }, function (v) { return (v / 100 * D.printH).toFixed(1) + " in"; }),
      slider("Rotate", l.rot || 0, -180, 180, 1, function (v) { l.rot = v; }, function (v) { return v + "°"; }),
      h("div", { cls: "row" }, [btn("⊕ Center", function () { commit(); l.x = 0.5; afterChange(); }), l.t === "img" ? btn("↔ Fit print area", function () { commit(); fitLayer(l, A(l.asset)); l.cover = false; afterChange(); }) : null, l.t === "img" ? btn("⇋ Flip", function () { commit(); l.flip = !l.flip; afterChange(); }) : null, btn("⟲ Straighten", function () { commit(); l.rot = 0; afterChange(); })]),
      h("div", { cls: "muted", text: "Tip: drag the art on the shirt to move it · mouse wheel or pinch to resize." }));
    if (l.t === "img") ap(el, fitPanel(l));
    if (l.t === "img") {
      var a = A(l.asset), o = A(l.orig);
      ap(el, h("h4", { text: "Background" }));
      els.tol = h("input", { type: "range", min: 4, max: 90, value: J("pm_tee_tol", 30), on: { input: function () { tv.textContent = els.tol.value; SJ("pm_tee_tol", +els.tol.value); } } }); var tv = h("span", { cls: "val", text: String(els.tol.value) });
      ap(el, h("label", { cls: "sl" }, [h("span", { text: "Tolerance" }), els.tol, tv]),
        h("div", { cls: "row" }, [btn("✂ Auto remove background", function () { runBg({ mode: "auto", tol: +els.tol.value }); }, "go", "Removes the flat background touching the edges (great for logos and AI art on plain backgrounds)"),
          btn("🎯 Click to erase an area", function () { tool = "erase"; els.stage.classList.add("tool"); msg("Click the area to erase on the shirt preview (connected pixels of that color)"); }),
          btn("🎨 Remove a color everywhere", function () { tool = "key"; els.stage.classList.add("tool"); msg("Click the color to remove everywhere in the image (e.g. white inside letters)"); })]),
        h("div", { cls: "row" }, [btn("✨ Grok clean background (≈ $0.04)", function (e) { grokClean(e.currentTarget); }, "", "Grok redraws your art on a flat white background (may change small details), then it is cut out. Use when the auto cut struggles (photos, busy backgrounds)."),
          h("label", { cls: "ci" }, [h("input", { type: "checkbox", checked: !!l.keepBox, on: { change: function (e) { commit(); l.keepBox = e.target.checked; afterChange(); } } }), "Keep this box on purpose"])]),
        h("div", { cls: "row" }, [h("span", { cls: "muted", text: "Replace background:" }), select([["", "None (transparent)"], ["color", "Solid color"]], l.fill ? "color" : "", function (v) { commit(); l.fill = v ? (l.fill || "#ffffff") : ""; afterChange(); }),
          l.fill ? colorIn("Color", l.fill, function (v) { l.fill = v; }) : null, l.fill ? select([["rect", "Box"], ["round", "Rounded"], ["circle", "Circle"]], l.fillShape || "rect", function (v) { commit(); l.fillShape = v; afterChange(); }) : null]),
        h("div", { cls: "muted", text: "Now: " + (a ? a.w + " × " + a.h + " px" : "…") + (l.asset !== l.orig ? " · edited copy" : " · original") + (o && l.asset !== l.orig ? " — original " + o.w + " × " + o.h + " px is kept" : "") }),
        h("div", { cls: "row" }, [btn("↺ Reset to original", function () { commit(); l.asset = l.orig; l.fx = "none"; l.adj = {}; l.fill = ""; afterChange(); msg("Back to the untouched original"); }, "gold")]));
      ap(el, h("h4", { text: "Colors & graphic style" }),
        h("div", { cls: "row" }, [select(FX, l.fx || "none", function (v) { commit(); l.fx = v; afterChange(); }, "Graphic style")]),
        /stencil|duotone|halftone/.test(l.fx) ? h("div", { cls: "row" }, [colorIn(l.fx === "duotone" ? "Light ink" : "Ink", l.c1 || "#ffffff", function (v) { l.c1 = v; }), l.fx === "duotone" ? colorIn("Dark ink", l.c2 || "#d61f2c", function (v) { l.c2 = v; }) : null]) : null,
        l.fx === "posterize" ? slider("Levels", l.lv || 4, 2, 8, 1, function (v) { l.lv = v; }) : null,
        /stencil|distress|halftone/.test(l.fx) ? slider(l.fx === "distress" ? "Wear" : l.fx === "halftone" ? "Dot size" : "Threshold", l.amt == null ? 50 : l.amt, 0, 100, 1, function (v) { l.amt = v; }) : null,
        slider("Brightness", (l.adj || {}).bri || 0, -100, 100, 1, function (v) { l.adj = Object.assign({}, l.adj, { bri: v }); }),
        slider("Contrast", (l.adj || {}).con || 0, -100, 100, 1, function (v) { l.adj = Object.assign({}, l.adj, { con: v }); }),
        slider("Saturation", (l.adj || {}).sat || 0, -100, 100, 1, function (v) { l.adj = Object.assign({}, l.adj, { sat: v }); }),
        slider("Opacity", Math.round((l.op == null ? 1 : l.op) * 100), 10, 100, 1, function (v) { l.op = v / 100; }, function (v) { return v + "%"; }),
        h("div", { cls: "row" }, [btn("✨ AI variation of this art (≈ $0.04)", function (e) { tab = "grok"; renderTab(); grokVariation(e.currentTarget); }), btn("Copy prompt", function () { copy(a && a.rec.prompt || G.prompts[G.cur] || ""); }, "sm")]));
    } else {
      var ti = h("input", { type: "text", value: l.text, style: "width:100%", on: { focus: begin, input: function () { l.text = ti.value; draw(); }, change: function () { end(); refreshChecksSoon(); } } });
      ap(el, h("h4", { text: "Text" }), ti,
        h("div", { cls: "row" }, [select(FONTS.map(function (f) { return [f, f]; }), l.font || "Bebas Neue", function (v) { commit(); l.font = v; fontsReady().then(function () { afterChange(); }); }, "Font"), colorIn("Fill", l.color, function (v) { l.color = v; }), colorIn("Outline", l.stroke || "#000000", function (v) { l.stroke = v; })]),
        slider("Outline", l.sw || 0, 0, 30, 1, function (v) { l.sw = v; }, function (v) { return v + "%"; }),
        slider("Arc / curve", l.arc || 0, -180, 180, 5, function (v) { l.arc = v; }, function (v) { return v + "°"; }),
        slider("Spacing", l.ls || 0, -10, 60, 1, function (v) { l.ls = v; }));
    }
  }
  function copy(t) { if (!t) return msg("Nothing to copy yet"); try { navigator.clipboard.writeText(t).then(function () { msg("Prompt copied", t.slice(0, 70) + "…"); }, function () { window.prompt("Copy this prompt:", t); }); } catch (e) { window.prompt("Copy this prompt:", t); } }
  function grokVariation(b) {
    var l = L(); if (!l || l.t !== "img") return msg("Select an image layer first");
    var base = (G.prompts[G.cur] || "") || (A(l.asset) && A(l.asset).rec.prompt) || picks().map(function (x) { return x.w; }).join(", ");
    var p = "Create a fresh variation of this T-shirt graphic with the same subject and spirit: new composition and details" + (base ? ", " + base.slice(0, 600) : "") + ". Isolated print graphic on a pure flat white background, bold clean edges, high contrast, no shirt, no mockup, no watermark.";
    return grokImage(p, refDataUrl(l), b, "AI variation");
  }
  function grokClean(b) {
    var l = L(); if (!l || l.t !== "img") return msg("Select an image layer first");
    var p = "Keep this exact graphic — same subject, shapes, colors, lettering and details. Only replace the background with a pure flat white (#FFFFFF) background, no shadow, no gradient, no texture, nothing else around it.";
    return grokImage(p, refDataUrl(l), b, "Grok clean-up", function (rec) {
      commit(); l.asset = rec.id; afterChange(); setTimeout(function () { runBg({ mode: "auto", tol: 28 }); }, 200);
    });
  }
  var showAll = false;
  function tabGrok(el) {
    // --- Vocabulary Bank (shared) ---
    var ps = picks();
    ap(el, h("h4", { text: "Your Vocabulary Bank picks" }),
      h("div", { cls: "muted", text: "These words come from your ONE Vocabulary Bank (same bank as Remix, Seed Expander and Fashion Editorial). Click a word to pick it · 🔒 lock keeps it through Remix · ✎ edits it in the bank · new words you add here are saved to the bank." }));
    var pw = h("div", { "data-pm": "tee-picks" });
    if (!ps.length) pw.append(h("span", { cls: "muted", text: "No picks yet — click words below or hit 🎲." }));
    ps.forEach(function (x, i) {
      pw.append(h("span", { cls: "chip on" + (x.lock ? " lock" : ""), title: x.cat || "" }, [x.w, h("b", { text: x.lock ? " 🔒" : " 🔓", title: "Lock / unlock", on: { click: function () { var p = picks(); p[i].lock = !p[i].lock; setPicks(p); renderTab(); } } }), h("b", { text: " ✕", on: { click: function () { var p = picks(); p.splice(i, 1); setPicks(p); renderTab(); } } })]));
    });
    ap(el, pw, h("div", { cls: "row" }, [btn("🎲 Remix picks", function () { remixPicks(); renderTab(); }, "", "New random words from your clothing / print categories (locked words stay)"), btn("Clear unlocked", function () { setPicks(picks().filter(function (x) { return x.lock; })); renderTab(); }, "sm"),
      btn("👤 Use my Subject Profile", function () { var s = subjectProfile(); if (!s) return msg("Your Character builder is empty — fill in Character / Clothing first, or type a subject"); G.subject = s; saveG(); renderTab(); }, "sm", "Pulls the subject from your Character builder picks (no body or heat fields)")]));
    var cs = clothCats(showAll), v = VB();
    var hasStarter = STARTER.every(function (s) { return cats().some(function (c) { return String(c.name).toLowerCase() === s.name.toLowerCase(); }); });
    var catBox = h("div", { "data-pm": "tee-vocab" });
    cs.forEach(function (c) {
      var chips = (c.chips || []).slice(0, 80), pk = {}; picks().forEach(function (x) { pk[x.w.toLowerCase()] = 1; });
      var box = h("div", { cls: "cat", style: "border-left-color:" + (c.color || "#7c3aed") }, [h("div", { cls: "hd" }, [h("span", { text: c.name + " · " + (c.chips || []).length }), h("span", { cls: "muted", text: c.linkTo === "style:fashion" ? "feeds Fashion Editorial" : c.linkTo === "off" ? "studio only" : (c.linkTo || "auto") })])]);
      chips.forEach(function (x) {
        box.append(h("span", { cls: "chip" + (pk[String(x.text).toLowerCase()] ? " on" : ""), on: { click: function () { togglePick(x.text, c.name); renderTab(); } } }, [x.text, v && v.editChip ? h("b", { text: " ✎", title: "Edit this word in the Vocabulary Bank", on: { click: function (e) { e.stopPropagation(); var t = window.prompt("Edit word (saved to your Vocabulary Bank):", x.text); if (t && t.trim() && t.trim() !== x.text) { v.editChip(c.id, x.id, safe(t.trim())); setTimeout(renderTab, 60); } } } }) : null]));
      });
      if ((c.chips || []).length > 80) box.append(h("span", { cls: "muted", text: " +" + ((c.chips || []).length - 80) + " more in the Vocabulary Bank" }));
      catBox.append(box);
    });
    if (!cs.length) catBox.append(h("div", { cls: "muted", text: "No clothing / print categories in your bank yet." }));
    var addIn = h("input", { type: "text", placeholder: "Add a word to the bank…", style: "flex:1;min-width:140px" });
    var addSel = select(cats().map(function (c) { return [c.id, c.name]; }), (cs[0] || cats()[0] || {}).id || "", function () {});
    ap(el, h("div", { cls: "row" }, [btn(showAll ? "Show clothing categories only" : "Show all bank categories", function () { showAll = !showAll; renderTab(); }, "sm"), hasStarter ? null : btn("➕ Add tee starter categories to the bank", function () { var n = seedStarter(true); msg(n ? "Added " + n + " categories to your Vocabulary Bank" : "Already there"); setTimeout(renderTab, 80); }, "sm go")]),
      catBox, h("div", { cls: "row" }, [addIn, addSel, btn("➕ Add to bank", function () { var t = safe(addIn.value.trim()); if (!t || !v || !v.addChip) return msg(v ? "Type a word first" : "Vocabulary Bank not available"); v.addChip(addSel.value, t); togglePick(t, (cats().filter(function (c) { return c.id === addSel.value; })[0] || {}).name); addIn.value = ""; setTimeout(renderTab, 60); msg("Saved to your Vocabulary Bank", t); })]));
    // --- prompt + Grok ---
    var styleOpts = [["", "Any style (Grok picks)"]].concat(uniq(((cats().filter(function (c) { return /graphic style/i.test(c.name); })[0] || {}).chips || []).map(function (x) { return x.text; }).concat(STARTER[2].words)).map(function (w) { return [w, w]; }));
    var methOpts = uniq(((cats().filter(function (c) { return /print method/i.test(c.name); })[0] || {}).chips || []).map(function (x) { return x.text; }).concat(STARTER[1].words.slice(0, 12))).map(function (w) { return [w, w]; });
    var idea = h("textarea", { placeholder: "Your idea (your words win): e.g. flaming skull wearing a crown, money falling, 90s rap-tee vibe", value: G.idea || "", on: { input: function () { G.idea = idea.value; saveG(); } } });
    var subj = h("input", { type: "text", placeholder: "Subject (optional) — or 👤 Use my Subject Profile", value: G.subject || "", style: "width:100%", on: { input: function () { G.subject = subj.value; saveG(); } } });
    var lett = h("input", { type: "text", placeholder: "Lettering on the art (optional, exact words)", value: G.text || "", style: "width:100%", on: { input: function () { G.text = lett.value; saveG(); } } });
    var lastP = window.__pmLastPrompt || "";
    ap(el, h("h4", { text: "Grok shirt-art prompt" }), idea, h("div", { style: "height:6px" }), subj, h("div", { style: "height:6px" }), lett,
      h("div", { cls: "row" }, [select(styleOpts, G.style || "", function (v) { G.style = v; saveG(); }, "Graphic style"), select(methOpts, G.method || methOpts[0][0], function (v) { G.method = v; saveG(); }, "Print method"),
        select([["white", "Generate on white"], ["black", "Generate on black"], ["green", "Generate on green screen"]], G.bg || "white", function (v) { G.bg = v; saveG(); }, "Flat background Grok draws behind the art (removed afterwards)")]),
      lastP ? h("div", { cls: "row" }, [btn("⤓ Use my last Prompt Machine prompt as the idea", function () { G.idea = safe(String(window.__pmLastPrompt || "").slice(0, 400)); saveG(); renderTab(); }, "sm")]) : null,
      h("div", { cls: "row" }, [btn("✍️ Grok: write prompts (≈ $0.001)", function (e) { writePrompts(false, e.currentTarget); }, "go"), btn("🔁 Remix (new picks + new prompts)", function (e) { writePrompts(true, e.currentTarget); })]));
    if (G.prompts && G.prompts.length) {
      var ta = h("textarea", { value: G.prompts[G.cur] || "", style: "min-height:110px", on: { input: function () { G.prompts[G.cur] = ta.value; saveG(); } } });
      ap(el, h("div", { cls: "row" }, G.prompts.map(function (p, i) { return btn("Prompt " + (i + 1), function () { G.cur = i; saveG(); renderTab(); }, "sm" + (i === G.cur ? " on" : "")); }).concat([h("span", { cls: "muted", text: G.title ? "“" + G.title + "” · " + (G.src || "") : (G.src || "") })])), ta);
    }
    ap(el, h("div", { cls: "row" }, [btn("🎨 Generate with Grok Imagine (≈ $0.02)", function (e) { grokImage(G.prompts[G.cur] || localPrompts(1)[0], "", e.currentTarget, G.title || "Grok art"); }, "gold"),
      btn("✨ AI variation of selected art (≈ $0.04)", function (e) { grokVariation(e.currentTarget); }), btn("📋 Copy prompt", function () { copy(G.prompts[G.cur] || localPrompts(1)[0]); })]),
      h("div", { cls: "row" }, [btn("⬆ Import image", function () { tab = "art"; renderTab(); var f = els.body.querySelector("input[type=file]"); if (f) f.click(); }), h("a", { href: "https://grok.com/imagine", target: "_blank", rel: "noopener", text: "Open Grok Imagine app ↗", style: "color:#67e8f9;font-size:12px" }), h("span", { cls: "muted", text: "Copy prompt → make it in the Grok app → Import the saved image." })]),
      h("div", { cls: "muted", text: "Grok images arrive in your library and on the shirt automatically. If Grok refuses or fails you'll see a clearly labelled FREE preview instead — it is never passed off as Grok. Adults 21+ only · no real people." }), els.gout);
  }
  function stripColors(el) {
    var wrap = h("div", { cls: "strip" }), cur = D.shirt;
    SHIRTS.forEach(function (s) {
      var c = canvas(200, 220); c.title = s[2]; c.className = s[0] === cur ? "on" : ""; wrap.append(c);
      var save = D.shirt; D.shirt = s[0]; renderMockup(c.getContext("2d"), 0.2, false); D.shirt = save;
      c.addEventListener("click", function () { commit(); D.shirt = s[0]; afterChange(); });
    });
    ap(el, wrap);
  }
  function shirtControls() {
    var row = h("div", { cls: "row" });
    SHIRTS.forEach(function (s) { row.append(h("button", { type: "button", cls: "sw" + (D.shirt === s[0] ? " on" : ""), title: s[2], style: "background:" + s[1], on: { click: function () { commit(); D.shirt = s[0]; afterChange(); } } })); });
    var cc = h("input", { type: "color", value: D.custom || "#3b82f6", title: "Custom shirt color", on: { input: function () { D.shirt = "custom"; D.custom = cc.value; draw(); }, change: function () { commit(); afterChange(); } } });
    row.append(cc);
    return row;
  }
  function placeControls() {
    return h("div", { cls: "row" }, Object.keys(PLACE).map(function (k) {
      return btn((k === "chest" ? "♥ " : k === "back" ? "↩ " : "⬆ ") + PLACE[k].label, function () { setPlacement(k); }, D.placement === k ? "on" : "");
    }));
  }
  function setPlacement(k) {
    commit(); var old = PLACE[D.placement] || PLACE.front;
    if (D.printW === old.w && D.printH === old.h) { D.printW = PLACE[k].w; D.printH = PLACE[k].h; }
    D.placement = k; afterChange();
  }
  function tabPrev(el) {
    ap(el, h("h4", { text: "Shirt color" }), shirtControls(), h("h4", { text: "Placement" }), placeControls(),
      h("div", { cls: "muted", text: "Front 12 × 14 in · Back 12 × 14 in · Left chest 4 × 4 in by default (change it in ⑤). The preview is to scale." }),
      h("h4", { text: "Your design on every color (click one)" }));
    stripColors(el);
    ap(el, h("h4", { text: "Output 1 · T-Shirt Mockup" }), h("div", { cls: "muted", text: "A picture of the art on the shirt — for previews, posts and approvals. It is NOT the print file." }),
      h("div", { cls: "row" }, [btn("⬇ Export T-Shirt Mockup PNG", exportMockup, "go"), h("label", { cls: "ci" }, [h("input", { type: "checkbox", checked: guides, on: { change: function (e) { guides = e.target.checked; draw(); } } }), "Show print-area guide on screen"])]));
  }
  var chkT = 0;
  function refreshChecksSoon() { clearTimeout(chkT); chkT = setTimeout(function () { if (tab === "dtf" && els.checks) fillChecks(); }, 250); }
  function fillChecks() {
    var an = analyze();
    els.checks.replaceChildren.apply(els.checks, an.items.map(function (x) { return h("li", { cls: x.st, text: (x.st === "ok" ? "✓ " : x.st === "fail" ? "✗ " : x.st === "warn" ? "! " : "i ") + x.t }); }));
    els.verdict.replaceChildren(h("div", { cls: an.ready ? "ready" : "prep", "data-pm": "tee-verdict", "data-ready": an.ready ? "1" : "0", text: an.ready ? "✅ PRINT-READY for: " + an.preset.label : "⚠ NEEDS PREP — not print-ready yet for: " + an.preset.label }));
    window.__pmTeeChecks = an;
  }
  function tabDtf(el) {
    var wIn = h("input", { type: "number", min: 0.5, max: MAXIN, step: 0.25, value: D.printW, on: { change: function () { commit(); D.printW = clamp(+wIn.value || 1, 0.5, MAXIN); afterChange(); } } });
    var hIn = h("input", { type: "number", min: 0.5, max: MAXIN, step: 0.25, value: D.printH, on: { change: function () { commit(); D.printH = clamp(+hIn.value || 1, 0.5, MAXIN); afterChange(); } } });
    var minIn = h("input", { type: "number", min: 72, max: 1200, step: 1, value: D.customMin || 300, on: { change: function () { commit(); D.customMin = clamp(+minIn.value || 300, 72, 1200); afterChange(); } } });
    function size(wv, hv, label) { return btn(label, function () { commit(); D.printW = wv; D.printH = hv; afterChange(); }, "sm"); }
    ap(el, h("h4", { text: "Printer requirements" }), h("div", { cls: "row" }, [select(Object.keys(PRESETS).map(function (k) { return [k, PRESETS[k].label]; }), D.preset || "dtf", function (v) { commit(); D.preset = v; afterChange(); }, "Printer preset"), D.preset === "custom" ? h("label", { cls: "ci" }, ["Min PPI", minIn]) : null]),
      h("h4", { text: "Print size (inches, max 15 × 15)" }), h("div", { cls: "row" }, [h("label", { cls: "ci" }, ["W", wIn]), h("label", { cls: "ci" }, ["H", hIn]), h("span", { cls: "muted", text: "= " + exportPx().w + " × " + exportPx().h + " px at 300 PPI" })]),
      h("div", { cls: "row" }, [size(12, 14, "Full front 12×14"), size(15, 15, "Max 15×15"), size(10, 10, "10×10"), size(4, 4, "Left chest 4×4"), size(3.5, 3.5, "Pocket 3.5"), btn("Fit height to artwork", function () { var l = D.layers.filter(function (x) { return x.t === "img" && !x.hidden; })[0], a = l && A(l.asset); if (!a) return msg("Add an image first"); commit(); D.printH = clamp(Math.round(D.printW * (a.h / a.w) * 4) / 4, 0.5, MAXIN); fitLayer(l, a); afterChange(); }, "sm")]),
      h("h4", { text: "Checks" }));
    els.verdict = h("div"); els.checks = h("ul", { cls: "chk", "data-pm": "tee-checks" });
    ap(el, els.verdict, els.checks,
      h("h4", { text: "Output 2 · DTF Artwork file" }), h("div", { cls: "muted", text: "The isolated design only (no shirt), transparent PNG, exact size × 300 PPI, with 300 PPI written into the file. Upload this to your DTF printing supplier." }),
      h("div", { cls: "row" }, [btn("⬇ Export DTF Artwork PNG", function (e) { var b = e.currentTarget; b.disabled = true; exportDTF().then(function () { b.disabled = false; }); }, "go"), btn("⬇ Export T-Shirt Mockup PNG (preview only)", exportMockup)]), els.dtfOut);
    fillChecks();
  }

  // ---------- incoming artwork (Send to T-Shirt Studio from anywhere) ----------
  function takePending() {
    return T().db.get("kv", "pending").then(function (p) {
      if (!p || !p.asset) return;
      return T().db.del("kv", "pending").then(function () { return T().db.get("assets", p.asset); }).then(function (rec) { if (rec) return addImageLayer(rec); });
    }).catch(function () {});
  }
  function onIncoming() { if (mounted) takePending(); }
  function onKey(e) {
    if (!mounted || !root.isConnected) return; var t = e.target && e.target.tagName; if (/INPUT|TEXTAREA|SELECT/.test(t)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && L()) { e.preventDefault(); delLayer(sel); }
    else if (/^Arrow/.test(e.key) && L()) { e.preventDefault(); begin(); var d = e.shiftKey ? 0.02 : 0.004, l = L(); if (e.key === "ArrowLeft") l.x -= d; if (e.key === "ArrowRight") l.x += d; if (e.key === "ArrowUp") l.y -= d; if (e.key === "ArrowDown") l.y += d; draw(); clearTimeout(onKey._t); onKey._t = setTimeout(function () { end(); renderTab(); }, 400); }
  }

  // ---------- mount ----------
  function mount(el, apiRef) {
    if (!el || !T()) { if (el) el.textContent = "T-Shirt Studio needs pm-tee-bridge.js — refresh the page."; return; }
    api = apiRef; css(); mounted = true; el.replaceChildren();
    if (!D) D = newDesign();
    root = h("div", { cls: "pmtee", "data-pm": "tee-studio" }); el.appendChild(root);
    var mode = api.current && api.current.mode;
    var cue = h("div", { cls: "cue" }, [h("span", { text: "👗 Fashion Editorial · T-Shirt Studio — any artwork from the Prompt Machine, Grok, or your uploads becomes a shirt design and a DTF print file." }),
      mode !== "fashion" && api.current && api.current.setMode ? btn("Set top worldview to Fashion Editorial", function (e) { try { api.current.setMode("fashion"); e.currentTarget.remove(); msg("Worldview: Fashion Editorial"); } catch (x) {} }, "sm") : h("span", { cls: "muted", text: mode === "fashion" ? "Worldview: Fashion Editorial ✓" : "" })]);
    els.flow = h("div", { cls: "flow" });
    [["art", "Create / Import"], ["grok", "Grok"], ["edit", "Customize"], ["prev", "Preview"], ["dtf", "Prepare DTF"], ["dtf", "Export"]].forEach(function (s, i) { if (i) els.flow.append(h("i", { text: "→" })); var b = btn(s[1], function () { tab = s[0]; renderTab(); }); b.setAttribute("data-t", s[0]); els.flow.append(b); });
    els.stage = h("canvas", { cls: "stage", width: 1000, height: 1100, "data-pm": "tee-stage" }); bindStage(els.stage);
    els.status = h("div", { cls: "status", "data-pm": "tee-status" });
    els.gout = h("div", { "data-pm": "tee-grok-out" }); els.dtfOut = h("div", { "data-pm": "tee-dtf-out" });
    var stagecol = h("div", { cls: "stagecol" }, [els.stage, h("div", { cls: "row" }, [btn("↶ Undo", undo, "sm"), btn("↷ Redo", redo, "sm"), btn("🔤 Text", addText, "sm"), btn("⬆ Import", function () { tab = "art"; renderTab(); var f = els.body.querySelector("input[type=file]"); if (f) f.click(); }, "sm"), btn("💾 Save", saveDesign, "sm go")]), shirtControls(), placeControls(), els.status, els.ppi = h("div", { cls: "ppi", "data-pm": "tee-ppi" })]);
    els.tabs = {}; var tabs = h("div", { cls: "tabs" }, TABS.map(function (t) { var b = btn(t[1], function () { tab = t[0]; renderTab(); }); b.setAttribute("data-tab", t[0]); els.tabs[t[0]] = b; return b; }));
    els.body = h("div", { cls: "tbody" });
    root.append(cue, els.flow, h("div", { cls: "wrap" }, [stagecol, h("div", { cls: "panel" }, [tabs, els.body])]));
    els.stagecol = stagecol;
    window.addEventListener("pm-tee-incoming", onIncoming); document.addEventListener("paste", onPaste); document.addEventListener("keydown", onKey);
    T().db.get("kv", "current").then(function (cur) {
      D = cur && cur.design ? cur.design : newDesign(); sel = cur && cur.sel || 0; if (!D.layers) D.layers = [];
      try { seedStarter(false); } catch (e) {}
      return preload();
    }).catch(function (e) { D = D || newDesign(); msg("Storage problem: " + e.message); }).then(function () {
      afterChange(); return takePending();
    }).then(function () { refreshStageControls(); });
    window.PMTeeStudio._state = function () { return { D: D, sel: sel, tab: tab }; };
  }
  function refreshStageControls() { if (!els.stagecol) return; var kids = els.stagecol.children; if (kids.length >= 4) { els.stagecol.replaceChild(shirtControls(), kids[2]); els.stagecol.replaceChild(placeControls(), kids[3]); } }
  function unmount(el) {
    mounted = false; window.removeEventListener("pm-tee-incoming", onIncoming); document.removeEventListener("paste", onPaste); document.removeEventListener("keydown", onKey);
    if (D) T().db.put("kv", { id: "current", design: JSON.parse(JSON.stringify(D)), sel: sel, at: Date.now() }).catch(function () {});
    if (el) el.replaceChildren(); els = {}; root = null;
  }
  window.PMTeeStudio = { mount: mount, unmount: unmount, version: V, _analyze: function () { return analyze(); }, _exportDTF: function () { return exportDTF(); }, _exportMockup: function () { return exportMockup(); },
    _runBg: function (o) { return runBg(o); }, _fit: { smart: function () { return smartFit(L()); }, crop: function () { return cropToFill(L()); }, extend: function () { return aiExtend(L()); }, upscale: function () { return aiUpscale(L()); }, ppi: function () { return ppiText(); }, plan: function () { var a = A(L().asset); return cropPlan(a, L().flip); } }, _tab: function (t) { tab = t; renderTab(); }, _encode: encodePNG };
})();
