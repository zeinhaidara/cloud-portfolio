// Validates data/portfolio-manifest.json, the single source for the Code Clinic page.
//   node scripts/check-manifest.mjs      exit 1 and list every problem
// Shape: { generated_at, total, categories: [{ name, count }], repos: [ ...entries ] }.
// The build imports readManifest() and refuses to generate the page from invalid data.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED = 50;
export const CI_STATUSES = ['pass', 'fail', 'no run on main'];
const TEXT = ['name', 'url', 'title', 'summary', 'problem', 'category', 'tested', 'limits'];
const LISTS = ['stack', 'skills'];
const OPTIONAL_TEXT = ['default_branch', 'last_commit_date', 'license']; // checked only when present
const filled = (s) => typeof s === 'string' && s.trim() !== '';

/** "pass" only if every workflow that ran on main passed; "fail" if any failed; "none" if nothing ran on main. */
export function ciState(records) {
  const ran = records.filter((r) => r.status !== 'no run on main');
  if (ran.some((r) => r.status === 'fail')) return 'fail';
  return ran.length ? 'pass' : 'none';
}

export function readManifest(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const m = JSON.parse(readFileSync(resolve(root, 'data/portfolio-manifest.json'), 'utf8'));
  const errors = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { repos: [], categories: [], errors: ['the manifest must be an object { generated_at, total, categories, repos }'] };
  if (!filled(m.generated_at)) errors.push('generated_at is missing or empty');
  if (m.total !== EXPECTED) errors.push(`total must be ${EXPECTED}, found ${JSON.stringify(m.total)}`);
  const repos = Array.isArray(m.repos) ? m.repos : [];
  if (!Array.isArray(m.repos)) errors.push('repos must be a list');
  else if (repos.length !== EXPECTED) errors.push(`repos must hold ${EXPECTED} entries, found ${repos.length}`);

  const seen = new Set(), names = new Set();
  repos.forEach((e, i) => {
    const at = `repos[${i}]${e && e.name ? ` (${e.name})` : ''}`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!Number.isInteger(e.number) || e.number < 1 || e.number > EXPECTED) errors.push(`${at}: number must be an integer 1-${EXPECTED}`);
    else if (seen.has(e.number)) errors.push(`${at}: duplicate number ${e.number}`); else seen.add(e.number);
    for (const k of TEXT) if (!filled(e[k])) errors.push(`${at}: ${k} is missing or empty`);
    for (const k of LISTS) if (!Array.isArray(e[k]) || !e[k].length || !e[k].every(filled)) errors.push(`${at}: ${k} must be a non-empty list of non-empty strings`);
    for (const k of OPTIONAL_TEXT) if (k in e && !filled(e[k])) errors.push(`${at}: ${k} is present but empty`);
    if (!(e.safety === null || filled(e.safety))) errors.push(`${at}: safety must be text or null`);
    const ci = e.ci_status_main;
    if (!Array.isArray(ci) || !ci.length) errors.push(`${at}: ci_status_main must be a non-empty list`);
    else ci.forEach((r, j) => {
      if (!r || !filled(r.workflow)) errors.push(`${at}: ci_status_main[${j}].workflow is missing`);
      if (!r || !CI_STATUSES.includes(r.status)) errors.push(`${at}: ci_status_main[${j}].status must be one of ${CI_STATUSES.map((s) => `"${s}"`).join(', ')}`);
    });
    if (filled(e.name)) {
      if (names.has(e.name)) errors.push(`${at}: duplicate name`); names.add(e.name);
      if (e.url !== `https://github.com/zeinhaidara/${e.name}`) errors.push(`${at}: url must be https://github.com/zeinhaidara/${e.name}`);
      if (Number.isInteger(e.number) && !e.name.startsWith(String(e.number).padStart(2, '0') + '-')) errors.push(`${at}: name must start with its two-digit number`);
    }
  });

  const categories = Array.isArray(m.categories) ? m.categories : [];
  if (!Array.isArray(m.categories) || !categories.length) errors.push('categories must be a non-empty list of { name, count }');
  const used = new Map();
  for (const e of repos) if (e && filled(e.category)) used.set(e.category, (used.get(e.category) || 0) + 1);
  for (const c of categories) {
    if (!c || !filled(c.name) || !Number.isInteger(c.count)) { errors.push(`category entry ${JSON.stringify(c)} must be { name, count }`); continue; }
    if (used.get(c.name) !== c.count) errors.push(`category "${c.name}" lists ${c.count} repos, found ${used.get(c.name) || 0}`);
  }
  for (const name of used.keys()) if (!categories.some((c) => c && c.name === name)) errors.push(`category "${name}" is used but not listed in categories`);

  return { repos: [...repos].sort((a, b) => a.number - b.number), categories, generatedAt: m.generated_at, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { repos, categories, generatedAt, errors } = readManifest();
  if (errors.length) { console.error(`data/portfolio-manifest.json is invalid:\n  ${errors.join('\n  ')}`); process.exit(1); }
  const states = repos.map((e) => ciState(e.ci_status_main));
  console.log(`manifest ok: ${repos.length} repos, ${categories.length} categories, generated_at ${generatedAt}; CI on main: ${states.filter((s) => s === 'pass').length} passing, ${states.filter((s) => s === 'fail').length} failing, ${states.filter((s) => s === 'none').length} with no run`);
}
