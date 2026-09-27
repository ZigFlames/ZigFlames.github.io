/* Zig Flames Prompt Machine — CINEMA LOOKS (SFW sibling of Platform Looks; in-browser, no backend).
 * Data: ./assets/data/cinema.json (film, TV, music video, editorial, ad, game and animation looks) + ./assets/data/variety.json (faces).
 * Reuses Platform Looks' shared code (window.PMLooks.shared): blocklist + BANNED_MINOR check, iPhone camera constant,
 * Clean skin logic, randomizer, DOM builder, copy + Midjourney bank, and the .pml-* styles.
 * Rules: SFW only (no 18+ gate, no heat levels); movie / brand / people names appear on UI cards only, never in prompts;
 * "adult 21+" whenever people are in frame; idea first and weighted; params always last.
 */
(function () {
  "use strict";
  var V = "20260927a";
  var STORE = "pm.cinema.v1", MINE_STORE = "pm.cinema.mine.v1";
  var X = null; // PMLooks.shared

  // ---- SFW + adult-only wording ------------------------------------------------------
  var SFW_RE = /\b(nude|nudity|naked|topless|bottomless|nsfw|xxx|porn\w*|explicit|erotic\w*|sex|sexy|sexual\w*|sensual\w*|seductive\w*|lingerie|thongs?|g-?strings?|strip(?:per|pers|tease|club|\s+club)|fetish\w*|bdsm|bondage|cleavage|nipples?|breasts?|boobs?|genital\w*|orgasm\w*|hentai|onlyfans|horny|lewd|uncensored)\b/gi;
  function hasSfwHit(t) { SFW_RE.lastIndex = 0; var r = SFW_RE.test(String(t || "")); SFW_RE.lastIndex = 0; return r; }
  function stripSfw(t) {
    var found = [];
    var out = String(t || "").replace(SFW_RE, function (m) { found.push(m); return " "; });
    out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/^[\s,;.-]+|[\s,;-]+$/g, "");
    return { text: out, removed: found };
  }
  function adultWords(t) {
    return String(t || "").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bboys\b/gi, "men").replace(/\bboy\b/gi, "man");
  }
  var WOMAN_RE = /\b(woman|women|lady|ladies|she|her|hers|queen|girlfriend|wife|actress|diva|heroine|mother of|bride|ballerina)\b/i;
  var MAN_RE = /\b(man|men|guy|guys|dude|dudes|he|him|his|king|boyfriend|husband|actor|gentleman|groom)\b/i;
  var GROUP_RE = /\b(crew|gang|squad|couple|group|crowd|band|dancers|team|friends|posse|ensemble|people|duo|trio|two|three|four|five|army|mob|family-free)\b/i;
  var PERSON_RE = /\b(woman|women|lady|ladies|she|her|man|men|guy|guys|dude|he|him|person|people|crew|gang|squad|couple|group|crowd|band|dancers|team|friends|hero|heroine|villain|detective|cop|cops|agent|boxer|fighter|driver|rapper|singer|dancer|model|host|anchor|chef|comic|comedian|player|athlete|soldier|thief|hustler|gangster|bride|groom|actor|actress)\b/i;
  var EMPTY_RE = /\b(empty|nobody|no people|no one|deserted|abandoned|still life|product shot|landscape|cityscape|skyline only)\b/i;
  var FIGURE_RE = /\b(figure|figures|model|lead|subject|performer|performers|crew|character|characters|athlete|hands|host|driver|comic|actors?|fighters?|explorer|riders|army|team|guests|anchor|contestant|creator|operative|survivor|villain|hero|band|crowd|people|person|dancers|runner|hands|two-shot|portrait|pose|face|eyes|walkout|huddle|confessional|talking-head|interview)\b/i;
  var STYLE_KINDS = { virtual: 1, animation: 1 };

  // ---- State ------------------------------------------------------------------------
  var S = { data: null, variety: null, loading: null, el: null, api: null, q: "", group: "All", sel: null, idea: "", tab: "mj", cam: "film", cast: "auto",
    ensemble: false, cleanSkin: true, result: null, notice: "", chipsOpen: false, mash: false, mix: [], mine: [], mineId: null, saving: false };
  var SAVE_KEYS = ["group", "sel", "idea", "tab", "cam", "cast", "ensemble", "cleanSkin", "result", "chipsOpen", "mash", "mix", "mineId"];
  function load() {
    try { var j = JSON.parse(localStorage.getItem(STORE) || "{}"); SAVE_KEYS.forEach(function (k) { if (j[k] !== undefined) S[k] = j[k]; }); } catch (e) {}
    try { var m = JSON.parse(localStorage.getItem(MINE_STORE) || "[]"); S.mine = Array.isArray(m) ? m : []; } catch (e) { S.mine = []; }
    if (!Array.isArray(S.mix)) S.mix = [];
  }
  function save() { try { var o = {}; SAVE_KEYS.forEach(function (k) { o[k] = S[k]; }); localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} }
  function saveMine() { try { localStorage.setItem(MINE_STORE, JSON.stringify(S.mine.slice(0, 60))); } catch (e) {} }
  function clean() { return S.cleanSkin !== false; }
  function looks() { return (S.data && S.data.looks) || []; }
  function lookById(id) { return looks().find(function (l) { return l.id === id; }) || null; }
  function toast(t, d) { try { S.api.current.toast(t, d); } catch (e) {} }
  function iphone() { return X ? X.IPHONE_MODEL : "iPhone 18 Pro"; }
  function isStyle(l) { return !!(l && STYLE_KINDS[l.gear.kind]); }
  function val(x) { x = String(x == null ? "" : x).trim(); return x && x !== "n/a" ? x : ""; }

  // ---- Loading (Platform Looks shared code + data) -----------------------------------------
  function ensureShared() {
    return new Promise(function (res, rej) {
      if (window.PMLooks && window.PMLooks.shared) { X = window.PMLooks.shared; return res(); }
      var sc = document.getElementById("pm-looks-js");
      if (!sc) { sc = document.createElement("script"); sc.id = "pm-looks-js"; sc.src = "./assets/platform-looks.js?v=" + V; document.head.appendChild(sc); }
      var n = 0, t = setInterval(function () {
        if (window.PMLooks && window.PMLooks.shared) { clearInterval(t); X = window.PMLooks.shared; res(); }
        else if (++n > 150) { clearInterval(t); rej(new Error("shared looks code")); }
      }, 100);
      sc.addEventListener("error", function () { clearInterval(t); rej(new Error("platform-looks.js")); });
    });
  }
  function fetchData() {
    if (S.loading) return S.loading;
    S.loading = ensureShared().then(function () {
      return Promise.all([
        fetch("./assets/data/cinema.json?v=" + V).then(function (r) { if (!r.ok) throw new Error("cinema " + r.status); return r.json(); }),
        fetch("./assets/data/variety.json?v=" + V).then(function (r) { if (!r.ok) throw new Error("variety " + r.status); return r.json(); })
      ]);
    }).then(function (a) { S.data = a[0]; S.variety = a[1]; });
    S.loading.catch(function () { S.loading = null; });
    return S.loading;
  }

  // ---- Random with per-slot history (fresh faces every roll) ---------------------------------
  var HIST = {};
  function pk(k, arr) {
    var ok = (arr || []).filter(function (x) { return x && !X.hasBlocked(x) && !X.FRAMING_RE.test(x) && !hasSfwHit(x); });
    var v = X.pick(ok, HIST[k]);
    var a = HIST[k] || (HIST[k] = []); a.push(v); if (a.length > 5) a.shift();
    return v;
  }
  var MALE_BUILD_BAD = /hourglass|pear|thick thighs|petite|curvy|full-figured/i;
  var HAIR_COLOR_M = /pastel|pink|lavender|blue|teal|rainbow|lilac|mint|ombre|balayage|platinum/i;
  function rollPerson(sex) {
    var P = S.variety.pools, r = { sex: sex }, c = clean();
    ["skinTone", "heritageRegion", "faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "complexionDetail", "distinctiveFeature"].forEach(function (k) { r[k] = pk(k, X.cleanPool(P[k], k, c)); });
    r.hairColor = pk("hairColor" + sex, (P.hairColor || []).filter(function (x) { return sex === "woman" || !HAIR_COLOR_M.test(x); }));
    r.hairTexture = pk("hairTexture", P.hairTexture);
    r.hairStyle = sex === "woman" ? pk("hairStyleW", P.hairStyle) : pk("hairStyleM", S.data.pools.maleHair);
    r.build = pk("build" + sex, (P.build || []).filter(function (x) { return sex === "woman" || !MALE_BUILD_BAD.test(x); }));
    r.heightFeel = pk("heightFeel" + sex, (P.heightFeel || []).filter(function (x) { return sex === "woman" || !/heels|petite/i.test(x); }));
    var bands = (P.ageBand || []).filter(function (b) { return parseInt(b, 10) >= 21; });  // adults 21+ only
    r.ageBand = pk("ageBand", bands.length ? bands : ["26-32"]);
    r.groom = sex === "woman" ? pk("makeup", P.makeupLevel) : pk("groom", S.data.pools.maleGroom);
    return r;
  }
  function personText(r, lead) {
    var face = X.fill(S.variety.slotTemplates.heritageFace, r);
    var hair = r.sex === "woman" ? r.hairColor + " " + r.hairTexture + " hair in " + r.hairStyle : r.hairColor + " " + r.hairTexture + " hair, " + r.hairStyle;
    var who = X.fill((S.data.pools.castStyle || {})[r.sex] || "adult {age}", { age: r.ageBand });
    var t = (lead ? "lead: " : "") + [face, hair, r.build, r.heightFeel, who, r.groom].join(", ");
    return X.cleanSkinText(t, clean());
  }
  function castFor(idea, look) {
    var mode = S.cast;
    if (mode === "auto") {
      var w = WOMAN_RE.test(idea), m = MAN_RE.test(idea);
      if (w && !m) mode = "woman"; else if (m && !w) mode = "man";
      else if (w && m) mode = X.rnd() < 0.5 ? "woman" : "man";
      else if (EMPTY_RE.test(idea) || (look.people === "none" && !PERSON_RE.test(idea))) mode = "none";
      else mode = X.rnd() < 0.5 ? "woman" : "man";
    }
    var ens = S.ensemble || (S.cast === "auto" && mode !== "none" && GROUP_RE.test(idea));
    return { mode: mode, ensemble: mode !== "none" && ens };
  }

  // ---- Assembly -----------------------------------------------------------------------
  function stillWord(l) {
    var g = l.group, k = l.gear.kind;
    if (S.cam === "iphone") return isStyle(l) ? "live-action real-world recreation" : "realistic candid photo";
    if (g === "Music Video") return "music video still";
    if (g === "Fashion Editorial") return "fashion editorial photograph";
    if (g === "Luxury/Commercial") return "commercial advertising still";
    if (g === "Video Games") return "video game screenshot";
    if (g === "Comics & Animation") return k === "virtual" ? "3D animated film frame" : "animation frame";
    if (g === "Tutorials & Reviews") return "online video tutorial frame";
    if (g === "Concerts & Stages") return "concert film still";
    if (k === "broadcast") return g === "Sports" ? "sports broadcast frame" : "broadcast TV frame";
    if (k === "video") return "camcorder video frame";
    if (k === "phone") return "smartphone video frame";
    if (k === "stills") return "editorial photograph";
    return "cinematic film still";
  }
  function camLine(l, tab) {
    var g = l.gear, ip = iphone();
    if (S.cam === "iphone") {
      return tab === "video" ? "Shot on " + ip + ", " + (l.ar === "9:16" ? "vertical " : "") + "handheld smartphone footage, " + ip + " main camera, film-emulation grade"
        : "shot on " + ip + ", " + ip + " main camera, smartphone photo with a film-emulation grade";
    }
    if (isStyle(l)) return val(g.camera);
    var cam = String(g.camera || "").replace(/\{iphone\}/g, ip);
    return "shot on " + cam + (val(g.lens) ? " with " + g.lens : "") + (val(g.format) ? ", " + g.format : "");
  }
  function aspectWords(l) {
    var a = String(l.aspect || "");
    if (a === "9:16") return "vertical 9:16 frame";
    if (/^2\.[0-9]+:1$/.test(a)) return a + " widescreen frame";
    if (/^1\.(85|90|78|66):1$/.test(a)) return a + " frame";
    return a + " frame";
  }
  function artifactsFor(l) {
    if (S.cam === "iphone") return X.ARTIFACTS.phone;
    var k = l.gear.kind;
    return k === "digital" ? X.ARTIFACTS.cinema : k === "stills" ? X.ARTIFACTS.stills : k === "video" ? X.ARTIFACTS.camcorder : k === "phone" ? X.ARTIFACTS.phone
      : k === "broadcast" ? "broadcast video sharpness, slight interlacing, video noise in the shadows" : "";
  }
  // iPhone mode: only ONE camera in the prompt, so drop other gear wording from the look's text.
  function camScrub(text) {
    if (S.cam !== "iphone") return val(text);
    return String(text || "").split(/,\s*/).filter(function (f) { return f && f !== "n/a" && !X.GEAR_RE.test(f); }).join(", ");
  }
  function isNoPeopleText(t) { return FIGURE_RE.test(t); }
  function rollScene(l, cast) {
    var P = S.data.pools, g = l.group;
    var shots = (l.shots || []).concat((P.shots || {})[g] || (P.shots || {}).Film || []);
    var blocks = ((P.blocking || {})[g] || (P.blocking || {}).Film || []).slice();
    if (cast.mode === "none") {
      shots = shots.filter(function (s) { return !isNoPeopleText(s); }); if (!shots.length) shots = ["wide establishing frame"];
      blocks = [];
    }
    return { shot: pk("shot:" + l.id, shots), blocking: blocks.length ? pk("block:" + g, blocks) : "" };
  }
  function castBlock(cast, roll) {
    if (cast.mode === "none" || !roll) return "";
    var t = personText(roll.lead, cast.ensemble);
    if (cast.ensemble) t += ", ensemble cast, every person a distinct adult 21+ with a unique face";
    return t + (clean() ? ", " + X.CLEAN_TOKEN : "");
  }
  function scrubBody(text, keep) {
    // Blocklist, family / youth framing and SFW filters on every comma fragment (the idea is never passed here).
    return String(text || "").split(/,\s*/).filter(function (f) {
      if (!f) return false;
      if (keep && keep.test(f)) return true;
      return !X.hasBlocked(f) && !X.FRAMING_RE.test(f) && !hasSfwHit(f);
    }).join(", ");
  }
  function lookBody(l, sc, cast, castTxt, role) {
    // role: "main" (full look), "blend" (grade / light / texture / mood), "accent" (palette / design / mood)
    var people = cast.mode !== "none";
    var parts;
    if (role === "blend") parts = [val(l.grade), "color palette " + val(l.palette), camScrub(l.light), camScrub(l.texture), val(l.mood) + " mood"];
    else if (role === "accent") parts = ["accents of " + val(l.palette), val(l.design), val(l.mood) + " mood"];
    else parts = [stillWord(l), sc.shot, camLine(l, "mj"), aspectWords(l), camScrub(l.light), val(l.grade), "color palette " + val(l.palette), camScrub(l.frame),
      people ? sc.blocking : "", val(l.design), people ? val(l.wardrobe) : "", castTxt, people ? "adult 21+" : "", val(l.mood) + " mood",
      S.cam === "iphone" && isStyle(l) ? "" : camScrub(l.texture), val(l.era), artifactsFor(l)];
    return parts.filter(function (p) { return p && !/^(color palette|accents of)\s*$/.test(p) && p !== "mood" && p.trim() !== "mood"; }).join(", ");
  }
  var NO_BASE = ["text", "watermark", "logo", "subtitles", "captions", "poster text", "frame border", "nudity", "gore", "extra limbs", "deformed hands"];
  var NO_REAL = ["cartoon", "CGI", "3D render", "plastic skin"];
  function paramsFor(list, seed, cast) {
    var a = list[0], mj = a.mj || {};
    var st = Math.round(list.reduce(function (s, l) { return s + (Number((l.mj || {}).stylize) || 150); }, 0) / list.length);
    if (S.cam === "iphone") st = Math.min(st, 100);
    var ch = Math.max.apply(null, list.map(function (l) { return Number((l.mj || {}).chaos) || 8; }));
    var no = NO_BASE.slice();
    if (!list.some(isStyle) || S.cam === "iphone") no = no.concat(NO_REAL);
    if (cast.mode === "none") no.push("people", "person");
    var suf = "--ar " + a.ar + " " + (mj.model || "--v 6.1") + (mj.styleRaw !== false ? " --style raw" : "") + " --stylize " + st + " --chaos " + ch + " --no " + no.join(", ");
    if (cast.mode !== "none") suf = X.addCleanNo(suf, clean());
    return { text: suf + " --seed " + seed, ar: a.ar, v: mj.model || "--v 6.1", st: st, ch: ch, no: suf.replace(/^.*--no\s+/, "--no ") };
  }
  function finish(text) { return String(text).split(X.CLEAN_TOKEN).join(X.CLEAN_SKIN_STYLE).replace(/\s{2,}/g, " ").replace(/,\s*,/g, ",").trim(); }
  var MIX_W = ["1.2", "0.8", "0.5"];
  function assembleMJ(list, idea, sc, cast, roll, seed) {
    var a = list[0], castTxt = castBlock(cast, roll);
    var keep = /adult 21\+/i;
    var main = X.dedupe(scrubBody(lookBody(a, sc, cast, castTxt, "main"), keep));
    var needAdult = cast.mode !== "none" || PERSON_RE.test(idea);
    if (needAdult && !/adult 21\+/.test(main)) main += ", adult 21+";
    var lead = idea ? idea + "::2 " : "";
    var p = paramsFor(list, seed, cast);
    if (list.length === 1) return { text: finish(lead + main + " " + p.text), params: p };
    var segs = [main + "::" + MIX_W[0]];
    list.slice(1).forEach(function (l, i) { segs.push(X.dedupe(scrubBody(lookBody(l, sc, cast, "", i === 0 ? "blend" : "accent"))) + "::" + MIX_W[i + 1]); });
    return { text: finish(lead + segs.join(" ") + " " + p.text), params: p };
  }
  function sentence(label, body) { body = scrubBody(body, /adult 21\+/i); return body ? label + ": " + body + "." : ""; }
  function assembleVideo(list, idea, sc, cast, roll) {
    var a = list[0], people = cast.mode !== "none";
    var cl = camLine(a, "video"), mv = camScrub(a.move);
    var out = [];
    out.push(idea ? "Main action (priority): " + idea + " \u2014 " + sc.shot + "." : "Main action: " + sc.shot + ".");
    out.push("Look: " + (S.cam === "iphone" ? (isStyle(a) ? "live-action real-world recreation, realistic smartphone footage" : "realistic smartphone footage") : stillWord(a).replace(/ (still|frame|photograph|screenshot)$/, "") + " style") + ", " + aspectWords(a) + ".");
    if (cl) out.push("Camera: " + cl + (mv ? "; movement: " + mv : "") + ".");
    out.push(sentence("Framing", camScrub(a.frame)));
    out.push(sentence("Lighting", camScrub(a.light)));
    out.push(sentence("Grade", val(a.grade) + ", palette " + val(a.palette)));
    if (people && sc.blocking) out.push(sentence("Blocking", sc.blocking));
    out.push(sentence("Production design", val(a.design)));
    if (people && val(a.wardrobe)) out.push(sentence("Wardrobe", a.wardrobe));
    if (people) out.push("Cast: " + scrubBody(castBlock(cast, roll), /adult 21\+/i) + "; adult 21+.");
    list.slice(1).forEach(function (l, i) {
      out.push(i === 0 ? sentence("Blended look (about 30%)", val(l.grade) + ", palette " + val(l.palette) + ", " + camScrub(l.light) + ", " + camScrub(l.texture))
        : sentence("Accent look (about 10%)", val(l.palette) + ", " + val(l.design)));
    });
    out.push(sentence("Mood", val(a.mood)));
    if (!(S.cam === "iphone" && isStyle(a))) out.push(sentence("Texture", camScrub(a.texture) + (artifactsFor(a) ? ", " + artifactsFor(a) : "")));
    out.push(sentence("Era", val(a.era)));
    out.push("Clip 8-10 s, aspect " + a.aspect + ", one continuous shot." + (!people && PERSON_RE.test(idea) ? " adult 21+." : "") + " No on-screen text, logos or watermarks.");
    var t = finish(out.filter(Boolean).join(" "));
    return { text: t, params: null };
  }

  // ---- Remix ----------------------------------------------------------------------------
  function activeList() {
    var ids = S.mash ? S.mix.slice(0, 3) : (S.sel ? [S.sel] : []);
    return ids.map(lookById).filter(Boolean);
  }
  function cleanIdea(raw) {
    var b = X.stripBlocked(raw), s = stripSfw(b.text);
    var idea = adultWords(X.sanitizeIdea(s.text)).slice(0, 200);
    var msg = [];
    if (b.removed.length) msg.push("Adults 21+ only \u2014 removed: " + b.removed.join(", ") + ".");
    if (s.removed.length) msg.push("Cinema Looks is SFW \u2014 removed: " + s.removed.join(", ") + ".");
    return { idea: idea, msg: msg.join(" ") };
  }
  function build(list, idea, opt) {
    opt = opt || {};
    var a = list[0];
    var cast = opt.cast || castFor(idea, a);
    var sc = opt.scene || rollScene(a, cast);
    var roll = cast.mode === "none" ? null : { lead: rollPerson(cast.mode) };
    var seed = X.seed32();
    var r = S.tab === "video" ? assembleVideo(list, idea, sc, cast, roll) : assembleMJ(list, idea, sc, cast, roll, seed);
    return { text: r.text, params: r.params, cast: cast, scene: sc, roll: roll, seed: S.tab === "video" ? null : seed };
  }
  function doRemix(keepScene) {
    var list = activeList();
    if (!list.length) { setNotice(S.mash ? "Pick 2 or 3 looks to mash up (or tap Shuffle)." : "Tap a look first."); return; }
    var raw = R.idea ? R.idea.value : S.idea;
    var c = cleanIdea(raw);
    var banned = X.reuseBannedMinor(c.idea);
    if (banned) { setNotice("Refused: people in Cinema Looks must be adults 21+. Rewrite the idea without minors or ages under 21."); return; }
    S.idea = c.idea; if (R.idea) R.idea.value = c.idea;
    var prev = S.result, opt = {};
    if (keepScene && prev && prev.scene && prev.tab === S.tab && String(prev.ids) === String(list.map(function (l) { return l.id; }))) { opt.scene = prev.scene; opt.cast = prev.cast; }
    var out = build(list, c.idea, opt);
    S.result = { text: out.text, tab: S.tab, ids: list.map(function (l) { return l.id; }), cam: S.cam, clean: clean(), seed: out.seed, scene: out.scene, cast: out.cast };
    save();
    try { S.api.current.setPrompt(out.text); } catch (e) {}
    if (out.params) X.applyBank({ ar: "--ar " + out.params.ar, v: out.params.v, stylize: "--stylize " + out.params.st, chaos: "--chaos " + out.params.ch, weird: "", q: "",
      style: "--style raw", seed: "--seed " + out.seed, no: out.params.no, repeat: "", tile: false, realism: false });
    S.notice = c.msg;
    renderPanel();
    var who = out.roll ? out.roll.lead.skinTone + " " + out.roll.lead.heritageRegion : "no people";
    toast(keepScene ? "Fresh faces" : (S.tab === "video" ? "Video prompt remixed" : "Look remixed"), list.map(function (l) { return l.title; }).join(" + ") + " \u00b7 " + who + " \u00b7 written to Prompt Output");
  }
  function shuffle() {
    var all = looks(), pool = all.filter(matches);
    if (!pool.length) pool = all;
    var first = X.pick(pool, S.mix[0]), n = X.rnd() < 0.5 ? 2 : 3, mix = [first.id], used = [first.group];
    var guard = 0;
    while (mix.length < n && guard++ < 200) { var l = X.pick(all); if (mix.indexOf(l.id) < 0 && used.indexOf(l.group) < 0) { mix.push(l.id); used.push(l.group); } }
    S.mash = true; S.mix = mix; S.sel = mix[0]; S.result = null; S.mineId = null; save(); renderAll();
  }

  // ---- My Looks ----------------------------------------------------------------------------
  function saveMineNow(name) {
    var list = activeList(); if (!list.length) return;
    name = X.stripBlocked(stripSfw(String(name || "")).text).text.replace(/[<>]/g, "").trim().slice(0, 60) || list.map(function (l) { return l.title; }).join(" + ");
    var m = { id: "m" + Date.now().toString(36), name: name, ids: list.map(function (l) { return l.id; }), idea: S.idea, tab: S.tab, cam: S.cam, cast: S.cast,
      ensemble: !!S.ensemble, clean: clean(), created: Date.now() };
    S.mine.unshift(m); saveMine(); S.mineId = m.id; S.saving = false; save();
    toast("Saved to My Looks", name); renderAll();
  }
  function loadMine(m) {
    var ids = (m.ids || []).filter(lookById); if (!ids.length) { toast("That saved look's base looks are gone", ""); return; }
    S.mash = ids.length > 1; S.mix = ids.slice(0, 3); S.sel = ids[0]; S.idea = m.idea || ""; S.tab = m.tab || "mj"; S.cam = m.cam || "film"; S.cast = m.cast || "auto";
    S.ensemble = !!m.ensemble; S.cleanSkin = m.clean !== false; S.result = null; S.mineId = m.id; save(); renderAll();
  }
  function deleteMine(id) { S.mine = S.mine.filter(function (m) { return m.id !== id; }); saveMine(); if (S.mineId === id) S.mineId = null; save(); renderAll(); }

  // ---- UI -------------------------------------------------------------------------------
  var CSS2 = "" +
    ".pmc .pml-chips.open{flex-wrap:wrap;overflow:visible}" +
    ".pmc-chipbar{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:6px}" +
    ".pmc-n{opacity:.6;margin-left:5px}" +
    ".pmc-guess{border-color:rgba(251,191,36,.55);color:#fde68a}" +
    ".pmc-style{border-color:rgba(192,132,252,.55);color:#d8b4fe}" +
    ".pml-conf-style{border-color:rgba(192,132,252,.55);color:#d8b4fe}.pml-conf-likely{border-color:rgba(125,211,252,.5);color:#bae6fd}" +
    ".pmc-num{position:absolute;top:6px;right:8px;min-width:20px;height:20px;border-radius:10px;background:var(--acc);color:#05070d;font:800 11px/20px ui-monospace,Menlo,monospace;text-align:center}" +
    ".pmc-sheet{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 4px;font-size:12px;line-height:1.4}" +
    ".pmc-sheet dt{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;padding-top:2px}" +
    ".pmc-sheet dd{margin:0;color:#cbd5e1}" +
    ".pmc details summary{cursor:pointer;min-height:36px;display:flex;align-items:center;color:#94a3b8;font-size:12px}" +
    ".pmc-mix{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 10px;border-radius:999px;border:1px solid var(--acc);background:rgba(125,211,252,.1);color:#fff;font-size:12px;cursor:pointer}" +
    ".pmc-mix b{font-family:ui-monospace,Menlo,monospace}" +
    ".pmc-x{margin-left:4px;opacity:.7}" +
    ".pmc-danger{border-color:rgba(248,113,113,.5);color:#fecaca}" +
    ".pmc-soon{margin-top:12px;border-style:dashed;opacity:.85}" +
    "@media (max-width:640px){.pml-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.pmc-sheet{grid-template-columns:1fr}.pmc-sheet dt{padding-top:6px}}";
  var R = {};
  function h() { return X.h.apply(null, arguments); }
  function renderAll() { if (!S.el) return; if (!S.data) return render(); renderChips(); renderGrid(); renderPanel(); }
  function render() {
    var el = S.el; if (!el) return;
    el.innerHTML = "";
    if (!X || !S.data) { el.appendChild(Object.assign(document.createElement("div"), { className: "pml-card", textContent: "Loading cinema looks\u2026" })); return; }
    if (!document.getElementById("pml-css")) document.head.appendChild(h("style", { id: "pml-css", text: X.CSS }));
    if (!document.getElementById("pmc-css")) document.head.appendChild(h("style", { id: "pmc-css", text: CSS2 }));
    var root = h("div", { cls: "pml pmc", "data-pm": "cinema-looks" });
    var top = h("div", { cls: "pml-card" });
    R.search = h("input", { cls: "pml-search", type: "search", placeholder: "Search " + looks().length + " looks (e.g. 90s, fisheye, noir, anamorphic, kung fu)\u2026", "aria-label": "Search cinema looks",
      autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search", "data-pm": "cinema-search", on: { input: function (e) { S.q = e.target.value; renderGrid(); } } });
    R.search.value = S.q;
    top.appendChild(R.search);
    R.chipbar = h("div", { cls: "pmc-chipbar" });
    top.appendChild(R.chipbar);
    R.chips = h("div", { cls: "pml-chips", role: "tablist", "data-pm": "cinema-chips" });
    top.appendChild(R.chips);
    R.mixbar = h("div", { cls: "pml-row", style: "margin-top:6px", "data-pm": "cinema-mix" });
    top.appendChild(R.mixbar);
    R.grid = h("div", { cls: "pml-grid", "data-pm": "cinema-grid" });
    top.appendChild(R.grid);
    R.count = h("div", { cls: "pml-k", style: "margin-top:6px" });
    top.appendChild(R.count);
    root.appendChild(top);
    R.panel = h("div", { cls: "pml-card", style: "margin-top:12px" });
    root.appendChild(R.panel);
    // Hook for a later feature (not built yet): upload a sketch and finish it into a cartoon, scene by scene.
    root.appendChild(h("div", { cls: "pml-card pmc-soon", "data-pm": "cinema-sketch-soon" }, [
      h("div", { cls: "pml-k", text: "Coming soon" }),
      h("div", { style: "margin-top:4px;font-weight:700;color:#f1f5f9", text: "\u270f\ufe0f Sketch \u2192 Cartoon" }),
      h("div", { style: "margin-top:4px;color:#94a3b8;font-size:12.5px;line-height:1.45", text: "Upload your own sketch, pick a Comics & Animation look, and finish it into a cartoon scene by scene. Planned, not live yet." })
    ]));
    el.appendChild(root);
    renderChips(); renderGrid(); renderPanel();
  }
  function groupList() { return ["All"].concat(S.data.groups || []).concat(["My Looks"]); }
  function renderChips() {
    R.chipbar.innerHTML = ""; R.chips.innerHTML = "";
    var counts = {}; looks().forEach(function (l) { counts[l.group] = (counts[l.group] || 0) + 1; });
    counts.All = looks().length; counts["My Looks"] = S.mine.length;
    var gl = groupList();
    R.chipbar.appendChild(h("span", { cls: "pml-k", text: gl.length - 2 + " categories" }));
    R.chipbar.appendChild(h("div", { cls: "pml-row" }, [
      h("button", { cls: "pml-btn pml-toggle" + (S.mash ? " on" : ""), type: "button", "data-pm": "cinema-mash", "aria-pressed": S.mash ? "true" : "false",
        title: "Blend 2 or 3 looks: the first one you tap leads (camera, framing, aspect)", on: { click: function () { S.mash = !S.mash; if (S.mash && !S.mix.length && S.sel) S.mix = [S.sel]; if (!S.mash && S.mix.length) S.sel = S.mix[0]; S.result = null; save(); renderAll(); } } },
        [h("span", { cls: "pml-sw" }), "Mash-up"]),
      h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-shuffle", title: "Random 2-3 look combo", text: "\ud83c\udfb2 Shuffle", on: { click: shuffle } }),
      h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-chips-toggle", "aria-expanded": S.chipsOpen ? "true" : "false", text: S.chipsOpen ? "Collapse \u25b4" : "All categories \u25be",
        on: { click: function () { S.chipsOpen = !S.chipsOpen; save(); renderChips(); } } })
    ]));
    R.chips.className = "pml-chips" + (S.chipsOpen ? " open" : "");
    gl.forEach(function (g) {
      R.chips.appendChild(h("button", { cls: "pml-chip" + (S.group === g ? " on" : ""), type: "button", "data-group": g, on: { click: function () { S.group = g; save(); renderChips(); renderGrid(); } } },
        [g === "My Looks" ? "\u2605 My Looks" : g, h("span", { cls: "pmc-n", text: String(counts[g] || 0) })]));
    });
    renderMixbar();
  }
  function renderMixbar() {
    R.mixbar.innerHTML = "";
    if (!S.mash) { R.mixbar.style.display = "none"; return; }
    R.mixbar.style.display = "";
    R.mixbar.appendChild(h("span", { cls: "pml-k", text: "Mash-up" }));
    if (!S.mix.length) R.mixbar.appendChild(h("span", { style: "color:#94a3b8;font-size:12px", text: "Tap 2-3 looks below. The first leads; tap a chip to make it lead." }));
    S.mix.forEach(function (id, i) {
      var l = lookById(id); if (!l) return;
      R.mixbar.appendChild(h("span", { cls: "pmc-mix", role: "button", tabindex: "0", title: i ? "Make this the lead look" : "Lead look", "data-mix": id, on: { click: function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute("data-x")) return;
        S.mix = [id].concat(S.mix.filter(function (x) { return x !== id; })); S.sel = S.mix[0]; S.result = null; save(); renderAll(); } } }, [
        h("b", { text: String(i + 1) }), l.title + (i === 0 ? " \u00b7 lead" : ""),
        h("span", { cls: "pmc-x", role: "button", "data-x": "1", "aria-label": "Remove", text: "\u2715", on: { click: function (e) { e.stopPropagation(); S.mix = S.mix.filter(function (x) { return x !== id; }); S.sel = S.mix[0] || null; S.result = null; save(); renderAll(); } } })
      ]));
    });
  }
  function matches(l) {
    if (S.group !== "All" && S.group !== "My Looks" && l.group !== S.group) return false;
    var q = S.q.trim().toLowerCase(); if (!q) return true;
    var hay = [l.title, l.id, l.group, l.credit, l.summary, l.year, l.era, l.palette, l.gear.camera, l.gear.format, l.aspect].join(" ").toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function renderGrid() {
    R.grid.innerHTML = "";
    var n = 0;
    if (S.group === "My Looks") {
      var q = S.q.trim().toLowerCase();
      S.mine.forEach(function (m) {
        if (q && (m.name + " " + (m.idea || "")).toLowerCase().indexOf(q) < 0) return; n++;
        var base = (m.ids || []).map(function (id) { var l = lookById(id); return l ? l.title : id; }).join(" + ");
        R.grid.appendChild(h("button", { cls: "pml-look" + (S.mineId === m.id ? " on" : ""), type: "button", "data-mine": m.id, title: m.idea || base, on: { click: function () { loadMine(m); } } },
          ["\u2605 " + m.name, h("span", { cls: "pml-g", text: "My Looks \u00b7 " + base })]));
      });
      if (!n) R.grid.appendChild(h("div", { cls: "pml-k", style: "grid-column:1/-1;letter-spacing:.1em;padding:8px 2px", text: "No saved looks yet. Remix something, then tap \u201cSave current as my look\u201d." }));
      R.count.textContent = n + " saved look" + (n === 1 ? "" : "s");
      return;
    }
    looks().forEach(function (l) {
      if (!matches(l)) return; n++;
      var on = S.mash ? S.mix.indexOf(l.id) >= 0 : S.sel === l.id;
      var conf = l.gear.confidence;
      R.grid.appendChild(h("button", { cls: "pml-look" + (on ? " on" : ""), type: "button", "data-look": l.id, title: l.summary, on: { click: function () { tapLook(l); } } }, [
        l.title,
        conf === "guess" ? h("span", { cls: "pml-tag pmc-guess", title: "Gear not verified: " + (l.gear.basis || ""), text: "GUESS" }) : null,
        conf === "style" ? h("span", { cls: "pml-tag pmc-style", title: "Drawing / render style, no physical camera", text: "STYLE" }) : null,
        S.mash && on ? h("span", { cls: "pmc-num", text: String(S.mix.indexOf(l.id) + 1) }) : null,
        h("span", { cls: "pml-g", text: l.group + " \u00b7 " + l.year + " \u00b7 " + l.aspect })
      ]));
    });
    R.count.textContent = n + " look" + (n === 1 ? "" : "s") + (S.mash ? " \u00b7 mash-up: tap up to 3" : "");
  }
  function tapLook(l) {
    S.mineId = null;
    if (S.mash) {
      var i = S.mix.indexOf(l.id);
      if (i >= 0) S.mix.splice(i, 1); else { if (S.mix.length >= 3) S.mix.pop(); S.mix.push(l.id); }
      S.sel = S.mix[0] || null;
    } else S.sel = l.id;
    S.result = null; save(); renderChips(); renderGrid(); renderPanel();
  }
  function sheet(l) {
    var g = l.gear, rows = [["Studio / credit", l.credit], ["Camera", String(g.camera).replace(/\{iphone\}/g, iphone())], ["Lens", g.lens], ["Format", g.format], ["Aspect", l.aspect + "  (--ar " + l.ar + ")"],
      ["Grade", l.grade], ["Palette", l.palette], ["Lighting", l.light], ["Framing", l.frame], ["Movement", l.move], ["Texture", l.texture], ["Era", l.era], ["Design", l.design], ["Wardrobe", l.wardrobe]];
    var dl = h("dl", { cls: "pmc-sheet", "data-pm": "cinema-sheet" });
    rows.forEach(function (r) { if (!val(r[1])) return; dl.appendChild(h("dt", { text: r[0] })); dl.appendChild(h("dd", { text: r[1] })); });
    return dl;
  }
  function seg(label, key, opts, pm) {
    var row = h("div", { cls: "pml-row", style: "margin-top:10px", role: "radiogroup", "aria-label": label, "data-pm": pm }, [h("span", { cls: "pml-k", text: label })]);
    opts.forEach(function (o) {
      var at = { cls: "pml-btn pml-cam" + (S[key] === o[0] ? " on" : ""), type: "button", role: "radio", "aria-checked": S[key] === o[0] ? "true" : "false", text: o[1],
        on: { click: function () { S[key] = o[0]; save(); renderPanel(); } } };
      at["data-" + key] = o[0];
      row.appendChild(h("button", at));
    });
    return row;
  }
  function renderPanel() {
    var P = R.panel; P.innerHTML = "";
    var list = activeList();
    if (!list.length) { P.appendChild(h("div", { cls: "pml-k", text: S.mash ? "Mash-up on: tap 2-3 looks (or Shuffle)" : "Tap a look to load it" })); return; }
    var l = list[0], mj = l.mj || {}, g = l.gear;
    var mine = S.mineId ? S.mine.find(function (m) { return m.id === S.mineId; }) : null;
    P.appendChild(h("div", {}, [
      h("div", { style: "font-size:18px;font-weight:700;color:#f8fafc", "data-pm": "cinema-title", text: mine ? "\u2605 " + mine.name : list.map(function (x) { return x.title; }).join("  +  ") }),
      h("div", { cls: "pml-k", style: "margin-top:2px", text: (list.length > 1 ? "Mash-up \u00b7 lead: " + l.title + " \u00b7 " : "") + l.group + " \u00b7 " + l.year + " \u00b7 " + l.aspect })
    ]));
    P.appendChild(h("p", { style: "margin:8px 0 6px;color:#94a3b8;font-size:13px;line-height:1.45", text: l.credit + " \u2014 " + l.summary }));
    var det = h("details", { open: window.innerWidth >= 900 ? true : null }, [h("summary", { text: "Look sheet: camera, lens, stock, grade, lighting" }), sheet(l)]);
    P.appendChild(det);
    list.slice(1).forEach(function (x, i) {
      P.appendChild(h("div", { cls: "pml-gear", text: (i === 0 ? "Blended (grade, light, texture): " : "Accent (palette, design): ") + x.title + " \u2014 " + x.grade }));
    });
    var params = h("div", { cls: "pml-row", style: "margin-top:8px", "data-pm": "cinema-params" }, [h("span", { cls: "pml-k", text: "MJ settings" })]);
    ["--ar " + l.ar, mj.model || "--v 6.1", mj.styleRaw !== false ? "--style raw" : "", "--stylize " + (S.cam === "iphone" ? Math.min(mj.stylize, 100) : mj.stylize), "--chaos " + mj.chaos].forEach(function (p) { if (p) params.appendChild(h("span", { cls: "pml-param", text: p })); });
    P.appendChild(params);

    R.idea = h("input", { cls: "pml-in", type: "text", placeholder: "Scene idea (e.g. shootout in a parking garage)", "aria-label": "Scene idea", "data-pm": "cinema-idea", autocomplete: "off", enterkeyhint: "go", maxlength: "240", on: {
      input: function (e) { S.idea = e.target.value; save(); },
      keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); doRemix(); } }
    } });
    R.idea.value = S.idea;
    var ens = h("button", { cls: "pml-toggle" + (S.ensemble ? " on" : ""), type: "button", "data-pm": "cinema-ensemble", "aria-pressed": S.ensemble ? "true" : "false", title: "Several distinct adults in frame",
      on: { click: function () { S.ensemble = !S.ensemble; save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Ensemble"]);
    P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px" }, [R.idea, ens]));
    var tabs = h("div", { cls: "pml-row", style: "margin-top:10px" });
    [["mj", "Midjourney image"], ["video", "Video prompt"]].forEach(function (t) {
      tabs.appendChild(h("button", { cls: "pml-btn pml-tab" + (S.tab === t[0] ? " on" : ""), type: "button", "data-tab": t[0], text: t[1], on: { click: function () { S.tab = t[0]; S.result = null; save(); renderPanel(); } } }));
    });
    P.appendChild(tabs);
    P.appendChild(seg("Cast", "cast", [["auto", "Auto"], ["woman", "Woman"], ["man", "Man"], ["none", "No people"]], "cinema-cast"));
    var cr = seg("Camera", "cam", [["film", "\ud83c\udf9e Film camera"], ["iphone", "\ud83d\udcf1 " + iphone()]], "cinema-camera");
    if (S.result && S.result.cam !== S.cam) cr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(cr);
    var sk = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "cinema-skin" }, [h("span", { cls: "pml-k", text: "Skin" }),
      h("button", { cls: "pml-toggle pml-skin" + (clean() ? " on" : ""), type: "button", "data-pm": "cinema-clean-skin", "aria-pressed": clean() ? "true" : "false",
        title: "Skips skin marks and conditions (vitiligo, freckles, scars, birthmarks...) and asks for clear, even-toned skin",
        on: { click: function () { S.cleanSkin = !clean(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Clean skin"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: clean() ? "no skin marks \u00b7 even tone" : "random skin details" })]);
    P.appendChild(sk);
    var gl = camLine(l, S.tab) || "style look";
    P.appendChild(h("div", { cls: "pml-gear", "data-pm": "cinema-gear" }, [gl, S.cam === "iphone" ? null : h("span", { cls: "pml-conf pml-conf-" + g.confidence, title: g.basis || "", text: g.confidence })]));
    R.note = h("div", { cls: "pml-note", "data-pm": "cinema-notice", style: S.notice ? "" : "display:none", text: S.notice });
    P.appendChild(R.note);
    P.appendChild(h("button", { cls: "pml-remix", type: "button", "data-pm": "cinema-remix", style: "margin-top:12px", text: S.result ? "REMIX AGAIN" : "REMIX", on: { click: function () { doRemix(); } } }));

    if (S.result) {
      var res = S.result;
      P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px;justify-content:space-between" }, [
        h("span", { cls: "pml-k", text: (res.tab === "video" ? "Video prompt" : "Midjourney prompt") + (res.cam === "iphone" ? " \u00b7 " + iphone() : " \u00b7 film camera") + " \u00b7 written to Prompt Output" }),
        h("div", { cls: "pml-row" }, [
          h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-copy", text: "Copy", on: { click: function () { X.copyText(res.text, function () { toast("Prompt copied", ""); }); } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-again", text: "Remix again", on: { click: function () { doRemix(); } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-faces", title: "Same look and shot, new adult faces", text: "\ud83c\udfb2 Fresh faces", on: { click: function () { doRemix(true); } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-open", text: "Open in Prompt Output", on: { click: function () { try { S.api.current.go("output"); } catch (e) {} } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-clear", text: "Clear", on: { click: clearAll } })
        ])
      ]));
      P.appendChild(h("div", { cls: "pml-out", "data-pm": "cinema-result", text: res.text }));
      var sv = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "cinema-save" });
      if (S.saving) {
        var nm = h("input", { cls: "pml-in", type: "text", placeholder: "Name this look", "aria-label": "Look name", "data-pm": "cinema-save-name", maxlength: "60", enterkeyhint: "done",
          on: { keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); saveMineNow(nm.value); } } } });
        sv.appendChild(nm);
        sv.appendChild(h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-save-go", text: "Save", on: { click: function () { saveMineNow(nm.value); } } }));
        sv.appendChild(h("button", { cls: "pml-btn", type: "button", text: "Cancel", on: { click: function () { S.saving = false; renderPanel(); } } }));
        setTimeout(function () { try { nm.focus(); } catch (e) {} }, 0);
      } else sv.appendChild(h("button", { cls: "pml-btn", type: "button", "data-pm": "cinema-save-mine", text: "\u2605 Save current as my look", on: { click: function () { S.saving = true; renderPanel(); } } }));
      P.appendChild(sv);
    }
    if (mine) P.appendChild(h("div", { cls: "pml-row", style: "margin-top:10px" }, [
      h("button", { cls: "pml-btn pmc-danger", type: "button", "data-pm": "cinema-delete-mine", text: "Delete \u201c" + mine.name + "\u201d from My Looks", on: { click: function () { deleteMine(mine.id); } } })]));
  }
  function setNotice(msg) { S.notice = msg || ""; if (R.note) { R.note.textContent = S.notice; R.note.style.display = S.notice ? "" : "none"; } }
  function clearAll() {
    S.result = null; S.idea = ""; S.notice = ""; S.saving = false; save();
    try { S.api.current.setPrompt(""); } catch (e) {}
    if (S.el && S.data) renderPanel();
  }
  function onClearAll() { S.result = null; S.notice = ""; save(); if (S.el && S.data) renderPanel(); }

  window.PMCinema = {
    version: V,
    mount: function (el, apiRef) {
      S.el = el; S.api = apiRef; load();
      render();
      fetchData().then(function () { if (S.el === el) render(); }).catch(function (e) {
        if (S.el === el) el.innerHTML = '<div class="pml-card" style="color:#fca5a5">Could not load cinema looks (' + String(e.message || e).replace(/</g, "&lt;") + '). Refresh to retry.</div>';
      });
    },
    unmount: function (el) { if (S.el === el) S.el = null; },
    _load: fetchData,
    count: function () { return looks().length; },
    groups: function () { return (S.data && S.data.groups) || []; },
    sfwRe: SFW_RE,
    // Test hook: _run("scarface" | ["saw","hype-fisheye"], idea, {tab, cam, cast, ensemble, clean})
    _run: function (ids, idea, o) {
      o = o || {}; var keep = [S.tab, S.cam, S.cast, S.ensemble, S.cleanSkin];
      S.tab = o.tab === "video" ? "video" : "mj"; S.cam = o.cam === "iphone" ? "iphone" : "film"; S.cast = o.cast || "auto"; S.ensemble = !!o.ensemble; S.cleanSkin = o.clean == null ? true : !!o.clean;
      var list = [].concat(ids).map(lookById).filter(Boolean), c = cleanIdea(idea || "");
      var banned = X.reuseBannedMinor(c.idea), out = banned ? { text: "", refused: banned } : build(list, c.idea);
      S.tab = keep[0]; S.cam = keep[1]; S.cast = keep[2]; S.ensemble = keep[3]; S.cleanSkin = keep[4];
      return { text: out.text, refused: out.refused || null, notice: c.msg, cast: out.cast ? out.cast.mode : null };
    },
    // Placeholder for the planned Sketch -> Cartoon feature (not built yet).
    sketch: { status: "planned", plan: "Upload a sketch (image), pick a Comics & Animation look, describe each scene; generate a per-scene finishing prompt (line cleanup, color, background) for an image-to-image model. Needs an image-capable backend." }
  };
  window.addEventListener("pm:clear-all", onClearAll);
})();
