// Generates the whole site from data/projects.json and data/world.json. No dependencies.
//   node scripts/build.mjs                 write index.html, projects.html, projects/, world/, redirects, sitemap
//   node scripts/build.mjs --check         fail if the committed output differs from a fresh build (CI)
//   node scripts/build.mjs --sync [file]   first refresh data/projects.json from the audit file
//                                          (default ../_audit/projects.json), public repositories only
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { island, ghostIsland, liteBase, zoneScene, icon, pickBuilding, relight, cloud, HEIGHT } from './lib/art.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const read = (p) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

/* ---------- optional: refresh the public snapshot from the audit ---------- */
const FIELDS = ['name', 'title', 'summary', 'domain', 'stack', 'tier', 'repo_url', 'demo_url', 'outcome', 'status', 'validation_level', 'known_limitations', 'next_steps', 'challenge_number', 'visibility', 'archived', 'last_push'];
// Audit housekeeping notes (branch hygiene, internal follow-ups, references to private work) are not project limitations.
const HOUSEKEEPING = /stale remote branch|team credit must stay|unrelated to the cloud|not on the portfolio|co-author|no repo description|no mention of code clinic|not branch-protected|readme anchor|separate portfolio session|pin six repos|zein-final-project|personal email/i;
if (args.includes('--sync')) {
  const src = resolve(root, args[args.indexOf('--sync') + 1] && !args[args.indexOf('--sync') + 1].startsWith('--') ? args[args.indexOf('--sync') + 1] : '../_audit/projects.json');
  const all = JSON.parse(readFileSync(src, 'utf8'));
  const pub = all.filter((p) => p.visibility === 'PUBLIC').map((p) => {
    const o = {};
    for (const k of FIELDS) if (p[k] !== undefined) o[k] = p[k];
    o.archived = Boolean(p.archived);
    o.known_limitations = (p.known_limitations || []).filter((s) => !HOUSEKEEPING.test(s));
    o.next_steps = (p.next_steps || []).filter((s) => !HOUSEKEEPING.test(s));
    return o;
  }).sort((a, b) => a.name.localeCompare(b.name));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  writeFileSync(resolve(root, 'data/projects.json'), JSON.stringify(pub, null, 2) + '\n');
  console.log(`synced ${pub.length} public projects (${all.length - pub.length} non-public skipped)`);
}

/* ---------- model ---------- */
const W = json('data/world.json');
const SITE = W.site;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const projects = json('data/projects.json').filter((p) => p.visibility === 'PUBLIC').map((p) => ({ ...p, ...(W.overrides[p.name] || {}) }));
const zones = W.zones, zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
const RING = W.ring;

const VAL = { cloud: ['Run on real cloud', 'live'], ci: ['CI with mocks only', 'manual'], review: ['Source review only', 'open'], none: ['Not run', 'none'] };
const vcat = (v) => { const t = String(v).toLowerCase(); return t.startsWith('run on real cloud') ? 'cloud' : t.startsWith('ci with mocks') ? 'ci' : t.startsWith('not run') ? 'none' : 'review'; };
const badge = (p) => `<span class="st ${VAL[p.v][1]}">${VAL[p.v][0].toUpperCase()}</span>`;

// Where a repository lives: explicit placement, then Code Clinic number, then the archive, then its domain.
const DOMAIN_ZONE = [[/kubernetes|container/, 'containers'], [/secur|iam|compliance/, 'security'], [/observab|monitor|logging|sre/, 'observability'], [/ci\/cd|gitops|release|supply chain/, 'cicd'],
  [/finops|cost/, 'finops'], [/network/, 'networking'], [/backup|reliab|disaster/, 'reliability'], [/automation|script|configuration/, 'automation'], [/infrastructure|iac|provision/, 'provisioning']];
