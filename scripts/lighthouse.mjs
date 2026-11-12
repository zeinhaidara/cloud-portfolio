import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serve } from './serve.mjs';
const server = serve(4175);
mkdirSync('.lighthouse', { recursive: true });
const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'], ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}) });
const results = [];
try {
  for (const path of ['index.html', 'regions/containers-kubernetes.html', 'projects/gcp-ai-log-analyzer.html', 'projects.html']) {
    const result = await lighthouse('http://127.0.0.1:4175/cloud-portfolio/' + path, { port: chrome.port, output: 'html', onlyCategories: ['performance', 'accessibility'], formFactor: 'mobile' });
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)]));
    writeFileSync(`.lighthouse/${path.replaceAll('/', '-')}`, result.report);
    writeFileSync(`.lighthouse/${path.replaceAll('/', '-')}.json`, JSON.stringify(result.lhr, null, 2));
    results.push({ path, ...scores }); console.log(path, scores);
    if (scores.performance < 90 || scores.accessibility < 95) process.exitCode = 1;
  }
  writeFileSync('.lighthouse/scores.json', JSON.stringify(results, null, 2));
} finally { await chrome.kill(); server.close(); }
