// Generates the whole site from data/projects.json and data/world.json. No dependencies.
//   node scripts/build.mjs                 write index.html, projects.html, projects/, world/, redirects, sitemap
//   node scripts/build.mjs --check         fail if the committed output differs from a fresh build (CI)
//   node scripts/build.mjs --sync [file]   first refresh data/projects.json from the audit file
//                                          (default ../_audit/projects.json), public repositories only
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { island, ghostIsland, icon, pickBuilding, relight, cloud } from './lib/art.mjs';

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
const r2 = (v) => Math.round(v * 100) / 100;
// 3D layout: the capital at the origin, ten zones on a ring (zone n at -90° + 36°·(n-1)), the archive islet outside it
const R3 = W.ring3d;
for (const z of zones) {
  if (z.id === 'capital') Object.assign(z, { cx: 0, cz: 0, r: R3.capitalRadius });
  else if (z.id === 'archive') Object.assign(z, { cx: r2(Math.cos(rad(R3.archive.angle)) * R3.archive.radius), cz: r2(Math.sin(rad(R3.archive.angle)) * R3.archive.radius), r: R3.archive.zoneRadius });
  else { const a = rad(-90 + (z.n - 1) * 36); Object.assign(z, { cx: r2(Math.cos(a) * R3.radius), cz: r2(Math.sin(a) * R3.radius), r: R3.zoneRadius }); }
  z.islands = []; z.slots = [];
}
for (const p of projects) {
  const z = zoneById[zoneOf(p)], pl = W.placements[p.name] || {};
  p.zone = z; p.v = vcat(p.validation_level);
  p.short = pl.short || p.title; p.color = pl.color || z.color; p.size = pl.size || 0.92;
  p.ground = pl.ground || z.ground; p.building = pl.building || pickBuilding(p);
  p.cc = Number.isInteger(p.challenge_number) ? String(p.challenge_number).padStart(2, '0') : null;
  p.href = `projects/${p.name}.html`;
  if (z.id === 'capital' && pl.orbit != null) Object.assign(p, { orbit: pl.orbit, speed: pl.speed, phase: pl.phase });
  z.islands.push(p);
}
for (const z of zones) {
  if (z.range) {
    // five fixed slots, one per challenge number; an empty slot is an uncharted island
    for (let k = z.range[0]; k <= z.range[1]; k++) {
      const p = z.islands.find((q) => q.challenge_number === k);
      if (p) p.slot = k - z.range[0];
      z.slots.push({ n: k, slot: k - z.range[0], p });
    }
    z.islands.sort((a, b) => (a.challenge_number ?? 99) - (b.challenge_number ?? 99));
  } else if (z.id === 'capital') {
    z.islands.sort((a, b) => (a.orbit ?? 99) - (b.orbit ?? 99));
  }
}
const byName = Object.fromEntries(projects.map((p) => [p.name, p]));
const night = (z) => z.mode === 'night';
const zoneLabel = (z) => (z.range ? `Zone ${String(z.n).padStart(2, '0')} · ${String(z.range[0]).padStart(2, '0')}–${z.range[1]}` : z.id === 'capital' ? 'Centre of the world' : 'Offshore');

