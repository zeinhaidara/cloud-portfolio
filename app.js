// Home page glue: starts the 3D world (world.js) when WebGL is available and wires the page around it:
// project panel, zone chips, zone cards, search, minimap, camera buttons, explored counter, list view.
// Without WebGL or JavaScript, or when the visitor picks "List view", the page is the plain zone list in the HTML.
const D = JSON.parse(document.getElementById('placement').textContent);
const $ = (id) => document.getElementById(id);
const body = document.body;
const I = Object.fromEntries(D.islands.map((p) => [p.name, p]));
const Z = Object.fromEntries(D.zones.map((z) => [z.id, { ...z, card: $(z.id) }]));
const RINGZ = D.zones.filter((z) => z.range).map((z) => z.id);
const balloon = (D.islands.find((p) => p.building === 'balloon') || {}).name;
const countable = D.islands.filter((p) => p.name !== balloon);
let world = null, focused = null, activeCard = null, loading = null;
const seen = new Set(read());
function read() { try { return JSON.parse(sessionStorage.getItem('zein-seen') || '[]'); } catch { return []; } }
function save() { try { sessionStorage.setItem('zein-seen', JSON.stringify([...seen])); } catch { /* storage blocked */ } }
const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* storage blocked */ } return null; };

/* ---------- capability and view ---------- */
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; } }
const canGL = hasWebGL();
const wantList = new URLSearchParams(location.search).get('view') === 'list' || store('zein-view') === 'list';
function setView(gl) {
  body.classList.toggle('gl', gl);
  const b = $('b-view');
  b.textContent = gl ? 'List view' : '3D view';
  b.setAttribute('aria-pressed', String(!gl));
  store('zein-view', gl ? '3d' : 'list');
  if (world) world.pause(!gl);
  if (gl) start().then(() => { if (world) { world.pause(!body.classList.contains('gl')); world.redraw(); } });
}

/* ---------- 3D world ---------- */
function start() {
  if (!loading) {
    const labels = { islands: Object.fromEntries(D.islands.map((p) => [p.name, $('l-' + p.name)])), zones: Object.fromEntries(D.zones.map((z) => [z.id, $('zl-' + z.id)])), ghosts: Object.fromEntries(D.uncharted.map((u) => [u.n, $('g-' + u.n)])) };
    loading = import('./world.js').then((m) => {
      world = m.createWorld({ canvas: $('stage'), data: D, labels, onPick: focus, onInteract: () => body.classList.add('touched'), onState, onError(name) {
        const toast = $('toast');
        toast.textContent = `${name} scenery could not load. You can still explore its projects.`;
        toast.hidden = false;
      } });
      world.pause(!body.classList.contains('gl'));
      window.__world = world; // for the browser console and the test scripts
      world.ready.then(() => body.classList.add('ready'));
      marks();
      route();
    }).catch((err) => { console.warn('3D world unavailable, showing the list', err); body.classList.remove('gl'); $('b-view').hidden = true; });
  }
  return loading;
}

