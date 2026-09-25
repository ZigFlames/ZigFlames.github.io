/* PM hashtag engine — shared by the Zig Flames Prompt Machine (browser) and the
 * FACE/OFF terminal (server). Template-based: no AI, no API key, no backend.
 * Identical copies live at:
 *   face-off-terminal/lib/hashtag-engine.cjs            (server, via lib/prompts.js)
 *   face-off-terminal/public/studio/assets/pm-hashtags.js (browser fallback)
 * v2 (2026-09-25): natural-phrase tag builder, per-platform tags, safe = no edgy/adult tags.
 *   zigflames-site/studio/app/assets/pm-hashtags.js       (browser, primary)
 * Adults-only rule: NSFW/XXX output always means consenting adults 18+.
 * Minors and non-consent are refused outright.
 */
(function (root) {
  "use strict";

  var STOP = new Set("a an the and or of for in on at to with by from my your our is are be this that it its as into about".split(" "));
  // Weak as standalone tags or as one edge of a pair (so no #producerlate / #nightstudio / #exhibitionno).
  var WEAK = new Set("late night first new session release no yes very really big small good best one two out up".split(" "));
  // Adjacent-word pairs that read as a natural phrase. Only these become compound tags.
  var COMPOUNDS = new Set(("trapbeat beatproducer latenight studiosession studiolife albumrelease newmusic newalbum " +
    "rnbalbum rnbmusic hiphopbeat lofibeat drillbeat typebeat beatmaker musicproducer musicvideo livesession " +
    "pianoinstrumental cinematicpiano cinematicmusic pianomusic filmscore abstractart artexhibition artgallery " +
    "streetphotography fashionshoot photoshoot contemporaryart modernart digitalart visualart ambientmusic " +
    "trapmusic soulmusic vocalsession mixingsession recordingsession").split(" "));
  var MUSIC = new Set(("beat beats producer produced trap rnb hiphop rap drill lofi album single ep mixtape track tracks song songs " +
    "music piano instrumental vocals vocal guitar synth bass 808 808s melody mix mixing mastering recording soul jazz pop " +
    "afrobeats reggaeton edm house techno ambient score soundtrack remix sample samples rapper singer songwriter").split(" "));
  var GENRE_TAGS = {
    trap: ["trapmusic", "trapbeats"], rnb: ["rnbmusic", "rnbsoul"], hiphop: ["hiphopmusic", "hiphopbeats"],
    drill: ["drillmusic"], lofi: ["lofibeats", "lofimusic"], piano: ["pianomusic", "pianist"],
    instrumental: ["instrumentalmusic"], cinematic: ["cinematicmusic", "filmscore"], album: ["newalbum", "outnow"],
    release: ["newrelease", "outnow"], single: ["newsingle", "outnow"], beat: ["beats", "typebeat"], producer: ["producer"],
    abstract: ["abstractart", "abstractpainting"], exhibition: ["artexhibition", "artgallery"], art: ["contemporaryart"],
    photography: ["photography", "photooftheday"], fashion: ["fashion", "streetstyle"]
  };

  var PLATFORM_ALIAS = { instagram: "ig", insta: "ig", ig: "ig", x: "x", twitter: "x", tiktok: "tiktok", tt: "tiktok",
    youtube: "youtube", yt: "youtube", shorts: "youtube", youtubeshorts: "youtube", ytshorts: "youtube",
    threads: "threads", grok: "grok", facebook: "facebook", fb: "facebook", all: "all", "": "all" };
  // Per platform: general discovery tags, plus music- or art-flavoured ones.
  var PLATFORM = {
    ig: { any: ["reels", "explorepage", "instagood"], music: ["instamusic"], art: ["artistsoninstagram"] },
    tiktok: { any: ["fyp", "foryou", "viral"], music: ["tiktokmusic"], art: ["arttok"] },
    x: { any: ["nowplaying"], music: ["newmusic"], art: ["artistsontwitter"] },
    youtube: { any: ["shorts", "youtubeshorts"], music: ["youtubemusic"], art: ["youtubeart"] },
    threads: { any: ["threads"], music: ["newmusic"], art: ["art"] },
    grok: { any: ["grokimagine", "aiart"], music: [], art: ["aiartcommunity"] },
    facebook: { any: ["reels", "fbreels"], music: ["newmusic"], art: ["artlovers"] },
    all: { any: ["explorepage", "fyp", "reels"], music: ["newmusic"], art: ["artlovers"] }
  };

  var MODE_TAGS = {
    hiphop: ["hiphop", "rnb", "hiphopculture", "rapmusic"],
    afterdark: ["afterdark", "latenight", "neonnights", "moodylighting"],
    broadcast: ["broadcast", "tvproduction", "livetv"],
    luxury: ["luxurylifestyle", "luxury", "highend", "couture"],
    fashion: ["fashion", "editorial", "streetstyle", "fashionphotography"],
    musicvideo: ["musicvideo", "videoshoot", "directorscut", "bts"],
    nsfw: ["nsfw", "boudoir", "sensual", "18plus"],
    xxx: ["xxx", "explicit", "adultsonly", "18plusonly"]
  };

  // SFW/safe adds nothing extra; edgy and adult add their flavour only when chosen.
  var SENSITIVITY_TAGS = {
    sfw: [],
    edgy: ["moody", "raw", "gritty", "afterhours", "unfiltered"],
    adult: ["boudoir", "sultry", "lingerie", "18plus", "adultcontent", "spicy"]
  };

  // Producer Intent tiers. The two adult tiers escalate past everything else.
  var INTENTS = {
    auto: { label: "Auto · No push", phrase: "", tags: [] },
    hiphop: { tags: ["hiphop", "rnb", "goldchains"] },
    luxury: { tags: ["luxury", "penthouse", "couture"] },
    realistic: { tags: ["realism", "photojournalism", "rawphoto"] },
    musicvideo: { tags: ["musicvideo", "slowmo", "fisheye"] },
    street: { tags: ["streetphotography", "streetstyle", "candid"] },
    dramatic: { tags: ["cinematic", "chiaroscuro", "dramaticlighting"] },
    exclusive: { tags: ["exclusive", "rare", "inviteonly"] },
    afterdark: { tags: ["afterdark", "latenight", "sultry"] },
    fashion: { tags: ["fashion", "editorial", "runway"] },
    documentary: { tags: ["documentary", "verite", "handheld"] },
    nsfw: {
      label: "NSFW · 18+ sensual / explicit-leaning",
      adult: true,
      phrase: "push toward NSFW 18+ sensual heat — boudoir and lingerie styling, implied and partial nudity, bare skin and body curves, seductive eye contact, slow sensual body language, intimate warm low-key light, erotic editorial tension; all participants are consenting adults 18+, no minors, no non-consent",
      tags: ["nsfw", "18plus", "sensual", "boudoir", "lingerie", "seductive", "eroticart", "adultcontent", "nsfwart", "sultry"]
    },
    xxx: {
      label: "XXX · 18+ fully explicit",
      adult: true,
      phrase: "push toward fully explicit XXX 18+ adult-film direction — uncensored full nudity, explicit sexual acts shown, hardcore erotic detail, sweat and skin contact, raw adult-studio framing, premium OnlyFans / ManyVids explicit grade; all participants are verified consenting adults 18+, no minors, no non-consent",
      tags: ["xxx", "explicit", "uncensored", "hardcore", "adultsonly", "18plusonly", "nsfw", "adultcontent", "onlyfans", "manyvids", "explicitcontent", "xxxcontent"]
    }
  };

  var MUSIC_NICHE = ["musicproducer", "beatmaker", "producerlife", "studiolife", "newmusic", "independentartist", "musician", "songwriter", "flstudio", "beatsforsale", "zigflames"];
  var CREATIVE_NICHE = ["creative", "artist", "visualart", "contemporaryart", "artoftheday", "creativeprocess", "artlovers", "artistsupport", "inspiration", "aesthetic", "zigflames"];

  // Mirrors face-off-terminal/lib/safety.js — refuse minors / non-consent.
  var MINOR_RE = /\b(pre[- ]?teens?|lolita|loli|shota|child|children|kid|kids|infant|toddler|minor|minors|under[- ]?age|underage|young boy|young girl|schoolgirl|schoolboy|teen|teens|teenager|pedo\w*|paedo\w*|csam)\b/i;
  var AGE_NUM_RE = /\b([1-9]|1[0-7])\s*(year|yr|y\/o|yo)s?\b|\b(age|aged)\s*([1-9]|1[0-7])\b/i;
  var NCD_RE = /\b(non[- ]?consensual|nonconsent|without (her|his|their) consent|rape|drugged|unconscious|asleep|deepfake|revenge\s*porn|hidden\s*cam|spycam|upskirt)\b/i;
  var SEXUAL_RE = /\b(nsfw|nude|naked|sex|sexual|porn|xxx|erotic|explicit|boudoir|lingerie|sensual|hardcore)\b/i;

  function err(message, code) { var e = new Error(message); e.code = code; e.status = 403; return e; }

  function norm(v) { return String(v == null ? "" : v).trim().toLowerCase(); }

  function tierOf(o) {
    var intent = norm(o.intent), mode = norm(o.mode), sens = norm(o.sensitivity);
    if (intent === "xxx" || mode === "xxx" || sens === "xxx") return "xxx";
    if (intent === "nsfw" || mode === "nsfw" || sens === "nsfw") return "nsfw";
    if (sens === "adult") return "adult";
    if (sens === "edgy") return "edgy";
    return "sfw"; // sfw / safe / clean / missing -> no edgy or adult tags
  }

  function intentOf(director) {
    if (!director) return "";
    if (typeof director === "string") return norm(director);
    return norm(director.intent);
  }

  function isAdultRequest(body) {
    body = body || {};
    var tier = tierOf({ intent: body.intent || intentOf(body.director), mode: body.mode, sensitivity: body.sensitivity });
    return tier === "adult" || tier === "nsfw" || tier === "xxx";
  }

  var NEGATED_SAFETY_RE = /\b(no|never|not|zero|without)\s+(any\s+)?(minors?|children|kids|underage|non[- ]?consen(t|sual))\b/gi;

  function checkSafety(theme, adult) {
    var t = String(theme || "").replace(NEGATED_SAFETY_RE, " ");
    if ((MINOR_RE.test(t) || AGE_NUM_RE.test(t)) && (adult || SEXUAL_RE.test(t))) {
      throw err("Refused. Adult content must depict consenting adults 18+ only — never minors.", "BANNED_MINOR");
    }
    if (NCD_RE.test(t)) {
      throw err("Refused. Non-consensual or covert sexual content is banned. Adults 18+, consenting, only.", "BANNED_NCD");
    }
  }

  /**
   * generate(body, opts)
   *  body: { theme, platform, sensitivity: sfw|edgy|adult, count, mode, director:{intent}, intent, isAdult }
   *  opts.gate (default true): enforce that adult tiers need an 18+ adult mode / Prompt Machine key.
   *  opts.cleanKey: true if the caller is on a basic/Clean key (After Dark also blocked, like the server).
   */
  function generate(body, opts) {
    body = body || {};
    opts = opts || {};
    var gate = opts.gate !== false;
    var theme = (typeof body.theme === "string" ? body.theme : "").trim() || "studio";
    var platformKey = PLATFORM_ALIAS[norm(body.platform)] || norm(body.platform) || "all";
    var intent = norm(body.intent) || intentOf(body.director);
    var mode = norm(body.mode);
    var tier = tierOf({ intent: intent, mode: mode, sensitivity: body.sensitivity });
    var adult = tier === "adult" || tier === "nsfw" || tier === "xxx";

    if (gate) {
      var cleanBlocked = opts.cleanKey && (adult || mode === "afterdark" || intent === "afterdark");
      if (cleanBlocked) {
        throw err("After Dark / adult models need a FACE/OFF Prompt Machine key. Clean Studios keys stay on the safe lane.", "CLEAN_KEY_BLOCKED");
      }
      if (adult && !body.isAdult) {
        throw err("Adult / NSFW / XXX hashtags need an 18+ mode. Switch the machine to NSFW or XXX (age-verified, Prompt Machine key) first — or pick SFW / Edgy.", "ADULT_MODE_REQUIRED");
      }
    }
    checkSafety(theme, adult);

    var n = Math.max(3, Math.min(30, Math.round(Number(body.count)) || 12));
    var out = [], seen = new Set();
    function add(t) {
      t = String(t || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (t.length >= 3 && t.length <= 30 && /[a-z]/.test(t) && !/\d$/.test(t.replace(/808s?$/, "x")) && !seen.has(t)) { seen.add(t); out.push("#" + t); }
    }
    function addUpTo(list, limit) { (list || []).forEach(function (t) { if (out.length < limit) add(t); }); }

    // Theme parsing: normalise music spellings, Title Case runs = names (First Crush, No Guardrails).
    var normTheme = theme.replace(/r\s*&\s*b|r\s*n\s*b/gi, "rnb").replace(/hip[\s-]+hop/gi, "hiphop").replace(/lo[\s-]+fi/gi, "lofi");
    var raw = normTheme.split(/\s+/), names = [], nameWords = new Set();
    for (var i = 0; i < raw.length;) {
      var j = i;
      while (j < raw.length && /^[A-Z][a-z']+$/.test(raw[j])) j++;
      if (j - i >= 2) { names.push(raw.slice(i, j).join("")); raw.slice(i, j).forEach(function (w) { nameWords.add(w.toLowerCase().replace(/[^a-z0-9]/g, "")); }); }
      i = j > i ? j : i + 1;
    }
    var words = normTheme.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(function (w) { return w && !STOP.has(w); });
    var isMusic = words.some(function (w) { return MUSIC.has(w); }) || (words.length === 1 && words[0] === "studio");

    var themeTags = names.slice();
    for (var k = 0; k < words.length - 1; k++) { var pair = words[k] + words[k + 1]; if (COMPOUNDS.has(pair)) themeTags.push(pair); }
    words.forEach(function (w) { if (!WEAK.has(w) && !nameWords.has(w) && w.length >= 3) themeTags.push(w); });
    var genreTags = [];
    words.forEach(function (w) { (GENRE_TAGS[w] || []).forEach(function (t) { genreTags.push(t); }); });
    var plat = PLATFORM[platformKey] || PLATFORM.all;
    var platTags = plat.any.concat(isMusic ? plat.music : plat.art);
    var intentDef = INTENTS[intent] || null;
    var flavour = [].concat(intentDef && !intentDef.adult ? intentDef.tags : [], MODE_TAGS[mode] || [],
      SENSITIVITY_TAGS[tier === "nsfw" || tier === "xxx" ? "adult" : tier] || []);
    var tierTags = tier === "xxx" ? INTENTS.xxx.tags : tier === "nsfw" ? INTENTS.nsfw.tags : [];
    var niche = isMusic ? MUSIC_NICHE : CREATIVE_NICHE;

    // 1) NSFW / XXX tiers lead (about half the set) only when that tier is chosen.
    var lead = tierTags.length ? Math.ceil(n / 2) : 0;
    addUpTo(tierTags.slice(0, lead), n);
    // 2) Quotas on the remaining slots: ~45% theme, 1-3 platform, ~25% genre, then flavour, niche, leftovers.
    var rem = n - out.length;
    var tq = Math.max(2, Math.round(rem * 0.45)), pq = Math.min(3, Math.max(1, Math.round(rem * 0.2))), gq = Math.max(1, Math.round(rem * 0.25));
    addUpTo(themeTags.slice(0, tq), n);
    addUpTo(platTags.slice(0, pq), n);
    addUpTo(genreTags.slice(0, gq), n);
    addUpTo(flavour, Math.min(n, out.length + Math.max(1, Math.round(rem * 0.2))));
    addUpTo(tierTags.slice(lead), n);
    addUpTo(niche, n);
    addUpTo(themeTags.slice(tq), n);
    addUpTo(genreTags.slice(gq), n);
    addUpTo(flavour, n);
    addUpTo(platTags.slice(pq), n);

    var platLabel = { ig: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube Shorts", threads: "Threads", grok: "Grok", facebook: "Facebook", all: "cross-platform" }[platformKey] || platformKey;
    var rationale = "Theme phrases + " + platLabel + " discovery tags + " +
      (tier === "xxx" ? "XXX 18+ explicit tier (consenting adults only)" : tier === "nsfw" ? "NSFW 18+ sensual tier (consenting adults only)" : tier + " tier") +
      (mode && MODE_TAGS[mode] ? " + " + mode + " mode" : "") + " + " + (isMusic ? "music-producer/artist" : "creative/art") + " niche tags. Generated on-device.";
    return { hashtags: out.slice(0, n), rationale: rationale, tier: tier, provider: "on-device" };
  }

  function intentPhrase(director) {
    var id = intentOf(director);
    var d = INTENTS[id];
    if (d && d.phrase) return d.phrase;
    if (director && typeof director === "object" && typeof director.intentPhrase === "string") return director.intentPhrase.slice(0, 400);
    return "";
  }

  // Browser helper used by the hashtag panel. Backend first only when enabled
  // (FACE/OFF terminal); real HTTP errors (paywall, safety) are surfaced, never bypassed.
  async function invoke(body, client, opts) {
    opts = opts || {};
    var useBackend = !!(root.__PM_HASHTAG_BACKEND && client && client.functions && typeof client.functions.invoke === "function");
    if (useBackend) {
      try {
        var r = await client.functions.invoke("generate-hashtags", { body: body });
        if (r && !r.error && r.data && Array.isArray(r.data.hashtags) && r.data.hashtags.length) return r;
        var e = r && r.error;
        if (e && e.context && typeof e.context.json === "function" && e.name === "FunctionsHttpError") {
          var msg = e.message;
          try { var j = await e.context.clone().json(); msg = (j && (j.error || j.message)) || msg; } catch (x) {}
          return { data: null, error: { message: msg } };
        }
      } catch (x) { /* network / relay failure — fall back to on-device */ }
    }
    try {
      var fo = root.__FO || null;
      var cleanKey = !!(fo && fo.kind && fo.kind !== "nsfw" && fo.kind !== "owner");
      return { data: generate(body, { cleanKey: cleanKey || !!opts.cleanKey }), error: null };
    } catch (x2) {
      return { data: null, error: { message: x2.message, code: x2.code } };
    }
  }

  var api = { generate: generate, invoke: invoke, intentPhrase: intentPhrase, isAdultRequest: isAdultRequest, checkSafety: checkSafety, INTENTS: INTENTS, PLATFORM_ALIAS: PLATFORM_ALIAS };
  root.PMHashtags = api;
  root.__pmHashtagInvoke = invoke;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
