/* Zig Flames Prompt Machine — PLATFORM LOOKS (in-browser, no backend).
 * Data: ./assets/data/looks.json + ./assets/data/variety.json
 * Safety (in code): every prompt includes "adult 21+"; blocklisted words are stripped
 * from the idea box (with a notice) and from every assembled prompt. Params always last.
 */
(function () {
  "use strict";
  var V = "20261023a";
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

  // Never produce family, youth, school or non-consent framing, at any heat level (applies to every look).
  var FRAMING_RE = /\b(famil(?:y|ies)|taboo|siblings?|sisters?|brothers?|moms?|mommy|mothers?|dads?|daddy|fathers?|daughters?|sons?|aunts?|uncles?|cousins?|nieces?|nephews?|in-laws?|free[\s-]?use|non[\s-]?consen\w*|forced|forcing|coerc\w*|sleeping|asleep|unconscious|drunk|passed[\s-]out|hidden[\s-]?cam\w*|spy[\s-]?cam\w*|peeping|school\w*|classroom|dorm\w*|homework|study nooks?|babysit\w*|innocent|youthful|young[\s-]looking|little girls?|tiny girls?|roommates?)\b/i;
  function scrubFraming(list) { return String(list || "").split(/,\s*/).filter(function (f) { return f && !FRAMING_RE.test(f); }).join(", "); }
  // Clothing named in the idea wins: skip the random wardrobe slot and the look's wardrobe hints.
  var GARMENT_RE = /\b(micro[\s-]?bikinis?|string[\s-]?bikinis?|g[\s-]?strings?|thongs?|bikinis?|lingerie|bralettes?|bras?|panties|panty|underwear|knickers|bodysuits?|bodystockings?|teddy|babydoll|corsets?|bustiers?|garters?|stockings|fishnets?|pantyhose|tights|latex|pvc|leather|lace|sheer|mesh|swimsuits?|swimwear|one[\s-]?piece|booty shorts|hot ?pants|micro shorts|daisy dukes|shorts|leggings|yoga pants|mini[\s-]?skirts?|skirts?|mini[\s-]?dress|dress|gown|robe|towel|apron|harness|pasties|nipple covers?|crop[\s-]?tops?|tank[\s-]?tops?|t-shirt|tee|jersey|heels|stilettos|thigh[\s-]?highs|boots|topless|nude|naked|bare|unclothed|nothing on)\b/gi;
  var NUDE_RE = /\b(topless|nude|naked|bare|unclothed|nothing on)\b/i;
  // Broader: wardrobe fragments inside a look's own prompt text.
  var HEAD_WARDROBE_RE = /\b(clothes|clothing|outfits?|wear|wardrobe|loungewear|streetwear|swimwear|sportswear|athleisure|tees?|hoodies?|sweat\w*|pajamas?|jeans|denim|cut-offs|blouses?|dress(?:es)?|sundress(?:es)?|lingerie|underwear|bras?|bikinis?|sets|cardigan|linen|cashmere|robes?|costumes?|costumey|armor|uniforms?|stilettos|heels|jewelry|silk|attire)\b/i;
  // Clean-leaning mood words that water down Spicy / XXX.
  var CLEAN_RE = /\b(goofy|comedic|comedy|sitcom|wholesome|homey|cozy|laugh|laughing|banter|gentle|reaction|costume props|travel vlog|casual chatting|bright mood|casual mood|documentary|soft fill|rowdy energy)\b/i;
  // Idea names an outfit (Zig): the idea's outfit wins, the look's rotated / pooled wardrobe is dropped everywhere.
  var OUTFIT_RE = /((?:[\w'\u2019&-]+\s+){0,2})(uniforms?|dress(?:es)?|outfits?|shirts?|t-shirts?|tees?|blouses?|jeans|denim|lingerie|bikinis?|suits?|costumes?|hoodies?|skirts?|aprons?|scrubs|overalls|jumpsuits?|leggings|shorts|sweaters?|jackets?|coats?|robes?|gowns?|corsets?|bodysuits?|swimsuits?|tracksuits?|pajamas?|onesies?|jerseys?|kimonos?|saris?|tops?|blazers?|vests?|leotards?|catsuits?|cosplay)\b/i;
  function ideaOutfit(idea) { return OUTFIT_RE.test(String(idea || "")) || garmentsOf(idea).length > 0; }
  function outfitPhrase(idea) { var m = String(idea || "").match(OUTFIT_RE); return m ? (m[1] + m[2]).trim() : ""; }
  function garmentsOf(idea) {
    var out = []; GARMENT_RE.lastIndex = 0; var m;
    while ((m = GARMENT_RE.exec(String(idea || "")))) { if (out.map(function (x) { return x.toLowerCase(); }).indexOf(m[0].toLowerCase()) < 0) out.push(m[0]); }
    GARMENT_RE.lastIndex = 0; return out;
  }
  // Keep the idea out of the params: no "::" weights or "--flags" typed by the user.
  function sanitizeIdea(t) { return String(t || "").replace(/::-?[\d.]*/g, " ").replace(/(^|\s)[\u2014\u2013-]{1,2}[a-z]+(\s+[\w:.\/-]+)?/gi, " ").replace(/[{}]/g, " ").replace(/\s{2,}/g, " ").trim(); }

  // ---- Camera: "Platform camera" (real gear per look, from looks.json gear) | "iPhone" -------------
  // Newest Pro iPhone as of Sep 2026 (iPhone 18 Pro, released Sep 18 2026). Update this one constant later.
  var IPHONE_MODEL = "iPhone 18 Pro";
  // Any camera / lens / phone-model wording already in a look, so only ONE camera appears in the prompt.
  var GEAR_RE = /\b(i-?phones?|android|pixel\s*\d|galaxy\s*s\d+|smartphone|arri|alexa|red\s+(?:komodo|v-raptor|dragon|epic)|sony|canon|nikon|fuji\w*|panasonic|lumix|blackmagic|go-?pro\w*|hasselblad|leica|insta360|camcorder|handycam|dash[\s-]?(?:cam|lens|mounted)|webcam|dslr|mirrorless|\d+(?:-\d+)?\s?mm|anamorphic\w*|macro lens|fisheye|ultra-wide|stereoscopic|vr lens|cinema (?:primes?|lens(?:es)?|camera)|primes?|zoom lens(?:es)?|chest[\s-]rig\w*|film-to-tape|35mm film|super\s?8|shot on)\b/i;
  // Glossy / marketing words that fight photo realism (both tabs). Brand set, light and colour words stay.
  var GLOSS_RE = /\b(epic|sci-fi[\s-]cinema|perfume[\s-]commercial|commercial aesthetic|aspirational luxury|cinema[\s-]grade|cinematic grade|blockbuster|masterpiece|8k|4k|ultra[\s-]?hd|hdr|hyper[\s-]?real\w*|award[\s-]winning|flawless|high bitrate|trailer)\b/i;
  // Stills only (Midjourney tab): camera-move / film-marketing words that make a photo read as CGI.
  var GLOSS_MJ_RE = /\b(cinematic|drone|crane|dolly|steadicam|gimbal|slider|slow[\s-]?mo|slow reveals?|slow push|push-ins?|establishing shot|aerials?|glossy|polished|parallax|orbit)\b/i;
  var ARTIFACTS = {
    phone: "Smart HDR tone mapping, slight sensor noise in the shadows, computational sharpening, deep phone depth of field",
    mirrorless: "natural lens falloff, mild chromatic aberration at the edges, true optical depth of field, fine ISO grain",
    cinema: "natural lens falloff, mild chromatic aberration at the edges, true optical shallow depth of field, fine ISO grain",
    stills: "natural lens falloff, mild chromatic aberration, true shallow depth of field, fine ISO grain, strobe catchlights",
    action: "wide-angle barrel distortion, slight rolling-shutter wobble, sensor noise in the shadows, auto exposure shifts",
    camcorder: "camcorder video softness, auto white balance drift, video noise, slight interlacing",
    webcam: "webcam compression, soft focus, auto exposure pumping, slight noise",
    virtual: ""
  };
  function gearOf(look) { return look.gear || { kind: "phone", line: "shot on {iphone}, main camera 24mm, handheld, available light", confidence: "guess" }; }
  function camKind(look) { return (S.cam === "iphone" || dnaOn(look)) ? "phone" : gearOf(look).kind; }
  function camLine(look, tab) {
    if (S.cam === "iphone" || dnaOn(look)) {
      return tab === "video" ? "Shot on " + IPHONE_MODEL + ", " + (String(look.aspect) === "9:16" ? "vertical " : "") + "handheld smartphone footage, " + IPHONE_MODEL + " main camera"
        : "shot on " + IPHONE_MODEL + ", " + IPHONE_MODEL + " main camera, smartphone photo";
    }
    var g = gearOf(look);
    if (g.kind === "virtual") return "";
    return g.line.replace(/\{iphone\}/g, IPHONE_MODEL);
  }
  // Scrub is skipped for rendered looks in Platform mode (their "virtual camera" text is the style).
  function camScrubOn(look) { return !(gearOf(look).kind === "virtual" && S.cam !== "iphone"); }
  function camScrubList(text, look, tab) {
    if (!camScrubOn(look)) return String(text || "");
    var stills = tab !== "video";
    return String(text || "").replace(/\bcandid iPhone photo\b/gi, "candid photo").split(/,\s*/).filter(function (f) {
      return f && !GEAR_RE.test(f) && !GLOSS_RE.test(f) && !(stills && GLOSS_MJ_RE.test(f));
    }).join(", ");
  }
  function camScrubProse(text, look) {
    if (!camScrubOn(look)) return String(text || "");
    return String(text || "").split(/(?<=\.)\s+/).map(function (sen) {
      var m = sen.match(/^([A-Z][A-Za-z ]{0,20}:\s*)/), lab = m ? m[1] : "", body = m ? sen.slice(lab.length) : sen;
      var end = /\.\s*$/.test(body) ? "." : ""; body = body.replace(/\.\s*$/, "");
      var kept = body.split(/;\s*/).map(function (part) {
        return part.split(/,\s*/).filter(function (c) { return c && (/adults 21\+/i.test(c) || (!GEAR_RE.test(c) && !GLOSS_RE.test(c))); }).join(", ");
      }).filter(Boolean).join("; ");
      return kept ? lab + kept + end : "";
    }).filter(Boolean).join(" ");
  }
  function stylizeOf(look) {
    var st = Number((look.mj || {}).stylize) || 0;
    return S.cam === "iphone" ? Math.min(st, 100) : st;  // phone capture reads real at low stylize
  }

  // ---- Clean skin (default ON): no skin marks / conditions in the randomizer --------------------
  // Grok Imagine renders any skin-condition wording (e.g. vitiligo) as patchy skin, so these picks are skipped.
  var SKIN_MARK_RE = /\b(vitiligo|albin\w*|birth ?marks?|freckl\w*|scars?|scarred|acne|rosacea|sun[\s-]?spots?|age spots?|stretch marks?|\w*pigment\w*|blotch\w*|patch(?:es|y)?|pores?|pockmark\w*|blemish\w*|moles?|beauty marks?|melasma|psoriasis|eczema|uneven (?:tone|skin)|ruddy|weathered|oily)\b/i;
  var CLEAN_SKIN_STYLE = "clear, smooth, even-toned flawless skin, uniform complexion";
  var CLEAN_TOKEN = "zzcleanskinzz";  // kept whole through dedupe, expanded at the end
  var CLEAN_SKIN_NO = "vitiligo, skin patches, blotchy skin, depigmentation, albinism, birthmarks";
  function cleanOn() { return S.cleanSkin !== false; }
  function cleanPool(arr, k) { return cleanPoolOn(arr, k, cleanOn()); }
  function cleanPoolOn(arr, k, on) {
    if (!on || !arr) return arr;
    var out = arr.filter(function (x) { return !SKIN_MARK_RE.test(x); });
    if (k === "complexionDetail" && out.indexOf("natural skin texture") < 0) out.push("natural skin texture");  // stands in for "visible pores"
    return out.length ? out : arr;
  }
  // Realism text: keep real texture, drop pores / uneven tone wording (reads as blotches).
  function cleanSkinText(text) { return cleanSkinTextOn(text, cleanOn() && !freshOn()); }
  function cleanSkinTextOn(text, on) {
    if (!on) return String(text || "");
    var t = String(text || "").replace(/\bunretouched skin with pores\b/gi, "unretouched natural skin texture").replace(/\b(real|visible) pores\b/gi, "natural skin texture");
    return t.split(/,\s*/).filter(function (f) { return f && (/natural skin texture/i.test(f) || !SKIN_MARK_RE.test(f)); }).join(", ");
  }

  // ---- Beauty (default OFF): bias the randomizer toward glamorous, attractive adult women (21+) ------------
  // Diversity stays (all skin tones / heritages); only unflattering picks are swapped for glam ones.
  var GLAM = {
    faceShape: ["oval face", "heart-shaped face", "diamond face", "V-line face", "softly symmetrical face", "high-cheekboned oval face"],
    eyes: ["captivating almond eyes with long lashes", "sultry hooded hazel eyes", "big bright doe eyes", "green cat eyes", "smoldering dark brown eyes", "amber fox eyes", "bright blue eyes with lush lashes", "monolid eyes with sharp winged liner", "deep brown bedroom eyes", "grey-green almond eyes"],
    brows: ["sleek arched brows", "brushed-up full brows", "sculpted brows", "laminated fluffy brows", "softly arched defined brows"],
    nose: ["delicate straight nose", "small refined nose", "softly upturned nose", "elegant narrow nose", "neat straight nose", "elegant broad nose with a soft rounded tip"],
    lips: ["full plump lips", "glossy pouty lips", "heart-shaped lips", "defined cupid's bow", "full lower lip", "full lips with a dimpled smile"],
    jawCheekbones: ["high sharp cheekbones", "sculpted cheekbones and a tapered chin", "defined jawline", "V-shaped jaw and lifted cheekbones", "chiseled cheekbones"],
    complexionDetail: ["radiant glowing skin", "dewy luminous skin", "sun-kissed glow", "satin-smooth skin with a soft highlight", "natural skin texture with a healthy glow"],
    distinctiveFeature: ["tiny beauty mark above the lip", "deep dimples", "elegant collarbones", "striking smile", "long fluttery lashes", "hourglass waist", "toned midriff", "flirty knowing smile"],
    build: ["curvy hourglass figure", "slim toned figure", "athletic toned body", "thick thighs and a snatched waist", "slim-thick figure", "voluptuous hourglass curves", "long-legged slender figure", "fit body with toned abs", "busty hourglass figure", "sculpted fitness-model body"],
    heightFeel: ["tall", "long-legged", "statuesque", "model height", "towering in heels", "slim and perfectly proportioned"],
    makeupLevel: ["natural glam", "smoky eye", "bold red lip", "sharp winged liner", "glossy lip and highlighter", "full beat glam", "soft bronzed glam", "sultry smoky eye and nude gloss", "lash-heavy glam with glossy lips"],
    nails: ["long glossy almond nails", "red stiletto nails", "French-tip coffin nails", "nude glossy nails", "chrome nails", "black almond nails"],
    hairExtra: ["bombshell curls", "Hollywood waves", "voluminous blowout", "knotless braids", "sleek wet look", "long glossy waves", "high snatched ponytail", "waist-length straight hair"],
    wardrobe: ["bodycon mini dress", "satin slip dress", "corset top and leather mini skirt", "cut-out bodycon dress", "crop top and low-rise micro skirt", "plunging neckline satin dress", "lace bodysuit and high-waisted jeans", "thigh-slit gown", "bikini top and sarong", "sheer blouse over a lace bralette"]
  };
  var GLAM_DROP = {
    skinTone: /vitiligo|ruddy|weathered|patch/i,
    hairColor: /gray|grey|silver|salt|roots/i,
    hairStyle: /buzz|messy bun|wolf cut|shag/i,
    hairTexture: /frizz|wiry|gray|coarse|^fine$/i,
    tattoosPiercings: /faded|old|eyebrow|lip ring/i
  };
  var DRAB_WARDROBE_RE = /\b(scrubs|tracksuit|velour|pajamas?|sweat\w*|hoodies?|band tee|tee dress|cardigan|overalls|uniforms?|baggy|oversized|parka|fleece)\b/i;
  var BEAUTY_LINE = ["stunningly beautiful, gorgeous, model-level attractive, magnetic sex appeal", "breathtakingly beautiful, glamorous, smoldering sex appeal, camera-ready", "drop-dead gorgeous, sultry and confident, bombshell energy", "strikingly beautiful bombshell, alluring gaze, irresistible sex appeal"];
  var BEAUTY_REAL = "flattering light on her face, camera-ready glow, gorgeous and photogenic";
  var BEAUTY_NO = "unattractive, plain, homely, aged, tired, frumpy, double chin, bad teeth";
  var MATURE_LOOKS = { mylf: 1, milfed: 1 };   // themed looks keep 33-50 bands
  function beautyOn() { return S.beauty === true; }
  function glamPool(arr, k) {
    if (!beautyOn()) return arr;
    if (GLAM[k]) return GLAM[k];
    if (k === "hairStyle") return (arr || []).filter(function (x) { return !GLAM_DROP.hairStyle.test(x); }).concat(GLAM.hairExtra);
    if (GLAM_DROP[k]) { var o = (arr || []).filter(function (x) { return !GLAM_DROP[k].test(x); }); return o.length ? o : arr; }
    return arr;
  }
  function beautySoften(text) {
    if (!beautyOn() || freshOn()) return beautyOn() ? String(text || "") + ", " + BEAUTY_REAL : text;
    var out = String(text || "").split(/,\s*/).filter(function (f) { return f && !/peach fuzz|uneven tone|real body weight|not beauty lighting|amateur framing|imperfect exposure|dirty sensor spots|slight motion blur|ordinary mixed available light/i.test(f); });
    out.push(BEAUTY_REAL);
    return out.join(", ");
  }
  function addBeautyNo(no) {
    if (!beautyOn()) return no;
    return no ? no.replace(/[,\s]+$/, "") + ", " + BEAUTY_NO : "--no " + BEAUTY_NO;
  }

  // ---- Candid DNA (Beauty OFF, default): Zig's target look for every real-camera platform look -----------
  // Candid iPhone snapshot in a packed indoor venue, IG-model thicc body, adult woman 21+. Rendered (virtual) looks keep their own style.
  var DNA = {
    real: "candid iPhone photo, slight motion blur, dirty sensor spots, ordinary mixed indoor lighting, not studio, not beauty lighting, unretouched skin with pores, peach fuzz, uneven tone, sweat sheen only where bodies heat, flyaway hairs, real body weight in motion",
    crowd: "packed indoor venue, spectators and phones in soft background bokeh",
    solo: "empty indoor venue, no spectators, no phones, no crowd, just her",
    soloVenues: ["empty nightclub floor after hours", "empty backstage hallway", "empty indoor pool at night", "empty hotel ballroom after the party", "empty bikini contest stage, house lights on", "empty house-party living room the morning after", "empty strip-club main floor before opening", "empty dance hall, chairs stacked"],
    tail: "unique face, natural proportions pushed but plausible, photoreal, documentary fashion snapshot, amateur framing, imperfect exposure",
    body: "UAE women IG model style body: busty, big tits, wide hips, thicc, curvy, thick ass, bubble butt, fake tits, narrow waist",
    heatBody: {
      tease: "huge ass bouncing, vulgar confident walk, barefoot or thin heels",
      spicy: "heavy G-cup swinging, puffy nipples through strained bikini, huge ass bouncing, thong cutting in, cameltoe, vulgar confident walk, barefoot or thin heels",
      xxx: "heavy G-cup swinging and slapping, dark areolas, puffy nipples, huge ass bouncing, thong cutting in, cameltoe, vulgar confident walk, barefoot or thin heels"
    },
    builds: ["thicc curvy build", "busty hourglass with wide hips", "slim-thick with a bubble butt", "thick BBW-leaning curves", "voluptuous thick build"],
    venues: ["packed indoor nightclub floor", "crowded backstage hallway at an indoor event", "packed indoor pool party", "crowded hotel ballroom afterparty", "packed indoor bikini contest stage", "crowded house party living room", "packed strip-club main floor", "crowded indoor booty-shake contest"],
    wardrobe: {
      tease: ["tight bodycon mini dress riding up", "bikini top and tiny thong shorts", "stretched crop top and booty shorts", "tight micro skirt and bandeau top"],
      spicy: ["strained string bikini, thong cutting in", "tiny micro bikini straining at the seams", "sheer stretched bikini top and thong", "cheeky bikini bottoms riding up, strained top"]
    },
    mood: "raw, vulgar, confident, real",
    no: "text, watermark, logo, caption, UI, beauty filter, plastic skin, airbrush, identical faces, cloned women, CGI, 3D render, extra limbs, melted anatomy, studio softbox, glossy magazine retouch",
    bank: { ar: "--ar 2:3", v: "--v 6.1", stylize: "--stylize 40", chaos: "--chaos 8", q: "--q 1", style: "--style raw" },
    artifacts: "Smart HDR tone mapping, slight sensor noise in the shadows",
    // studio / beauty lighting from a look's own text fights the candid DNA
    dropRe: /\b(softbox\w*|three-point|high-key|studio\w*|glossy|polished|beauty\b|retouch\w*|strobe\w*|ring light|key light|warm key|soft key|fill light|rim light|lamp|catchlights?|\d{4}K|LED|spotless|no dark corners|flattering|clean whites|saturated|lifted shadows|staged|luxury|clean white set|office or gym|wide masters|punch-ins|mediums|sharp focus|warm skin|16:9|9:16|4:5|1:1)\b/i,
    // picks that fight the IG-model body (face / hair / nails); everything else stays random and unretouched
    poolDrop: { hairColor: /gray|grey|silver|salt|roots/i, distinctiveFeature: /gold tooth|under-eye|glasses|ears that/i, nails: /bitten|chipped|short bare/i,
      makeupLevel: /sweat-worn|day-old/i, heightFeel: /heavy-set|short-legged/i, hairTexture: /wiry|gray/i }
  };
  // Style "None": no style preset and no candid Club DNA; the platform's own look + focus DNA drive the prompt.
  function noneOn() { return S.style === "none" && S.mash !== true; }
  function dnaOn(look) { return !noneOn() && !beautyOn() && styleOf(look) === "club" && !(look && gearOf(look).kind === "virtual"); }
  function dnaList(text) { return String(text || "").split(/,\s*/).filter(function (f) { return f && (/adults? 21\+/i.test(f) || !DNA.dropRe.test(f)); }).join(", "); }
  function dnaProse(text) {
    return String(text || "").split(/(?<=\.)\s+/).map(function (sen) {
      if (/^Main action \(priority\):/.test(sen)) return sen;
      var m = sen.match(/^([A-Z][A-Za-z ]{0,20}:\s*)/), lab = m ? m[1] : "", body = m ? sen.slice(lab.length) : sen;
      var end = /\.\s*$/.test(body) ? "." : ""; body = body.replace(/\.\s*$/, "");
      var kept = body.split(/;\s*/).map(function (part) { return dnaList(part); }).filter(Boolean).join("; ");
      return kept ? lab + kept + end : "";
    }).filter(Boolean).join(" ");
  }
  function dnaVenue(idea, r) { return /\bback ?stage\b/i.test(String(idea || "")) ? (crowdOn() ? "crowded backstage hallway at an indoor event" : "empty backstage hallway") : r.venue; }
  // ---- Crowd switch (default OFF = No crowd): empty / solo venue unless Zig turns Crowd on. ---------------------------
  var CROWD_RE = /\b(crowd\w*|packed|spectators?|audience|onlookers|bystanders|phones raised|cheering|hyping|busy|strangers)\b/i;
  var CROWD_LINE = "packed spectators with phones raised in soft background bokeh";
  var NO_CROWD_NO = "crowd, spectators, audience, onlookers, people in the background";
  function crowdOn() { return S.crowd === true; }
  // ---- People + Multi-tone: the cast count always equals the People control; 2+ people are always plural and all different. ----
  var NUMW = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  var PEOPLE_MAX = 8;
  function peopleN() { return Math.max(1, Math.min(PEOPLE_MAX, parseInt(S.people, 10) || 1)); }
  function multiOn() { return S.multitone === true; }
  var TONE_BANDS = [["deep ebony", "dark brown", "warm mahogany", "cool umber", "dark chocolate"], ["rich copper", "golden brown", "caramel", "honey", "sun-weathered bronze"], ["olive", "tan", "light tan", "warm beige"], ["porcelain", "pale with pink undertones", "freckled fair", "ruddy fair"]];
  var RURAL_TONES = ["light-skinned ebony", "caramel ebony", "warm brown ebony", "deep ebony", "dark chocolate ebony"];
  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Multi-tone ON: every person a different heritage and a skin tone from a different tone band (deep -> fair).
  // Always (2+ people): no two people share a skin tone or heritage.
  function toneCast(look, cast) {
    if (cast.length < 2) return;
    var st = styleOf(look), P = S.variety.pools;
    if (multiOn()) {
      var regs = shuffled(cleanPool(P.heritageRegion, "heritageRegion").filter(function (x) { return x !== "mixed-heritage"; }));
      var bands = shuffled(TONE_BANDS.map(function (b) { return shuffled(b); }));
      cast.forEach(function (r, i) { r.heritageRegion = regs[i % regs.length]; var b = bands[i % bands.length]; r.skinTone = b[Math.floor(i / bands.length) % b.length]; r.multi = true; });
      return;
    }
    if (st === "rural") { var t = shuffled(RURAL_TONES.slice(1)); cast.forEach(function (r, i) { r.skinTone = i ? t[(i - 1) % t.length] : RURAL_TONES[0]; }); return; }
    var C = GROUP_STYLES[st] || (st === "duo" ? DUO : st === "carib" ? CARIB : st === "contest" ? CONTEST : null);
    var tones = C && C.tones ? C.tones : cleanPool(P.skinTone, "skinTone"), regsP = C && C.regions ? C.regions : cleanPool(P.heritageRegion, "heritageRegion");
    var ut = {}, ur = {};
    cast.forEach(function (r) {
      if (ut[r.skinTone]) { var o = tones.filter(function (x) { return !ut[x]; }); if (o.length) r.skinTone = pick(o); }
      if (ur[r.heritageRegion] && regsP.length >= cast.length) { var q = regsP.filter(function (x) { return !ur[x]; }); if (q.length) r.heritageRegion = pick(q); }
      ut[r.skinTone] = 1; ur[r.heritageRegion] = 1;
    });
  }
  // ---- Unique Faces (default ON, saved per device; Zig): combinatorial Face Builder from data/faces.json. Every person in the
  // cast gets shape, eyes (shape + heritage-matched color), brows, nose, lips, jaw plus 4-6 extra traits (eye detail,
  // cheekbones, 1-2 distinctive marks, skin texture, expression, hairline), never repeating a face within the last 20
  // Remixes. Adult-coded wording only; adults 21+. Eye color: the rolled heritage wins unless Zig explicitly picked an Eyes
  // button (then the chip wins). Focus DNA / lighting are untouched (face slots only).
  var FACES = null, FACE_HIST = [], FACE_HIST_N = 20;
  var FACE_YOUTH_RE = /\b(youth\w*|young\w*|baby|child\w*|girlish|petite|teen\w*|innocent|cute|doll\w*)\b/i;
  var LIGHT_EYE_RE = /\b(Ukrainian|Irish|Swedish|Norwegian|Danish|Finnish|Icelandic|Scottish|English|Dutch|German|Polish|Russian|Lithuanian|Latvian|Estonian|Czech|Slovak|Belarusian|Scandinavian|Nordic|Baltic|Albanian|Croatian|Serbian|Slovenian|Hungarian|Austrian|Swiss|Welsh|French|Australian|Canadian|Eastern European|Northern European)\b/i;
  var WARM_EYE_RE = /\b(Lebanese|Persian|Iranian|Turkish|Moroccan|Italian|Sicilian|Greek|Spanish|Portuguese|Brazilian|Argentin\w*|Puerto Rican|Colombian|Mexican|Dominican|Cuban|Venezuelan|Chilean|Punjabi|Pakistani|Afghan|Kurdish|Armenian|Georgian|Syrian|Israeli|Egyptian|Algerian|Tunisian|Romanian|Bulgarian|Latina?|Middle Eastern|Mediterranean)\b/i;
  function uniqueOn() { return S.uniqueFaces !== false; }
  function eyeExplicit() { return S.eyeSet === true; }
  function eyeFamily(r) {
    var h = String((r && r.heritageRegion) || ""), t = String((r && r.skinTone) || "");
    if (/\b(Nigerian|Yoruba|Igbo|Ghanaian|Kenyan|Somali|Ethiopian|Eritrean|Sudanese|Senegalese|Congolese|Zulu|Xhosa|Swazi|South African|Jamaican|Haitian|African\w*|Korean|Japanese|Chinese|Vietnamese|Thai|Filipina|Indonesian|Malaysian|Tamil|Malayali|Indian|Bengali|Sri Lankan|Nepali|Samoan|Polynesian|Tongan|Hawaiian|Aboriginal)\b/i.test(h)) return "brown";
    if (LIGHT_EYE_RE.test(h) || /\b(pale|fair|porcelain|freckled|rosy)\b/i.test(t) && !/\b(Korean|Japanese|Chinese|Vietnamese|Thai|Filipina)\b/i.test(h)) return "light";
    if (WARM_EYE_RE.test(h) || /\bolive\b/i.test(t)) return "warm";
    return "brown";
  }
  function faceSig(r) { return [r.faceShape, r._eyeShape, r.brows, r.nose, r.lips, r._jaw].join("|"); }
  function faceRecent() { var o = {}; FACE_HIST.forEach(function (rm) { rm.forEach(function (sg) { o[sg] = 1; }); }); return o; }
  function facePick(arr, avoid) { var a = (arr || []).filter(function (x) { return !FACE_YOUTH_RE.test(x); }); return pick(a, avoid || []); }
  function buildFace(r, used, recent) {
    var F = FACES, man = !!r.man, clean = cleanOn();
    for (var tries = 0; tries < 12; tries++) {
      r.faceShape = facePick(man && F.male ? F.male.faceShape : F.faceShape, used.faceShape);
      r._eyeShape = facePick(F.eyeShape, used.eyeShape);
      var fam = F.eyeColor[eyeFamily(r)] || F.eyeColor.brown, col = facePick(fam);
      r.eyes = r._eyeShape + " " + col + " eyes"; r.eyeTint = col;
      r.brows = facePick(F.brows, used.brows); r.nose = facePick(F.nose, used.nose); r.lips = facePick(F.lips, used.lips);
      r._jaw = facePick(F.jaw, used.jaw);
      var sig = faceSig(r); if (!recent[sig] && used.sigs.indexOf(sig) < 0) break;
    }
    // 4-6 extra traits; always 1-2 distinctive marks (Clean skin keeps marks that don't fight its negatives)
    var marks = (F.marks || []).filter(function (m) { return !clean || !/birthmark|vitiligo|blotch|patch|depigment|hyperpigment|rosacea/i.test(m); });
    var ex = [], nM = rnd() < 0.5 ? 1 : 2, m1 = facePick(marks, used.marks); ex.push(m1); if (nM > 1) ex.push(facePick(marks, used.marks.concat([m1])));
    var opt = [["cheek", F.cheekbones], ["eyeD", F.eyeDetail], ["skin", F.skinTexture], ["expr", F.expression], ["hair", F.hairline]];
    if (man && F.male) opt.push(["male", F.male.extra]);
    opt = shuffled(opt); var nX = 4 + Math.floor(rnd() * 3) - ex.length;
    var got = {}; opt.slice(0, Math.max(2, nX)).forEach(function (o) { got[o[0]] = facePick(o[1], used[o[0]] || []); });
    r.jawCheekbones = r._jaw + (got.cheek ? ", " + got.cheek : "");
    if (got.eyeD) r.eyes += ", " + got.eyeD;
    r.complexionDetail = got.skin || r.complexionDetail;
    r.distinctiveFeature = ex.join(", ");
    r.micro = [ex.join(", "), got.expr, got.hair, got.male].filter(Boolean).join(", ");
    r._faceSig = faceSig(r);
    ["faceShape", "brows", "nose", "lips"].forEach(function (k) { used[k].push(r[k]); }); used.eyeShape.push(r._eyeShape); used.jaw.push(r._jaw);
    used.marks = used.marks.concat(ex); used.sigs.push(r._faceSig);
  }
  function faceCast(look, cast) {
    if (!uniqueOn() || !FACES || !FACES.faceShape) return;
    if (styleOf(look) === "rural") return;   // the masked Rural ebony face is fixed by design
    var recent = faceRecent(), used = { faceShape: [], eyeShape: [], brows: [], nose: [], lips: [], jaw: [], marks: [], sigs: [] };
    cast.forEach(function (r) { buildFace(r, used, recent); });
    FACE_HIST.unshift(used.sigs.slice()); FACE_HIST = FACE_HIST.slice(0, FACE_HIST_N);
  }
  // ---- Eye color quick switch (default Regular = brown / dark brown, the most common). Exotic = the old random mix. ----
  var EYES = [["regular", "Regular"], ["hazel", "Hazel"], ["green", "Green"], ["blue", "Blue"], ["gray", "Gray"], ["hetero", "Heterochromia"], ["exotic", "Exotic"]];
  var EYE_SHADES = { regular: ["dark brown", "brown", "deep brown", "warm brown", "chocolate brown", "dark espresso brown"], hazel: ["hazel", "light hazel", "golden hazel", "green-flecked hazel"],
    green: ["green", "emerald green", "olive green", "pale green"], blue: ["blue", "light blue", "steel-blue", "deep blue"], gray: ["gray", "gray-blue", "silver-gray", "smoky gray"] };
  var EYE_COLOR_RE = /\b(dark espresso brown|chocolate brown|dark brown|deep brown|warm brown|honey-brown|grey-green|gray-green|steel-blue|dark|black|brown|hazel|green|gray|grey|blue|amber|bright)\s+/gi;
  function eyeMode() { var m = S.eye || "regular"; return EYES.some(function (e) { return e[0] === m; }) ? m : "regular"; }
  function eyeShape(e) { e = String(e || "almond eyes"); if (/heterochrom/i.test(e) || !/\beyes\b/i.test(e)) e = "almond eyes"; return e.replace(EYE_COLOR_RE, "").replace(/\s+with laugh lines/i, "").replace(/^\s+|\s+$/g, "") || "almond eyes"; }
  function eyeColorOf(i, mode, used) {
    if (mode === "hetero") { var pairs = [["brown", "blue"], ["dark brown", "green"], ["hazel", "blue"], ["brown", "gray"], ["blue", "green"], ["amber", "blue"]], pr = pairs[(used.h = (used.h == null ? Math.floor(rnd() * pairs.length) : used.h + 1)) % pairs.length]; return pr; }
    var sh = EYE_SHADES[mode] || EYE_SHADES.regular; if (!used.s) used.s = shuffled(sh); return used.s[i % used.s.length];
  }
  function eyeCast(look, cast) {
    var mode = eyeMode(); if (mode === "exotic") return;
    if (uniqueOn() && FACES && !eyeExplicit()) return;   // rolled heritage-matched color wins
    var used = {};
    cast.forEach(function (r, i) {
      if (r.man) return;
      var c = eyeColorOf(i, mode, used), shape = eyeShape(r.eyes);
      if (mode === "hetero") { r.eyes = shape + ", heterochromia: one " + c[0] + " eye and one " + c[1] + " eye"; r.eyeTint = "mismatched " + c[0] + " and " + c[1]; }
      else { r.eyes = shape.replace(/\beyes\b/i, c + " eyes"); r.eyeTint = c; }
    });
  }
  function ruralFace(r) { return r && r.eyeTint ? RURAL.face.replace("seductive dark eyes", "seductive " + r.eyeTint + " eyes") : RURAL.face; }
  // ---- Core DNA chip: the style's key DNA words, weighted in the MJ prompt (chip::2) so they never get buried,
  // and flashed by the Focus cue before a Remix. Adults 21+ always.
  var STYLE_CORE = {
    contest: ["raw home iPhone twerk-contest audition", "head-shot then full body"],
    carib: ["Caribbean twerk-contest audition", "deep twerk bent over a chair"],
    sync: ["synchronized twerk workout", "shaky-cam dance studio"],
    ny: ["vulgar NY twerk", "ass to camera", "not in sync"],
    duo: ["cinematic noir twerk", "motion blur", "clothes falling off"],
    rural: ["ultra-realistic 4K amateur", "voluptuous rural ebony", "neon orange grid room"],
    tryouts: ["secret model tryouts", "slingshot swimsuit walk"],
    sabaddie: ["South African baddie walk", "ass to camera rear-view follow", "women only, staged urban set"],
    roomwalk: ["Room Walk Loop", "seamless 12-20s vertical loop", "one original woman, small warm-grey room"]
  };
  var EYE_CHIP = { regular: "brown eyes", hazel: "hazel eyes", green: "green eyes", blue: "blue eyes", gray: "gray eyes", hetero: "heterochromia" };
  function dnaChip(look, cast, preview) {
    if (!look || gearOf(look).kind === "virtual") return [];
    var st = styleOf(look), n = cast ? cast.length : peopleN(), man = cast ? cast.some(function (r) { return r.man; }) : (st === "club" && S.castMix === "mixed" && n > 1);
    var c = [];
    if (preview && S.mash) c.push("mash-up: random style blend");
    else if (st === "club" && noneOn()) c = c;
    else if (st === "club") c = c.concat(dnaOn(look) ? ["candid iPhone photo", "unretouched real skin", "thicc IG-model body"] : ["gorgeous glam", "real skin texture"]);
    else c = c.concat((STYLE_CORE[st] || []).map(function (x) { return st === "rural" && multiOn() && n > 1 ? x.replace("rural ebony", "rural women") : x; }));
    if (n > 1) c.push(NUMW[n] + " different " + (man ? "adults" : "women"));
    if (n > 1 && multiOn()) c.push("every skin tone different");
    if (twerkOn()) c.push("twerk show, extreme jiggle physics");
    if (freshOn()) c.push(n > 1 ? "brand-new unique faces, real pores" : "brand-new unique face, real pores");
    if (crowdOn()) c.push("packed crowd");
    if (EYE_CHIP[eyeMode()] && !(uniqueOn() && FACES && !eyeExplicit())) c.push(EYE_CHIP[eyeMode()]);
    c.push(n > 1 ? "adults 21+" : "adult 21+");
    return c;
  }
  function chipMJ(text, look, cast) {
    var chip = dnaChip(look, cast); if (!chip.length) return text;
    var k = text.indexOf("::2 "), w = chip.join(", ") + "::2 ";
    return k >= 0 && k < 220 ? text.slice(0, k + 4) + w + text.slice(k + 4) : w + text;
  }
  function chipVideo(text, look, cast) {
    var chip = dnaChip(look, cast); if (!chip.length) return text;
    var w = "Core DNA (priority): " + chip.join(", ") + ".", m = text.match(/^Main action \(priority\):[^.]*\.\s*/);
    return m ? m[0] + w + " " + text.slice(m[0].length) : w + " " + text;
  }
  // ---- Look stamp (Scoreline Pickup): the picked look's signature aesthetics stamped ON TOP of his DNA every Remix.
  // Never replaces cast, faces, Fresh, Style, Beauty, Crowd, eye color or skin — it only adds look / grit / camera / anti-AI-polish lines.
  // Hand-tuned signature stamps; every other look builds its stamp from its own look data (styleName, lighting, grade, camera, lens, framing, MJ keywords).
  var STAMP_OVERRIDE = {
    "scoreland-busty-pinup": {
      name: "Scoreline",
      chip: ["1992 big-busty pinup magazine polish", "flash pinup", "poster-pop color", "not AI polish"],
      mj: "1992 big-busty pinup magazine polish, classic big-bust pictorial glamour, bright on-camera flash with crisp catchlights, saturated poster-pop color, centered bust-level pinup framing, retro pinup styling touches, glossy magazine-page finish on real skin, real-camera grit: fine film grain, flash falloff, slight vignetting, print-scan texture, not AI polish",
      video: "1992 big-busty pinup magazine polish, classic big-bust pictorial glamour; bright on-camera flash with crisp catchlights, saturated poster-pop color, centered bust-level pinup framing with slow photographic tilts, retro pinup styling touches, glossy magazine-page finish on real skin; real-camera grit: fine film grain, flash falloff, slight vignetting; not AI polish"
    },
    "worldstar-viral": {
      name: "WorldStar",
      chip: ["WorldStar viral phone clip", "shaky from the crowd", "crushed noisy color", "not AI polish"],
      mj: "raw hood-viral phone clip, shot on a phone from the crowd, shaky handheld, digital zoom punch-ins with zoom noise, phone flash burst, club strobes and streetlight spill, crushed noisy oversaturated phone color, off-center vertical framing with bodies blocking frame, motion blur, compression artifacts, not AI polish",
      video: "raw hood-viral phone clip; shaky handheld from the crowd, sudden digital zoom punch-ins, phone flash bursts, club strobes and streetlight spill; crushed, noisy, oversaturated phone color, vertical off-center framing with bodies blocking frame, motion blur and compression artifacts; not AI polish"
    },
    "hiphop-music-video": {
      name: "Hip-hop video",
      chip: ["90s-2000s rap video", "fisheye low-angle hero", "saturated neon primaries", "not AI polish"],
      mj: "big-budget 90s-2000s rap video look, fisheye and ultra-wide low-angle hero shot, anamorphic letterbox, bold hard light with colored backlight and glossy highlights, saturated neon primaries, stark contrast, light pulsing to the beat, real film-camera texture, not AI polish",
      video: "big-budget 90s-2000s rap video look; fisheye and ultra-wide low-angle hero moves, dolly and crane, anamorphic letterbox; bold hard light, colored backlight, glossy highlights pulsing to the beat; saturated neon primaries, stark contrast; real film-camera texture; not AI polish"
    },
    "bet-uncut-video": {
      name: "BET Uncut",
      chip: ["early-2000s uncut rap video", "SD video bleed", "red and blue gels", "not AI polish"],
      mj: "early-2000s after-hours uncut rap video look, standard-definition camcorder video with SD color bleed and interlace softness, fisheye wide, club strobes, saturated red and blue gels, cheap gloss, contrasty, dancers in the foreground, money-in-the-air slow motion, real tape texture, not AI polish",
      video: "early-2000s after-hours uncut rap video look; SD camcorder video with color bleed and interlace softness, handheld and jib, fisheye wide performer-to-lens; club strobes, saturated red and blue gels, cheap gloss, contrasty; dancers in the foreground; real tape texture; not AI polish"
    },
    "mr-supremo": {
      name: "Mr. Supremo",
      chip: ["Colombian pro-am curvy casting", "hip-level camcorder follow", "hot tropical color", "not AI polish"],
      mj: "2010s Colombian pro-am curvy casting look, director-held HD camcorder from behind the camera, low hip-level angle tracking big round hips and thick thighs, full-figure walk-away and turn-around shots, proud natural curvy bodies, warm Medellin tropical daylight with simple on-camera fill, hot saturated Latin color, slightly contrasty camcorder video with soft blown highlights, run-and-gun zoom reframes, real camcorder grit: video noise, slight motion blur, auto white-balance drift, not AI polish",
      video: "2010s Colombian pro-am curvy casting look; director-held HD camcorder from behind the camera with casual off-camera banter, low hip-level follow tracking big round hips and thick thighs, full-figure walk-away and turn-around beats, run-and-gun zoom reframes; warm Medellin tropical daylight with simple on-camera fill, hot saturated Latin color, slightly contrasty camcorder video with soft blown highlights; proud natural curvy bodies; real camcorder grit: video noise, slight motion blur, auto white-balance drift; not AI polish"
    }
  };
  var STAMP_NO = ["AI polish", "CGI sheen", "over-smoothed render", "HDR glow"];
  // look text that would fight his DNA rules (his negatives / real-skin lines) never goes into a stamp
  var STAMP_CLASH = /softbox|filter|retouch|airbrush|beauty[- ]filter|plastic|porcelain|flawless skin|\bcgi\b|3d render|watermark|logo|text overlay|caption|masthead|real performer/i;
  var STAMP_CACHE = {};
  // keep descriptive pieces only: no lone one-word adjectives ("bright", "casual", "smooth") and nothing that fights real skin
  function stampBits(str, n) { return String(str || "").split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !STAMP_CLASH.test(x) && !/^(smooth|polished|flawless|glossy|clean|bright|casual|flattering)$/i.test(x) && (/\s/.test(x) || /\d/.test(x) || x.length >= 9); }).slice(0, n || 2); }
  function buildStamp(look) {
    var o = STAMP_OVERRIDE[look.id];
    var label = String(look.label || look.id).replace(/\s+(Look|Style|Aesthetic)$/i, "");
    if (o) return { name: o.name, chip: o.chip, mj: o.mj, video: o.video, no: STAMP_NO.concat(o.no || []) };
    var candid = look.realismTier === "candid", kind = gearOf(look).kind;
    var grit = candid || kind === "phone" || kind === "webcam" || kind === "camcorder" || kind === "action"
      ? "real " + (kind === "phone" ? "phone" : kind === "webcam" ? "webcam" : kind === "camcorder" ? "tape" : "camera") + " grit, sensor noise, not AI polish"
      : "real-camera texture on real skin, not AI polish";
    var name = stampBits(look.styleName, 1)[0] || label;
    var light = stampBits(look.lighting, 2), grade = stampBits(look.colorGrade, 2), cam = stampBits(look.camera, 1), lens = stampBits(look.lens, 1), frame = stampBits(look.framing, 2);
    var have = [name].concat(light, grade, cam, lens, frame).join(" ").toLowerCase();
    var kw = ((look.mj && look.mj.mjKeywords) || []).filter(function (k) { return !STAMP_CLASH.test(k) && have.indexOf(k.toLowerCase()) < 0; }).slice(0, 3);
    var nm = /\b(look|clip|aesthetic|style)$/i.test(name) ? name : name + " look";
    var mj = uniqList([nm].concat(light, grade, cam, lens, frame, kw, [grit])).join(", ");
    var video = nm + "; " + uniqList(cam.concat(lens)).join(", ") + "; " + uniqList(light.concat(grade)).join(", ") + "; " + uniqList(frame.concat(kw.slice(0, 2))).join(", ") + (look.pacing ? "; pacing " + stampBits(look.pacing, 1)[0] : "") + "; " + grit;
    return { name: label, chip: [name, (grade[0] || light[0] || ""), (light[0] && grade[0] ? light[0] : cam[0] || ""), "not AI polish"].filter(Boolean), mj: mj, video: video, no: STAMP_NO };
  }
  function uniqList(a) { var seen = {}; return a.filter(function (x) { var k = String(x || "").toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; }); }
  // virtual (AI / anime) looks are never DNA-led, so their full look text already shows every Remix
  function stampOf(look) { if (!look || gearOf(look).kind === "virtual") return null; if (!STAMP_OVERRIDE[look.id] && focusDna(look).length) return null; return STAMP_CACHE[look.id] || (STAMP_CACHE[look.id] = buildStamp(look)); }
  // drop stamp pieces the prompt already says (e.g. Beauty / platform-camera mode keeps some look text)
  // Walk styles (SABADDIE, Room Walk Loop) set their own camera and scene: mute a look's conflicting camera/scene notes
  // (OnlyFans selfie / nightstand, Worldstar crowd ...) but keep its lighting and color-grade keys.
  var WALK_HARD = /selfie|nightstand|propped|front[- ]cam|driver|windshield|\bcar\b|office|bedroom|\bbed\b|crowd|bystander|audience|spectator|bodies blocking|webcam|couch|sofa|hotel|kitchen|shower|bathroom|\bpov\b|tripod|mirror|talking to the viewer|from the stands|ringside|dance floor|vip booth|to the phone|phone visible/i;
  var WALK_SOFT = /handheld|shaky|zoom|framing|vertical|street|club|room|location|\bset\b|venue|stage|backdrop|studio|close-?up|angle|lens|\bcam(era)?\b/i;
  function walkStyle(look) { return /^(sabaddie|roomwalk)$/.test(styleOf(look)); }
  function walkMuted(t) { return WALK_HARD.test(t) || (WALK_SOFT.test(t) && !DNA_LIGHT_RE.test(t) && !/grade|color|colour|grain|tone|saturat|contrast/i.test(t)); }
  function stampFresh(stamp, text, sep) {
    var low = String(text).toLowerCase();
    var mute = walkStyle(null);
    return stamp.split(sep).filter(function (x) { var t = x.trim().toLowerCase(); if (mute && walkMuted(t)) return false; return t && (t.indexOf("not ai polish") >= 0 || t.indexOf(" look") >= 0 || low.indexOf(t) < 0); }).join(sep);
  }
  // ---- FOCUS DNA: 4-8 hand-written aesthetic keys per platform (data/focus-dna.json), editable per look in the
  // panel (chips). Front-loaded and weighted so the platform choice really shapes the prompt:
  //   Midjourney tab: own segment right after the idea, weighted ::2.5 (above the ::2 core chip, below nothing).
  //   Video tab (natural-language: Grok Imagine, ChatGPT/Sora, Kling...): plain "FOCUS DNA" sentence near the front
  //   plus a short recap at the end. Tokens are scrubbed by the same safety filters (adults 21+, no framing words).
  var FOCUS_DNA = {}, DNA_STORE = "pm.looks.focusdna.v1", DNA_EDIT = null;
  function dnaEdits() { if (DNA_EDIT) return DNA_EDIT; try { DNA_EDIT = JSON.parse(localStorage.getItem(DNA_STORE) || "{}") || {}; } catch (e) { DNA_EDIT = {}; } return DNA_EDIT; }
  function saveDnaEdits() { try { localStorage.setItem(DNA_STORE, JSON.stringify(DNA_EDIT || {})); } catch (e) {} }
  function cleanDnaToken(t) { t = sanitizeIdea(stripBlocked(String(t || "")).text).replace(/[,;]+/g, " ").replace(/::+/g, " ").replace(/\s{2,}/g, " ").trim(); return t && !hasBlocked(t) && !FRAMING_RE.test(t) ? t.slice(0, 80) : ""; }
  // An entry is either a key list, or {keys, rotate, sfw}: rich entries (Zig's own, e.g. OnlyFans) apply only in
  // 18+ mode on adult looks; outside it the "sfw" list is used. Rotating pools add one pick per slot each Remix,
  // heat-aware (partner content only at XXX), and pass the same safety scrub.
  function dnaEntry(look) { return look ? FOCUS_DNA[look.id] : null; }
  function dnaRich(look) { var e = dnaEntry(look); return !!(e && !Array.isArray(e) && e.keys && look.adult && isAdult()); }
  function focusDnaRaw(look) {
    if (!look) return []; var e = dnaEdits()[look.id]; if (Array.isArray(e)) return e;
    var d = dnaEntry(look); if (!d) return []; if (Array.isArray(d)) return d;
    return dnaRich(look) ? d.keys : (d.sfw || []);
  }
  function dnaRotate(look) {
    if (!dnaRich(look)) return [];
    var rot = dnaEntry(look).rotate || {}, heat = heatFor(look), out = [];
    var sabOn = walkStyle(look);   // the style owns set + wardrobe
    var ideaFit = ideaOutfit(S._ideaNow), ideaSetR = !sabOn && ideaSetting(S._ideaNow);
    Object.keys(rot).forEach(function (k) { if (sabOn && /^(location|wardrobe|setting|outfit)$/.test(k)) return; if (ideaFit && /^(wardrobe|outfit|styling)$/.test(k)) return; if (ideaSetR && /^(location|setting|scene|venue)$/.test(k)) return; var pool = rot[k]; if (!Array.isArray(pool)) pool = pool[heat] || pool.tease || []; var t = cleanDnaToken(pick(pool)); if (k === "location" && t) S._dnaLoc = t; if (t && !(sabOn && walkMuted(t))) out.push(t); });
    S._dnaLast = out.join(", ");
    return out;
  }
  function focusDna(look, withRotate) {
    var keys = focusDnaRaw(look).map(cleanDnaToken).filter(Boolean);
    var mute = walkStyle(look);
    return uniqList(keys).filter(function (t) {
      if (mute && walkMuted(t)) return false;   // walk styles own camera + scene; keep the look's lighting / grade
      return S.cam !== "iphone" || !GEAR_RE.test(t);   // iPhone mode: one camera only, drop lens/camera keys
    }).slice(0, 8).concat(withRotate ? dnaRotate(look) : []);
  }
  function dnaEdited(look) { return !!(look && Array.isArray(dnaEdits()[look.id])); }
  var DNA_LIGHT_RE = /\b(light|lighting|lit|flash|sun|daylight|golden[- ]hour|key|backlight|gels?|strobes?|neon|haze|practicals?|lamp)\b/i;
  // generic candid-DNA lighting lines that would cancel the platform's own lighting key
  function dnaDeconflict(text, dna) {
    if (!dna.some(function (t) { return DNA_LIGHT_RE.test(t); })) return text;
    return String(text).replace(/,?\s*ordinary mixed indoor lighting,\s*not studio,\s*not beauty lighting/g, "");
  }
  // label scrubbed like any prompt text (a few platform names carry blocked words: never let them into a prompt)
  var NAME_RISK_RE = /sis|taboo|step|teen|famil|nubile|lil|tiny|daddy|mom|kid|young|school|freeuse|perv/i;
  function lookName(look) { var n = String(displayLabel(look)).replace(/\s*\([^)]*\)/g, "").replace(/\s+(Look|Style|Aesthetic)$/i, "").trim(); return n && !hasBlocked(n) && !FRAMING_RE.test(n) && !NAME_RISK_RE.test(n) ? n : "this platform"; }
  // ---- Psych Editorial Noir switch: ONE random phrase from Zig's tag bank per Remix, as a light mood accent
  // (never overrides the Focus DNA). Seductive tags only in 18+ mode on adult looks. Adults 21+ always.
  // Psych Mood colors: Noir and Blanche (white / pale / bleached / ghostly / clinical / sterile unease). One at a time.
  var PSYCH = { noir: { label: "Psych Editorial Noir", file: "psych-noir-tags.json", bank: null }, blanche: { label: "Psych Editorial Blanche", file: "psych-blanche-tags.json", bank: null } };
  // Aura: 7 chakra colors (light / aura / mood only; never skin tone or ethnicity; the random cast stays as rolled).
  var AURA_KEYS = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"];
  var AURA_LABEL = { root: "Root Red", sacral: "Sacral Orange", solar: "Solar Gold", heart: "Heart Green", throat: "Throat Blue", "third-eye": "Third-Eye Indigo", crown: "Crown Violet-White" };
  AURA_KEYS.forEach(function (k) { PSYCH["aura-" + k] = { label: AURA_LABEL[k], aura: true, bank: null }; });
  PSYCH["aura-random"] = { label: "Aura: random", aura: true, random: true, bank: null };
  // More Psych Mood colors (light and mood only, never skin). "Random color" = any color mood incl. Noir, Blanche and Aura.
  var COLOR_KEYS = ["blush", "crimson", "gold", "ice-blue", "violet", "emerald"];
  var COLOR_LABEL = { blush: "Blush", crimson: "Crimson", gold: "Gold", "ice-blue": "Ice Blue", violet: "Violet", emerald: "Emerald" };
  COLOR_KEYS.forEach(function (k) { PSYCH[k] = { label: COLOR_LABEL[k], bank: null }; });
  PSYCH["psych-random"] = { label: "Random color", random: true, any: true, bank: null };
  function psychBank(m) {
    var d = PSYCH[m]; if (!d) return null;
    if (!d.random) return d.bank;
    if (d.any) {
      var all = Object.keys(PSYCH).filter(function (k) { return !PSYCH[k].random && PSYCH[k].bank; }); if (!all.length) return null;
      var c = pick(all); S._auraColor = PSYCH[c].aura ? PSYCH[c].label : ""; S._psychPicked = PSYCH[c].label; return PSYCH[c].bank;
    }
    var ks = AURA_KEYS.filter(function (k) { return PSYCH["aura-" + k].bank; }); if (!ks.length) return null;
    var k = pick(ks); S._auraColor = AURA_LABEL[k]; return PSYCH["aura-" + k].bank;
  }
  function psychMood() { if (S.noir === true && !S.psych) S.psych = "noir"; return PSYCH[S.psych] ? S.psych : ""; }
  function noirOn() { return !!psychMood(); }
  function noirWords(tag) { return String(tag).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase().replace(/\bof\b/g, "of").trim(); }
  function noirAccent(look) {
    S._auraColor = PSYCH[psychMood()] && PSYCH[psychMood()].aura && !PSYCH[psychMood()].random ? PSYCH[psychMood()].label : "";
    var bank = noirOn() ? psychBank(psychMood()) : null; if (!bank) return "";
    var pool = (bank.sfw || []).slice();
    if (look && look.adult && isAdult()) pool = pool.concat(bank.adult || []);
    for (var i = 0; i < 6; i++) { var t = cleanDnaToken(noirWords(String(pick(pool, S._noirLast)).replace(/,\s*/g, " and "))); if (t) { S._noirLast = t; return t; } }
    return "";
  }
  function noirMJ(text, look) {
    var a = noirAccent(look); if (!a) return text; S._noirUsed = a;
    var fw = S._focusW || "::2.5 ", k = text.indexOf(fw), seg = "mood accent: " + a + "::0.6 ";
    return k >= 0 ? text.slice(0, k + fw.length) + seg + text.slice(k + fw.length) : seg + text;
  }
  function noirVideo(text, look) {
    var a = noirAccent(look); if (!a) return text; S._noirUsed = a;
    var w = " Mood accent (light touch, never overrides the Focus DNA" + (S._auraColor ? "; " + S._auraColor + " aura as light and atmosphere only, cast unchanged" : "") + "): " + a + ".";
    var m = text.match(/FOCUS DNA [^:]*:[^.]*\./);
    return m ? text.replace(m[0], m[0] + w) : w.trim() + " " + text;
  }
  // ---- Neon Color (Brand / Rotate (default) / Pick) + Room (Messy / Clean / Random (default)), saved per device (Zig).
  // Orange came from the Rural ebony (masked) style's "neon orange grid room"; this pass rewrites only the neon / LED
  // COLOR word in the final prompt, so the lighting rotation and Focus DNA stay as they were. Brand keeps the orange.
  // Room: messy wording came from Focus DNA (xvideos "real cluttered bedroom, unmade sheets", "lived-in" sets), looks.json
  // sets ("lived-in apartment, unmade bed, real clutter") and venue banks ("rumpled sheets"). Walk styles keep their room.
  var NEON_PALETTE = ["hot pink", "magenta", "electric blue", "cyan", "ice blue", "purple", "violet", "UV blacklight", "emerald green", "lime green", "blood red", "crimson", "amber", "gold", "teal",
    "pink and blue two-tone", "purple and teal two-tone", "red and blue cop-light two-tone", "magenta and cyan two-tone", "orange"];
  var NEON_MODES = [["brand", "ZigFlames brand"], ["rotate", "Rotate"], ["pick", "Pick"]];
  var ROOM_MODES = [["random", "Random"], ["messy", "Messy"], ["clean", "Clean"]];
  function neonMode() { return S.neon === "brand" || S.neon === "pick" ? S.neon : "rotate"; }
  function neonPick() { return NEON_PALETTE.indexOf(S.neonPick) >= 0 ? S.neonPick : "hot pink"; }
  function roomMode() { return S.room === "messy" || S.room === "clean" ? S.room : "random"; }
  function rollNeon() {
    var m = neonMode();
    S._neonUsed = m === "brand" ? "" : m === "pick" ? neonPick() : pick(NEON_PALETTE, S._neonUsed ? [S._neonUsed] : []);
    S._roomUsed = roomMode() === "random" ? (Math.random() < 0.5 ? "messy" : "clean") : roomMode();
  }
  var NEON_NOUN = "(signs?|night signs|grid room|grid|glow|lights?|light strips?|tubes?|reflections|accents?|underglow|wash)";
  function neonText(text) {
    var c = S._neonUsed; if (!c) return text;
    var cw = c.replace(/ two-tone$/, "");
    text = text.replace(/\bneon (orange|amber|flame[- ]orange|fire[- ]orange)\b/gi, "neon " + cw);
    text = text.replace(/\bcolou?red LED\b/gi, cw + " LED");
    text = text.replace(new RegExp("(^|[\\s,(;:])(neon " + NEON_NOUN + ")\\b", "gi"), function (all, pre, ph, noun, offs, str) {
      var before = str.slice(Math.max(0, offs - 30), offs + pre.length).toLowerCase();
      return before.indexOf(cw.toLowerCase()) >= 0 ? all : pre + cw + " " + ph;
    });
    return text;
  }
  var CLEAN_SWAP = [[/\breal cluttered bedroom, unmade sheets\b/gi, "real tidy bedroom, neatly made sheets"], [/\blived-in apartment, unmade bed, real clutter\b/gi, "tidy apartment, neatly made bed, clear surfaces"],
    [/\breal clutter\b/gi, "clear surfaces"], [/\bcluttered\b/gi, "tidy"], [/\bmessy (apartment|room|bedroom|house|kitchen|motel room|dorm)\b/gi, "tidy $1"],
    [/\bunmade (bed|sheets)\b/gi, "neatly made $1"], [/\brumpled (sheets|linen|bed)\b/gi, "crisp fresh $1"], [/\blived-in\b/gi, "tidy, styled"], [/\bgritty and tidy, styled\b/gi, "gritty and tidy"]];
  var MESSY_RE = /\b(messy (apartment|room|bedroom|house|kitchen|motel room|dorm)|cluttered|real clutter|unmade (bed|sheets)|rumpled (sheets|linen|bed)|lived-in|clothes on the floor)\b/i;
  var INDOOR_RE = /\b(bedroom|apartment|hotel room|motel|dorm|living room|couch|bed|kitchen)\b/i;
  var IDEA_INDOOR_RE = /\b(bedroom|apartment|hotel room|motel|living room|kitchen|bathroom|office|locker room|dressing room|laundromat|garage|basement)\b/i;
  var MESSY_MJ = "messy lived-in room, unmade bed, clothes on the floor";
  var MESSY_VIDEO = "Room: messy lived-in room, unmade bed, clothes on the floor.";
  function roomText(text, look, tab) {
    if (walkStyle(look) || S.style === "sabaddie" || S.style === "roomwalk") return text;
    if (S._roomUsed === "clean") { CLEAN_SWAP.forEach(function (x) { text = text.replace(x[0], x[1]); }); return text; }
    // indoor check only on the ROLLED scene (rotated DNA location > venue / Setting), never the look's whole set list
    var ideaSp = settingPhrase(S._ideaNow);   // the idea's setting wins: Messy is judged against it
    var scene = ideaSp || (dnaRich(look) && S._dnaLoc) || (tab === "video" && (text.match(/\bSetting: ([^.]*)/) || [])[1]) || S._venueNow || "";
    if (S._roomUsed === "messy" && (INDOOR_RE.test(scene) || (ideaSp && IDEA_INDOOR_RE.test(scene))) && !MESSY_RE.test(text)) {
      if (ideaSp && !/\b(bedroom|bed|motel|hotel room|dorm)\b/i.test(ideaSp)) {
        var core = ideaSp.replace(/\s+(?:at|in|during|after|by)\s+.*$/i, ""), mj2 = "messy lived-in " + core + ", real clutter, clothes on the floor";
        if (tab === "video") { var tl = /\s*adult 21\+\.?\s*$/; return tl.test(text) ? text.replace(tl, " Room: " + mj2 + ". adult 21+.") : text + " Room: " + mj2 + "."; }
        var m2 = text.match(/::[0-9.]+\s*$/);
        return m2 ? text.slice(0, m2.index) + ", " + mj2 + m2[0] : text.replace(/[,\s]+$/, "") + ", " + mj2;
      }
      if (tab === "video") { var tail = /\s*adult 21\+\.?\s*$/; return tail.test(text) ? text.replace(tail, " " + MESSY_VIDEO + " adult 21+.") : text + " " + MESSY_VIDEO; }
      var m = text.match(/::[0-9.]+\s*$/);
      return m ? text.slice(0, m.index) + ", " + MESSY_MJ + m[0] : text.replace(/[,\s]+$/, "") + ", " + MESSY_MJ;
    }
    return text;
  }
  function neonRoom(text, look, tab) { rollNeon(); return roomText(neonText(text), look, tab); }
  // ---- No AI Look (default ON) + Real Porn Look (default ON, 18+ mode only), both saved per device (Zig).
  // Negatives only target the generic "AI image" look. They NEVER negate realistic camera cues (iPhone / phone footage,
  // 90s / camcorder, 50mm, film grain, handheld, flash, noise...): no grain / blur / flash / phone / vintage / low quality
  // terms here, and noConflict() drops any term whose key word already appears in this prompt's positive text.
  // Real Porn Look adds realism only: Focus DNA keeps priority and the rotated lighting is never replaced. Adults 21+ only.
  var NOAI_NO = ["plastic skin", "airbrushed", "waxy skin", "uncanny valley", "CGI", "3D render", "concept art", "oversharpened", "AI-generated look", "doll face", "beauty filter", "stock photo", "AI sheen", "over-processed", "video game render"];
  var NOAI_MJ = "natural skin texture, visible pores, real camera sensor noise, true-to-life";
  var NOAI_VIDEO = "Realism: natural skin texture with visible pores, real camera sensor noise, true-to-life (keeps the camera look above).";
  var REALP_NO = ["synthetic AI look", "hentai", "anime", "rendered", "fake-looking body", "mannequin", "plastic", "overly idealized body"];
  var REALP_MJ = "real adult production footage, amateur camcorder or phone authenticity, practical on-set lighting as set for this shot, natural real bodies, real skin, candid unposed moments, behind-the-scenes realism, adult performers 21+";
  var REALP_VIDEO = "Real adult-industry look (realism only, never overrides the Focus DNA or this shot's lighting): real adult production footage with amateur camcorder or phone authenticity, practical on-set lighting as set above, natural real bodies and real skin, candid unposed moments, behind-the-scenes realism; adult performers 21+.";
  var NOAI_STOP = /^(skin|look|face|body|ai|ai-generated|over|real|-)$/i;
  function noAiOn() { return S.noAi !== false; }
  function realPornOn() { return S.realPorn !== false; }
  function realLook(look) { return !!look && gearOf(look).kind !== "virtual"; }
  function realPornActive(look) { return realPornOn() && isAdult() && realLook(look); }
  function noConflict(terms, body) {
    var b = " " + String(body || "").toLowerCase().replace(/[^a-z0-9+]+/g, " ") + " ";
    return terms.filter(function (t) {
      return !t.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && !NOAI_STOP.test(w); }).some(function (w) { return b.indexOf(" " + w + " ") >= 0; });
    });
  }
  // ---- Anti-Generic Prime (default ON, SFW and 18+, saved per device): front-loads the must-haves (idea box + the look's
  // top Focus DNA traits) at the Focus DNA weight, adds 1-2 oddly specific real-life micro details per Remix, and
  // anti-generic negatives (same conflict filter as above). Adult-only details; clutter details skipped on Room=Clean
  // and on walk styles (their empty room stays empty).
  var AG_NO = ["generic", "stock pose", "cliché", "basic composition", "centered portrait", "default AI face", "same-face", "bland", "cookie-cutter", "overused pose"];
  var AG_DETAILS = ["chipped nail polish on one nail", "sweat on the upper lip", "hair tie on her wrist", "slightly smudged mascara", "faint tan line at the shoulder", "wrinkled shirt hem", "a stray hair across her cheek",
    "lip balm shine slightly uneven", "a small healed scar on the knee", "freckles across the nose", "a bra strap mark on the shoulder", "goosebumps on the forearms", "a loose thread on the sleeve", "faint crease lines from a pillow on the cheek",
    "one earring slightly crooked", "a ring on the thumb", "a smartwatch with a scratched face", "a thin gold anklet", "flyaway fine hairs at the hairline", "a faint sock-line mark on the ankles",
    "a tiny nick from shaving on the shin", "lipstick slightly worn off the center of the lips", "a faded stamp from a club on the back of the hand", "a hair clip holding back one side", "a visible vaccination mark on the upper arm",
    "slightly frizzy ends from humidity", "a shiny forehead from heat", "a crease in the waistband", "a sticker-shaped tan line on the hip", "a smudge of foundation on the collar", "a stretched-out neckline", "nails painted two slightly different shades",
    "a loose eyelash on the cheek", "dewy sweat at the collarbone", "a faint watch tan on the wrist", "a pen mark on the palm", "a bobby pin sliding out of the hair", "a half-peeled gel nail", "a slightly crooked collar",
    "a smear of lip gloss on a cup rim", "car keys clipped to a lanyard", "a cracked phone screen protector", "a coffee cup with a lipstick mark", "a crumpled receipt", "a half-drunk water bottle with condensation", "a phone with a chunky case",
    "a hoodie string chewed at the end", "a tote bag slumped by the door", "sunglasses pushed up into the hair", "a bandage on one finger", "a hair strand stuck to lip gloss", "a small tattoo slightly faded", "shoe straps leaving a mark on the ankle",
    "a dusting of glitter left on the cheekbone", "a damp towel over the shoulder", "an iced coffee sweating a ring onto the surface", "headphones around the neck", "a tangle of necklaces", "a phone in the back pocket",
    "socks with a hole at the toe", "a sunburn line on the nose", "a slightly uneven eyeliner wing", "a tiny chip in a front-tooth veneer", "a jacket slipping off one shoulder", "a lighter and keys on a ledge", "a takeout cup with a bent straw"];
  var AG_CLUTTER = ["a phone charger cable on the floor", "a receipt on the dresser", "an open makeup bag spilling onto the counter", "a pile of clothes on a chair", "a half-eaten snack bag on the bed", "an empty energy drink can on the nightstand",
    "a hairbrush with hair in it on the counter", "a tangle of cables behind the TV", "shoes kicked off by the door", "an overflowing laundry basket", "a crumpled bedsheet corner", "takeout boxes on the table", "a bobby-pin dish knocked over",
    "sticky notes on the mirror", "a ring light cable taped to the floor", "a used towel on the bathroom floor"];
  var AG_HOLD = [];
  function agOn() { return S.antiGeneric !== false; }
  function agCleanRoom(look) { return S._roomUsed === "clean" || walkStyle(look) || S.style === "sabaddie" || S.style === "roomwalk"; }
  function agDetails(look) {
    var pool = AG_DETAILS.concat(agCleanRoom(look) ? [] : AG_CLUTTER), out = [], n = Math.random() < 0.5 ? 1 : 2;
    if (ideaOutfit(S._ideaNow)) pool = pool.filter(function (d) { return !new RegExp("\\b" + OTHER_GARMENT + "\\b|\\b(bra strap|jacket|socks|hoodie)\\b", "i").test(d); });   // idea outfit: no other garments
    var spD = !agCleanRoomWalk(look) && settingPhrase(S._ideaNow);
    if (spD) { var reD = settingScrubRe(spD); pool = pool.filter(function (d) { return !reD.test(d); }); }   // idea setting: no details from another room
    while (out.length < n) { var d = pick(pool, AG_HOLD.concat(out)); if (out.indexOf(d) < 0) out.push(d); }
    AG_HOLD = out.concat(AG_HOLD).slice(0, 12); S._agUsed = out; return out;
  }
  function agMust(look) {
    var idea = String(S._ideaNow || "").trim(), dna = focusDnaRaw(look).map(cleanDnaToken).filter(Boolean).slice(0, 3);
    if (S._roomUsed === "clean" && !agCleanRoomWalk(look)) dna = dna.map(function (t) { CLEAN_SWAP.forEach(function (x) { t = t.replace(x[0], x[1]); }); return t; });
    var spM = !agCleanRoomWalk(look) && settingPhrase(idea);
    if (spM) { var reM = settingScrubRe(spM); dna = dna.filter(function (t) { return !reM.test(t) || S._setKeep.test(t); }); }
    return (idea ? [idea] : []).concat(dna);
  }
  function agCleanRoomWalk(look) { return walkStyle(look) || S.style === "sabaddie" || S.style === "roomwalk"; }
  function agMJ(text, look) {
    if (!agOn()) return guardIdea(text, "mj");
    var must = agMust(look), det = agDetails(look);
    if (must.length) text = must.join(", ") + "::" + (typeof DNA_W !== "undefined" ? DNA_W[dnaW()] : "2") + " " + text;
    var m = text.match(/::[0-9.]+\s*$/);
    return m ? text.slice(0, m.index) + ", " + det.join(", ") + m[0] : text.replace(/[,\s]+$/, "") + ", " + det.join(", ");
  }
  function agVideo(text, look) {
    if (!agOn()) return guardIdea(text, "video");
    var must = agMust(look), det = agDetails(look);
    if (must.length) text = "Must show: " + must.join("; ") + ". " + text;
    var add = "Real-life details: " + det.join(", ") + ".", tail = /\s*adult 21\+\.?\s*$/;
    return tail.test(text) ? text.replace(tail, " " + add + " adult 21+.") : text + " " + add;
  }
  // the idea box text must be in every prompt; if a style or DNA pass ever drops it, it goes back up front
  function guardIdea(text, tab) {
    var idea = String(S._ideaNow || "").trim(); if (!idea || text.toLowerCase().indexOf(idea.toLowerCase()) >= 0) return text;
    return tab === "video" ? "Must show: " + idea + ". " + text : idea + "::2 " + text;
  }
  // Idea names an outfit: drop any other garment phrase (style / DNA / cast wardrobe) from the positive text so nothing
  // contradicts it. Phrases that contain the idea's own outfit (or its garments) stay; negatives are never touched.
  var OTHER_GARMENT = "(?:micro[\\s-]?bikinis?|bikinis?|lingerie|(?:mini |slip |bodycon |sundress|maxi )?dress(?:es)?|bodysuits?|bodystockings?|robes?|g[\\s-]?strings?|thongs?|jeans|denim|skirts?|t-shirts?|tees|hoodies?|cosplay|swimsuits?|swimwear|crop tops?|tank tops?|booty shorts|micro shorts|shorts|corsets?|stockings|fishnets?|bralettes?|bras?|leggings|mock-neck top|blazers?|kimonos?|panties|lace bodysuit|sweatpants|sweater|cardigan|jersey|catsuit|leotard|teddy|babydoll|designer wardrobe)";
  var OTHER_GARMENT_RE = new RegExp("(,|;|(?<!:):(?!:))(\\s*)([^,;.:]*?\\b" + OTHER_GARMENT + "\\b[^,;.:]*)", "gi");
  function ideaOutfitScrub(text) {
    var idea = S._ideaNow; if (!ideaOutfit(idea)) return text;
    var keep = [outfitPhrase(idea)].concat(garmentsOf(idea)).filter(Boolean).map(function (x) { return x.toLowerCase(); });
    var out = text.replace(OTHER_GARMENT_RE, function (all, sep, sp, seg) {
      var l = seg.toLowerCase(); if (keep.some(function (k) { return l.indexOf(k) >= 0; })) return all;
      return sep === ":" ? ":" : "";
    });
    return out.replace(/:\s*,\s*/g, ": ").replace(/,\s*,/g, ",").replace(/:\s*\./g, ".").replace(/\s+,/g, ",").replace(/ {2,}/g, " ");
  }
  // ---- Idea setting priority (Zig): the idea box names a place -> the look's rotated / pooled scene, venue and style set are
  // dropped so nothing contradicts it; the Video "Setting:" line uses the idea's setting. Walk styles keep their own room.
  var SETTING_WORDS = "roof ?tops?|hotel rooms?|hotel suites?|hotel lobby|hotel|hallways?|corridors?|parking (?:lots?|garages?|structures?|decks?)|parking|garages?|saunas?|steam rooms?|poolside|pools?|beach(?:es)?|offices?|kitchens?|bathrooms?|bedrooms?|living rooms?|locker rooms?|dressing rooms?|cars?|backseat|nightclubs?|clubs?|gyms?|laundromats?|motels?|balcon(?:y|ies)|streets?|alleys?|alleyways?|studios?|warehouses?|backyards?|showers?|elevators?|stairwells?|patios?|terraces?|porch|penthouses?|apartments?|lobby|diner|casino|backstage|stage|yacht|boat|forest|woods|desert|park|lake|riverside|farm|barn|subway|train|airport|jacuzzi|hot tub|spa|basement|attic|bar|lounge";
  var SETTING_RE = new RegExp("((?:[\\w'\u2019&-]+\\s+){0,2})\\b(" + SETTING_WORDS + ")\\b((?:\\s+(?:" + SETTING_WORDS + ")\\b)*)((?:\\s+(?:at|in|during|after|by)\\s+(?:the\\s+)?(?:night|nighttime|midnight|dusk|dawn|sunset|sunrise|golden hour|noon|daytime|day))?)", "i");
  var SET_STOP = /^(?:on|in|at|inside|into|outside|by|near|from|to|of|a|an|the|her|his|their|our|my|this|that|some|empty|wearing|and|with|while|then)$/i;
  function ideaSetting(idea) { return !!settingPhrase(idea); }
  function settingPhrase(idea) {
    var t = String(idea || ""); if (!t) return "";
    if (S._setIdeaKey === t) return S._setIdeaVal;
    var m = t.match(SETTING_RE), out = "";
    if (m && !/^\s*car\s+keys?\b/i.test(t.slice(m.index + m[1].length))) {
      var lead = m[1].trim().split(/\s+/).filter(Boolean), keep = [];
      for (var i = lead.length - 1; i >= 0; i--) { if (SET_STOP.test(lead[i])) break; keep.unshift(lead[i]); }
      if (keep.length && OUTFIT_RE.test(keep.join(" "))) keep = [];
      out = (keep.join(" ") + " " + m[2] + m[3] + m[4]).replace(/\s+/g, " ").trim();
    }
    S._setIdeaKey = t; S._setIdeaVal = out; return out;
  }
  function ideaSetOr(x) { var sp = settingPhrase(S._ideaNow); return sp || x; }
  // place nouns that contradict a different idea setting (positives only)
  var PLACE_LIST = ["bedrooms?", "bathrooms?", "kitchens?", "living[ -]rooms?", "dining rooms?", "couch(?:es)?", "sofas?", "unmade bed", "the bed", "a bed", "her bed", "beds", "bedside", "nightstands?", "headboards?", "mattress(?:es)?", "(?:silk |satin |rumpled |unmade )?sheets",
    "garages?", "saunas?", "steam rooms?", "poolside", "pools?", "beach(?:es)?", "sand on (?:her |their |glistening )?skin", "sand", "offices?", "cars?(?! keys)", "backseat", "nightclubs?", "club floor", "dance floor", "gyms?", "laundromats?", "motels?", "balcon(?:y|ies)",
    "parking (?:lots?|garages?|structures?|decks?)", "streets?", "street-pickup", "bed level", "mansions?", "mansion-party", "estates?", "arena", "ryokan", "hostel", "pub", "vans?", "taxis?", "limousines?", "cabins?", "condos?", "classrooms?", "rooms?", "locations?", "(?<!\\b(?:lingerie|lace|bikini|workout|pajama|yoga|athleisure|velour|satin|linen|knit|latex|co-ord|matching|bralette|sporty|sports|strappy|coordinated|phone|color|no|a|full|gym|two-piece|bra|swim|tennis|track|sweat|lounge|ribbed|outfit|designer|neon)\\s)[a-z-]+ sets?", "red carpet", "limos?", "sound-stage", "bar[- ]stools?", "alleys?", "alleyways?", "studio sets?", "photo studio", "studio backdrop", "home studio", "hot studio", "studio flats?", "recording studio", "in a studio", "locker rooms?", "warehouses?", "backyards?",
    "ballrooms?", "backstage", "(?:wide|contest|bikini contest|club|on|a|the) stage", "stage with", "apartments?", "shared flat", "hotel rooms?", "hotel suites?", "suites?", "hotels?", "lobby", "showers?", "bathtubs?", "jacuzzi", "hot tub", "lounge set", "lounge", "dive bar", "cocktail bar", "bar counter", "vip booth",
    "porch(?:es)?", "farm\\w*", "barns?", "open field", "grass field", "corn ?field", "basement", "patios?", "terraces?", "lawn", "yard", "dressing rooms?", "vanity", "villas?", "penthouses?", "loft(?: set)?", "tatami room", "house-party", "houses?", "homes", "rooftops?", "roof", "hallways?", "corridors?",
    "elevators?", "stairwells?", "tiled floor", "living-room", "runway", "catwalk", "caf\u00e9s?", "cafes?", "diner", "starship", "spaceship", "forest", "jungle", "desert", "lake", "yacht", "boat", "casino", "subway", "train", "airport", "warehouse", "abandoned-house", "interiors?", "window daylight", "blinds"];
  var OUTDOOR_SET = /\b(roof ?tops?|roof|beach|poolside|streets?|alleys?|alleyways?|parking lots?|backyards?|balcon\w+|patio|terrace|porch|forest|woods|desert|park|lake|riverside|farm|yacht|boat)\b/i;
  var SET_SYN = { rooftop: "roof", roof: "rooftop", hallway: "corridor", corridor: "hallway", pool: "poolside", poolside: "pool", car: "backseat", club: "nightclub|club floor|dance floor", nightclub: "club|dance floor", hotel: "hotels?", bedroom: "bed|sheets|nightstand|headboard|mattress|room", motel: "bed|sheets|nightstand|room", bathroom: "room", kitchen: "room", beach: "sand", apartment: "apartments?", studio: "studio" };
  function settingKeep(sp) {
    var w = (sp.toLowerCase().match(new RegExp("\\b(" + SETTING_WORDS + ")\\b", "gi")) || []).map(function (x) { return x.toLowerCase().replace(/s$/, ""); });
    var extra = []; w.forEach(function (x) { if (SET_SYN[x]) extra.push(SET_SYN[x]); });
    return w.concat(extra);
  }
  function settingScrubRe(sp) {
    if (S._setReKey === sp) return S._setRe;
    var keep = new RegExp("\\b(?:" + settingKeep(sp).join("|") + ")s?\\b", "i");
    var list = PLACE_LIST.filter(function (x) { var probe = x.replace(/\(\?[^)]*\)|[?\\\[\]()|*+]/g, " ").replace(/\s+/g, " ").trim(); return !probe.split(/[ -]/).filter(function (w) { return !/^(a|the|her|on|in|with|of|and)$/i.test(w); }).every(function (w) { return keep.test(w); }); });
    list.push(OUTDOOR_SET.test(sp) ? "indoors?|indoor venue|indoor" : "outdoors?|outdoor|open air|sunlit exterior|exteriors?");
    S._setReKey = sp; S._setRe = new RegExp("\\b(?:" + list.join("|") + ")\\b", "i"); S._setKeep = keep;
    return S._setRe;
  }
  var NEON_BIT_RE = /(?:[\w-]+\s+){0,2}neon\s+[\w-]+/i;
  function ideaSettingScrub(text, look, tab) {
    var idea = String(S._ideaNow || "").trim(), sp = settingPhrase(idea);
    if (!sp || walkStyle(look) || S.style === "sabaddie" || S.style === "roomwalk") return text;
    var conf = settingScrubRe(sp), keep = S._setKeep, ideaL = idea.toLowerCase();
    // negatives are never touched
    var cut = text.search(/\s--no\s|\bAvoid:/), neg = cut >= 0 ? text.slice(cut) : "", pos = cut >= 0 ? text.slice(0, cut) : text;
    var isConf = function (seg) { var l = seg.toLowerCase(); if (l.indexOf(ideaL) >= 0) return false; return conf.test(seg) && !(new RegExp("\\b" + sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(seg)); };
    if (tab === "video") {
      var first = true;
      pos = pos.replace(/(^|\.\s+)(Setting|Set|Location|Scene): ([^.]*)\.(?=\s|$)/g, function (all, pre, lab, val) {
        if (!isConf(val) && new RegExp(sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(val)) { first = false; return all; }
        if (!isConf(val)) return all;
        var neon = (val.match(NEON_BIT_RE) || [])[0];
        if (first) { first = false; return pre + "Setting: " + sp + (neon ? ", " + neon : "") + "."; }
        return neon ? pre + "Light: " + neon + "." : pre.replace(/\s+$/, " ");
      });
      if (!/\bSetting: /.test(pos)) {
        var at = pos.search(/\s(?:Light: |Camera: |Keys: |Aspect \d)/);
        pos = at > 0 ? pos.slice(0, at) + " Setting: " + sp + "." + pos.slice(at) : pos.replace(/\s*(adult 21\+\.?)?\s*$/, function (m0, t21) { return " Setting: " + sp + "." + (t21 ? " " + t21 : ""); });
      }
    }
    // comma / semicolon / label segments: drop the ones that name another place (keep the idea, its setting and any neon)
    pos = pos.replace(/(^|,|;|(?<!:):(?!:)|\u2014|\.(?=\s)|::[0-9.]+(?=\s))(\s*)([^,;.:\u2014]+)/g, function (all, sep, sp2, seg) {
      if (!isConf(seg) || /21\+/.test(seg)) return all;
      if (/::\s*$/.test(seg)) return all;
      var neon = (seg.match(NEON_BIT_RE) || [])[0];
      if (neon && !conf.test(neon)) return sep + sp2 + neon;
      return sep === ":" || sep === "." || sep.indexOf("::") === 0 ? sep + (sep.indexOf("::") === 0 ? " " : "") : "";
    });
    pos = pos.replace(/\s+[\u2014-]\s*(?=[.,;]|$)/g, "").replace(/:\s*[,;]\s*/g, ": ").replace(/([,;])\s*[,;]/g, "$1").replace(/(^|\.\s+)[A-Z][\w ()-]{0,40}:\s*\./g, "$1").replace(/:\s*\./g, ".")
      .replace(/\s+([,;])/g, "$1").replace(/([.:])\s*[,;]\s*/g, "$1 ").replace(/^[,;\s]+/, "").replace(/,\s*(::[0-9.]+)/g, "$1").replace(/(::[0-9.]+)\s*[,;]\s*/g, "$1 ").replace(/ {2,}/g, " ");
    return pos + neg;
  }
  function realNoTerms(look, body) {
    var t = (realLook(look) && noAiOn() ? NOAI_NO : []).concat(realPornActive(look) ? REALP_NO : []).concat(agOn() ? AG_NO : []).concat(uniqueOn() ? ["same face", "generic face", "cloned faces"] : []);
    return noConflict(t, body);
  }
  function realMJ(text, look) {
    text = myMixMJ(ideaSettingScrub(agMJ(ideaOutfitScrub(neonRoom(text, look, "mj")), look), look, "mj")); S._lastBody = text; if (!realLook(look)) return text;
    var add = (noAiOn() ? [NOAI_MJ] : []).concat(realPornActive(look) ? [REALP_MJ] : []);
    if (!add.length) return text;
    var m = text.match(/::[0-9.]+\s*$/);
    var out = m ? text.slice(0, m.index) + ", " + add.join(", ") + m[0] : text.replace(/[,\s]+$/, "") + ", " + add.join(", ");
    S._lastBody = out; return out;
  }
  function realVideo(text, look) {
    text = myMixVideo(ideaSettingScrub(agVideo(ideaOutfitScrub(neonRoom(text, look, "video")), look), look, "video")); S._lastBody = text;
    var add = realLook(look) ? (noAiOn() ? [NOAI_VIDEO] : []).concat(realPornActive(look) ? [REALP_VIDEO] : []) : [];
    var no = realNoTerms(look, text + " " + add.join(" "));
    S._lastBody = text + " " + add.join(" ");   // positives only, so the --no params get the same terms as the Avoid line
    if (no.length) add.push("Avoid: " + no.join(", ") + ".");
    if (!add.length) return text;
    var tail = /\s*adult 21\+\.?\s*$/;
    return tail.test(text) ? text.replace(tail, " " + add.join(" ") + " adult 21+.") : text + " " + add.join(" ");
  }
  // ---- Perfect Anatomy (default ON) + Focus DNA weight (Light / Normal / Strong / Max), both saved per device.
  var ANATOMY_MJ = "perfect anatomy, correct hands five fingers, natural proportions";
  var ANATOMY_VIDEO = "Perfect anatomy (hold every frame): correct hands, exactly five fingers per hand, natural limb count and proportions, accurate joints, natural feet, symmetrical eyes, coherent body.";
  var ANATOMY_NO = ["extra limbs", "extra fingers", "missing fingers", "fused fingers", "distorted hands", "malformed hands"];
  var DNA_W = { light: "1.5", normal: "2.5", strong: "3", max: "3.5" };
  var DNA_W_LABEL = [["light", "Light"], ["normal", "Normal"], ["strong", "Strong"], ["max", "Max"]];
  function anatomyOn() { return S.anatomy !== false; }
  function dnaW() { return DNA_W[S.dnaW] ? S.dnaW : "normal"; }
  function focusMJ(text, look) {
    var dna = focusDna(look, true); if (!dna.length) return text;
    text = dnaDeconflict(text, dna);
    S._focusW = "::" + DNA_W[dnaW()] + " ";
    var seg = lookName(look) + " look, " + dna.join(", ") + (anatomyOn() ? ", " + ANATOMY_MJ : "") + S._focusW;
    var k = text.indexOf("::2 "), chip = dnaChip(look, null).join(", ");
    // right after the idea segment (idea::2); with no idea typed it goes at the very front
    if (chip && text.indexOf(chip) === 0) k = -1;
    return k >= 0 && k < 400 ? text.slice(0, k + 4) + seg + text.slice(k + 4) : seg + text;
  }
  function focusVideo(text, look) {
    var dna = focusDna(look, true); if (!dna.length) return text;
    text = dnaDeconflict(text, dna);
    var wt = dnaW();
    var w = "FOCUS DNA \u2014 " + lookName(look) + " look (highest priority after the action; " + (wt === "max" ? "strictly " : "") + "must read in every frame): " + dna.join(", ") + "." + (anatomyOn() ? " " + ANATOMY_VIDEO : "");
    var m = text.match(/^Main action \(priority\):[^.]*\.\s*/);
    var out = m ? m[0] + w + " " + text.slice(m[0].length) : w + " " + text;
    if (dnaRich(look)) {   // Zig's rotated location + wardrobe replace the random venue and outfit
      var rot = walkStyle(look) ? {} : (dnaEntry(look).rotate || {});
      if (rot.location) out = out.replace(/\s*Setting: [^.]*\.(?=\s)/, "");
      if (rot.wardrobe) out = out.replace(/(Styling: )[^,.]*,\s*/, "$1");
    }
    var rk = (wt === "max" ? dna : dna.slice(0, 3)).concat(anatomyOn() ? ["perfect anatomy"] : []);
    if (wt === "strong") out = out.replace(/(\s)(Camera: )/, "$1Focus DNA again: " + dna.slice(0, 3).join("; ") + ". $2");
    var recap = wt === "light" ? (anatomyOn() ? " Recap: perfect anatomy." : "") : " Focus DNA recap" + (wt === "max" ? " (strictly)" : "") + ": " + rk.join("; ") + ".";
    if (!recap) return out;
    return /\s*adult 21\+\.?\s*$/.test(out) ? out.replace(/\s*adult 21\+\.?\s*$/, recap + " adult 21+.") : out + recap;
  }
  // ---- Art by (Zig): one subtle artist INFLUENCE per Remix (lighting / composition / color / attitude). Never a medium,
  // never a painting: the photorealistic iPhone/photo look and Focus DNA stay in charge. Banks in data/art-by.json.
  // Categories: photo / director, plus adult (18+ mode only; real, publicly known adult-film directors and glamour photographers).
  // MJ: low-weight ::0.6 segment. Video: one light-touch line. --no gets painting/illustration/drawing/cartoon/CGI.
  var ART = null, ART_CATS = [["all", "All"], ["photo", "Photo"], ["director", "Director"], ["adult", "Adult"]];
  var ART_NO = "painting, illustration, drawing, cartoon, CGI";
  function artCat() { var c = S.artCat || "all"; return ART_CATS.some(function (x) { return x[0] === c; }) ? c : "all"; }
  function artPick(look) {
    if (!ART || !ART.artists) return null;
    var c = artCat(), cats = c === "all" ? ["photo", "director"].concat(isAdult() ? ["adult"] : []) : [c === "adult" && !isAdult() ? "photo" : c];
    var pool = []; cats.forEach(function (k) { (ART.artists[k] || []).forEach(function (e) { if (Array.isArray(e) && !hasBlocked(e[0] + " " + e[1])) pool.push([k, e[0], e[1]]); }); });
    if (!pool.length) return null;
    var e = pick(pool), plat = look ? lookName(look) : "iPhone";
    var credit = "with a subtle influence of " + e[1] + "'s " + e[2];
    return { cat: e[0], name: e[1], trait: e[2], credit: e[1] + " \u00b7 " + e[2],
      mj: credit + ", still a photorealistic " + plat + " shot::0.6",
      video: "Influence (light touch only, never overrides Focus DNA, stays photorealistic): " + credit + ", still a photorealistic " + plat + " shot." };
  }
  function artApply(text, tab, look) {
    S._artUsed = null; if (S.artOn !== true) return text;
    var a = artPick(look); if (!a) return text; S._artUsed = a;
    return artInsert(text, a, tab);
  }
  function artInsert(text, a, tab) {
    if (tab === "video") return /\s*adult 21\+\.?\s*$/.test(text) ? text.replace(/\s*adult 21\+\.?\s*$/, " " + a.video + " adult 21+.") : text + " " + a.video;
    return text + " " + a.mj;
  }
  function artNo(params) {
    if (!params || params.indexOf("painting, illustration") >= 0) return params;
    return /--no /.test(params) ? params.replace(/--no /, "--no " + ART_NO + ", ") : params + " --no " + ART_NO;
  }
  function artReroll() {
    var res = S.result, a = artPick(res ? lookById(res.look) : null); if (!a) return;
    if (res && res.body && res.art) {
      var old = res.tab === "video" ? res.art.video : res.art.mj, nb = res.body.indexOf(old) >= 0 ? res.body.replace(old, res.tab === "video" ? a.video : a.mj) : artInsert(res.body, a, res.tab);
      res.body = nb; res.art = a; res.params = artNo(res.params); res.text = compose(res); try { S.api.current.setPrompt(res.text); } catch (e) {}
    }
    S.artLast = a.credit; save(); renderPanel(); toast("Art by", a.credit);
  }
  function stampMJ(text, look) {
    text = noirMJ(focusMJ(text, look), look);
    var st = stampOf(look); if (!st) return text;
    // own segment right after his DNA chip, weighted under it (::1.5 < ::2) so his DNA still leads
    var k1 = text.indexOf("::2 "), k2 = k1 >= 0 ? text.indexOf("::2 ", k1 + 4) : -1, at = k2 >= 0 && k2 < 600 ? k2 + 4 : (k1 >= 0 ? k1 + 4 : 0);
    var out = text.slice(0, at) + stampFresh(st.mj, text, ", ") + "::1.5 " + text.slice(at);
    return out;
  }
  function stampVideo(text, look) {
    text = noirVideo(focusVideo(text, look), look);
    var st = stampOf(look); if (!st) return text;
    var w = "Look stamp (on top of the DNA above, never replaces cast, faces or style): " + stampFresh(st.video, text, "; ") + ".";
    var m = text.match(/^(Main action \(priority\):[^.]*\.\s*)?(FOCUS DNA [^:]*:[^.]*\.\s*)?(Core DNA \(priority\):[^.]*\.\s*)?/);
    if (m && !m[0]) m = null;
    var out = m ? m[0] + w + " " + text.slice(m[0].length) : w + " " + text;
    return out;
  }
  function castNoun(cast) { return cast.some(function (r) { return r.man; }) ? "adults" : "women"; }
  function castTag(i, n, noun) { return ORD[i + 1] + " of the " + n + " " + noun; }
  // Last pass for 2+ people: the cast is always plural (they / them / women), never "she" or one "woman".
  var VERB_FIX = { is: "are", has: "have", does: "do", was: "were" };
  function pluralCast(text, cast) {
    var n = cast.length; if (n < 2) return text;
    var W = castNoun(cast);
    return String(text)
      .replace(/\badult woman aged\b/g, "adult aged")
      .replace(/\bone (woman|character|person) per frame( preferred)?/gi, n + " different " + W + " in frame")
      .replace(/\badult woman 21\+/g, "adult " + W + " 21+")
      .replace(/\bevery woman has\b/gi, "all " + n + " " + W + " have")
      .replace(/\bjust her\b/gi, "just them").replace(/\b(hyping|for|at|to|on|with) her\b(?!\s+(?!up\b|down\b)[a-z])/gi, "$1 them")
      .replace(/\b([Ss])he (\w+)/g, function (m, s0, v) { var b = VERB_FIX[v] || (/(ch|sh|ss|x)es$/.test(v) ? v.slice(0, -2) : /[^su]s$/.test(v) ? v.slice(0, -1) : v); return (s0 === "S" ? "They " : "they ") + b; })
      .replace(/\bShe\b/g, "They").replace(/\bshe\b/g, "they").replace(/\bherself\b/gi, "themselves").replace(/\bHer\b/g, "Their").replace(/\bher\b/g, "their")
      .replace(/\b(?:a|an|one) ((?:[\w-]+ ){0,4}?)(woman|girl)\b/gi, function (m, mid) { return n + " " + mid + W; })
      .replace(/\bwoman\b/g, W).replace(/\bWoman\b/g, W.replace(/^./, function (c) { return c.toUpperCase(); })).replace(/\bgirl\b/gi, W);
  }
  // ---- DNA leads: when his DNA is in charge (candid DNA, Fresh faces, Crowd, Twerk show, Mash-up, any Style),
  // the platform look's own generic camera / lighting / set / framing / pacing / beats text is stripped so it can't overlay his stems.
  function leanOn(look) { return !!look && gearOf(look).kind !== "virtual" && (dnaOn(look) || dnaRich(look) || freshOn() || crowdOn() || twerkOn() || S.mash === true || styleOf(look) !== "club"); }
  var LEAN_KEEP_RE = /^(Main action \(priority\)|Beats|Mood|Look):/;
  function noCrowdList(text) { return crowdOn() ? String(text || "") : String(text || "").split(/,\s*/).filter(function (f) { return f && (/adults? 21\+|::2|^\s*no\s/i.test(f) || !CROWD_RE.test(f)); }).join(", "); }
  function noCrowdProse(text) {
    if (crowdOn()) return String(text || "");
    return String(text || "").split(/(?<=\.)\s+/).map(function (sen) {
      if (/^Main action \(priority\):/.test(sen)) return sen;
      var m = sen.match(/^([A-Z][A-Za-z ]{0,20}:\s*)/), lab = m ? m[1] : "", body = m ? sen.slice(lab.length) : sen;
      var end = /\.\s*$/.test(body) ? "." : ""; body = body.replace(/\.\s*$/, "");
      var kept = body.split(/;\s*/).map(noCrowdList).filter(Boolean).join("; ");
      return kept ? lab + kept + end : "";
    }).filter(Boolean).join(" ");
  }

  // ---- Style presets (Remix matches Zig's examples). Adults 21+ only, every style, every heat. --------------
  // club = candid club DNA (above); contest = Nigerian twerk-contest audition; sync = five South Indian women in sync.
  var STYLES = [["none", "None"], ["club", "Club candid"], ["contest", "Nigerian contest"], ["carib", "Caribbean contest"], ["sync", "South Indian sync"], ["ny", "NY twerk"], ["duo", "Noir duo"], ["rural", "Rural ebony"], ["tryouts", "Model tryouts"], ["sabaddie", "South African Baddie Walk"], ["roomwalk", "Room Walk Loop"]];
  function styleOf(look) {
    if (look && gearOf(look).kind === "virtual") return "club";
    var st = S.mash && S._mashPrimary ? S._mashPrimary : S.style;
    if ((st === "sabaddie" || st === "roomwalk") && !isAdult()) return "club";   // 18+ mode only
    return /^(contest|carib|sync|ny|duo|rural|tryouts|sabaddie|roomwalk)$/.test(st || "") ? st : "club";
  }
  // ---- Mash-up: each Remix picks one DNA as the base (cast, setting, params) and blends in 1-2 more as flavor lines.
  var MASH_FLAVOR = {
    roomwalk: "slow sexy walk toward and away from a low handheld phone in a small warm-grey room, over-the-shoulder glance, twerk finale",
    sabaddie: "South African baddie high-heels walk, asses pointed at the camera, rear-view follow, women only",
    club: "candid iPhone club snapshot feel, slight motion blur",
    contest: "twerking-contest audition energy for the judges, head-shot then full body, home amateur quality",
    carib: "bent over a chair in a deep twerk, heavy ass bouncing to contest music, looking back",
    sync: "shaky-cam dance-studio twerk workout energy, mirror wall, sweat, oil and sand on skin",
    ny: "vulgar NY twerk style, ass to camera, loose not-in-sync moves, tongue out on the vulgar moves",
    duo: "cinematic noir shadows, strong motion blur on hips, hair and fabric, clothes falling off mid-twerk",
    rural: "neon orange grid room, Sony A7R V 85mm look, film grain, black masquerade mask",
    tryouts: "secret model tryouts walk, back and forth in slingshot swimsuits and heels"
  };
  function mashRoll() {
    S._mashPrimary = null; S._mashExtra = [];
    if (!S.mash) return;
    var ids = STYLES.map(function (c) { return c[0]; }).filter(function (k) { return k !== "none" && ((k !== "sabaddie" && k !== "roomwalk") || isAdult()); }), out = [];
    while (ids.length) out.push(ids.splice(Math.floor(rnd() * ids.length), 1)[0]);
    S._mashPrimary = out[0]; S._mashExtra = out.slice(1, 1 + (rnd() < 0.5 ? 1 : 2));
  }
  function mashLine(tab) {
    if (!S.mash || !S._mashExtra || !S._mashExtra.length) return "";
    var f = S._mashExtra.map(function (k) { return MASH_FLAVOR[k]; }).join("; ");
    return tab === "video" ? " Mash-up blend: " + f + "." : ", mash-up blend: " + f;
  }
  function mashLabel() { return S.mash && S._mashPrimary ? [S._mashPrimary].concat(S._mashExtra || []).map(function (k) { var c = STYLES.filter(function (x) { return x[0] === k; })[0]; return c ? c[1] : k; }).join(" + ") : ""; }
  var STYLE_NO = "text, watermark, logo, caption, UI, beauty filter, plastic skin, airbrush, identical faces, cloned women, CGI, 3D render, extra limbs, melted anatomy, studio softbox, glossy magazine retouch";
  var CONTEST = {
    regions: ["Yoruba Nigerian", "Igbo Nigerian", "Hausa Nigerian", "Edo Nigerian", "Efik Nigerian", "Ijaw Nigerian", "Urhobo Nigerian", "Tiv Nigerian"],
    tones: ["deep ebony", "dark brown", "warm mahogany", "rich copper", "cool umber", "golden brown", "dark chocolate", "warm espresso"],
    venues: ["small living room with a tiled floor and a couch pushed back", "apartment bedroom with the bed pushed to the wall", "narrow hallway of a family-free shared flat, phone propped on a chair", "compound courtyard at dusk, string lights", "plain bedroom wall with a standing fan"],
    body: "big tits, big ass, hourglass figure",
    heat: {
      tease: "wearing a skimpy professional twerking outfit, tiny crop top and booty shorts, dancing wild and confident",
      spicy: "wearing slutty voluptuous professional twerking-contest clothes, tiny crop top and thong shorts, then a nipple slip while dancing wild, spicy",
      xxx: "twerking-contest outfit pulled down mid-dance, topless nipple slip while dancing wild, explicit"
    },
    beats: ["simple head-shot to camera, then zoom out to full body", "turns and twerks for the judges", "wild spicy dance, looking back at the phone"],
    bank: { ar: "--ar 3:2", v: "--v 6.1", stylize: "--stylize 40", chaos: "--chaos 8", q: "--q 1", style: "--style raw" },
    no: STYLE_NO + ", split-screen labels, generic stock video"
  };
  // Caribbean contest: sibling of the Nigerian contest; one new Haitian, Jamaican or Dominican woman (21+), chair twerk.
  var CARIB = {
    regions: ["Haitian", "Jamaican", "Dominican"],
    tones: ["deep ebony", "dark brown", "warm mahogany", "rich copper", "caramel", "golden brown", "cool umber", "honey brown"],
    venues: CONTEST.venues,
    body: CONTEST.body,
    pose: "bent over in a deep twerk, hands on a chair, heavy ass bouncing, natural dance twerk movement to the contest music, best realistic twerk dancing",
    heat: {
      tease: "wearing a skimpy professional twerking outfit, tiny crop top and booty shorts, bent over in a deep twerk, hands on a chair, heavy ass bouncing, looking back at the camera",
      spicy: "wearing slutty voluptuous professional twerking-contest clothes, tiny crop top and thong shorts, bent over in a deep twerk, hands on a chair, heavy ass bouncing, then a nipple slip seen from the front as she looks back, dancing wild, spicy",
      xxx: "twerking-contest clothes pulled down, bent over in a deep twerk, hands on a chair, heavy ass bouncing, exposed breasts swinging with the natural dance movement, nipple slip seen from the front as she looks back, dancing wild"
    },
    beats: ["simple head-shot to camera, then zoom out to full body", "bends over the chair into a deep twerk for the judges", "looks back over her shoulder mid-bounce, contest music playing"],
    finish: "8k finish",
    bank: CONTEST.bank,
    no: CONTEST.no
  };
  var SYNC = {
    regions: ["Tamil", "Telugu", "Malayali", "Kannadiga", "Tuluva", "Konkani", "Hyderabadi", "Kodava"],
    tones: ["deep brown", "dark brown", "warm mahogany", "rich copper", "caramel", "golden brown", "cool umber", "honey", "warm bronze", "dusky brown"],
    heat: {
      tease: "matching tiny micro bikinis",
      spicy: "matching tiny micro bikinis, massive J-cup tits bouncing and straining the tops, hard puffy nipples through the fabric, dripping cameltoes",
      xxx: "matching tiny micro bikinis with the tops snapped off and hanging from their wrists, massive J-cup tits flopping and clapping, huge dark areolas, hard puffy nipples, dripping cameltoes, tongues out, eyes rolled back"
    },
    bank: { ar: "--ar 9:16", v: "--v 6.1", stylize: "--stylize 100" },
    no: STYLE_NO,
    who: "South Indian", group: "five completely different South Indian women, all adults 21+, synchronized twerk workout",
    groupVideo: "Five completely different South Indian women, all adults 21+, doing a synchronized twerk workout",
    action: "enormous jiggling asses clapping in sync to thumping twerk music", skin: "sweat, oil and sand on skin"
  };
  // NY twerk: five New York women, each in her own random NY twerk style, NOT in perfect sync; stylize 500.
  var NY = {
    regions: ["Bronx Puerto Rican", "Brooklyn Jamaican", "Harlem African American", "Queens Dominican", "Flatbush Haitian", "Bronx Trinidadian", "Queens Colombian", "Brooklyn Guyanese", "Harlem Senegalese", "Staten Island Italian-American", "Queens Filipino", "Bronx Mexican"],
    tones: ["deep ebony", "dark brown", "warm mahogany", "rich copper", "caramel", "golden brown", "olive", "tan", "light tan", "honey", "cool umber", "warm beige"],
    heat: {
      tease: "matching tiny micro bikinis",
      spicy: "matching tiny micro bikinis, massive J-cup tits bouncing and straining the tops, hard puffy nipples through the fabric, dripping cameltoes",
      xxx: "matching tiny micro bikinis with the tops snapped off and hanging on their wrists, massive J-cup tits flopping and clapping, huge dark areolas, hard puffy nipples, dripping cameltoes, tongues out on the vulgar moves"
    },
    bank: { ar: "--ar 9:16", v: "--v 6.1", stylize: "--stylize 500" },
    no: STYLE_NO,
    who: "New York", group: "five completely different New York women, all adults 21+, vulgar twerking dances, ass to camera, each in her own random NY twerk style, not in perfect sync",
    groupVideo: "Five completely different New York women, all adults 21+, doing vulgar twerking dances ass to camera, each in her own random NY twerk style, NOT in perfect sync",
    action: "enormous jiggling asses clapping, not in perfect sync, to thumping twerk music", skin: "sweat, oil and sand on glistening skin"
  };
  var GROUP_STYLES = { sync: SYNC, ny: NY };
  // Style #1 from Zig: South African Baddie Walk. 18+ mode only. Women only (no men), every woman 28 (adults 21+),
  // a staged, closed-off urban location with no bystanders. Kink props (nipple clamps, body chains) only at XXX.
  var SABADDIE = {
    regions: ["Johannesburg Zulu", "Durban Zulu", "Soweto Sotho", "Cape Town Xhosa", "Pretoria Tswana", "Eastern Cape Xhosa", "Limpopo Venda", "Polokwane Pedi", "Mpumalanga Swazi", "Cape Town Cape Malay", "Johannesburg Tsonga", "Durban Indian South African"],
    tones: ["deep ebony", "dark brown", "warm mahogany", "rich copper", "caramel", "golden brown", "warm chestnut", "cool umber", "honey", "light tan", "bronze", "espresso"],
    open: "photorealistic iPhone snapshot of {n} beautiful South African women, all adults aged 28, every one uniquely different in face, features, hair and build, voluptuous and thick but not fat, huge tits and big round asses, women only, no men",
    openVideo: "Photorealistic iPhone video of {n} beautiful South African women, all adults aged 28, every one uniquely different in face, features, hair and build; voluptuous and thick but not fat, huge tits and big round asses; women only, no men",
    face: "sharp cheekbones, intense gaze, stable facial structure, consistent expressive eyes with natural depth and catchlights",
    sets: ["upscale urban street closed off for the shoot, staged location, no bystanders", "empty upscale city plaza at golden hour, closed set, no bystanders",
      "urban pavilion walkway, staged location, nobody else around", "rooftop parking deck above the skyline, closed set, no bystanders", "empty luxury shopping arcade after hours, staged shoot"],
    walk: "90s baddie high-heels walk in a line, slutty butt-forward strut with the asses pointed at the camera, the camera follows behind the asses in a low rear view",
    heat: {
      tease: "tight black micro bikinis and high heels, confident baddie strut",
      spicy: "tight black micro bikinis and micro skirts, high heels, tits popping out and bouncing, jiggly tits, big ass cheeks clapping loud with every step",
      xxx: "tight black micro bikinis pulled aside, tits out and bouncing hard, fat ass cheeks spreading and clapping loud with every step, silver nipple clamps and decorative body chains"
    },
    real: "realistic anatomy with natural proportions, authentic female form, natural hands, flat toned stomachs with no bloating, detailed skin texture with visible pores and subtle imperfections",
    light: "cinematic lighting mixed with practical sources, psychological atmosphere, fashion-editorial yet raw authenticity",
    cam: "shot on {iphone} main camera, photorealistic iPhone snapshot, natural Apple color science, no editing",
    keys: {
      tease: ["high heels walk", "camera follows the ass", "rear view walk", "micro skirt", "90s baddie vibes", "raw iPhone cam", "just girls", "busty"],
      spicy: ["bouncing tits", "jiggly tits", "clapping cheeks", "loud cheeks", "tits popping out", "fat ass spread", "big tits", "rear view ass"],
      xxx: ["nipple clamps", "body chains", "ass clap loud", "tits out bouncing", "fat ass spread", "clapping cheeks"]
    },
    bank: { ar: "--ar 9:16", v: "--v 6.1", stylize: "--stylize 250", style: "--style raw" },
    no: STYLE_NO + ", men, male, bystanders, onlookers, crowd, bloated stomach, extra fingers, fused fingers, distorted hands",
    who: "South African"
  };
  function sabKeys(heat) {
    var K = SABADDIE.keys, pool = K.tease.concat(heat !== "tease" ? K.spicy : []).concat(heat === "xxx" ? K.xxx : []);
    var out = []; for (var i = 0; i < 3 && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }
  // Style #2 from Zig: Room Walk Loop. 18+ mode only. ONE brand-new original woman per prompt (aged 22-28, adults 21+),
  // heritage rolled across all major backgrounds with a matching natural skin tone; small empty warm-grey room.
  var ROOMWALK = {
    heritage: [["Albanian Gheg", ["porcelain", "fair olive", "light olive"]], ["South Sudanese-Ethiopian", ["espresso", "deep ebony", "dark brown"]], ["South Indian Tamil", ["deep warm brown", "rich brown"]],
      ["South Indian Malayali", ["warm brown", "deep warm brown"]], ["Korean", ["fair porcelain", "light warm beige"]], ["Japanese", ["fair", "light neutral beige"]], ["Northern Chinese", ["fair", "light warm ivory"]],
      ["Vietnamese", ["light golden", "warm tan"]], ["Filipina", ["warm golden tan", "honey"]], ["Mexican", ["warm caramel", "golden tan", "light olive"]], ["Colombian", ["golden tan", "caramel", "light olive"]],
      ["Dominican", ["caramel", "warm chestnut", "golden brown"]], ["Puerto Rican", ["light olive", "golden tan", "caramel"]], ["Brazilian", ["bronze", "golden tan", "warm caramel"]], ["Nigerian Yoruba", ["deep ebony", "dark brown"]],
      ["Ghanaian", ["dark brown", "rich mahogany"]], ["Kenyan", ["deep brown", "dark chocolate"]], ["Somali", ["warm brown", "rich bronze"]], ["Jamaican", ["dark brown", "warm mahogany", "caramel"]],
      ["African American", ["deep brown", "caramel", "warm mahogany"]], ["Lebanese", ["light olive", "warm beige"]], ["Persian", ["light olive", "warm ivory"]], ["Turkish", ["olive", "light olive"]],
      ["Moroccan", ["warm olive", "light caramel"]], ["Punjabi", ["warm wheatish", "light brown"]], ["Thai", ["warm golden", "light tan"]], ["Polynesian Samoan", ["warm bronze", "golden brown"]],
      ["Ukrainian", ["fair", "porcelain"]], ["Irish", ["pale freckled", "fair rosy"]], ["Italian Sicilian", ["olive", "sun-kissed olive"]], ["Greek", ["olive", "warm beige"]], ["Swedish", ["fair", "porcelain"]]],
    names: ["Lira", "Zuri", "Ananya", "Mei", "Valentina", "Amara", "Yuna", "Leila", "Ximena", "Nia", "Saanvi", "Hana", "Camila", "Adaeze", "Noor", "Ingrid", "Selin", "Kalani", "Thandi", "Isabela",
      "Rin", "Meera", "Aaliyah", "Daria", "Esme", "Ayana", "Priya", "Sofia", "Kemi", "Lucia", "Jia", "Nadia", "Tala", "Zara", "Imani", "Freya", "Ines", "Keiko", "Marisol", "Ebony"],
    build: ["voluptuous hourglass, heavy natural breasts, huge round ass, thick thighs, narrow waist", "pear-shaped and voluptuous, heavy natural breasts, huge round ass, thick thighs, snatched waist",
      "thick hourglass, full heavy natural breasts, wide hips, huge round ass, narrow waist", "curvy pear build, heavy natural breasts, very wide hips, huge round ass, thick thighs"],
    open: "ultra-realistic smartphone vertical video, 12-20 second seamless loop, subtle grain, candid unpolished feel, of one brand-new original woman, adult aged {age}",
    set: "small empty room, neutral warm-grey walls, light-wood floor, no background distractions",
    light: "slightly brighter soft lighting with a warm-natural balance, golden daylight through a sheer curtain mixing with a nearby lamp, skin glow enhanced without overexposure",
    noir: "high-fashion fetish noir strut, noir cinematic lighting with deep shadows and a single hard key",
    cam: "handheld {iphone} at a slightly low angle, full-body motion, natural phone color, no editing",
    loop: "a slow, powerful, controlled sexy walk toward the camera on a 6-7 ft path, hips rolling, heels keeping a steady rhythm; a brief pause facing camera with intense eye contact and a confident smirk; a smooth turn, then walking away with her ass twitching and rippling; repeat as a seamless loop. Finale: she stops facing away, glances over her shoulder, laughs and bursts into fun energetic twerking",
    heat: {
      tease: "stringy slingshot micro bikini and high heels",
      spicy: "stringy slingshot micro bikini that barely contains her, nipples slipping out with every step, the string vanishing between her cheeks, high heels",
      xxx: "slingshot top slipping off fully, topless in tiny bikini bottoms and stilettos, bare breasts swaying with every step, explicit detail"
    },
    tone: "minimal, elevated, intimate; strength, softness, rhythm and visual clarity; a real 2026 private vertical clip you'd save and rewatch",
    keys: ["slingshot bikini", "sexy walk toward and away", "ass twitch", "twerk finale", "low handheld angle", "warm lamp-daylight", "hip pops", "over-the-shoulder glance"],
    bank: { ar: "--ar 9:16", v: "--v 6.1", stylize: "--stylize 150", style: "--style raw" },
    no: STYLE_NO + ", men, male, second person, background people, clutter, furniture clutter, overexposed skin, extra fingers, fused fingers, distorted hands"
  };
  var ADULT_STYLES = { sabaddie: 1, roomwalk: 1 };
  function rwKeys() { var pool = ROOMWALK.keys.slice(), out = []; for (var i = 0; i < 3; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; }
  // Model tryouts: women only (no men), People 1-5, each a voluptuous hourglass adult model (21+); home amateur cameras.
  var TRYOUTS = {
    regions: null, tones: null,
    open: "2026 secret model tryouts, voluptuous hourglass adult models, all women 21+, no men allowed",
    heat: {
      tease: "walking back and forth toward and away from the camera in slingshot swimsuits and heels, posing at each end",
      spicy: "walking back and forth toward and away from the camera in slingshot swimsuits and heels, straps sliding, then stripping off at the end down to just heels, nipple slips",
      xxx: "walking back and forth toward and away from the camera in slingshot swimsuits and heels, then stripping fully nude at the end, only heels on"
    },
    camera: "best amateur home porn camera work, handheld iPhone plus a propped-up phone, ordinary home lighting, unretouched skin with pores, real body weight in motion, photoreal",
    set: ["living-room runway with the couch pushed back", "long apartment hallway used as a catwalk", "bedroom with a ring light and a phone on a tripod", "home studio corner with a plain backdrop"],
    bank: { ar: "--ar 2:3", v: "--v 6.1", stylize: "--stylize 40", chaos: "--chaos 8", q: "--q 1", style: "--style raw" },
    no: STYLE_NO + ", men, male, man"
  };
  // Rural ebony: one fixed character (consistency-locked), adult woman in her mid-40s; the camera / pose randomizes per Remix.
  var RURAL = {
    who: "voluptuous rural ebony American woman in her mid-40s, adult 21+",
    body: "monstrous 34KK natural heavy hanging breasts, soft thick body, wide hips, light-skinned ebony complexion, symmetrical anatomy",
    face: "round full face, long straight hair, seductive dark eyes, glossy red lips, black masquerade mask",
    heat: {
      tease: "black long-sleeve mock-neck top with gold sparkle threads, paper-thin over her gigantic 34KK breasts, cleavage bursting, extremely tight sheer g-string bikini underneath, low-rise black jeans",
      spicy: "extremely tight sheer g-string bikini under a black long-sleeve mock-neck top with gold sparkle threads, paper-thin over gigantic 34KK tits, hard nipples poking through, cleavage bursting, low-rise black jeans",
      xxx: "paper-thin black mock-neck top with gold sparkle threads pulled up over gigantic 34KK tits, breasts out, hard nipples, sheer g-string bikini, low-rise black jeans pushed down"
    },
    set: "neon orange grid room",
    shots: ["hands on hips pushing her breasts forward, eye-level medium shot", "twerking from behind, low-angle shot, looking back over her shoulder", "slingshot bikini reveal, three-quarter angle, jeans pushed low", "full-body in strappy heels, low-angle shot"],
    motion: "heavy weight, soft jiggle, skin folds, glossy sweat, pure amateur",
    camera: "shot on Sony A7R V, FE 85mm f/1.4 GM II, RAW, HDR, visible pores, peach fuzz, lens breathing, subsurface scattering, cinematic color, film grain, imperfect wrinkles, editorial 8K, unretouched",
    locks: "consistency locks: same anatomy, same face and same clothing in every shot; realism and lighting continuity locked",
    bank: { ar: "--ar 2:3", v: "--v 6.1", stylize: "--stylize 50", style: "--style raw" },
    no: STYLE_NO
  };
  // Noir duo: two curvy oiled Black women, cinematic, clothes falling off mid-twerk. Setting kept to a gritty minimalist studio
  // (no drug-den framing: consent and sobriety stay unambiguous). Adults 21+ only.
  var DUO = {
    regions: ["African American", "Nigerian", "Jamaican", "Ghanaian", "Haitian", "Senegalese", "Trinidadian", "Kenyan"],
    tones: ["deep ebony", "dark brown", "warm mahogany", "rich copper", "cool umber", "golden brown", "dark chocolate"],
    open: "photorealistic cinematic image of two curvy oiled Black women, both adults 21+, fast raunchy dancing and twerking",
    set: "gritty abandoned-house mood inside a minimalist hot studio, plain walls, dark floor",
    blur: "strong motion blur on hips, breasts, hair and fabric",
    left: { hair: "short black twisted braids", heat: {
      tease: "tight sheer black mini dress riding up mid-twerk, straps slipping",
      spicy: "sheer black mini dress, straps snapped and sliding off mid-twerk, breasts nearly out, ass shaking",
      xxx: "sheer black mini dress with straps snapped, sliding off mid-twerk down around her thighs and ankles, mostly nude, breasts out and bouncing, ass exposed and shaking" } },
    right: { hair: "high curly ponytail", heat: {
      tease: "tight white mini dress riding up, top slipping",
      spicy: "tight white mini dress falling off, top slipping, skirt dropping, nipple slip while bouncing",
      xxx: "tight white mini dress falling off, top slipping and skirt dropping, both breasts out and bouncing" } },
    tail: { tease: "clothes slipping while they dance and twerk hard", spicy: "clothes actively falling off while they dance and twerk hard, tongue out",
      xxx: "clothes actively falling off while they dance and twerk hard, high detail nude skin, curves and nipples, tongue out" },
    look: "dynamic motion, sharp focus on the falling fabric, cinematic dramatic lighting, deep noir shadows, high-energy, 8k",
    tags: ["#NoirNightVibes", "#FashionPsychodramaVibes", "#CinematicShadowMood", "#tongueout"],
    bank: { ar: "--ar 3:2", v: "--v 6.1", stylize: "--stylize 250", style: "--style raw" },
    no: "text, watermark, logo, caption, UI, beauty filter, plastic skin, airbrush, identical faces, cloned women, CGI, 3D render, extra limbs, melted anatomy"
  };
  // Style casts are voluptuous IG-type bodies: skip face picks that fight that (faces stay unique and unretouched).
  var STYLE_SOFT = { eyes: /heterochrom|small bright|laugh lines/i, brows: /unibrow|scar|uneven/i, nose: /hooked|crooked|flared/i, lips: /thin|uneven|downturned|gap|crooked/i,
    jawCheekbones: /double chin|hollow|low flat/i, faceShape: /asymmetric|pear-shaped/i, hairColor: /gray|grey|silver|salt|roots/i, hairStyle: /buzz/i, hairTexture: /wiry|gray|frizz/i };
  function stylePool(k) { var P = S.variety.pools, a = cleanPool(glamPool(P[k], k), k) || []; return STYLE_SOFT[k] ? a.filter(function (x) { return !STYLE_SOFT[k].test(x); }) : a; }
  // Every woman in a style cast gets her own features: no two share a face shape, eyes, nose, lips, jaw or hairstyle.
  function distinctCast(cast, keys) {
    var P = S.variety.pools;
    keys.forEach(function (k) {
      var used = {};
      cast.forEach(function (r) {
        if (used[r[k]] || (STYLE_SOFT[k] && STYLE_SOFT[k].test(r[k] || ""))) { var o = stylePool(k).filter(function (x) { return !used[x]; }); if (o.length) r[k] = pick(o); }
        used[r[k]] = 1;
      });
    });
  }
  function styleCast(look, cast) {
    var st = styleOf(look);
    if (st === "club") return cast;
    if (st === "tryouts") { cast.forEach(function (r) { r.man = false; r.dna = false; r.build = pick(["voluptuous hourglass", "busty hourglass with wide hips", "slim-thick hourglass", "curvy hourglass with a tiny waist"]); if (!MATURE_LOOKS[look.id]) r.ageBand = pick(["21-25", "26-32", "26-32", "33-40"]); });
      distinctCast(cast, ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "hairStyle", "hairColor", "hairTexture"]); return cast; }
    if (st === "roomwalk") {   // exactly one brand-new woman, 22-28
      var rw = cast[0], hp = pick(ROOMWALK.heritage); rw.man = false; rw.dna = false; rw.heritageRegion = hp[0]; rw.skinTone = pick(hp[1]);
      rw.ageBand = String(22 + Math.floor(rnd() * 7)); rw.rwName = pick(ROOMWALK.names); rw.build = pick(ROOMWALK.build);
      ["hairColor", "distinctiveFeature", "nails", "makeupLevel", "hairTexture"].forEach(function (k) { if (DNA.poolDrop[k] && DNA.poolDrop[k].test(rw[k] || "")) rw[k] = ""; });
      distinctCast([rw], ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "hairStyle", "hairColor", "hairTexture"]); return [rw];
    }
    if (st === "rural") { cast.forEach(function (r, i) { r.man = false; r.dna = false; r.skinTone = "light-skinned ebony"; r.heritageRegion = "rural American"; r.ageBand = i ? pick(["33-40", "41-50"]) : "41-50"; if (!i) r.hairStyle = "long straight hair"; });
      if (cast.length > 1) distinctCast(cast.slice(1), ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "hairStyle"]); return cast; }
    var C = GROUP_STYLES[st] || (st === "duo" ? DUO : st === "carib" ? CARIB : st === "sabaddie" ? SABADDIE : CONTEST), regions = C.regions.slice(), tones = C.tones.slice();
    cast.forEach(function (r) {
      r.man = false; r.dna = false;
      if (!regions.length) regions = C.regions.slice(); if (!tones.length) tones = C.tones.slice();
      r.heritageRegion = regions.splice(Math.floor(rnd() * regions.length), 1)[0];
      r.skinTone = tones.splice(Math.floor(rnd() * tones.length), 1)[0];
      if (!MATURE_LOOKS[look.id]) r.ageBand = pick(["21-25", "21-25", "26-32", "26-32", "33-40"]);   // all 21+
      ["hairColor", "distinctiveFeature", "nails", "makeupLevel", "hairTexture"].forEach(function (k) { if (DNA.poolDrop[k] && DNA.poolDrop[k].test(r[k] || "")) r[k] = ""; });
    });
    if (st === "sabaddie") cast.forEach(function (r) { r.ageBand = "28"; });
    if (st === "duo") cast.forEach(function (r, i) { if (i < 2) { r.hairStyle = i ? DUO.right.hair : DUO.left.hair; r.hairColor = i ? r.hairColor : "black"; r.hairTexture = i ? "curly" : ""; } });
    distinctCast(cast, st === "duo" ? ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones"] : ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "hairStyle", "hairColor", "hairTexture"]);
    return cast;
  }
  function faceShort(r) {
    return [r.skinTone + " " + r.heritageRegion + " unique face", r.faceShape, r.eyes, r.brows, r.nose, r.lips, r.jawCheekbones,
      (r.hairColor ? r.hairColor + " " : "") + (r.hairTexture ? r.hairTexture + " " : "") + "hair in " + r.hairStyle, r.micro || "", r.beauty || "", "adult woman aged " + r.ageBand].filter(Boolean).join(", ");
  }
  function duoFace(r) { return [r.skinTone + " " + r.heritageRegion + " unique face", r.faceShape, r.eyes, r.nose, r.lips, r.jawCheekbones, r.hairStyle, r.micro || "", "adult woman aged " + r.ageBand].filter(Boolean).join(", "); }
  function assembleStyle(look, idea, cast, heat, tab) {
    var st = styleOf(look), r = cast[0], out;
    if (st === "roomwalk") {
      var W = ROOMWALK, gW = ideaOutfit(idea), wearW = gW ? wardrobeFor(idea, heat, r).text : W.heat[heat], noirW = rnd() < 0.2;
      var camW = W.cam.replace("{iphone}", S.cam === "iphone" ? IPHONE_MODEL : "smartphone"), keysW = rwKeys();
      var sheW = (r.rwName || "she") + ", " + faceShort(r) + ", " + r.build;
      var openW = W.open.replace("{age}", r.ageBand);
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") + openW.charAt(0).toUpperCase() + openW.slice(1) + "; women only, no one else in frame. She: " + sheW + ". Wardrobe: " + wearW + ". Action loop: " + W.loop +
          ". Setting: " + W.set + ". Light: " + (noirW ? W.noir : W.light) + ". Camera: " + camW + ". Tone: " + W.tone + ". Keys: " + keysW.join("; ") + ". Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + [openW.replace("vertical video, 12-20 second seamless loop", "vertical still from a seamless loop"), sheW, wearW, W.loop.split(";")[0], W.set, noirW ? W.noir : W.light, camW, W.tone, keysW.join(", "), "adult woman 21+"].join(", ");
      }
      out = scrubProse(out);
      return /21\+/.test(out) ? out : out + ", adult 21+";
    }
    if (st === "sabaddie") {
      var B = SABADDIE, nB = cast.length, nW = nB > 1 ? NUMW[nB] : "one", gB = ideaOutfit(idea), wearB = gB ? wardrobeFor(idea, heat, r).text : B.heat[heat];
      var camB = B.cam.replace("{iphone}", S.cam === "iphone" ? IPHONE_MODEL : "iPhone 16 Pro Max"), setB = pick(B.sets), keysB = sabKeys(heat);
      var castB = cast.map(function (p, i) { return (nB > 1 ? castTag(i, nB, "women") : "she") + ": " + faceShort(p) + ", " + p.build; });
      var openB = (tab === "video" ? B.openVideo : B.open).replace("{n}", nW);
      if (nB === 1) openB = openB.replace("women, all adults aged 28, every one uniquely different in face, features, hair and build", "woman, adult aged 28, one-off face and build").replace("big round asses", "a big round ass");
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") + openB + ". Faces: " + B.face + ". Cast: " + castB.join(". ") + ". Wardrobe: " + wearB + ". Action: " + B.walk +
          ". Setting: " + setB + ". Keys: " + keysB.join("; ") + ". Body realism: " + B.real + ". Light: " + B.light + ". Camera: " + camB + ". Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + [openB, B.face].concat(castB).concat([wearB, B.walk, setB, keysB.join(", "), B.real, B.light, camB, nB > 1 ? "adult women 21+" : "adult woman 21+"]).join(", ");
      }
      out = scrubProse(out);
      return /21\+/.test(out) ? out : out + ", adult 21+";
    }
    var ideaW = ideaOutfit(idea) ? wardrobeFor(idea, heat, cast[0]).text : "";   // idea outfit wins for tryouts / rural / contest
    if (st === "tryouts") {
      var set = ideaSetOr(pick(TRYOUTS.set)); S._venueNow = set; var act = ideaW ? ideaW + ", walking back and forth, stripping off at the end in heels" : TRYOUTS.heat[heat];
      var models = cast.map(function (p, i) { return (cast.length > 1 ? castTag(i, cast.length, "models") + ": " : "model: ") + faceShort(p) + ", " + p.build; });
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") + "Video: " + TRYOUTS.open + ". " + (cast.length > 1 ? cast.length + " different women, each with a unique face. " : "") +
          "Cast: " + models.join(". ") + ". Action: " + act + ". Set: " + set + ". Camera: " + TRYOUTS.camera + ". Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + [TRYOUTS.open + ", video still", cast.length > 1 ? cast.length + " different women, each with a unique face" : ""].concat(models).concat([act, set, TRYOUTS.camera, "adult women 21+"]).filter(Boolean).join(", ");
      }
      out = scrubProse(out);
      return /21\+/.test(out) ? out : out + ", adult 21+";
    }
    if (st === "rural") {
      var shot = pick(RURAL.shots), wearR = ideaW || RURAL.heat[heat];
      if (cast.length > 1) {
        var nR = cast.length, rw = cast.map(function (p, i) { return castTag(i, nR, "women") + ": " + (i ? faceShort(p) + ", black masquerade mask" : ruralFace(p) + ", " + p.skinTone + " complexion, aged 41-50"); });
        var whoR = NUMW[nR] + " voluptuous rural American women in their 30s and 40s, every one a different face and skin tone, all adults 21+";
        var bodyR = "each with " + RURAL.body.replace(/, light-skinned ebony complexion/, "").replace(/\bher\b/g, "their");
        var locksR = RURAL.locks.replace("same face", "same faces");
        if (tab === "video") out = (idea ? "Main action (priority): " + idea + ". " : "") + "Ultra-realistic 4K amateur video of " + whoR + ". Body: " + bodyR + ". Cast: " + rw.join(". ") + ". Wardrobe: " + wearR + ". Set: " + ideaSetOr(RURAL.set) +
          ". Camera move: " + shot + ". Motion: " + RURAL.motion + ". Camera: " + RURAL.camera + ". " + locksR + ". Aspect 9:16, motion high. adult 21+.";
        else out = (idea ? idea + "::2 " : "") + ["ultra-realistic 4K amateur photo of " + whoR, bodyR].concat(rw).concat([wearR, ideaSetOr(RURAL.set), shot, RURAL.motion, RURAL.camera, locksR, "adult women 21+"]).join(", ");
        out = scrubProse(out);
        return /21\+/.test(out) ? out : out + ", adult 21+";
      }
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") + "Ultra-realistic 4K amateur video of a " + RURAL.who + ". Body: " + RURAL.body + ". Face: " + ruralFace(cast[0]) + ". Wardrobe: " + wearR + ". Set: " + ideaSetOr(RURAL.set) +
          ". Camera move: " + shot + ". Motion: " + RURAL.motion + ". Camera: " + RURAL.camera + ". " + RURAL.locks + ". Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + ["ultra-realistic 4K amateur photo of a " + RURAL.who, RURAL.body, ruralFace(cast[0]), wearR, ideaSetOr(RURAL.set), shot, RURAL.motion, RURAL.camera, RURAL.locks, "adult woman 21+"].join(", ");
      }
      out = scrubProse(out);
      return /21\+/.test(out) ? out : out + ", adult 21+";
    }
    if (st === "duo") {
      var nD = cast.length, side = ["on the left", "on the right", "in the center", "front left", "front right"];
      var D2 = cast.map(function (p, i) { var sd = i % 2 ? DUO.right : DUO.left; return (nD > 1 ? castTag(i, nD, "women") + " (" + side[i] + "): " : "") + duoFace(p) + ", " + sd.heat[heat]; });
      var openD0 = nD === 2 ? DUO.open : nD === 1 ? "photorealistic cinematic image of one curvy oiled Black woman, adult 21+, fast raunchy dancing and twerking" : DUO.open.replace("two curvy", NUMW[nD] + " curvy").replace("both adults", "all adults");
      var openD = multiOn() && nD > 1 ? openD0.replace("Black women", "mixed-heritage women, every skin tone different") : openD0;
      var tailD = nD === 1 ? DUO.tail[heat].replace(/they dance/g, "she dances") : DUO.tail[heat];
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") + openD.replace(/^photorealistic cinematic image/, "Photorealistic cinematic video") + ". Set: " + ideaSetOr(DUO.set) + ". " +
          D2.join(". ") + ". Action: " + tailD + "; " + DUO.blur + ". Look: " + DUO.look + ". Aspect 16:9, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + [openD, ideaSetOr(DUO.set), DUO.blur].concat(D2).concat([tailD, DUO.look, nD > 1 ? "adult women 21+" : "adult woman 21+"]).join(", ");
      }
      out = scrubProse(out);
      return /21\+/.test(out) ? out : out + ", adult 21+";
    }
    if (st === "contest" || st === "carib") {
      var K = st === "carib" ? CARIB : CONTEST, nat = st === "carib" ? r.heritageRegion : "Nigerian", fin = K.finish ? ", " + K.finish : "";
      var venue = ideaSetOr(pick(K.venues)); S._venueNow = venue; var act = ideaW ? ideaW + ", dancing wild" : K.heat[heat], nC = cast.length;
      if (nC > 1) {
        var natC = multiOn() ? "mixed-heritage" : st === "carib" ? "Caribbean" : "Nigerian";
        var whoC = cast.map(function (p, i) { return castTag(i, nC, "women") + ": " + faceShort(p); });
        var grpC = NUMW[nC] + " new " + natC + " women, every one a different face and skin tone, all adults 21+, auditioning together for a twerking contest";
        if (tab === "video") {
          out = (idea ? "Main action (priority): " + idea + ". " : "") +
            "Raw home iPhone video, adult amateur (21+ only), not a generic video: " + grpC + ". Opens on simple head-shots of each of them, then zooms out to their full bodies for the judges. No text on screen. " +
            "Cast: " + whoC.join(". ") + ". Bodies: all with " + K.body + ". Wardrobe and action: " + act + ". Setting: " + venue + ". " +
            "Beats: " + K.beats.join("; ") + ". Home amateur quality: handheld phone, ordinary indoor lighting, unretouched skin with pores, flyaway hairs, real body weight in motion" + fin + ". Aspect 9:16, motion high. adult 21+.";
        } else {
          out = (idea ? idea + "::2 " : "") + ["adult amateur iPhone photo (21+ only)",
            "side-by-side split image: head-shots on the left and a zoomed-out full-body group shot on the right, of " + grpC,
            "no text on screen"].concat(whoC).concat(["all with " + K.body, act, venue, st === "carib" ? "contest music" : "",
            "home amateur quality, ordinary indoor lighting, unretouched skin with pores, flyaway hairs, real body weight in motion, photoreal" + fin, "adult women 21+"]).filter(Boolean).join(", ");
        }
      } else if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") +
          "Raw home iPhone video, adult amateur (21+ only), not a generic video: one new " + nat + " woman auditioning for a twerking contest. Opens on a simple head-shot, then zooms out to her full body for the judges. No text on screen. " +
          "She: " + faceShort(r) + ". Body: " + K.body + ". Wardrobe and action: " + act + ". Setting: " + venue + ". " +
          "Beats: " + K.beats.join("; ") + ". Home amateur quality: handheld phone, ordinary indoor lighting, unretouched skin with pores, flyaway hairs, real body weight in motion" + fin + ". Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + ["adult amateur iPhone photo (21+ only)",
          "side-by-side split image: a simple head-shot on the left and a zoomed-out full-body shot on the right, of one new " + nat + " woman entering a twerking contest for the judges",
          "no text on screen", faceShort(r), K.body, act, venue, st === "carib" ? "contest music" : "",
          "home amateur quality, ordinary indoor lighting, unretouched skin with pores, flyaway hairs, real body weight in motion, photoreal" + fin, "adult woman 21+"].filter(Boolean).join(", ");
      }
    } else {
      var nG = cast.length, who = cast.map(function (p, i) { return (nG > 1 ? castTag(i, nG, "women") : "the woman") + ": " + faceShort(p); });
      var G = GROUP_STYLES[st] || SYNC, wear = ideaW ? ideaW : G.heat[heat], numG = function (t) { return nG === 1 ? t.replace(/^(F|f)ive completely different ([\w ]+?) women, all adults 21\+/, function (m, f, w) { return (f === "F" ? "One " : "one ") + w + " woman, adult 21+"; }).replace(/,? ?not in perfect sync|, NOT in perfect sync/g, "").replace(/each in her own/g, "in her own").replace(/\ball five\b/, "a").replace(/\bunique faces and bodies\b/, "unique face and body") : t.replace(/\bFive\b/, NUMW[nG].replace(/^./, function (c) { return c.toUpperCase(); })).replace(/\bfive\b/g, NUMW[nG]); };
      if (multiOn() && nG > 1) { var nat0 = G.who; numG = (function (f) { return function (t) { return f(t).split(nat0 + " women").join("mixed-heritage women"); }; })(numG); }
      if (tab === "video") {
        out = (idea ? "Main action (priority): " + idea + ". " : "") +
          "Raw iPhone video, shaky cam, dance studio with a mirror wall. " + numG(G.groupVideo) + "; " + numG("all five") + " brand-new unique faces and bodies every time (different facial features, eye shapes, noses, lips, cheekbones, jawlines, hair). " +
          "Cast: " + who.join(". ").replace(/^./, function (c) { return c.toUpperCase(); }) + ". All voluptuous and thick, tiny waists. Wardrobe: " + wear + ". " +
          "Action: " + G.action + "; " + G.skin + "; ultra-realistic bounce, extreme jiggle physics. Audio: thumping twerk music. Aspect 9:16, motion high. adult 21+.";
      } else {
        out = (idea ? idea + "::2 " : "") + ["raw iPhone video still, shaky cam, dance studio with a mirror wall",
          numG(G.group),
          numG("all five") + " brand-new unique faces and bodies, different facial features, eye shapes, noses, lips, cheekbones, jawlines and hair"]
          .concat(who).concat(["all voluptuous and thick, tiny waists", wear, G.action,
          G.skin, "ultra-realistic bounce, extreme jiggle physics", "adult women 21+"]).join(", ");
      }
      if (nG === 1) out = out.replace(/\ba brand-new unique faces and bodies\b/, "a brand-new unique face and body").replace(/\b[Aa]ll voluptuous and thick, tiny waists\b/, "voluptuous and thick, tiny waist").replace(/adult women 21\+/g, "adult woman 21+");
    }
    out = scrubProse(out);
    if (!/21\+/.test(out)) out += ", adult 21+";
    return out;
  }
  function styleBank(look, seed, tab) {
    var st = styleOf(look); if (st === "club") return null;
    var C = GROUP_STYLES[st] || (st === "sabaddie" ? SABADDIE : st === "roomwalk" ? ROOMWALK : st === "duo" ? DUO : st === "rural" ? RURAL : st === "carib" ? CARIB : st === "tryouts" ? TRYOUTS : CONTEST), b = C.bank;
    var ar = ((st === "contest" || st === "carib" || st === "rural" || st === "tryouts" || st === "sabaddie" || st === "roomwalk") && tab === "video") ? "--ar 9:16" : (st === "duo" && tab === "video") ? "--ar 16:9" : b.ar;
    var no = "--no " + C.no + (cleanOn() ? ", " + CLEAN_SKIN_NO : "");
    return { ar: ar, v: b.v, stylize: b.stylize, chaos: b.chaos || "", weird: "", q: b.q || "", style: b.style || "", seed: "--seed " + seed, no: no, repeat: "", tile: false, realism: false };
  }

  // ---- Twerk show (one tap): forces twerk-show DNA on every look and style. Adults 21+ only. ---------------
  var TWERK = {
    mj: "twerk show, candid amateur energy, fast hip and glute motion, ass to camera, extreme jiggle physics, real body weight bouncing, {crowd}, punchy contrast, vivid saturated colors",
    video: "Twerk show: candid amateur energy, fast hip and glute motion, ass to camera, extreme jiggle physics, real body weight bouncing, {crowd}, punchy contrast, vivid saturated colors.",
    no: "low contrast, washed out colors, boring palette"
  };
  function twerkOn() { return S.twerk === true; }
  function twerkIdea(idea) { idea = String(idea || ""); return /\btwerk/i.test(idea) ? idea : (idea ? idea + ", twerk show" : "twerk show"); }

  // ---- Fresh faces (default OFF): a brand-new face every Remix + real skin, never plastic. Adults 21+ only. -------------
  // Each face gets a signature (face shape, eyes, brows, nose, lips, jaw, hair, skin tone, heritage). Signatures are kept in
  // localStorage (last 400); a new face must differ from every stored one in at least FRESH_MIN features, and from the rest of the cast.
  var FRESH_KEY = "pm.faces.v1", FRESH_MAX = 400, FRESH_MIN = 5;
  var FRESH_SIG = ["faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "hairStyle", "hairColor", "skinTone", "heritageRegion"];
  // Small structural traits (no skin marks) that make each face one-off; 2 per face.
  var FRESH_MICRO = ["slightly asymmetric smile", "wide-set eyes", "close-set eyes", "low nose bridge", "high nose bridge", "faint chin cleft", "single dimple on the left cheek",
    "pronounced philtrum", "upturned outer eye corners", "downturned outer eye corners", "heavier upper eyelids", "slight overbite", "small gap between front teeth", "strong brow ridge",
    "soft rounded chin", "pointed chin", "broad forehead", "short forehead", "slightly uneven eyebrows", "one eyebrow a little higher", "full cheeks", "sharp cupid's bow",
    "wide nostrils", "narrow nostrils", "long philtrum", "short upper lip", "fuller upper lip", "prominent cheekbones on one side", "small ears close to the head", "visible smile lines",
    "deep-set eyes", "slightly crooked smile", "rounded nose tip", "subtle bump on the nose bridge", "square jaw corners", "soft jaw corners", "long neck", "wide mouth"];
  var FRESH_SKIN = "real human skin: visible pores, peach fuzz, uneven tone, natural sweat sheen, fine texture and tiny natural imperfections, never plastic, never waxy, never airbrushed, no beauty filter";
  var FRESH_FACE = "a brand-new one-off face never seen before, not a stock model face, not a generic AI face";
  var FRESH_NO = "plastic skin, waxy skin, airbrushed skin, beauty filter, porcelain doll skin, smooth CGI skin, overly retouched skin, generic model face, same face, doll face";
  function freshOn() { return S.fresh === true; }
  function freshStore() { try { return JSON.parse(localStorage.getItem(FRESH_KEY) || "[]"); } catch (e) { return []; } }
  function freshSave(a) { try { localStorage.setItem(FRESH_KEY, JSON.stringify(a.slice(-FRESH_MAX))); } catch (e) {} }
  function sigOf(r) { return FRESH_SIG.map(function (k) { return String(r[k] || ""); }); }
  // too close = fewer than FRESH_MIN of the 10 features differ, OR 4+ of the 6 core face features (shape, eyes, brows, nose, lips, jaw) match
  function sigSame(a, b, n) { var same = 0; for (var i = 0; i < n; i++) if (a[i] && a[i] === b[i]) same++; return same; }
  function sigClose(a, b) { return a.length - sigSame(a, b, a.length) < FRESH_MIN || sigSame(a, b, 6) >= 4; }
  function sigScore(sg, list) { var worst = 0; list.forEach(function (o) { worst = Math.max(worst, sigSame(sg, o, 6) * 2 + sigSame(sg, o, sg.length)); }); return worst; }
  function freshCast(look, cast) {
    if (!freshOn()) return cast;
    var P = S.variety.pools, seen = freshStore(), mine = [], st = styleOf(look);
    var fixed = { skinTone: st !== "club", heritageRegion: st !== "club", hairStyle: st === "duo" || st === "rural", hairColor: st === "duo" };   // style-owned fields stay
    cast.forEach(function (r) {
      if (st !== "rural") {
        var keys = FRESH_SIG.filter(function (k) { return !fixed[k] && P[k]; }), all = seen.concat(mine), best = null, bestScore = 1e9;
        for (var t = 0; t < 120; t++) {
          var sg = sigOf(r), clash = all.some(function (o) { return sigClose(sg, o); });
          if (!clash) { best = null; break; }
          var sc = sigScore(sg, all); if (sc < bestScore) { bestScore = sc; best = {}; FRESH_SIG.forEach(function (k) { best[k] = r[k]; }); }
          // re-roll the core face features first, then a random extra (clean-skin + glam/style filters still apply)
          var core = keys.filter(function (k) { return FRESH_SIG.indexOf(k) < 6; }).sort(function () { return rnd() - 0.5; }).slice(0, 3);
          core.concat(keys.slice().sort(function () { return rnd() - 0.5; }).slice(0, 1)).forEach(function (k) {
            var pool = cleanPool(glamPool(P[k], k), k) || []; if (STYLE_SOFT[k] && st !== "club") pool = pool.filter(function (x) { return !STYLE_SOFT[k].test(x); });
            if (pool.length) r[k] = pick(pool);
          });
        }
        if (best && all.some(function (o) { return sigClose(sigOf(r), o); }) && sigScore(sigOf(r), all) > bestScore) Object.keys(best).forEach(function (k) { r[k] = best[k]; });
      }
      var m = FRESH_MICRO.slice(), a = m.splice(Math.floor(rnd() * m.length), 1)[0], b = m.splice(Math.floor(rnd() * m.length), 1)[0];
      r.micro = a + ", " + b;
      r.distinctiveFeature = [r.distinctiveFeature, r.micro].filter(Boolean).join(", ");
      mine.push(sigOf(r));
    });
    freshSave(seen.concat(mine));
    return cast;
  }

  // ---- Heat levels (18+ mode only; default Tease) -------------------------------------------
  var HEATS = ["tease", "spicy", "xxx"];
  var HEAT_LABEL = { tease: "Tease", spicy: "Spicy", xxx: "XXX" };
  var HEAT = {
    tease: { lead: "flirty teasing pose, suggestive, playful come-hither look, sexy", video: "Flirty and suggestive: teasing moves, playful come-hither looks." },
    spicy: { lead: "provocative seductive posing, arched back, sultry bold gaze, revealing, lots of bare skin, sheer fabric, sexy and daring", video: "Spicy and provocative: seductive posing, arched back, sultry gaze, revealing outfit, lots of bare skin." },
    xxx: { lead: "explicit adult erotica, topless, bare breasts, explicit adult posing, sensual, erotic, uncensored", video: "Explicit adult: topless or nude, explicit adult posing, sensual and erotic, uncensored." }
  };
  // Phrase pools so back-to-back rolls don't read the same (one is picked per Remix; HEAT[h].lead/video stay as the first entry).
  var HEAT_LEADS = {
    tease: [HEAT.tease.lead, "playful flirty energy, teasing smile, suggestive pose, sexy confidence", "coy and flirtatious, lip bite, playful glance over the shoulder, sexy"],
    spicy: [HEAT.spicy.lead, "sultry and daring, provocative posing, bold eye contact, arched back, revealing outfit, glistening bare skin",
      "steamy and provocative, smoldering gaze, curves on display, barely-there outfit, sexy and bold",
      "confident seductive energy, body-hugging revealing styling, teasing over-the-shoulder look, lots of bare skin"],
    xxx: [HEAT.xxx.lead, "explicit adult erotica, fully nude, sensual explicit posing, erotic, uncensored", "explicit adult nude glamour, topless, erotic explicit posing, uninhibited, uncensored"]
  };
  var HEAT_VIDEO = {
    tease: [HEAT.tease.video, "Flirty and playful: teasing glances, slow confident moves, suggestive energy."],
    spicy: [HEAT.spicy.video, "Steamy and provocative: slow body rolls, smoldering looks to camera, revealing outfit, glistening skin.",
      "Bold and seductive: arched-back poses, confident teasing moves, barely-there outfit, sultry eye contact."],
    xxx: [HEAT.xxx.video, "Explicit adult: fully nude, explicit sensual posing, erotic and uninhibited, uncensored."]
  };
  // Spicy hashtags (adults 21+ only; never youth / family / non-consent words: tagsFor() filters every tag through BLOCK_RE + FRAMING_RE).
  var SPICY_TAGS = ["#spicy", "#spicycontent", "#sultry", "#seductive", "#sexy", "#thirsttrap", "#baddie", "#21plus", "#adultsonly", "#nsfw",
    "#hotgirlsummer", "#curves", "#provocative", "#nsfwcreator", "#nsfwart", "#adultcontent", "#18plus", "#exclusivecontent", "#linkinbio"];
  var WARDROBE_TAGS = [[/bikini|swimsuit/i, ["#bikini", "#bikinimodel"]], [/lingerie|lace|bralette|thong|g-string/i, ["#lingerie", "#lingeriemodel"]],
    [/sheer|mesh|see-through|fishnet/i, ["#sheer", "#fishnet"]], [/wet/i, ["#wetlook"]], [/leather/i, ["#leather"]], [/heels/i, ["#heels"]], [/nude|topless/i, ["#artnude"]]];
  // Idea context: matching beats, motion and tags, so the prompt and tags follow what Zig typed (e.g. "twerking").
  var IDEA_CTX = [
    { re: /\b(walk\w*|strut\w*|back ?stage|runway)\b/i, motion: "high",
      beats: ["walking away toward backstage, seen from behind, looking back over her shoulder, huge ass jiggling with each step", "mid-stride from behind, thong cutting in, phones raised in the crowd", "vulgar confident strut through the packed room"],
      tags: { safe: ["#backstage", "#walk", "#strut"], spicy: ["#thick", "#curvy", "#thicc"] } },
    { re: /\b(jiggl\w*|booty\b|ass\b|bbw|thicc|thick)\b/i, motion: "high",
      beats: ["huge ass jiggling and bouncing mid-step", "low-angle from behind, bubble butt bouncing", "thick thighs and hips shaking to the beat"],
      tags: { safe: ["#thick", "#curvy", "#bbw"], spicy: ["#thicc", "#bootybash", "#phat"] } },
    { re: /\b(twerk\w*|booty[\s-]?shak\w*|bounc\w*|clap\w* (?:it|cheeks))\b/i, motion: "high",
      beats: ["full-body low-angle twerk from behind, looking back over the shoulder", "rhythmic hip and glute motion on the beat", "slow-motion detail of the bounce", "hands on knees, back arched, confident glance to camera"],
      tags: { safe: ["#twerk", "#twerking", "#twerkvideo", "#dance", "#dancevideo"], spicy: ["#twerkqueen", "#bootyshake", "#thick", "#curvy"] } },
    { re: /\b(danc\w*|grind\w*|whin(?:e|ing)|dancehall|pole\w*|body ?roll\w*)\b/i, motion: "high",
      beats: ["full-body dance in a locked-off wide", "slow body roll toward camera", "spin and hair flip caught mid-motion", "close medium on the hips moving to the beat"],
      tags: { safe: ["#dance", "#dancer", "#dancevideo", "#choreography"], spicy: ["#sexydance", "#dancehall", "#poledance"] } },
    { re: /\b(pool\w*|beach|ocean|bikini|swim\w*|yacht)\b/i, motion: "low",
      beats: ["wet skin glistening by the water", "sun-kissed full-body pose at the pool edge", "slow walk out of the water toward camera"],
      tags: { safe: ["#poolside", "#beachvibes", "#summervibes"], spicy: ["#bikini", "#bikinimodel", "#wetlook"] } },
    { re: /\b(shower\w*|bath\w*|tub|steam\w*)\b/i, motion: "low",
      beats: ["water running over skin, steam in the air", "silhouette through a fogged glass door", "slicked-back wet hair, droplets on the shoulders"],
      tags: { safe: ["#steam", "#selfcare"], spicy: ["#wetlook", "#showertime"] } },
    { re: /\b(gym|workout|yoga|stretch\w*|fitness|squat\w*|pilates)\b/i, motion: "low",
      beats: ["deep squat in fitted activewear", "low-angle stretch on the mat", "sweat sheen after the set, mirror wall behind"],
      tags: { safe: ["#fitness", "#gymlife", "#workout", "#yoga"], spicy: ["#fitnessmodel", "#leggings", "#gymbody"] } },
    { re: /\b(bed|bedroom|sheets|pillow\w*)\b/i, motion: "low",
      beats: ["tangled in white sheets, window light", "lying across the bed, looking up at camera", "kneeling on the bed, soft backlight"],
      tags: { safe: ["#bedroomvibes"], spicy: ["#bedroomeyes", "#lingerie"] } },
    { re: /\b(mirror|selfie\w*)\b/i, motion: "low",
      beats: ["mirror selfie, phone in hand", "over-the-shoulder mirror pose"], tags: { safe: ["#mirrorselfie", "#selfie"], spicy: ["#thirsttrap"] } },
    { re: /\b(club\w*|party|vip|bottle[\s-]?service|night ?out|strip ?club)\b/i, motion: "high",
      beats: ["neon VIP booth with bottle-service sparklers", "dancing on the club floor under strobes", "leaning on the bar, colored light on skin"],
      tags: { safe: ["#nightlife", "#clubvibes", "#vip"], spicy: ["#baddie", "#clubnight"] } },
    { re: /\b(car|cars|lambo\w*|ferrari|porsche|bentley|hood|backseat)\b/i, motion: "low",
      beats: ["leaning on the hood of a luxury car", "backseat pose under passing city lights", "door open, one heel on the curb"],
      tags: { safe: ["#carlifestyle", "#luxurycar"], spicy: ["#carmodel"] } },
    { re: /\b(oil\w*|massage\w*)\b/i, motion: "low",
      beats: ["oiled skin under a warm key light", "massage table, slow hands, glistening shoulders"], tags: { safe: ["#massage"], spicy: ["#oiledup", "#glistening"] } },
    { re: /\b(kiss\w*|couple|making out|embrac\w*|cuddl\w*)\b/i, motion: "low",
      beats: ["close embrace, foreheads touching", "slow kiss in profile, rim light"], tags: { safe: ["#couplegoals", "#love"], spicy: ["#passion", "#makingout"] } }
  ];
  function ideaCtx(idea) { return IDEA_CTX.filter(function (c) { return c.re.test(String(idea || "")); }); }
  // Generic "start of a scene" beats (setup / dialogue / intros). Dropped whenever an idea is typed so the idea leads.
  var SETUP_RE = /\b(comedic|setup|set-up|dialogue|intro\w*|chaptered|transition|button ending|reaction shot|banter|arrival|interview|small talk|chat\w*|plot|story|knock\w*|delivery|ending|outro|end)\b/i;
  // Second+ person when the cast is "Woman + man".
  var MALE = {
    hair: ["close-cropped fade", "short twists", "clean-shaven head", "short waves", "shoulder-length locs", "buzz cut", "short curly top"],
    face: ["neatly trimmed beard", "full beard", "light stubble", "clean-shaven", "groomed goatee"],
    build: ["athletic build", "tall muscular build", "lean defined build", "broad-shouldered build"],
    wardrobe: { tease: ["fitted black tee and tailored trousers", "open-collar white shirt", "black tailored suit, no tie"],
      spicy: ["shirtless in low-slung jeans", "open shirt, bare chest", "shirtless in tailored trousers"], xxx: ["shirtless", "nude"] }
  };
  var ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

  var SPICY_WARDROBE = ["micro bikini", "string bikini", "sheer mesh bodysuit", "lace thong and cropped tank", "see-through lace lingerie set", "wet white tank top and thong", "cheeky micro shorts and bralette", "fishnet bodystocking", "sheer robe over a G-string", "strappy cut-out swimsuit"];
  var XXX_WARDROBE = ["fully nude", "topless, nude except heels", "topless, only a G-string", "nude except thigh-high stockings", "topless in only a thong", "fully nude with body chain", "topless, sheer open robe"];
  var HEAT_TAGS = { tease: ["#18plus", "#adultsonly", "#spicy"], xxx: ["#nsfw", "#xxx", "#explicit", "#uncensored", "#18plus", "#adultsonly", "#adultcontent"] };
  function heatFor(look) {
    // Safeguards: heat only in 18+ mode and on adult looks; style-only looks cap at Spicy.
    if (!look || !look.adult || !isAdult()) return "tease";
    var h = HEATS.indexOf(S.heat) >= 0 ? S.heat : "tease";
    if (look.craftOnly && h === "xxx") h = "spicy";
    return h;
  }
  // Generic craft tags that say nothing about the shot; dropped so tags follow the look + idea instead.
  var GENERIC_TAG_RE = /^#(filmmaking|cinematography|lightingsetup|colorgrade|behindthescenes|moodboard|setdesign|multicam|comedysketch|shortfilm|streaming|modern|studio|4k|bigbudget|studioquality|pornstar|hdporn)$/i;
  function wordTags(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(function (w) { return w.length > 3 && !/^(with|from|into|that|this|over|very|some|like|just|make|made|doing|look|looks)$/.test(w); });
  }
  function tagsFor(look, heat, idea, roll, people) {
    var ht = look.hashtags || {}, adult = isAdult() && look.adult;
    var lookSafe = (ht.safe || []).filter(function (t) { return !GENERIC_TAG_RE.test(t); });
    var lookNsfw = (ht.nsfw || []).filter(function (t) { return !GENERIC_TAG_RE.test(t); });
    if (twerkOn()) idea = twerkIdea(idea);
    var ctx = ideaCtx(idea), ideaT = [], spicyT = [];
    ctx.forEach(function (c) { ideaT = ideaT.concat(c.tags.safe || []); spicyT = spicyT.concat(c.tags.spicy || []); });
    if (styleOf(look) === "duo") ideaT = DUO.tags.concat(ideaT);
    // the idea itself as one or two natural tags (e.g. "slow twerk" -> #slowtwerk, #twerk)
    var iw = wordTags(idea).slice(0, 3);
    if (iw.length) { if (iw.length > 1 && iw.join("").length <= 22) ideaT.unshift("#" + iw.slice(0, 2).join("")); iw.forEach(function (w) { ideaT.push("#" + w); }); }
    // the look's own style words (e.g. "high-contrast luxury fashion-cover editorial" -> #editorial, #luxury ...)
    var styleT = String(look.styleName || "").toLowerCase().split(/\s+/).map(function (w) { return w.replace(/[^a-z0-9]/g, ""); })
      .filter(function (w) { return w.length > 3 && w.length <= 20 && !/^(scripted|studio|scene|style|look|shot|still|frame|original|platform)$/.test(w); }).slice(-3).map(function (w) { return "#" + w; });
    var moodT = (look.mood || []).slice(0, 2).map(function (m) { return "#" + String(m).toLowerCase().replace(/[^a-z0-9]/g, ""); });
    var wardT = [], w = roll ? wardrobeFor(idea, heat, roll).text : String(idea || "");
    if (adult && heat !== "tease") WARDROBE_TAGS.forEach(function (x) { if (x[0].test(w) && !(x[1][0] === "#artnude" && heat !== "xxx")) wardT = wardT.concat(x[1]); });
    var castT = people > 2 ? ["#squad"] : people === 2 ? ["#duo"] : [];
    var ex = examplesFor(look, idea), exT = [];
    ex.forEach(function (e) { exT = exT.concat(e.tags || []); });
    var out;
    if (!adult) out = exT.concat(ideaT, styleT, lookSafe, moodT, castT);
    else if (heat === "tease") out = exT.concat(ideaT, styleT, lookSafe.slice(0, 5), moodT, castT, HEAT_TAGS.tease);
    else if (heat === "spicy") out = exT.concat(ideaT, spicyT, SPICY_TAGS.slice(0, 10), wardT, styleT, lookNsfw, castT, SPICY_TAGS.slice(10), lookSafe.slice(0, 3));
    else out = exT.concat(ideaT, spicyT, wardT, lookNsfw, HEAT_TAGS.xxx, SPICY_TAGS.slice(0, 8), styleT, castT);
    var seen = {}, cap = !adult || heat === "tease" ? 18 : 32;
    return out.filter(function (t) {
      t = String(t || ""); var k = t.toLowerCase();
      if (!/^#[a-z0-9_]{2,40}$/i.test(t) || seen[k] || hasBlocked(t) || hasBlocked(t.replace(/^#/, "").replace(/([a-z])(?=teen|step|kid|minor|school)/gi, "$1 ")) || FRAMING_RE.test(t.replace(/^#/, ""))) return false;
      if (/teen|step(?:sis|bro|mom|dad|son|daughter|family)|schoolgirl|underage|minor|kid|young|petite18|barely|loli/i.test(t)) return false;
      seen[k] = 1; return true;
    }).slice(0, cap);
  }

  // ---- Style examples (Zig's liked prompts) -------------------------------------------------
  // Edit ./assets/data/style-examples.json (no code change). Matching entries add one phrase to the prompt and their tags first.
  function examplesFor(look, idea) {
    var list = (S.examples && S.examples.examples) || [];
    return list.filter(function (e) {
      if (!e) return false;
      if (e.look && e.look !== "*" && e.look !== look.id) return false;
      if (e.group && e.group !== look.group) return false;
      if (e.idea && String(idea || "").toLowerCase().indexOf(String(e.idea).toLowerCase()) < 0) return false;
      return true;
    });
  }
  function examplePhrase(look, idea) {
    var ph = [];
    examplesFor(look, idea).forEach(function (e) { ph = ph.concat(e.phrases || []); });
    ph = ph.filter(function (x) { return x && !hasBlocked(x) && !FRAMING_RE.test(x); });
    return ph.length ? pick(ph) : "";
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
  var S = { looks: null, variety: null, loading: null, el: null, api: null, q: "", group: "All", sel: null, idea: "", groupScene: false, people: 1, castMix: "women", tab: "mj", heat: "tease", cam: "platform", cleanSkin: true, beauty: false, style: "none", twerk: false, mash: false, fresh: false, crowd: false, multitone: false, eye: "regular", result: null, last: {}, notice: "", _forceAdult: null, examples: null };
  function load() {
    try { var j = JSON.parse(localStorage.getItem(STORE) || "{}"); ["group", "sel", "idea", "groupScene", "people", "castMix", "tab", "heat", "cam", "cleanSkin", "beauty", "style", "twerk", "mash", "fresh", "crowd", "multitone", "eye", "noir", "psych", "anatomy", "noAi", "realPorn", "neon", "neonPick", "room", "antiGeneric", "uniqueFaces", "eyeSet", "dnaW", "artOn", "artCat", "artLast", "result"].forEach(function (k) { if (j[k] !== undefined) S[k] = j[k]; });
      if (j.people === undefined && j.groupScene) S.people = 2;
      S.people = Math.max(1, Math.min(PEOPLE_MAX, parseInt(S.people, 10) || 1)); S.groupScene = S.people > 1; } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ anatomy: anatomyOn(), noAi: noAiOn(), realPorn: realPornOn(), neon: neonMode(), neonPick: neonPick(), room: roomMode(), antiGeneric: agOn(), uniqueFaces: uniqueOn(), eyeSet: eyeExplicit(), dnaW: dnaW(), artOn: S.artOn === true, artCat: artCat(), artLast: S.artLast || "", psych: psychMood(), noir: false, group: S.group, sel: S.sel, idea: S.idea, groupScene: S.groupScene, people: S.people, castMix: S.castMix, tab: S.tab, heat: S.heat, cam: S.cam, cleanSkin: S.cleanSkin !== false, beauty: S.beauty === true, style: S.style, twerk: S.twerk === true, mash: S.mash === true, fresh: S.fresh === true, crowd: S.crowd === true, multitone: S.multitone === true, eye: eyeMode(), result: S.result })); } catch (e) {}
  }
  function isAdult() { if (S._forceAdult != null) return !!S._forceAdult; try { return !!(S.api && S.api.current && S.api.current.isAdult); } catch (e) { return false; } }
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
      , fetch("./assets/data/faces.json?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (a) { S.looks = a[0]; S.variety = a[1]; FACES = a[2]; });
    // Focus DNA per platform (optional file; looks still work without it).
    S.loadingArt = fetch("./assets/data/art-by.json?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { ART = j; }).catch(function () { ART = null; });
    S.loadingDNA = fetch("./assets/data/focus-dna.json?v=" + V).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { FOCUS_DNA = j || {}; }).catch(function () { FOCUS_DNA = {}; });
    var auraP = fetch("./assets/data/psych-aura-tags.json?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var c = (j && j.colors) || {}; AURA_KEYS.forEach(function (k) { if (c[k]) PSYCH["aura-" + k].bank = c[k]; });
    }).catch(function () {});
    var colP = fetch("./assets/data/psych-colors-tags.json?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var c = (j && j.colors) || {}; COLOR_KEYS.forEach(function (k) { if (c[k]) PSYCH[k].bank = c[k]; });
    }).catch(function () {});
    S.loadingNoir = Promise.all([auraP, colP].concat(["noir", "blanche"].map(function (k) {
      return fetch("./assets/data/" + PSYCH[k].file + "?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { PSYCH[k].bank = j; }).catch(function () { PSYCH[k].bank = null; });
    })));
    S.loading = Promise.all([S.loading, S.loadingDNA, S.loadingNoir]).then(function () {});
    // Optional: Zig's liked prompts (never blocks loading).
    fetch("./assets/data/style-examples.json?v=" + V).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { S.examples = j; }).catch(function () {});
    return S.loading;
  }

  // ---- Assembly (follows variety.json assemblyOrder exactly) ----------------------------
  function roll(look) {
    var P = S.variety.pools, L = HIST, r = {};
    var ok = function (x) { return x && !FRAMING_RE.test(x) && !hasBlocked(x); };
    var lv = (look.venues || []).filter(ok), lw = (look.wardrobeHints || []).filter(ok);
    var glam = beautyOn();
    if (glam) lw = lw.filter(function (x) { return !DRAB_WARDROBE_RE.test(x); });
    r.venue = (lv.length && rnd() >= FALLBACK_P) ? pick(lv, L.venue) : pick((P.venueEvent || []).filter(ok), L.venue);
    r.wardrobe = (lw.length && rnd() >= FALLBACK_P) ? pick(lw, L.wardrobe) : pick(glam ? GLAM.wardrobe : (P.wardrobe || []).filter(ok), L.wardrobe);
    r.spicyWardrobe = pick(SPICY_WARDROBE, L.spicyWardrobe);
    r.xxxWardrobe = pick(XXX_WARDROBE, L.xxxWardrobe);
    ["skinTone", "heritageRegion", "faceShape", "eyes", "brows", "nose", "lips", "jawCheekbones", "complexionDetail", "distinctiveFeature",
      "hairColor", "hairStyle", "hairTexture", "build", "heightFeel", "makeupLevel", "nails", "tattoosPiercings"].forEach(function (k) { r[k] = pick(cleanPool(glamPool(P[k], k), k), L[k]); });
    // ageBand: adult bands only (all 21+); refuse anything that isn't.
    var bands = (P.ageBand || []).filter(function (b) { var n = parseInt(b, 10); return n >= 21; });
    if (glam) bands = MATURE_LOOKS[look.id] ? ["33-40", "41-50"] : ["21-25", "21-25", "26-32", "26-32", "33-40"];  // all 21+
    r.ageBand = pick(bands.length ? bands : ["26-32"], L.ageBand);
    if (glam) r.beauty = pick(BEAUTY_LINE);
    if (dnaOn(look)) {
      Object.keys(DNA.poolDrop).forEach(function (k) { if (DNA.poolDrop[k].test(r[k] || "")) { var o = cleanPool(P[k], k).filter(function (x) { return !DNA.poolDrop[k].test(x); }); if (o.length) r[k] = pick(o); } });
      r.dna = true; r.build = pick(DNA.builds, L.dnaBuild); remember("dnaBuild", r.build);
      if (leanOn(look) || rnd() < 0.6) r.venue = pick(crowdOn() ? DNA.venues : DNA.soloVenues, L.dnaVenue); remember("dnaVenue", r.venue);
      if (!crowdOn() && CROWD_RE.test(r.venue)) r.venue = pick(DNA.soloVenues);
      if (!MATURE_LOOKS[look.id]) r.ageBand = pick(["21-25", "26-32", "26-32", "33-40"]);   // all 21+
      r.dnaWardrobe = { tease: pick(DNA.wardrobe.tease), spicy: pick(DNA.wardrobe.spicy) };
    }
    Object.keys(r).forEach(function (k) { remember(k, r[k]); });
    if (r.tattoosPiercings === "none") r.tattoosPiercings = "no tattoos or piercings";
    S.last = r;
    return r;
  }
  function realism(look, heat) {
    if (dnaOn(look)) {
      var grpD = S.groupScene ? (S.people > 1 ? S.people + " distinct adults 21+ in frame" : "group scene") + ", every person a distinct adult 21+ with a unique face" : "one woman per frame preferred";
      return [DNA.real, grpD, "adult woman 21+", DNA.tail].join(", ");   // his exact wording (clean-skin pool filter still applies to the random picks)
    }
    var b = String(look.realismBlock || "").replace(/photoreal documentary snapshot/gi, "photoreal candid snapshot");
    if (heat && heat !== "tease") b = b.replace(/natural sweat sheen only where skin heats/gi, "glistening skin, natural sweat sheen").replace(/,\s*dirty sensor spots/gi, "").replace(/,\s*imperfect exposure/gi, "");
    if (S.groupScene) {
      var grp = (S.people > 1 ? S.people + " distinct adults 21+ in frame" : "group scene") + ", every person a distinct adult 21+ with a unique face, different skin tones, hair and outfits";
      b = b.replace(/one (woman|character) per frame( unless the group toggle is on)?/gi, grp);
      if (b.indexOf(grp) < 0) b += ", " + grp;
    } else {
      b = b.replace(/one (woman|character|person) per frame unless the group toggle is on/gi, "one $1 per frame");
      if (!/one (woman|character|person) per frame/i.test(b)) b += ", one woman per frame";
    }
    return beautySoften(cleanSkinText(b.replace(/\s*unless the group toggle is on/gi, "")));
  }
  function suffixOf(look, seed) {
    var suf = String((look.mj && look.mj.suffix) || "").trim();
    suf = suf.replace(/\s--(tile|repeat|r)\b(\s+\d+)?/gi, "").replace(/\s--seed\s+\d+/gi, "");
    // scrub the --no list too
    suf = suf.replace(/--no\s+(.*)$/i, function (_, list) { return "--no " + scrubList(list); });
    suf = suf.replace(/--stylize\s+\d+/i, "--stylize " + stylizeOf(look));
    if (/--v\s+6/.test(suf) && !/--style raw/.test(suf)) suf = suf.replace(/(--v\s+[\d.]+)/, "$1 --style raw");
    suf = addCleanNo(suf);
    if (beautyOn()) suf = /--no\s+/i.test(suf) ? suf.replace(/--no\s+(.*)$/i, function (_, l) { return addBeautyNo("--no " + l); }) : suf + " " + addBeautyNo("");
    return suf + " --seed " + seed;
  }
  function addCleanNo(suf) { return addCleanNoOn(suf, cleanOn()); }
  function addCleanNoOn(suf, on) {
    if (!on) return suf;
    if (/--no\s+/i.test(suf)) return suf.replace(/--no\s+(.*)$/i, function (_, list) { list = list.replace(/[,\s]+$/, ""); return "--no " + (list ? list + ", " : "") + CLEAN_SKIN_NO; });
    return (suf ? suf + " " : "") + "--no " + CLEAN_SKIN_NO;
  }
  // Wardrobe for this roll: idea clothing > heat wardrobe > look/pool wardrobe.
  function wardrobeFor(idea, heat, r) {
    var g = garmentsOf(idea), ph = outfitPhrase(idea);
    if (ph && !g.some(function (x) { return ph.toLowerCase().indexOf(x.toLowerCase()) >= 0; })) {
      var lead = heat === "xxx" ? "topless, wearing only an opened-up " + ph : heat === "spicy" ? "wearing a tight, revealing " + ph : "wearing a " + ph;
      return { text: lead + ", " + ph + " in clear focus", fromIdea: true };
    }
    if (g.length) {
      var clothes = g.filter(function (x) { return !NUDE_RE.test(x); }), nude = g.filter(function (x) { return NUDE_RE.test(x); });
      var outfit = clothes.join(" and ");
      var parts = [];
      if (nude.length) parts.push(nude.join(", "));
      if (outfit) {
        if (heat === "xxx" && !nude.length) parts.push("topless, wearing nothing but a " + outfit);
        else if (heat === "spicy") parts.push("wearing only a tiny " + outfit + ", revealing");
        else parts.push("wearing only a " + outfit);
        parts.push(outfit + " in clear focus");     // repeat the key outfit term
      } else if (heat === "xxx" && !/nude|naked/i.test(nude.join(" "))) parts.push("nude");
      return { text: parts.join(", "), fromIdea: true };
    }
    if (r.dnaWardrobe && heat !== "xxx") return { text: r.dnaWardrobe[heat] || r.dnaWardrobe.tease, fromIdea: false };
    if (heat === "spicy") return { text: r.spicyWardrobe, fromIdea: false };
    if (heat === "xxx") return { text: r.xxxWardrobe, fromIdea: false };
    return { text: r.wardrobe, fromIdea: false };
  }
  // The look's own prompt text without {idea}; drops contradicting wardrobe + clean-leaning bits when needed.
  function headOf(look, dropWardrobe, heat) {
    var head = String(look.mjPrompt || "").replace(/^\{idea\},?\s*/, "").replace("{idea}", "");
    var lw = String(look.wardrobe || "").toLowerCase();
    return head.split(/,\s*/).filter(function (f) {
      if (!f) return false;
      if (FRAMING_RE.test(f)) return false;
      if (dropWardrobe && (HEAD_WARDROBE_RE.test(f) || (lw && lw.indexOf(f.toLowerCase()) >= 0 && !/adults? 21\+/i.test(f)))) return false;
      if (heat !== "tease" && CLEAN_RE.test(f)) return false;
      return true;
    }).join(", ");
  }
  function dedupe(text) {
    var seen = {};
    return String(text).split(/,\s*/).filter(function (f) { var k = f.trim().toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; }).join(", ");
  }
  // ---- Cast: 1-5 distinct adults (each with their own face, hair, wardrobe roll) ---------------------
  function rollCast(look) {
    var st = styleOf(look);
    var n = peopleN(), cast = [];   // every style follows the People control (1-5)
    for (var i = 0; i < n; i++) {
      var r = roll(look), man = st === "club" && S.castMix === "mixed" && i % 2 === 1;
      if (man) { r.man = true; r.mHair = pick(MALE.hair, HIST.mHair); r.mFace = pick(MALE.face, HIST.mFace); r.mBuild = pick(MALE.build, HIST.mBuild);
        if (r.beauty) { r.mFace = "handsome chiseled face, " + r.mFace; r.mBuild = r.mBuild.replace(/^(\w)/, "ripped $1"); r.beauty = "";
          r.faceShape = pick(["square-jawed face", "strong angular face", "chiseled oval face"]); r.eyes = pick(["intense dark eyes", "piercing hazel eyes", "deep brown eyes", "steel-blue eyes"]);
          r.brows = "thick straight brows"; r.nose = pick(["strong straight nose", "classic straight nose", "broad strong nose"]); r.lips = "full defined lips";
          r.jawCheekbones = "sharp jawline"; r.complexionDetail = "healthy glowing skin"; r.distinctiveFeature = "confident smile"; r.heightFeel = pick(["tall", "6'2\" tall", "tall and broad"]); }
        ["mHair", "mFace", "mBuild"].forEach(function (k) { remember(k, r[k]); }); }
      if (ideaOutfit(S._ideaNow)) { var phC = outfitPhrase(S._ideaNow) || garmentsOf(S._ideaNow).join(" and ");   // idea outfit wins for every cast member
        r.wardrobe = phC; r.spicyWardrobe = "tight, revealing " + phC; r.xxxWardrobe = "opened-up " + phC + ", topless"; r.dnaWardrobe = null; }
      cast.push(r);
    }
    styleCast(look, cast);
    freshCast(look, cast);
    toneCast(look, cast);
    faceCast(look, cast);
    eyeCast(look, cast);
    S.last = cast[0]; S._cast = cast;
    return cast;
  }
  function personWardrobe(idea, heat, r, i) {
    if (r.man) return pick(MALE.wardrobe[heat] || MALE.wardrobe.tease);
    return i === 0 ? wardrobeFor(idea, heat, r).text : wardrobeFor("", heat, r).text;  // the idea's outfit goes to the lead
  }
  function personText(V2, r, heat, idea, i, prose) {
    var face = fill(V2.heritageFace, r);
    if (r.man) return face + ", " + r.mFace + "; " + r.hairColor + " hair, " + r.mHair + ", " + r.mBuild + ", " + r.heightFeel + ", adult man aged " + r.ageBand + "; wearing " + personWardrobe(idea, heat, r, i);
    var st = [personWardrobe(idea, heat, r, i), r.makeupLevel, r.nails, r.tattoosPiercings].filter(Boolean).join(", ");
    return face + (prose ? "; " : ", ") + bodyOf(V2, r) + (prose ? "; styling: " : ", ") + st;
  }
  function bodyOf(V2, r) { return (r.beauty ? r.beauty + ", " : "") + fill(V2.body, r) + (r.dna ? ", " + DNA.body + ", " + (DNA.heatBody[S._heatNow] || DNA.heatBody.tease) : ""); }
  function castLabel(r, i, n) { return n === 1 ? "" : castTag(i, n, S.castMix === "mixed" ? "adults" : "women") + (r.man ? ", a man" : ""); }
  // Beats: idea beats first; the look's generic setup / dialogue beats are dropped when an idea is typed; shuffled for variety.
  function beatsFor(look, idea, n) {
    var ctx = ideaCtx(idea), ib = [], lean = leanOn(look);
    ctx.forEach(function (c) { ib = ib.concat(c.beats); });
    if (!crowdOn()) ib = ib.filter(function (b) { return !CROWD_RE.test(b); });
    var lb = lean ? [] : (look.shotList || []).filter(function (b) { return b && !FRAMING_RE.test(b) && !hasBlocked(b) && !(idea && SETUP_RE.test(b)) && (crowdOn() || !CROWD_RE.test(b)); });
    var out = [], a = ib.slice(), b = lb.slice();
    while (out.length < n && (a.length || b.length)) {
      var src = a.length && (out.length < 2 || !b.length) ? a : b;
      out.push(src.splice(Math.floor(rnd() * src.length), 1)[0]);
    }
    return out;
  }
  function motionFor(look, idea) {
    if (twerkOn()) return "high";
    if (styleOf(look) !== "club") return "high";
    var c = ideaCtx(idea).filter(function (x) { return x.motion === "high"; });
    return c.length ? "high" : ((look.mj && look.mj.motion) === "high" ? "high" : "low");
  }

  function assembleMJ(look, idea, r, seed, heat) {
    var c0_ = Array.isArray(r) ? r[0] : r; S._venueNow = (c0_ && c0_.venue) || ""; S._dnaLoc = "";
    var tw = crowdOn() ? "crowd or judges hyping her up" : "solo show straight to camera";
    var o = twerkOn() ? assembleMJ0(look, twerkIdea(idea), r, seed, heat) + ", " + TWERK.mj.replace("{crowd}", tw) : assembleMJ0(look, idea, r, seed, heat);
    if (crowdOn() && styleOf(look) !== "club") o += ", " + CROWD_LINE;
    return realMJ(artApply(stampMJ(chipMJ(pluralCast(noCrowdList(o + mashLine("mj")) + (freshOn() ? ", " + FRESH_FACE + ", " + FRESH_SKIN : ""), Array.isArray(r) ? r : [r]), look, Array.isArray(r) ? r : [r]), look), "mj", look), look);
  }
  function assembleMJ0(look, idea, r, seed, heat) {
    heat = heat || "tease"; S._heatNow = heat;
    if (styleOf(look) !== "club") return assembleStyle(look, idea, Array.isArray(r) ? r : [r], heat, "mj");
    var V2 = S.variety.slotTemplates;
    var cast = Array.isArray(r) ? r : [r]; r = cast[0];
    var dna = dnaOn(look); if (dna) r.venue = dnaVenue(idea, r); r.venue = ideaSetOr(r.venue); S._venueNow = r.venue || "";
    var w = wardrobeFor(idea, heat, r);
    var heritage = fill(V2.heritageFace, r), bodyTxt = bodyOf(V2, r);
    var styling = [w.text, r.makeupLevel, r.nails, r.tattoosPiercings, cleanOn() && !dna ? CLEAN_TOKEN : ""].filter(Boolean).join(", ");
    if (cast.length > 1) {
      heritage = cast.map(function (p, i) { return castLabel(p, i, cast.length) + ": " + personText(V2, p, heat, idea, i, false).replace(/,\s*/g, " / "); }).join(", ");
      bodyTxt = ""; styling = cleanOn() && !dna ? CLEAN_TOKEN : "";
    }
    var beat = beatsFor(look, idea, 1)[0] || "", ex = examplePhrase(look, idea);
    var head = headOf(look, w.fromIdea || heat !== "tease", heat), real = realism(look, heat);
    head = camScrubList(head, look, "mj"); real = dna ? real : camScrubList(real, look, "mj");
    if (dna) head = dnaList(head);  // only one camera in the prompt
    var lean = leanOn(look); if (lean) head = "";   // his DNA leads: no generic look camera / set / lighting / framing text
    var parts = [
      cast.length > 1 ? cast.length + " distinct adults 21+ together in one frame" : "",
      beat,                                   // one idea-matched beat (generic setup beats dropped)
      ex,                                     // a phrase from Zig's liked examples, if any
      pick(HEAT_LEADS[heat] || [HEAT[heat].lead]),  // heat wording (Tease / Spicy / XXX), varied per roll
      lean && dna ? "" : camLine(look, "mj"), // camera: platform gear or iPhone (DNA already says candid iPhone)
      head,                                   // mjPrompt without {idea}
      lean && !dna && !crowdOn() && CROWD_RE.test(r.venue || "") ? "" : fill(V2.venue, r),   // venue
      dna ? (crowdOn() ? DNA.crowd : DNA.solo) : "",   // candid DNA: packed venue (Crowd on) or empty venue
      heritage,                               // heritage/skin + unique face + face picks
      bodyTxt,                                // hair + build + heightFeel + ageBand (single person)
      styling,                                // wardrobe (idea first) + makeup + nails + tattoos
      "adult 21+",                            // always, in code
      real,                                   // realismBlock
      dna ? DNA.artifacts : (ARTIFACTS[camKind(look)] || "")  // real-capture artifacts for that camera
    ];
    var body = dedupe(scrubFraming(scrubList(parts.filter(Boolean).join(", ").replace(/\s+/g, " ").replace(/,\s*,/g, ","))));
    if (cast.length > 1) body = body.replace(/ \/ /g, ", ");
    body = body.split(CLEAN_TOKEN).join(freshOn() ? "no skin patches" : CLEAN_SKIN_STYLE);
    if (!/adult 21\+/.test(body)) body += ", adult 21+";
    // Idea first and weighted (MJ multi-prompt ::2), then the rest of the prompt.
    var lead = idea ? idea + "::2 " : "";
    return lead + body;  // params are added by compose(), always last
  }
  function assembleVideo(look, idea, r, heat) {
    var c0_ = Array.isArray(r) ? r[0] : r; S._venueNow = (c0_ && c0_.venue) || ""; S._dnaLoc = "";
    var o = assembleVideo0(look, twerkOn() ? twerkIdea(idea) : idea, r, heat);
    var extra = (twerkOn() ? " " + TWERK.video.replace("{crowd}", crowdOn() ? "crowd or judges hyping her up" : "solo show straight to camera") : "") + (crowdOn() && styleOf(look) !== "club" ? " Crowd: " + CROWD_LINE + "." : "") + mashLine("video") + (freshOn() ? " Faces: every woman has " + FRESH_FACE + ". Skin: " + FRESH_SKIN + "." : "");
    return realVideo(artApply(stampVideo(chipVideo(pluralCast(noCrowdProse(extra ? o.replace(/\s*adult 21\+\.?\s*$/, "") + extra + " adult 21+." : o), Array.isArray(r) ? r : [r]), look, Array.isArray(r) ? r : [r]), look), "video", look), look);
  }
  function assembleVideo0(look, idea, r, heat) {
    heat = heat || "tease"; S._heatNow = heat;
    if (styleOf(look) !== "club") return assembleStyle(look, idea, Array.isArray(r) ? r : [r], heat, "video");
    var V2 = S.variety.slotTemplates;
    var cast = Array.isArray(r) ? r : [r]; r = cast[0];
    var dna = dnaOn(look); if (dna) r.venue = dnaVenue(idea, r); r.venue = ideaSetOr(r.venue); S._venueNow = r.venue || "";
    var w = wardrobeFor(idea, heat, r);
    // Scrub only the look's own text; the idea is added afterwards so no filter can ever drop it.
    var rest = String(look.promptTemplate || "").replace(/^\{idea\}\s*[\u2014-]\s*/, "").replace(/\{idea\}/g, "");
    var k = rest.indexOf(". "), first = k > 0 ? rest.slice(0, k) : rest, after = k > 0 ? rest.slice(k + 2) : "";
    first = camScrubProse(first + ".", look).replace(/\.\s*$/, "");
    if (FRAMING_RE.test(first) || (heat !== "tease" && CLEAN_RE.test(first))) first = "";
    if (idea) first = first.replace(/\bscripted\s+/gi, "");
    if (leanOn(look)) first = "";   // no generic look tagline after his idea
    after = camScrubProse(after, look);
    var t = [(idea ? "Main action (priority): " + idea + (first ? " \u2014 " + first : "") : first), after].filter(Boolean).join(". ").replace(/\.\.\s/g, ". ");
    if (w.fromIdea || heat !== "tease") t = t.replace(/Wardrobe:[^.]*\./i, "Wardrobe: " + w.text + ".");
    if (heat !== "tease") t = t.replace(/Mood:[^.]*\./i, "Mood: " + (heat === "xxx" ? "erotic, explicit, uninhibited" : pick(["provocative, seductive, confident", "sultry, daring, playful", "steamy, bold, magnetic"])) + ".");
    // Beats: idea-matched + shuffled look beats (generic setup / dialogue openers dropped when there's an idea).
    var bts = beatsFor(look, idea, 4);
    if (bts.length) t = /Beats:[^.]*\./i.test(t) ? t.replace(/Beats:[^.]*\./i, "Beats: " + bts.join("; ") + ".") : t + " Beats: " + bts.join("; ") + ".";
    // Drop any clause with family / youth / non-consent framing, sentence by sentence.
    t = t.split(/(?<=\.)\s+/).map(function (sen) {
      if (/^Main action \(priority\):/.test(sen)) return sen;
      var m = sen.match(/^([A-Z][A-Za-z ]{0,20}:\s*)/), lab = m ? m[1] : "", body = m ? sen.slice(lab.length) : sen;
      var end = /\.\s*$/.test(body) ? "." : ""; body = body.replace(/\.\s*$/, "");
      var kept = body.split(/;\s*/).map(function (c) {
        // with an idea, drop scripted-scene openers (dialogue, banter, chapter structure) so the idea leads
        return idea ? c.split(/,\s*/).filter(function (f) { return !/\b(dialogue|banter|chapter\w*|formulaic|scripted|lav\b)/i.test(f); }).join(", ") : c;
      }).filter(function (c) { if (!c) return false; if (/adults 21\+/i.test(c)) return true; return !FRAMING_RE.test(c) && !(heat !== "tease" && CLEAN_RE.test(c)); }).join("; ");
      return kept ? lab + kept + end : "";
    }).filter(Boolean).join(" ");
    if (leanOn(look)) {
      t = t.split(/(?<=\.)\s+/).filter(function (sen) { return LEAN_KEEP_RE.test(sen) && !/^Wardrobe:/.test(sen) && (bts.length || !/^Beats:/.test(sen)); }).join(" ");   // wardrobe lives in Styling
    }
    if (dna) {
      t = dnaProse(t).replace(/\s*Set:[^.]*\./i, "").replace(/\b(16:9|9:16|4:5)\b/g, "2:3").replace(/Mood:[^.]*\./i, "Mood: " + DNA.mood + ".");
      t += " Look: " + realism(look, heat) + ".";
    }
    var i = t.indexOf(". ");
    var cl = leanOn(look) && dna ? "candid iPhone, handheld" : camLine(look, "video"), art = dna ? DNA.artifacts : (ARTIFACTS[camKind(look)] || "");
    var heatLine = pick(HEAT_VIDEO[heat] || [HEAT[heat].video]) + (cl ? " Camera: " + cl + (art ? "; " + art : "") + "." : "");
    t = i > 0 ? t.slice(0, i + 1) + " " + heatLine + t.slice(i + 1) : heatLine + " " + t;
    var styling = [w.text, r.makeupLevel, r.nails, r.tattoosPiercings, cleanOn() && !dna ? CLEAN_TOKEN : ""].filter(Boolean).join(", ");
    var lead, stylingTxt;
    if (cast.length > 1) {
      lead = "Cast (" + cast.length + " distinct adults 21+, each with a unique face): " + cast.map(function (p, i) { return castLabel(p, i, cast.length).replace(/^./, function (c) { return c.toUpperCase(); }) + " \u2014 " + personText(V2, p, heat, idea, i, true); }).join(". ") + ".";
      stylingTxt = cleanOn() && !dna ? " Skin: " + CLEAN_TOKEN + "." : "";
    } else {
      lead = (S.groupScene ? "Group scene; lead woman: " : "One woman per frame: ") + fill(V2.heritageFace, r) + "; " + bodyOf(V2, r) + ".";
      stylingTxt = " Styling: " + styling + ".";
    }
    var ex = examplePhrase(look, idea);
    var out = t + (ex ? " Style note: " + ex + "." : "") + " Setting: " + fill(V2.venue, r) + (dna ? ", " + (crowdOn() ? DNA.crowd : DNA.solo) : "") + ". " + lead + stylingTxt + " " +
      "Aspect " + (dna ? "2:3" : look.aspect) + ", clip length " + (leanOn(look) && dna ? "10-20 s" : look.clipLength) + ", motion " + motionFor(look, idea) + ". adult 21+.";
    out = scrubProse(out).split(CLEAN_TOKEN).join(freshOn() ? "no skin patches" : CLEAN_SKIN_STYLE);
    if (!/adult 21\+/.test(out)) out += " adult 21+.";
    return out;
  }
  function bankFor(look, seed, heat, tab, motion) {
    var bk = bankFor0(look, seed, heat, tab, motion);
    if (twerkOn()) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + TWERK.no : "--no " + TWERK.no;
    if (!crowdOn()) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + NO_CROWD_NO : "--no " + NO_CROWD_NO;
    // a rotated Focus DNA lighting pick (e.g. softbox high-key) must not be negated by the look's own --no list
    if (dnaRich(look) && /softbox/i.test(S._dnaLast || "") && bk.no) bk.no = bk.no.replace(/,?\s*studio softbox/i, "");
    if (anatomyOn()) { var hvA = String(bk.no || "").toLowerCase(), adA = ANATOMY_NO.filter(function (x) { return hvA.indexOf(x) < 0; }).join(", "); if (adA) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + adA : "--no " + adA; }
    if (S._roomUsed === "clean" && !walkStyle(look) && S.style !== "sabaddie" && S.style !== "roomwalk") { var hvC = String(bk.no || "").toLowerCase(), adC = ["messy room", "unmade bed", "trash on the floor"].filter(function (x) { return hvC.indexOf(x) < 0; }).join(", "); if (adC) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + adC : "--no " + adC; }
    var rN = realNoTerms(look, S._lastBody);
    if (rN.length) { var hvR = String(bk.no || "").toLowerCase(), adR = rN.filter(function (x) { return hvR.indexOf(x.toLowerCase()) < 0; }).join(", "); if (adR) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + adR : "--no " + adR; }
    var stN = stampOf(look);
    if (stN) { var hv = String(bk.no || "").toLowerCase(), ad = uniqList(stN.no).filter(function (x) { return hv.indexOf(x.toLowerCase()) < 0; }).join(", "); if (ad) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + ad : "--no " + ad; }
    if (freshOn()) {
      var have = String(bk.no || "").toLowerCase(), add = FRESH_NO.split(/,\s*/).filter(function (x) { return have.indexOf(x.toLowerCase()) < 0; }).join(", ");
      if (add) bk.no = bk.no ? bk.no.replace(/[,\s]+$/, "") + ", " + add : "--no " + add;
      if (!bk.style && /^--v\s*6/.test(bk.v || "")) bk.style = "--style raw";   // raw = less plastic in MJ v6
    }
    return bk;
  }
  function bankFor0(look, seed, heat, tab, motion) {
    var sb = styleBank(look, seed, tab); if (sb) return sb;
    var mj = look.mj || {}, no = "";
    var m = String(mj.suffix || "").match(/--no\s+(.*)$/i); if (m) no = "--no " + scrubList(m[1]);
    if (cleanOn()) no = no ? no.replace(/[,\s]+$/, "") + ", " + CLEAN_SKIN_NO : "--no " + CLEAN_SKIN_NO;
    no = addBeautyNo(no);
    var ch = mj.chaos != null ? Number(mj.chaos) : null;
    if (ch != null && heat && heat !== "tease") ch = Math.min(40, ch + 10);   // a little more variety on Spicy / XXX
    if (ch != null && S.people > 1) ch = Math.min(45, ch + 5);
    if (dnaOn(look)) {
      var dn = "--no " + DNA.no + (cleanOn() ? ", " + CLEAN_SKIN_NO : "");
      return { ar: DNA.bank.ar, v: DNA.bank.v, stylize: DNA.bank.stylize, chaos: DNA.bank.chaos, weird: "", q: DNA.bank.q, style: DNA.bank.style,
        seed: "--seed " + seed, no: dn, repeat: "", tile: false, realism: false };
    }
    var b = {
      ar: mj.ar ? "--ar " + mj.ar : "", v: mj.model || "", stylize: mj.stylize != null ? "--stylize " + stylizeOf(look) : "",
      chaos: ch != null ? "--chaos " + ch : "", weird: mj.weird ? "--weird " + mj.weird : "", q: mj.quality || "",
      style: (mj.styleRaw || /^--v\s*6/.test(mj.model || "")) ? "--style raw" : "", seed: "--seed " + seed, no: no, repeat: "", tile: false, realism: false
    };
    return b;
  }
  // Same order as the main app's MJ settings panel (pmMjAssemble), so both always agree.
  function bankText(t) {
    var r = [];
    ["ar", "v", "stylize", "chaos", "weird", "q", "style", "seed", "iw", "repeat"].forEach(function (k) { if (t[k]) r.push(t[k]); });
    if (t.tile) r.push("--tile");
    if (t.no) r.push(String(t.no).indexOf("--no") === 0 ? t.no : "--no " + t.no);
    return r.join(" ");
  }
  // Video prompts get the params too (Midjourney video: + --motion), placed before --no so the --no list stays last.
  function withMotion(params, tab, motion) {
    if (tab !== "video" || !params) return params;
    var mo = "--motion " + (motion === "high" ? "high" : "low");
    params = params.replace(/\s*--motion\s+\w+/gi, "");
    var i = params.search(/(^|\s)--no\s/);
    return i >= 0 ? (params.slice(0, i) + " " + mo + params.slice(i)).replace(/\s{2,}/g, " ").trim() : (params + " " + mo).trim();
  }
  // Final prompt: body, then (optional) tag block, then params LAST.
  function compose(res) {
    return [res.body, res.withTags && res.tags && res.tags.length ? res.tags.join(" ") : "", res.params || ""].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
  }
  // Keep Prompt Output in sync with the main app's MJ settings panel: if Zig changes --ar / --stylize / --chaos etc.
  // there after a Remix, the look prompt picks it up (the app uses the look prompt verbatim, so it must carry the params).
  function onPanelSuffix(v) {
    var res = S.result;
    if (!res || !res.body || typeof v !== "string" || !v.trim()) return;
    var next = withMotion(v.trim(), res.tab, res.motion);
    if (next === res.params) return;
    res.params = next; res.text = compose(res); save();
    try { S.api.current.setPrompt(res.text); } catch (e) {}
    if (S.el && R.panel && R.panel.isConnected) renderPanel();
  }
  (function watchPanel() {
    try {
      var cur = window.__pmMjSuffix;
      Object.defineProperty(window, "__pmMjSuffix", { configurable: true, enumerable: true,
        get: function () { return cur; }, set: function (v) { cur = v; try { onPanelSuffix(v); } catch (e) {} } });
    } catch (e) {}
  })();
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
    ".pml-ppl{min-width:44px}.pml-ppl.on,.pml-mix.on,.pml-addtags.on,.pml-style.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.14)}.pml-addtags{border-color:#fb923c;color:#fdba74}" +
    ".pml-heat{min-width:72px}.pml-heat[disabled]{opacity:.35;cursor:not-allowed}.pml-heat-tease.on{border-color:#f9a8d4;color:#fff;background:rgba(244,114,182,.14)}.pml-heat-spicy.on{border-color:#fb923c;color:#fff;background:rgba(251,146,60,.16)}.pml-heat-xxx.on{border-color:#ef4444;color:#fff;background:rgba(239,68,68,.18)}" +
    ".pml-tab.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.12)}" +
    ".pml-remix{width:100%;min-height:54px;border-radius:10px;border:0;font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:800;letter-spacing:.3em;color:#05070d;cursor:pointer;background:linear-gradient(90deg,var(--acc),#f1f5f9);box-shadow:0 0 26px rgba(125,211,252,.35);touch-action:manipulation}" +
    ".pml-dna{margin-top:10px;padding:10px;border-radius:10px;border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.05)}" +
    ".pml-dna-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
    ".pml-dna-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 4px 4px 10px;border-radius:999px;border:1px solid rgba(251,191,36,.7);background:rgba(251,191,36,.14);color:#fff;font-family:ui-monospace,Menlo,monospace;font-size:11.5px}" +
    ".pml-dna-chip.off{opacity:.45;text-decoration:line-through}" +
    ".pml-dna-x{border:0;background:transparent;color:#fde68a;cursor:pointer;font-size:14px;line-height:1;padding:0 4px}.pml-dna-x:hover{color:#fff}" +
    ".pml-dna-in{flex:1 1 140px;min-width:140px;padding:5px 9px;font-size:12px}" +
    ".pml-focus{border-color:#fbbf24;color:#fde68a}.pml-focus:hover{background:rgba(251,191,36,.12)}" +
    ".pml-focus-cue{margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(251,191,36,.55);background:rgba(251,191,36,.07);display:flex;flex-wrap:wrap;gap:6px}" +
    ".pml-focus-cue.flash{animation:pmlFocus 1.6s ease-out 1}" +
    ".pml-focus-chip{display:inline-block;padding:5px 10px;border-radius:999px;border:1px solid rgba(251,191,36,.7);background:rgba(251,191,36,.14);color:#fff;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.04em;animation:pmlChip .9s ease-out both}" +
    "@keyframes pmlFocus{0%{box-shadow:0 0 0 0 rgba(251,191,36,.9)}30%{box-shadow:0 0 26px 6px rgba(251,191,36,.55)}60%{box-shadow:0 0 8px 2px rgba(251,191,36,.3)}100%{box-shadow:0 0 0 0 rgba(251,191,36,0)}}" +
    "@keyframes pmlChip{0%{opacity:0;transform:scale(.8)}40%{opacity:1;transform:scale(1.08);background:rgba(251,191,36,.45)}100%{opacity:1;transform:scale(1)}}" +
    "@media (prefers-reduced-motion:reduce){.pml-focus-cue.flash,.pml-focus-chip{animation:none}}" +
    ".pml-remix[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none}" +
    ".pml-out{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.55;color:#e2e8f0;background:rgba(0,0,0,.45);border:1px solid rgba(168,85,247,.3);border-radius:10px;padding:12px;margin-top:8px}" +
    ".pml-note{margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);color:#fde68a;font-size:12px}" +
    ".pml-toggle{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);cursor:pointer;font-size:12px;color:#cbd5e1}" +
    ".pml-toggle.on{border-color:var(--acc);color:#fff}" +
    ".pml-sw{width:30px;height:16px;border-radius:9px;background:rgba(255,255,255,.15);position:relative}" +
    ".pml-sw:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#94a3b8;transition:left .15s}" +
    ".pml-toggle.on .pml-sw{background:var(--acc)}.pml-toggle.on .pml-sw:after{left:16px;background:#05070d}" +
    ".pml-cam{min-height:44px}.pml-skin{min-height:44px}.pml-cam.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.12)}" +
    ".pml-gear{margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.45;color:#94a3b8}" +
    ".pml-conf{display:inline-block;margin-left:8px;padding:0 6px;border-radius:4px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(255,255,255,.2);color:#cbd5e1}.pml-conf-guess{border-color:rgba(251,191,36,.5);color:#fde68a}.pml-conf-known{border-color:rgba(74,222,128,.5);color:#86efac}" +
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
  function copy(text, what) { copyText(text, function () { toast((what || "Copied") + "", ""); }); }
  function copyText(text, done) {
    done = done || function () {};
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); return; } } catch (e) {}
    fallback();
    function fallback() { var t = h("textarea", {}); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }
  function toast(t, d) { try { S.api.current.toast(t, d); } catch (e) {} }

  var R = {}; // element refs
  function mountAI(box) {
    function go() { try { if (window.PMAITalk) window.PMAITalk.mount(box, window.PMLooks.ai); } catch (e) {} }
    if (window.PMAITalk) { go(); return; }
    if (!S._aiLoading) { S._aiLoading = []; var sc = document.createElement("script"); sc.src = "./assets/ai-talk.js?v=" + V; sc.async = true;
      sc.onload = function () { var q = S._aiLoading || []; S._aiLoading = null; q.forEach(function (f) { f(); }); };
      sc.onerror = function () { S._aiLoading = null; box.style.display = "none"; };
      document.head.appendChild(sc); }
    if (S._aiLoading) S._aiLoading.push(go);
  }
  function render() {
    var el = S.el; if (!el) return;
    el.innerHTML = "";
    if (!document.getElementById("pml-css")) document.head.appendChild(h("style", { id: "pml-css", text: CSS }));
    var root = h("div", { cls: "pml", "data-pm": "platform-looks" });
    if (!S.looks) { root.appendChild(h("div", { cls: "pml-card", text: "Loading 120 platform looks…" })); el.appendChild(root); return; }

    // Talk to it (ai-talk.js fills this card; loaded on demand)
    R.ai = h("div", { cls: "pml-card", "data-pm": "ai-talk", style: "margin-bottom:12px" });
    root.appendChild(R.ai);
    mountAI(R.ai);
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
    P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px" }, [R.idea]));
    // People: 1-5 distinct adults per prompt (each rolls its own face, hair and outfit).
    var pr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-people", role: "radiogroup", "aria-label": "People in the prompt" }, [h("span", { cls: "pml-k", text: "People" })]);
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(function (n) {
      pr.appendChild(h("button", { cls: "pml-btn pml-ppl" + (S.people === n ? " on" : ""), type: "button", role: "radio", "aria-checked": S.people === n ? "true" : "false", "data-people": String(n), text: String(n),
        title: n === 1 ? "One adult" : n + " distinct adults 21+", on: { click: function () { S.people = n; S.groupScene = n > 1; save(); renderPanel(); } } }));
    });
    if (S.people > 1 && ((S.style || "none") === "club" || S.style === "none")) {
      [["women", "Women"], ["mixed", "Woman + man"]].forEach(function (c) {
        pr.appendChild(h("button", { cls: "pml-btn pml-mix" + (S.castMix === c[0] ? " on" : ""), type: "button", "aria-pressed": S.castMix === c[0] ? "true" : "false", "data-cast": c[0], text: c[1],
          on: { click: function () { S.castMix = c[0]; save(); renderPanel(); } } }));
      });
    }
    if (S.result && (S.result.people || 1) !== S.people) pr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(pr);
    var tabs = h("div", { cls: "pml-row", style: "margin-top:10px" });
    [["mj", "Midjourney image"], ["video", "Video prompt"]].forEach(function (t) {
      tabs.appendChild(h("button", { cls: "pml-btn pml-tab" + (S.tab === t[0] ? " on" : ""), type: "button", "data-tab": t[0], text: t[1], on: { click: function () { S.tab = t[0]; S.result = null; save(); renderPanel(); } } }));
    });
    P.appendChild(tabs);
    if (isAdult()) {
      var eff = heatFor(l);
      var hr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-heat", role: "radiogroup", "aria-label": "Heat level" }, [h("span", { cls: "pml-k", text: "Heat" })]);
      HEATS.forEach(function (k) {
        var capped = (!l.adult && k !== "tease") || (l.craftOnly && k === "xxx");
        hr.appendChild(h("button", { cls: "pml-btn pml-heat pml-heat-" + k + (eff === k ? " on" : ""), type: "button", role: "radio", "aria-checked": eff === k ? "true" : "false", "data-heat": k, disabled: capped ? true : null,
          title: capped ? (l.adult ? "Style-only look: heat capped at Spicy" : "SFW look: Tease only") : HEAT_LABEL[k], text: HEAT_LABEL[k],
          on: { click: function () { if (capped) return; S.heat = k; save(); renderPanel(); } } }));
      });
      if (l.craftOnly && l.adult) hr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "style-only look · max Spicy" }));
      else if (!l.adult) hr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "SFW look · Tease only" }));
      P.appendChild(hr);
    }
    var cr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-camera", role: "radiogroup", "aria-label": "Camera" }, [h("span", { cls: "pml-k", text: "Camera" })]);
    [["platform", "\ud83c\udfa5 Platform camera"], ["iphone", "\ud83d\udcf1 " + IPHONE_MODEL]].forEach(function (c) {
      cr.appendChild(h("button", { cls: "pml-btn pml-cam" + (S.cam === c[0] ? " on" : ""), type: "button", role: "radio", "aria-checked": S.cam === c[0] ? "true" : "false", "data-cam": c[0], text: c[1],
        on: { click: function () { S.cam = c[0]; save(); renderPanel(); } } }));
    });
    if (S.result && (S.result.cam || "platform") !== S.cam) cr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(cr);
    var sk = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-skin" }, [h("span", { cls: "pml-k", text: "Skin" }),
      h("button", { cls: "pml-toggle pml-skin" + (cleanOn() ? " on" : ""), type: "button", "data-pm": "look-clean-skin", "aria-pressed": cleanOn() ? "true" : "false",
        title: "Skips skin marks and conditions (vitiligo, freckles, scars, birthmarks...) and asks for clear, even-toned skin",
        on: { click: function () { S.cleanSkin = !cleanOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Clean skin"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: cleanOn() ? "no skin marks \u00b7 even tone" : "random skin details" })]);
    if (S.result && (S.result.clean !== false) !== cleanOn()) sk.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(sk);
    var bt = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-beauty" }, [h("span", { cls: "pml-k", text: "Beauty" }),
      h("button", { cls: "pml-toggle pml-skin" + (beautyOn() ? " on" : ""), type: "button", "data-pm": "look-beauty-toggle", "aria-pressed": beautyOn() ? "true" : "false",
        title: "Biases faces, bodies and outfits toward glamorous, gorgeous adult women (21+). Off = the original random mix",
        on: { click: function () { S.beauty = !beautyOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Beauty"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: beautyOn() ? "glam faces \u00b7 hot bodies \u00b7 sexy outfits" : "original random mix" })]);
    if (S.result && (S.result.beauty === true) !== beautyOn()) bt.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(bt);
    var fr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-fresh" }, [h("span", { cls: "pml-k", text: "Faces" }),
      h("button", { cls: "pml-toggle pml-skin" + (freshOn() ? " on" : ""), type: "button", "data-pm": "look-fresh-toggle", "aria-pressed": freshOn() ? "true" : "false",
        title: "Brand-new unique faces every Remix (never repeats one it already made on this device) + real skin with pores, peach fuzz, uneven tone and sweat. Never plastic, waxy or airbrushed. Adults 21+ only",
        on: { click: function () { S.fresh = !freshOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Fresh faces"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: freshOn() ? "new face every remix \u00b7 real pores \u00b7 no plastic" : "off" })]);
    if (S.result && (S.result.fresh === true) !== freshOn()) fr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(fr);
    var cw = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-crowd" }, [h("span", { cls: "pml-k", text: "Venue" }),
      h("button", { cls: "pml-toggle pml-skin" + (crowdOn() ? " on" : ""), type: "button", "data-pm": "look-crowd-toggle", "aria-pressed": crowdOn() ? "true" : "false",
        title: "On: packed spectators with phones in soft background bokeh. Off (default): empty / solo venue, no spectators, no phones, no crowd",
        on: { click: function () { S.crowd = !crowdOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Crowd"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: crowdOn() ? "packed spectators \u00b7 phones \u00b7 bokeh" : "no crowd \u00b7 empty venue" })]);
    if (S.result && (S.result.crowd === true) !== crowdOn()) cw.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(cw);
    var mt = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-multitone" }, [h("span", { cls: "pml-k", text: "Tones" }),
      h("button", { cls: "pml-toggle pml-skin" + (multiOn() ? " on" : ""), type: "button", "data-pm": "look-multitone-toggle", "aria-pressed": multiOn() ? "true" : "false",
        title: "On: with People 2+, every person a different heritage and skin tone (deep to fair). Off: the style's own heritage, still no two people alike",
        on: { click: function () { S.multitone = !multiOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Multi-tone"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: multiOn() ? "mixed heritages \u00b7 every tone different" : "style heritage \u00b7 no two alike" })]);
    if (S.result && (S.result.multitone === true) !== multiOn()) mt.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(mt);
    var ey = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-eyes", role: "radiogroup", "aria-label": "Eye color" }, [h("span", { cls: "pml-k", text: "Eyes" })]);
    EYES.forEach(function (e) {
      var on = eyeMode() === e[0];
      ey.appendChild(h("button", { cls: "pml-btn pml-style pml-eye" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-eye": e[0], text: e[1],
        on: { click: function () { S.eye = e[0]; S.eyeSet = true; save(); renderPanel(); } } }));
    });
    ey.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: { regular: "brown \u00b7 dark brown (most common)", hazel: "hazel shades", green: "green shades", blue: "blue shades", gray: "gray shades", hetero: "two different colors", exotic: "random mix (any color)" }[eyeMode()] }));
    if (S.result && (S.result.eye || "regular") !== eyeMode()) ey.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(ey);
    var sr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-style", role: "radiogroup", "aria-label": "Style" }, [h("span", { cls: "pml-k", text: "Style" })]);
    STYLES.forEach(function (c) {
      var on = (S.style || "none") === c[0];
      sr.appendChild(h("button", { cls: "pml-btn pml-style" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-style": c[0], text: c[1] + (ADULT_STYLES[c[0]] ? " 18+" : ""), disabled: ADULT_STYLES[c[0]] && !isAdult() ? true : null,
        title: c[0] === "none" ? "No style preset: the platform's focus DNA drives the look" : "Tap again to deselect (back to None)",
        on: { click: function () { if (S.style === c[0] && c[0] !== "none") { S.style = "none"; save(); renderPanel(); return; } S.style = c[0]; var d = { sync: 5, ny: 5, duo: 2, sabaddie: 5, roomwalk: 1 }[c[0]]; if (d) { S.people = d; S.groupScene = d > 1; } save(); renderPanel(); } } }));
    });
    sr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: S.style === "none" ? "no preset \u00b7 platform focus DNA drives the look" : S.style === "club" || !S.style ? (crowdOn() ? "packed venue \u00b7 candid iPhone" : "empty venue \u00b7 candid iPhone") : (S.people > 1 ? S.people + " women \u00b7 " : "1 woman \u00b7 ") + (S.style === "roomwalk" ? "one original woman, 22-28 \u00b7 seamless room walk loop" : S.style === "sabaddie" ? "South African women, all 28 \u00b7 rear-view walk" : S.style === "tryouts" ? "women only, slingshot walk + strip" : S.style === "carib" ? "Haitian / Jamaican / Dominican, chair twerk" : S.style === "rural" ? "locked lead character, random camera" : S.style === "duo" ? "cinematic noir, clothes falling off" : S.style === "ny" ? "NY women, loose sync, stylize 500" : S.style === "sync" ? "South Indian, in sync" : S.style === "contest" ? "head-shot + full body" : "packed venue \u00b7 candid iPhone") }));
    if (S.result && (S.result.style || "club") !== (S.style || "club")) sr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(sr);
    var nr = h("div", { cls: "pml-row", style: "margin-top:10px", role: "radiogroup", "aria-label": "Neon color", "data-pm": "look-neon" }, [h("span", { cls: "pml-k", text: "Neon" })]);
    NEON_MODES.forEach(function (o) { var on = neonMode() === o[0]; nr.appendChild(h("button", { cls: "pml-btn pml-cam" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-neon": o[0], text: o[1],
      title: o[0] === "brand" ? "Keep the ZigFlames orange / flame neon" : o[0] === "rotate" ? "New neon / LED color every Remix (pinks, blues, purples, UV, greens, reds, two-tones, orange now and then)" : "Always use the color you pick",
      on: { click: function () { S.neon = o[0]; save(); renderPanel(); } } })); });
    if (neonMode() === "pick") { var sel = h("select", { cls: "pml-btn", "data-pm": "look-neon-pick", "aria-label": "Neon color pick", on: { change: function (e) { S.neonPick = e.target.value; save(); renderPanel(); } } }, NEON_PALETTE.map(function (c) { return h("option", { value: c, text: c }); })); sel.value = neonPick(); nr.appendChild(sel); }
    nr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: neonMode() === "brand" ? "orange \u00b7 flame" : neonMode() === "pick" ? neonPick() : "random each remix" + (S._neonUsed ? " \u00b7 last: " + S._neonUsed : "") }));
    P.appendChild(nr);
    var rr = h("div", { cls: "pml-row", style: "margin-top:10px", role: "radiogroup", "aria-label": "Room", "data-pm": "look-room" }, [h("span", { cls: "pml-k", text: "Room" })]);
    ROOM_MODES.forEach(function (o) { var on = roomMode() === o[0]; rr.appendChild(h("button", { cls: "pml-btn pml-cam" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-room": o[0], text: o[1],
      title: o[0] === "random" ? "About half messy, half clean, rolled each Remix" : o[0] === "messy" ? "Messy lived-in room: unmade bed, clothes on the floor" : "Tidy, staged room: made bed, clear surfaces",
      on: { click: function () { S.room = o[0]; save(); renderPanel(); } } })); });
    rr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: (roomMode() === "random" ? "50/50 each remix" : roomMode()) + " \u00b7 walk styles keep their own room" }));
    P.appendChild(rr);
    var tw = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-twerk" }, [h("span", { cls: "pml-k", text: "Show" }),
      h("button", { cls: "pml-toggle pml-skin" + (twerkOn() ? " on" : ""), type: "button", "data-pm": "look-twerk-toggle", "aria-pressed": twerkOn() ? "true" : "false",
        title: "One tap: every Remix becomes a twerk show (amateur jiggle, motion, ass to camera, crowd or judges). Adults 21+ only",
        on: { click: function () { S.twerk = !twerkOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Twerk show"]),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: twerkOn() ? "jiggle \u00b7 motion \u00b7 ass to camera" : "off" }),
      h("button", { cls: "pml-toggle pml-skin" + (S.mash ? " on" : ""), type: "button", "data-pm": "look-mash-toggle", "aria-pressed": S.mash ? "true" : "false",
        title: "Each Remix randomly blends 2-3 of Zig's style DNAs (one sets the cast and params, the others add flavor). Adults 21+ only",
        on: { click: function () { S.mash = !S.mash; save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Mash-up"]),
      h("button", { cls: "pml-toggle pml-skin" + (anatomyOn() ? " on" : ""), type: "button", "data-pm": "look-anatomy-toggle", "aria-pressed": anatomyOn() ? "true" : "false",
        title: "Correct hands (five fingers each), natural limbs, proportions, joints, feet, symmetrical eyes; bundled into the Focus DNA block with the same priority",
        on: { click: function () { S.anatomy = !anatomyOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Perfect Anatomy"]),
      h("button", { cls: "pml-toggle pml-skin" + (noAiOn() ? " on" : ""), type: "button", "data-pm": "look-noai-toggle", "aria-pressed": noAiOn() ? "true" : "false",
        title: "Adds anti-AI negatives (plastic / waxy skin, CGI, 3D render, beauty filter, stock photo...) plus natural skin texture, pores and real sensor noise. Never negates the camera look (phone, grain, flash, handheld, 50mm, 90s stay)",
        on: { click: function () { S.noAi = !noAiOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "No AI Look"]),
      h("button", { cls: "pml-toggle pml-skin" + (agOn() ? " on" : ""), type: "button", "data-pm": "look-antigeneric-toggle", "aria-pressed": agOn() ? "true" : "false",
        title: "Anti-Generic Prime: your idea + the look's signature DNA go first at the Focus DNA weight (Video opens with 'Must show'), 1-2 oddly specific real-life details each Remix, and anti-generic negatives. Adults 21+",
        on: { click: function () { S.antiGeneric = !agOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Anti-Generic Prime"]),
      h("button", { cls: "pml-toggle pml-skin" + (uniqueOn() ? " on" : ""), type: "button", "data-pm": "look-uniquefaces-toggle", "aria-pressed": uniqueOn() ? "true" : "false",
        title: "Face Builder: every person gets a new combination of face shape, eyes (heritage-matched color unless you pick an Eyes button), brows, nose, lips, jaw + 4-6 distinctive traits; no repeat within 20 Remixes. Adults 21+",
        on: { click: function () { S.uniqueFaces = !uniqueOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Unique Faces"]),
      isAdult() ? h("button", { cls: "pml-toggle pml-skin" + (realPornOn() ? " on" : ""), type: "button", "data-pm": "look-realporn-toggle", "aria-pressed": realPornOn() ? "true" : "false",
        title: "18+ mode only: real adult-production / amateur footage realism (practical on-set light, real bodies and skin, candid moments). Never overrides Focus DNA or the lighting rotation. Adults 21+ only",
        on: { click: function () { S.realPorn = !realPornOn(); save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Real Porn Look"]) : null,
      h("button", { cls: "pml-toggle pml-skin" + (S.artOn === true ? " on" : ""), type: "button", "data-pm": "look-artby-toggle", "aria-pressed": S.artOn === true ? "true" : "false",
        title: "Each Remix adds one subtle artist influence (lighting / composition / color / attitude). Influence only: stays photorealistic, Focus DNA stays in charge (MJ ::0.6)",
        on: { click: function () { S.artOn = S.artOn !== true; save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), "Art by" + (S.artOn === true && S.artLast ? ": " + S.artLast : "")]),
      h("button", { cls: "pml-btn", type: "button", "data-pm": "look-artby-dice", title: "Reroll just the artist", disabled: S.artOn === true && ART ? null : true, on: { click: artReroll } }, [h("span", { text: "\ud83c\udfb2" })]),
      h("span", { cls: "pml-row", style: "display:inline-flex;gap:4px", "data-pm": "look-artby-cats", role: "radiogroup", "aria-label": "Art by category" }, ART_CATS.map(function (c) {
        var on = artCat() === c[0], lock = c[0] === "adult" && !isAdult();
        return h("button", { cls: "pml-btn pml-art-cat" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-artcat": c[0], text: c[1] + (c[0] === "adult" ? " 18+" : ""), disabled: lock ? true : null,
          on: { click: function () { S.artCat = c[0]; save(); renderPanel(); } } });
      })),
      psychBtn("noir"), psychBtn("blanche"),

      h("span", { cls: "pml-k", style: "letter-spacing:.12em", "data-pm": "look-noir-note", text: noirOn() ? (S.result && S.result.noirWord ? "last: " + S.result.noirWord : "1 " + PSYCH[psychMood()].label + " accent each Remix") : "psych mood off" }),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", "data-pm": "look-mash-note", text: S.mash ? (S.result && S.result.mashMix ? "last: " + S.result.mashMix : "random blend each Remix") : "off" })]);
    var stL = stampOf(lookById(S.sel)); if (stL) tw.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em;color:#fde68a", "data-pm": "look-stamp", text: stL.name + " look stamp \u00b7 on top of your DNA every Remix" }));
    if (S.result && ((S.result.twerk === true) !== twerkOn() || (S.result.mash === true) !== (S.mash === true))) tw.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "applies on next Remix" }));
    P.appendChild(tw);
    var cr = h("div", { cls: "pml-row", style: "margin-top:8px;flex-wrap:wrap", role: "radiogroup", "aria-label": "Psych Mood colors", "data-pm": "look-psych-colors" }, [h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "Psych mood \u00b7 colors" })]);
    COLOR_KEYS.concat(["psych-random"]).forEach(function (k) {
      var on = psychMood() === k;
      cr.appendChild(h("button", { cls: "pml-btn pml-style" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-pm": "look-psych-" + k,
        title: k === "psych-random" ? "Any color mood each Remix (Noir, Blanche, colors or Aura)" : PSYCH[k].label + " mood accent: light and mood only, never skin. Tap again to turn off",
        text: PSYCH[k].label, on: { click: function () { S.psych = on ? "" : k; S.noir = false; save(); renderPanel(); } } }));
    });
    P.appendChild(cr);
    var ar = h("div", { cls: "pml-row", style: "margin-top:8px;flex-wrap:wrap", role: "radiogroup", "aria-label": "Aura", "data-pm": "look-aura" }, [h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "Aura \u00b7 chakra light" })]);
    AURA_KEYS.concat(["random"]).forEach(function (k) {
      var id = "aura-" + k, on = psychMood() === id;
      ar.appendChild(h("button", { cls: "pml-btn pml-style" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-pm": "look-psych-" + id,
        title: "Aura mood accent: light, glow and atmosphere only (never skin tone or ethnicity; cast stays as rolled). Tap again to turn off",
        text: PSYCH[id].label, on: { click: function () { S.psych = on ? "" : id; S.noir = false; save(); renderPanel(); } } }));
    });
    P.appendChild(ar);
    var g = gearOf(l), gl = camLine(l, S.tab) || "rendered look \u00b7 virtual camera";
    P.appendChild(h("div", { cls: "pml-gear", "data-pm": "look-gear" }, [gl, S.cam === "iphone" ? null : h("span", { cls: "pml-conf pml-conf-" + g.confidence, title: g.basis || "", text: g.confidence })]));
    P.appendChild(renderDnaRow(l));
    R.note = h("div", { cls: "pml-note", "data-pm": "look-notice", style: S.notice ? "" : "display:none", text: S.notice });
    P.appendChild(R.note);
    R.focus = h("div", { cls: "pml-focus-cue", "data-pm": "look-focus-cue", style: "display:none", "aria-live": "polite" });
    P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px" }, [
      h("button", { cls: "pml-btn pml-focus", type: "button", "data-pm": "look-focus", title: "Flash this style's key DNA words (weighted ::2 in the prompt)", text: "\u25ce Focus", on: { click: showFocus } }),
      h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "key DNA \u00b7 weighted ::2" })]));
    P.appendChild(R.focus);
    P.appendChild(h("button", { cls: "pml-remix", type: "button", "data-pm": "look-remix", style: "margin-top:12px", text: S.result ? "REMIX AGAIN" : "REMIX", on: { click: doRemix } }));

    if (S.result) {
      var res = S.result;
      P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px;justify-content:space-between" }, [
        h("span", { cls: "pml-k", text: (res.tab === "video" ? "Video prompt" : "Midjourney prompt") + (res.heat && isAdult() ? " · " + HEAT_LABEL[res.heat] : "") + (res.cam === "iphone" ? " · " + IPHONE_MODEL : " · platform camera") + " · written to Prompt Output" }),
        h("div", { cls: "pml-row" }, [
          h("button", { cls: "pml-btn", type: "button", "data-pm": "look-copy", text: "Copy", on: { click: function () { copy(res.text, "Prompt copied"); } } }),
          h("button", { cls: "pml-btn", type: "button", "data-pm": "look-again", text: "Remix again", on: { click: doRemix } }),
          h("button", { cls: "pml-btn", type: "button", text: "Open in Prompt Output", on: { click: function () { try { S.api.current.go("output"); } catch (e) {} } } })
        ])
      ]));
      P.appendChild(h("div", { cls: "pml-out", "data-pm": "look-result", text: res.text }));
      if (res.params) P.appendChild(h("div", { cls: "pml-row", style: "margin-top:6px", "data-pm": "look-out-params" }, [h("span", { cls: "pml-k", text: "Params in prompt" }), h("span", { cls: "pml-param", text: res.params.replace(/\s--no\s.*$/, " --no \u2026") })]));
      if (res.tags && res.tags.length) {
        var tr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-tags" }, [h("span", { cls: "pml-k", text: "Hashtags" })]);
        res.tags.forEach(function (t) { tr.appendChild(h("span", { cls: "pml-htag", text: t })); });
        if (res.body) tr.appendChild(h("button", { cls: "pml-btn pml-addtags" + (res.withTags ? " on" : ""), type: "button", "data-pm": "look-add-tags", "aria-pressed": res.withTags ? "true" : "false",
          text: res.withTags ? "Remove tags" : "Add tags", title: "Insert the tag block into the prompt (params stay last)", on: { click: toggleTags } }));
        tr.appendChild(h("button", { cls: "pml-btn", type: "button", "data-pm": "look-copy-tags", text: "Copy tags", on: { click: function () { copy(res.tags.join(" "), "Hashtags copied"); } } }));
        P.appendChild(tr);
      }
    }
  }
  // Focus DNA chips: tap x to drop a key, type + Enter to add one, Reset restores the platform defaults.
  function psychBtn(k) {
    var on = psychMood() === k;
    return h("button", { cls: "pml-toggle pml-skin" + (on ? " on" : ""), type: "button", "data-pm": "look-psych-" + k, "aria-pressed": on ? "true" : "false",
      title: "Each Remix adds ONE random phrase from the " + PSYCH[k].label + " bank as a light mood accent (never overrides the Focus DNA). Seductive ones only in 18+ mode. Adults 21+ only. Tap again to turn off",
      on: { click: function () { S.psych = on ? "" : k; S.noir = false; save(); renderPanel(); } } }, [h("span", { cls: "pml-sw" }), PSYCH[k].label]);
  }
  function renderDnaRow(l) {
    var box = h("div", { cls: "pml-dna", "data-pm": "look-focus-dna" });
    var dna = focusDna(l), edited = dnaEdited(l);
    box.appendChild(h("div", { cls: "pml-row", style: "justify-content:space-between;margin-bottom:6px" }, [
      h("span", { cls: "pml-k", style: "letter-spacing:.12em;color:#fde68a", text: "Focus DNA \u00b7 " + lookName(l) + (S.tab === "video" ? " \u00b7 front-loaded" + (dnaW() === "light" ? "" : " + recap") : " \u00b7 weighted ::" + DNA_W[dnaW()]) + (edited ? " \u00b7 edited" : "") }),
      edited ? h("button", { cls: "pml-btn", type: "button", "data-pm": "look-dna-reset", text: "Reset", on: { click: function () { delete dnaEdits()[l.id]; saveDnaEdits(); renderPanel(); } } }) : null
    ]));
    var wr = h("div", { cls: "pml-row", style: "margin-bottom:8px", role: "radiogroup", "aria-label": "Focus DNA weight", "data-pm": "look-dna-weight" }, [h("span", { cls: "pml-k", style: "letter-spacing:.12em", text: "Weight" })]);
    DNA_W_LABEL.forEach(function (o) { var on = dnaW() === o[0]; wr.appendChild(h("button", { cls: "pml-btn pml-cam" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", "data-dnaw": o[0], text: o[1] + (S.tab === "video" ? "" : " ::" + DNA_W[o[0]]), on: { click: function () { S.dnaW = o[0]; save(); renderPanel(); } } })); });
    if (anatomyOn()) wr.appendChild(h("span", { cls: "pml-k", style: "letter-spacing:.12em;color:#fde68a", text: "+ perfect anatomy" }));
    box.appendChild(wr);
    var row = h("div", { cls: "pml-dna-chips" });
    var setList = function (list) { dnaEdits()[l.id] = list; saveDnaEdits(); renderPanel(); };
    focusDnaRaw(l).forEach(function (t, i) {
      var live = dna.indexOf(cleanDnaToken(t)) >= 0;
      row.appendChild(h("span", { cls: "pml-dna-chip" + (live ? "" : " off"), title: live ? "In the prompt" : "Skipped (iPhone camera mode keeps one camera)" }, [t,
        h("button", { cls: "pml-dna-x", type: "button", "aria-label": "Remove " + t, text: "\u00d7", on: { click: function () { var a = focusDnaRaw(l).slice(); a.splice(i, 1); setList(a); } } })]));
    });
    var inp = h("input", { cls: "pml-in pml-dna-in", type: "text", placeholder: "+ add key (Enter)", "data-pm": "look-dna-add", "aria-label": "Add a focus DNA key", maxlength: "80",
      on: { keydown: function (e) { if (e.key !== "Enter") return; e.preventDefault(); var t = cleanDnaToken(e.target.value); if (!t) { e.target.value = ""; return; } var a = focusDnaRaw(l).slice(); if (a.length >= 8) { toast("Focus DNA", "8 keys max \u2014 drop one first"); return; } a.push(t); setList(a); } } });
    row.appendChild(inp);
    box.appendChild(row);
    if (dnaRich(l)) {
      var rot = dnaEntry(l).rotate || {}, ht = heatFor(l);
      box.appendChild(h("div", { cls: "pml-k", style: "margin-top:8px;letter-spacing:.08em;text-transform:none", "data-pm": "look-dna-rotate", text: "Zig's DNA \u00b7 rotates one per Remix (" + (HEAT_LABEL[ht] || ht) + "): " + Object.keys(rot).map(function (k) { var p = rot[k]; p = Array.isArray(p) ? p : (p[ht] || p.tease || []); return k + " \u2014 " + p.join(" / "); }).join(" \u00b7 ") + " \u00b7 adults 21+ only" }));
    }
    return box;
  }
  function showFocus() {
    var l = lookById(S.sel), el = R.focus; if (!l || !el) return;
    var chips = dnaChip(l, null, true);
    if (!chips.length) chips = ["rendered look", "adult 21+"];
    el.innerHTML = "";
    el.appendChild(h("span", { cls: "pml-k", style: "flex-basis:100%;margin-bottom:2px;color:#fde68a", text: "Focus \u00b7 " + ((STYLES.filter(function (c) { return c[0] === (S.style || "club"); })[0] || ["", "Club candid"])[1]) + (S.mash ? " \u00b7 mash-up" : "") }));
    var stc = stampOf(l); if (stc) chips = chips.concat(stc.chip);
    chips = focusDna(l).concat(chips);
    chips.forEach(function (c, i) { el.appendChild(h("span", { cls: "pml-focus-chip", style: "animation-delay:" + (i * 0.08) + "s", text: c })); });
    el.style.display = ""; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    clearTimeout(S._focusT); S._focusT = setTimeout(function () { if (R.focus) R.focus.style.display = "none"; }, 6000);
  }
  // ---- Talk to it (AI assistant bridge) -------------------------------------------------
  // ai-talk.js drives the machine ONLY through these functions. Every value is checked against
  // the real option lists; unknowns are ignored. The AI never writes prompt text: it picks
  // buttons + a short idea, and the prompt still comes from the machine's own banks.
  var AI_AGE_RE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|youngsters?|juveniles?|jail[\s-]?bait|baby[\s-]?fac\w*|babyface\w*|childlike|child\w*|kids?|little\s+girls?|girlish|petite[\s-]+young|school\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?|aged?\s*(?:1[0-9]|20|[1-9])|(?:18|19|20)\s*\+|21\s*\+|nsfw|sfw|adults?\s+only|under[\s-]?age\w*|minors?|barely[\s-]+legal)\b/gi;
  var AI_SFW_RE = /\b(?:nude|nudity|naked|topless|bottomless|nipples?|explicit|porn\w*|xxx|sex\w*|cum\w*|pussy|cock\w*|dick\w*|tits?|titties|boobs?|anal|blowjob\w*|bj|fuck\w*|horny|orgasm\w*|bdsm|fetish\w*|strip(?:per|pers|ping|tease)\w*|onlyfans|erotic\w*|lingerie|thong|g-string|spicy|tease|hardcore|raunchy|kinky|nsfw)\b/gi;
  var AI_LOOK_SKIP = /teen|seventeen|sis|famil|taboo|nubile|tiny|\blil|little|young|hentai|step|free-?use|school|pervz?|humper/i;
  function aiSafe(t, adult, max) {
    var x = stripBlocked(String(t || "")).text;
    x = x.replace(AI_AGE_RE, " ").replace(new RegExp(FRAMING_RE.source, "gi"), " ");
    x = x.replace(/\bgirls\b/gi, "women").replace(/\bgirl\b/gi, "woman").replace(/\bgals?\b/gi, "woman");
    if (!(adult == null ? isAdult() : adult)) x = x.replace(AI_SFW_RE, " ");
    x = sanitizeIdea(x).replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/^[\s,;.+-]+|[\s,;+-]+$/g, "");
    return x.slice(0, max || 160).replace(/[\s,;]+$/, "");
  }
  var AI_SWITCHES = [["cleanSkin", "Clean skin"], ["beauty", "Beauty"], ["fresh", "Fresh face"], ["crowd", "Crowd"], ["multitone", "Multi-tone"], ["twerk", "Twerk"], ["mash", "Mash-up"],
    ["anatomy", "Perfect Anatomy"], ["noAi", "No AI Look"], ["realPorn", "Real Porn Look (18+)"], ["antiGeneric", "Anti-Generic"], ["uniqueFaces", "Unique Faces"], ["artOn", "Art by influence"]];
  function aiLookOk(l) { return !!l && !hasBlocked(l.id + " " + l.label) && !AI_LOOK_SKIP.test(l.id + " " + l.label) && (!l.adult || isAdult()); }
  function aiOptions() {
    var adult = isAdult();
    return {
      mode: adult ? "18+" : "SFW",
      look: (S.looks || []).filter(aiLookOk).map(function (l) { return [l.id, displayLabel(l)]; }),
      style: STYLES.filter(function (c) { return !ADULT_STYLES[c[0]] || adult; }).map(function (c) { return [c[0], c[1]]; }),
      heat: adult ? HEATS.slice() : [],
      tab: [["mj", "Photo (Midjourney)"], ["video", "Video"]],
      cam: [["platform", "Platform camera"], ["iphone", "iPhone"]],
      people: [1, 2, 3, 4, 5, 6, 7, 8].slice(0, PEOPLE_MAX),
      castMix: [["women", "Women"], ["mixed", "Woman + man"]],
      neon: NEON_MODES.map(function (c) { return [c[0], c[1]]; }),
      neonPick: NEON_PALETTE.slice(),
      room: ROOM_MODES.map(function (c) { return [c[0], c[1]]; }),
      eye: EYES.map(function (c) { return [c[0], c[1]]; }),
      dnaW: DNA_W_LABEL.map(function (c) { return [c[0], c[1]]; }),
      psych: [""].concat(Object.keys(PSYCH)),
      switches: AI_SWITCHES.filter(function (c) { return c[0] !== "realPorn" || adult; })
    };
  }
  function aiCurrent() {
    var sw = {};
    AI_SWITCHES.forEach(function (c) { var k = c[0];
      sw[k] = k === "cleanSkin" ? cleanOn() : k === "anatomy" ? anatomyOn() : k === "noAi" ? noAiOn() : k === "realPorn" ? (isAdult() && realPornOn()) : k === "antiGeneric" ? agOn() : k === "uniqueFaces" ? uniqueOn() : S[k] === true; });
    return { look: S.sel || "", style: S.style || "none", heat: isAdult() ? S.heat : "", tab: S.tab, cam: S.cam, people: S.people, castMix: S.castMix, neon: neonMode(), neonPick: neonPick(),
      room: roomMode(), eye: eyeMode(), dnaW: dnaW(), psych: psychMood(), idea: S.idea || "", switches: sw };
  }
  function aiId(v, list) { // list of ids or [id,label]; case-insensitive id or label match
    if (v == null) return null; var t = String(v).trim().toLowerCase(); if (!t && t !== "") return null;
    for (var i = 0; i < list.length; i++) { var c = list[i], id = Array.isArray(c) ? c[0] : c, lb = Array.isArray(c) ? c[1] : c;
      if (String(id).toLowerCase() === t || String(lb).toLowerCase() === t) return id; }
    return null;
  }
  function aiApply(set) {
    set = set && typeof set === "object" ? set : {};
    var O = aiOptions(), ok = {}, bad = [], adult = isAdult(), v;
    if (set.look != null && set.look !== "") { v = aiId(set.look, O.look); if (v) { if (S.sel !== v) S.result = null; S.sel = v; ok.look = v; } else bad.push("look=" + set.look); }
    if (set.style != null) { v = aiId(set.style, O.style); if (v) { S.style = v; ok.style = v; } else bad.push("style=" + set.style); }
    if (set.heat != null && set.heat !== "") { v = adult ? aiId(set.heat, O.heat) : null; if (v) { S.heat = v; ok.heat = v; } else bad.push("heat=" + set.heat + (adult ? "" : " (SFW mode)")); }
    if (set.tab != null) { v = aiId(set.tab, O.tab); if (v) { S.tab = v; ok.tab = v; } else bad.push("tab=" + set.tab); }
    if (set.cam != null) { v = aiId(set.cam, O.cam); if (v) { S.cam = v; ok.cam = v; } else bad.push("cam=" + set.cam); }
    if (set.people != null) { v = parseInt(set.people, 10); if (v >= 1 && v <= PEOPLE_MAX) { S.people = v; S.groupScene = v > 1; ok.people = v; } else bad.push("people=" + set.people); }
    if (set.castMix != null) { v = aiId(set.castMix, O.castMix); if (v) { S.castMix = v; ok.castMix = v; } else bad.push("castMix=" + set.castMix); }
    if (set.neonPick != null && set.neonPick !== "") { v = aiId(set.neonPick, O.neonPick); if (v) { S.neonPick = v; S.neon = "pick"; ok.neonPick = v; ok.neon = "pick"; } else bad.push("neonPick=" + set.neonPick); }
    if (set.neon != null && !ok.neonPick) { v = aiId(set.neon, O.neon); if (v) { S.neon = v; ok.neon = v; } else bad.push("neon=" + set.neon); }
    if (set.room != null) { v = aiId(set.room, O.room); if (v) { S.room = v; ok.room = v; } else bad.push("room=" + set.room); }
    if (set.eye != null) { v = aiId(set.eye, O.eye); if (v) { S.eye = v; S.eyeSet = v !== "regular"; ok.eye = v; } else bad.push("eye=" + set.eye); }
    if (set.dnaW != null) { v = aiId(set.dnaW, O.dnaW); if (v) { S.dnaW = v; ok.dnaW = v; } else bad.push("dnaW=" + set.dnaW); }
    if (set.psych != null) { v = set.psych === "" ? "" : aiId(set.psych, O.psych); if (v != null) { S.psych = v; S.noir = false; ok.psych = v; } else bad.push("psych=" + set.psych); }
    var sw = set.switches && typeof set.switches === "object" ? set.switches : {};
    AI_SWITCHES.forEach(function (c) { var k = c[0], val = sw[k] != null ? sw[k] : set[k];
      if (val == null) return;
      if (typeof val !== "boolean") { bad.push(k + "=" + val); return; }
      if (k === "realPorn" && !adult) { bad.push("realPorn (SFW mode)"); return; }
      S[k] = val; ok[k] = val; });
    Object.keys(sw).forEach(function (k) { if (!AI_SWITCHES.some(function (c) { return c[0] === k; })) bad.push("switch " + k); });
    Object.keys(set).forEach(function (k) { if (["look", "style", "heat", "tab", "cam", "people", "castMix", "neon", "neonPick", "room", "eye", "dnaW", "psych", "switches"].indexOf(k) < 0 && !AI_SWITCHES.some(function (c) { return c[0] === k; })) bad.push(k); });
    // Gating, whatever the AI said: 18+ looks/styles/heat only in 18+ mode.
    var l = lookById(S.sel); if (l && l.adult && !adult) { S.sel = null; delete ok.look; }
    if (ADULT_STYLES[S.style] && !adult) S.style = "none";
    if (!adult) S.heat = "tease";
    save();
    if (S.el && S.looks) { renderGrid(); renderPanel(); }
    return { applied: ok, ignored: bad };
  }
  function aiMake(idea) {
    if (!S.looks) return null;
    var cur = lookById(S.sel); if (!cur || (cur.adult && !isAdult())) S.sel = null;
    if (!S.sel) { var d = (S.looks || []).filter(function (l) { return aiLookOk(l) && (isAdult() ? l.adult : !l.adult); })[0] || (S.looks || []).filter(aiLookOk)[0]; S.sel = d ? d.id : null; }
    if (!S.sel) return null;
    S.idea = aiSafe(idea); save();
    if (S.el) { renderGrid(); renderPanel(); if (R.idea) R.idea.value = S.idea; }
    doRemix();
    return S.result ? S.result.text : null;
  }
  // ---- My Words: the user's own words (localStorage), mixed in one at a time ----
  var MYW_KEY = "pm_mywords_v1", MYW_MIX = "pm_mywords_mix_v1";
  function myWords() { try { var a = JSON.parse(localStorage.getItem(MYW_KEY) || "[]"); return Array.isArray(a) ? a.filter(function (w) { return typeof w === "string" && w.trim(); }) : []; } catch (e) { return []; } }
  function myMixOn() { try { return localStorage.getItem(MYW_MIX) !== "0"; } catch (e) { return true; } }
  function myPick(text) {
    S._myUsed = ""; if (!myMixOn()) return "";
    var low = String(text || "").toLowerCase();
    var pool = myWords().map(function (w) { return aiSafe(w); }).filter(function (w) { return w && w.length >= 2 && low.indexOf(w.toLowerCase()) < 0; });
    if (!pool.length) return "";
    S._myUsed = pool[Math.floor(Math.random() * pool.length)]; return S._myUsed;
  }
  function myMixMJ(text) {
    var w = myPick(text); if (!w) return text;
    var m = text.match(/::[0-9.]+\s*$/);
    return m ? text.slice(0, m.index).replace(/[,\s]+$/, "") + ", " + w + m[0] : text.replace(/[,\s]+$/, "") + ", " + w;
  }
  function myMixVideo(text) {
    var w = myPick(text); if (!w) return text;
    return text.replace(/\s+$/, "") + " Detail: " + w + ".";
  }
  function setNotice(msg) { S.notice = msg || ""; if (R.note) { R.note.textContent = S.notice; R.note.style.display = S.notice ? "" : "none"; } }

  function doRemix() {
    var l = lookById(S.sel); if (!l) return;
    if (l.adult && !isAdult()) { setNotice("This look is 18+. Switch the machine to NSFW or XXX mode to use it."); return; }
    var raw = R.idea ? R.idea.value : S.idea;
    var cleaned = stripBlocked(raw);
    var idea = sanitizeIdea(cleaned.text).slice(0, 200);
    var msg = "";
    if (cleaned.removed.length) msg = "Adults 21+ only — removed: " + cleaned.removed.join(", ") + ".";
    var banned = reuseBannedMinor(idea);
    if (banned) { setNotice("Adults 21+ only. " + banned); return; }
    S.idea = idea; S._ideaNow = idea; if (R.idea) R.idea.value = idea;
    var heat = heatFor(l);
    mashRoll();
    var cast = rollCast(l), r = cast[0], seed = seed32(), body;
    S._noirUsed = "";
    if (S.tab === "video") body = assembleVideo(l, idea, cast, heat);
    else body = assembleMJ(l, idea, cast, seed, heat);
    var motion = motionFor(l, idea), bank = bankFor(l, seed, heat, S.tab, motion);
    var tags = tagsFor(l, heat, idea, r, cast.length);
    var keepTags = !!(S.result && S.result.withTags);
    S.result = { noirWord: noirOn() ? S._noirUsed || "" : "", body: body, params: withMotion(bankText(bank), S.tab, motion), motion: motion, withTags: keepTags, tab: S.tab, look: l.id, heat: heat, cam: S.cam, clean: cleanOn(), beauty: beautyOn(), style: S.style || "club", twerk: twerkOn(), fresh: freshOn(), crowd: crowdOn(), multitone: multiOn(), eye: eyeMode(), mash: S.mash === true, mashMix: mashLabel(), seed: seed, roll: r, people: cast.length, tags: tags };
    S.result.art = S._artUsed || null; if (S._artUsed) S.artLast = S._artUsed.credit; if (S._artUsed) S.result.params = artNo(S.result.params);
    S.result.text = compose(S.result);
    save();
    try { S.api.current.setPrompt(S.result.text); } catch (e) {}
    applyBank(bank);  // MJ settings panel shows the same params (both tabs)
    S.notice = msg;
    renderPanel();
    var who = cast.length > 1 ? cast.length + " adults" : r.skinTone + " " + r.heritageRegion;
    toast(S.tab === "video" ? "Video prompt remixed" : "Look remixed", displayLabel(l) + " \u00b7 " + (S.mash ? "Mash-up: " + mashLabel() : who) + " \u00b7 written to Prompt Output");
  }
  function toggleTags() {
    var res = S.result; if (!res || !res.body) return;
    res.withTags = !res.withTags; res.text = compose(res); save();
    try { S.api.current.setPrompt(res.text); } catch (e) {}
    renderPanel();
    toast(res.withTags ? "Tags added to prompt" : "Tags removed from prompt", res.withTags ? "Before the params, which stay last" : "");
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
    _assembleMJ: function (id, idea, group) { var l = lookById(id); S.groupScene = !!group; var r = roll(l), seed = seed32(); return assembleMJ(l, stripBlocked(idea).text, r, seed) + " " + bankText(bankFor(l, seed)); },
    _strip: stripBlocked,
    _load: fetchData,
    ai: { options: aiOptions, current: aiCurrent, apply: aiApply, make: aiMake, safe: aiSafe, isAdult: isAdult, myWordsKey: MYW_KEY, myMixKey: MYW_MIX,
      ready: function () { return !!S.looks; }, lastMyWord: function () { return S._myUsed || ""; } },
    iphoneModel: IPHONE_MODEL,
    // Shared building blocks reused by Cinema Looks (cinema-looks.js): same safety, camera, clean-skin, random and UI code.
    shared: {
      BLOCK_RE: BLOCK_RE, FRAMING_RE: FRAMING_RE, GEAR_RE: GEAR_RE, SKIN_MARK_RE: SKIN_MARK_RE,
      hasBlocked: hasBlocked, stripBlocked: stripBlocked, scrubList: scrubList, scrubProse: scrubProse,
      reuseBannedMinor: reuseBannedMinor, sanitizeIdea: sanitizeIdea,
      IPHONE_MODEL: IPHONE_MODEL, ARTIFACTS: ARTIFACTS,
      CLEAN_SKIN_STYLE: CLEAN_SKIN_STYLE, CLEAN_SKIN_NO: CLEAN_SKIN_NO, CLEAN_TOKEN: CLEAN_TOKEN,
      cleanPool: cleanPoolOn, cleanSkinText: cleanSkinTextOn, addCleanNo: addCleanNoOn,
      rnd: rnd, seed32: seed32, pick: pick, fill: fill, dedupe: dedupe,
      h: h, copyText: copyText, applyBank: applyBank, CSS: CSS
    },
    _run: function (id, idea, o) {
      o = o || {}; var l = lookById(id), keep = [S.heat, S.groupScene, S._forceAdult, S.cam, S.cleanSkin, S.people, S.castMix, S.beauty, S.style, S.twerk, S.mash, S.fresh, S.crowd, S.multitone, S.eye, S.noir, S.psych, S.anatomy, S.dnaW, S.noAi, S.realPorn, S.neon, S.neonPick, S.room, S.antiGeneric, S.uniqueFaces, S.eyeSet];
      S.heat = o.heat || "tease"; S.cam = o.cam === "iphone" ? "iphone" : "platform"; S.cleanSkin = o.clean == null ? S.cleanSkin : !!o.clean; S.beauty = o.beauty == null ? S.beauty : !!o.beauty; S.style = o.style || "club"; S.twerk = !!o.twerk; S.mash = !!o.mash; S.fresh = !!o.fresh; S.crowd = !!o.crowd; S.multitone = !!o.multitone; S.eye = o.eye || "regular"; S.noir = false; S.psych = o.psych || (o.noir ? "noir" : ""); S.anatomy = o.anatomy !== false; S.noAi = o.noAi !== false; S.realPorn = o.realPorn !== false; S.neon = o.neon || "rotate"; S.neonPick = o.neonPick || "hot pink"; S.room = o.room || "random"; S.antiGeneric = o.antiGeneric !== false; S.uniqueFaces = o.uniqueFaces !== false; S.eyeSet = !!o.eyeSet; S.dnaW = o.weight || "normal"; S._noirUsed = ""; var keepArt = [S.artOn, S.artCat]; S.artOn = !!o.art; S.artCat = o.artCat || "all"; mashRoll();
      S.people = Math.max(1, Math.min(PEOPLE_MAX, o.people || (o.group ? 2 : 1))); S.groupScene = S.people > 1; S.castMix = o.mix || "women"; S._forceAdult = o.adult == null ? null : !!o.adult;
      var i = sanitizeIdea(stripBlocked(idea).text); S._ideaNow = i; var heat = heatFor(l), cast = rollCast(l), seed = seed32(), tab = o.tab === "video" ? "video" : "mj";
      var body = tab === "video" ? assembleVideo(l, i, cast, heat) : assembleMJ(l, i, cast, seed, heat), mo = motionFor(l, i);
      var res = { body: body, params: withMotion(bankText(bankFor(l, seed, heat, tab, mo)), tab, mo), tags: tagsFor(l, heat, i, cast[0], cast.length), withTags: !!o.withTags }; if (S._artUsed) res.params = artNo(res.params);
      var out = compose(res);
      S.heat = keep[0]; S.groupScene = keep[1]; S._forceAdult = keep[2]; S.cam = keep[3]; S.cleanSkin = keep[4]; S.people = keep[5]; S.castMix = keep[6]; S.beauty = keep[7]; S.style = keep[8]; S.twerk = keep[9]; var mixL = mashLabel(); S.mash = keep[10]; S.fresh = keep[11]; S.crowd = keep[12]; S.multitone = keep[13]; S.eye = keep[14]; S.noir = keep[15]; S.psych = keep[16]; S.anatomy = keep[17]; S.dnaW = keep[18]; S.noAi = keep[19]; S.realPorn = keep[20]; S.neon = keep[21]; S.neonPick = keep[22]; S.room = keep[23]; S.antiGeneric = keep[24]; S.uniqueFaces = keep[25]; S.eyeSet = keep[26]; S._mashPrimary = null; S.artOn = keepArt[0]; S.artCat = keepArt[1];
      return o.full ? { faces: (S._cast || []).map(function (c) { return { sig: c._faceSig || "", eyes: c.eyes, micro: c.micro, heritage: c.heritageRegion, tone: c.skinTone, man: !!c.man }; }), details: (S._agUsed || []).slice(), neon: S._neonUsed || "brand", room: S._roomUsed || "", art: S._artUsed ? S._artUsed.credit : "", noirWord: S._noirUsed || "", text: out, tags: res.tags, params: res.params, mash: mixL, cast: cast.map(function (c) { return { tone: c.skinTone, region: c.heritageRegion, man: !!c.man, eyes: c.eyes }; }) } : out;
    }
  };
  window.addEventListener("pm:clear-all", onClearAll);
})();
