(async function () {
  var opts = window.__zfKeyLock || {};
  if (!opts.kicker) opts.kicker = "Zig Flames";
  if (!opts.copy) {
    opts.copy = "Enter your access key. This page is locked while we finish how it goes public. Use the same key as Prompt Machine.";
  }
  if (!opts.redirect) opts.redirect = location.pathname + location.search + location.hash;
  if (!opts.note) opts.note = '<a href="/">Back to ZigFlames</a> · Same key as Prompt Machine';

  function show() {
    document.documentElement.classList.remove("zf-access-pending");
  }

  try {
    if (!window.__pmGate || !window.__pmGate.ensureAccess) {
      show();
      document.body.innerHTML = '<p style="color:#f5f0e8;font-family:IBM Plex Sans,sans-serif;padding:2rem;max-width:28rem;line-height:1.5;">Access gate failed to load. <a href="/" style="color:#ffb24a;">Back to ZigFlames</a></p>';
      return;
    }
    var ok = await window.__pmGate.ensureAccess(opts);
    show();
    if (!ok) return;
  } catch (e) {
    show();
    console.error(e);
  }
})();
