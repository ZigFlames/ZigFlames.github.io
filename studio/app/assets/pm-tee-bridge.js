/* Zig's Prompt Machine — T-Shirt Studio bridge (v20261110a)
   Loaded on every page. Lets ANY artwork in the machine go to the T-Shirt Studio:
     window.PMTee.send(srcOrBlob, {source, prompt, name})  -> copies the image (untouched original) into the on-device
                                                               artwork library (IndexedDB "pm-tee") and opens the studio
     window.PMTee.button(getSrc, meta)                      -> a ready "👕 Send to T-Shirt Studio" button for result rows
   Plus a small 👕 badge on every other big image on the page (AI Studio results, Gallery, characters, previews, Grok outputs).
   Nothing leaves the device: images are copied locally. Cross-origin result hosts (xAI / Pollinations / fal) are fetched
   through the site's own worker (img_fetch) because they send no CORS headers. */
(function () {
  "use strict";
  if (window.PMTee) return;
  var DEF = "https://zigflames-ai.zigflames.workers.dev";
  function endpoint() { try { var o = localStorage.getItem("pm_ai_endpoint"); if (o) return o; } catch (e) {} return window.PM_AI_ENDPOINT || DEF; }

  // ---------- IndexedDB (images are too big for localStorage) ----------
  var DBN = "pm-tee", dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("This browser has no IndexedDB (private mode?) — designs can't be saved."));
      var rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = function () { var d = rq.result; ["assets", "designs", "kv"].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); }); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { dbp = null; rej(rq.error || new Error("IndexedDB failed")); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, mode), s = t.objectStore(store), out; try { out = fn(s); } catch (e) { return rej(e); } t.oncomplete = function () { res(out && "result" in out ? out.result : out); }; t.onerror = t.onabort = function () { rej(t.error || new Error("db error")); }; }); });
  }
  var DB = {
    put: function (store, obj) { return tx(store, "readwrite", function (s) { s.put(obj); return obj; }).then(function () { return obj; }); },
    get: function (store, id) { return tx(store, "readonly", function (s) { return s.get(id); }); },
    del: function (store, id) { return tx(store, "readwrite", function (s) { s.delete(id); }); },
    all: function (store) { return tx(store, "readonly", function (s) { return s.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0); }); }); }
  };
  function uid(p) { return (p || "a") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

  // ---------- image fetch (keeps the bytes exactly as made: this IS the untouched original) ----------
  function isImgBlob(b) { return b && b.size > 0 && /^image\//.test(b.type || ""); }
  function viaWorker(u) {
    return fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "img_fetch", url: u }) })
      .then(function (r) { return r.ok ? r.blob() : null; });
  }
  function fromImgEl(u) { // last resort: same-origin or CORS-clean <img> -> canvas (PNG)
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () { try { var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); c.toBlob(function (b) { res(b); }, "image/png"); } catch (e) { res(null); } };
      im.onerror = function () { res(null); }; im.src = u;
    });
  }
  function loadBlob(src) {
    if (src instanceof Blob) return Promise.resolve(isImgBlob(src) ? src : null);
    var u = String(src || ""); if (!u) return Promise.resolve(null);
    if (/^(?:data|blob):/.test(u)) return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return isImgBlob(b) ? b : null; }).catch(function () { return null; });
    if (/^https:\/\/(?:imgen\.x\.ai|[a-z0-9-]*\.?fal\.media)\//.test(u)) return viaWorker(u).catch(function () { return null; }).then(function (b) { return isImgBlob(b) ? b : fromImgEl(u); }); // hosts without CORS headers
    return fetch(u, { mode: "cors" }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) { return isImgBlob(b) ? b : viaWorker(u); })
      .catch(function () { return viaWorker(u).catch(function () { return null; }); })
      .then(function (b) { return isImgBlob(b) ? b : fromImgEl(u); });
  }
  function dims(blob) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { res({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); };
      im.onerror = function () { res(null); URL.revokeObjectURL(u); }; im.src = u;
    });
  }
  // save an image as an untouched original in the artwork library
  function addAsset(blob, meta) {
    meta = meta || {};
    return dims(blob).then(function (d) {
      if (!d) throw new Error("That file isn't an image this browser can read.");
      var a = { id: uid("art"), kind: "original", blob: blob, type: blob.type, w: d.w, h: d.h, name: String(meta.name || meta.source || "Artwork").slice(0, 80),
        source: String(meta.source || "Upload").slice(0, 80), prompt: String(meta.prompt || "").slice(0, 2000), createdAt: Date.now() };
      return DB.put("assets", a);
    });
  }
  function mini(msg) {
    var n = document.getElementById("pm-tee-toast");
    if (!n) { n = document.createElement("div"); n.id = "pm-tee-toast"; n.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483000;background:#111827;color:#fde68a;border:1px solid #f59e0b;border-radius:10px;padding:9px 14px;font:13px/1.4 'IBM Plex Sans',sans-serif;max-width:88vw;box-shadow:0 8px 30px rgba(0,0,0,.6)"; document.body.appendChild(n); }
    n.textContent = msg; n.style.display = "block"; clearTimeout(n._t); n._t = setTimeout(function () { n.style.display = "none"; }, 4500);
  }
  function go() { try { window.dispatchEvent(new CustomEvent("pm-nav", { detail: "tshirt" })); } catch (e) {} }
  var sending = {};
  function send(src, meta) {
    meta = meta || {};
    var key = typeof src === "string" ? src : "";
    if (key && sending[key]) return sending[key];
    mini("👕 Copying artwork to the T-Shirt Studio…");
    var p = loadBlob(src).then(function (b) {
      if (!b) throw new Error("Couldn't copy that image (the host blocked it). Download it, then use Import in the T-Shirt Studio.");
      return addAsset(b, meta);
    }).then(function (a) {
      return DB.put("kv", { id: "pending", asset: a.id, at: Date.now() }).then(function () {
        mini("👕 Sent to T-Shirt Studio (" + a.w + "×" + a.h + " px, original kept)");
        try { window.dispatchEvent(new CustomEvent("pm-tee-incoming", { detail: a.id })); } catch (e) {}
        if (meta.navigate !== false) go();
        return a;
      });
    }).catch(function (e) { mini("⚠ " + (e && e.message || "Send to T-Shirt Studio failed")); throw e; });
    if (key) { sending[key] = p; p.then(function () { delete sending[key]; }, function () { delete sending[key]; }); }
    return p;
  }
  var explicit = {};
  function button(getSrc, meta, style) {
    var b = document.createElement("button");
    b.type = "button"; b.setAttribute("data-pm", "tee-send"); b.textContent = "👕 Send to T-Shirt Studio";
    b.title = "Copy this image into the T-Shirt Studio (the original stays untouched) to put it on a shirt and prepare a DTF print file";
    b.style.cssText = style || "padding:6px 12px;border-radius:9px;border:1px solid #a855f7;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;font-weight:600;font-size:12px;cursor:pointer;margin:4px 6px 4px 0";
    var src0 = typeof getSrc === "function" ? null : getSrc; if (typeof src0 === "string") explicit[src0] = 1;
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var s = typeof getSrc === "function" ? getSrc() : getSrc; if (typeof s === "string") explicit[s] = 1; if (!s) return mini("No image yet"); b.disabled = true; send(s, typeof meta === "function" ? meta() : meta).then(function () { b.disabled = false; }, function () { b.disabled = false; }); });
    return b;
  }

  // ---------- 👕 badge on every other big image ----------
  var layer = null, tracked = [], MAXB = 40;
  function css() {
    if (document.getElementById("pm-tee-badge-css")) return;
    var s = document.createElement("style"); s.id = "pm-tee-badge-css";
    s.textContent = "#pm-tee-layer{position:fixed;left:0;top:0;width:0;height:0;z-index:40;pointer-events:none}#pm-tee-layer button{position:fixed;pointer-events:auto;font:600 11px/1 'IBM Plex Sans',sans-serif;padding:6px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(17,17,24,.82);color:#fff;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.5);white-space:nowrap}#pm-tee-layer button:hover{background:#7c3aed}";
    document.head.appendChild(s);
  }
  function eligible(im) {
    if (!im || !im.isConnected || !im.src || im.getAttribute("data-pm-tee") === "no") return false;
    if (/\.svg(?:[?#]|$)|^data:image\/svg/i.test(im.src) || /placeholder\.|favicon|\/icons?\//i.test(im.src)) return false;
    if (explicit[im.src] || explicit[im.currentSrc]) return false;
    if (im.closest && im.closest("[data-pm=tee-studio],nav,aside,header,[data-pm-tee=no]")) return false;
    if (!im.complete || im.naturalWidth < 256 || im.naturalHeight < 256) return false;
    var r = im.getBoundingClientRect();
    if (r.width < 110 || r.height < 110) return false;
    var st = getComputedStyle(im); if (st.display === "none" || st.visibility === "hidden" || +st.opacity < 0.2) return false;
    return true;
  }
  function onStudioPage() { return !!document.querySelector("[data-pm=tee-studio]"); }
  function scan() {
    if (!document.body) return;
    if (!layer) { css(); layer = document.createElement("div"); layer.id = "pm-tee-layer"; document.body.appendChild(layer); }
    var imgs = onStudioPage() ? [] : Array.prototype.slice.call(document.images).filter(eligible).slice(0, MAXB);
    tracked = tracked.filter(function (t) { if (imgs.indexOf(t.im) < 0) { t.b.remove(); return false; } return true; });
    imgs.forEach(function (im) {
      if (tracked.some(function (t) { return t.im === im; })) return;
      var b = document.createElement("button"); b.type = "button"; b.textContent = "👕 T-Shirt"; b.setAttribute("data-pm", "tee-badge");
      b.title = "Send this image to the T-Shirt Studio (original kept untouched)";
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var near = im.closest("[data-pm]"); send(im.currentSrc || im.src, { source: near ? "Prompt Machine · " + near.getAttribute("data-pm") : "Prompt Machine image", name: im.alt || "Artwork" }); });
      layer.appendChild(b); tracked.push({ im: im, b: b });
    });
    place();
  }
  function place() {
    var vh = window.innerHeight, vw = window.innerWidth;
    tracked.forEach(function (t) {
      var r = t.im.getBoundingClientRect();
      var vis = r.bottom > 30 && r.top < vh - 30 && r.right > 0 && r.left < vw;
      t.b.style.display = vis ? "block" : "none";
      if (vis) { t.b.style.top = Math.max(4, r.top + 6) + "px"; t.b.style.left = Math.min(vw - 90, r.right - 86) + "px"; }
    });
  }
  var mo, raf = 0;
  function kick() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; scan(); }); }
  function start() {
    try { mo = new MutationObserver(kick); mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style", "class"] }); } catch (e) {}
    window.addEventListener("scroll", function () { place(); }, true); window.addEventListener("resize", kick);
    document.addEventListener("load", function (e) { if (e.target && e.target.tagName === "IMG") kick(); }, true);
    setInterval(scan, 1500); scan();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();

  window.PMTee = { send: send, button: button, addAsset: addAsset, loadBlob: loadBlob, db: DB, uid: uid, dims: dims, toast: mini, go: go, _scan: scan, version: "20261110a" };
})();