function zoneOf(p) {
  const pl = W.placements[p.name];
  if (pl) return pl.zone;
  if (Number.isInteger(p.challenge_number)) { const z = zones.find((x) => x.range && p.challenge_number >= x.range[0] && p.challenge_number <= x.range[1]); if (z) return z.id; }
  if (p.archived) return 'archive';
  const d = String(p.domain).toLowerCase();
  for (const [re, id] of DOMAIN_ZONE) if (re.test(d)) return id;
  return 'capital';
}
const rad = (deg) => (deg * Math.PI) / 180;
const r1 = (v) => Math.round(v);
for (const z of zones) {
  if (z.id === 'capital') Object.assign(z, { x: 0, y: 0, r: RING.capitalRadius });
  else if (z.id === 'archive') Object.assign(z, { x: -1720, y: 1560, r: 250 });
  else { const a = rad(-90 + (z.n - 1) * 36); Object.assign(z, { x: r1(Math.cos(a) * RING.radius), y: r1(Math.sin(a) * RING.radius), r: RING.zoneRadius }); }
  z.islands = []; z.slots = [];
}
const WORLD = { x0: -2100, y0: -2060, w: 4200, h: 4040 };
for (const p of projects) {
  const z = zoneById[zoneOf(p)], pl = W.placements[p.name] || {};
  p.zone = z; p.v = vcat(p.validation_level);
  p.short = pl.short || p.title; p.color = pl.color || z.color; p.size = pl.size || 0.92;
  p.ground = pl.ground || z.ground; p.building = pl.building || pickBuilding(p);
  p.cc = Number.isInteger(p.challenge_number) ? String(p.challenge_number).padStart(2, '0') : null;
  p.href = `projects/${p.name}.html`;
  z.islands.push(p);
}
for (const z of zones) {
  if (z.range) {
    // five fixed slots, one per challenge number; an empty slot is an uncharted island
    const extras = z.islands.filter((p) => !p.cc);
    for (let k = z.range[0]; k <= z.range[1]; k++) {
      const i = k - z.range[0], a = rad(-90 + i * 72), p = z.islands.find((q) => q.challenge_number === k);
      const slot = { n: k, x: r1(Math.cos(a) * RING.islandOrbit), y: r1(Math.sin(a) * RING.islandOrbit * 0.94), p };
      if (p) { p.lx = slot.x; p.ly = slot.y; }
      z.slots.push(slot);
    }
    extras.forEach((p, i) => { const a = rad(-54 + i * 72); p.lx = r1(Math.cos(a) * (RING.islandOrbit + 110)); p.ly = r1(Math.sin(a) * (RING.islandOrbit + 110) * 0.94); });
    z.islands.sort((a, b) => (a.challenge_number ?? 99) - (b.challenge_number ?? 99));
  } else if (z.id === 'capital') {
    const order = Object.keys(W.placements);
    z.islands.sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99));
    const orbit = z.islands.filter((p) => !['signpost', 'balloon'].includes(p.building));
    orbit.forEach((p, i) => { const a = rad(-90 + (i * 360) / orbit.length); p.lx = r1(Math.cos(a) * 310); p.ly = r1(Math.sin(a) * 310 * 0.94); });
    z.islands.forEach((p) => { if (p.building === 'signpost') { p.lx = 0; p.ly = 10; } if (p.building === 'balloon') { p.lx = 372; p.ly = -292; } });
  } else {
    z.islands.forEach((p, i) => { const k = z.islands.length; p.lx = k === 1 ? 0 : r1(Math.cos((i / k) * 6.283) * 120); p.ly = k === 1 ? 20 : r1(Math.sin((i / k) * 6.283) * 110); });
  }
  z.islands.forEach((p) => { p.wx = z.x + p.lx; p.wy = z.y + p.ly; });
}
const byName = Object.fromEntries(projects.map((p) => [p.name, p]));
const night = (z) => z.mode === 'night';
const zoneLabel = (z) => (z.range ? `Zone ${String(z.n).padStart(2, '0')} · ${String(z.range[0]).padStart(2, '0')}–${z.range[1]}` : z.id === 'capital' ? 'Centre of the world' : 'Offshore');

/* ---------- island art ---------- */
const VB = '-115 -200 230 330'; // one island: origin at the centre of its top face
const artOf = (p) => relight(island({ ground: p.ground, building: p.building, color: p.color, size: p.size, seed: p.name, night: night(p.zone) }), p.zone.light);
const liteOf = (p) => (p.building === 'balloon' ? `<circle cy="-72" r="34" fill="${p.color}"/><rect x="-9" y="-16" width="18" height="14" fill="#a8743f"/>` : relight(liteBase(62 * p.size, p.ground), p.zone.light));
const iconSvg = (z, size = 44) => `<svg viewBox="-26 -30 52 56" width="${size}" height="${size}" aria-hidden="true" focusable="false">${relight(icon(z.icon, z.color), null)}</svg>`;