/* ---------- project panel (the original card) ---------- */
function focus(id) {
  const p = I[id];
  if (!p) return;
  focused = id;
  body.classList.add('touched');
  const contact = id === balloon, panel = $('panel');
  if (!contact && !seen.has(id)) { seen.add(id); save(); if (seen.size === countable.length) celebrate(); }
  panel.style.setProperty('--c', p.color);
  $('p-kind').textContent = contact ? 'ABOUT · CONTACT' : (p.cc ? `CODE CLINIC ${p.cc} · ` : '') + p.domain.toUpperCase();
  $('p-title').textContent = contact ? 'Hi, I’m Zein' : p.short === p.title || p.cc ? p.title : p.short;
  $('p-blurb').textContent = contact ? 'Cloud engineer building secure, observable platforms on AWS, Azure and Google Cloud: infrastructure as code, least-privilege access, and delivery pipelines that say no to bad changes. Always glad to talk about interesting cloud and platform problems.' : p.summary;
  $('p-val').textContent = p.vl.toUpperCase();
  $('p-val').className = 'st ' + p.vc;
  $('p-val').parentElement.hidden = contact;
  $('p-tags').replaceChildren(...(contact ? ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'GitOps', 'Security'] : p.stack.slice(0, 8)).map((t) => Object.assign(document.createElement('span'), { textContent: t })));
  $('p-main').textContent = contact ? 'Email me' : 'Read the case study';
  $('p-main').href = contact ? 'mailto:' + D.contact.email : p.href;
  $('p-src').textContent = contact ? 'GitHub profile' : 'Source on GitHub';
  $('p-src').href = contact ? D.contact.github : p.repo;
  panel.hidden = false;
  panel.classList.remove('pop'); void panel.offsetWidth; panel.classList.add('pop');
  body.classList.add('panel-open');
  showCard(null);
  if (world) { world.flyTo(id); world.setPanel(true); }
  history.replaceState(null, '', '#p-' + id);
  marks();
}
function closePanel(stay) {
  focused = null;
  $('panel').hidden = true;
  body.classList.remove('panel-open');
  if (world) { world.setPanel(false); if (!stay) world.flyTo(null); }
  marks();
}
function celebrate() {
  if (world) world.celebrate(['#ff8a1f', '#12b981', '#f2b705', '#7c5cff', '#2f9bff', '#1e6ad6', '#ff5d6c', '#ffd34d']);
  const t = $('toast');
  t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  setTimeout(() => { t.hidden = true; }, 7000);
}
function marks() {
  for (const p of D.islands) { const l = $('l-' + p.name); l.classList.toggle('seen', seen.has(p.name)); l.classList.toggle('dim', !!focused && focused !== p.name); }
  $('score').textContent = seen.size + ' / ' + countable.length + ' explored';
}

