// Random sky: every reload rolls a weather and a time of day for the islands; moving between pages keeps it.
// Loaded in <head> so pages paint in the right mode; app.js and case.js use window.zeinSky.
// Preview: ?wx=clear|cloudy|fog|rain|storm|snow|wind|hot&time=sunrise|noon|sunset|twilight|midnight
(() => {
  const SKIES = { clear: ['☀️', 'Clear'], cloudy: ['☁️', 'Cloudy'], fog: ['🌫️', 'Fog'], rain: ['🌧️', 'Rain'], storm: ['⛈️', 'Storm'], snow: ['❄️', 'Snow'], wind: ['💨', 'Windy'], hot: ['🔥', 'Scorching'] };
  // [mode, dawn glow, dusk glow, label]: how strongly each glow colours the sky (0–1)
  const TIMES = { sunrise: ['day', 1, 0, 'at sunrise'], noon: ['day', 0, 0, 'at midday'], sunset: ['day', 0, 0.93, 'at sunset'], twilight: ['night', 0, 0.6, 'at twilight'], midnight: ['night', 0, 0, 'at night'] };
  const pick = (o, not) => { const k = Object.keys(o).filter((x) => x !== not); return k[Math.floor(Math.random() * k.length)]; };
  const save = () => { try { sessionStorage.setItem('zein-sky', JSON.stringify(sky)); } catch { /* storage blocked: the sky lasts for this page */ } };
  const q = new URLSearchParams(location.search), hash = location.hash.slice(1), nav = performance.getEntriesByType('navigation')[0];

  let sky = null;
  try { sky = JSON.parse(sessionStorage.getItem('zein-sky')); } catch { /* storage blocked */ }
  if (!sky || !SKIES[sky.wx] || !TIMES[sky.time] || (nav && nav.type === 'reload')) sky = { wx: pick(SKIES), time: pick(TIMES) };
  if (SKIES[q.get('wx')]) sky.wx = q.get('wx');
  if (TIMES[q.get('time')]) sky.time = q.get('time');
  if (hash === 'day' || hash === 'night') sky.mode = hash;
  save();

  const now = () => { const [mode, dawn, dusk] = TIMES[sky.time]; return { wx: sky.wx, mode: sky.mode || mode, dawn, dusk }; };
  document.documentElement.dataset.mode = now().mode;

  window.zeinSky = {
    now,
    setMode(m) { sky.mode = m; save(); }, // the day/night switch wins until the next roll
    // The chip names the current sky; clicking it rolls another. Returns a repaint for after a day/night flip.
    chip(before, onChange) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'wx-chip' });
      const paint = () => {
        const s = now(), [icon, label] = SKIES[s.wx];
        b.innerHTML = `<span aria-hidden="true">${s.wx === 'clear' && s.mode === 'night' ? '🌙' : icon}</span><b>${label}</b>`;
        b.title = `${label} ${TIMES[sky.time][3]}. Click for another sky.`;
        b.setAttribute('aria-label', b.title);
      };
      b.addEventListener('click', () => { sky = { wx: pick(SKIES, sky.wx), time: pick(TIMES) }; save(); paint(); onChange(now()); });
      paint();
      if (before) before.before(b);
      return paint;
    },
  };
})();
