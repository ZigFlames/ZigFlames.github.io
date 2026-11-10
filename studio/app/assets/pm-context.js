/* Zig's Prompt Machine — shared selection context (v20261024d)
   window.PMCtx.read(over)      -> one context object built from every top selection:
                                   heat tier · style/genre · platform · realism · mood · people/cast · creativity band · Vocab Bank
   window.PMCtx.vocab(ctx)      -> Vocab Bank split by link: linked (match these selections) · always · general · negative · off
   window.PMCtx.words(ctx, n)   -> labelled variation words weighted by the selections (hip hop -> hip hop words, realism -> camera/light/skin words)
   window.PMCtx.seed(ctx)       -> a seed idea at the current heat tier, style, people and vocab (free, on-device)
   window.PMCtx.autoLink(name, sample) / linkOf(cat) / LINKS / applyClassify(map) / summary(ctx)
   All category understanding is deterministic and done here: the AI only ever gets a pre-filtered, labelled word list.
   Adults 21+ only. No minors / teen wording, no family roles, no real-person likeness. */
(function () {
  "use strict";
  function J(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function S(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function uniq(a) { var s = {}, o = []; (a || []).forEach(function (x) { x = String(x || "").trim(); var k = x.toLowerCase(); if (x && !s[k]) { s[k] = 1; o.push(x); } }); return o; }

  // ---------- safety (mirrors ai-boost.js / the worker) ----------
  var AGE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|shota\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
  var FAMILY = /\b(?:step[\s-]?\w+|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|niece|nephew|taboo|incest\w*|free[\s-]?use|non[\s-]?consen\w*|forced|rape\w*|sleeping|asleep|unconscious|drunk|drugged|hidden[\s-]?cam\w*|voyeur\w*|upskirt\w*|peep\w*)\b/gi;
  var LIKENESS = /\b(?:celebrit\w*|celeb|look[\s-]?alike|lookalike|deep[\s-]?fake\w*|face[\s-]?swap\w*|real\s+person|likeness)\b/gi;
  var BAD = /\b(?:teen|child|kid|minor|loli|shota|school|step|family|sister|brother|mom|dad|daughter|son|incest|taboo|forced|rape|asleep|sleeping|drunk|hidden cam|voyeur|celebrit|lookalike|deepfake)\w*/i;
  function safe(t) {
    return String(t == null ? "" : t).replace(AGE, "").replace(FAMILY, "").replace(LIKENESS, "").replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bboys\b/gi, "men").replace(/\bboy\b/gi, "man")
      .replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/[ \t]{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  }
  function okWord(w) { return w && !BAD.test(w); }

  // ---------- selections ----------
  var STYLES = ["hiphop", "afterdark", "broadcast", "luxury", "fashion", "musicvideo", "documentary", "street", "dramatic", "realistic"];
  var STYLE_LABEL = { hiphop: "Hip-hop & R&B", afterdark: "After dark", broadcast: "Broadcast realism", luxury: "Luxury", fashion: "Fashion editorial", musicvideo: "Music video", documentary: "Documentary", street: "Street", dramatic: "Dramatic", realistic: "Realistic" };
  var RELATED = { hiphop: ["street", "musicvideo"], musicvideo: ["hiphop"], street: ["hiphop"], broadcast: ["documentary", "realistic"], documentary: ["broadcast", "realistic"], luxury: ["fashion"], fashion: ["luxury"], realistic: ["documentary", "broadcast"] };
  var TIERS = ["sfw", "afterdark", "nsfw", "xxx"];
  var TIER_LABEL = { sfw: "SFW", afterdark: "After dark (suggestive)", nsfw: "NSFW 21+", xxx: "XXX 21+" };
  function tierMax(a, b) { return TIERS.indexOf(b) > TIERS.indexOf(a) ? b : a; }
  function genreStyle(s) {
    s = String(s || "").toLowerCase();
    if (/hip[\s-]?hop|\brap|trap|r&b|rnb|drill|worldstar|video vixen|twerk|bet\b/.test(s)) return "hiphop";
    if (/music[\s-]?video|mtv/.test(s)) return "musicvideo";
    if (/lux|yacht|penthouse|mansion|vegas|monaco|dubai|champagne|jet/.test(s)) return "luxury";
    if (/fashion|runway|editorial|couture|vogue/.test(s)) return "fashion";
    if (/documentar|verit|news|broadcast/.test(s)) return "documentary";
    if (/street|block|bodega|sidewalk/.test(s)) return "street";
    if (/strip|club|after[\s-]?dark|late[\s-]?night/.test(s)) return "afterdark";
    if (/real|amateur|candid|iphone|phone/.test(s)) return "realistic";
    return "";
  }
  function platformKey(p) {
    p = String(p || "").toLowerCase();
    var m = /(onlyfans|fansly|manyvids|pornhub|xvideos|brazzers|playboy|penthouse|hustler|vixen|tushy|blacked|instagram|tiktok|youtube|snapchat|twitter|reels|worldstar|bet|spice|clips4sale|clipsforsale|iwantclips|adult time)/.exec(p);
    return m ? m[1].replace(/\s+/g, "") : p.split(/\s+/)[0] || "";
  }

  function read(over) {
    over = over || {};
    var mode = S("faceoff.mode") || "hiphop";
    var dir = J("faceoff.director.v1") || {};
    var dirOn = dir.enabled !== false, intent = dirOn ? String(dir.intent || "auto") : "auto";
    var remix = J("faceoff.remix.v1") || {};
    var b = J("flux-character-builder:draft") || {};
    var mj = J("pm.mj.v1") || {};
    var looks = J("pm.looks.v1") || {};
    var remixMode = over.remixMode != null ? over.remixMode : remix.mode;
    var adultTop = mode === "nsfw" || mode === "xxx";
    // heat tier: the hottest of every heat selection on the page
    var tier = "sfw", why = [];
    if (mode === "afterdark") { tier = "afterdark"; why.push("top: After dark"); }
    if (adultTop) { tier = tierMax(tier, mode); why.push("top: " + mode.toUpperCase()); }
    if (intent === "afterdark") { tier = tierMax(tier, "afterdark"); why.push("director: after-dark"); }
    if ((intent === "nsfw" || intent === "xxx") && adultTop) { tier = tierMax(tier, intent); why.push("director: " + intent.toUpperCase()); }
    if (remixMode === 4) { tier = tierMax(tier, "xxx"); why.push("remix mode: Heat"); }
    if (over.adultMode && over.themes && over.themes.length && (adultTop || remixMode === 4)) { var hard = over.themes.some(function (k) { return /explicit|gaping|orgy|bdsm|bondage|vibrator|aroused/.test(k); }); tier = tierMax(tier, hard ? "xxx" : "nsfw"); why.push("remix adult themes"); }
    if (b.nsfwEnabled && b.ageConfirmed) { var lv = String(b.nsfwLevel || ""); if (lv === "explicit") tier = tierMax(tier, "xxx"); else if (lv === "suggestive" || lv === "nude") tier = tierMax(tier, "nsfw"); }
    if (over.tier && TIERS.indexOf(over.tier) >= 0) tier = over.tier;
    // style / genre
    var styles = [];
    if (intent && STYLES.indexOf(intent) >= 0) styles.push(intent);
    if (!adultTop && STYLES.indexOf(mode) >= 0) styles.push(mode);
    (Array.isArray(b.contentGenre) ? b.contentGenre : []).forEach(function (g) { var s = genreStyle(g); if (s) styles.push(s); });
    if (b.contentPlatform) { var ps = genreStyle(b.contentPlatform); if (ps) styles.push(ps); }
    var ls = genreStyle(looks.style && looks.style !== "none" ? looks.style + " " : ""); if (ls) styles.push(ls);
    if (over.idea) { var is = genreStyle(over.idea); if (is) styles.push(is); }
    styles = uniq(styles);
    var realism = mj.realism !== false || styles.indexOf("realistic") >= 0 || styles.indexOf("documentary") >= 0 || styles.indexOf("broadcast") >= 0 || intent === "realistic";
    var platform = safe(b.contentPlatform || ""), mood = safe([b.mood, b.atmosphere].filter(Boolean).join(", "));
    var people = parseInt(over.people || 0, 10) || (Array.isArray(b.sceneCast) && b.sceneCast.length) || parseInt(looks.people, 10) || 1;
    var cast = over.cast || S("faceoff.cast.v1") || remix.cast || "neutral";
    var ctx = { tier: tier, tierLabel: TIER_LABEL[tier], adult: tier === "nsfw" || tier === "xxx", tierWhy: why, mode: mode, intent: intent, styles: styles, style: styles[0] || "",
      styleLabel: styles.map(function (s) { return STYLE_LABEL[s] || s; }).join(" + "), platform: platform, platformKey: platformKey(platform), realism: realism, mood: mood,
      people: Math.max(1, Math.min(8, people)), cast: cast, band: dirOn ? (dir.band || "balanced") : "balanced", genres: (b.contentGenre || []).map(safe).filter(okWord).slice(0, 6), idea: safe(over.idea || "") };
    ctx.vocab = vocab(ctx);
    return ctx;
  }

  // ---------- Vocab Bank linking ----------
  // link ids: "style:<id>" | "heat:afterdark|nsfw|xxx" | "platform:<name>" | "mood:<word>" | "realism" | "negative" | "general" | "off"
  var LINKS = [["auto", "Auto (by name)"], ["general", "Any selection"], ["style:hiphop", "Style · Hip-hop"], ["style:musicvideo", "Style · Music video"], ["style:street", "Style · Street"], ["style:luxury", "Style · Luxury"],
    ["style:fashion", "Style · Fashion"], ["style:documentary", "Style · Documentary"], ["style:broadcast", "Style · Broadcast"], ["style:dramatic", "Style · Dramatic"], ["realism", "Realism (camera/light/skin)"],
    ["heat:afterdark", "Heat · After dark+"], ["heat:nsfw", "Heat · NSFW+ (21+)"], ["heat:xxx", "Heat · XXX only (21+)"], ["platform:onlyfans", "Platform · OnlyFans"], ["platform:instagram", "Platform · Instagram"],
    ["platform:tiktok", "Platform · TikTok"], ["platform:manyvids", "Platform · ManyVids"], ["mood", "Mood"], ["negative", "Negative (avoid list)"], ["off", "Never use"]];
  var CLASSIFY_KEY = "pm_vocab_ai_links_v1";
  function autoLink(name, sample) {
    var n = String(name || "").toLowerCase(), s = (n + " " + (sample || []).join(" ")).toLowerCase();
    if (/negative|avoid|drift|\bnot\b|don'?t/.test(n)) return "negative";
    if (/xxx|hardcore|explicit|porn|sex\b|sex acts|positions/.test(n)) return "heat:xxx";
    if (/nsfw|spicy|boudoir|lingerie|nude|nudity|topless|sensual|erotic|sexy|kink|fetish|bdsm/.test(n)) return "heat:nsfw";
    if (/after[\s-]?dark|strip|club|late[\s-]?night|vip/.test(n)) return "heat:afterdark";
    var p = /(onlyfans|fansly|manyvids|instagram|tiktok|youtube|reels|snapchat|pornhub)/.exec(n); if (p) return "platform:" + p[1];
    var st = genreStyle(n); if (st && st !== "afterdark" && st !== "realistic") return "style:" + st;
    if (/camera|lens|lighting|light|skin|realism|realistic|photo|film stock/.test(n)) return "realism";
    if (/mood|vibe|emotion|feeling|energy/.test(n)) return "mood";
    // name says nothing: look at the words (needs a clear majority signal)
    if (/\b(?:explicit|penetration|uncensored|cum|orgasm)\b/.test(s)) return "heat:xxx";
    if (/\b(?:lingerie|nude|topless|lace bodysuit|boudoir|thong)\b/.test(s)) return "heat:nsfw";
    var ws = genreStyle((sample || []).join(" ")); if (ws === "hiphop") return "style:hiphop";
    return "general";
  }
  function aiLinks() { return J(CLASSIFY_KEY) || {}; }
  function linkOf(cat) {
    var l = cat && cat.linkTo;
    if (l && l !== "auto") return { link: l, src: "you" };
    var guess = autoLink(cat && cat.name, (cat && cat.chips || []).slice(0, 8).map(function (c) { return c.text; }));
    var ai = aiLinks()[String(cat && cat.name || "").toLowerCase()];
    if (ai && ai.link) {
      // safety: the AI may make a category hotter-gated, never cooler — a name/word guess of heat:* keeps at least that tier
      var gh = /^heat:(\w+)$/.exec(guess), ah = /^heat:(\w+)$/.exec(ai.link);
      if (gh && (!ah || TIERS.indexOf(ah[1]) < TIERS.indexOf(gh[1]))) return { link: guess, src: "auto (kept: heat words)" };
      return { link: ai.link, src: "AI" };
    }
    return { link: guess, src: "auto" };
  }
  function linkMatches(link, ctx) {
    if (!link || link === "general") return true;
    if (link === "off" || link === "negative") return false;
    var parts = link.split(":"), k = parts[0], v = (parts[1] || "").toLowerCase();
    if (k === "style") {
      if (v === "afterdark") return ctx.tier !== "sfw";
      if (v === "realistic") return ctx.realism;
      if (ctx.styles.indexOf(v) >= 0) return true;
      return ctx.styles.some(function (s) { return (RELATED[s] || []).indexOf(v) >= 0; });
    }
    if (k === "heat") return TIERS.indexOf(ctx.tier) >= TIERS.indexOf(v || "nsfw");
    if (k === "platform") return !!ctx.platformKey && (ctx.platformKey.indexOf(v) >= 0 || v.indexOf(ctx.platformKey) >= 0);
    if (k === "mood") return !v || !ctx.mood || ctx.mood.toLowerCase().indexOf(v) >= 0;
    if (k === "realism") return ctx.realism;
    return true;
  }
  function categories() { var v = J("faceoff.vocabBank.v1"); return Array.isArray(v) ? v : (v && Array.isArray(v.categories) ? v.categories : []); }
  function vocab(ctx) {
    var out = { linked: [], always: [], general: [], negative: [], off: [], total: 0, used: 0 };
    categories().forEach(function (c) {
      var words = (c.chips || []).map(function (x) { return safe(x && x.text); }).filter(okWord);
      if (!words.length) return;
      out.total += words.length;
      var L = linkOf(c), row = { id: c.id, name: c.name, link: L.link, src: L.src, words: words, always: !!c.always };
      if (L.link === "negative") { out.negative.push(row); return; }
      var heatGate = /^heat:/.test(L.link) && !linkMatches(L.link, ctx); // tier filter wins even over "always use"
      if (L.link === "off" || heatGate) { out.off.push(row); return; }
      if (row.always) { out.always.push(row); return; }
      if (L.link === "general" || L.link === "mood" && !ctx.mood) { out.general.push(row); return; }
      if (linkMatches(L.link, ctx)) out.linked.push(row); else out.off.push(row);
    });
    [out.linked, out.always, out.general].forEach(function (g) { g.forEach(function (r) { out.used += r.words.length; }); });
    return out;
  }
  // rotation so every bank word gets its turn ("use ALL the words"): unused words first, reset when the pool runs dry
  var ROT = "pm_vocab_rot_v1";
  function rotPick(words, n) {
    if (!words.length || n <= 0) return [];
    var used = J(ROT) || {}, fresh = shuffle(words.filter(function (w) { return !used[w.toLowerCase()]; })), stale = shuffle(words.filter(function (w) { return used[w.toLowerCase()]; }));
    var o = fresh.concat(stale).slice(0, n);
    o.forEach(function (w) { used[w.toLowerCase()] = 1; });
    if (fresh.length <= n) words.forEach(function (w) { if (o.indexOf(w) < 0) delete used[w.toLowerCase()]; });
    var keys = Object.keys(used); if (keys.length > 3000) used = {};
    try { localStorage.setItem(ROT, JSON.stringify(used)); } catch (e) {}
    return o;
  }

  // ---------- built-in word pools (used on top of the bank) ----------
  var W = {
    hiphop: ["gold rope chain", "iced-out Cuban link", "throwback jersey", "baggy Carhartt denim", "fresh Jordan 4s", "fitted cap tilted", "durag and diamond studs", "Atlanta strip-mall parking lot", "Harlem brownstone stoop", "lowrider on hydraulics", "Bronx corner bodega", "trap beat studio session", "candy-paint Cadillac", "fisheye music-video framing", "money-rain slow-mo", "block party heat", "grillz catching the flash", "velour tracksuit", "bandana and gold hoops", "R&B slow-jam glow"],
    musicvideo: ["Hype Williams fisheye", "smoke machine haze", "slow-mo hair flip", "lipsync close-up", "dolly push-in", "neon backlight", "dancers in formation", "lens flare streaks", "MTV-era color grade"],
    street: ["sidewalk grit", "chain-link fence", "graffiti wall", "corner-store neon", "fire hydrant spray", "subway platform", "stoop hangout", "bodega cat"],
    luxury: ["penthouse floor-to-ceiling glass", "champagne tower", "Monaco marina", "marble and gold", "yacht teak deck", "couture silk", "private jet cabin", "Rolls-Royce starlight roof"],
    fashion: ["avant-garde silhouette", "beauty-dish key light", "runway stride", "magazine-cover crop", "sheer couture", "sculptural tailoring", "editorial hair and makeup"],
    documentary: ["handheld vérité", "available light", "candid unposed moment", "35mm doc grain", "lived-in wardrobe", "real street texture"],
    broadcast: ["evening-news color", "neutral white balance", "photojournalistic framing", "35mm broadcast camera"],
    dramatic: ["hard chiaroscuro", "rain-slick reflections", "theatrical shadow", "prestige-film grade", "low-key single source"],
    afterdark: ["violet strip-club haze", "VIP booth glow", "satin and smoke", "2AM lounge light", "neon pole reflection", "slow sultry body language"],
    realism: ["shot on iPhone 15 rear camera", "Canon AE-1 on Portra 400", "disposable camera direct flash", "Sony A7 IV 35mm f/1.8", "90s camcorder still", "raw unretouched skin with visible pores", "natural skin texture, no beauty filter", "flyaway hairs", "harsh overhead fluorescent light", "warm sodium streetlight", "blue-hour window light", "single bare bulb, deep shadows", "slight motion blur", "off-center casual framing"],
    nsfw: ["lace lingerie", "silk sheets", "bare shoulders and back", "implied nudity", "topless from behind", "sheer robe slipping", "ring-light boudoir glow", "sensual eye contact", "arched back on the bed", "steamy shower glass", "body oil sheen", "bedroom mirror selfie"],
    xxx: ["fully nude", "explicit sex between consenting adults", "uncensored", "skin-on-skin contact", "sweat-slick bodies", "bedroom porn-set lighting", "POV angle", "intimate close framing", "explicit oral", "cowgirl position", "raw adult-studio framing", "messy sheets aftermath"],
    onlyfans: ["ring-light selfie set", "bedroom tripod angle", "PPV teaser framing", "mirror selfie", "phone-in-hand POV"],
    instagram: ["golden-hour reel", "outfit-check mirror shot", "carousel-ready crop"],
    tiktok: ["vertical 9:16 phone video", "trend transition", "front-camera close-up"],
    manyvids: ["studio-lit custom clip", "4K adult-studio framing"]
  };
  function poolFor(ctx) { // [{label, words, n}]
    var g = [], bandN = ctx.band === "safe" ? 1 : ctx.band === "exclusive" ? 3 : 2;
    ctx.styles.forEach(function (s, i) { if (W[s]) g.push({ label: STYLE_LABEL[s] || s, words: W[s], n: i === 0 ? 3 : 2 }); (RELATED[s] || []).forEach(function (r) { if (W[r] && i === 0) g.push({ label: STYLE_LABEL[r] || r, words: W[r], n: 1 }); }); });
    if (ctx.realism) g.push({ label: "Realism", words: W.realism, n: 2 });
    if (ctx.tier === "afterdark") g.push({ label: "After dark", words: W.afterdark, n: 2 });
    if (ctx.tier === "nsfw") g.push({ label: "NSFW", words: W.nsfw, n: 3 });
    if (ctx.tier === "xxx") { g.push({ label: "XXX", words: W.xxx, n: 3 }); g.push({ label: "NSFW", words: W.nsfw, n: 1 }); }
    if (ctx.platformKey && W[ctx.platformKey] && (ctx.adult || !/onlyfans|manyvids/.test(ctx.platformKey))) g.push({ label: "Platform", words: W[ctx.platformKey], n: 1 });
    if (ctx.mood) g.push({ label: "Mood", words: ctx.mood.split(/\s*,\s*/), n: 1 });
    return g.map(function (x) { x.n = Math.max(1, Math.round(x.n * bandN / 2)); return x; });
  }
  // labelled variation words: bank words first (always + linked heavy, general rotates), then the built-in pools
  function words(ctx, n) {
    ctx = ctx || read(); n = n || 10;
    var v = ctx.vocab || vocab(ctx), out = [];
    v.always.forEach(function (r) { rotPick(r.words, 2).forEach(function (w) { out.push({ w: w, src: "bank", label: r.name + " (always)" }); }); });
    v.linked.forEach(function (r) { rotPick(r.words, 3).forEach(function (w) { out.push({ w: w, src: "bank", label: r.name + " → " + r.link }); }); });
    var gen = []; v.general.forEach(function (r) { r.words.forEach(function (w) { gen.push(w); }); });
    var gn = Math.max(1, Math.min(3, n - out.length)); if (ctx.band === "exclusive") gn += 1;
    var gp = rotPick(gen, gn); gp.forEach(function (w) { var r = v.general.filter(function (x) { return x.words.indexOf(w) >= 0; })[0]; out.push({ w: w, src: "bank", label: (r ? r.name : "bank") }); });
    poolFor(ctx).forEach(function (g) { shuffle(g.words).slice(0, g.n).forEach(function (w) { out.push({ w: w, src: "built-in", label: g.label }); }); });
    var seen = {}; out = out.filter(function (x) { x.w = safe(x.w); var k = x.w.toLowerCase(); if (!x.w || !okWord(x.w) || seen[k]) return false; seen[k] = 1; return true; });
    // keep every always/linked bank word; trim built-ins first
    var keep = out.filter(function (x) { return x.src === "bank"; }), rest = out.filter(function (x) { return x.src !== "bank"; });
    return keep.concat(rest).slice(0, Math.max(n, keep.length));
  }
  function negatives(ctx) { var v = (ctx && ctx.vocab) || vocab(ctx || read()), o = []; v.negative.forEach(function (r) { o = o.concat(rotPick(r.words, 4)); }); return uniq(o).slice(0, 8); }

  // ---------- seed ideas at the right tier ----------
  function subject(ctx, heat) {
    var c = ctx.cast, p = ctx.people;
    var W1 = { sfw: ["confident woman", "stylish woman", "woman with a sharp gaze", "laid-back woman"], afterdark: ["sultry woman", "woman in a satin slip dress", "magnetic woman"], nsfw: ["sensual woman", "woman in lace lingerie", "bare-shouldered woman"], xxx: ["fully nude woman", "naked woman", "woman"] };
    var M1 = { sfw: ["confident man", "sharp-dressed man", "laid-back man"], afterdark: ["smoldering man", "shirtless man in gold chains"], nsfw: ["shirtless muscular man", "man in low-slung sweatpants"], xxx: ["fully nude man", "naked muscular man"] };
    var hipW = ["rapper", "video vixen", "R&B singer", "dancer"], hipM = ["rapper", "producer", "R&B singer"];
    var hip = ctx.styles.indexOf("hiphop") >= 0 || ctx.styles.indexOf("musicvideo") >= 0;
    function one(g) { var base = pick((g === "m" ? M1 : W1)[heat]); if (hip && Math.random() < 0.6) base = base.replace(/\b(woman|man)$/, function (x) { return x + " " + pick(g === "m" ? hipM : hipW).replace(/^/, ""); }).replace(/(woman|man) (rapper|video vixen|R&B singer|dancer|producer)$/, "$2"); return base; }
    var g1 = c === "female-gaze" ? "m" : "w", g2 = c === "male-gaze" ? "w" : c === "female-gaze" ? "m" : (c === "both" ? "m" : (Math.random() < 0.5 ? "w" : "m"));
    if (p <= 1 && c !== "both") return "adult (21+) " + one(g1);
    if (p === 2 || c === "both") return "two adults (21+), a " + one(g1) + " and a " + one(g2);
    if (p <= 4) return ["", "", "", "three", "four"][p] + " adults (21+) together, " + one(g1) + " energy";
    return "a group of adults (21+), " + one(g1) + " at the center";
  }
  var WHERE = {
    hiphop: ["in a candy-painted Cadillac at a gas station", "on a Harlem brownstone stoop", "in a smoky Atlanta recording booth", "at a Bronx block party", "in a strip-mall parking lot at 2am", "on a rooftop over Brooklyn", "in a trap-house kitchen lit by one bulb"],
    musicvideo: ["on a smoke-filled sound stage", "in a fisheye-lens hallway", "in a neon-lit warehouse set"],
    luxury: ["in a Monaco penthouse", "on a yacht deck at sunset", "in a marble hotel suite", "in a private jet cabin"],
    fashion: ["backstage at a runway show", "in a white cyclorama studio", "on a brutalist staircase"],
    documentary: ["in a real laundromat", "at a bus stop after a shift", "in a cramped apartment kitchen"],
    broadcast: ["on a busy downtown sidewalk", "outside a courthouse", "at a corner diner"],
    street: ["by a graffiti wall", "under a subway overpass", "outside a corner bodega"],
    dramatic: ["in a rain-soaked alley", "in an empty theater", "on a fire escape in a storm"],
    afterdark: ["in a violet-lit VIP booth", "in a 2AM hotel lounge", "in a strip-club dressing room"],
    any: ["in a motel room with buzzing neon", "in a late-night diner booth", "on a fire escape at golden hour", "in a dim hotel suite", "in a parked car at night"]
  };
  var HEAT_WHERE = { nsfw: ["on silk sheets in a dim hotel suite", "in a steamy glass shower", "on a velvet chaise by the window", "in a ring-lit bedroom set"], xxx: ["on a king bed with messy sheets", "in a hotel suite with the lights low", "on a leather couch in a penthouse", "in a steamy shower"] };
  var TWIST = {
    sfw: ["mid-laugh, caught off guard", "staring straight into the lens", "counting a stack of cash", "lighting a cigarette in the wind", "adjusting a chain in the mirror"],
    afterdark: ["slow sultry glance over the shoulder", "satin slipping off one shoulder", "dancing alone in the haze", "leaning into the neon"],
    nsfw: ["topless from behind, looking back", "lace lingerie, arched back", "implied nudity under a sheer robe", "body oil glistening in the low light", "sensual eye contact with the camera"],
    xxx: ["fully nude, explicit and uncensored", "explicit sex between consenting adults", "skin-on-skin, sweat-slick, uncensored", "explicit close framing, porn-set lighting", "intimate POV, fully explicit"]
  };
  function seed(ctx, opt) {
    ctx = ctx || read(); opt = opt || {};
    var heat = ctx.tier, st = ctx.style && WHERE[ctx.style] ? ctx.style : "any";
    var where = heat === "nsfw" || heat === "xxx" ? (Math.random() < 0.5 ? pick(HEAT_WHERE[heat]) : pick(WHERE[st])) : pick(WHERE[st]);
    var parts = [subject(ctx, heat) + " " + where, pick(TWIST[heat])];
    var nw = opt.words == null ? 4 : opt.words; // 0 = no Vocab Bank words (Remix with the bank OFF)
    var ws = nw > 0 ? words(ctx, nw).slice(0, nw).map(function (x) { return x.w; }) : [];
    if (ws.length) parts.push(ws.join(", "));
    var s = parts.join(", ");
    if (heat === "nsfw" && !/nsfw/i.test(s)) s += ", NSFW";
    if (heat === "xxx" && !/xxx|explicit/i.test(s)) s += ", XXX explicit";
    return safe(s);
  }

  function summary(ctx) {
    ctx = ctx || read(); var v = ctx.vocab;
    return [ctx.tierLabel, ctx.styleLabel || "no style", ctx.realism ? "realism on" : "", ctx.platform ? "platform: " + ctx.platform : "", ctx.mood ? "mood: " + ctx.mood : "", ctx.people + (ctx.people === 1 ? " person" : " people"),
      "vocab: " + v.used + "/" + v.total + " words in play" + (v.linked.length ? " (" + v.linked.map(function (r) { return r.name; }).join(", ") + " linked)" : "")].filter(Boolean).join(" · ");
  }
  function forAI(ctx, n) { // what the worker gets: context + a pre-filtered, labelled word list. No category reasoning needed server-side.
    ctx = ctx || read();
    return { tier: ctx.tier, context: { heat: ctx.tierLabel, styles: ctx.styles.map(function (s) { return STYLE_LABEL[s] || s; }), platform: ctx.platform, realism: ctx.realism, mood: ctx.mood, people: ctx.people, cast: ctx.cast, band: ctx.band, genres: ctx.genres },
      words: words(ctx, n || 14).map(function (x) { return { w: x.w, use: x.label }; }), avoid: negatives(ctx) };
  }

  // style-aware lenses for the free local remixer (replaces the random Ghibli/Moebius art lenses when the selections say otherwise)
  var LENS = {
    realism: ["candid iPhone photo", "35mm film snapshot on Portra 400", "disposable-camera flash photo", "documentary photo, available light", "raw unretouched photo", "Sony A7 IV 35mm f/1.8 photo", "90s camcorder still", "paparazzi long-lens shot"],
    hiphop: ["Hype Williams fisheye music-video still", "2000s hip-hop magazine cover photo", "BET-era music video frame", "Atlanta strip-club flash photo", "mixtape cover photo", "XXL freshman-cover lighting"],
    musicvideo: ["music-video still with smoke and backlight", "fisheye lipsync close-up", "slow-mo performance frame"],
    luxury: ["luxury campaign photo", "golden-hour yacht editorial", "penthouse lifestyle photo"],
    fashion: ["Vogue editorial photo", "beauty-dish fashion portrait", "runway backstage snapshot"],
    documentary: ["vérité documentary still", "photojournalism frame", "handheld doc photo"],
    broadcast: ["broadcast news camera frame", "neutral-grade TV still"],
    street: ["street photography snap", "flash-at-night street photo"],
    dramatic: ["prestige-drama film still", "chiaroscuro cinematic frame"],
    afterdark: ["late-night club flash photo", "neon lounge snapshot"],
    nsfw: ["boudoir photo session", "ring-lit bedroom photo set", "intimate glamour photo"],
    xxx: ["explicit adult-studio photo", "uncensored amateur adult photo", "POV adult photo"]
  };
  function lenses(ctx) {
    ctx = ctx || read(); var o = [];
    ctx.styles.forEach(function (s) { if (LENS[s]) o = o.concat(LENS[s]); });
    if (ctx.tier === "afterdark" || ctx.tier === "nsfw" || ctx.tier === "xxx") o = o.concat(LENS[ctx.tier]);
    if (ctx.realism) o = o.concat(LENS.realism);
    return o.length ? o : null;
  }
  function finish(ctx) {
    ctx = ctx || read();
    return ctx.realism ? "photorealistic, natural skin texture with visible pores, real camera grain, no airbrushing, no CGI look" : "ultra detailed, sharp focus, professional color grading";
  }
  // Adult Mode themes that match the tier (Random turns these on so the NSFW module shows with the seed). Never voyeur / uniform / roleplay.
  var THEMES = { nsfw: ["lingerie", "topless", "nude", "sensual", "seductive", "boudoir", "shower", "wet", "curves", "candle", "neon"], xxx: ["explicit", "nude", "aroused", "closeup", "hands", "couple", "firstperson", "shower", "curves", "boudoir"] };
  function themes(ctx) { ctx = ctx || read(); var a = THEMES[ctx.tier]; if (!a) return []; return shuffle(a).slice(0, ctx.tier === "xxx" ? 5 : 4).concat(ctx.tier === "xxx" ? ["explicit"] : []).filter(function (x, i, A) { return A.indexOf(x) === i; }); }
  function applyClassify(list) { var m = aiLinks(); (list || []).forEach(function (x) { if (x && x.name && x.link) m[String(x.name).toLowerCase()] = { link: String(x.link).toLowerCase(), at: Date.now() }; }); try { localStorage.setItem(CLASSIFY_KEY, JSON.stringify(m)); } catch (e) {} return m; }

  window.PMCtx = { read: read, vocab: vocab, words: words, negatives: negatives, seed: seed, summary: summary, forAI: forAI, autoLink: autoLink, linkOf: linkOf, linkMatches: linkMatches,
    lenses: lenses, finish: finish, themes: themes, categories: categories, applyClassify: applyClassify, aiLinks: aiLinks, LINKS: LINKS, TIERS: TIERS, safe: safe, W: W, version: "20261024d" };
})();