/* ---------- zones ---------- */
function showCard(z) {
  if (activeCard && activeCard !== z) activeCard.card.classList.remove('on');
  activeCard = z || null;
  if (z) z.card.classList.add('on');
}
function goZone(id, card = true) {
  const z = Z[id];
  if (!z || !world) return;
  body.classList.add('touched');
  if (focused) closePanel(true);
  world.goZone(id);
  showCard(card && id !== 'capital' ? z : null);
  history.replaceState(null, '', '#' + id);
}
function onState(s) {
  $('mm-here').setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.z.toFixed(1)})`);
  body.classList.toggle('dark', s.lit > 0.45);
  const name = s.over > 0.6 ? 'Whole world' : s.here ? Z[s.here].short : 'Open sky';
  if ($('mm-where').textContent !== name) {
    $('mm-where').textContent = name;
    document.querySelectorAll('.dock a').forEach((a) => a.setAttribute('aria-current', String(s.over <= 0.6 && a.dataset.fly === s.here)));
  }
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (Z[h]) { if (h !== 'capital') goZone(h); return; }
  if (h.startsWith('p-') && I[h.slice(2)]) focus(h.slice(2));
}

/* ---------- wiring ---------- */
document.addEventListener('click', (e) => {
  if (!body.classList.contains('gl') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const fly = e.target.closest('[data-fly]');
  if (fly) { e.preventDefault(); goZone(fly.dataset.fly); return; }
  const label = e.target.closest('a.plabel');
  if (label) { e.preventDefault(); focus(label.dataset.id); } // the label is a real link; in the 3D view it first shows the island
});
$('labels').addEventListener('focusin', (e) => { const l = e.target.closest('a.plabel'); if (l && l.matches(':focus-visible') && world && focused !== l.dataset.id) world.flyTo(l.dataset.id); });
$('p-close').addEventListener('click', () => closePanel());
$('b-home').addEventListener('click', () => goZone('capital'));
$('b-all').addEventListener('click', () => { if (!world) return; body.classList.add('touched'); if (focused) closePanel(true); showCard(null); world.goOverview(); history.replaceState(null, '', location.pathname + location.search); });
$('b-in').addEventListener('click', () => world && world.zoomBy(0.72));
$('b-out').addEventListener('click', () => world && world.zoomBy(1.4));
$('b-view').addEventListener('click', () => setView(!body.classList.contains('gl')));
addEventListener('hashchange', () => { if (world && body.classList.contains('gl')) route(); });
addEventListener('keydown', (e) => {
  if (!world || !body.classList.contains('gl') || e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (focused) closePanel(); else showCard(null); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const cur = RINGZ.indexOf(($('mm-where').textContent && Object.values(Z).find((z) => z.short === $('mm-where').textContent) || {}).id);
    e.preventDefault();
    goZone(RINGZ[(cur + (e.key === 'ArrowRight' ? 1 : -1) + RINGZ.length) % RINGZ.length]);
  } else if (e.key === '+' || e.key === '=') world.zoomBy(0.75);
  else if (e.key === '-' || e.key === '_') world.zoomBy(1.33);
  else if (e.key === '0') $('b-all').click();
  else if (e.key === 'Home') { e.preventDefault(); goZone('capital'); }
});
// minimap: zones are links; anywhere else glides the camera to that point
const mm = $('minimap').querySelector('svg');
mm.addEventListener('click', (e) => {
  if (e.target.closest('a') || !world) return;
  const r = mm.getBoundingClientRect();
  body.classList.add('touched');
  if (focused) closePanel(true);
  showCard(null);
  world.goPoint(-250 + ((e.clientX - r.left) / r.width) * 500, -250 + ((e.clientY - r.top) / r.height) * 500);
});
// zone cards get a close button when they act as the side panel
for (const z of Object.values(Z)) { const b = Object.assign(document.createElement('button'), { type: 'button', className: 'close', textContent: '✕' }); b.setAttribute('aria-label', 'Close zone panel'); b.addEventListener('click', () => showCard(null)); z.card.prepend(b); }

/* ---------- search: jumps to any project, in both views ---------- */
(function search() {
  const q = $('q'), list = $('q-list');
  let hits = [], sel = -1;
  const close = () => { list.hidden = true; q.setAttribute('aria-expanded', 'false'); };
  function render() {
    const t = q.value.trim().toLowerCase();
    hits = t ? D.islands.filter((p) => `${p.name} ${p.title} ${p.short} ${p.stack.join(' ')} ${p.domain} ${Z[p.zone].name}`.toLowerCase().includes(t)).slice(0, 8) : [];
    sel = hits.length ? 0 : -1;
    list.hidden = !t;
    q.setAttribute('aria-expanded', String(!!t));
    list.replaceChildren(...(hits.length ? hits.map((p, i) => { const li = document.createElement('li'); li.id = 'q-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === sel)); li.style.setProperty('--c', Z[p.zone].color); li.append(document.createElement('i'), Object.assign(document.createElement('span'), { textContent: (p.cc ? p.cc + ' · ' : '') + p.title }), Object.assign(document.createElement('small'), { textContent: Z[p.zone].short })); return li; })
      : t ? [Object.assign(document.createElement('li'), { className: 'none', textContent: 'No project matches' })] : []));
    q.setAttribute('aria-activedescendant', sel >= 0 ? 'q-' + sel : '');
  }
  function pick(i) {
    const p = hits[i];
    if (!p) return;
    close(); q.value = '';
    if (world && body.classList.contains('gl')) { focus(p.name); $('l-' + p.name).focus({ preventScroll: true }); } else location.hash = 'p-' + p.name;
  }
  q.addEventListener('input', render);
  q.addEventListener('focus', render);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!hits.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); q.setAttribute('aria-activedescendant', 'q-' + sel); list.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('pointerdown', (e) => { const li = e.target.closest('li[id]'); if (li) { e.preventDefault(); pick(Number(li.id.slice(2))); } });
  $('search').addEventListener('submit', (e) => { e.preventDefault(); pick(sel); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.search')) close(); });
})();

/* ---------- boot ---------- */
marks();
if (canGL) { $('b-view').hidden = false; setView(!wantList); }
