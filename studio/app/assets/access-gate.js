window.__pmGate = (function () {
  var SALT = 'zigflames-pm-v1';
  var STORAGE = 'pm_access_v1';
  var VALID = {
    '76f37225f6fd744a525ed65e35bbb10721148a233cd1aab56b61ad6fee8a1e76': 'owner',
    'cb8ca38aed51c64981527c870a923f394cdd1ab721e7c95ded3276c5ad0d3322': 'access',
    'ce2b62cb500aac548c4639953ecaed8f5f9f2dcd479ca3128ed9a023878125f7': 'guest',
    '9c5e45eb9473d6ff736376f8e85695932d8c75a11a59aa230b552c9cb94d0331': 'guest',
    '7ab90cf40ed2a96770411a4b54c0d9cd3e5d026283f2483b6fdcb48422fa902b': 'guest',
    '402e1649539f989f02ae0056734d3a06fc538ea298513c1824093e23819dfacc': 'guest',
    '2020cc3be6cfa2c7efd48a76f37f3e01bf8857bcaf2a830eca052ad59a5697a2': 'guest'
  };
  var TRIAL_URL = 'https://buy.stripe.com/4gMaEYbJveUcbae6Di4ZG07';

  function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function hashKey(raw) {
    var msg = SALT + ':' + String(raw || '').trim().toUpperCase();
    var dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return toHex(dig);
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || 'null'); }
    catch (e) { return null; }
  }

  function writeSession(role, keyHash) {
    localStorage.setItem(STORAGE, JSON.stringify({ role: role, h: keyHash, at: Date.now() }));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE);
  }

  async function unlockWithKey(raw) {
    var h = await hashKey(raw);
    var role = VALID[h];
    if (!role) return null;
    writeSession(role, h);
    return role;
  }

  function paintGate(msg) {
    document.documentElement.style.background = '#08080a';
    document.body.innerHTML = [
      '<style>',
      'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;',
      'font-family:IBM Plex Sans,system-ui,sans-serif;background:#08080a;color:#f5f0e8;padding:1.5rem;}',
      '.card{width:100%;max-width:26rem;border:1px solid #3a2a18;border-radius:10px;padding:1.5rem;',
      'background:linear-gradient(180deg,#121016,#0a0a0c);box-shadow:0 20px 60px rgba(0,0,0,.45);}',
      '.kicker{letter-spacing:.14em;text-transform:uppercase;font-size:.72rem;color:#ff9a1f;margin:0 0 .6rem;}',
      'h1{font-family:Bebas Neue,Oswald,sans-serif;letter-spacing:.08em;font-size:2rem;margin:0 0 .75rem;',
      'background:linear-gradient(180deg,#ffe566,#ff9a1f,#e24a00);-webkit-background-clip:text;color:transparent;}',
      'p{line-height:1.5;color:#c9c0b4;font-size:.95rem;margin:0 0 1rem;}',
      'label{display:block;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#9a9084;margin:0 0 .4rem;}',
      'input{width:100%;box-sizing:border-box;background:#16141c;border:1px solid #4a3a28;color:#fff;',
      'border-radius:6px;padding:.85rem .9rem;font-size:1rem;letter-spacing:.04em;}',
      'input:focus{outline:1px solid #ff9a1f;}',
      '.err{color:#ff6b6b;font-size:.85rem;min-height:1.2rem;margin:.55rem 0 .9rem;}',
      '.row{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.2rem;}',
      '.btn{appearance:none;border:0;border-radius:6px;padding:.85rem 1rem;font-weight:600;cursor:pointer;',
      'text-decoration:none;display:inline-flex;align-items:center;justify-content:center;}',
      '.primary{background:linear-gradient(180deg,#ffe566,#ff9a1f);color:#1a1000;flex:1;}',
      '.ghost{background:transparent;border:1px solid #4a3a28;color:#f5f0e8;flex:1;}',
      '.note{font-size:.8rem;color:#8a8074;margin-top:1rem;}',
      'a{color:#ffb24a;}',
      '</style>',
      '<div class="card">',
      '<p class="kicker">Zig Flames Prompt Machine</p>',
      '<h1>Access locked</h1>',
      '<p>Enter your access key. New here? Start the 99¢ trial — after checkout you get in automatically.</p>',
      '<label for="pm-key">Access key</label>',
      '<input id="pm-key" autocomplete="off" spellcheck="false" placeholder="FLAMES-…" />',
      '<div class="err" id="pm-err">' + (msg || '') + '</div>',
      '<div class="row">',
      '<button class="btn primary" type="button" id="pm-unlock">Unlock</button>',
      '<a class="btn ghost" href="' + TRIAL_URL + '" rel="noopener noreferrer">Try for 99¢</a>',
      '</div>',
      '<p class="note"><a href="/studio.html">Back to Studio</a> · Owner / paid keys only</p>',
      '</div>'
    ].join('');

    var input = document.getElementById('pm-key');
    var err = document.getElementById('pm-err');
    var btn = document.getElementById('pm-unlock');
    if (!input || !err || !btn) return;
    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    try { input.focus(); } catch (e) {}

    async function attempt() {
      err.textContent = '';
      var role = await unlockWithKey(input.value);
      if (!role) {
        err.textContent = 'That key doesn’t unlock the machine.';
        return;
      }
      location.href = '/studio/app/';
    }
  }

  async function ensureAccess() {
    window.__pmClearAccess = clearSession;
    try {
      if (!document.body) {
        await new Promise(function (r) { document.addEventListener('DOMContentLoaded', r, { once: true }); });
      }
      var params = new URLSearchParams(location.search);
      var qKey = params.get('key');
      if (qKey) {
        var role = await unlockWithKey(qKey);
        if (role) {
          params.delete('key');
          var clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
          history.replaceState({}, '', clean);
          return true;
        }
        paintGate('Checkout key invalid. Use Try for 99¢ or enter a valid key.');
        return false;
      }
      var session = readSession();
      if (session && session.h && VALID[session.h]) return true;
      paintGate('');
      return false;
    } catch (e) {
      console.error(e);
      paintGate('Unlock failed. Refresh, or use Owner door / Try for 99¢.');
      return false;
    }
  }

  return { ensureAccess: ensureAccess, clearSession: clearSession };
})();