/* ---------- shared page pieces ---------- */
const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230c1017'/%3E%3Cpath d='M8 9h16L8 23h16' fill='none' stroke='%23ffad48' stroke-width='3'/%3E%3C/svg%3E">`;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap">`;
function head({ title, desc, path, base = '', css, extra = '' }) {
  const url = SITE.url + path;
  return `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE.url}og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE.url}og-image.png">
${FAVICON}
${FONTS}
${css.map((c) => `<link rel="stylesheet" href="${base}${c}">`).join('')}${extra}`;
}
const skyVars = (z) => `--s0:${z.sky[0]};--s1:${z.sky[1]};--s2:${z.sky[2]};--c:${z.color}`;
const backdrop = `<div class="backdrop" aria-hidden="true"><span class="cl c1"></span><span class="cl c2"></span><span class="cl c3"></span></div>`;
const footer = (base) => `<footer><a class="brand" href="${base}index.html">ZEIN / CLOUD</a><span>Cloud Portfolio · 2026</span><a href="${base}projects.html">All projects</a><a href="${SITE.github}">GitHub profile</a></footer>`;

/* ---------- world page ---------- */
function mapZone(z) {
  const isl = z.islands.map((p) => `<a class="isl" id="i-${p.name}" href="${p.href}" style="left:${p.lx}px;top:${p.ly}px;--c:${p.color};--ly:${-r1((HEIGHT[p.building] || 1.6) * 37 * p.size + (p.ground === 'castle' ? 34 : 24))}px"><span class="bob" style="animation-delay:-${(Math.abs(p.lx + p.ly) % 50) / 10}s"><svg viewBox="${VB}" width="230" height="330" aria-hidden="true" focusable="false">${liteOf(p)}</svg></span><span class="plabel"><i></i>${p.cc ? `<em>${p.cc}</em> ` : ''}<span class="t">${esc(p.short)}</span><span class="vh">${p.short === p.title ? '' : ` (${esc(p.title)})`}. ${esc(VAL[p.v][0])}. Case study.</span></span></a>`).join('');
  const ghosts = z.slots.filter((s) => !s.p).map((s) => `<span class="isl ghost" style="left:${s.x}px;top:${s.y}px"><span class="bob"><svg viewBox="${VB}" width="230" height="330" aria-hidden="true" focusable="false"><use href="#ghost"/></svg></span><span class="plabel" style="--ly:-52px"><em>${s.n}</em><span class="t">Uncharted · coming soon</span></span></span>`).join('');
  const ferry = z.id === 'capital' ? W.capitalLinks.filter((nm) => byName[nm]).map((nm, i) => { const p = byName[nm]; return `<a class="plabel ferry" href="${p.href}" style="left:${-190 + i * 380}px;top:452px;--c:${p.zone.color}"><i></i><em>${p.cc}</em><span class="t">${esc(p.title)}</span><small>· ${esc(p.zone.short)}</small></a>`; }).join('') : '';
  return `<div class="zone" id="z-${z.id}" data-zone="${z.id}" data-mode="${z.mode}" style="left:${z.x - WORLD.x0}px;top:${z.y - WORLD.y0}px;--r:${z.r}px;--o:${z.id === 'capital' ? 310 : z.range ? RING.islandOrbit : 0}px;--fx:${z.range ? r1((z.x / RING.radius) * z.r * 0.5) : 0}px;--fy:${z.range ? r1((z.y / RING.radius) * z.r * 0.5) : 0}px;${skyVars(z)}"><div class="air"></div><div class="ring"></div><div class="scn" aria-hidden="true"></div><a class="zlabel" href="#${z.id}">${iconSvg(z, 48)}<span><b>${esc(z.short)}</b><small>${esc(z.climate)}</small></span></a>${isl}${ghosts}${ferry}</div>`;
}
function worldDecor() {
  // dotted routes: spokes from the capital and the ring between neighbours; faint clouds between the zones
  const ring = zones.filter((z) => z.range);
  let routes = '', clouds = '';
  const pt = (z) => `${z.x - WORLD.x0} ${z.y - WORLD.y0}`;
  ring.forEach((z, i) => {
    const nx = ring[(i + 1) % ring.length], a = Math.atan2(z.y, z.x);
    routes += `<path d="M${r1(Math.cos(a) * 600 - WORLD.x0)} ${r1(Math.sin(a) * 600 - WORLD.y0)}L${r1(Math.cos(a) * 990 - WORLD.x0)} ${r1(Math.sin(a) * 990 - WORLD.y0)}"/>`;
    routes += `<path d="M${pt(z)}A${RING.radius} ${RING.radius} 0 0 1 ${pt(nx)}" class="soft"/>`;
  });
  const arch = zoneById.archive, z7 = zoneById.finops;
  routes += `<path d="M${pt(z7)}Q${z7.x - 520 - WORLD.x0} ${z7.y + 420 - WORLD.y0} ${pt(arch)}" class="soft"/>`;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 40; i++) {
    const x = rnd() * WORLD.w, y = rnd() * WORLD.h, wx = x + WORLD.x0, wy = y + WORLD.y0;
    if (zones.some((z) => Math.hypot(wx - z.x, wy - z.y) < z.r * 0.92)) continue;
    clouds += `<use href="#cl${i % 4}" transform="translate(${r1(x)} ${r1(y)}) scale(${(0.7 + rnd() * 0.9).toFixed(2)})" opacity="${(0.55 + rnd() * 0.4).toFixed(2)}"/>`;
  }
  return `<svg class="decor" viewBox="0 0 ${WORLD.w} ${WORLD.h}" width="${WORLD.w}" height="${WORLD.h}" aria-hidden="true" focusable="false"><defs>${[0, 1, 2, 3].map((i) => `<g id="cl${i}">${relight(cloud(120, '#f4f7fb', i + 11), null)}</g>`).join('')}<g id="ghost">${ghostIsland()}</g></defs><g class="routes">${routes}</g>${clouds}</svg>`;
}
function zoneCard(z) {
  const items = (z.range ? z.slots : z.islands.map((p) => ({ p }))).map((s) => s.p
    ? `<li id="p-${s.p.name}"><a href="${s.p.href}"><b>${s.p.cc ? `<em>${s.p.cc}</em> ` : ''}${esc(s.p.title)}</b><span>${esc(s.p.domain)}</span></a>${badge(s.p)}</li>`
    : `<li class="soon"><b><em>${s.n}</em> Uncharted island</b><span>Coming soon</span></li>`).join('');
  const also = z.id === 'capital' ? `<p class="also">Also linked from the capital: ${W.capitalLinks.filter((nm) => byName[nm]).map((nm) => `<a href="${byName[nm].href}">${byName[nm].cc} · ${esc(byName[nm].title)}</a>`).join(', ')}.</p>` : '';
  return `<section class="zcard" id="${z.id}" data-mode="${z.mode}" style="${skyVars(z)}" aria-labelledby="zt-${z.id}"><div class="zhead">${iconSvg(z, 52)}<div><span class="kind">${esc(zoneLabel(z))}</span><h2 id="zt-${z.id}">${esc(z.name)}</h2><p>${esc(z.climate)}. ${esc(z.blurb)}</p></div></div><ul>${items}</ul>${also}</section>`;
}
function indexPage() {
  const placement = {
    world: WORLD,
    zones: zones.map((z) => ({ id: z.id, n: z.n, name: z.name, short: z.short, x: z.x, y: z.y, r: z.r, color: z.color, mode: z.mode, fx: z.fx, sky: z.sky, range: z.range || null })),
    islands: projects.map((p) => ({ name: p.name, title: p.title, short: p.short, zone: p.zone.id, x: p.wx, y: p.wy, href: p.href, cc: p.cc, v: p.v, stack: p.stack.join(' ') })),
    uncharted: zones.flatMap((z) => z.slots.filter((s) => !s.p).map((s) => ({ n: s.n, zone: z.id, x: z.x + s.x, y: z.y + s.y }))),
  };
  const dock = zones.map((z) => `<a href="#${z.id}" data-fly="${z.id}" style="--c:${z.color}"><i></i>${esc(z.short)}</a>`).join('');
  const mini = zones.map((z) => `<a href="#${z.id}" data-fly="${z.id}" aria-label="${esc(z.name)}"><circle cx="${z.x}" cy="${z.y}" r="${z.r * 0.82}" fill="${z.sky[1]}" stroke="${z.color}" stroke-width="46"/></a>`).join('');
  const desc = 'Cloud engineering projects by Zein as one world of floating islands: a capital of flagship platforms ringed by ten climate zones, one per Code Clinic domain. AWS, Azure and Google Cloud.';
  const html = `<!doctype html>
<html lang="en"><head>${head({ title: SITE.title, desc, path: '', css: ['tokens.css', 'world.css'] })}
</head>
<body>
<header class="top"><a class="brand" href="index.html">ZEIN<span> / CLOUD ENGINEERING</span></a>
 <form class="search" id="search" role="search" autocomplete="off"><label class="vh" for="q">Find a project on the map</label><input id="q" type="search" placeholder="Find a project…" aria-controls="q-list" aria-expanded="false" role="combobox" aria-autocomplete="list"><ul id="q-list" role="listbox" hidden></ul></form>
 <nav aria-label="Main navigation"><a href="projects.html">All projects</a><a class="pill gh" href="${SITE.github}">GitHub</a><a class="pill" href="mailto:${SITE.email}">Contact</a></nav></header>
<main>
<section class="intro"><div class="eyebrow">AWS · AZURE · GCP · INFRASTRUCTURE · APPLICATIONS</div>
 <h1>Ideas into systems.<br><span>Built in the cloud.</span></h1>
 <p>Every island is a project I built. The capital holds the flagships; ten climate zones ring it, one per Code Clinic domain. <span class="d">Drag to explore, pick a zone to fly in, or use</span><span class="m">Pick a zone below, or use</span> <a href="projects.html">the full list</a>.</p></section>
<div class="map" id="map" role="group" aria-label="World map: ${projects.length} project islands in ${zones.length} zones. Drag to pan, scroll or pinch to zoom, Tab to move between islands.">
 <div class="world" id="world" style="width:${WORLD.w}px;height:${WORLD.h}px">${worldDecor()}${zones.map(mapZone).join('')}</div>
 <canvas id="fx" aria-hidden="true"></canvas>
</div>
<div class="zones" id="zones"><h2 class="vh">Zones and projects</h2>${zones.map(zoneCard).join('')}</div>
<div class="hud" id="hud">
 <div class="ctl" role="group" aria-label="Map controls"><button type="button" id="b-home" title="Capital (Home)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg><span>Capital</span></button><button type="button" id="b-all" title="Whole world (0)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none"/><circle cx="12" cy="12" r="2.6"/></svg><span>World</span></button><button type="button" id="b-in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" id="b-out" aria-label="Zoom out" title="Zoom out (−)">−</button></div>
 <div class="minimap" id="minimap"><svg viewBox="${WORLD.x0} ${WORLD.y0} ${WORLD.w} ${WORLD.h}" role="img" aria-label="Minimap. The orange frame is the part of the world on screen."><title>Minimap</title>${mini}<rect id="mm-view" x="0" y="0" width="10" height="10"/><g id="mm-here"><circle r="90" class="p"/><circle r="46"/></g></svg><span id="mm-where" aria-live="polite">Capital</span></div>
</div>
<nav class="dock" id="dock" aria-label="Zones">${dock}</nav>
</main>
<noscript><style>.map,.hud,.dock,.search{display:none!important}.zones{display:block!important}html,body{overflow:auto!important;height:auto!important;position:static!important}</style></noscript>
<script type="application/json" id="placement">${JSON.stringify(placement)}</script>
<script type="module" src="world.js"></script>
</body></html>
`;
  return { html, placement };
}