/* ---------- island art ---------- */
const artOf = (p) => relight(island({ ground: p.ground, building: p.building, color: p.color, size: p.size, seed: p.name, night: night(p.zone) }), p.zone.light);
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
function zoneCard(z) {
  const items = (z.range ? z.slots : z.islands.map((p) => ({ p }))).map((s) => s.p
    ? `<li id="p-${s.p.name}"><a href="${s.p.href}"><b>${s.p.cc ? `<em>${s.p.cc}</em> ` : ''}${esc(s.p.title)}</b><span>${esc(s.p.domain)}</span></a>${badge(s.p)}</li>`
    : `<li class="soon"><b><em>${s.n}</em> Uncharted island</b><span>Coming soon</span></li>`).join('');
  const also = z.id === 'capital' ? `<p class="also">Also linked from the capital: ${W.capitalLinks.filter((nm) => byName[nm]).map((nm) => `<a href="${byName[nm].href}">${byName[nm].cc} · ${esc(byName[nm].title)}</a>`).join(', ')}.</p>` : '';
  return `<section class="zcard" id="${z.id}" data-mode="${z.mode}" style="${skyVars(z)}" aria-labelledby="zt-${z.id}"><div class="zhead">${iconSvg(z, 52)}<div><span class="kind">${esc(zoneLabel(z))}</span><h2 id="zt-${z.id}">${esc(z.name)}</h2><p>${esc(z.climate)}. ${esc(z.blurb)}</p></div></div><ul>${items}</ul>${also}</section>`;
}
function indexPage() {
  const placement = {
    ring: R3,
    zones: zones.map((z) => ({ id: z.id, n: z.n, name: z.name, short: z.short, color: z.color, x: z.cx, z: z.cz, r: z.r, sky: z.sky, air: z.air, range: z.range || null })),
    islands: projects.map((p) => ({ name: p.name, title: p.title, short: p.short, zone: p.zone.id, href: p.href, cc: p.cc, v: p.v, vl: VAL[p.v][0], vc: VAL[p.v][1], color: p.color, size: p.size, ground: p.ground, building: p.building,
      summary: p.summary, domain: p.domain, stack: p.stack, repo: p.repo_url, slot: p.slot ?? null, orbit: p.orbit ?? null, speed: p.speed ?? null, phase: p.phase ?? null })),
    uncharted: zones.flatMap((z) => z.slots.filter((s) => !s.p).map((s) => ({ n: s.n, zone: z.id, slot: s.slot }))),
    contact: { email: SITE.email, github: SITE.github },
  };
  const dock = zones.map((z) => `<a href="#${z.id}" data-fly="${z.id}" style="--c:${z.color}"><i></i>${esc(z.short)}</a>`).join('');
  const mini = zones.map((z) => `<a href="#${z.id}" data-fly="${z.id}" aria-label="${esc(z.name)}"><circle cx="${z.cx}" cy="${z.cz}" r="${z.r * 0.72}" fill="${z.sky[1]}" stroke="${z.color}" stroke-width="5"/></a>`).join('');
  const labels = zones.map((z) => `<a class="zlabel" id="zl-${z.id}" href="#${z.id}" data-fly="${z.id}" style="--c:${z.color}">${iconSvg(z, 30)}<b>${esc(z.short)}</b></a>`).join('')
    + projects.map((p) => `<a class="plabel" id="l-${p.name}" href="${p.href}" data-id="${p.name}" style="--c:${p.color}"><i></i>${p.cc ? `<em>${p.cc}</em> ` : ''}<span class="t">${esc(p.short)}</span><span class="vh">${p.short === p.title ? '' : ` (${esc(p.title)})`}. ${esc(VAL[p.v][0])}.</span><b class="check" aria-hidden="true"></b></a>`).join('')
    + placement.uncharted.map((u) => `<span class="plabel ghost" id="g-${u.n}"><em>${u.n}</em><span class="t">Uncharted · coming soon</span></span>`).join('');
  const desc = 'Cloud engineering projects by Zein as one 3D world of floating islands: a capital of flagship platforms around the sun, ringed by ten climate zones, one per Code Clinic domain. AWS, Azure and Google Cloud.';
  const html = `<!doctype html>
<html lang="en"><head>${head({ title: SITE.title, desc, path: '', css: ['tokens.css', 'world.css'] })}
</head>
<body>
<script>try{var c=document.createElement('canvas');if(!/[?&]view=list/.test(location.search)&&sessionStorage.getItem('zein-view')!=='list'&&window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))document.body.className='gl'}catch(e){}</script>
<canvas id="stage" aria-hidden="true"></canvas>
<div class="labels" id="labels">${labels}</div>
<header class="top"><a class="brand" href="index.html">ZEIN<span> / CLOUD ENGINEERING</span></a>
 <form class="search" id="search" role="search" autocomplete="off"><label class="vh" for="q">Find a project</label><input id="q" type="search" placeholder="Find a project…" aria-controls="q-list" aria-expanded="false" role="combobox" aria-autocomplete="list"><ul id="q-list" role="listbox" hidden></ul></form>
 <nav aria-label="Main navigation"><a href="projects.html">All projects</a><button class="pill" type="button" id="b-view" aria-pressed="false" hidden>List view</button><a class="pill gh" href="${SITE.github}">GitHub</a><a class="pill" href="mailto:${SITE.email}">Contact</a></nav></header>
<main>
<section class="intro"><div class="eyebrow">AWS · AZURE · GCP · INFRASTRUCTURE · APPLICATIONS</div>
 <h1>Ideas into systems.<br><span>Built in the cloud.</span></h1>
 <p>Every island is a project I built. The flagships circle the sun; ten climate zones ring them, one per Code Clinic domain. <span class="d">Drag to look around, pick a zone below to fly there. The balloon says hi.</span><span class="m">Pick a zone below, or open <a href="projects.html">the full list</a>.</span></p></section>
<aside class="panel" id="panel" hidden aria-live="polite"><button class="close" id="p-close" type="button" aria-label="Close project">✕</button><span class="kind" id="p-kind"></span><h2 id="p-title"></h2><p class="pv"><span class="st" id="p-val"></span></p><p id="p-blurb"></p><div class="tags" id="p-tags"></div><div class="actions"><a class="cta" id="p-main" href="#">Read the case study</a><a class="link" id="p-src" href="#">Source on GitHub</a></div></aside>
<div class="zones" id="zones"><h2 class="vh">Zones and projects</h2>${zones.map(zoneCard).join('')}</div>
<div class="hud" id="hud">
 <div class="ctl" role="group" aria-label="Camera controls"><button type="button" id="b-home" title="Capital (Home)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg><span>Capital</span></button><button type="button" id="b-all" title="Whole world (0)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none"/><circle cx="12" cy="12" r="2.6"/></svg><span>World</span></button><button type="button" id="b-in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" id="b-out" aria-label="Zoom out" title="Zoom out (−)">−</button></div>
 <div class="minimap" id="minimap"><svg viewBox="-250 -250 500 500" role="img" aria-label="Minimap of the zone ring. The orange dot is where the camera is looking."><title>Minimap</title><circle cx="0" cy="0" r="${R3.radius}" class="orbit"/>${mini}<g id="mm-here"><circle r="20" class="p"/><circle r="9"/></g></svg><span id="mm-where" aria-live="polite">Capital</span></div>
</div>
<nav class="dock" id="dock" aria-label="Zones"><span class="score" id="score"></span>${dock}</nav>
<div class="toast" id="toast" role="status" hidden><b>Every island explored.</b> Thanks for the visit. <a href="mailto:${SITE.email}">Say hi ✉</a></div>
</main>
<script type="application/json" id="placement">${JSON.stringify(placement)}</script>
<script type="module" src="app.js"></script>
</body></html>
`;
  return { html, placement };
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
