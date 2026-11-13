// Link checker, no dependencies.
//   node scripts/check-links.mjs              internal links, fragments, assets, lazy zone files, public/private boundary
//   node scripts/check-links.mjs --external   also request every external link (repositories, demos, docs) and expect 200
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p).replace(/\\/g, '/');
const cache = new Map();
const read = (p) => { if (!cache.has(p)) cache.set(p, readFileSync(p, 'utf8')); return cache.get(p); };
const pages = [...readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => resolve(root, f)), ...readdirSync(resolve(root, 'projects')).map((f) => resolve(root, 'projects', f))];
const SITE = JSON.parse(readFileSync(resolve(root, 'data/world.json'), 'utf8')).site.url;
const errors = [], external = new Map();
let checked = 0;
const decode = (s) => s.replace(/&amp;/g, '&');

for (const page of pages) {
  const html = read(page);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) errors.push(`${rel(page)}: duplicate id "${dup[0]}"`);
  const urls = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => decode(m[1]));
  for (const m of html.matchAll(/location\.replace\('([^']+)'/g)) urls.push(m[1]);
  for (const url of urls) {
    if (/^(mailto:|data:|tel:)/.test(url)) continue;
    if (url.startsWith(SITE)) { // canonical and social URLs of this site: check the local file they will be served from
      const local = resolve(root, url.slice(SITE.length).split('#')[0] || 'index.html');
      checked++;
      if (!existsSync(local)) errors.push(`${rel(page)}: ${url} has no local file`);
      continue;
    }
    if (/^https?:\/\//.test(url)) { if (!external.has(url)) external.set(url, rel(page)); continue; }
    if (rel(page) === '404.html') continue; // served at any depth; its links are set from the deployment base at runtime
    if (url.startsWith('/')) { errors.push(`${rel(page)}: root-relative URL ${url} (GitHub Pages serves this site under /cloud-portfolio/)`); continue; }
    const [pathPart, hash] = url.split('#');
    let target = pathPart ? resolve(dirname(page), decodeURIComponent(pathPart.split('?')[0])) : page;
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    checked++;
    if (!existsSync(target)) { errors.push(`${rel(page)}: missing ${url}`); continue; }
    if (hash && extname(target) === '.html' && !read(target).includes(`id="${decodeURIComponent(hash)}"`)) errors.push(`${rel(page)}: missing fragment ${url}`);
  }
}

// every public project has a page, every zone has its lazy scenery file, and nothing non-public is rendered
const projects = JSON.parse(read(resolve(root, 'data/projects.json')));
const placement = JSON.parse(read(resolve(root, 'world/placement.json')));
for (const p of projects) {
  if (p.visibility !== 'PUBLIC') errors.push(`data/projects.json: ${p.name} is not public`);
  else if (!existsSync(resolve(root, `projects/${p.name}.html`))) errors.push(`missing case study for ${p.name}`);
  if (!placement.islands.some((i) => i.name === p.name) && p.visibility === 'PUBLIC') errors.push(`${p.name} has no island`);
}
if (readdirSync(resolve(root, 'projects')).length !== projects.length) errors.push('projects/ holds pages that are not in data/projects.json');
for (const z of placement.zones) { checked++; if (!existsSync(resolve(root, `world/${z.id}.json`))) errors.push(`missing world/${z.id}.json`); }
for (const f of ['tokens.css', 'world.css', 'world.js', 'style.css', 'theme.css', 'site.js', 'og-image.png', 'sitemap.xml', 'robots.txt', '404.html']) { checked++; if (!existsSync(resolve(root, f))) errors.push(`missing ${f}`); }
const audit = resolve(root, '../_audit/projects.json');
if (existsSync(audit)) { // local only: the audit also lists private repositories; none of them may leak into the site
  const hidden = JSON.parse(readFileSync(audit, 'utf8')).filter((p) => p.visibility !== 'PUBLIC').map((p) => p.name);
  const all = [...pages, ...readdirSync(resolve(root, 'world')).map((f) => resolve(root, 'world', f)), resolve(root, 'data/projects.json'), resolve(root, 'data/world.json'), resolve(root, 'README.md')].filter(existsSync);
  for (const file of all) for (const name of hidden) if (new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`, 'i').test(read(file))) errors.push(`${rel(file)}: mentions non-public repository ${name}`);
  console.log(`privacy: ${hidden.length} non-public names checked against ${all.length} files`);
}

if (process.argv.includes('--external')) {
  const urls = [...external.keys()].filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u));
  const get = async (url, tries = 3) => {
    for (let i = 1; ; i++) {
      try {
        const res = await fetch(url.split('#')[0], { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'link-check', Accept: 'text/html,*/*' } });
        const hash = url.split('#')[1];
        const body = hash && res.ok ? await res.text() : (await res.body?.cancel(), '');
        if (res.status === 200 && hash && /github\.com/.test(url) && !body.includes(`user-content-${hash}`) && !body.includes(`href="#${hash}"`)) return `200 but no #${hash} heading`;
        if (res.status === 200 || i >= tries || ![403, 429, 500, 502, 503, 504].includes(res.status)) return res.status;
      } catch (e) { if (i >= tries) return e.message; }
      await new Promise((r) => setTimeout(r, 2500 * i));
    }
  };
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async (url) => { const s = await get(url); if (s !== 200) errors.push(`external ${s}: ${url} (linked from ${external.get(url)})`); }));
  }
  console.log(`external: ${urls.length} links requested`);
}

if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} problem(s)`); process.exitCode = 1; }
else console.log(`ok: ${checked} internal references across ${pages.length} pages, ${projects.length} case studies`);
