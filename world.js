// World map: one continuous plane of zones. The camera pans and zooms a CSS-transformed layer; zone scenery
// (world/<zone>.json) is fetched the first time a zone comes into view up close; weather particles are drawn
// on one small canvas for the zones on screen only. Below 761px the map is not started at all: the page is
// then the plain zone list that is already in the HTML.
const D = JSON.parse(document.getElementById('placement').textContent);
const $ = (id) => document.getElementById(id);
const map = $('map'), world = $('world'), fx = $('fx'), body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 760px)');
const Z = Object.fromEntries(D.zones.map((z) => [z.id, { ...z, el: $('z-' + z.id), card: $(z.id), state: 0, parts: null }]));
const I = Object.fromEntries(D.islands.map((p) => [p.name, { ...p, el: $('i-' + p.name) }]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cam = { x: 0, y: 0, k: 0.3 };
let vw = 1, vh = 1, started = false, anim = null, raf = 0, last = 0, active = null, lastK = 0, lastHere = '';

/* ---------- camera ---------- */
const fitWorld = () => Math.min(vw / D.world.w, (vh - 150) / D.world.h);
const fitZone = (z) => clamp(Math.min(vw, vh - 150) / (z.r * 2.25), 0.55, 1.5);
const limits = () => [fitWorld() * 0.85, 2.4];
function constrain() {
  const [k0, k1] = limits();
  cam.k = clamp(cam.k, k0, k1);
  cam.x = clamp(cam.x, D.world.x0, D.world.x0 + D.world.w);
  cam.y = clamp(cam.y, D.world.y0, D.world.y0 + D.world.h);
}
function apply() {
  constrain();
  const k = cam.k;
  world.style.transform = `translate3d(${Math.round(vw / 2 - (cam.x - D.world.x0) * k)}px,${Math.round(vh / 2 - (cam.y - D.world.y0) * k)}px,0) scale(${k})`;
  if (k !== lastK) { lastK = k; world.style.setProperty('--ik', clamp(1 / k, 0.75, 6)); world.style.setProperty('--lk', clamp(0.95 / k, 0.8, 1.7)); }
  const far = k < 0.5;
  world.classList.toggle('far', far);
  const hw = vw / 2 / k, hh = vh / 2 / k;
  let here = null, best = 1e9;
  for (const z of Object.values(Z)) {
    const dx = Math.abs(z.x - cam.x), dy = Math.abs(z.y - cam.y), R = z.r * 1.24;
    const vis = dx < hw + R && dy < hh + R;
    z.el.classList.toggle('off', !vis);
    z.live = vis && !far;
    z.el.classList.toggle('live', z.live);
    if (z.live && z.state === 0 && !anim) load(z); // not while flying past
    // parallax: the zone's drifting sky layer trails the camera a little (one composited wrapper, no repaint)
    if (z.skyEl && z.live && !reduced.matches) z.skyEl.style.transform = `translate3d(${((cam.x - z.x) * 0.06).toFixed(1)}px,${((cam.y - z.y) * 0.06).toFixed(1)}px,0)`;
    const d = Math.hypot(z.x - cam.x, z.y - cam.y);
    if (d < z.r && d < best) { best = d; here = z; }
  }
  // minimap
  const v = $('mm-view');
  v.setAttribute('x', cam.x - hw); v.setAttribute('y', cam.y - hh); v.setAttribute('width', hw * 2); v.setAttribute('height', hh * 2);
  $('mm-here').setAttribute('transform', `translate(${cam.x} ${cam.y})`);
  const name = far && !here ? 'Whole world' : here ? here.short : 'Open sky';
  if ($('mm-where').textContent !== name) $('mm-where').textContent = name;
  const hid = here && !far ? here.id : '';
  if (hid !== lastHere) { lastHere = hid; document.querySelectorAll('.dock a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.fly === hid))); }
  kick();
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function fly(x, y, k, ms = 1100) {
  if (reduced.matches) { Object.assign(cam, { x, y, k }); anim = null; apply(); return; }
  const from = { ...cam }, dist = Math.hypot(x - cam.x, y - cam.y);
  const bump = clamp(dist / 2600, 0, 0.55); // long trips pull back first, like the original camera
  anim = { t0: performance.now(), ms: ms + dist * 0.22, step(t) { const e = ease(t); cam.x = from.x + (x - from.x) * e; cam.y = from.y + (y - from.y) * e; cam.k = Math.exp(Math.log(from.k) + (Math.log(k) - Math.log(from.k)) * e) * (1 - bump * Math.sin(Math.PI * t)); } };
  kick();
}
function showCard(z) {
  if (active && active !== z) active.card.classList.remove('on');
  active = z || null;
  if (z) z.card.classList.add('on');
}
function goZone(id, card = true) { const z = Z[id]; if (!z) return; touched(); fly(z.x, z.y + (vw > 1100 ? 0 : 20), fitZone(z)); showCard(card ? z : null); }
function goIsland(name, focus) {
  const p = I[name]; if (!p) return;
  touched();
  fly(p.x, p.y - 40, clamp(fitZone(Z[p.zone]) * 1.5, 1, 1.6));
  showCard(Z[p.zone]);
  document.querySelectorAll('.isl.hit').forEach((e) => e.classList.remove('hit'));
  p.el.classList.add('hit');
  setTimeout(() => p.el.classList.remove('hit'), 4200);
  if (focus) p.el.focus({ preventScroll: true });
}
const goWorld = () => { fly(D.world.x0 + D.world.w / 2, D.world.y0 + D.world.h / 2 + 40, fitWorld()); showCard(null); };
function touched() { body.classList.add('touched'); }

/* ---------- lazy zone scenery ---------- */
const far = (s) => /drift|fly|aurora|fog/.test(s.cls);
const sprite = (s) => `<div class="sp ${s.cls}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;--d:${s.dur || 8};--dl:${s.delay || 0}"><svg width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" focusable="false">${s.svg}</svg></div>`;
async function load(z) {
  z.state = 1;
  try {
    const d = await (await fetch(`world/${z.id}.json`)).json();
    const scn = z.el.querySelector('.scn'), r = z.r;
    scn.innerHTML = `<svg class="back" style="left:${-r}px;top:${-r}px" width="${r * 2}" height="${r * 2}" viewBox="${-r} ${-r} ${r * 2} ${r * 2}" focusable="false">${d.back}</svg>`
      + `<div class="sky">${d.sprites.filter(far).map(sprite).join('')}</div>` + d.sprites.filter((s) => !far(s)).map(sprite).join('');
    z.skyEl = scn.querySelector('.sky');
    for (const [name, art] of Object.entries(d.islands)) { const svg = I[name] && I[name].el.querySelector('svg'); if (svg) svg.innerHTML = art; }
    z.state = 2;
  } catch { z.state = 0; z.failed = (z.failed || 0) + 1; if (z.failed > 2) z.state = 3; } // keep the silhouettes if the fetch fails
}

/* ---------- weather particles (canvas, zones on screen only) ---------- */
const FX = {
  rain: { n: 230, c: '#a9c3ea', a: 0.6, line: 14, vx: 60, vy: 620 }, storm: { n: 340, c: '#c9d6ee', a: 0.6, line: 18, vx: 230, vy: 760 },
  snow: { n: 170, c: '#e8f0ff', a: 0.95, r: 2.1, vx: 12, vy: 34, wob: 18 }, ember: { n: 90, c: '#ff8a3d', a: 0.95, r: 1.9, vx: 6, vy: -40, wob: 22 },
  fireflies: { n: 64, c: '#e4ff8a', a: 0.95, r: 2.2, vx: 0, vy: 0, wob: 26, tw: 1 }, motes: { n: 44, c: '#fff3c4', a: 0.75, r: 1.8, vx: 5, vy: -9, wob: 12, tw: 1 },
  gust: { n: 56, c: '#f4f8fc', a: 0.55, line: 46, vx: 520, vy: 14 }, leaves: { n: 34, c: '#3fbf6f', a: 0.9, r: 2.6, vx: 16, vy: 22, wob: 26 }, heat: { n: 30, c: '#fff0dc', a: 0.5, r: 1.6, vx: 4, vy: -14, wob: 10, tw: 1 },
};
let ctx = null, dpr = 1, fxDirty = false;
function seed(z) {
  const f = FX[z.fx]; if (!f) return (z.parts = []);
  z.parts = Array.from({ length: f.n }, () => ({ x: (Math.random() * 2 - 1) * z.r, y: (Math.random() * 2 - 1) * z.r, s: Math.random() }));
}
function drawFx(t, dt) {
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  let any = false;
  if (reduced.matches) return false;
  for (const z of Object.values(Z)) {
    if (!z.live || !FX[z.fx]) continue;
    if (!z.parts) seed(z);
    const f = FX[z.fx], k = cam.k, R = z.r, ox = vw / 2 + (z.x - cam.x) * k, oy = vh / 2 + (z.y - cam.y) * k;
    any = true;
    ctx.fillStyle = ctx.strokeStyle = f.c;
    ctx.lineWidth = Math.max(1, 1.3 * k);
    if (f.line) { ctx.globalAlpha = f.a; ctx.beginPath(); }
    const m = f.line ? Math.hypot(f.vx, f.vy) : 1;
    for (const p of z.parts) {
      p.x += (f.vx * (0.7 + p.s * 0.6) + (f.wob ? Math.sin(t * (0.6 + p.s) + p.s * 40) * f.wob : 0)) * dt;
      p.y += (f.vy * (0.7 + p.s * 0.6) + (f.wob ? Math.cos(t * (0.5 + p.s * 0.8) + p.s * 31) * f.wob * 0.6 : 0)) * dt;
      if (p.x > R) p.x -= 2 * R; else if (p.x < -R) p.x += 2 * R;
      if (p.y > R) p.y -= 2 * R; else if (p.y < -R) p.y += 2 * R;
      const d = Math.hypot(p.x, p.y) / R;
      if (d > 1) continue;
      const sx = ox + p.x * k, sy = oy + p.y * k;
      if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) continue;
      if (f.line) { if (p.s > (1 - d) * 5) continue; const l = f.line * k * (0.6 + p.s * 0.6); ctx.moveTo(sx, sy); ctx.lineTo(sx - (f.vx / m) * l, sy - (f.vy / m) * l); continue; } // streaks thin out towards the zone edge
      ctx.globalAlpha = f.a * clamp((1 - d) * 4, 0, 1) * (f.tw ? 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + p.s * 2) + p.s * 50)) : 1);
      const r = f.r * Math.max(0.7, k) * (0.6 + p.s * 0.7); ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    if (f.line) ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return any;
}

/* ---------- frame loop: runs only while something moves ---------- */
const vel = { x: 0, y: 0 };
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  let busy = false;
  if (anim) { const t = clamp((now - anim.t0) / anim.ms, 0, 1); anim.step(t); const done = t >= 1; if (done) anim = null; busy = true; applyQuiet(); }
  else if (Math.abs(vel.x) + Math.abs(vel.y) > 4 && !drag) { cam.x -= (vel.x * dt) / cam.k; cam.y -= (vel.y * dt) / cam.k; vel.x *= Math.pow(0.002, dt); vel.y *= Math.pow(0.002, dt); busy = true; applyQuiet(); }
  if (drawFx(now / 1000, dt)) busy = true;
  if (busy && !document.hidden) raf = requestAnimationFrame(frame);
}
let quiet = false;
function applyQuiet() { quiet = true; apply(); quiet = false; }
function kick() { if (!raf && !quiet) { last = performance.now(); raf = requestAnimationFrame(frame); } }

/* ---------- input ---------- */
const pts = new Map();
let drag = null, moved = 0, pinch = null;
function zoomAt(cx, cy, k2) {
  const [k0, k1] = limits();
  k2 = clamp(k2, k0, k1);
  const wx = cam.x + (cx - vw / 2) / cam.k, wy = cam.y + (cy - vh / 2) / cam.k;
  cam.k = k2; cam.x = wx - (cx - vw / 2) / k2; cam.y = wy - (cy - vh / 2) / k2;
  anim = null; apply();
}
function bind() {
  map.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anim = null; vel.x = vel.y = 0;
    if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k }; drag = null; moved = 99; }
  });
  map.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); touched(); return; }
    if (!drag) return;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) {
      if (!map.classList.contains('drag')) { map.classList.add('drag'); try { map.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } touched(); }
      cam.x -= dx / cam.k; cam.y -= dy / cam.k;
      const now = performance.now(), dtm = Math.max(1, now - drag.t); drag.t = now;
      vel.x = vel.x * 0.6 + ((dx / dtm) * 1000) * 0.4; vel.y = vel.y * 0.6 + ((dy / dtm) * 1000) * 0.4;
      apply();
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; map.classList.remove('drag'); if (reduced.matches) vel.x = vel.y = 0; kick(); } };
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', up);
  // a drag that ends on an island must not open it
  map.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  map.addEventListener('dragstart', (e) => e.preventDefault());
  map.addEventListener('wheel', (e) => { e.preventDefault(); touched(); zoomAt(e.clientX, e.clientY, cam.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  map.addEventListener('dblclick', (e) => { if (!e.target.closest('a')) zoomAt(e.clientX, e.clientY, cam.k * 1.6); });

  // zone links (labels, legend, minimap) fly the camera; islands are ordinary links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.zlabel,[data-fly]');
    if (!a || narrow.matches) return;
    e.preventDefault();
    const id = a.dataset.fly || a.getAttribute('href').slice(1);
    goZone(id);
    history.replaceState(null, '', '#' + id);
  });
  // keyboard: Tab reaches every island; bring the focused one into view
  world.addEventListener('focusin', (e) => {
    const a = e.target.closest('a.isl'); if (!a || !a.matches(':focus-visible')) return;
    const p = I[a.id.slice(2)]; if (!p) return;
    const sx = (p.x - cam.x) * cam.k, sy = (p.y - cam.y) * cam.k;
    if (cam.k < 0.6 || Math.abs(sx) > vw / 2 - 160 || Math.abs(sy) > vh / 2 - 190) { touched(); fly(p.x, p.y - 30, Math.max(cam.k, fitZone(Z[p.zone]) * 1.2), 600); }
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = 160 / cam.k;
    const keys = { ArrowLeft: () => (cam.x -= step), ArrowRight: () => (cam.x += step), ArrowUp: () => (cam.y -= step), ArrowDown: () => (cam.y += step) };
    if (keys[e.key]) { e.preventDefault(); anim = null; keys[e.key](); touched(); apply(); }
    else if (e.key === '+' || e.key === '=') zoomAt(vw / 2, vh / 2, cam.k * 1.3);
    else if (e.key === '-' || e.key === '_') zoomAt(vw / 2, vh / 2, cam.k / 1.3);
    else if (e.key === '0') goWorld();
    else if (e.key === 'Home') { e.preventDefault(); goZone('capital'); }
    else if (e.key === 'Escape') showCard(null);
  });
  $('b-home').addEventListener('click', () => { goZone('capital'); history.replaceState(null, '', '#capital'); });
  $('b-all').addEventListener('click', () => { touched(); goWorld(); history.replaceState(null, '', location.pathname + location.search); });
  $('b-in').addEventListener('click', () => { touched(); zoomAt(vw / 2, vh / 2, cam.k * 1.4); });
  $('b-out').addEventListener('click', () => { touched(); zoomAt(vw / 2, vh / 2, cam.k / 1.4); });

  // minimap: click or drag to move
  const mm = $('minimap').querySelector('svg');
  const mmGo = (e) => { const r = mm.getBoundingClientRect(); cam.x = D.world.x0 + ((e.clientX - r.left) / r.width) * D.world.w; cam.y = D.world.y0 + ((e.clientY - r.top) / r.height) * D.world.h; anim = null; touched(); apply(); };
  let mmDrag = false;
  mm.addEventListener('pointerdown', (e) => { if (e.target.closest('a')) return; mmDrag = true; mm.setPointerCapture(e.pointerId); mmGo(e); });
  mm.addEventListener('pointermove', (e) => { if (mmDrag) mmGo(e); });
  mm.addEventListener('pointerup', () => { mmDrag = false; });

  // each card gets a close button when it acts as the side panel
  for (const z of Object.values(Z)) { const b = Object.assign(document.createElement('button'), { type: 'button', className: 'close', textContent: '✕' }); b.setAttribute('aria-label', 'Close zone panel'); b.addEventListener('click', () => showCard(null)); z.card.prepend(b); }
  addEventListener('resize', resize);
  addEventListener('hashchange', () => route(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  reduced.addEventListener('change', apply);
}
function resize() {
  vw = map.clientWidth; vh = map.clientHeight;
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  fx.width = Math.round(vw * dpr); fx.height = Math.round(vh * dpr);
  ctx = fx.getContext('2d');
  apply();
}
function route(animate) {
  const h = decodeURIComponent(location.hash.slice(1));
  if (Z[h]) { goZone(h); return true; }
  if (h.startsWith('p-') && I[h.slice(2)]) { goIsland(h.slice(2), animate); return true; }
  return false;
}
function start() {
  if (started || narrow.matches) return;
  started = true;
  body.classList.add('map-on');
  vw = map.clientWidth; vh = map.clientHeight;
  bind();
  // open on the whole world, then ease into the capital, the way the original camera opened from far away
  Object.assign(cam, { x: D.world.x0 + D.world.w / 2, y: D.world.y0 + D.world.h / 2 + 40, k: fitWorld() });
  resize();
  const hadTarget = location.hash.length > 1;
  if (hadTarget && reduced.matches) { route(false); return; }
  if (hadTarget) { setTimeout(() => route(false), 250); return; }
  const c = Z.capital;
  if (reduced.matches) { Object.assign(cam, { x: c.x, y: c.y, k: fitZone(c) }); apply(); }
  else setTimeout(() => { if (!body.classList.contains('touched')) fly(c.x, c.y, fitZone(c), 1700); }, 900);
}

/* ---------- search: jumps to any project (works in the list view too) ---------- */
(function search() {
  const q = $('q'), list = $('q-list');
  let hits = [], sel = -1;
  const zname = (p) => D.zones.find((z) => z.id === p.zone);
  function render() {
    const t = q.value.trim().toLowerCase();
    hits = t ? D.islands.filter((p) => `${p.name} ${p.title} ${p.short} ${p.stack} ${zname(p).name}`.toLowerCase().includes(t)).slice(0, 8) : [];
    sel = hits.length ? 0 : -1;
    list.hidden = !t;
    q.setAttribute('aria-expanded', String(!!t));
    list.innerHTML = hits.length ? hits.map((p, i) => `<li role="option" id="q-${i}" aria-selected="${i === sel}" style="--c:${zname(p).color}"><i></i><span>${p.cc ? p.cc + ' · ' : ''}${p.title.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span><small>${zname(p).short}</small></li>`).join('') : t ? '<li class="none" role="option" aria-disabled="true">No project matches</li>' : '';
    q.setAttribute('aria-activedescendant', sel >= 0 ? 'q-' + sel : '');
  }
  function pick(i) {
    const p = hits[i]; if (!p) return;
    list.hidden = true; q.value = ''; q.setAttribute('aria-expanded', 'false');
    if (narrow.matches || !started) { location.hash = 'p-' + p.name; return; }
    history.replaceState(null, '', '#p-' + p.name);
    goIsland(p.name, true);
  }
  q.addEventListener('input', render);
  q.addEventListener('focus', render);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!hits.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); q.setAttribute('aria-activedescendant', 'q-' + sel); list.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') { list.hidden = true; q.setAttribute('aria-expanded', 'false'); }
  });
  list.addEventListener('pointerdown', (e) => { const li = e.target.closest('li[id]'); if (li) { e.preventDefault(); pick(Number(li.id.slice(2))); } });
  $('search').addEventListener('submit', (e) => { e.preventDefault(); pick(sel); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.search')) { list.hidden = true; q.setAttribute('aria-expanded', 'false'); } });
})();

start();
narrow.addEventListener('change', () => { if (!narrow.matches) start(); });
