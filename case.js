// Case-study pages: shared day/night mode with the homepage, plus the project's own 3D island as the hero.
const KEY = 'zein-mode';
const root = document.documentElement;
const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const save = (m) => { try { sessionStorage.setItem(KEY, m); } catch { /* storage blocked: mode still works for this page */ } };

let mode = read() === 'night' ? 'night' : 'day';
let hero = null;
root.dataset.mode = mode;

const toggle = document.getElementById('mode');
function apply(next) {
  mode = next;
  root.dataset.mode = mode;
  save(mode);
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(mode === 'night'));
    toggle.setAttribute('aria-label', mode === 'night' ? 'Switch to day' : 'Switch to night');
  }
  if (hero) hero.setMode(mode);
}
if (toggle) toggle.addEventListener('click', () => apply(mode === 'day' ? 'night' : 'day'));
apply(mode);

const canvas = document.getElementById('hero-canvas');
if (canvas) {
  const d = canvas.dataset;
  const project = { id: d.id, title: '', color: d.color, island: { b: d.building, climate: d.climate }, planet: { size: Number(d.size), phase: Number(d.phase), speed: 0 } };
  import('./world.js?v=14').then((m) => {
    hero = m.createWorld({ canvas, labelsHost: null, projects: [project], mode, solo: d.id });
    canvas.parentElement.classList.add('on');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => hero.pause(!e.isIntersecting)).observe(canvas);
    }
  }).catch(() => canvas.parentElement.classList.add('off'));
}
