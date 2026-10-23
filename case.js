// Case-study pages: shared day/night mode and live sky with the homepage, plus the project's own 3D island as the hero.
import { startWeather, autoMode, skyClock } from './weather.js?v=15';
const KEY = 'zein-mode';
const root = document.documentElement;
const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const save = (m) => { try { sessionStorage.setItem(KEY, m); } catch { /* storage blocked: mode still works for this page */ } };

const toggle = document.getElementById('mode');
const stored = read();
let manual = stored === 'day' || stored === 'night'; // until the visitor flips the switch, the real sky decides
let hero = null;
const sky = startWeather({ before: toggle, onChange: (s) => {
  if (hero) { hero.setWeather(s); hero.setTime(skyClock(s)); }
  if (!manual) apply(autoMode(s));
} });
let mode = manual ? stored : autoMode(sky.state);

function apply(next) {
  mode = next;
  root.dataset.mode = mode;
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(mode === 'night'));
    toggle.setAttribute('aria-label', mode === 'night' ? 'Switch to day' : 'Switch to night');
  }
  if (hero) hero.setMode(mode);
}
if (toggle) toggle.addEventListener('click', () => { manual = true; save(mode === 'day' ? 'night' : 'day'); apply(mode === 'day' ? 'night' : 'day'); });
apply(mode);

const canvas = document.getElementById('hero-canvas');
if (canvas) {
  const d = canvas.dataset;
  const project = { id: d.id, title: '', color: d.color, island: { b: d.building, climate: d.climate }, planet: { size: Number(d.size), phase: Number(d.phase), speed: 0 } };
  import('./world.js?v=15').then((m) => {
    hero = m.createWorld({ canvas, labelsHost: null, projects: [project], mode, solo: d.id, weather: sky.state, time: skyClock(sky.state) });
    canvas.parentElement.classList.add('on');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => hero.pause(!e.isIntersecting)).observe(canvas);
    }
  }).catch(() => canvas.parentElement.classList.add('off'));
}
