/* Zig's Prompt Machine — ✨ AI Tighten (v20261023c)
   window.PMTighten.run({prompt, negative, mode}) -> Promise<{prompt, negative, notes[], usage, source:"ai"|"local"}>
   Calls the zigflames-ai worker (action "tighten"); every AI result is re-checked here
   (params kept verbatim and last, ::weights valid, adult 21+ kept, no age/family words, never longer).
   If the AI is unavailable it falls back to a free local tighten. Never throws. */
(function () {
  "use strict";
  var AI_ENDPOINT = "https://zigflames-ai.zigflames.workers.dev";
  function endpoint() {
    try { var o = localStorage.getItem("pm_ai_endpoint"); if (o) return o; } catch (e) {}
    return window.PM_AI_ENDPOINT || AI_ENDPOINT;
  }
  // ---- tighten core (same code in ai-worker/worker.js and studio/app/assets/ai-tighten.js) ----
  var TG_AGE = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|childlike|child\w*|kids?|little\s+girls?|girlish|school\w*|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|(?:1[0-9]|20|[1-9])\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?)\b/gi;
  var TG_FAMILY = /\b(?:step\w*|famil(?:y|ies)|sisters?|brothers?|moms?|mommy|dads?|daddy|daughters?|sons?|cousins?|taboo|free[\s-]?use|non[\s-]?consen\w*|forced|sleeping|asleep|unconscious|drunk|hidden[\s-]?cam\w*)\b/gi;
  var TG_NUMAGE = /\b(?:aged?\s+)?\d{1,3}\s*\+?\s*(?:-|\s)?(?:yo|y\/o|yrs?|years?)(?:[\s-]*old)?\b|\baged?\s+\d{1,3}\+?/gi;
  var TG_EXPL = /\b(?:nude|nudity|naked|topless|bottomless|nipples?|explicit|porn\w*|xxx|sex\w*|pussy|cock\w*|dick\w*|tits?|boobs?|anal|fuck\w*|horny|orgasm\w*|fetish\w*|erotic\w*|lingerie|thong|spicy|hardcore|nsfw|uncensored|cum\w*|penetrat\w*|blowjob\w*|bdsm|genital\w*)\b/gi;
  var TG_FILLER = /\b(?:masterpiece|best[\s-]+quality|top[\s-]+quality|octane[\s-]+render|unreal[\s-]+engine(?:\s*\d)?|hyper[\s-]?detailed|8k(?:\s+uhd)?)\b/gi;
  var TG_CGI = /\b(?:cartoon\w*|anime|cgi|3d\s+render\w*|pixar|illustrat\w*|cel[\s-]shad\w*|video\s+game|claymation|toon)\b/i;
  function tgSplitParams(s) {
    s = String(s || "");
    var m = /(^|\s)--[a-z]/i.exec(s);
    if (!m) return { body: s.trim(), tail: "" };
    var i = m.index + m[1].length;
    return { body: s.slice(0, i).replace(/[\s,]+$/, ""), tail: s.slice(i).trim() };
  }
  function tgSegs(body) { // Midjourney multi-prompt: "text::2 text::1.5 text"
    var re = /::(-?\d*\.?\d+)?\s*/g, out = [], last = 0, m;
    while ((m = re.exec(body))) { out.push({ text: body.slice(last, m.index).trim(), w: m[1] || "" }); last = re.lastIndex; }
    out.push({ text: body.slice(last).trim(), w: null });
    return out;
  }
  function tgJoin(segs) { return segs.map(function (s) { return s.w === null ? s.text : s.text + "::" + s.w; }).join(" ").trim(); }
  function tgWeights(body) { var a = [], re = /::(-?\d*\.?\d+)?/g, m; while ((m = re.exec(body))) a.push(m[1] || ""); return a; }
  function tgPosAvoid(t) { var i = String(t).search(/\bavoid\s*:/i); return i < 0 ? [String(t), ""] : [String(t).slice(0, i), String(t).slice(i)]; }
  function tgTidy(t) {
    return String(t || "").replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*){2,}/g, ", ").replace(/\s{2,}/g, " ")
      .replace(/^[\s,;]+/, "").replace(/[\s,;]+$/, "").replace(/\bavoid\s*:\s*,\s*/gi, "avoid: ").replace(/,\s*avoid\s*:\s*$/i, "").trim();
  }
  function tgNotIn(re, t, origLow) { // drop matches of re that the original text did not already contain
    return String(t).replace(re, function (m) { return origLow.indexOf(m.toLowerCase()) >= 0 ? m : " "; });
  }
  function tgScrubText(t, origLow) {
    var pa = tgPosAvoid(t), pos = pa[0], av = pa[1];
    pos = pos.replace(TG_AGE, " ").replace(TG_FAMILY, " ");                 // never in the positive prompt
    av = tgNotIn(TG_FAMILY, tgNotIn(TG_AGE, av, origLow), origLow);         // avoid list: keep protective words already there, add none
    var x = pos + av;
    x = tgNotIn(TG_NUMAGE, x, origLow);                                      // no new ages
    x = tgNotIn(TG_EXPL, x, origLow);                                        // never more explicit than the input (SFW: nothing explicit)
    return tgTidy(x);
  }
  function tgHas21(t) { return /\b21\s*\+/.test(String(t)); }
  // Validate a candidate body against the original prompt. Params are always the original tail, verbatim, last.
  function tgFinalize(orig, candBody) {
    var o = tgSplitParams(orig), notes = [];
    var cp = tgSplitParams(candBody);
    if (cp.tail) notes.push("Ignored params the AI wrote; kept yours.");
    var c = cp.body;
    if (tgWeights(o.body).join("|") !== tgWeights(c).join("|")) return { ok: false, why: "::weights changed" };
    var low = String(orig).toLowerCase();
    var segs = tgSegs(c).map(function (s) { return { text: tgScrubText(s.text, low), w: s.w }; });
    if (segs.some(function (s, i) { return !s.text && (s.w !== null || i === 0); })) return { ok: false, why: "empty segment" };
    if (tgHas21(o.body + " " + o.tail) && !tgHas21(tgJoin(segs))) {
      var L = segs[segs.length - 1]; L.text = L.text ? L.text + ", adult 21+" : "adult 21+"; notes.push("Kept the adult 21+ tag.");
    }
    var body = tgJoin(segs);
    if (!body) return { ok: false, why: "empty" };
    var out = body + (o.tail ? " " + o.tail : "");
    if (out.length > Math.ceil(String(orig).length * 1.1) + 4) return { ok: false, why: "came back longer" };
    return { ok: true, prompt: out, notes: notes };
  }
  // Contradictions: when the prompt asks for raw/real skin or real light, drop the polished alternative.
  var TG_RAWSKIN = /\b(?:pores|unretouched|imperfections|peach fuzz|natural skin texture|raw skin|skin texture)\b/i;
  var TG_POLISH = /\b(?:flawless|airbrush\w*|poreless|porcelain|even[\s-]toned|uniform complexion|glass skin|beauty[\s-]filter\w*|retouched|smooth skin|perfect skin)\b/i;
  var TG_REALLIGHT = /\b(?:ordinary|natural|available|practical|window|mixed)\s+(?:\w+\s+)?(?:light|lighting)\b/i;
  var TG_STUDIOLIGHT = /\b(?:studio\s+(?:light\w*|softbox\w*)|beauty\s+(?:dish|lighting)|perfect\s+lighting|flawless\s+lighting)\b/i;
  var TG_FRAG = /^(?:clear|smooth|even[\s-]toned|flawless|glowing|perfect|radiant|polished)$/i;
  function tgNegated(p) { return /^\s*(?:not?|without|zero|avoid)\b/i.test(p); }
  function tgContra(allPos) {
    var raw = TG_RAWSKIN.test(allPos), real = TG_REALLIGHT.test(allPos);
    return function (p) { if (tgNegated(p)) return false; return (raw && TG_POLISH.test(p)) || (real && TG_STUDIOLIGHT.test(p)); };
  }
  function tgIs21(p) { return /\b21\s*\+/.test(p); }
  function tgContained(k, list) { for (var i = 0; i < list.length; i++) { if (list[i] === k || (" " + list[i] + " ").indexOf(" " + k + " ") >= 0) return true; } return false; }
  function tgNorm(p) { return String(p || "").toLowerCase().replace(/[’]/g, "'").replace(/^\s*(?:a|an|the)\s+/, "").replace(/[^a-z0-9+' ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function tgCgi(body) { return tgSegs(body).some(function (s) { return TG_CGI.test(tgPosAvoid(s.text)[0]); }); }
  // Free local tighten: dedupe comma phrases (case-insensitive, also phrases already inside a kept phrase),
  // drop generic AI filler unless it's a CGI/cartoon prompt, params stay last.
  function tgLocal(prompt, negative) {
    var o = tgSplitParams(prompt), cgi = tgCgi(o.body), segs = tgSegs(o.body), prevKept = [], removed = [];
    var contra = tgContra(segs.map(function (s) { return tgPosAvoid(s.text)[0]; }).join(", "));
    segs.forEach(function (s, si) {
      var pa = tgPosAvoid(s.text), kept = [], isTail = s.w === null && segs.length > 1;
      var parts = pa[0].split(/\s*,\s*/);
      parts.forEach(function (p, pi) {
        var raw = p.trim(); if (!raw) return;
        if (!cgi) { var nf = tgTidy(raw.replace(TG_FILLER, " ")); if (nf !== raw) { removed.push(raw); if (!nf) return; raw = nf; } }
        if (contra(raw) || (TG_FRAG.test(raw) && parts[pi + 1] && contra(parts[pi + 1].trim()))) { removed.push(raw); return; }
        var k = tgNorm(raw); if (!k) return;
        var keptK = kept.map(tgNorm);
        if (keptK.indexOf(k) >= 0 || (!tgIs21(raw) && (tgContained(k, keptK) || (isTail && tgContained(k, prevKept))))) { removed.push(raw); return; }
        kept.push(raw);
      });
      var av = "";
      if (pa[1]) {
        var items = pa[1].replace(/^\s*avoid\s*:\s*/i, "").split(/\s*,\s*/), ak = [], seenA = {};
        items.forEach(function (p) { var k = tgNorm(p); if (!k) return; if (seenA[k]) { removed.push(p.trim()); return; } seenA[k] = 1; ak.push(p.trim()); });
        av = ak.length ? "avoid: " + ak.join(", ") : "";
      }
      var txt = kept.join(", ") + (av ? (kept.length ? ", " : "") + av : "");
      if (!txt) txt = s.text;
      s.text = txt; prevKept = prevKept.concat(kept.map(tgNorm));
    });
    var fin = tgFinalize(prompt, tgJoin(segs));
    var neg = String(negative || ""), seenN = {}, nk = [];
    neg.split(/\s*,\s*/).forEach(function (p) { var k = tgNorm(p); if (!k) return; if (seenN[k]) { removed.push(p.trim()); return; } seenN[k] = 1; nk.push(p.trim()); });
    return { prompt: fin.ok ? fin.prompt : prompt, negative: neg ? nk.join(", ") : neg, removed: removed, ok: fin.ok, why: fin.why, notes: fin.notes || [] };
  }
  // What went away (comma phrases whose count dropped), for the before/after note.
  function tgRemoved(before, after) {
    function count(s) { var m = {}; tgSplitParams(s).body.split(/\s*(?:,|::-?\d*\.?\d+)\s*/).forEach(function (p) { var k = tgNorm(p); if (k) m[k] = (m[k] || 0) + 1; }); return m; }
    var a = count(before), b = count(after), out = [], seen = {};
    tgSplitParams(before).body.split(/\s*(?:,|::-?\d*\.?\d+)\s*/).forEach(function (p) { var k = tgNorm(p); if (k && !seen[k] && (b[k] || 0) < a[k]) { seen[k] = 1; out.push(p.trim() + ((b[k] || 0) > 0 || (" " + Object.keys(b).join(" | ") + " ").indexOf(" " + k + " ") >= 0 ? " (dupe)" : "")); } });
    return out;
  }
  // ---- end tighten core ----

  function localResult(prompt, negative, reason) {
    var l = tgLocal(prompt, negative || "");
    var p = l.ok ? l.prompt : prompt, n = l.ok ? l.negative : (negative || "");
    var notes = ["AI unavailable (" + reason + ") — used the free local tighten."];
    var gone = tgRemoved(prompt, p);
    notes.push(gone.length ? "Removed: " + gone.slice(0, 12).join("; ") + (gone.length > 12 ? " (+" + (gone.length - 12) + " more)" : "") : "Nothing to remove locally.");
    return { prompt: p, negative: n, notes: notes.concat(l.notes || []), usage: null, source: "local" };
  }
  function check(orig, origNeg, res) {
    if (!res || typeof res.prompt !== "string" || !res.prompt.trim()) return null;
    var fin = tgFinalize(orig, tgSplitParams(res.prompt).body);
    if (!fin.ok || fin.prompt.length > orig.length) return null;
    var neg = typeof res.negative === "string" ? tgTidy(tgScrubText(res.negative, origNeg || "")) : (origNeg || "");
    if (origNeg && neg.length > Math.ceil(origNeg.length * 1.1)) neg = origNeg;
    return { prompt: fin.prompt, negative: neg, notes: (res.notes || []).concat(fin.notes || []) };
  }
  function run(opts) {
    opts = opts || {};
    var prompt = String(opts.prompt || ""), negative = String(opts.negative || ""), mode = opts.mode === "18+" ? "18+" : "SFW";
    if (!prompt.trim()) return Promise.resolve({ prompt: prompt, negative: negative, notes: ["Nothing to tighten."], source: "local" });
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || 20000);
    var p;
    try {
      p = fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tighten", prompt: prompt, negative: negative, mode: mode }), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.error ? j.error : "HTTP " + r.status); return j; }); });
    } catch (e) { p = Promise.reject(e); }
    return p.then(function (j) {
      clearTimeout(timer);
      var c = check(prompt, negative, j);
      if (!c) return localResult(prompt, negative, "AI result failed the safety checks");
      if (j.unchanged) { var l = localResult(prompt, negative, "AI edit didn't pass its checks"); l.usage = j.usage || null; return l; }
      return { prompt: c.prompt, negative: c.negative, notes: c.notes, usage: j.usage || null, source: j.partial ? "rules" : "ai" };
    }, function (e) {
      clearTimeout(timer);
      var why = e && e.name === "AbortError" ? "timed out" : (e && e.message) || "offline";
      return localResult(prompt, negative, why);
    }).catch(function (e) { return { prompt: prompt, negative: negative, notes: ["Tighten failed (" + (e && e.message) + ") — kept your prompt."], source: "none" }; });
  }
  window.PMTighten = { run: run, local: function (p, n) { return localResult(p, n, "local only"); }, version: "20261023c" };
})();
