/* Zig Flames Prompt Machine — durable local saves (browser-only; never ships personal data). */
(function () {
  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent('pm-storage', { detail: detail })); } catch (e) {}
    try { console.warn('[Prompt Machine storage]', detail); } catch (e2) {}
  }
  var CRITICAL = {
    'faceoff.vocabBank.v1': 1,
    'flux-character-builder:saved': 1,
    'flux-character-builder:draft': 1,
    'flux-character-builder:page': 1,
    'faceoff.remix.v1': 1,
    'faceoff.director.v1': 1,
    'seedExpander.customWords.v1': 1,
    'faceoff.mode': 1
  };
  function backupKey(key) { return 'pm.backup.' + key; }
  function hasChips(raw) {
    try {
      var j = JSON.parse(raw);
      var cats = Array.isArray(j && j.categories) ? j.categories : (Array.isArray(j) ? j : null);
      if (!cats) return false;
      return cats.some(function (c) { return c && Array.isArray(c.chips) && c.chips.length > 0; });
    } catch (e) { return false; }
  }
  function draftSignal(raw) {
    try {
      var j = JSON.parse(raw);
      if (!j || typeof j !== 'object' || Array.isArray(j)) return 0;
      var n = 0;
      Object.keys(j).forEach(function (k) {
        var v = j[k];
        if (v == null || v === '' || v === false || v === 0) return;
        if (Array.isArray(v) && v.length === 0) return;
        if (k === 'sceneCast' && Array.isArray(v) && v.length <= 1) return;
        n++;
      });
      return n;
    } catch (e) { return 0; }
  }
  function restoreIfNeeded(key, richer) {
    try {
      var cur = localStorage.getItem(key);
      var bak = localStorage.getItem(backupKey(key));
      if (!bak) return;
      if (richer(bak) && (!cur || !richer(cur))) {
        localStorage.setItem(key, bak);
        emit({ ok: true, recovered: true, key: key, message: 'Restored ' + key.replace(/^.*:/, '') + ' from backup.' });
      }
    } catch (e) {}
  }
  restoreIfNeeded('faceoff.vocabBank.v1', hasChips);
  restoreIfNeeded('flux-character-builder:draft', function (raw) { return draftSignal(raw) >= 4; });
  restoreIfNeeded('faceoff.remix.v1', function (raw) {
    try {
      var j = JSON.parse(raw);
      return !!(j && ((j.idea && String(j.idea).trim()) || (Array.isArray(j.results) && j.results.length)));
    } catch (e) { return false; }
  });

  function safeSet(key, value) {
    var raw = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      if (key === 'faceoff.vocabBank.v1' && !hasChips(raw)) {
        var existing = localStorage.getItem(key);
        var bak2 = localStorage.getItem(backupKey(key));
        if ((existing && hasChips(existing)) || (bak2 && hasChips(bak2))) {
          emit({ ok: true, recovered: true, key: key, message: 'Kept your Vocabulary Bank (blocked empty overwrite).' });
          return { ok: true, recovered: true, blockedEmpty: true };
        }
      }
      if (key === 'flux-character-builder:draft' && draftSignal(raw) < 2) {
        var exD = localStorage.getItem(key);
        var bakD = localStorage.getItem(backupKey(key));
        if ((exD && draftSignal(exD) >= 4) || (bakD && draftSignal(bakD) >= 4)) {
          emit({ ok: true, recovered: true, key: key, message: 'Kept your studio draft (blocked empty overwrite).' });
          return { ok: true, recovered: true, blockedEmpty: true };
        }
      }
      localStorage.setItem(key, raw);
      if (CRITICAL[key]) {
        try { localStorage.setItem(backupKey(key), raw); } catch (eB) {}
      }
      return { ok: true };
    } catch (err) {
      try {
        var bulky = ['flux-character-builder:images', 'studio.history.v1'];
        for (var i = 0; i < bulky.length; i++) {
          try { localStorage.removeItem(bulky[i]); } catch (e3) {}
        }
        localStorage.setItem(key, raw);
        if (CRITICAL[key]) {
          try { localStorage.setItem(backupKey(key), raw); } catch (eB2) {}
        }
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
  // v20261004: ask the browser to keep this site's storage (reduces eviction under storage pressure / ITP).
  try {
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) { if (!p && navigator.storage.persist) return navigator.storage.persist(); }).catch(function () {});
    }
  } catch (eP) {}
  // v20261004: snapshot before "Reset All" / "Clear All" wipes the draft, so it can be undone.
  // Narrow hook: only fires when the studio draft key itself is removed; never removes anything on its own.
  var LAST_CLEAR = 'pm.lastClear.v1';
  try {
    var origRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      try {
        if (this === window.localStorage && key === 'flux-character-builder:draft') {
          var d = localStorage.getItem('flux-character-builder:draft');
          var b = localStorage.getItem(backupKey('flux-character-builder:draft'));
          var richest = (d && draftSignal(d) >= (b ? draftSignal(b) : 0)) ? d : (b || d);
          if (richest && draftSignal(richest) >= 2) {
            origRemove.call(localStorage, LAST_CLEAR);
            localStorage.setItem(LAST_CLEAR, JSON.stringify({ at: Date.now(), draft: richest, mj: localStorage.getItem('pm.mj.v1') }));
          }
        }
      } catch (eS) {}
      return origRemove.apply(this, arguments);
    };
  } catch (eH) {}
  function restoreLastClear() {
    try {
      var snap = JSON.parse(localStorage.getItem(LAST_CLEAR) || 'null');
      if (!snap || !snap.draft) return false;
      localStorage.setItem('flux-character-builder:draft', snap.draft);
      localStorage.setItem(backupKey('flux-character-builder:draft'), snap.draft);
      if (snap.mj) localStorage.setItem('pm.mj.v1', snap.mj);
      return true;
    } catch (e) { return false; }
  }
  window.addEventListener('pm:clear-all', function () {
    try {
      if (!localStorage.getItem(LAST_CLEAR)) return;
      var el = document.getElementById('pm-undo-clear');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pm-undo-clear';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;z-index:99999;left:50%;bottom:1.25rem;transform:translateX(-50%);display:flex;gap:.75rem;align-items:center;padding:.7rem 1rem;border-radius:10px;background:#1a1410;border:1px solid #ff9a1f;color:#f5f0e8;font:600 13px/1.4 IBM Plex Sans,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)';
        var t = document.createElement('span'); t.textContent = 'Cleared. Your previous selections + MJ params were saved.';
        var u = document.createElement('button'); u.type = 'button'; u.textContent = 'Undo'; u.setAttribute('data-pm', 'undo-clear');
        u.style.cssText = 'background:#ff9a1f;color:#1a1410;border:0;border-radius:6px;padding:.35rem .7rem;font:700 13px system-ui;cursor:pointer';
        u.onclick = function () { if (restoreLastClear()) location.reload(); };
        el.appendChild(t); el.appendChild(u); document.body.appendChild(el);
      }
      el.style.display = 'flex';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 15000);
    } catch (e) {}
  });
  window.__pmStorage = { safeSet: safeSet, safeGet: safeGet, emit: emit, restoreLastClear: restoreLastClear };
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
