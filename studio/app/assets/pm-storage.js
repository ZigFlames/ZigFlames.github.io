/* Zig Flames Prompt Machine — durable local saves (browser-only; never ships personal data). */
(function () {
  var PREFIX = 'pm.storage.';
  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent('pm-storage', { detail: detail })); } catch (e) {}
    try { console.warn('[Prompt Machine storage]', detail); } catch (e2) {}
  }
  function safeSet(key, value) {
    var raw = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      localStorage.setItem(key, raw);
      return { ok: true };
    } catch (err) {
      // Quota or private mode — try pruning known bulky non-critical keys once
      try {
        var bulky = ['flux-character-builder:images', 'studio.history.v1'];
        for (var i = 0; i < bulky.length; i++) {
          try { localStorage.removeItem(bulky[i]); } catch (e3) {}
        }
        localStorage.setItem(key, raw);
        emit({ ok: true, recovered: true, key: key, message: 'Freed image/history cache to save your library.' });
        return { ok: true, recovered: true };
      } catch (err2) {
        emit({
          ok: false,
          key: key,
          message: 'Could not save in this browser (storage full or blocked). Export a JSON backup.'
        });
        return { ok: false, error: String(err2 && err2.message || err2) };
      }
    }
  }
  function safeGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  window.__pmStorage = { safeSet: safeSet, safeGet: safeGet, emit: emit };
  // Soft toast for failures
  window.addEventListener('pm-storage', function (ev) {
    var d = ev.detail || {};
    if (d.ok && !d.recovered) return;
    try {
      var el = document.getElementById('pm-storage-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pm-storage-toast';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;z-index:99999;left:50%;bottom:1.25rem;transform:translateX(-50%);max-width:22rem;padding:.85rem 1rem;border-radius:10px;background:#1a1410;border:1px solid #ff9a1f;color:#f5f0e8;font:600 13px/1.4 IBM Plex Sans,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)';
        document.body.appendChild(el);
      }
      el.textContent = d.message || (d.ok ? 'Saved (freed space).' : 'Save failed — export a backup.');
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 5200);
    } catch (e) {}
  });
})();
