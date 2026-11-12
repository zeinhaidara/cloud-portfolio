import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const server = serve(4174);
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const base = 'http://127.0.0.1:4174/cloud-portfolio/';
const pages = ['index.html', 'regions/containers-kubernetes.html', 'projects/gcp-ai-log-analyzer.html', 'projects.html'];
const results = [], errors = [];
const projectCount = JSON.parse(readFileSync('data/projects.json', 'utf8')).filter((p) => p.visibility === 'PUBLIC').length;
mkdirSync('memory/screenshots', { recursive: true });
try {
  for (const width of [375, 768, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
    for (const path of pages) {
      await page.goto(base + path); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('h1').count(), 1, path);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${path} ${width} ${theme}`);
      // Render offscreen sections for full-page visual QA; normal browsing renders them on scroll.
      await page.addStyleTag({ content: '*{content-visibility:visible!important}' });
      await page.screenshot({ path: `memory/screenshots/${path.replaceAll('/', '-')}-${width}-${theme}.png`, fullPage: true });
      results.push({ path, width, theme, overflow: false });
    }
    await page.locator('#f-q').fill('networkpolicy generator');
    assert.equal(await page.locator('#ptable tbody tr:visible').count(), 1);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    assert.equal(await page.locator('#ptable tbody tr:visible').count(), projectCount);
    await page.locator('#f-q').fill('nothing-matches-this');
    assert.equal(await page.locator('#empty').isVisible(), true);
    await page.getByRole('button', { name: 'Clear the filters' }).click();
    await page.locator('#empty').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#empty').isVisible(), false);
    await page.locator('#theme').click();
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'light' ? 'dark' : 'light');
    await context.close();
  }
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base + 'regions/networking.html');
  assert.equal(await page.locator('.weather').isVisible(), false);
  assert.equal(await page.locator('#calm').isDisabled(), true);
  await page.goto(base + 'gcp.html#application-data-flow');
  await page.waitForURL('**/projects/gcp-ai-log-analyzer.html#application-data-flow');
  assert.equal(await page.locator('#application-data-flow').count(), 1);
  await page.goto(base + 'index.html');
  await page.locator('.map .cell').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/regions/provisioning.html');
  await context.close();
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await nojs.newPage();
  for (const path of ['projects.html', 'projects/gcp-ai-log-analyzer.html']) {
    await staticPage.goto(base + path);
    assert.ok(await staticPage.locator('main a').count() > 0);
    assert.equal(await staticPage.locator('h1').count(), 1);
  }
  await nojs.close();
  assert.deepEqual(errors, []);
  writeFileSync('memory/browser-results.json', JSON.stringify(results, null, 2));
  console.log(`Passed ${results.length} responsive/theme views, search, empty state, theme persistence, keyboard map, legacy fragment, reduced motion and no-JS pages.`);
} finally { await browser.close(); server.close(); }
