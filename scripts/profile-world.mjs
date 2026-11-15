// Repeatable local profiling with existing Playwright and Chromium installations.
// --baseline <git-ref> profiles committed world.js; otherwise profiles the working file.
// --output memory/<file>.json stores results without adding site dependencies.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (name) => args[args.indexOf(name) + 1];
const ref = args.includes('--baseline') ? arg('--baseline') : null;
const source = ref ? execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, 'show', `${ref}:world.js`], { encoding: 'utf8' }) : readFileSync(resolve(root, 'world.js'), 'utf8');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const percentile = (a, p) => {
  const sorted = [...a].sort((x, y) => x - y);
  return +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0).toFixed(2);
};
const distribution = (a) => ({ p50: percentile(a, .5), p95: percentile(a, .95), p99: percentile(a, .99) });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.route('https://fonts.googleapis.com/**', (r) => r.abort());
  // Instrumentation stays in the browser response; production files remain untouched.
  await context.route('**/world.js', (r) => r.fulfill({ contentType: 'text/javascript', body: source
    .replace('  const col =', '  window.__renderer = renderer; window.__scene = scene;\n  const col =')
    .replace('rig.yaw += dt * 0.025', 'rig.yaw += 0')
    .replace('if (reduced || hold) slow', 'if (window.__fixedRatio || reduced || hold) slow') }));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    let seed = 8675309;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    window.__fixedRatio = true;
    window.__samples = []; window.__renderTimes = []; window.__long = [];
    const raf = requestAnimationFrame;
    window.requestAnimationFrame = (fn) => raf((ts) => {
      const start = performance.now();
      fn(ts);
      if (window.__capturing && fn.name === 'frame') window.__samples.push({ ts, wall: performance.now() - start });
    });
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.state().spheres === 11);
  await page.locator('#b-all').click();
  await page.waitForFunction(() => window.__world.state().over === 1);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const r = __renderer, render = r.render;
    r.setPixelRatio(1.25);
    r.render = function (...args) {
      const t = performance.now(), result = render.apply(this, args);
      if (window.__capturing) window.__renderTimes.push(performance.now() - t);
      return result;
    };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1000);
  const runs = [];
  for (let run = 0; run < 2; run++) {
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const start = await metrics();
    const raw = await page.evaluate(async () => {
      __samples = []; __renderTimes = []; window.__capturing = true;
      await new Promise((r) => setTimeout(r, 6000));
      window.__capturing = false;
      return { samples: __samples, renders: __renderTimes, state: __world.state(), ratio: __renderer.getPixelRatio() };
    });
    const end = await metrics();
    if (raw.samples.length < 5) throw new Error('Benchmark did not collect active rendering frames');
    const intervals = raw.samples.slice(1).map((s, i) => s.ts - raw.samples[i].ts);
    runs.push({ fps: +(1000 * intervals.length / intervals.reduce((a, b) => a + b, 0)).toFixed(2), totalMs: distribution(intervals),
      callbackMs: distribution(raw.samples.map((s) => s.wall)), renderMs: distribution(raw.renders),
      worldMs: distribution(raw.samples.map((s, i) => s.wall - raw.renders[i])),
      scriptMsPerFrame: +((end.ScriptDuration - start.ScriptDuration) * 1000 / raw.samples.length).toFixed(2),
      frames: raw.samples.length, calls: raw.state.calls, triangles: raw.state.triangles, ratio: raw.ratio });
    console.log(`run ${run + 1}: ${JSON.stringify(runs.at(-1))}`);
  }
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  await page.waitForTimeout(2000);
  const { profile } = await cdp.send('Profiler.stop');
  const frames = new Map(profile.nodes.map((n) => [n.id, n.callFrame])), counts = new Map();
  for (const id of profile.samples) { const f = frames.get(id), key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}`; counts.set(key, (counts.get(key) || 0) + 1); }
  const details = await page.evaluate(() => {
    const gl = __renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      timerSupported: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), state: __world.state(),
      marks: performance.getEntriesByType('mark').map((e) => ({ name: e.name, start: e.startTime })), longTasks: __long };
  });
  const result = { source: ref || 'working tree', sha256: createHash('sha256').update(source).digest('hex'),
    conditions: { viewport: [375, 812], devicePixelRatio: 2, renderPixelRatio: 1.25, cpuThrottle: 4, captureMs: 6000, warmupMs: 2200, seed: 8675309, yaw: -1.58, overviewDistance: details.state.dist },
    runs, ...details, hotspots: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 18) };
  if (args.includes('--output')) writeFileSync(resolve(root, arg('--output')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser?.close(); await new Promise((r) => server.close(r)); }
