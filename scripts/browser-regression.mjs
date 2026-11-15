// Uses an already available Playwright installation; no site dependencies are needed.
// PLAYWRIGHT_MODULE may point to that installation and BROWSER_EXECUTABLE to an existing Chromium browser.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  // Font availability must not determine whether the functional tests can run offline.
  await context.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const state = () => page.evaluate(() => window.__world.state());
  const ready = (p) => p.waitForFunction(() => document.body.classList.contains('ready'));
  console.log('running: desktop preservation checks');
  await page.goto(base + '?wx=clear&time=noon', { waitUntil: 'domcontentloaded' });
  await ready(page);
  console.log('running: capital ready');
  assert.equal((await state()).sky.mode, 'day');
  await page.locator('#mode').click();
  await page.waitForFunction(() => window.__world.state().lit > 0.99);
  assert.equal(await page.locator('#mode').getAttribute('aria-pressed'), 'true');
  await page.locator('.wx-chip').click();
  assert.notEqual((await state()).sky.wx, 'clear');
  for (const zone of ['provisioning', 'finops', 'networking']) {
    await page.locator(`.dock [data-fly="${zone}"]`).click();
    await page.waitForFunction((z) => window.__world.state().weights[z] === 1, zone);
    assert.equal(await page.locator('#mode').isVisible(), false);
  }
  await page.locator('#minimap [data-fly="provisioning"]').click();
  await page.waitForFunction(() => window.__world.state().here === 'provisioning');
  await page.locator('#minimap svg').click({ position: { x: 10, y: 10 } });
  await page.waitForFunction(() => window.__world.state().x < -200);
  await page.locator('#q').fill('healthcare');
  await page.locator('#q').press('Enter');
  assert.equal(await page.locator('#panel').isVisible(), true);
  assert.match(await page.locator('#p-main').getAttribute('href'), /healthcare-eks-secops/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#panel').isVisible(), false);
  await page.keyboard.press('0');
  await page.waitForFunction(() => window.__world.state().over === 1);
  await page.keyboard.press('Home');
  await page.waitForFunction(() => window.__world.state().here === 'capital');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Observe the real scene without adding production-only testing hooks.
  await page.evaluate(async () => {
    const { Scene } = await import('./vendor/three.module.min.js');
    const update = Scene.prototype.updateMatrixWorld;
    Scene.prototype.updateMatrixWorld = function (...args) {
      window.auditScene = this;
      return update.apply(this, args);
    };
  });
  await page.waitForFunction(() => window.auditScene);
  const flagshipPositions = () => page.evaluate(() => {
    const names = ['aws-retail-microservices-eks', 'healthcare-eks-secops', 'gcp-ai-log-analyzer', 'aws-3-tier-github-actions', 'github-actions-oidc-s3-pipeline', 'azure-aks-referral-platform'];
    return names.map((name) => {
      const group = window.auditScene.children.find((g) => g.children.some((c) => c.userData.id === name));
      return { name, x: group.position.x, z: group.position.z };
    });
  });
  const flagships = await flagshipPositions();
  flagships.forEach((p, i) => assert.ok(Math.abs(Math.hypot(p.x, p.z) - (8 + 5.2 * i)) < 0.001, `${p.name} stays on its original orbit`));
  assert.equal(await page.evaluate(() => window.auditScene.children.some((m) => m.geometry?.type === 'SphereGeometry' && m.geometry.parameters.radius === 2.6 && m.position.length() === 0)), true, 'sun remains at the origin');
  await page.waitForTimeout(250);
  (await flagshipPositions()).forEach((p, i) => assert.notEqual(p.x, flagships[i].x, `${p.name} orbits`));
  await page.locator('.dock [data-fly="provisioning"]').click();
  await page.waitForFunction(() => { const w = window.__world.state().weights.provisioning; return w > 0.01 && w < 0.99; });
  await page.waitForFunction(() => window.__world.state().weights.provisioning > 0.99);
  await page.locator('#b-home').click();
  await page.waitForFunction(() => window.__world.state().weights.capital > 0.99);
  const before = await state();
  await page.waitForFunction((yaw) => window.__world.state().yaw !== yaw, before.yaw);
  await page.mouse.move(700, 300);
  await page.mouse.down(); await page.mouse.move(800, 340, { steps: 5 }); await page.mouse.up();
  assert.ok(Math.abs((await state()).yaw - before.yaw) > 0.2, 'drag changes camera orbit');
  const distance = (await state()).dist;
  await page.mouse.wheel(0, -300);
  await page.waitForFunction((d) => window.__world.state().dist < d - 1, distance);
  await page.locator('#b-view').click();
  const paused = await state();
  assert.equal(paused.paused, true);
  await page.waitForTimeout(250);
  assert.equal((await state()).frames, paused.frames, 'list mode submits no frames');
  await page.locator('#b-view').click();
  await page.waitForFunction((frames) => window.__world.state().frames > frames, paused.frames);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#b-home').click();
  await page.waitForTimeout(250);
  const still = await state();
  await page.waitForTimeout(250);
  assert.equal((await state()).yaw, still.yaw, 'reduced motion stops camera auto-orbit');
  console.log('ok: capital controls, zones, minimap, search, camera, list suspension, reduced motion');

  const race = await context.newPage();
  let release, requested;
  const gate = new Promise((r) => { release = r; });
  const seen = new Promise((r) => { requested = r; });
  await race.route('**/world.js', async (r) => { requested(); await gate; await r.continue(); });
  await race.goto(base + '?wx=clear&time=noon', { waitUntil: 'domcontentloaded' });
  await Promise.race([seen, new Promise((_, reject) => setTimeout(() => reject(new Error('world import was not requested')), 10000))]);
  await race.locator('#b-view').click();
  release();
  await race.waitForFunction(() => window.__world?.state().paused);
  await ready(race);
  const initialFrames = await race.evaluate(() => window.__world.state().frames);
  await race.waitForTimeout(250);
  assert.equal(await race.evaluate(() => window.__world.state().frames), initialFrames);
  await race.close();

  const failed = await context.newPage();
  await failed.route('**/zones/ice.js', (r) => r.abort());
  await failed.goto(base + '?wx=clear&time=noon');
  await ready(failed);
  await failed.locator('.dock [data-fly="networking"]').click();
  await failed.locator('#toast').filter({ hasText: 'scenery could not load' }).waitFor();
  assert.equal(await failed.locator('#stage').isVisible(), true);
  await failed.close();
  console.log('ok: startup/list race and visible biome-loading failure');

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await mobile.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(base + '?wx=clear&time=noon');
  await ready(phone);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.locator('#b-view').click();
  assert.equal(await phone.locator('#capital').isVisible(), true);
  const flat = await context.newPage();
  await flat.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : get.call(this, type, ...args); };
  });
  await flat.goto(base);
  assert.equal(await flat.locator('#capital').isVisible(), true);
  assert.equal(await flat.locator('#mode').isVisible(), false);
  assert.equal(await flat.locator('.wx-chip').isVisible(), false);
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const plain = await nojs.newPage();
  await plain.goto(base);
  assert.equal(await plain.locator('.zcard').count(), 12);
  assert.equal(await plain.locator('#mode').isVisible(), false);
  for (const slug of ['healthcare-eks-secops', 'gcp-ai-log-analyzer', 'aws-retail-microservices-eks']) {
    await page.goto(base + `projects/${slug}.html?wx=clear&time=noon#day`);
    await page.locator('.hero.on').waitFor();
    assert.equal(await page.locator('#hero-canvas').isVisible(), true);
    await page.locator('#mode').click();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'night');
    if (slug === 'healthcare-eks-secops') {
      await page.locator('[data-scn="secret"]').click();
      await page.waitForFunction(() => document.getElementById('sim-log').classList.contains('bad'));
      await page.locator('[data-scn="clean"]').click();
      await page.locator('#sim-approve').waitFor();
      await page.locator('#sim-approve').click();
      await page.waitForFunction(() => document.getElementById('sim-log').textContent.includes('Prod synced'));
    }
    if (slug === 'gcp-ai-log-analyzer') {
      await page.locator('#rp-run').click();
      await page.locator('#rp-out').waitFor();
      assert.match(await page.locator('#rp-status').innerText(), /Done/);
    }
    await plain.goto(base + `projects/${slug}.html`);
    assert.equal(await plain.locator('.hero>svg').isVisible(), true);
  }
  await page.route('**/hero-world.js', (r) => r.abort());
  await page.goto(base + 'projects/healthcare-eks-secops.html');
  await page.locator('.hero.off').waitFor();
  assert.equal(await page.locator('.hero>svg').isVisible(), true);
  assert.equal(await page.locator('#hero-canvas').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('ok: mobile, no-WebGL/no-JavaScript fallbacks, three original heroes and hero failure fallback');
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
