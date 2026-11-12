// Verify the public boundary and automatic discovery in an isolated temporary build.
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir = mkdtempSync(join(tmpdir(), 'portfolio-model-'));
try {
  for (const name of ['scripts', 'src', 'data', 'content']) cpSync(name, join(dir, name), { recursive: true });
  const data = JSON.parse(readFileSync(join(dir, 'data/projects.json'), 'utf8'));
  const fixture = { ...data[0], name: '31-fixture', title: 'Discovery fixture', challenge_number: 31, tier: 'Keep' };
  data.push(fixture, { ...fixture, name: 'private-fixture', title: 'Private sentinel', visibility: 'PRIVATE' });
  writeFileSync(join(dir, 'data/projects.json'), JSON.stringify(data));
  execFileSync(process.execPath, [join(dir, 'scripts/build.mjs')], { cwd: dir });
  assert.ok(existsSync(join(dir, 'projects/31-fixture.html')));
  assert.ok(!existsSync(join(dir, 'projects/private-fixture.html')));
  for (const path of ['regions/finops.html', 'projects.html', 'sitemap.xml']) {
    const html = readFileSync(join(dir, path), 'utf8');
    assert.ok(html.includes('projects/31-fixture.html'), path);
    assert.ok(!html.includes('Private sentinel'), path);
  }
  assert.ok(readFileSync(join(dir, 'index.html'), 'utf8').includes('31-fixture'));
  const firstLoad = ['index.html', 'assets/orbital.css', 'assets/orbital.js', 'assets/world3d.js', 'assets/vendor/three.module.min.js'].reduce((n, path) => n + statSync(path).size, 0);
  assert.ok(firstLoad < 900 * 1024, `Home first load ${firstLoad} bytes exceeds budget`);
  console.log(`Passed: new challenge fills every index, private entry excluded; home first load ${(firstLoad / 1024).toFixed(1)} KiB uncompressed excluding images.`);
} finally {
  // dir is the direct, verified return value of mkdtempSync under the OS temp directory.
  rmSync(dir, { recursive: true, force: true });
}
