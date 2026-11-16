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
  const backgroundPoint = () => page.evaluate(() => {
    for (const y of [0.4, 0.5, 0.6]) for (const x of [0.3, 0.5, 0.65]) {
      if (document.elementFromPoint(innerWidth * x, innerHeight * y)?.id === 'stage') return { x: innerWidth * x, y: innerHeight * y };
    }
    throw new Error('No canvas background available for camera interaction');
  });
  console.log('running: desktop preservation checks');
  await page.goto(base + '?wx=clear&time=noon', { waitUntil: 'domcontentloaded' });
  await ready(page);
  console.log('running: capital ready');
  // one daylight: the world page has no time-of-day or weather control, and the capital stays bright
  assert.equal(await page.locator('#mode').count(), 0);
  assert.equal(await page.locator('.wx-chip').count(), 0);
  assert.equal((await state()).lit, 0);
  assert.equal(await page.locator('.zcard[data-mode="night"]').count(), 0, 'list fallbacks use the same daytime');
  // every zone outside the capital carries its own weather-and-terrain sphere once populated
  await page.waitForFunction(() => window.__world.state().spheres === 11);
  await page.screenshot({ path: resolve(root, 'memory/screenshots/navigation-capital.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.dock [data-fly="finops"]').click();
  await page.waitForTimeout(100);
  const interruptAt = await backgroundPoint();
  await page.mouse.move(interruptAt.x, interruptAt.y);
  await page.mouse.down();
  await page.mouse.move(interruptAt.x + 70, interruptAt.y + 25, { steps: 4 });
  await page.mouse.up();
  const interrupted = await state();
  await page.waitForTimeout(300);
  assert.ok(Math.hypot((await state()).x - interrupted.x, (await state()).z - interrupted.z) < 1, 'drag interrupts the automated flight instead of continuing to its old destination');
  assert.ok(Math.abs((await state()).pitch - interrupted.pitch) < 0.001, 'manual tilt stays where the visitor leaves it');
  assert.equal((await state()).flying, false);
  await page.locator('.dock [data-fly="provisioning"]').click();
  await page.waitForTimeout(100);
  const wheelAt = await backgroundPoint();
  await page.mouse.move(wheelAt.x, wheelAt.y);
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => !window.__world.state().flying);
  const wheelStopped = await state();
  await page.waitForTimeout(200);
  assert.ok(Math.hypot((await state()).x - wheelStopped.x, (await state()).z - wheelStopped.z) < 1, 'wheel input also stops translation');
  for (const zone of ['networking', 'finops', 'provisioning']) await page.locator(`.dock [data-fly="${zone}"]`).click();
  await page.waitForFunction(() => window.__world.state().weights.provisioning > 0.99 && !window.__world.state().flying);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#b-home').click();
  for (const zone of ['provisioning', 'finops', 'networking']) {
    await page.locator(`.dock [data-fly="${zone}"]`).click();
    await page.waitForFunction((z) => window.__world.state().weights[z] === 1, zone);
    assert.ok((await state()).lit < 0.6, 'zones stay in daylight');
  }
  await page.locator('#minimap [data-fly="provisioning"]').click();
  await page.waitForFunction(() => window.__world.state().here === 'provisioning');
  await page.locator('#minimap svg').click({ position: { x: 10, y: 10 } });
  await page.waitForFunction(() => window.__world.state().x < -200);
  await page.locator('#q').fill('healthcare');
  await page.locator('#q').press('Enter');
  assert.equal(await page.locator('#panel').isVisible(), true);
  assert.match(await page.locator('#p-main').getAttribute('href'), /healthcare-eks-secops/);
  await page.locator('#p-back').click();
  assert.equal(await page.locator('#panel').isVisible(), false, 'back button returns from the island to its zone');
  assert.equal(new URL(page.url()).hash, '#capital');
  await page.waitForFunction(() => window.__world.state().here === 'capital');
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
  await page.evaluate(() => { window.auditScene.onAfterRender = (_renderer, _scene, camera) => { window.auditCamera = camera; }; });
  await page.waitForFunction(() => window.auditCamera);
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
  assert.equal(await page.evaluate(() => {
    const key = (a, i) => [a.getX(i), a.getY(i), a.getZ(i)].map((v) => v.toFixed(3)).join(',');
    const flagships = window.auditScene.children.filter((g) => g.children.some((c) => c.userData.id) && g.children.some((c) => c.isGroup));
    return flagships.length === 8 && flagships.every((g) => {
      const near = g.children.find((c) => c.isGroup);
      const rock = near.children.find((m) => m.geometry?.attributes.color && m.material.vertexColors);
      if (!rock) return true; // the contact balloon has no rock base
      const source = rock.geometry.attributes.color, far = g.children.find((c) => c.geometry?.attributes.color).geometry.attributes.color;
      const colors = new Set(Array.from({ length: far.count }, (_, i) => key(far, i)));
      return Array.from({ length: source.count }, (_, i) => key(source, i)).every((c) => colors.has(c));
    });
  }), true, 'distant capital copies retain their original rock colours');
  const weather = await page.evaluate(() => {
    const parts = window.auditScene.children.filter((o) => (o.isPoints || o.isLineSegments) && o.geometry.attributes.position.usage === 35048);
    return { all: parts.length, visible: parts.filter((o) => o.visible).length };
  });
  assert.ok(weather.visible > 0 && weather.visible < weather.all, 'off-screen weather is culled while distant visible weather remains');
  await page.waitForTimeout(250);
  (await flagshipPositions()).forEach((p, i) => assert.notEqual(p.x, flagships[i].x, `${p.name} orbits`));
  const movingTarget = await page.evaluate(async () => {
    const { Vector3 } = await import('./vendor/three.module.min.js');
    const D = JSON.parse(document.getElementById('placement').textContent);
    for (const p of D.islands.filter((p) => p.orbit != null)) {
      const group = window.auditScene.children.find((g) => g.children.some((c) => c.userData.id === p.name));
      const point = group.children.find((c) => c.userData.id === p.name).getWorldPosition(new Vector3()).project(window.auditCamera);
      const x = (point.x / 2 + 0.5) * innerWidth, y = (-point.y / 2 + 0.5) * innerHeight;
      if (point.z < 1 && document.elementFromPoint(x, y)?.id === 'stage') return { id: p.name, x, y };
    }
    throw new Error('No unobstructed flagship target');
  });
  await page.mouse.move(movingTarget.x, movingTarget.y);
  await page.mouse.click(movingTarget.x, movingTarget.y);
  assert.equal(await page.locator('#panel').isVisible(), true, 'moving islands remain selectable through the canvas');
  assert.equal((await state()).following, movingTarget.id);
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).hash, '#capital', 'closing a project clears its stale project route');
  assert.equal(await page.locator('.dock [data-fly="capital"]').evaluate((el) => el === document.activeElement), true, 'closing restores keyboard focus to the parent zone');
  await page.locator('#b-all').click();
  await page.waitForFunction(() => window.__world.state().over === 1);
  const terrain = await page.evaluate(async () => {
    const { Vector3 } = await import('./vendor/three.module.min.js');
    const z = JSON.parse(document.getElementById('placement').textContent).zones.find((z) => z.id === 'provisioning');
    const p = new Vector3(z.x, 3, z.z).project(window.auditCamera);
    return { x: (p.x / 2 + 0.5) * innerWidth, y: (-p.y / 2 + 0.5) * innerHeight };
  });
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, terrain), 'stage');
  await page.mouse.click(terrain.x, terrain.y);
  await page.waitForFunction(() => window.__world.state().weights.provisioning > 0.99);
  assert.equal(await page.locator('#provisioning').evaluate((el) => el.classList.contains('on')), true, 'terrain selection uses the existing zone panel');
  await page.locator('#b-all').click();
  await page.waitForFunction(() => window.__world.state().over === 1);
  assert.equal(await page.evaluate(() => {
    const D = JSON.parse(document.getElementById('placement').textContent);
    return D.zones.filter((z) => z.range && D.islands.filter((p) => p.zone === z.id).length > 1).every((z) => {
      const group = window.auditScene.children.find((g) => g.isGroup && g.position.x === z.x && g.position.z === z.z);
      const meshes = group.children[0].children.filter((m) => m.isMesh && m.material.vertexColors && !m.material.transparent);
      const near = meshes.filter((m) => !m.visible), far = meshes.filter((m) => m.visible);
      return near.length === 5 && far.length === 1 && far[0].geometry.attributes.position.count === near.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
    });
  }), true, 'far batching preserves every opaque island triangle and keeps all zone silhouettes');
  assert.equal(await page.evaluate(() => {
    const ghosts = [];
    window.auditScene.traverse((m) => { if (m.isMesh && m.visible && m.material.vertexColors && m.material.opacity === 0.42) ghosts.push(m); });
    return ghosts.length > 0 && ghosts.every((m) => m.geometry.attributes.position.count > 0);
  }), true, 'distant uncharted batches retain their ghost-island geometry');
  await page.locator('.dock [data-fly="provisioning"]').click();
  await page.waitForFunction(() => { const w = window.__world.state().weights.provisioning; return w > 0.01 && w < 0.99; });
  await page.waitForFunction(() => window.__world.state().weights.provisioning > 0.99);
  await page.locator('#b-home').click();
  await page.waitForFunction(() => window.__world.state().weights.capital > 0.99);
  const before = await state();
  await page.waitForFunction((yaw) => window.__world.state().yaw !== yaw, before.yaw);
  const drag = await backgroundPoint();
  await page.mouse.move(drag.x, drag.y);
  await page.mouse.down(); await page.mouse.move(drag.x + 100, drag.y + 40, { steps: 5 }); await page.mouse.up();
  assert.ok(Math.abs((await state()).yaw - before.yaw) > 0.2, 'drag changes camera orbit');
  const distance = (await state()).dist;
  const wheel = await backgroundPoint();
  await page.mouse.move(wheel.x, wheel.y);
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
  const idle = await page.evaluate(async () => {
    const raf = window.requestAnimationFrame;
    let callbacks = 0;
    window.requestAnimationFrame = function (fn) { callbacks++; return raf.call(this, fn); };
    const frames = window.__world.state().frames;
    try { await new Promise((r) => setTimeout(r, 300)); return { callbacks, frames: window.__world.state().frames - frames }; }
    finally { window.requestAnimationFrame = raf; }
  });
  assert.deepEqual(idle, { callbacks: 0, frames: 0 }, 'idle reduced motion schedules no renderer callbacks');
  const zoneIds = await page.locator('.dock [data-fly]').evaluateAll((links) => links.map((a) => a.dataset.fly));
  const tour = async () => {
    for (const zone of zoneIds) {
      await page.locator(`.dock [data-fly="${zone}"]`).click();
      await page.waitForFunction((z) => window.__world.state().here === z, zone);
    }
    await page.waitForTimeout(150);
    const s = await state();
    return { geometries: s.geometries, textures: s.textures };
  };
  const memory = await tour();
  assert.deepEqual(await tour(), memory, 'revisiting zones allocates no additional GPU resources');
  await page.locator('#q').fill('ansible');
  await page.locator('#q').press('Enter');
  assert.equal(await page.locator('#panel').isVisible(), true, 'non-capital islands are selectable');
  assert.ok(await page.locator('#p-main').getAttribute('href'));
  await page.locator('#p-back').click();
  await page.locator('#b-all').click();
  await page.locator('#q').fill('healthcare');
  await page.locator('#q').press('Enter');
  await page.waitForFunction(() => window.__world.state().dist < 20);
  assert.equal(await page.evaluate(async () => {
    const { Vector3 } = await import('./vendor/three.module.min.js');
    const group = window.auditScene.children.find((g) => g.children.some((c) => c.userData.id === 'healthcare-eks-secops'));
    let badge;
    group.traverse((m) => { if (m.geometry?.type === 'ExtrudeGeometry') badge = m.parent; });
    const toward = window.auditCamera.position.clone().sub(badge.getWorldPosition(new Vector3()));
    toward.y = 0;
    return badge.getWorldDirection(new Vector3()).dot(toward.normalize()) > 0.999 && badge.children.some((m) => m.geometry?.type === 'TubeGeometry');
  }), true, 'the shield check faces the current camera immediately after reduced-motion LOD return');
  await page.locator('#p-back').click();
  console.log('ok: daylight, spheres, zones, minimap, search, back navigation, camera, list suspension, reduced motion');

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
  await mobile.route('https://fonts.googleapis.com/**', (r) => r.abort());
  console.log('running: mobile gestures and fallbacks');
  const phone = await mobile.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(base + '?wx=clear&time=noon', { waitUntil: 'domcontentloaded' });
  await ready(phone);
  await phone.waitForFunction(() => window.__world.state().frames > 0);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const touchSession = await mobile.newCDPSession(phone);
  const touch = (type, points) => touchSession.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) });
  const homeDistance = await phone.evaluate(() => window.__world.state().dist);
  await touch('touchStart', [[1, 100, 400]]);
  await touch('touchMove', [[1, 130, 400]]);
  await touch('touchStart', [[1, 130, 400], [2, 230, 400]]);
  await touch('touchMove', [[1, 135, 400], [2, 230, 400]]);
  await phone.waitForFunction((d) => Math.abs(window.__world.state().dist - d) < 0.1, homeDistance * 100 / 95);
  await touch('touchEnd', [[2, 230, 400]]);
  const yaw = await phone.evaluate(() => window.__world.state().yaw);
  await touch('touchMove', [[1, 155, 400]]);
  await phone.waitForFunction((y) => Math.abs(window.__world.state().yaw - y) > 0.05, yaw);
  await touch('touchEnd', []);
  await phone.locator('#b-all').click();
  await phone.waitForFunction(() => window.__world.state().over === 1);
  assert.equal(await phone.locator('.zlabel.on').count(), 12, 'portrait overview retains every zone');
  assert.equal(await phone.locator('.zlabel.on').evaluateAll((links) => links.every((a) => {
    const r = a.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && a.textContent.trim();
  })), true, 'portrait overview labels fit without hiding their accessible names');
  await phone.locator('#b-view').click();
  assert.equal(await phone.locator('#capital').isVisible(), true);
  await phone.locator('#b-view').click();
  await phone.evaluate(async () => {
    const { Scene } = await import('./vendor/three.module.min.js');
    const update = Scene.prototype.updateMatrixWorld;
    Scene.prototype.updateMatrixWorld = function (...args) {
      window.phoneScene = this;
      this.onAfterRender = (_r, _s, camera) => { window.phoneCamera = camera; };
      return update.apply(this, args);
    };
    window.__world.redraw();
  });
  await phone.locator('#b-home').click();
  await phone.waitForFunction(() => window.__world.state().here === 'capital' && window.__world.state().over === 0 && window.phoneCamera);
  await phone.evaluate(() => window.__world.zoomBy(2.4));
  await phone.waitForFunction(() => window.__world.state().dist > 170);
  await phone.waitForTimeout(300);
  assert.equal(await phone.evaluate(() => {
    const top = document.querySelector('.top').getBoundingClientRect().bottom, bottom = innerHeight - document.querySelector('.dock').offsetHeight;
    const labels = [...document.querySelectorAll('.plabel.on:not(.ghost), .zlabel.on')];
    return labels.length > 4 && labels.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= top - 1 && r.bottom <= bottom + 1; });
  }), true, 'visible labels stay inside the viewport, below the header and above the dock');
  // touch has no hover: tapping a distant island whose name is not shown approaches its zone first, where the names appear
  const distant = await phone.evaluate(async () => {
    const { Vector3, Vector2, Raycaster } = await import('./vendor/three.module.min.js');
    const hits = [];
    window.phoneScene.traverse((m) => { if (m.isMesh && m.userData.id) hits.push(m); });
    const D = JSON.parse(document.getElementById('placement').textContent);
    const top = document.querySelector('.top').getBoundingClientRect().bottom, bottom = innerHeight - document.querySelector('.dock').offsetHeight;
    for (const p of D.islands.filter((p) => p.zone !== 'capital')) {
      if (document.getElementById('l-' + p.name).classList.contains('on')) continue;
      const hit = hits.find((h) => h.userData.id === p.name), c = hit.getWorldPosition(new Vector3()).project(window.phoneCamera);
      const x = (c.x / 2 + 0.5) * innerWidth, y = (-c.y / 2 + 0.5) * innerHeight;
      if (x < 20 || x > innerWidth - 20 || y < top + 20 || y > bottom - 20 || document.elementFromPoint(x, y)?.id !== 'stage') continue;
      const ray = new Raycaster(); ray.setFromCamera(new Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), window.phoneCamera);
      if (ray.intersectObjects(hits, false)[0]?.object === hit) return { x, y, id: p.name, zone: p.zone };
    }
    return null;
  });
  assert.ok(distant, 'a distant island is on screen from the wide capital view');
  await touch('touchStart', [[1, distant.x, distant.y]]);
  await touch('touchEnd', []);
  await phone.waitForFunction((z) => window.__world.state().here === z, distant.zone);
  assert.equal(await phone.locator('#panel').isHidden(), true, 'the first tap on a distant island does not open it');
  assert.equal(await phone.evaluate((z) => location.hash === '#' + z, distant.zone), true, 'the first tap approaches the island\'s zone');
  await phone.waitForFunction((id) => document.getElementById('l-' + id).classList.contains('on'), distant.id);
  await phone.locator('.dock [data-fly="provisioning"]').click();
  await phone.waitForFunction(() => window.__world.state().weights.provisioning === 1 && window.phoneCamera);
  await phone.evaluate(() => window.__world.zoomBy(1.6));
  await phone.waitForFunction(() => Math.abs(window.__world.state().dist - 66 * 1.6) < 0.01);
  const touchTarget = await phone.evaluate(async () => {
    const { Vector3, Vector2, Raycaster } = await import('./vendor/three.module.min.js');
    const hits = [];
    window.phoneScene.traverse((m) => { if (m.isMesh && m.userData.id) hits.push(m); });
    const D = JSON.parse(document.getElementById('placement').textContent);
    for (const p of D.islands.filter((p) => p.zone === 'provisioning')) {
      const hit = hits.find((h) => h.userData.id === p.name), center = hit.getWorldPosition(new Vector3()).project(window.phoneCamera);
      for (const [dx, dy] of [[21, 0], [-21, 0], [0, -21], [0, 21]]) {
        const x = (center.x / 2 + 0.5) * innerWidth + dx, y = (-center.y / 2 + 0.5) * innerHeight + dy;
        if (document.elementFromPoint(x, y)?.id !== 'stage') continue;
        const ray = new Raycaster(); ray.setFromCamera(new Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), window.phoneCamera);
        if (!ray.intersectObjects(hits, false).length) return { x, y, id: p.name };
      }
    }
    throw new Error('No unobstructed tap just outside the original island hit geometry');
  });
  await touch('touchStart', [[1, touchTarget.x, touchTarget.y]]);
  await touch('touchEnd', []);
  assert.equal(await phone.evaluate(() => window.__world.state().following), touchTarget.id, '44px touch padding selects an island outside its original hit geometry');
  await phone.locator('#p-close').click();
  await phone.locator('#b-home').click();
  await phone.evaluate(() => window.__world.zoomBy(0.8));
  await phone.waitForFunction(() => Math.abs(window.__world.state().dist - 74 * 0.8) < 0.01);
  await phone.evaluate(() => dispatchEvent(new Event('resize')));
  await phone.waitForTimeout(100);
  assert.ok(Math.abs(await phone.evaluate(() => window.__world.state().dist) - 74 * 0.8) < 0.01, 'same-size resize, including adaptive resolution, preserves manual zoom');
  await phone.setViewportSize({ width: 812, height: 375 });
  await phone.locator('#b-all').click();
  await phone.waitForFunction(() => window.__world.state().over === 1);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'landscape does not overflow horizontally');
  assert.equal(await phone.locator('.zlabel.on').count(), 12, 'landscape overview retains all twelve destinations');
  assert.equal(await phone.locator('.zlabel.on').evaluateAll((links) => links.every((a) => { const r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })), true, 'landscape overview labels fit vertically');
  assert.equal(await phone.locator('.zlabel.on').evaluateAll((links) => {
    const boxes = links.map((a) => a.getBoundingClientRect());
    return boxes.every((a, i) => boxes.slice(i + 1).every((b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top));
  }), true, 'landscape reuses compact labels so adjacent zone names do not cover each other');
  await phone.screenshot({ path: resolve(root, 'memory/screenshots/navigation-landscape.png') });
  // Exercise the real adaptive controller with controlled frame timestamps, independent of host load.
  const adaptive = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true });
  await adaptive.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const recovery = await adaptive.newPage();
  await recovery.addInitScript(() => {
    const raf = window.requestAnimationFrame;
    let clock;
    window.testFrameInterval = 100;
    window.requestAnimationFrame = (fn) => raf((now) => {
      if (fn.name !== 'frame') return fn(now);
      clock = clock == null ? now : clock + window.testFrameInterval;
      fn(clock);
    });
  });
  await recovery.goto(base, { waitUntil: 'domcontentloaded' });
  await recovery.waitForFunction(() => window.__world?.state().pixelRatio <= 1.25);
  const lowered = await recovery.evaluate(() => window.__world.state().pixelRatio);
  await recovery.evaluate(() => { window.testFrameInterval = 1000 / 60; });
  await recovery.waitForFunction((ratio) => window.__world.state().pixelRatio > ratio, lowered, { timeout: 90000 });
  assert.ok(await recovery.evaluate(() => window.__world.state().pixelRatio <= 1.5), 'recovery respects the mobile resolution cap');
  await adaptive.close();
  console.log('ok: adaptive resolution lowers under sustained pressure and recovers with headroom (controlled timestamps)');
  const flat = await context.newPage();
  await flat.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : get.call(this, type, ...args); };
  });
  await flat.goto(base);
  assert.equal(await flat.locator('#capital').isVisible(), true);
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  await nojs.route('https://fonts.googleapis.com/**', (r) => r.abort());
  const plain = await nojs.newPage();
  await plain.goto(base);
  assert.equal(await plain.locator('.zcard').count(), 12);
  for (const slug of ['healthcare-eks-secops', 'gcp-ai-log-analyzer', 'aws-retail-microservices-eks']) {
    console.log(`running: hero ${slug}`);
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
  const journey = await context.newPage();
  await journey.goto(base + '#p-healthcare-eks-secops', { waitUntil: 'domcontentloaded' });
  await ready(journey);
  await journey.locator('#p-main').click();
  await journey.waitForURL('**/projects/healthcare-eks-secops.html');
  await journey.goBack({ waitUntil: 'domcontentloaded' });
  await ready(journey);
  assert.equal(await journey.locator('#panel').isVisible(), true, 'browser Back from a case study restores the island panel');
  assert.equal(new URL(journey.url()).hash, '#p-healthcare-eks-secops');
  await journey.locator('#p-close').click();
  assert.equal(new URL(journey.url()).hash, '#capital');
  await journey.locator('.dock [data-fly="provisioning"]').focus();
  await journey.keyboard.press('Enter');
  await journey.waitForFunction(() => window.__world.state().here === 'provisioning');
  await journey.locator('#l-01-terraform-multi-az-vpc').focus();
  await journey.keyboard.press('Enter');
  assert.equal(await journey.locator('#panel').isVisible(), true, 'islands remain keyboard accessible');
  await journey.keyboard.press('Escape');
  assert.equal(new URL(journey.url()).hash, '#provisioning');
  await journey.close();
  assert.deepEqual(errors, []);
  console.log('ok: mobile, no-WebGL/no-JavaScript fallbacks, three original heroes and hero failure fallback');
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
