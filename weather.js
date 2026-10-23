// Live sky: the visitor's real weather on the islands (Open-Meteo, no key). Location is only asked for
// when the visitor clicks the chip; coordinates are rounded to ~10 km and stay in their browser.
// Preview any sky with ?wx=clear|cloudy|fog|rain|storm|snow|wind|hot
const local = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: works for this page only */ } },
};
export const SKIES = { clear: ['☀️', 'Clear'], cloudy: ['☁️', 'Cloudy'], fog: ['🌫️', 'Fog'], rain: ['🌧️', 'Rain'], storm: ['⛈️', 'Storm'], snow: ['❄️', 'Snow'], wind: ['💨', 'Windy'], hot: ['🔥', 'Scorching'] };

function classify(code, temp, wind) {
  const wx = temp >= 38 ? 'hot'
    : code >= 95 ? 'storm'
    : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
    : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain'
    : code === 45 || code === 48 ? 'fog'
    : wind >= 35 ? 'wind'
    : code === 2 || code === 3 ? 'cloudy' : 'clear';
  return { wx, windy: wind >= 30 };
}

// Where the visitor is in their day: day or night, plus how strongly dawn and dusk colour the sky (0–1).
// Uses their real sunrise and sunset when we have them, otherwise 6:30 and 18:45 on their clock.
// Preview with ?time=sunrise|noon|sunset|twilight|midnight
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
export function skyClock(s) {
  const [rise, set] = s && s.sun ? s.sun : [390, 1125];
  const now = new Date();
  const forced = { sunrise: rise + 5, noon: 720, sunset: set - 15, twilight: set + 25, midnight: 0 }[new URLSearchParams(location.search).get('time')];
  const m = forced ?? now.getHours() * 60 + now.getMinutes();
  return {
    mode: m >= rise && m < set ? 'day' : 'night',
    dawn: Math.min(ramp(m, rise - 50, rise), 1 - ramp(m, rise + 10, rise + 70)),
    dusk: Math.min(ramp(m, set - 80, set - 10), 1 - ramp(m, set + 10, set + 50)), // golden hour, sunset, then twilight
  };
}
export const autoMode = (s) => skyClock(s).mode;

// Until visitors share their own location they see New York: real snow, heat waves, storms, fog and wind through the year.
const HOME = { loc: [40.7, -74], short: 'NYC', name: 'New York' };

export function startWeather({ before, onChange }) {
  const q = new URLSearchParams(location.search).get('wx');
  const preview = SKIES[q] ? { wx: q, windy: q === 'wind', temp: null, preview: true } : null;
  // Whose sky to show: nobody's (preview, or switched off), the visitor's own, or New York's.
  const target = () => {
    if (preview || local.get('zein-wx-off')) return null;
    const own = local.get('zein-loc');
    return Array.isArray(own) ? { loc: own, home: false } : { loc: HOME.loc, home: true };
  };
  const matches = (c, t, maxAge) => c && t && !!c.w.home === t.home && Date.now() - c.at < maxAge;
  const cached = local.get('zein-wx');
  let state = preview || (matches(cached, target(), 6 * 36e5) ? cached.w : null);
  let denied = !navigator.geolocation;

  const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'wx-chip' });
  if (before) before.before(chip);

  function paint() {
    chip.classList.toggle('on', !!state);
    chip.hidden = denied && !state;
    if (state) {
      const [icon, label] = SKIES[state.wx];
      const temp = state.temp != null ? Math.round(state.temp) + '°' : '';
      chip.innerHTML = `<span aria-hidden="true">${state.wx === 'clear' && autoMode(state) === 'night' ? '🌙' : icon}</span><b>${temp || label}${state.home ? ' ' + HOME.short : ''}</b>`;
      chip.title = state.preview ? `Preview: ${label}. Click to clear.`
        : state.home ? `${label}${temp ? ' ' + temp : ''} in ${HOME.name} right now. ${denied ? 'Location is blocked, so the islands keep New York’s sky.' : 'Click to bring your own weather.'}`
        : `${label}${temp ? ' ' + temp : ''} where you are, live on the islands. Click to turn off.`;
    } else {
      chip.innerHTML = '<span aria-hidden="true">⌖</span><b>Live sky</b>';
      chip.title = 'Bring your local weather to the islands';
    }
    chip.setAttribute('aria-label', chip.title);
  }
  const emit = () => { paint(); onChange(state); };

  async function load(loc, home) {
    chip.classList.add('busy');
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc[0]}&longitude=${loc[1]}&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=auto`);
      const { current: c, daily: d } = await r.json();
      const mins = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
      state = { ...classify(c.weather_code, c.temperature_2m, c.wind_speed_10m), temp: c.temperature_2m, sun: [mins(d.sunrise[0]), mins(d.sunset[0])], home };
      local.set('zein-wx', { at: Date.now(), w: state });
    } catch { /* offline or blocked: keep the current sky */ }
    chip.classList.remove('busy');
    emit();
  }

  // New York's sky → ask for the visitor's own. Their own sky → switch off. Off → back on.
  chip.addEventListener('click', () => {
    if (state && !state.home) { state = null; if (!preview) local.set('zein-wx-off', true); return emit(); }
    local.set('zein-wx-off', false);
    const own = local.get('zein-loc');
    if (Array.isArray(own)) return load(own, false);
    if (denied) return refresh();
    chip.classList.add('busy');
    navigator.geolocation.getCurrentPosition((p) => {
      const loc = [p.coords.latitude, p.coords.longitude].map((n) => +n.toFixed(1));
      local.set('zein-loc', loc);
      load(loc, false);
    }, () => { denied = true; chip.classList.remove('busy'); refresh(); paint(); }, { timeout: 8000, maximumAge: 36e5 });
  });

  // Every minute: the sky follows the clock (dawn, dusk), and weather is refetched once it is 30 minutes old.
  function refresh() {
    const t = target();
    if (t && !(state && matches(local.get('zein-wx'), t, 30 * 6e4))) load(t.loc, t.home);
    else onChange(state);
  }
  setInterval(refresh, 6e4);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  paint();
  setTimeout(refresh); // New York's sky, or the visitor's own if they shared it before, without a click
  return { get state() { return state; } };
}
