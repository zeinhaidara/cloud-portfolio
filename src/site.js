// Atlas behaviour: theme, calm mode, time-of-day tint, map hover card, weather, project filters.
// Everything here is progressive: pages read and navigate without it.
(function () {
  'use strict';
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: keep the setting for this page only */ } },
  };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- theme and calm
  var themeBtn = document.getElementById('theme');
  function paintTheme() {
    var dark = root.dataset.theme === 'dark';
    if (themeBtn) { themeBtn.setAttribute('aria-pressed', String(dark)); themeBtn.textContent = dark ? 'Dark' : 'Light'; themeBtn.setAttribute('aria-label', 'Theme: ' + (dark ? 'dark' : 'light') + '. Switch to ' + (dark ? 'light' : 'dark')); }
  }
  if (themeBtn) themeBtn.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('atlas-theme', root.dataset.theme); paintTheme();
  });
  paintTheme();

  var calmBtn = document.getElementById('calm');
  function paintCalm() {
    var on = !root.dataset.calm && !reduced.matches;
    if (calmBtn) { calmBtn.setAttribute('aria-pressed', String(on)); calmBtn.textContent = on ? 'Weather on' : 'Weather off'; calmBtn.disabled = reduced.matches; }
    document.dispatchEvent(new CustomEvent('atlas:calm'));
  }
  if (calmBtn) calmBtn.addEventListener('click', function () {
    if (root.dataset.calm) { delete root.dataset.calm; store.set('atlas-calm', '0'); } else { root.dataset.calm = '1'; store.set('atlas-calm', '1'); }
    paintCalm();
  });
  paintCalm();

  // ---- time-of-day tint on scenery (visitor's local clock)
  var h = new Date().getHours();
  root.dataset.tod = h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';

  // ---- regions menu: close on Escape or outside click
  var menu = document.querySelector('.menu');
  if (menu) {
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  }

  // ---- map hover and focus card
  var info = document.getElementById('map-info');
  if (info) {
    var f = { range: document.getElementById('mi-range'), name: document.getElementById('mi-name'), climate: document.getElementById('mi-climate'), count: document.getElementById('mi-count') };
    var base = { range: f.range.textContent, name: f.name.textContent, climate: f.climate.textContent, count: f.count.textContent };
    var show = function (c) {
      f.range.textContent = c.dataset.range; f.name.textContent = c.dataset.place;
      f.climate.textContent = c.dataset.name + ' · ' + c.dataset.climate; f.count.textContent = c.dataset.count;
      info.className = 'map-info ' + (c.getAttribute('class').match(/rg-[\w-]+/) || [''])[0];
    };
    var clear = function () { f.range.textContent = base.range; f.name.textContent = base.name; f.climate.textContent = base.climate; f.count.textContent = base.count; info.className = 'map-info'; };
    Array.prototype.forEach.call(document.querySelectorAll('.map .cell'), function (c) {
      c.addEventListener('mouseenter', function () { show(c); }); c.addEventListener('focus', function () { show(c); });
      c.addEventListener('mouseleave', clear); c.addEventListener('blur', clear);
    });
  }

  // ---- weather: a small particle layer over the scenery banner
  var sceneEl = document.querySelector('.scene[data-weather]');
  var canvas = sceneEl && sceneEl.querySelector('.weather');
  var kind = sceneEl && sceneEl.dataset.weather;
  var KINDS = {
    rain: { n: 70, vx: -1.6, vy: 9, len: 13, w: 1.4, color: 'rgba(235,244,255,.55)' },
    snow: { n: 60, vx: 0.4, vy: 1.1, r: 2.2, color: 'rgba(255,255,255,.9)', drift: 1 },
    petals: { n: 16, vx: 0.7, vy: 0.6, r: 2.6, color: 'rgba(255,214,222,.9)', drift: 1 },
    wind: { n: 14, vx: 7, vy: 0.2, len: 34, w: 1.2, color: 'rgba(255,255,255,.5)' },
    dust: { n: 26, vx: 1.2, vy: -0.15, r: 1.5, color: 'rgba(255,236,190,.7)', drift: 1 },
    embers: { n: 20, vx: 0.3, vy: -0.9, r: 1.9, color: 'rgba(255,170,80,.9)', drift: 1 },
    fireflies: { n: 0 },
  };
  if (canvas && KINDS[kind] && KINDS[kind].n && canvas.getContext) {
    var k = KINDS[kind], ctx = canvas.getContext('2d'), parts = [], raf = 0, W = 0, H = 0;
    var size = function () { var r = canvas.getBoundingClientRect(); W = canvas.width = Math.round(r.width); H = canvas.height = Math.round(r.height); };
    var seed = function (p, anywhere) { p.x = Math.random() * W; p.y = anywhere ? Math.random() * H : (k.vy < 0 ? H + 4 : -4); p.s = 0.6 + Math.random() * 0.8; p.t = Math.random() * 6.3; return p; };
    var tick = function () {
      ctx.clearRect(0, 0, W, H); ctx.strokeStyle = ctx.fillStyle = k.color; ctx.lineWidth = k.w || 1; ctx.lineCap = 'round';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.t += 0.03; p.x += k.vx * p.s + (k.drift ? Math.sin(p.t) * 0.5 : 0); p.y += k.vy * p.s;
        if (k.len) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - k.vx * k.len / 9, p.y - k.vy * k.len / 9 - (k.vy < 1 ? 0 : 0)); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, k.r * p.s, 0, 6.3); ctx.fill(); }
        if (p.y > H + 6 || p.y < -6 || p.x > W + 40 || p.x < -40) { seed(p, false); if (k.vx > 3) { p.x = -30; p.y = Math.random() * H; } }
      }
      raf = requestAnimationFrame(tick);
    };
    var start = function () {
      cancelAnimationFrame(raf); raf = 0;
      if (root.dataset.calm || reduced.matches || document.hidden) { ctx.clearRect(0, 0, W, H); return; }
      size(); parts = []; for (var i = 0; i < k.n; i++) parts.push(seed({}, true)); tick();
    };
    document.addEventListener('atlas:calm', start); document.addEventListener('visibilitychange', start);
    window.addEventListener('resize', function () { if (raf) size(); });
    if (reduced.addEventListener) reduced.addEventListener('change', function () { paintCalm(); });
    start();
  }

  // ---- all-projects filters
  var table = document.getElementById('ptable');
  if (table) {
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    var q = document.getElementById('f-q'), form = document.getElementById('filters'), count = document.getElementById('count'), empty = document.getElementById('empty');
    var sel = { region: document.getElementById('f-region'), domain: document.getElementById('f-domain'), stack: document.getElementById('f-stack'), val: document.getElementById('f-val'), kind: document.getElementById('f-kind') };
    var has = function (list, v, sep) { return !v || list.split(sep).indexOf(v) !== -1; };
    var apply = function () {
      var words = q.value.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      rows.forEach(function (r) {
        var d = r.dataset, text = r.textContent.toLowerCase();
        var ok = has(d.region, sel.region.value, ' ') && has(d.domain, sel.domain.value, '|') && has(d.stack, sel.stack.value, '|') && (!sel.val.value || d.val === sel.val.value) && (!sel.kind.value || d.kind === sel.kind.value) && words.every(function (w) { return text.indexOf(w) !== -1; });
        r.hidden = !ok; if (ok) shown++;
      });
      count.textContent = shown + (shown === 1 ? ' project' : ' projects') + (shown === rows.length ? '' : ' of ' + rows.length);
      empty.hidden = shown !== 0; table.parentNode.hidden = shown === 0;
    };
    var params = new URLSearchParams(location.search);
    if (params.get('q')) { q.value = params.get('q'); var top = document.getElementById('q-top'); if (top) top.value = q.value; }
    if (params.get('region') && sel.region.querySelector('[value="' + params.get('region').replace(/[^\w-]/g, '') + '"]')) sel.region.value = params.get('region');
    form.addEventListener('input', apply); form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('reset', function (e) {
      e.preventDefault(); q.value = '';
      Object.keys(sel).forEach(function (key) { sel[key].value = ''; });
      apply();
    });
    document.getElementById('empty-clear').addEventListener('click', function () { form.reset(); });
    apply();
  }
})();
