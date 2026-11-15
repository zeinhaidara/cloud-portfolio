// Case-study pages: the same random sky as the homepage (sky.js), with the project's own 3D island as the hero.
const sky = window.zeinSky;
const root = document.documentElement;
const toggle = document.getElementById('mode');
let mode = sky.now().mode, hero = null;

function apply(next) {
  mode = next;
  root.dataset.mode = mode;
  if (toggle) {
    toggle.hidden = false;
    toggle.setAttribute('aria-pressed', String(mode === 'night'));
    toggle.setAttribute('aria-label', mode === 'night' ? 'Switch to day' : 'Switch to night');
  }
  if (hero) hero.setMode(mode);
}
const repaint = sky.chip(toggle, (s) => { apply(s.mode); if (hero) { hero.setWeather(s.wx); hero.setTime(s); } });
if (toggle) toggle.addEventListener('click', () => { const next = mode === 'day' ? 'night' : 'day'; sky.setMode(next); repaint(); apply(next); });
apply(mode);

const canvas = document.getElementById('hero-canvas');
if (canvas) {
  const d = canvas.dataset;
  const project = { id: d.id, title: '', color: d.color, island: { b: d.building, climate: d.climate }, planet: { size: Number(d.size), phase: Number(d.phase), speed: 0 } };
  import('./hero-world.js').then((m) => {
    hero = m.createWorld({ canvas, labelsHost: null, projects: [project], mode, solo: d.id, weather: sky.now().wx, time: sky.now() });
    canvas.parentElement.classList.add('on');
    let visible = true;
    const pause = () => hero.pause(document.hidden || !visible);
    document.addEventListener('visibilitychange', pause);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; pause(); }).observe(canvas);
    }
    pause();
  }).catch((error) => { console.warn('3D hero unavailable, showing the island illustration', error); canvas.parentElement.classList.add('off'); });
}
