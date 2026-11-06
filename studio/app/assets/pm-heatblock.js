/* Dance / Twerk / Hip-Hop Heat Block (v20261106a)
 * One shared block that every prompt path (Builder, Remix, Platform Looks) appends when the prompt
 * is dance / twerk / hip-hop themed. Adult tiers (NSFW / XXX, or the Builder's 18+ toggle with the
 * age check) get the full heat wording; every other tier gets a toned-down, clothed version.
 * Hard limits always ride along: adult women 21+, one unique realistic face per subject, healthy
 * radiant skin + healthy teeth, no real people or celebrities, anatomically accurate.
 * NEVER inject "mixed ethnicities and body types" into a single image prompt (that makes image
 * models spawn clones or average every ethnicity into the same generic brown-skinned woman).
 * NEVER stack disposable-camera + harsh shadows + raw unretouched into a mugshot/crackhead look.
 * The user's own camera / style / lighting / body / cast picks always win over the defaults here.
 */
(function () {
  "use strict";
  var V = "20261106a";
  var DANCE_RE = /\b(twerk\w*|hip[\s-]?hop\w*|dance(?:s|rs?|hall)?|dancing|choreo\w*|perreo|reggaeton|krump\w*|booty[\s-]?(?:shak\w*|bounc\w*|pop\w*|clap\w*)|bounce[\s-]music|video[\s-]vixens?|tiktok[\s-]trends?|dance[\s-]?trends?|club[\s-]bounce|hip[\s-]roll\w*|body[\s-]roll\w*)\b/i;

  var ADULT = {
    subject: "one curvy voluptuous thick woman, heavy jiggle physics on ass and thighs, oiled sweaty skin, tiny shorts or sports bras riding up, looking back over shoulder into camera, provocative flirty but raw adult energy, not modest or family-friendly",
    subjectNoBody: "heavy jiggle physics on ass and thighs, oiled sweaty skin, tiny shorts or sports bras riding up, looking back over shoulder into camera, provocative flirty but raw adult energy, not modest or family-friendly",
    heat: "spicy, kinky, raunchy, physics-focused adult content",
    avoid: ["joyful group fitness", "modest clothing", "family-friendly", "overly polished", "static clean studio energy", "missing teeth", "bad teeth", "crooked teeth", "meth mouth", "gaunt hollow face", "strung-out look", "sunken eyes", "haggard", "extra people in background", "photobomber", "cloned faces", "multiple copies of same person", "background bystanders"]
  };
  var SAFE = {
    subject: "one curvy confident woman with real curves, natural bounce and movement in the dance, glowing healthy skin, fitted athletic shorts or crop tops and streetwear, looking back over shoulder into camera, bold flirty confident energy",
    subjectNoBody: "natural bounce and movement in the dance, glowing healthy skin, fitted athletic shorts or crop tops and streetwear, looking back over shoulder into camera, bold flirty confident energy",
    heat: "",
    avoid: ["joyful group fitness", "overly polished", "static clean studio energy", "missing teeth", "bad teeth", "gaunt hollow face", "strung-out look", "haggard", "extra people in background", "photobomber", "cloned faces", "multiple copies of same person", "background bystanders"]
  };
  // Beauty-safe candid camera: real-camera heat WITHOUT disposable-camera mugshot / harsh-shadow crackhead triggers.
  var CAMERA = "photorealistic, direct flash photography or golden hour, soft natural film grain, candid, authentic real-camera look, healthy radiant skin with natural texture";
  var CAMERA_NO_LIGHT = "photorealistic, soft natural film grain, candid, authentic real-camera look, healthy radiant skin with natural texture";
  // Singular face + beauty anchors. NO "mixed ethnicities and body types" (causes clones / same brown girl).
  var LIMITS_W = "one adult woman 21+, one unique realistic face, gorgeous and photogenic, healthy radiant skin, bright clear eyes, healthy straight natural white teeth when smiling, no real people or celebrities, anatomically accurate, single solo woman, one woman only, no extra people in background, no background bystanders, no duplicate or cloned women";
  var LIMITS_A = "all subjects adults 21+, each with one unique realistic face, gorgeous and photogenic, healthy radiant skin, healthy straight natural white teeth when smiling, no real people or celebrities, anatomically accurate, no duplicate or cloned faces, no extra bystanders";
  var LIMITS_W_GROUP = "all subjects adult women 21+, each with one unique realistic face, gorgeous and photogenic, healthy radiant skin, healthy straight natural white teeth when smiling, no real people or celebrities, anatomically accurate, no duplicate or cloned faces";
  var MARK = "looking back over shoulder into camera";

  function detect() { for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; if (a != null && DANCE_RE.test(String(a))) return true; } return false; }
  function ctxAdult() { try { return !!(window.PMCtx && window.PMCtx.read().adult); } catch (e) { return false; } }

  // o: { adult, camPicked, lightPicked, bodyPicked, men, people }
  function blocks(o) {
    o = o || {};
    var P = o.adult ? ADULT : SAFE;
    var n = parseInt(o.people, 10) || 1;
    var limits;
    if (o.men) limits = LIMITS_A;
    else if (n > 1) limits = LIMITS_W_GROUP;
    else limits = LIMITS_W;
    return {
      adult: !!o.adult,
      subject: o.bodyPicked ? P.subjectNoBody : P.subject,
      heat: P.heat,
      camera: o.camPicked ? "" : (o.lightPicked ? CAMERA_NO_LIGHT : CAMERA),
      limits: limits,
      avoid: P.avoid.slice()
    };
  }
  function adds(b) { return [b.subject, b.heat, b.camera, b.limits].filter(Boolean); }
  function has(text, phrase) { return String(text).toLowerCase().indexOf(String(phrase).toLowerCase()) >= 0; }
  function addNo(list, terms) {
    var have = String(list || "").toLowerCase();
    return terms.filter(function (x) { return have.indexOf(x.toLowerCase()) < 0; });
  }

  // String-level apply (Remix results, Platform Looks). Idempotent; MJ --params stay last.
  // o: blocks() options plus { force, idea, extra }
  function apply(prompt, o) {
    o = o || {};
    var s = String(prompt || "");
    if (!o.force && !detect(s, o.idea, o.extra)) return s;
    if (has(s, MARK)) return s;   // already applied
    var b = blocks(o), k = s.search(/\s--(?:ar|v|no|stylize|chaos|seed|style|q|quality|weird|motion|niji|iw|repeat|tile|raw|s)\b/), body = k >= 0 ? s.slice(0, k) : s, params = k >= 0 ? s.slice(k) : "";
    var add = adds(b).filter(function (x) { return !has(body, x); });
    var prose = /\.\s*$/.test(body.trim()) && /\.\s+[A-Z]/.test(body);
    body = body.replace(/[\s,]+$/, "");
    if (prose) body = body + " Dance heat: " + add.join("; ") + ".";
    else body = body + (body ? ", " : "") + add.join(", ");
    var neg = b.avoid;
    if (/(^|\s)--no\s/.test(params)) {
      var nn = addNo(params.slice(params.search(/(^|\s)--no\s/)), neg);
      if (nn.length) params = params.replace(/[\s,]+$/, "") + ", " + nn.join(", ");
    } else {
      var nb = addNo(body, neg);
      if (nb.length) body += prose ? " Avoid: " + nb.join(", ") + "." : ", avoid: " + nb.join(", ");
    }
    return (body + (params ? " " + params.trim() : "")).replace(/\s{2,}/g, " ").trim();
  }

  // Builder (character builder useMemo): returns null for non-dance prompts, else the parts to push.
  function forBuilder(t, text) {
    t = t || {};
    if (t.pmLookPrompt) return null;   // Platform Looks already applied the block
    if (!detect(text, t.danceStyle, t.danceRegion)) return null;
    var lp = t.lighting || (Array.isArray(t.nsfwLighting) && t.nsfwLighting.length);
    var b = blocks({
      adult: (!!t.nsfwEnabled && !!t.ageConfirmed) || ctxAdult(),
      camPicked: !!(t.lens || t.filmStock || t.medium || t.styleTag || t.renderEngine || (t.artistRefs && t.artistRefs.length)),
      lightPicked: !!lp,
      bodyPicked: !!(t.bodyType || t.build),
      men: t.gender === "male",
      people: 1
    });
    b.add = adds(b).filter(function (x) { return !has(text, x); });
    return b;
  }

  window.PMHeatBlock = { version: V, DANCE_RE: DANCE_RE, detect: detect, blocks: blocks, apply: apply, forBuilder: forBuilder, ctxAdult: ctxAdult, CAMERA: CAMERA };
})();
