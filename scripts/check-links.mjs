// Dependency-free local link/fragment checker; --external checks public repo/demo URLs.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
for (const dir of ['', 'regions', 'projects', 'assets', 'assets/js']) {
  for (const f of readdirSync(resolve(root, dir))) {
    const path = resolve(root, dir, f);
    if (statSync(path).isFile() && ['.html', '.css', '.js'].includes(extname(f))) files.push(path);
  }
}
const errors = [], cache = new Map();
const read = (path) => { if (!cache.has(path)) cache.set(path, readFileSync(path, 'utf8')); return cache.get(path); };
const decode = (s) => s.replace(/&amp;/g, '&');
let checked = 0;
for (const file of files) {
  // GitHub Pages serves 404.html at arbitrary depths; its deployment base is intentional.
  const html = read(file).replace(/<base\b[^>]*>/g, '');
  const urls = extname(file) === '.html' ? [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    : extname(file) === '.css' ? [...html.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map((m) => m[1]) : [];
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${relative(root, file)}: duplicate IDs`);
  for (const raw of urls) {
    const url = decode(raw);
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) continue;
    if (url.startsWith('/')) { errors.push(`${relative(root, file)}: nonrelative URL ${url}`); continue; }
    const [pathPart, hash] = url.split('#');
    let target = resolve(dirname(file), decodeURIComponent(pathPart.split('?')[0] || '.'));
    if (!pathPart) target = file;
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    checked++;
    if (!existsSync(target)) errors.push(`${relative(root, file)}: missing ${url}`);
    else if (hash && extname(target) === '.html' && !read(target).includes(`id="${decodeURIComponent(hash)}"`)) errors.push(`${relative(root, file)}: missing fragment ${url}`);
  }
}
const projects = JSON.parse(readFileSync(resolve(root, 'data/projects.json'), 'utf8'));
const publicProjects = projects.filter((p) => p.visibility === 'PUBLIC');
const generated = readdirSync(resolve(root, 'projects')).filter((p) => p.endsWith('.html'));
if (generated.length !== publicProjects.length) errors.push('Public inventory and case-study count differ');
for (const p of publicProjects) if (!existsSync(resolve(root, `projects/${p.name}.html`))) errors.push(`Missing public case study: ${p.name}`);
if (process.argv.includes('--external')) {
  const urls = [...new Set(publicProjects.flatMap((p) => [p.repo_url, p.demo_url]).filter(Boolean))];
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async (url) => {
      try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'cloud-portfolio-link-check' } });
        await res.body?.cancel();
        console.log(`${res.status} ${url}`);
        if (res.status !== 200) errors.push(`External ${res.status}: ${url}`);
      } catch (e) { errors.push(`External ${url}: ${e.message}`); }
    }));
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Passed: ${checked} internal references, ${publicProjects.length} public case studies.`);