/* ---------- zone scenery (lazy-loaded by world.js) ---------- */
function zoneData(z) {
  const sc = zoneScene(z, z.r);
  return { id: z.id, back: sc.back, sprites: sc.sprites, islands: Object.fromEntries(z.islands.map((p) => [p.name, artOf(p)])) };
}

/* ---------- case studies ---------- */
function heroScene(p) {
  const z = p.zone, sky = [];
  for (let i = 0; i < 6; i++) sky.push(`<g transform="translate(${80 + i * 160 + (i % 2) * 40} ${70 + ((i * 97) % 220)})" opacity=".9">${cloud(90 + (i % 3) * 40, z.cloud || '#f4f7fb', i + z.n * 3)}</g>`);
  const orb = night(z) ? `<circle cx="790" cy="84" r="64" fill="#8fa8ff" opacity=".14"/><circle cx="790" cy="84" r="26" fill="#eef2ff"/>` : `<circle cx="790" cy="84" r="78" fill="#f0a64a" opacity=".16"/><circle cx="790" cy="84" r="34" fill="#f6c453"/>`;
  return `<svg viewBox="0 0 960 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(p.title)} as a low-poly island in the ${esc(z.name)} zone">${z.id === 'containers' ? '' : orb}<ellipse cx="480" cy="275" rx="330" ry="86" fill="none" stroke="#f4f8fc" stroke-opacity=".4" stroke-width="2"/>${relight(sky.join(''), z.light)}<g transform="translate(480 ${p.building === 'balloon' ? 340 : 245}) scale(1.4)">${artOf(p)}</g></svg>`;
}
function casePage(p) {
  const z = p.zone, base = '../';
  const file = `content/${p.name}.html`;
  let body = existsSync(resolve(root, file)) ? read(file).trim().replace(/(src|href)="assets\//g, `$1="${base}assets/`) : '';
  const subs = [...body.matchAll(/<div id="([^"]+)" class="sub"><div class="sub-label"><span>\d+<\/span> ([^<]+)<\/div>/g)].map((m) => [m[1], m[2].trim()]);
  const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
  const peers = z.islands, i = peers.indexOf(p), prev = peers[(i - 1 + peers.length) % peers.length], next = peers[(i + 1) % peers.length];
  const demoOwn = p.demo_url && p.demo_url.startsWith(SITE.url) && p.name !== 'cloud-portfolio';
  const demo = p.demo_url && !demoOwn ? `<a class="button" href="${esc(p.demo_url)}">${p.name === 'zeinhaidara' ? 'Open the GitHub profile' : p.name === 'cloud-portfolio' ? 'Open the live site' : 'Open the live app'}</a>` : '';
  const lims = p.known_limitations || [], steps = p.next_steps || [];
  const vText = p.validation_level.toLowerCase() === VAL[p.v][0].toLowerCase() ? '' : `<span class="vnote">${code(p.validation_level)}</span>`;
  const scripts = [body.includes('id="sim"') ? `<script src="${base}pipeline.js" defer></script>` : '', body.includes('id="replay"') ? `<script src="${base}gcp-replay.js" defer></script>` : ''].join('');
  const title = `${p.title} · Zein Cloud Portfolio`;
  return `<!doctype html>
<html lang="en" data-mode="${z.mode}" data-zone="${z.id}"><head>${head({ title, desc: p.summary, path: p.href, base, css: ['tokens.css', 'style.css', 'theme.css'] })}
</head>
<body style="${skyVars(z)}">${backdrop}<header><a class="brand" href="${base}index.html">ZEIN<span> / CLOUD ENGINEERING</span></a><nav aria-label="Main navigation"><a href="${base}index.html">World</a><a href="${base}projects.html">All projects</a>${subs.map(([id, t]) => `<a href="#${id}">${cap(t)}</a>`).join('')}<a class="pill-link" href="mailto:${SITE.email}">Contact</a><a class="nav-contact" href="${esc(p.repo_url)}">GitHub</a></nav></header>
<main id="home" style="--c:${p.color}">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${base}index.html">World</a></li><li><a href="${base}index.html#${z.id}">${esc(z.short)}</a></li><li aria-current="page">${esc(p.short)}</li></ol></nav>
<section id="work" class="project"><div class="section-label">CASE STUDY · ${p.cc ? `CODE CLINIC ${p.cc} · ` : ''}${esc(z.name.toUpperCase())}</div>
<div class="project-heading"><h1 class="title${p.title.length > 26 ? ' long' : ''}">${esc(p.title)}<i class="dot" aria-hidden="true"></i></h1><div><span class="pill">${esc(p.domain.toUpperCase())}</span><p>${code(p.summary)}</p><div class="project-actions">${demo}<a class="text-link" href="${esc(p.repo_url)}">Source on GitHub</a><a class="text-link" href="${base}index.html#p-${p.name}">Show on map</a></div></div></div>
<div class="isle">${heroScene(p)}<span class="tag">${esc(z.short.toUpperCase())}</span><span class="hint">${esc(z.climate)}</span></div>
<dl class="facts"><div><dt>Validation</dt><dd>${badge(p)}${vText}</dd></div><div><dt>Outcome</dt><dd>${code(p.outcome)}</dd></div><div><dt>Status</dt><dd>${code(p.status)}</dd></div><div><dt>Stack</dt><dd class="tags">${p.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</dd></div></dl>
${body}
${lims.length || steps.length ? `<div id="limitations" class="sub"><div class="sub-label">KNOWN LIMITATIONS</div><div class="honest">${lims.length ? `<h2>What this does not prove.</h2><ul>${lims.map((l) => `<li>${code(l)}</li>`).join('')}</ul>` : ''}${steps.length ? `<h2${lims.length ? ' class="gap"' : ''}>Next steps.</h2><ul>${steps.map((l) => `<li>${code(l)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
</section>
<nav class="pn" aria-label="More islands in this zone">${peers.length > 1 ? `<a href="${prev.name}.html" rel="prev"><span>← Previous island</span><b>${esc(prev.short)}</b></a>` : '<span></span>'}<a class="mid" href="${base}index.html#p-${p.name}"><span>${esc(z.name)}</span><b>Show on map</b></a>${peers.length > 1 ? `<a href="${next.name}.html" rel="next"><span>Next island →</span><b>${esc(next.short)}</b></a>` : '<span></span>'}</nav>
</main>${footer(base)}${scripts}</body></html>
`;
}

/* ---------- all projects ---------- */
function listPage() {
  const sorted = [...projects].sort((a, b) => zones.indexOf(a.zone) - zones.indexOf(b.zone) || (a.challenge_number ?? 0) - (b.challenge_number ?? 0) || a.zone.islands.indexOf(a) - b.zone.islands.indexOf(b));
  const opt = (vals) => vals.map((v) => `<option value="${esc(Array.isArray(v) ? v[0] : v)}">${esc(Array.isArray(v) ? v[1] : v)}</option>`).join('');
  const stacks = [...new Set(projects.flatMap((p) => p.stack))].sort((a, b) => a.localeCompare(b));
  const domains = [...new Set(projects.map((p) => p.domain))].sort((a, b) => a.localeCompare(b));
  const rows = sorted.map((p) => `<tr data-zone="${p.zone.id}" data-domain="${esc(p.domain)}" data-stack="${esc(p.stack.join('|'))}" data-v="${p.v}" data-text="${esc(`${p.name} ${p.title} ${p.summary} ${p.domain} ${p.stack.join(' ')} ${p.zone.name}`.toLowerCase())}">
<td data-l="Project"><a class="pt" href="${p.href}">${p.cc ? `<em>${p.cc}</em> ` : ''}${esc(p.title)}</a><span class="sum">${code(p.summary)}</span></td>
<td data-l="Zone"><a class="zdot" href="index.html#${p.zone.id}" style="--c:${p.zone.color}"><i></i>${esc(p.zone.short)}</a></td>
<td data-l="Domain">${esc(p.domain)}</td>
<td data-l="Stack"><span class="tags">${p.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</span></td>
<td data-l="Validation">${badge(p)}</td>
<td data-l="Links"><a class="text-link" href="${esc(p.repo_url)}" aria-label="Repo: ${esc(p.title)}">Repo</a>${p.demo_url && !(p.demo_url.startsWith(SITE.url) && p.name !== 'cloud-portfolio') && p.name !== 'zeinhaidara' ? ` <a class="text-link" href="${esc(p.demo_url)}" aria-label="Demo: ${esc(p.title)}">Demo</a>` : ''}</td></tr>`).join('\n');
  const counts = Object.keys(VAL).map((k) => [k, projects.filter((p) => p.v === k).length]).filter(([, c]) => c);
  const desc = `All ${projects.length} public projects by Zein in one filterable table: zone, domain, stack and how each one was validated.`;
  return `<!doctype html>
<html lang="en" data-mode="day"><head>${head({ title: 'All projects · Zein Cloud Portfolio', desc, path: 'projects.html', css: ['tokens.css', 'style.css', 'theme.css'] })}
</head>
<body style="${skyVars(zoneById.capital)}">${backdrop}<header><a class="brand" href="index.html">ZEIN<span> / CLOUD ENGINEERING</span></a><nav aria-label="Main navigation"><a href="index.html">World</a><a href="projects.html" aria-current="page">All projects</a><a class="pill-link" href="mailto:${SITE.email}">Contact</a><a class="nav-contact" href="${SITE.github}">GitHub</a></nav></header>
<main id="home">
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">World</a></li><li aria-current="page">All projects</li></ol></nav>
<section class="project list"><div class="section-label">ALL PROJECTS · ${projects.length} PUBLIC REPOSITORIES</div>
<div class="project-heading"><h1 class="title">Every island, <br>one table<i class="dot" aria-hidden="true"></i></h1><div><p>The fast path: filter by zone, domain, stack or how the work was validated. Each row opens a case study generated from the same data as the map.</p><p class="legend">${counts.map(([k, c]) => `<span class="st ${VAL[k][1]}">${VAL[k][0].toUpperCase()}</span> ${c}`).join(' &nbsp; ')}</p></div></div>
<form class="filters" id="filters" role="search" aria-label="Filter projects">
<label>Search<input type="search" id="f-q" name="q" placeholder="Name, tool, keyword…"></label>
<label>Zone<select id="f-zone" name="zone"><option value="">All zones</option>${opt(zones.filter((z) => z.islands.length).map((z) => [z.id, z.name]))}</select></label>
<label>Domain<select id="f-domain" name="domain"><option value="">All domains</option>${opt(domains)}</select></label>
<label>Stack<select id="f-stack" name="stack"><option value="">Any tool</option>${opt(stacks)}</select></label>
<label>Validation<select id="f-v" name="v"><option value="">Any level</option>${opt(counts.map(([k]) => [k, VAL[k][0]]))}</select></label>
<button type="reset" class="pill">Clear</button>
</form>
<p class="count" id="count" aria-live="polite">${projects.length} of ${projects.length} projects</p>
<div class="table-wrap plist"><table id="plist"><thead><tr><th scope="col">Project</th><th scope="col">Zone</th><th scope="col">Domain</th><th scope="col">Stack</th><th scope="col">Validation</th><th scope="col">Links</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<p class="muted empty" id="empty" hidden>No project matches these filters. <button type="button" class="linklike" id="f-clear">Clear filters</button></p>
<p class="muted">Validation levels: <b>Run on real cloud</b> means the stack was deployed and exercised in a cloud account (most are torn down now). <b>CI with mocks only</b> means tests ran against mocks, fakes or fixtures and nothing was deployed. <b>Source review only</b> means configuration was reviewed but not executed. <b>Not run</b> means no execution evidence.</p>
</section></main>${footer('')}<script src="site.js" defer></script></body></html>
`;
}

/* ---------- small pages ---------- */
const redirect = (to) => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moved · Zein Cloud Portfolio</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE.url}${to}"><script>location.replace('${to}' + location.hash)</script><meta http-equiv="refresh" content="1; url=${to}"></head>
<body><p>This page has moved to <a href="${to}">${to}</a>.</p></body></html>
`;
const notFound = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uncharted · Zein Cloud Portfolio</title><meta name="robots" content="noindex">
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:linear-gradient(#7fa9cc,#c9dceb 48%,#e9e2d8);color:#1d2340;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}h1{font-size:clamp(34px,6vw,58px);letter-spacing:-.04em;margin:18px 0 8px}a{display:inline-block;margin:8px 6px;padding:11px 20px;border-radius:30px;background:#1d2340;color:#fff;text-decoration:none;font-weight:700}a+a{background:#f8fafc;color:#1d2340}svg{width:150px}</style></head>
<body><main><svg viewBox="-115 -40 230 150" aria-hidden="true">${ghostIsland(1).replace(/class="gh"/g, 'stroke="#1d2340" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round"')}</svg><h1>Uncharted water.</h1><p>There is no island at this address.</p><p><a id="h" href="./">Back to the world</a><a id="p" href="./projects.html">All projects</a></p></main>
<script>var b=/github\\.io$/.test(location.hostname)?'/'+location.pathname.split('/')[1]+'/':'/';document.getElementById('h').href=b;document.getElementById('p').href=b+'projects.html'</script></body></html>
`;
const today = projects.map((p) => p.last_push).filter(Boolean).sort().pop();
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', 'projects.html', ...projects.map((p) => p.href)].map((u) => `<url><loc>${SITE.url}${u}</loc><lastmod>${(byName[u.slice(9, -5)] || {}).last_push || today}</lastmod></url>`).join('\n')}
</urlset>
`;

/* ---------- write or check ---------- */
const out = new Map();
const { html: indexHtml, placement } = indexPage();
out.set('index.html', indexHtml);
out.set('projects.html', listPage());
out.set('world/placement.json', JSON.stringify(placement, null, 1) + '\n');
for (const z of zones) out.set(`world/${z.id}.json`, JSON.stringify(zoneData(z)) + '\n');
for (const p of projects) out.set(p.href, casePage(p));
for (const [from, to] of Object.entries(W.redirects)) out.set(from, redirect(to));
out.set('404.html', notFound);
out.set('sitemap.xml', sitemap);
out.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.url}sitemap.xml\n`);

const check = args.includes('--check');
let stale = [];
for (const dir of ['projects', 'world']) {
  if (!existsSync(resolve(root, dir))) continue;
  for (const f of readdirSync(resolve(root, dir))) if (!out.has(`${dir}/${f}`)) { if (check) stale.push(`${dir}/${f} (not generated any more)`); else unlinkSync(resolve(root, dir, f)); }
}
for (const [path, content] of out) {
  const abs = resolve(root, path);
  if (check) { if (!existsSync(abs) || readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') !== content) stale.push(path); continue; }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}
const priv = json('data/projects.json').filter((p) => p.visibility !== 'PUBLIC');
if (priv.length) { console.error(`data/projects.json holds ${priv.length} non-public entries; they are never rendered, but remove them.`); process.exitCode = 1; }
if (check) {
  if (stale.length) { console.error('Generated output is out of date. Run `node scripts/build.mjs` and commit:\n  ' + stale.join('\n  ')); process.exitCode = 1; }
  else console.log(`up to date: ${out.size} generated files`);
} else {
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KiB';
  console.log(`built ${out.size} files: ${projects.length} case studies, ${zones.length} zones, ${placement.uncharted.length} uncharted slots; index.html ${kb(indexHtml)}`);
}
