// Static site generator for the island atlas. No dependencies.
// Reads data/projects.json and data/world.json, writes every page into the repo root.
//   node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEW, coastline, cells, toPath, smoothPath, centroid, blob, r1 } from './lib/geometry.mjs';
import { scene, icon } from './lib/scenery.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const world = JSON.parse(read('data/world.json'));
const projects = JSON.parse(read('data/projects.json')).filter((p) => p.visibility === 'PUBLIC');
const checking = process.argv.includes('--check');
const site = world.site;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const pad = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- model
const regions = world.regions;
const places = [world.capital, ...regions, world.archive]; // navigation order
const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
const regionForNumber = (n) => regions.find((r) => n >= r.range[0] && n <= r.range[1]);

function validation(level) {
  const l = (level || '').toLowerCase();
  if (l.startsWith('run on real cloud')) return { key: 'real', label: 'Run on real cloud' };
  if (l.startsWith('ci with mocks')) return { key: 'mocks', label: 'CI with mocks only' };
  if (l.startsWith('not run')) return { key: 'none', label: 'Not run' };
  return { key: 'review', label: 'Source review only' };
}

for (const p of projects) {
  const cc = Number.isInteger(p.challenge_number);
  const place = world.placement[p.name];
  if (cc) {
    const r = regionForNumber(p.challenge_number);
    if (!r) throw new Error(`No region covers challenge ${p.challenge_number} (${p.name})`);
    p.home = r.id;
    p.also = p.tier === 'Flagship' ? ['capital'] : [];
    p.order = p.challenge_number;
  } else if (p.archived) {
    p.home = 'archive'; p.also = []; p.order = place?.order ?? 99;
  } else {
    // Unplaced non-Code-Clinic repos default to the capital, so a new entry never disappears.
    p.home = place?.home ?? 'capital'; p.also = place?.also ?? []; p.order = place?.order ?? 99;
  }
  p.kind = p.archived ? 'Archived' : p.tier === 'Flagship' ? 'Flagship' : cc ? 'Code Clinic' : 'Project';
  p.val = validation(p.validation_level);
  p.href = `projects/${p.name}.html`;
  p.domains = p.domain.split(' / ').map((s) => s.trim());
  p.content = existsSync(resolve(root, `content/${p.name}.html`)) ? read(`content/${p.name}.html`) : '';
}
const byName = Object.fromEntries(projects.map((p) => [p.name, p]));
const homeList = (id) => projects.filter((p) => p.home === id).sort((a, b) => a.order - b.order);
const alsoList = (id) => projects.filter((p) => p.also.includes(id)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
for (const pl of places) {
  pl.href = `regions/${pl.id}.html`;
  pl.projects = homeList(pl.id);
  pl.visiting = alsoList(pl.id);
  pl.slots = pl.range ? Array.from({ length: pl.range[1] - pl.range[0] + 1 }, (_, i) => pl.range[0] + i) : [];
  pl.label = pl.n > 0 ? pad(pl.n) : pl.n === 0 ? '★' : '⚓';
  pl.rangeText = pl.range ? `Code Clinic ${pad(pl.range[0])} to ${pad(pl.range[1])}` : pl.id === 'capital' ? 'Flagship platforms' : 'Archived work';
  pl.countText = pl.range ? `${pl.projects.length} of ${pl.slots.length} charted` : `${pl.projects.length} ${pl.projects.length === 1 ? 'project' : 'projects'}`;
}

// ---------------------------------------------------------------- colour and contrast
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
function contrast(a, b) {
  const lum = (h) => { const [r, g, bl] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const BADGE = {
  light: { real: ['#14562f', '#dcf2e3'], mocks: ['#6f4300', '#fbe8c2'], none: ['#454c5a', '#e7e2d5'], review: ['#553a85', '#ece3f8'] },
  dark: { real: ['#8fe0b0', '#12301f'], mocks: ['#f5cf85', '#3a2a08'], none: ['#c8cfdb', '#252d3a'], review: ['#cdb7f2', '#2a2140'] },
};
const darkPalette = (p) => ({ sky: mix(p.sky, '#0b1220', 0.62), far: mix(p.far, '#0b1220', 0.52), land: mix(p.land, '#0b1220', 0.46), land2: mix(p.land2, '#0b1220', 0.46), feature: mix(p.feature, '#0b1220', 0.3), pop: mix(p.pop, '#ffffff', 0.08) });

function checkContrast() {
  const fails = [];
  const need = (what, fg, bg, min = 4.5) => { const c = contrast(fg, bg); if (c < min) fails.push(`${what}: ${fg} on ${bg} = ${c.toFixed(2)} (needs ${min})`); };
  for (const mode of ['light', 'dark']) {
    const t = world.tokens[mode];
    need(`${mode} ink/paper`, t.ink, t.paper); need(`${mode} ink/surface`, t.ink, t.surface);
    need(`${mode} muted/paper`, t.muted, t.paper); need(`${mode} muted/surface`, t.muted, t.surface);
    for (const [k, [fg, bg]] of Object.entries(BADGE[mode])) need(`${mode} badge ${k}`, fg, bg);
    for (const pl of places) {
      need(`${mode} accent ${pl.id}/paper`, pl.accent[mode], t.paper);
      need(`${mode} accent ${pl.id}/surface`, pl.accent[mode], t.surface);
      need(`${mode} button ${pl.id}`, mode === 'light' ? '#ffffff' : '#0f141d', pl.accent[mode]);
    }
  }
  if (fails.length) throw new Error('WCAG AA contrast failures:\n  ' + fails.join('\n  '));
  return places.length * 6 + 16;
}

function paletteCss() {
  const vars = (p, accent, extra = '') => `--c-sky:${p.sky};--c-far:${p.far};--c-land:${p.land};--c-land2:${p.land2};--c-feat:${p.feature};--c-pop:${p.pop};--accent:${accent};${extra}`;
  const tok = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
  const badge = (m) => Object.entries(BADGE[m]).map(([k, [fg, bg]]) => `--b-${k}:${fg};--b-${k}-bg:${bg}`).join(';');
  let css = `:root{${tok(world.tokens.light)};${badge('light')};--on-accent:#fff}\n:root[data-theme=dark]{${tok(world.tokens.dark)};${badge('dark')};--on-accent:#0f141d}\n`;
  for (const pl of places) {
    css += `.rg-${pl.id}{${vars(pl.palette, pl.accent.light)}}\n:root[data-theme=dark] .rg-${pl.id}{${vars(darkPalette(pl.palette), pl.accent.dark)}}\n`;
  }
  return css;
}

// ---------------------------------------------------------------- map
const coast = coastline();
const mainland = [...regions, world.capital];
const cellPolys = cells(coast, mainland.map((r) => r.seed));
mainland.forEach((r, i) => { r.poly = cellPolys[i]; r.center = centroid(cellPolys[i]); });
world.archive.poly = blob(world.archive.seed[0], world.archive.seed[1], 52, 34, 2.2);
world.archive.center = world.archive.seed;
const floes = [blob(455, 38, 22, 11, 1), blob(585, 30, 26, 12, 3), blob(640, 62, 16, 8, 5), blob(390, 66, 14, 7, 7)];

function mapSvg(rel, { mini = false, current = null } = {}) {
  const sea = `<rect class="m-sea" width="${VIEW.w}" height="${VIEW.h}"/>`;
  const swells = mini ? '' : [[70, 120], [120, 560], [850, 90], [760, 640], [60, 360], [930, 420], [330, 640]].map(([x, y]) => `<path class="m-swell" d="M${x} ${y}q10 -8 20 0t20 0"/>`).join('');
  const compass = mini ? '' : `<g class="m-compass" transform="translate(92 590)"><circle r="34"/><path d="M0 -44L8 0L0 44L-8 0Z"/><path class="m-compass-e" d="M-44 0L0 -8L44 0L0 8Z"/><text y="-50" text-anchor="middle">N</text></g>`;
  const shape = (pl) => (pl.id === 'archive' ? smoothPath(pl.poly) : toPath(pl.poly));
  const cell = (pl) => {
    const [cx, cy] = pl.center.map(r1);
    const here = current === pl.id;
    const uncharted = pl.range && pl.projects.length === 0;
    if (mini) return `<path class="rg-${pl.id} mm-cell${here ? ' is-here' : ''}" d="${shape(pl)}"/>`;
    const title = `${pl.place}: ${pl.name}. ${pl.climate}. ${pl.countText}.`;
    return `<a class="rg-${pl.id} cell${uncharted ? ' is-uncharted' : ''}" href="${rel}${pl.href}" data-place="${esc(pl.place)}" data-name="${esc(pl.name)}" data-climate="${esc(pl.climate)}" data-count="${esc(pl.countText)}" data-range="${esc(pl.rangeText)}" aria-label="${esc(title)}"><title>${esc(title)}</title><path class="cell-shape" d="${shape(pl)}"/><g class="cell-icon" transform="translate(${cx} ${r1(cy - 14)})">${icon(pl.scene)}</g><g transform="translate(${cx} ${r1(cy + 22)})"><rect class="cell-tag" x="-17" y="-11" width="34" height="22" rx="11"/><text class="cell-num" y="5" text-anchor="middle">${pl.label}</text></g><text class="cell-name" x="${cx}" y="${r1(cy + 48)}" text-anchor="middle">${esc(pl.place)}</text>${uncharted ? `<text class="cell-note" x="${cx}" y="${r1(cy + 63)}" text-anchor="middle">UNCHARTED</text>` : ''}</a>`;
  };
  const coastPath = `<path class="m-shore" d="${smoothPath(coast)}"/><path class="m-coast" d="${smoothPath(coast)}"/>`;
  const ice = floes.map((f) => `<path class="rg-networking m-floe" d="${smoothPath(f)}"/>`).join('');
  const hereDot = mini && current ? `<circle class="mm-dot" cx="${r1(placeById[current].center[0])}" cy="${r1(placeById[current].center[1])}" r="26"/>` : '';
  const label = mini ? '' : ` role="group" aria-label="Map of the island: ten regions, the capital harbor and the archive islet. Each region is a link."`;
  return `<svg class="${mini ? 'minimap' : 'map'}" viewBox="0 0 ${VIEW.w} ${VIEW.h}"${mini ? ' aria-hidden="true" focusable="false"' : label}>${sea}${swells}${compass}${mini ? '' : `<path class="m-shore" d="${smoothPath(world.archive.poly)}"/>`}${ice}<path class="m-under" d="${smoothPath(coast)}"/>${[...mainland, world.archive].map(cell).join('')}${mini ? '' : coastPath}${hereDot}</svg>`;
}

// ---------------------------------------------------------------- shared markup
const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231f2430'/%3E%3Cpath d='M5 21q5-12 11-12t11 12z' fill='%237cc06a' stroke='%23f6f1e4' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='M4 24h24' stroke='%23bfe0e4' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E`;
const THEME_BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('atlas-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.theme=t;if(localStorage.getItem('atlas-calm')==='1')d.dataset.calm='1'}catch(e){d.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.classList.add('js')})()`;

const badge = (p) => `<span class="badge b-${p.val.key}" title="${esc(p.validation_level)}"><i aria-hidden="true"></i>${p.val.label}</span>`;
const kindChip = (p) => `<span class="chip k-${p.kind.toLowerCase().replace(' ', '-')}">${p.kind}${Number.isInteger(p.challenge_number) ? ' ' + pad(p.challenge_number) : ''}</span>`;

function legend(rel, current) {
  return `<ol class="legend">${places.map((pl) => `<li class="rg-${pl.id}"><a href="${rel}${pl.href}"${current === pl.id ? ' aria-current="page"' : ''}><svg class="lg-icon" viewBox="-30 -30 60 50" aria-hidden="true" focusable="false">${icon(pl.scene)}</svg><span class="lg-num">${pl.label}</span><span class="lg-text"><b>${esc(pl.name)}</b><small>${esc(pl.place)} · ${esc(pl.climate)} · ${esc(pl.rangeText)} · ${esc(pl.countText)}</small></span></a></li>`).join('')}</ol>`;
}

function topbar(rel, current) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="top"><a class="brand" href="${rel}index.html"><svg viewBox="0 0 32 24" aria-hidden="true" focusable="false"><path class="o c-land" d="M3 17q5-12 13-12t13 12z"/><path class="o" fill="none" d="M1 21h30"/></svg><span>${esc(site.short)} <em>atlas</em></span></a>
<nav class="nav" aria-label="Main"><a href="${rel}index.html#map">Map</a>
<details class="menu"><summary>Regions</summary><div class="menu-panel">${legend(rel, current)}</div></details>
<a href="${rel}projects.html">All projects</a>
<form class="search" role="search" action="${rel}projects.html" method="get"><label class="vh" for="q-top">Search projects</label><input id="q-top" name="q" type="search" placeholder="Search projects" autocomplete="off"><button type="submit" aria-label="Search"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l5 5"/></svg></button></form>
<button class="tool js-only" id="calm" type="button" aria-pressed="false" title="Turn weather and motion on or off">Weather</button>
<button class="tool js-only" id="theme" type="button" aria-pressed="false" title="Switch between light and dark">Theme</button></nav></header>`;
}

function locator(rel, crumbs, current) {
  const idx = places.findIndex((p) => p.id === current);
  const prev = idx >= 0 ? places[(idx - 1 + places.length) % places.length] : null;
  const next = idx >= 0 ? places[(idx + 1) % places.length] : null;
  const here = current ? placeById[current] : null;
  const trail = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${esc(c[0])}</li>` : `<li><a href="${rel}${c[1]}">${esc(c[0])}</a></li>`)).join('');
  return `<div class="locator${current ? ' rg-' + current : ''}"><a class="mini" href="${rel}index.html#map" aria-label="Open the island map">${mapSvg(rel, { mini: true, current })}</a>
<div class="loc-text"><nav aria-label="Breadcrumb"><ol class="crumbs">${trail}</ol></nav><p class="here">${here ? `You are here: <b>${esc(here.place)}</b> · ${esc(here.climate)}` : 'The whole island'}</p></div>
${prev ? `<nav class="hop" aria-label="Neighbouring regions"><a href="${rel}${prev.href}" rel="prev"><span aria-hidden="true">←</span> <span class="hop-t">${esc(prev.place)}</span><span class="vh"> (previous region)</span></a><a href="${rel}${next.href}" rel="next"><span class="hop-t">${esc(next.place)}</span><span class="vh"> (next region)</span> <span aria-hidden="true">→</span></a></nav>` : ''}</div>`;
}

const footer = (rel) => `<footer class="foot"><p><b>${esc(site.owner)}</b> · cloud, DevSecOps and Linux engineering</p><p><a href="${site.github}">GitHub</a> · <a href="mailto:${site.email}">${site.email}</a> · <a href="${rel}projects.html">All projects</a> · <a href="${rel}index.html#legend">Legend</a></p><p class="fine">Demo environments are torn down after capture to control cost. Every project states how it was validated. Set in Young Serif (SIL OFL).</p></footer>`;

function page({ path, title, desc, current = null, crumbs, body, scripts = [], bodyClass = '' }) {
  const depth = path.split('/').length - 1;
  const rel = '../'.repeat(depth);
  const url = site.url + (path === 'index.html' ? '' : path);
  const full = title === site.title ? title : `${title} · ${site.short} atlas`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${site.url}og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark"><link rel="icon" type="image/svg+xml" href="${FAVICON}">
<script>${THEME_BOOT}</script>
<link rel="preload" href="${rel}assets/fonts/young-serif-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/site.css">
</head>
<body class="rg-${current || 'capital'} ${bodyClass}" data-region="${current || ''}" data-rel="${rel}">
${topbar(rel, current)}
${locator(rel, crumbs, current)}
<main id="main">
${body(rel)}
</main>
${footer(rel)}
<script src="${rel}assets/site.js" defer></script>${scripts.map((s) => `<script src="${rel}${s}" defer></script>`).join('')}
</body></html>
`;
}

const card = (p, rel, { visiting = false } = {}) => `<article class="card rg-${p.home}"><p class="card-meta">${kindChip(p)}${visiting ? `<span class="chip k-visit">from ${esc(placeById[p.home].place)}</span>` : ''}</p><h3><a href="${rel}${p.href}">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p><p class="card-foot">${badge(p)}<span class="stack">${p.stack.slice(0, 4).map(esc).join(' · ')}</span></p></article>`;
const uncharted = (n) => `<article class="card is-uncharted" aria-label="Code Clinic ${pad(n)}: not built yet"><p class="card-meta"><span class="chip">Code Clinic ${pad(n)}</span></p><h3>Uncharted</h3><p>This challenge is not built yet. The slot fills in when its repository is added.</p><p class="card-foot"><span class="badge b-none"><i aria-hidden="true"></i>Coming soon</span></p></article>`;
const banner = (pl, small = false) => `<div class="scene${small ? ' is-small' : ''}" data-weather="${pl.weather}">${scene(pl.scene, `Illustration of ${pl.place}: ${pl.climate.toLowerCase()}.`)}<canvas class="weather" aria-hidden="true"></canvas></div>`;

// ---------------------------------------------------------------- pages
const out = new Map();
const emit = (path, html) => out.set(path, html);

// home
const flagships = projects.filter((p) => p.tier === 'Flagship' && p.home === 'capital').sort((a, b) => a.order - b.order);
const charted = projects.filter((p) => Number.isInteger(p.challenge_number)).length;
const totalSlots = regions.reduce((s, r) => s + r.slots.length, 0);
emit('index.html', page({
  path: 'index.html', title: site.title, bodyClass: 'home',
  desc: `${site.owner}: ${projects.length} public cloud, DevSecOps and Linux projects charted as one island. Ten regions, a capital harbor, and an honest validation level on every project.`,
  crumbs: [['Island', 'index.html']],
  body: (rel) => `<section class="hero"><p class="eyebrow">Cloud · DevSecOps · Linux</p><h1>One island. <span>Every project on the chart.</span></h1><p class="lede">I am ${esc(site.owner)}. This atlas maps ${projects.length} public repositories: ${flagships.length} platforms that ran on real cloud, and ${charted} of ${totalSlots} planned Code Clinic challenges. Each one says how it was validated.</p><p class="hero-cta"><a class="btn" href="${rel}projects.html">All projects, filterable</a><a class="btn ghost" href="#legend">Region legend</a></p></section>
<section class="map-section" id="map" aria-labelledby="map-h"><h2 id="map-h" class="vh">Island map</h2><div class="map-wrap">${mapSvg(rel)}<aside class="map-info" id="map-info" aria-live="polite"><p class="mi-eyebrow" id="mi-range">Hover or focus a region</p><p class="mi-title" id="mi-name">The island</p><p id="mi-climate">Ten regions, one capital, one archive islet.</p><p class="mi-count" id="mi-count">${projects.length} projects charted</p></aside></div><p class="map-hint">Each region is a link. Tab through the map, or use the legend below.</p></section>
<section class="legend-section" id="legend" aria-labelledby="legend-h"><h2 id="legend-h">Legend</h2><p class="sec-intro">Ten Code Clinic regions, five challenges each, plus the capital for larger platforms and an islet for archived work.</p>${legend(rel, null)}</section>
<section aria-labelledby="cap-h" class="rg-capital"><h2 id="cap-h">Moored in the capital</h2><p class="sec-intro">Multi-service platforms. <a class="tl" href="${rel}${world.capital.href}">Visit ${esc(world.capital.place)}</a> for all of them.</p><div class="cards">${flagships.map((p) => card(p, rel)).join('')}</div></section>`,
}));

// region pages
for (const pl of places) {
  const isRegion = Boolean(pl.range);
  emit(pl.href, page({
    path: pl.href, title: `${pl.name} (${pl.place})`, current: pl.id,
    desc: `${pl.place}, the ${pl.climate.toLowerCase()} region of the atlas: ${pl.name}. ${pl.countText}.`,
    crumbs: [['Island', 'index.html'], [pl.place, pl.href]],
    body: (rel) => `${banner(pl)}
<section class="region-head"><p class="eyebrow">${pl.n > 0 ? `Region ${pad(pl.n)}` : pl.id === 'capital' ? 'Capital' : 'Offshore'} · ${esc(pl.climate)}</p><h1>${esc(pl.name)}</h1><p class="lede">${esc(pl.blurb)}</p><dl class="facts"><div><dt>Place</dt><dd>${esc(pl.place)}</dd></div><div><dt>Holds</dt><dd>${esc(pl.rangeText)}</dd></div><div><dt>Charted</dt><dd>${esc(pl.countText)}</dd></div></dl></section>
<section aria-labelledby="p-h"><h2 id="p-h">${isRegion ? 'Challenges' : pl.id === 'archive' ? 'Archived projects' : 'Platforms and projects'}</h2>${pl.id === 'archive' ? '<p class="sec-intro">Archived on GitHub: read-only and no longer maintained.</p>' : ''}<div class="cards">${isRegion ? pl.slots.map((n) => { const p = pl.projects.find((x) => x.challenge_number === n); return p ? card(p, rel) : uncharted(n); }).join('') : pl.projects.map((p) => card(p, rel)).join('')}</div></section>
${pl.visiting.length ? `<section aria-labelledby="v-h"><h2 id="v-h">${pl.id === 'capital' ? 'Cross-listed from the regions' : 'Also relevant here'}</h2><p class="sec-intro">${pl.id === 'capital' ? 'Code Clinic work that carries flagship weight. Each lives in its own region.' : 'Larger platforms from the capital whose domain overlaps this region.'}</p><div class="cards">${pl.visiting.map((p) => card(p, rel, { visiting: true })).join('')}</div></section>` : ''}`,
  }));
}

// case studies
for (const p of projects) {
  const pl = placeById[p.home];
  const sibs = pl.projects;
  const i = sibs.indexOf(p);
  const prev = sibs[i - 1], next = sibs[i + 1];
  const list = (items) => `<ul>${items.map((s) => `<li>${code(s)}</li>`).join('')}</ul>`;
  const scripts = p.name === 'healthcare-eks-secops' ? ['assets/js/pipeline.js'] : p.name === 'gcp-ai-log-analyzer' ? ['assets/js/gcp-replay.js'] : [];
  emit(p.href, page({
    path: p.href, title: p.title, current: p.home, desc: p.summary, scripts, bodyClass: 'case',
    crumbs: [['Island', 'index.html'], [pl.place, pl.href], [p.title, p.href]],
    body: (rel) => `${banner(pl, true)}
<article class="study"><header class="study-head"><p class="eyebrow">${esc(p.domain)}</p><h1>${esc(p.title)}</h1><p class="lede">${esc(p.summary)}</p>
<p class="study-badges">${kindChip(p)}${badge(p)}${p.archived ? '<span class="chip k-archived">Archived on GitHub</span>' : ''}</p>
<p class="study-actions"><a class="btn" href="${p.repo_url}">Source on GitHub</a>${p.demo_url && !p.demo_url.includes('/cloud-portfolio/') && p.demo_url !== site.github ? `<a class="btn ghost" href="${p.demo_url}">Open the live demo</a>` : ''}</p></header>
<dl class="facts wide"><div><dt>Result</dt><dd>${code(p.outcome)}</dd></div><div><dt>Status</dt><dd>${code(p.status)}</dd></div><div><dt>Validation</dt><dd>${code(p.validation_level)}</dd></div><div><dt>Region</dt><dd><a class="tl" href="${rel}${pl.href}">${esc(pl.place)}</a>${p.also.length ? ' · also in ' + p.also.map((a) => `<a class="tl" href="${rel}${placeById[a].href}">${esc(placeById[a].place)}</a>`).join(', ') : ''}</dd></div></dl>
<section aria-labelledby="st-h" class="stack-sec"><h2 id="st-h">Stack</h2><ul class="chips">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
${p.content ? `<div class="legacy">${p.content.replace(/(src|href)="assets\//g, `$1="${rel}assets/`)}</div>` : ''}
${p.known_limitations.length ? `<section aria-labelledby="kl-h" class="risk"><h2 id="kl-h">Known limitations</h2>${list(p.known_limitations)}</section>` : ''}
${p.next_steps.length ? `<section aria-labelledby="ns-h"><h2 id="ns-h">Next steps</h2>${list(p.next_steps)}</section>` : ''}
<nav class="pager" aria-label="Projects in ${esc(pl.place)}">${prev ? `<a href="${rel}${prev.href}" rel="prev"><small>Previous in ${esc(pl.place)}</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a href="${rel}${next.href}" rel="next"><small>Next in ${esc(pl.place)}</small><b>${esc(next.title)}</b></a>` : `<a href="${rel}${pl.href}"><small>Back to</small><b>${esc(pl.place)}</b></a>`}</nav></article>`,
  }));
}

// all projects
const sorted = [...projects].sort((a, b) => places.indexOf(placeById[a.home]) - places.indexOf(placeById[b.home]) || a.order - b.order);
const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b));
const opts = (arr) => arr.map((v) => `<option>${esc(v)}</option>`).join('');
emit('projects.html', page({
  path: 'projects.html', title: 'All projects', bodyClass: 'list',
  desc: `All ${projects.length} public projects in one filterable table: region, domain, stack, validation level and tier.`,
  crumbs: [['Island', 'index.html'], ['All projects', 'projects.html']],
  body: (rel) => `<section class="list-head"><p class="eyebrow">The fast path</p><h1>All projects</h1><p class="lede">${projects.length} public repositories. Filter by region, domain, stack, validation level or tier, or search the text.</p></section>
<form class="filters js-only" id="filters" aria-label="Filter projects"><label>Search<input type="search" id="f-q" placeholder="Name, stack, summary"></label>
<label>Region<select id="f-region"><option value="">All regions</option>${places.map((pl) => `<option value="${pl.id}">${esc(pl.name)}</option>`).join('')}</select></label>
<label>Domain<select id="f-domain"><option value="">All domains</option>${opts(uniq(projects.flatMap((p) => p.domains)))}</select></label>
<label>Stack<select id="f-stack"><option value="">Any stack</option>${opts(uniq(projects.flatMap((p) => p.stack)))}</select></label>
<label>Validation<select id="f-val"><option value="">Any level</option>${opts(uniq(projects.map((p) => p.val.label)))}</select></label>
<label>Tier<select id="f-kind"><option value="">Any tier</option>${opts(uniq(projects.map((p) => p.tier)))}</select></label>
<button type="reset" class="btn ghost">Clear</button></form>
<p class="count" id="count" role="status" aria-live="polite">${projects.length} projects</p>
<div class="table-wrap"><table class="ptable" id="ptable"><caption class="vh">All public projects</caption><thead><tr><th scope="col">Project</th><th scope="col">Region</th><th scope="col">Domain</th><th scope="col">Stack</th><th scope="col">Validation</th><th scope="col">Tier</th></tr></thead><tbody>
${sorted.map((p) => `<tr class="rg-${p.home}" data-region="${p.home} ${p.also.join(' ')}" data-domain="${esc(p.domains.join('|'))}" data-stack="${esc(p.stack.join('|'))}" data-val="${p.val.label}" data-kind="${esc(p.tier)}"><th scope="row"><a href="${rel}${p.href}">${esc(p.title)}</a><small>${esc(p.summary)}</small></th><td><a class="tl" href="${rel}${placeById[p.home].href}">${esc(placeById[p.home].place)}</a></td><td>${esc(p.domain)}</td><td>${p.stack.map(esc).join(', ')}</td><td>${badge(p)}</td><td>${kindChip(p)}</td></tr>`).join('\n')}
</tbody></table></div><p class="empty" id="empty" hidden>No project matches these filters. <button type="button" class="linklike" id="empty-clear">Clear the filters</button></p>`,
}));

// 404: served at any depth, so it is the one page that needs an absolute base.
emit('404.html', page({
  path: '404.html', title: 'Off the map', bodyClass: 'lost',
  desc: 'This page is not on the chart.', crumbs: [['Island', 'index.html'], ['Off the map', '404.html']],
  body: (rel) => `<section class="hero"><p class="eyebrow">404</p><h1>Off the map.</h1><p class="lede">There is nothing charted at this address. The island is still where you left it.</p><p class="hero-cta"><a class="btn" href="${rel}index.html">Back to the island</a><a class="btn ghost" href="${rel}projects.html">All projects</a></p></section>`,
}).replace('<head>', `<head><base href="${new URL(site.url).pathname}">`));

// redirects that keep the old URLs alive
for (const [from, to] of Object.entries(world.redirects)) {
  emit(from, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Moved · ${esc(site.short)} atlas</title><meta name="robots" content="noindex"><link rel="canonical" href="${site.url}${to === 'index.html' ? '' : to}"><meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)}+location.hash)</script></head>
<body><p>This page moved. <a href="${to}">Continue to the new page</a>.</p></body></html>
`);
}

// sitemap and robots
const lastmod = (path) => { const p = projects.find((x) => x.href === path); return p?.last_push ? `<lastmod>${p.last_push}</lastmod>` : ''; };
emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...out.keys()].filter((k) => k.endsWith('.html') && k !== '404.html' && !world.redirects[k]).map((k) => `<url><loc>${site.url}${k === 'index.html' ? '' : k}</loc>${lastmod(k)}</url>`).join('\n')}\n</urlset>\n`);
emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);

// assets: palette variables are generated, so CSS and the contrast check share one source.
const minCss = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}');
const pairs = checkContrast();
emit('assets/site.css', minCss(paletteCss() + read('src/site.css')) + '\n');
emit('assets/site.js', read('src/site.js'));

// ---------------------------------------------------------------- write / freshness check
const stale = [];
for (const dir of ['regions', 'projects']) {
  const abs = resolve(root, dir);
  if (existsSync(abs)) for (const f of readdirSync(abs)) if (f.endsWith('.html') && !out.has(`${dir}/${f}`)) {
    if (checking) stale.push(`${dir}/${f} (obsolete)`);
    else rmSync(resolve(abs, f));
  }
}
let bytes = 0;
for (const [path, html] of out) {
  const abs = resolve(root, path);
  if (checking) {
    if (!existsSync(abs) || readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') !== html.replace(/\r\n/g, '\n')) stale.push(path);
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, html);
  }
  bytes += Buffer.byteLength(html);
}
if (stale.length) throw new Error(`Generated output is stale. Run node scripts/build.mjs:\n${stale.join('\n')}`);
console.log(`${checking ? 'verified' : 'built'} ${out.size} files (${(bytes / 1024).toFixed(0)} KB): ${projects.length} case studies, ${places.length} region pages; ${pairs} colour pairs pass WCAG AA`);
