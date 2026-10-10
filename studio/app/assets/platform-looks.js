/* Zig Flames Prompt Machine — PLATFORM LOOKS (in-browser, no backend).
 * Data: ./assets/data/looks.json + ./assets/data/variety.json
 * Safety (in code): every prompt includes "adult 21+"; blocklisted words are stripped
 * from the idea box (with a notice) and from every assembled prompt. Params always last.
 */
(function () {
  "use strict";
  var V = "20261010b";
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
  function camKind(look) { return S.cam === "iphone" ? "phone" : gearOf(look).kind; }
  function camLine(look, tab) {
    if (S.cam === "iphone") {
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
  function cleanSkinText(text) { return cleanSkinTextOn(text, cleanOn()); }
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
    nose: ["delicate straight nose", "small refined nose", "softly upturned nose", "elegant narrow nose", "cute button nose", "elegant broad nose with a soft rounded tip"],
    lips: ["full plump lips", "glossy pouty lips", "heart-shaped lips", "defined cupid's bow", "full lower lip", "full lips with a dimpled smile"],
    jawCheekbones: ["high sharp cheekbones", "sculpted cheekbones and a tapered chin", "defined jawline", "V-shaped jaw and lifted cheekbones", "chiseled cheekbones"],
    complexionDetail: ["radiant glowing skin", "dewy luminous skin", "sun-kissed glow", "satin-smooth skin with a soft highlight", "natural skin texture with a healthy glow"],
    distinctiveFeature: ["tiny beauty mark above the lip", "deep dimples", "elegant collarbones", "striking smile", "long fluttery lashes", "hourglass waist", "toned midriff", "flirty knowing smile"],
    build: ["curvy hourglass figure", "slim toned figure", "athletic toned body", "thick thighs and a snatched waist", "slim-thick figure", "voluptuous hourglass curves", "long-legged slender figure", "fit body with toned abs", "busty hourglass figure", "sculpted fitness-model body"],
    heightFeel: ["tall", "long-legged", "statuesque", "model height", "towering in heels", "petite and perfectly proportioned"],
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
    if (!beautyOn()) return text;
    var out = String(text || "").split(/,\s*/).filter(function (f) { return f && !/peach fuzz|uneven tone|real body weight|not beauty lighting|amateur framing|imperfect exposure|dirty sensor spots|slight motion blur|ordinary mixed available light/i.test(f); });
    out.push(BEAUTY_REAL);
    return out.join(", ");
  }
  function addBeautyNo(no) {
    if (!beautyOn()) return no;
    return no ? no.replace(/[,\s]+$/, "") + ", " + BEAUTY_NO : "--no " + BEAUTY_NO;
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
  var ORD = ["", "first", "second", "third", "fourth"];

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
    var ctx = ideaCtx(idea), ideaT = [], spicyT = [];
    ctx.forEach(function (c) { ideaT = ideaT.concat(c.tags.safe || []); spicyT = spicyT.concat(c.tags.spicy || []); });
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
  var S = { looks: null, variety: null, loading: null, el: null, api: null, q: "", group: "All", sel: null, idea: "", groupScene: false, people: 1, castMix: "women", tab: "mj", heat: "tease", cam: "platform", cleanSkin: true, beauty: false, result: null, last: {}, notice: "", _forceAdult: null, examples: null };
  function load() {
    try { var j = JSON.parse(localStorage.getItem(STORE) || "{}"); ["group", "sel", "idea", "groupScene", "people", "castMix", "tab", "heat", "cam", "cleanSkin", "beauty", "result"].forEach(function (k) { if (j[k] !== undefined) S[k] = j[k]; });
      if (j.people === undefined && j.groupScene) S.people = 2;
      S.people = Math.max(1, Math.min(4, parseInt(S.people, 10) || 1)); S.groupScene = S.people > 1; } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ group: S.group, sel: S.sel, idea: S.idea, groupScene: S.groupScene, people: S.people, castMix: S.castMix, tab: S.tab, heat: S.heat, cam: S.cam, cleanSkin: S.cleanSkin !== false, beauty: S.beauty === true, result: S.result })); } catch (e) {}
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
    ]).then(function (a) { S.looks = a[0]; S.variety = a[1]; });
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
    Object.keys(r).forEach(function (k) { remember(k, r[k]); });
    if (r.tattoosPiercings === "none") r.tattoosPiercings = "no tattoos or piercings";
    S.last = r;
    return r;
  }
  function realism(look, heat) {
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
    var g = garmentsOf(idea);
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
  // ---- Cast: 1-4 distinct adults (each with their own face, hair, wardrobe roll) ---------------------
  function rollCast(look) {
    var n = Math.max(1, Math.min(4, parseInt(S.people, 10) || 1)), cast = [];
    for (var i = 0; i < n; i++) {
      var r = roll(look), man = S.castMix === "mixed" && i % 2 === 1;
      if (man) { r.man = true; r.mHair = pick(MALE.hair, HIST.mHair); r.mFace = pick(MALE.face, HIST.mFace); r.mBuild = pick(MALE.build, HIST.mBuild);
        if (r.beauty) { r.mFace = "handsome chiseled face, " + r.mFace; r.mBuild = r.mBuild.replace(/^(\w)/, "ripped $1"); r.beauty = "";
          r.faceShape = pick(["square-jawed face", "strong angular face", "chiseled oval face"]); r.eyes = pick(["intense dark eyes", "piercing hazel eyes", "deep brown eyes", "steel-blue eyes"]);
          r.brows = "thick straight brows"; r.nose = pick(["strong straight nose", "classic straight nose", "broad strong nose"]); r.lips = "full defined lips";
          r.jawCheekbones = "sharp jawline"; r.complexionDetail = "healthy glowing skin"; r.distinctiveFeature = "confident smile"; r.heightFeel = pick(["tall", "6'2\" tall", "tall and broad"]); }
        ["mHair", "mFace", "mBuild"].forEach(function (k) { remember(k, r[k]); }); }
      cast.push(r);
    }
    S.last = cast[0];
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
  function bodyOf(V2, r) { return (r.beauty ? r.beauty + ", " : "") + fill(V2.body, r); }
  function castLabel(r, i, n) { return n === 1 ? "" : ORD[i + 1] + " " + (r.man ? "man" : "woman"); }
  // Beats: idea beats first; the look's generic setup / dialogue beats are dropped when an idea is typed; shuffled for variety.
  function beatsFor(look, idea, n) {
    var ctx = ideaCtx(idea), ib = [];
    ctx.forEach(function (c) { ib = ib.concat(c.beats); });
    var lb = (look.shotList || []).filter(function (b) { return b && !FRAMING_RE.test(b) && !hasBlocked(b) && !(idea && SETUP_RE.test(b)); });
    var out = [], a = ib.slice(), b = lb.slice();
    while (out.length < n && (a.length || b.length)) {
      var src = a.length && (out.length < 2 || !b.length) ? a : b;
      out.push(src.splice(Math.floor(rnd() * src.length), 1)[0]);
    }
    return out;
  }
  function motionFor(look, idea) {
    var c = ideaCtx(idea).filter(function (x) { return x.motion === "high"; });
    return c.length ? "high" : ((look.mj && look.mj.motion) === "high" ? "high" : "low");
  }

  function assembleMJ(look, idea, r, seed, heat) {
    heat = heat || "tease";
    var V2 = S.variety.slotTemplates;
    var cast = Array.isArray(r) ? r : [r]; r = cast[0];
    var w = wardrobeFor(idea, heat, r);
    var heritage = fill(V2.heritageFace, r), bodyTxt = bodyOf(V2, r);
    var styling = [w.text, r.makeupLevel, r.nails, r.tattoosPiercings, cleanOn() ? CLEAN_TOKEN : ""].filter(Boolean).join(", ");
    if (cast.length > 1) {
      heritage = cast.map(function (p, i) { return castLabel(p, i, cast.length) + ": " + personText(V2, p, heat, idea, i, false).replace(/,\s*/g, " / "); }).join(", ");
      bodyTxt = ""; styling = cleanOn() ? CLEAN_TOKEN : "";
    }
    var beat = beatsFor(look, idea, 1)[0] || "", ex = examplePhrase(look, idea);
    var head = headOf(look, w.fromIdea || heat !== "tease", heat), real = realism(look, heat);
    head = camScrubList(head, look, "mj"); real = camScrubList(real, look, "mj");  // only one camera in the prompt
    var parts = [
      cast.length > 1 ? cast.length + " distinct adults 21+ together in one frame" : "",
      beat,                                   // one idea-matched beat (generic setup beats dropped)
      ex,                                     // a phrase from Zig's liked examples, if any
      pick(HEAT_LEADS[heat] || [HEAT[heat].lead]),  // heat wording (Tease / Spicy / XXX), varied per roll
      camLine(look, "mj"),                    // camera: platform gear or iPhone
      head,                                   // mjPrompt without {idea}
      fill(V2.venue, r),                      // venue
      heritage,                               // heritage/skin + unique face + face picks
      bodyTxt,                                // hair + build + heightFeel + ageBand (single person)
      styling,                                // wardrobe (idea first) + makeup + nails + tattoos
      "adult 21+",                            // always, in code
      real,                                   // realismBlock
      ARTIFACTS[camKind(look)] || ""          // real-capture artifacts for that camera
    ];
    var body = dedupe(scrubFraming(scrubList(parts.filter(Boolean).join(", ").replace(/\s+/g, " ").replace(/,\s*,/g, ","))));
    if (cast.length > 1) body = body.replace(/ \/ /g, ", ");
    body = body.split(CLEAN_TOKEN).join(CLEAN_SKIN_STYLE);
    if (!/adult 21\+/.test(body)) body += ", adult 21+";
    // Idea first and weighted (MJ multi-prompt ::2), then the rest of the prompt.
    var lead = idea ? idea + "::2 " : "";
    return lead + body;  // params are added by compose(), always last
  }
  function assembleVideo(look, idea, r, heat) {
    heat = heat || "tease";
    var V2 = S.variety.slotTemplates;
    var cast = Array.isArray(r) ? r : [r]; r = cast[0];
    var w = wardrobeFor(idea, heat, r);
    // Scrub only the look's own text; the idea is added afterwards so no filter can ever drop it.
    var rest = String(look.promptTemplate || "").replace(/^\{idea\}\s*[\u2014-]\s*/, "").replace(/\{idea\}/g, "");
    var k = rest.indexOf(". "), first = k > 0 ? rest.slice(0, k) : rest, after = k > 0 ? rest.slice(k + 2) : "";
    first = camScrubProse(first + ".", look).replace(/\.\s*$/, "");
    if (FRAMING_RE.test(first) || (heat !== "tease" && CLEAN_RE.test(first))) first = "";
    if (idea) first = first.replace(/\bscripted\s+/gi, "");
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
    var i = t.indexOf(". ");
    var cl = camLine(look, "video"), art = ARTIFACTS[camKind(look)] || "";
    var heatLine = pick(HEAT_VIDEO[heat] || [HEAT[heat].video]) + (cl ? " Camera: " + cl + (art ? "; " + art : "") + "." : "");
    t = i > 0 ? t.slice(0, i + 1) + " " + heatLine + t.slice(i + 1) : heatLine + " " + t;
    var styling = [w.text, r.makeupLevel, r.nails, r.tattoosPiercings, cleanOn() ? CLEAN_TOKEN : ""].filter(Boolean).join(", ");
    var lead, stylingTxt;
    if (cast.length > 1) {
      lead = "Cast (" + cast.length + " distinct adults 21+, each with a unique face): " + cast.map(function (p, i) { return castLabel(p, i, cast.length).replace(/^./, function (c) { return c.toUpperCase(); }) + " \u2014 " + personText(V2, p, heat, idea, i, true); }).join(". ") + ".";
      stylingTxt = cleanOn() ? " Skin: " + CLEAN_TOKEN + "." : "";
    } else {
      lead = (S.groupScene ? "Group scene; lead woman: " : "One woman per frame: ") + fill(V2.heritageFace, r) + "; " + bodyOf(V2, r) + ".";
      stylingTxt = " Styling: " + styling + ".";
    }
    var ex = examplePhrase(look, idea);
    var out = t + (ex ? " Style note: " + ex + "." : "") + " Setting: " + fill(V2.venue, r) + ". " + lead + stylingTxt + " " +
      "Aspect " + look.aspect + ", clip length " + look.clipLength + ", motion " + motionFor(look, idea) + ". adult 21+.";
    out = scrubProse(out).split(CLEAN_TOKEN).join(CLEAN_SKIN_STYLE);
    if (!/adult 21\+/.test(out)) out += " adult 21+.";
    return out;
  }
  function bankFor(look, seed, heat, tab, motion) {
    var mj = look.mj || {}, no = "";
    var m = String(mj.suffix || "").match(/--no\s+(.*)$/i); if (m) no = "--no " + scrubList(m[1]);
    if (cleanOn()) no = no ? no.replace(/[,\s]+$/, "") + ", " + CLEAN_SKIN_NO : "--no " + CLEAN_SKIN_NO;
    no = addBeautyNo(no);
    var ch = mj.chaos != null ? Number(mj.chaos) : null;
    if (ch != null && heat && heat !== "tease") ch = Math.min(40, ch + 10);   // a little more variety on Spicy / XXX
    if (ch != null && S.people > 1) ch = Math.min(45, ch + 5);
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
    ".pml-ppl{min-width:44px}.pml-ppl.on,.pml-mix.on,.pml-addtags.on{border-color:var(--acc);color:#fff;background:rgba(125,211,252,.14)}.pml-addtags{border-color:#fb923c;color:#fdba74}" +
    ".pml-heat{min-width:72px}.pml-heat[disabled]{opacity:.35;cursor:not-allowed}.pml-heat-tease.on{border-color:#f9a8d4;color:#fff;background:rgba(244,114,182,.14)}.pml-heat-spicy.on{border-color:#fb923c;color:#fff;background:rgba(251,146,60,.16)}.pml-heat-xxx.on{border-color:#ef4444;color:#fff;background:rgba(239,68,68,.18)}" +
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
    P.appendChild(h("div", { cls: "pml-row", style: "margin-top:12px" }, [R.idea]));
    // People: 1-4 distinct adults per prompt (each rolls its own face, hair and outfit).
    var pr = h("div", { cls: "pml-row", style: "margin-top:10px", "data-pm": "look-people", role: "radiogroup", "aria-label": "People in the prompt" }, [h("span", { cls: "pml-k", text: "People" })]);
    [1, 2, 3, 4].forEach(function (n) {
      pr.appendChild(h("button", { cls: "pml-btn pml-ppl" + (S.people === n ? " on" : ""), type: "button", role: "radio", "aria-checked": S.people === n ? "true" : "false", "data-people": String(n), text: String(n),
        title: n === 1 ? "One adult" : n + " distinct adults 21+", on: { click: function () { S.people = n; S.groupScene = n > 1; save(); renderPanel(); } } }));
    });
    if (S.people > 1) {
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
    var g = gearOf(l), gl = camLine(l, S.tab) || "rendered look \u00b7 virtual camera";
    P.appendChild(h("div", { cls: "pml-gear", "data-pm": "look-gear" }, [gl, S.cam === "iphone" ? null : h("span", { cls: "pml-conf pml-conf-" + g.confidence, title: g.basis || "", text: g.confidence })]));
    R.note = h("div", { cls: "pml-note", "data-pm": "look-notice", style: S.notice ? "" : "display:none", text: S.notice });
    P.appendChild(R.note);
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
    S.idea = idea; if (R.idea) R.idea.value = idea;
    var heat = heatFor(l);
    var cast = rollCast(l), r = cast[0], seed = seed32(), body;
    if (S.tab === "video") body = assembleVideo(l, idea, cast, heat);
    else body = assembleMJ(l, idea, cast, seed, heat);
    var motion = motionFor(l, idea), bank = bankFor(l, seed, heat, S.tab, motion);
    var tags = tagsFor(l, heat, idea, r, cast.length);
    var keepTags = !!(S.result && S.result.withTags);
    S.result = { body: body, params: withMotion(bankText(bank), S.tab, motion), motion: motion, withTags: keepTags, tab: S.tab, look: l.id, heat: heat, cam: S.cam, clean: cleanOn(), beauty: beautyOn(), seed: seed, roll: r, people: cast.length, tags: tags };
    S.result.text = compose(S.result);
    save();
    try { S.api.current.setPrompt(S.result.text); } catch (e) {}
    applyBank(bank);  // MJ settings panel shows the same params (both tabs)
    S.notice = msg;
    renderPanel();
    var who = cast.length > 1 ? cast.length + " adults" : r.skinTone + " " + r.heritageRegion;
    toast(S.tab === "video" ? "Video prompt remixed" : "Look remixed", displayLabel(l) + " \u00b7 " + who + " \u00b7 written to Prompt Output");
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
      o = o || {}; var l = lookById(id), keep = [S.heat, S.groupScene, S._forceAdult, S.cam, S.cleanSkin, S.people, S.castMix, S.beauty];
      S.heat = o.heat || "tease"; S.cam = o.cam === "iphone" ? "iphone" : "platform"; S.cleanSkin = o.clean == null ? S.cleanSkin : !!o.clean; S.beauty = o.beauty == null ? S.beauty : !!o.beauty;
      S.people = o.people || (o.group ? 2 : 1); S.groupScene = S.people > 1; S.castMix = o.mix || "women"; S._forceAdult = o.adult == null ? null : !!o.adult;
      var i = sanitizeIdea(stripBlocked(idea).text), heat = heatFor(l), cast = rollCast(l), seed = seed32(), tab = o.tab === "video" ? "video" : "mj";
      var body = tab === "video" ? assembleVideo(l, i, cast, heat) : assembleMJ(l, i, cast, seed, heat), mo = motionFor(l, i);
      var res = { body: body, params: withMotion(bankText(bankFor(l, seed, heat, tab, mo)), tab, mo), tags: tagsFor(l, heat, i, cast[0], cast.length), withTags: !!o.withTags };
      var out = compose(res);
      S.heat = keep[0]; S.groupScene = keep[1]; S._forceAdult = keep[2]; S.cam = keep[3]; S.cleanSkin = keep[4]; S.people = keep[5]; S.castMix = keep[6]; S.beauty = keep[7];
      return o.full ? { text: out, tags: res.tags, params: res.params } : out;
    }
  };
  window.addEventListener("pm:clear-all", onClearAll);
})();
