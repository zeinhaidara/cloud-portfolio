// Validates data/portfolio-manifest.json, the single source for the Code Clinic page.
//   node scripts/check-manifest.mjs      exit 1 and list every problem
// The build imports readManifest() and refuses to generate the page from invalid data.
// Accepts the manifest as a bare array of entries or as { generated_at, total, categories, <entries array> }.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED = 50;
const TEXT = ['name', 'url', 'title', 'summary', 'problem', 'category', 'tested', 'limits', 'ci_status_main'];
const LISTS = ['stack', 'skills'];
const OPTIONAL_TEXT = ['last_commit_date', 'license']; // checked only when present
const filled = (s) => typeof s === 'string' && s.trim() !== '';

export function readManifest(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const raw = JSON.parse(readFileSync(resolve(root, 'data/portfolio-manifest.json'), 'utf8'));
  const errors = [];
  const meta = Array.isArray(raw) ? {} : raw;
  const entries = Array.isArray(raw) ? raw : Object.entries(raw).find(([k, v]) => k !== 'categories' && Array.isArray(v))?.[1];
  if (!Array.isArray(entries)) return { entries: [], errors: ['no array of entries found'] };
  if (entries.length !== EXPECTED) errors.push(`expected ${EXPECTED} entries, found ${entries.length}`);
  const seen = new Set(), names = new Set();
  entries.forEach((e, i) => {
    const at = `entry ${i + 1}${e && e.name ? ` (${e.name})` : ''}`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!Number.isInteger(e.number) || e.number < 1 || e.number > EXPECTED) errors.push(`${at}: number must be an integer 1-${EXPECTED}`);
    else if (seen.has(e.number)) errors.push(`${at}: duplicate number ${e.number}`); else seen.add(e.number);
    for (const k of TEXT) if (!filled(e[k])) errors.push(`${at}: ${k} is missing or empty`);
    for (const k of LISTS) if (!Array.isArray(e[k]) || !e[k].length || !e[k].every(filled)) errors.push(`${at}: ${k} must be a non-empty list of non-empty strings`);
    for (const k of OPTIONAL_TEXT) if (k in e && !filled(e[k])) errors.push(`${at}: ${k} is present but empty`);
    if (!(e.safety === null || filled(e.safety))) errors.push(`${at}: safety must be text or null`);
    if (filled(e.name)) {
      if (names.has(e.name)) errors.push(`${at}: duplicate name`); names.add(e.name);
      if (e.url !== `https://github.com/zeinhaidara/${e.name}`) errors.push(`${at}: url must be https://github.com/zeinhaidara/${e.name}`);
      if (Number.isInteger(e.number) && !e.name.startsWith(String(e.number).padStart(2, '0') + '-')) errors.push(`${at}: name must start with its two-digit number`);
    }
  });
  if ('total' in meta && meta.total !== entries.length) errors.push(`total is ${meta.total} but there are ${entries.length} entries`);
  if ('generated_at' in meta && !filled(meta.generated_at)) errors.push('generated_at is present but empty');
  const used = [...new Set(entries.map((e) => e && e.category).filter(filled))];
  if (Array.isArray(meta.categories)) {
    const listed = meta.categories.map((c) => (typeof c === 'string' ? c : c && (c.id || c.name)));
    for (const c of used) if (!listed.includes(c)) errors.push(`category "${c}" is used but not listed in categories`);
  }
  return { entries: [...entries].sort((a, b) => a.number - b.number), generatedAt: meta.generated_at || null, categories: used, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { entries, categories, generatedAt, errors } = readManifest();
  if (errors.length) { console.error(`data/portfolio-manifest.json is invalid:\n  ${errors.join('\n  ')}`); process.exit(1); }
  console.log(`manifest ok: ${entries.length} entries, ${categories.length} categories, generated_at ${generatedAt || 'not stated'}`);
}
