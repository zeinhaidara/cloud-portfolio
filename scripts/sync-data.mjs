// Copies the public part of the audit's projects.json into data/projects.json.
// The audit file is the source of truth but lives outside this repo and also lists private repos,
// so only public repositories and only the fields the site renders are copied.
//
// usage: node scripts/sync-data.mjs [path/to/projects.json]   (default: ../_audit/projects.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] || '../_audit/projects.json');
const all = JSON.parse(readFileSync(src, 'utf8'));

const FIELDS = ['visibility', 'name', 'title', 'summary', 'domain', 'stack', 'tier', 'repo_url', 'demo_url', 'outcome', 'status',
  'validation_level', 'known_limitations', 'next_steps', 'challenge_number', 'archived', 'previous_name', 'last_push'];

// Repository housekeeping notes from the audit are not engineering limitations of the project
// and are not published on the site.
const HOUSEKEEPING = /stale remote branch|team credit|unrelated to the cloud|not on the portfolio|co-author trailer|no license|\.ds_store|committed in docs|no repo description|branch-protected|no mention of code clinic|dependabot pr|pin six repos|portfolio session|leave unpinned|merge pr #|does not exclude memory/i;

const pub = all
  .filter((p) => p.visibility === 'PUBLIC')
  .map((p) => {
    const o = {};
    for (const k of FIELDS) if (p[k] !== undefined && p[k] !== null) o[k] = p[k];
    o.known_limitations = (p.known_limitations || []).filter((s) => !HOUSEKEEPING.test(s));
    o.next_steps = (p.next_steps || []).filter((s) => !HOUSEKEEPING.test(s));
    o.archived = Boolean(p.archived);
    return o;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(resolve(root, 'data/projects.json'), JSON.stringify(pub, null, 2) + '\n');
console.log(`synced ${pub.length} public projects from ${src} (${all.length - pub.length} non-public skipped)`);
