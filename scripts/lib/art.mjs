// Low-poly scenery as flat SVG facets. Every shape copies a primitive of the original Three.js world
// (prism islands on inverted cones, cone trees, box houses, squashed-sphere clouds): 2-3 flat tones per
// object, lit from the upper left, no outlines. Lower-case hex colours are re-lit per zone by relight();
// colours that glow (lamps, windows, lava) are written in upper case and keep their value at night.
const TAU = Math.PI * 2;
export const INK = '#1d2340';
export const CLIMATE = {
  meadow: { top: '#7bd96a', lip: '#5cc451', rock: '#a8743f', rock2: '#8b5a2b' },
  desert: { top: '#efc37c', lip: '#dba45e', rock: '#c46a3a', rock2: '#9c4f2a' },
  castle: { top: '#86cf6a', lip: '#68b24f', rock: '#9aa0ad', rock2: '#747a88' },
  snow: { top: '#f4f8ff', lip: '#d9e6f6', rock: '#8a9bb6', rock2: '#6b7b96' },
  city: { top: '#cfd5df', lip: '#aeb6c4', rock: '#8a6c52', rock2: '#6e5440' },
  volcanic: { top: '#4b3c3c', lip: '#3a2e2e', rock: '#2e2626', rock2: '#5a3a2e' },
  tropical: { top: '#8fe06a', lip: '#ecd59a', rock: '#a8743f', rock2: '#8b5a2b' },
  forest: { top: '#5fbf55', lip: '#479c40', rock: '#8b6a45', rock2: '#6e5236' },
  rocky: { top: '#a2a6ae', lip: '#8a8e97', rock: '#6f737c', rock2: '#575b63' },
  ice: { top: '#e6f4ff', lip: '#bfe2ff', rock: '#9cc7ea', rock2: '#7aaed8' },
  village: { top: '#9bd77a', lip: '#7cbf5c', rock: '#a8743f', rock2: '#8b5a2b' },
  rainy: { top: '#6fb57a', lip: '#58995f', rock: '#7b7f8c', rock2: '#62666f' },
};
export const ACCENTS = ['#ff8a1f', '#12b981', '#f2b705', '#7c5cff', '#2f9bff', '#1e6ad6', '#ff5d6c'];

/* ---------- helpers ---------- */
export function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
export const shade = (c, f) => (f <= 1 ? mix('#000000', c, f) : mix(c, '#ffffff', Math.min(1, (f - 1) * 1.6)));
const n = (v) => +v.toFixed(1);
const P = (pts, fill, extra = '') => `<path d="M${pts.map((p) => n(p[0]) + ' ' + n(p[1])).join('L')}Z" fill="${fill}"${extra}/>`;
const R = (x, y, w, h, fill, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;
const C = (x, y, r, fill, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;
const E = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra}/>`;
const G = (inner, tf = '', cls = '') => `<g${cls ? ` class="${cls}"` : ''}${tf ? ` transform="${tf}"` : ''}>${inner}</g>`;
const at = (x, y, inner, s = 1) => G(inner, `translate(${n(x)} ${n(y)})${s !== 1 ? ` scale(${n(s * 100) / 100})` : ''}`);
const glow = (c) => c.toUpperCase();
// brightness of a face whose outward normal points at angle a (0 right, PI/2 towards the viewer, PI left)
const lit = (a) => 0.76 + 0.32 * (0.5 + 0.5 * Math.cos(a - 2.4));
const halo = (x, y, r, c) => C(x, y, r * 2.6, glow(c), ' opacity=".14"') + C(x, y, r * 1.7, glow(c), ' opacity=".22"');

/** Re-light a scene for its zone: light = { mix, amount, mul }. Upper-case (glowing) colours are untouched. */
export function relight(svg, light) {
  if (!light) return svg.replace(/#[0-9A-F]{6}/g, (c) => c.toLowerCase());
  return svg.replace(/#[0-9a-f]{6}\b/g, (c) => shade(mix(c, light.mix, light.amount), light.mul)).replace(/#[0-9A-F]{6}/g, (c) => c.toLowerCase());
}

/* ---------- primitives ---------- */
const cone = (x, by, r, h, c) => P([[x - r, by], [x, by - h], [x, by + r * 0.3]], shade(c, 1.07)) + P([[x, by - h], [x + r, by], [x, by + r * 0.3]], shade(c, 0.8));
const cyl = (x, by, w, h, c) => R(x - w / 2, by - h, w / 2, h, shade(c, 1.04)) + R(x, by - h, w / 2, h, shade(c, 0.82));
const taper = (x, by, w1, w2, h, c) => P([[x - w1 / 2, by], [x - w2 / 2, by - h], [x, by - h], [x, by]], shade(c, 1.04)) + P([[x, by], [x, by - h], [x + w2 / 2, by - h], [x + w1 / 2, by]], shade(c, 0.82));
// box in a shallow cabinet projection: front, lighter top, darker right side
function box(x, by, w, h, d, c) {
  const ox = d * 0.42, oy = d * 0.3, x0 = x - w / 2 - ox / 2;
  return P([[x0, by - h], [x0 + w, by - h], [x0 + w + ox, by - h - oy], [x0 + ox, by - h - oy]], shade(c, 1.1))
    + P([[x0 + w, by - h], [x0 + w + ox, by - h - oy], [x0 + w + ox, by - oy], [x0 + w, by]], shade(c, 0.78))
    + R(x0, by - h, w, h, c);
}
// squashed low-poly sphere: a fan of flat facets around an off-centre highlight
function puff(x, y, r, c, seed = 1, sq = 0.8) {
  const k = 8, v = [];
  for (let i = 0; i < k; i++) { const a = (i / k) * TAU + seed, rr = r * (0.9 + 0.14 * Math.sin(seed * 7 + i * 2.3)); v.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq, a]); }
  const cx = x - r * 0.18, cy = y - r * 0.22 * sq;
  let s = '';
  for (let i = 0; i < k; i++) { const A = v[i], B = v[(i + 1) % k]; s += P([[cx, cy], [A[0], A[1]], [B[0], B[1]]], shade(c, 0.86 + 0.2 * (0.5 + 0.5 * Math.cos((A[2] + B[2]) / 2 + 2.2)))); }
  return s;
}
export function cloud(w, c = '#f4f7fb', seed = 1) {
  const r = rng('cloud' + seed), k = 3 + Math.floor(r() * 3);
  let s = '';
  for (let i = 0; i < k; i++) { const t = k === 1 ? 0.5 : i / (k - 1); s += puff((t - 0.5) * w * 0.72, -Math.sin(t * Math.PI) * w * 0.1 + r() * 4, w * (0.2 + 0.12 * Math.sin(t * Math.PI) + r() * 0.05), c, seed + i * 1.7, 0.72); }
  return s;
}

/* ---------- props (u = one world unit, about 40 px on a size-1 island) ---------- */
const tree = (u, leaf = '#3fbf6f') => R(-0.07 * u, -0.35 * u, 0.14 * u, 0.37 * u, '#8b5a2b') + cone(0, -0.3 * u, 0.3 * u, 0.75 * u, leaf);
const pine = (u, snowy) => (snowy ? tree(u, '#2f8f5a') + cone(0, -0.76 * u, 0.17 * u, 0.3 * u, '#ffffff') : tree(u, '#2f9f5c'));
const darkPine = (u) => R(-0.07 * u, -0.3 * u, 0.14 * u, 0.32 * u, '#6e5236') + cone(0, -0.25 * u, 0.34 * u, 0.6 * u, '#2f8f5a') + cone(0, -0.6 * u, 0.25 * u, 0.55 * u, '#2f8f5a');
function rockLump(u, c = '#9aa0ad') {
  return P([[-0.2 * u, 0], [-0.13 * u, -0.17 * u], [0.02 * u, -0.22 * u], [0.02 * u, 0.04 * u]], shade(c, 1.06))
    + P([[0.02 * u, -0.22 * u], [0.17 * u, -0.13 * u], [0.22 * u, 0], [0.02 * u, 0.04 * u]], shade(c, 0.8));
}
function cactus(u) {
  const m = '#3f9f5a';
  return R(-0.2 * u, -0.34 * u, 0.14 * u, 0.09 * u, shade(m, 0.92)) + cyl(-0.19 * u, -0.3 * u, 0.1 * u, 0.2 * u, m)
    + R(0.06 * u, -0.44 * u, 0.14 * u, 0.09 * u, shade(m, 0.8)) + cyl(0.19 * u, -0.4 * u, 0.1 * u, 0.2 * u, m) + cyl(0, 0, 0.17 * u, 0.62 * u, m);
}
function palm(u) {
  let s = '';
  for (let i = 0; i < 4; i++) s += cyl(i * 0.035 * u, -i * 0.22 * u, (0.13 - i * 0.012) * u, 0.25 * u, '#a87a4a');
  const tx = 0.14 * u, ty = -0.95 * u;
  [[-2.6, 0.5, 0.8], [-0.55, 0.5, 0.8], [-2.95, 0.46, 1.04], [-0.2, 0.46, 1.04], [-2.2, 0.34, 0.92], [-0.95, 0.34, 0.92]].forEach(([a, len, f]) => {
    const ex = tx + Math.cos(a) * len * u, ey = ty + Math.sin(a) * len * u * 0.55 + 0.1 * u, nx = -Math.sin(a) * 0.07 * u, ny = Math.cos(a) * 0.07 * u;
    s += P([[tx, ty], [(tx + ex) / 2 + nx, (ty + ey) / 2 + ny - 0.09 * u], [ex, ey], [(tx + ex) / 2 - nx, (ty + ey) / 2 - ny - 0.03 * u]], shade('#3fbf6f', f));
  });
  return s + C(tx, ty + 0.05 * u, 0.06 * u, '#6b4a2b');
}
const dune = (u, c = '#e3b067') => P([[-0.5 * u, 0], [-0.1 * u, -0.14 * u], [0.05 * u, 0.03 * u]], shade(c, 1.06)) + P([[-0.1 * u, -0.14 * u], [0.5 * u, 0], [0.05 * u, 0.03 * u]], shade(c, 0.86));
function house(u, roof = '#e05a47', on = false) {
  return box(0, 0, 0.34 * u, 0.26 * u, 0.3 * u, '#fff5e6')
    + P([[-0.26 * u, -0.26 * u], [-0.02 * u, -0.5 * u], [0.11 * u, -0.26 * u]], roof) + P([[-0.02 * u, -0.5 * u], [0.11 * u, -0.26 * u], [0.24 * u, -0.35 * u]], shade(roof, 0.76))
    + R(-0.12 * u, -0.18 * u, 0.09 * u, 0.09 * u, on ? glow('#ffd27a') : '#2b3350');
}
const crystal = (u, h = 0.5) => P([[-0.12 * u, -h * u * 0.5], [0, -h * u], [0, 0]], glow('#d6f1ff')) + P([[0, -h * u], [0.12 * u, -h * u * 0.5], [0, 0]], glow('#8fd0ff'));
const lantern = (u, on) => R(-0.03 * u, -0.7 * u, 0.06 * u, 0.7 * u, INK) + (on ? halo(0, -0.76 * u, 0.13 * u, '#ffb347') : '') + C(0, -0.76 * u, 0.13 * u, on ? glow('#ffd98a') : '#ffe2a8');
const drift = (u) => P([[-0.42 * u, 0], [-0.1 * u, -0.12 * u], [0, 0.04 * u]], '#ffffff') + P([[-0.1 * u, -0.12 * u], [0.42 * u, 0], [0, 0.04 * u]], shade('#ffffff', 0.9));
const pond = (u, r = 0.42) => E(0, 0, r * u, r * u * 0.4, '#38b6ff') + E(-0.08 * u, -0.03 * u, r * u * 0.5, r * u * 0.14, '#7fd0ff');
const flag = (u, c) => R(-0.02 * u, -1.1 * u, 0.04 * u, 1.1 * u, INK) + P([[0.02 * u, -1.1 * u], [0.44 * u, -1.1 * u], [0.34 * u, -0.98 * u], [0.44 * u, -0.86 * u], [0.02 * u, -0.86 * u]], c);
function gearWheel(u, c, r = 0.45) {
  let s = '';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; s += P([[-0.09 * u, -(r + 0.24) * u], [0.09 * u, -(r + 0.24) * u], [0.11 * u, -r * u], [-0.11 * u, -r * u]], shade(c, i % 2 ? 0.86 : 1), ` transform="rotate(${n((a * 180) / Math.PI)})"`); }
  return s + C(0, 0, (r + 0.06) * u, c) + C(0, 0, r * 0.62 * u, shade(c, 0.78)) + C(0, 0, r * 0.36 * u, INK);
}
function castleTower(u, c, on) {
  return taper(0, 0, 0.4 * u, 0.34 * u, 0.75 * u, '#c3c8d2') + cone(0, -0.75 * u, 0.26 * u, 0.4 * u, c) + R(-0.03 * u, -0.56 * u, 0.06 * u, 0.13 * u, on ? glow('#ffcf73') : '#2b3350');
}
const wall = (u, w) => box(0, 0, w, 0.3 * u, 0.14 * u, '#c3c8d2');
function volcano(u, on = true) {
  return P([[-0.75 * u, 0], [-0.22 * u, -1.1 * u], [0, -1.02 * u], [0, 0.12 * u]], shade('#4b3c3c', 1.08)) + P([[0, -1.02 * u], [0.22 * u, -1.1 * u], [0.75 * u, 0], [0, 0.12 * u]], shade('#3a2e2e', 0.82))
    + P([[-0.22 * u, -1.1 * u], [0, -1.02 * u], [0.22 * u, -1.1 * u], [0, -1.16 * u]], glow('#ff6a00'))
    + P([[-0.05 * u, -1.03 * u], [0.06 * u, -1.03 * u], [0.12 * u, -0.5 * u], [0.02 * u, -0.2 * u], [-0.02 * u, -0.55 * u]], glow(on ? '#ff6a00' : '#d95a00'));
}
function bird(u, c = '#2b3350') {
  return P([[-0.05 * u, 0], [0.2 * u, -0.03 * u], [-0.05 * u, 0.06 * u]], c) + G(P([[0, 0], [-0.3 * u, -0.2 * u], [-0.12 * u, 0.02 * u]], c) + P([[0, 0], [0.26 * u, -0.22 * u], [0.1 * u, 0.02 * u]], shade(c, 0.9)), '', 'flap');
}
function parrot(u, c = '#e05a47') {
  return P([[-0.3 * u, 0.02 * u], [-0.05 * u, -0.06 * u], [0, 0.06 * u]], '#2f9bff') + P([[-0.08 * u, -0.08 * u], [0.14 * u, -0.1 * u], [0.2 * u, 0.02 * u], [0, 0.08 * u]], c)
    + P([[0.14 * u, -0.1 * u], [0.27 * u, -0.07 * u], [0.2 * u, 0.02 * u]], shade(c, 0.85)) + P([[0.27 * u, -0.07 * u], [0.34 * u, -0.02 * u], [0.25 * u, -0.01 * u]], '#f2b705')
    + G(P([[0.02 * u, -0.06 * u], [-0.14 * u, -0.36 * u], [0.14 * u, -0.08 * u]], '#12b981') + P([[0.02 * u, -0.06 * u], [-0.02 * u, -0.3 * u], [0.14 * u, -0.08 * u]], '#f2b705'), '', 'flap');
}
function owl(u) {
  return P([[-0.14 * u, 0], [-0.16 * u, -0.3 * u], [-0.1 * u, -0.4 * u], [0, -0.34 * u], [0, 0]], '#8b6a45') + P([[0, 0], [0, -0.34 * u], [0.1 * u, -0.4 * u], [0.16 * u, -0.3 * u], [0.14 * u, 0]], '#6e5236')
    + C(-0.06 * u, -0.27 * u, 0.05 * u, glow('#ffe2a8')) + C(0.06 * u, -0.27 * u, 0.05 * u, glow('#ffe2a8')) + C(-0.06 * u, -0.27 * u, 0.02 * u, glow('#1d2340')) + C(0.06 * u, -0.27 * u, 0.02 * u, glow('#1d2340'))
    + P([[-0.02 * u, -0.22 * u], [0.02 * u, -0.22 * u], [0, -0.17 * u]], '#f2b705');
}
function penguin(u) {
  return P([[-0.11 * u, 0], [-0.13 * u, -0.22 * u], [-0.06 * u, -0.38 * u], [0.06 * u, -0.38 * u], [0.13 * u, -0.22 * u], [0.11 * u, 0]], '#2b3350')
    + P([[-0.07 * u, 0], [-0.08 * u, -0.2 * u], [0, -0.29 * u], [0.08 * u, -0.2 * u], [0.07 * u, 0]], '#f4f8ff') + P([[-0.02 * u, -0.3 * u], [0.07 * u, -0.27 * u], [-0.02 * u, -0.25 * u]], '#ff8a1f')
    + R(-0.1 * u, -0.01 * u, 0.08 * u, 0.03 * u, '#ff8a1f') + R(0.02 * u, -0.01 * u, 0.08 * u, 0.03 * u, '#ff8a1f');
}
function deer(u) {
  const c = '#a8743f';
  return R(-0.2 * u, -0.26 * u, 0.04 * u, 0.26 * u, shade(c, 0.8)) + R(-0.12 * u, -0.26 * u, 0.04 * u, 0.26 * u, c) + R(0.1 * u, -0.26 * u, 0.04 * u, 0.26 * u, shade(c, 0.8)) + R(0.17 * u, -0.26 * u, 0.04 * u, 0.26 * u, c)
    + P([[-0.24 * u, -0.42 * u], [0.2 * u, -0.44 * u], [0.24 * u, -0.26 * u], [-0.22 * u, -0.24 * u]], c) + P([[-0.24 * u, -0.42 * u], [-0.3 * u, -0.34 * u], [-0.22 * u, -0.3 * u]], '#fff5e6')
    + P([[0.14 * u, -0.42 * u], [0.24 * u, -0.66 * u], [0.3 * u, -0.6 * u], [0.24 * u, -0.34 * u]], shade(c, 1.08)) + P([[0.22 * u, -0.68 * u], [0.4 * u, -0.6 * u], [0.3 * u, -0.54 * u]], c)
    + R(0.23 * u, -0.86 * u, 0.02 * u, 0.2 * u, '#6e5236') + R(0.29 * u, -0.84 * u, 0.02 * u, 0.18 * u, '#6e5236') + R(0.2 * u, -0.8 * u, 0.06 * u, 0.02 * u, '#6e5236') + R(0.29 * u, -0.78 * u, 0.06 * u, 0.02 * u, '#6e5236');
}
function windmillBody(u) {
  return taper(0, 0, 0.5 * u, 0.3 * u, 1.3 * u, '#fff5e6') + cone(0, -1.3 * u, 0.24 * u, 0.3 * u, '#e05a47') + R(-0.06 * u, -0.28 * u, 0.12 * u, 0.28 * u, '#8b5a2b') + R(-0.04 * u, -0.8 * u, 0.08 * u, 0.1 * u, '#2b3350');
}
function windmillBlades(u) {
  let s = '';
  for (let i = 0; i < 4; i++) s += G(R(-0.03 * u, -0.95 * u, 0.06 * u, 0.95 * u, INK) + P([[0.03 * u, -0.95 * u], [0.26 * u, -0.9 * u], [0.26 * u, -0.25 * u], [0.03 * u, -0.25 * u]], i % 2 ? '#f4f7fb' : '#dfe6ee'), `rotate(${i * 90})`);
  return s + C(0, 0, 0.08 * u, INK);
}
function kite(u, c) {
  return P([[0, -0.3 * u], [-0.2 * u, 0], [0, 0.06 * u]], shade(c, 1.1)) + P([[0, -0.3 * u], [0.2 * u, 0], [0, 0.06 * u]], shade(c, 0.86)) + P([[-0.2 * u, 0], [0, 0.34 * u], [0, 0.06 * u]], shade(c, 0.95)) + P([[0.2 * u, 0], [0, 0.34 * u], [0, 0.06 * u]], shade(c, 0.74))
    + `<path d="M0 ${n(0.34 * u)}q${n(0.12 * u)} ${n(0.2 * u)} 0 ${n(0.4 * u)}t0 ${n(0.4 * u)}" fill="none" stroke="${INK}" stroke-width="${n(0.025 * u)}"/>`;
}
function container(u, c, w = 0.7) {
  const b = box(0, 0, w * u, 0.3 * u, 0.3 * u, c);
  let ribs = '';
  for (let i = 1; i < 5; i++) ribs += R(-w * u / 2 - 0.063 * u + (i * w * u) / 5, -0.27 * u, 0.02 * u, 0.24 * u, shade(c, 0.84));
  return b + ribs;
}
function lighthouse(u, c = '#e05a47', on = true) {
  return taper(0, 0, 0.5 * u, 0.3 * u, 1.5 * u, '#fff5e6') + P([[-0.21 * u, -0.5 * u], [-0.17 * u, -0.8 * u], [0.17 * u, -0.8 * u], [0.21 * u, -0.5 * u]], c) + P([[0, -0.5 * u], [0, -0.8 * u], [0.17 * u, -0.8 * u], [0.21 * u, -0.5 * u]], shade(c, 0.8))
    + P([[-0.16 * u, -1.1 * u], [-0.15 * u, -1.3 * u], [0.15 * u, -1.3 * u], [0.16 * u, -1.1 * u]], shade(c, 0.9))
    + R(-0.2 * u, -1.54 * u, 0.4 * u, 0.05 * u, INK) + (on ? halo(0, -1.66 * u, 0.12 * u, '#ffd76a') : '') + R(-0.12 * u, -1.78 * u, 0.24 * u, 0.24 * u, on ? glow('#ffe9a8') : '#8fd0ff') + cone(0, -1.78 * u, 0.2 * u, 0.2 * u, c);
}
function peak(u, c = '#8a9bb6', snow = true) {
  return P([[-0.9 * u, 0], [-0.1 * u, -1.6 * u], [0.1 * u, 0.1 * u]], shade(c, 1.08)) + P([[-0.1 * u, -1.6 * u], [0.8 * u, 0], [0.1 * u, 0.1 * u]], shade(c, 0.78))
    + (snow ? P([[-0.4 * u, -1.0 * u], [-0.1 * u, -1.6 * u], [-0.02 * u, -0.92 * u], [-0.2 * u, -1.08 * u]], '#ffffff') + P([[-0.1 * u, -1.6 * u], [0.24 * u, -1.0 * u], [0.08 * u, -1.1 * u], [-0.02 * u, -0.92 * u]], shade('#ffffff', 0.86)) : '');
}
const gold = (u) => P([[-0.3 * u, 0], [0, -0.34 * u], [0.04 * u, 0.06 * u]], glow('#ffd34d')) + P([[0, -0.34 * u], [0.32 * u, 0], [0.04 * u, 0.06 * u]], glow('#e0a100')) + box(0.36 * u, 0.06 * u, 0.16 * u, 0.1 * u, 0.12 * u, '#ffd34d') + box(-0.36 * u, 0.08 * u, 0.16 * u, 0.1 * u, 0.12 * u, '#f2b705');
function arch(u, c, w = 0.6) {
  return `<path d="M${n(-w * u)} 0A${n(w * u)} ${n(w * u * 0.8)} 0 0 1 ${n(w * u)} 0" fill="none" stroke="${shade(c, 0.8)}" stroke-width="${n(0.2 * u)}"/><path d="M${n(-w * u)} ${n(-0.04 * u)}A${n(w * u)} ${n(w * u * 0.8)} 0 0 1 ${n(w * u)} ${n(-0.04 * u)}" fill="none" stroke="${c}" stroke-width="${n(0.12 * u)}"/>`;
}

/* ---------- island base: 7-sided prism, lip, inverted rock cone, small second cone ---------- */
const K = 0.4;
export function base(rad, ground, a0 = 0.3, opts = {}) {
  const c = CLIMATE[ground] || CLIMATE.meadow, H = rad * 0.17, L = rad * 0.07, D = rad * (opts.depth || 1.3);
  const V = [...Array(7)].map((_, i) => { const a = a0 + (i * TAU) / 7; return [Math.cos(a) * rad, Math.sin(a) * rad * K]; });
  let rock = '', lip = '', side = '';
  for (let i = 0; i < 7; i++) {
    const am = a0 + ((i + 0.5) * TAU) / 7;
    if (Math.sin(am) < -0.25) continue;
    const A = V[i], B = V[(i + 1) % 7], f = lit(am), s1 = 0.97, s2 = 0.92;
    side += P([A, B, [B[0] * s1, B[1] * s1 + H], [A[0] * s1, A[1] * s1 + H]], shade(c.top, f * 0.84));
    lip += P([[A[0] * s1, A[1] * s1 + H], [B[0] * s1, B[1] * s1 + H], [B[0] * s2, B[1] * s2 + H + L], [A[0] * s2, A[1] * s2 + H + L]], shade(c.lip, f * 0.88));
    rock += P([[A[0] * s2, A[1] * s2 + H + L], [B[0] * s2, B[1] * s2 + H + L], [rad * 0.06, H + L + D]], shade(c.rock, f));
  }
  const r2 = rad * 0.4, x2 = rad * 0.36, y2 = H + L + rad * 0.12, d2 = rad * 0.66;
  const rock2 = P([[x2 - r2, y2], [x2, y2 + r2 * 0.34], [x2 + r2 * 0.1, y2 + d2]], shade(c.rock2, 1.04)) + P([[x2, y2 + r2 * 0.34], [x2 + r2, y2], [x2 + r2 * 0.1, y2 + d2]], shade(c.rock2, 0.8));
  return rock + rock2 + lip + side + P(V, c.top);
}
/** tiny island silhouette used before a zone's scenery has loaded and at world zoom */
export function liteBase(rad, ground, ghost) {
  const c = CLIMATE[ground] || CLIMATE.meadow, V = [...Array(7)].map((_, i) => { const a = 0.3 + (i * TAU) / 7; return [Math.cos(a) * rad, Math.sin(a) * rad * K]; });
  const H = rad * 0.24, bot = [[-rad, 0], [-rad * 0.9, H], [rad * 0.06, rad * 1.5], [rad * 0.9, H], [rad, 0]];
  if (ghost) return P(bot, 'none', ' class="gh"') + P(V, 'none', ' class="gh"');
  return P([bot[0], bot[1], bot[2], [rad * 0.06, 0]], c.rock) + P([[rad * 0.06, 0], bot[2], bot[3], bot[4]], shade(c.rock, 0.78)) + P([[-rad, 0], [rad, 0], [rad * 0.9, H], [-rad * 0.9, H]], shade(c.top, 0.84)) + P(V, c.top);
}
const on = (a, d, rad) => [Math.cos(a) * d * rad, Math.sin(a) * d * rad * K];

/* ---------- project landmarks (centre of the island) ---------- */
export const BUILD = {
  rocket(c, u) {
    let fins = '';
    [[-1, 1.05], [1, 0.8]].forEach(([sx, f]) => { fins += P([[sx * 0.28 * u, -0.72 * u], [sx * 0.56 * u, -0.3 * u], [sx * 0.28 * u, -0.38 * u]], shade(c, f)); });
    return P([[-0.66 * u, -0.02 * u], [-0.4 * u, -0.16 * u], [0.4 * u, -0.16 * u], [0.66 * u, -0.02 * u], [0.4 * u, 0.12 * u], [-0.4 * u, 0.12 * u]], '#9aa4b8') + P([[-0.66 * u, -0.02 * u], [-0.4 * u, 0.12 * u], [0.4 * u, 0.12 * u], [0.66 * u, -0.02 * u], [0.4 * u, 0.2 * u], [-0.4 * u, 0.2 * u]], shade('#9aa4b8', 0.8))
      + P([[-0.14 * u, -0.38 * u], [0.14 * u, -0.38 * u], [0, -0.02 * u]], glow('#ff8a00'), ' class="flame"') + fins + cyl(0, -0.38 * u, 0.6 * u, 1.15 * u, '#ffffff') + cone(0, -1.53 * u, 0.3 * u, 0.55 * u, c) + R(-0.06 * u, -0.74 * u, 0.12 * u, 0.36 * u, shade(c, 0.9))
      + C(0, -1.12 * u, 0.13 * u, INK) + C(0, -1.12 * u, 0.09 * u, glow('#8fd0ff'));
  },
  shield(c, u) {
    const k = u / 40;
    return `<ellipse class="pulse" cx="0" cy="${n(-0.1 * u)}" rx="${n(0.9 * u)}" ry="${n(0.34 * u)}" fill="none" stroke="${glow(c)}" stroke-width="${n(0.07 * u)}"/>`
      + G(`<path d="M0 -84L33 -72V-44Q33 -16 0 -2Q-33 -16 -33 -44V-72Z" fill="${shade(c, 0.78)}" transform="translate(4 3)"/><path d="M0 -84L33 -72V-44Q33 -16 0 -2Q-33 -16 -33 -44V-72Z" fill="${c}"/><path d="M0 -84L33 -72V-44Q33 -16 0 -2Z" fill="${shade(c, 0.88)}"/><path d="M-13 -44L-3 -33L15 -55" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, `translate(0 ${n(-0.42 * u)}) scale(${n(k * 100) / 100})`, 'hover');
  },
  tower(c, u) {
    return ['#c7b8ff', '#9f88ff', c].map((cc, i) => box(0, -i * 0.44 * u, (1.0 - i * 0.12) * u, 0.38 * u, (0.6 - i * 0.06) * u, cc)
      + R((-0.52 + i * 0.06) * u, (-0.24 - i * 0.44) * u, 0.34 * u, 0.07 * u, glow(i === 2 ? '#22c55e' : '#8fd0ff'))).join('');
  },
  gear(c, u) {
    return box(0, 0, 1.5 * u, 0.1 * u, 0.4 * u, INK) + box(0.3 * u, -0.1 * u, 0.26 * u, 0.26 * u, 0.26 * u, '#ffd34d') + R(-0.29 * u, -0.62 * u, 0.08 * u, 0.5 * u, INK)
      + G(G(gearWheel(u, c), '', 'gear'), `translate(${n(-0.25 * u)} ${n(-0.95 * u)})`);
  },
  observatory(c, u) {
    return box(-0.75 * u, 0.1 * u, 0.5 * u, 0.05 * u, 0.36 * u, '#ffffff') + box(-0.73 * u, 0.04 * u, 0.5 * u, 0.05 * u, 0.36 * u, glow('#fff6d6'))
      + taper(0, 0, 1.24 * u, 1.1 * u, 0.85 * u, '#e8edf6')
      + `<path d="M${n(-0.6 * u)} ${n(-0.85 * u)}A${n(0.6 * u)} ${n(0.6 * u)} 0 0 1 ${n(0.6 * u)} ${n(-0.85 * u)}Z" fill="${c}"/><path d="M0 ${n(-1.45 * u)}A${n(0.6 * u)} ${n(0.6 * u)} 0 0 1 ${n(0.6 * u)} ${n(-0.85 * u)}H0Z" fill="${shade(c, 0.8)}"/>`
      + P([[0.1 * u, -1.2 * u], [0.26 * u, -1.08 * u], [0.74 * u, -1.6 * u], [0.62 * u, -1.7 * u]], INK) + C(0.68 * u, -1.65 * u, 0.07 * u, glow('#8fd0ff'));
  },
  bridge(c, u) {
    return G(tree(u), `translate(${n(0.62 * u)} ${n(0.2 * u)})`) + G(arch(u, c), `translate(${n(-0.25 * u)} ${n(-0.1 * u)})`) + box(-0.25 * u, -0.08 * u, 1.5 * u, 0.08 * u, 0.32 * u, INK) + G(flag(u, c), `translate(${n(0.5 * u)} ${n(-0.12 * u)})`);
  },
  signpost(c, u) {
    const board = (y, w, col, dir) => P(dir > 0 ? [[-0.05 * u, y], [w * u, y], [(w + 0.12) * u, y + 0.1 * u], [w * u, y + 0.2 * u], [-0.05 * u, y + 0.2 * u]] : [[0.05 * u, y], [-w * u, y], [-(w + 0.12) * u, y + 0.1 * u], [-w * u, y + 0.2 * u], [0.05 * u, y + 0.2 * u]], col);
    return G(house(u * 1.2, '#e05a47'), `translate(${n(-0.62 * u)} ${n(0.06 * u)})`) + R(-0.05 * u, -1.5 * u, 0.1 * u, 1.5 * u, INK) + board(-1.45 * u, 0.6, '#ff8a1f', 1) + board(-1.18 * u, 0.55, '#12b981', -1) + board(-0.9 * u, 0.5, '#2f9bff', 1) + board(-0.62 * u, 0.42, c, -1);
  },
  wheel(c, u) {
    let s = R(-0.06 * u, -0.5 * u, 0.12 * u, 0.5 * u, '#8b5a2b') + P([[-0.3 * u, 0], [0, -0.14 * u], [0.3 * u, 0], [0, 0.1 * u]], shade('#8b5a2b', 0.8)), w = '';
    for (let i = 0; i < 8; i++) w += G(R(-0.03 * u, -0.66 * u, 0.06 * u, 0.66 * u, '#a8743f') + C(0, -0.68 * u, 0.06 * u, shade('#a8743f', 0.8)), `rotate(${i * 45})`);
    w += `<circle r="${n(0.46 * u)}" fill="none" stroke="${c}" stroke-width="${n(0.13 * u)}"/><circle r="${n(0.46 * u)}" fill="none" stroke="${shade(c, 0.8)}" stroke-width="${n(0.05 * u)}"/>` + C(0, 0, 0.14 * u, INK);
    return s + G(G(w, '', 'gear slow'), `translate(0 ${n(-0.92 * u)})`);
  },
  terminal(c, u) {
    return box(0, 0, 1.1 * u, 0.12 * u, 0.5 * u, '#9aa4b8') + box(0, -0.12 * u, 0.16 * u, 0.16 * u, 0.1 * u, INK) + box(0, -0.26 * u, 1.0 * u, 0.7 * u, 0.12 * u, '#e8edf6') + R(-0.47 * u, -0.9 * u, 0.86 * u, 0.56 * u, '#2b3350')
      + `<path d="M${n(-0.36 * u)} ${n(-0.76 * u)}l${n(0.14 * u)} ${n(0.12 * u)}l${n(-0.14 * u)} ${n(0.12 * u)}" fill="none" stroke="${glow(c)}" stroke-width="${n(0.06 * u)}" stroke-linecap="round" stroke-linejoin="round"/>` + R(-0.12 * u, -0.56 * u, 0.24 * u, 0.06 * u, glow(c), ' class="blink"');
  },
  crate(c, u) {
    return G(container(u, c), `translate(${n(-0.36 * u)} 0)`) + G(container(u, '#2f9bff'), `translate(${n(0.4 * u)} ${n(0.02 * u)})`) + G(container(u, '#ff8a1f'), `translate(${n(0.02 * u)} ${n(-0.3 * u)})`) + G(container(u, '#12b981', 0.5), `translate(${n(-0.06 * u)} ${n(-0.6 * u)})`);
  },
  beacon(c, u) {
    const arc = (r, o) => `<path d="M${n(-r * 0.7 * u)} ${n((-1.5 - r * 0.7) * u)}A${n(r * u)} ${n(r * u)} 0 0 1 ${n(r * 0.7 * u)} ${n((-1.5 - r * 0.7) * u)}" fill="none" stroke="${glow(c)}" stroke-width="${n(0.06 * u)}" stroke-linecap="round" opacity="${o}" class="ping"/>`;
    return box(0, 0, 0.6 * u, 0.22 * u, 0.4 * u, '#9aa4b8') + P([[-0.24 * u, -0.22 * u], [-0.03 * u, -1.45 * u], [0.03 * u, -1.45 * u], [0.24 * u, -0.22 * u], [0.16 * u, -0.22 * u], [0, -1.1 * u], [-0.16 * u, -0.22 * u]], INK)
      + R(-0.16 * u, -0.62 * u, 0.32 * u, 0.04 * u, INK) + R(-0.1 * u, -0.98 * u, 0.2 * u, 0.04 * u, INK) + halo(0, -1.5 * u, 0.1 * u, c) + C(0, -1.5 * u, 0.1 * u, glow(c)) + arc(0.3, 0.9) + arc(0.5, 0.55);
  },
  vault(c, u) {
    return box(0, 0, 0.95 * u, 0.9 * u, 0.5 * u, '#9aa4b8') + R(-0.5 * u, -0.8 * u, 0.74 * u, 0.7 * u, shade('#9aa4b8', 0.86)) + C(-0.13 * u, -0.45 * u, 0.26 * u, c) + C(-0.13 * u, -0.45 * u, 0.17 * u, shade(c, 0.8))
      + R(-0.16 * u, -0.66 * u, 0.06 * u, 0.42 * u, '#ffffff') + R(-0.34 * u, -0.48 * u, 0.42 * u, 0.06 * u, '#ffffff') + C(-0.13 * u, -0.45 * u, 0.06 * u, INK);
  },
  balloon(c, u) {
    const cy = -2.3 * u, r = 1.05 * u;
    let gores = '';
    for (let i = 0; i < 6; i++) { const a = -r + (i * 2 * r) / 6, b = a + (2 * r) / 6; gores += `<path d="M${n(a * 0.24)} ${n(cy + r * 1.3)}Q${n(a * 1.5)} ${n(cy)} ${n(a * 0.3)} ${n(cy - r * 1.05)}H${n(b * 0.3)}Q${n(b * 1.5)} ${n(cy)} ${n(b * 0.24)} ${n(cy + r * 1.3)}Z" fill="${shade(c, 1.1 - i * 0.065)}"/>`; }
    return [[-0.24, -0.3], [0.24, -0.3]].map(([x]) => R(x * u - 0.015 * u, -0.95 * u, 0.03 * u, 0.6 * u, INK)).join('') + gores
      + `<path d="M${n(-r * 0.98)} ${n(cy - 0.02 * u)}Q0 ${n(cy + 0.36 * u)} ${n(r * 0.98)} ${n(cy - 0.02 * u)}L${n(r * 0.96)} ${n(cy + 0.16 * u)}Q0 ${n(cy + 0.54 * u)} ${n(-r * 0.96)} ${n(cy + 0.16 * u)}Z" fill="#ffffff"/>`
      + halo(0, -1.02 * u, 0.1 * u, '#ff9a3c') + C(0, -1.02 * u, 0.1 * u, glow('#ffd38a')) + box(0, 0, 0.56 * u, 0.42 * u, 0.3 * u, '#a8743f');
  },
};
/** landmark heights in units, used to place the label above each island */
export const HEIGHT = { rocket: 2.15, shield: 2.75, tower: 1.55, gear: 1.75, observatory: 1.8, bridge: 1.35, signpost: 1.6, wheel: 1.75, terminal: 1.1, crate: 1.1, beacon: 2.05, vault: 1.15, balloon: 2.95 };
/** choose a landmark for a project that has no explicit one, from its name, title and stack */
export function pickBuilding(p) {
  const t = `${p.name} ${p.title} ${(p.stack || []).join(' ')}`.toLowerCase();
  const rules = [[/helm|kustomize|argo ?cd|chart/, 'wheel'], [/mfa|iam|role|ssh|key rotation|public s3|s3-public/, 'vault'], [/secret|security ?hub|pod security|pod-security|policy|hardening/, 'shield'],
    [/anomaly|slo|burn|fluent|alert/, 'beacon'], [/prometheus|grafana|datadog|observab/, 'observatory'], [/image|docker|container/, 'crate'], [/vpc|network/, 'bridge'],
    [/lambda/, 'rocket'], [/github actions|semver|drift|blue|deploy|pipeline/, 'gear'], [/terraform|module/, 'tower'], [/bash|python|cli|script|inventory|report|powershell/, 'terminal']];
  for (const [re, b] of rules) if (re.test(t)) return b;
  return 'tower';
}

/* ---------- climate decoration on the rim of an island ---------- */
function decorate(ground, rad, u, r, c, night) {
  const items = []; // [y, svg] painted back to front
  const put = (a, d, svg) => { const [x, y] = on(a, d, rad); items.push([y, at(x, y, svg)]); };
  const j = () => 0.85 + r() * 0.3;
  switch (ground) {
    case 'desert': put(0.5, 0.76, cactus(u * j())); put(2.6, 0.74, rockLump(u, '#c46a3a')); put(4.5, 0.72, cactus(u * 0.8)); put(1.8, 0.6, dune(u)); put(3.7, 0.5, dune(u * 0.8)); break;
    case 'castle': {
      [[5.6, 0.86], [3.9, 0.86], [0.2, 0.9], [2.9, 0.9]].forEach(([a, d]) => put(a, d, castleTower(u * 0.9, c, night)));
      put(4.75, 0.82, wall(u, rad * 0.7)); put(1.2, 0.72, tree(u * 0.8)); put(2.1, 0.76, tree(u * 0.7)); break;
    }
    case 'snow': put(0.4, 0.74, pine(u * j(), true)); put(2.5, 0.72, pine(u * 0.9, true)); put(4.4, 0.7, pine(u * 0.8, true)); put(1.5, 0.66, crystal(u, 0.5)); put(3.4, 0.64, crystal(u, 0.66)); put(2.0, 0.42, drift(u)); put(5.3, 0.5, drift(u * 0.8)); break;
    case 'city': {
      const tones = ['#f6d6a8', '#cfe3ff', '#ffd1dc', '#d8f2d0', '#e6dcff', '#fff1b8'];
      [0.3, 1.35, 2.4, 3.45, 4.5, 5.55].forEach((a, i) => {
        const h = (0.45 + ((i * 37) % 6) * 0.13) * u, w = (0.26 + (i % 3) * 0.05) * u;
        let b = box(0, 0, w, h, w, tones[i]);
        for (let k = 0; k < Math.floor(h / (0.2 * u)); k++) b += R(-w / 2 - w * 0.12, -h + (0.08 + k * 0.2) * u, w * 0.62, 0.06 * u, night ? glow('#ffd27a') : '#2b3350');
        put(a, 0.74, b);
      });
      break;
    }
    case 'volcanic': put(5.0, 0.5, volcano(u * 0.8)); put(0.6, 0.76, rockLump(u, '#5a3a2e')); put(2.5, 0.74, rockLump(u * 1.2, '#5a3a2e')); put(1.6, 0.5, R(-0.26 * u, -0.01 * u, 0.52 * u, 0.04 * u, glow('#ff6a00'))); put(3.5, 0.62, R(-0.2 * u, -0.01 * u, 0.4 * u, 0.04 * u, glow('#ff6a00'), ' transform="rotate(-18)"')); break;
    case 'tropical': put(5.9, 0.74, palm(u * j())); put(3.6, 0.74, palm(u * 1.05)); put(2.0, 0.52, pond(u)); put(1.1, 0.78, rockLump(u * 0.8, '#ecd59a')); break;
    case 'forest': [0.2, 1.4, 2.7, 3.9, 5.2].forEach((a, i) => put(a, 0.5 + (i % 2) * 0.26, darkPine(u * (0.8 + (i % 3) * 0.16)))); break;
    case 'rocky': [0.1, 1.7, 3.2, 4.8].forEach((a, i) => put(a, 0.62, rockLump(u * (1 + (i % 2) * 0.6), i % 2 ? '#8a8e97' : '#b4b8c0'))); put(2.4, 0.4, tree(u * 0.8)); break;
    case 'ice': [0.3, 1.9, 3.5, 5.0].forEach((a, i) => put(a, 0.62, crystal(u, 0.5 + (i % 3) * 0.3))); put(2.6, 0.4, drift(u)); break;
    case 'village': put(0.5, 0.66, house(u, '#e05a47', night)); put(2.6, 0.66, house(u, '#3f7be0', night)); put(4.6, 0.64, house(u, '#f2b705', night)); put(3.6, 0.72, tree(u)); put(1.5, 0.74, tree(u * 0.8)); break;
    case 'rainy': put(0.8, 0.66, darkPine(u)); put(3.5, 0.7, darkPine(u * 0.8)); put(2.3, 0.72, rockLump(u, '#7b7f8c')); put(5.2, 0.6, rockLump(u * 1.2, '#8a8e97')); break;
    default: put(0.6, 0.72, tree(u * 0.8)); put(2.4, 0.72, tree(u * 0.95));
  }
  put(4.2 + (ground === 'castle' ? 0.5 : 0), 0.76, lantern(u, night));
  return items;
}

/**
 * One project island, origin at the centre of its top face.
 * o = { ground, building, color, size, seed, night, ghost }
 */
export function island(o) {
  const rad = 62 * (o.size || 1), u = rad / 1.55, r = rng(o.seed || 'x');
  if (o.building === 'balloon') return BUILD.balloon(o.color, u * 0.8);
  const items = decorate(o.ground, rad, u, r, o.color, o.night);
  const b = BUILD[o.building] || BUILD.tower;
  items.push([2, at(0, 2, b(o.color, u * (o.building === 'shield' ? 1.1 : 0.92)))]);
  items.sort((a, b2) => a[0] - b2[0]);
  return base(rad, o.ground, 0.3 + r() * 0.5) + items.map((i) => i[1]).join('');
}
/** uncharted slot: the same island, but only a dotted outline with a flag */
export function ghostIsland(size = 0.85) {
  const rad = 62 * size, u = rad / 1.55;
  return liteBase(rad, 'meadow', true) + R(-0.02 * u, -0.9 * u, 0.04 * u, 0.9 * u, '#ffffff', ' opacity=".8"') + P([[0.02 * u, -0.9 * u], [0.4 * u, -0.78 * u], [0.02 * u, -0.66 * u]], '#ffffff', ' opacity=".8"');
}

/* ---------- zone icons (legend, world labels, minimap) ---------- */
export function icon(name, c) {
  const u = 22;
  const draw = {
    balloon: () => at(0, 20, BUILD.balloon('#ff5d6c', 10)), palm: () => at(-3, 17, palm(u * 1.25)), windmill: () => at(0, 18, windmillBody(u * 0.9) + at(0, -28, windmillBlades(u * 0.8))),
    crate: () => at(1, 14, BUILD.crate(c, u * 0.95)), shield: () => at(0, 22, BUILD.shield(c, u * 0.9).replace(/<ellipse[^>]*>/, '')), lighthouse: () => at(0, 18, lighthouse(u * 0.92, '#e05a47', true)),
    gear: () => at(0, 0, gearWheel(u * 1.15, c)), cactus: () => at(0, 16, cactus(u * 1.9)), crystal: () => at(-7, 16, crystal(u * 1.4, 0.9)) + at(7, 16, crystal(u * 1.4, 0.6)),
    volcano: () => at(0, 15, volcano(u * 1.2)), peak: () => at(0, 15, peak(u * 0.9)), rock: () => at(0, 8, rockLump(u * 3.2, '#9aa0ad')),
  };
  return (draw[name] || draw.rock)();
}

/* ---------- zone scenery ---------- */
const sun = (r, c = '#f6c453', h = '#f0a64a') => C(0, 0, r * 2.4, glow(h), ' opacity=".12"') + C(0, 0, r * 1.6, glow(h), ' opacity=".18"') + C(0, 0, r, glow(c));
function stars(rad, seed, k = 60) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < k; i++) { const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.95; s += C(Math.cos(a) * d, Math.sin(a) * d * 0.9 - rad * 0.05, 0.8 + r() * 1.3, glow('#dfe6ff'), ` opacity="${n(0.35 + r() * 0.6)}"`); }
  return s;
}
function rainbow(r) {
  return ['#e88a8a', '#e9b77a', '#e6d98a', '#9fd39a', '#8fb8e0', '#ab9ad8'].map((c, i) => `<path d="M${-(r - i * 7)} 0A${r - i * 7} ${r - i * 7} 0 0 1 ${r - i * 7} 0" fill="none" stroke="${glow(c)}" stroke-width="7" opacity=".3"/>`).join('');
}
const plane = (u) => P([[0.7 * u, 0], [-0.4 * u, -0.3 * u], [-0.2 * u, 0]], '#ffffff') + P([[0.7 * u, 0], [-0.4 * u, 0.26 * u], [-0.2 * u, 0]], shade('#ffffff', 0.86));
function flock(u, c = '#2b3350', k = 5) {
  let s = '';
  for (let i = 0; i < k; i++) { const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2); s += at(-Math.abs(side) * 0.55 * u, side * 0.34 * u, bird(u, c)); }
  return s;
}
function islet(rad, ground, items, a0 = 0.6) { return base(rad, ground, a0, { depth: 1.0 }) + items.sort((a, b) => a[0] - b[0]).map((i) => i[1]).join(''); }
const spr = (x, y, w, h, svg, cls = '', extra = {}) => ({ x: n(x), y: n(y), w, h, cls, svg, ...extra });
const wave = (w, c) => P([[-w / 2, 0], [-w / 4, -w * 0.06], [0, 0], [w / 4, -w * 0.06], [w / 2, 0], [0, w * 0.05]], c);
function auroraBand(w, h, c, seed) {
  const r = rng('au' + seed); let top = [], bot = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14, x = -w / 2 + t * w, y = Math.sin(i * 0.55 + seed) * h * 0.3, th = Math.sin(t * Math.PI) * h * (0.28 + 0.2 * r()); top.push([x, y - th]); bot.push([x, y + th * 0.25]); }
  const mid = top.map((p, i) => [p[0], p[1] + (bot[i][1] - p[1]) * 0.55]);
  return P([...top, ...[...bot].reverse()], glow(c), ' opacity=".2"') + P([...mid, ...[...bot].reverse()], glow(c), ' opacity=".22"');
}

/**
 * Scenery of one zone, relative to its centre: back (static SVG behind the islands) and sprites
 * (small independently animated pieces). cloudC is the cloud colour for this zone's air.
 */
export function zoneScene(zone, rad) {
  const id = zone.id, r = rng('zone' + id), back = [], sprites = [], cloudC = zone.cloud || '#f4f7fb', U = 40;
  const night = zone.mode === 'night';
  const clouds = (k, ys = [-0.75, 0.75]) => { for (let i = 0; i < k; i++) { const a = r() * TAU, d = (0.62 + r() * 0.3) * rad; back.push(at(Math.cos(a) * d, ys[0] * rad + r() * (ys[1] - ys[0]) * rad, cloud(70 + r() * 70, cloudC, i + zone.n * 9))); } };
  const drifting = (k, w = 110) => { for (let i = 0; i < k; i++) sprites.push(spr(-rad * 0.9, (-0.62 + i * 0.5 + r() * 0.2) * rad, w + 40, 80, at((w + 40) / 2, 46, cloud(w, cloudC, i + zone.n * 5)), 'drift', { dur: 70 + i * 28, delay: -(r() * 80) })); };
  const flying = (svg, y, dur, delay, w = 150, h = 70, cls = 'fly') => sprites.push(spr(-rad * 0.95, y, w, h, at(w / 2, h / 2, svg), cls, { dur, delay }));
  switch (id) {
    case 'capital':
      back.push(at(rad * 0.56, -rad * 0.62, sun(34)), at(-rad * 0.5, -rad * 0.2, rainbow(150))); clouds(7); drifting(2);
      flying(flock(16), -rad * 0.5, 46, -8); flying(plane(14), rad * 0.42, 38, -20, 60, 40); flying(plane(11), -rad * 0.05, 52, -33, 60, 40);
      break;
    case 'provisioning': {
      back.push(at(-rad * 0.52, -rad * 0.62, sun(44, '#ffd34d', '#ffb347'))); clouds(4);
      back.push(at(0, 30, islet(92, 'tropical', [[-20, at(-52, -8, palm(U * 1.5))], [-12, at(40, -14, palm(U * 1.25))], [6, at(-6, 6, pond(U * 1.4))], [12, at(54, 12, palm(U))], [14, at(-60, 16, rockLump(U, '#ecd59a'))], [-22, at(4, -22, house(U * 1.1, '#e05a47'))]])));
      back.push(at(26, 50, R(-7, 0, 14, 96, '#6fd0ff', ' opacity=".7" class="shimmer"')));
      flying(at(0, 0, parrot(26)) + at(-34, 16, parrot(22, '#12b981')), -rad * 0.32, 34, -5); flying(parrot(24, '#f2b705'), rad * 0.5, 44, -25); drifting(2);
      break;
    }
    case 'cicd': {
      clouds(3);
      back.push(at(0, 26, islet(100, 'village', [[-18, at(-44, -10, windmillBody(U * 1.25))], [-8, at(46, -2, windmillBody(U))], [10, at(-6, 12, house(U, '#3f7be0'))], [14, at(64, 16, tree(U * 0.8))], [16, at(-70, 14, tree(U))]])));
      sprites.push(spr(-44 - 52, 26 - 10 - 62 - 52, 104, 104, at(52, 52, windmillBlades(U * 1.2)), 'spin', { dur: 5 }), spr(46 - 42, 26 - 2 - 50 - 42, 84, 84, at(42, 42, windmillBlades(U * 0.96)), 'spin', { dur: 4 }));
      [['#ff5d6c', -0.5, -0.56, 30], ['#f2b705', 0.42, -0.66, 26], ['#12b981', 0.62, -0.2, 22]].forEach(([c, x, y, s], i) => sprites.push(spr(x * rad - 30, y * rad - 30, 60, 110, at(30, 30, kite(s, c)), 'sway', { dur: 5 + i, delay: -i * 1.7 })));
      for (let i = 0; i < 4; i++) sprites.push(spr(-rad * 0.95, (-0.7 + i * 0.42) * rad, 260, 50, at(130, 30, G(cloud(120, cloudC, i + 3), 'scale(1.8 .55)')), 'drift', { dur: 16 + i * 5, delay: -(i * 7) }));
      flying(flock(15), -rad * 0.34, 20, -3); flying(flock(13, '#2b3350', 3), rad * 0.3, 26, -14);
      break;
    }
    case 'containers': {
      clouds(8, [-0.8, -0.35]);
      const sea = []; for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.8; sea.push(at(Math.cos(a) * d, rad * 0.16 + Math.abs(Math.sin(a)) * d * 0.62, wave(60 + r() * 60, i % 3 ? '#3a4a66' : '#4d6185'))); }
      back.push(E(0, rad * 0.42, rad * 0.86, rad * 0.44, '#2c3a55', ' opacity=".85"'), ...sea);
      back.push(at(0, 30, islet(104, 'city', [[-16, at(-40, -10, container(U * 1.3, '#ff8a1f'))], [-15, at(34, -12, container(U * 1.3, '#2f9bff'))], [-14, at(-38, -26, container(U * 1.3, '#12b981'))], [-13, at(36, -28, container(U * 1.3, '#f2b705'))], [-12, at(-10, -42, container(U * 1.3, '#7c5cff'))], [8, at(-52, 16, container(U * 1.1, '#e05a47'))], [10, at(30, 18, container(U * 1.1, '#1e6ad6'))], [11, at(28, 5, container(U * 1.1, '#ff5d6c'))],
        [-20, at(78, -8, R(-3, -120, 6, 120, INK) + R(-60, -120, 70, 5, INK) + R(-58, -116, 2, 40, INK) + box(-57, -66, 16, 10, 10, '#ffd34d'))]])));
      sprites.push(spr(-rad * 0.5, -rad * 0.7, 80, 200, `<path d="M44 0L18 86H40L10 196L66 74H42L62 0Z" fill="#DFE6FF"/>`, 'bolt', { dur: 7 }), spr(rad * 0.3, -rad * 0.62, 60, 150, `<path d="M34 0L12 64H30L8 148L50 56H32L48 0Z" fill="#DFE6FF"/>`, 'bolt', { dur: 11, delay: -4 }));
      flying(flock(15, '#eef2f7', 3), -rad * 0.1, 24, -6); flying(flock(13, '#eef2f7', 2), rad * 0.12, 30, -19);
      break;
    }
    case 'security': {
      back.push(stars(rad, 'sec', 40), at(rad * 0.5, -rad * 0.66, sun(22, '#eef2ff', '#8fa8ff')));
      const pines = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3; pines.push([Math.sin(a) * 40, at(Math.cos(a) * 96, Math.sin(a) * 40, darkPine(U * (0.9 + (i % 3) * 0.2)))]); }
      back.push(at(0, 30, islet(112, 'castle', [...pines, [-14, at(-44, -14, castleTower(U * 1.5, '#12b981', true))], [-13, at(44, -14, castleTower(U * 1.5, '#12b981', true))], [-6, at(0, -8, wall(U, 78))], [-5, at(0, -2, box(0, 0, 44, 50, 30, '#c3c8d2') + R(-13, -30, 14, 30, '#2b3350') + R(-22, -44, 8, 10, glow('#ffcf73')) + R(2, -44, 8, 10, glow('#ffcf73')))],
        [-4, at(-44, -86, owl(U * 0.8))], [10, at(-70, 18, lantern(U, true))], [11, at(70, 20, lantern(U, true))]])));
      for (let i = 0; i < 5; i++) sprites.push(spr(-rad * 0.95, (-0.35 + i * 0.26) * rad, 520, 90, `<ellipse cx="260" cy="45" rx="255" ry="${30 + (i % 2) * 12}" fill="#9fb0c8" opacity="${0.1 + (i % 3) * 0.04}"/>`, 'fog', { dur: 60 + i * 18, delay: -(i * 23) }));
      sprites.push(spr(rad * 0.3, -rad * 0.3, 60, 40, at(30, 26, owl(24)), 'bobs', { dur: 6 }));
      break;
    }
    case 'observability': {
      back.push(stars(rad, 'obs', 26)); clouds(6, [-0.82, -0.4]);
      back.push(at(-10, 36, islet(108, 'rainy', [[-16, at(-10, -12, peak(U * 1.1, '#7b7f8c', false))], [-10, at(48, -6, lighthouse(U * 0.9, '#3f7be0', true))], [2, at(-40, 6, lighthouse(U * 1.35, '#e05a47', true))], [12, at(20, 18, darkPine(U))], [14, at(-76, 16, rockLump(U * 1.4, '#8a8e97'))], [15, at(70, 20, darkPine(U * 0.8))]])));
      sprites.push(spr(-50 - 280, 36 + 6 - 90 - 60, 280, 120, `<path d="M280 60L0 10V110Z" fill="#FFD76A" opacity=".2"/>`, 'beam bl', { dur: 9 }), spr(-50, 36 + 6 - 90 - 60, 280, 120, `<path d="M0 60L280 10V110Z" fill="#FFD76A" opacity=".2"/>`, 'beam br', { dur: 9, delay: -4.5 }));
      for (let i = 0; i < 4; i++) sprites.push(spr(-rad * 0.95, (0.0 + i * 0.2) * rad, 520, 90, `<ellipse cx="260" cy="45" rx="255" ry="${28 + (i % 2) * 10}" fill="#c9d6ea" opacity="${0.1 + (i % 2) * 0.05}"/>`, 'fog', { dur: 54 + i * 16, delay: -(i * 19) }));
      sprites.push(spr(rad * 0.25, -rad * 0.72, 60, 150, `<path d="M34 0L12 64H30L8 148L50 56H32L48 0Z" fill="#DFE6FF"/>`, 'bolt', { dur: 13, delay: -2 }));
      break;
    }
    case 'automation': {
      clouds(4);
      const pines = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 1.1; pines.push([Math.sin(a) * 38, at(Math.cos(a) * 92, Math.sin(a) * 38, darkPine(U * (0.9 + (i % 3) * 0.18)))]); }
      back.push(at(0, 28, islet(108, 'forest', [...pines.filter((p) => p[0] < 20), [-4, at(-16, -4, house(U * 1.9, '#8b5a2b') + R(18, -74, 9, 26, '#9aa0ad'))], [8, at(46, 12, deer(U * 0.95))], [12, at(-58, 20, G(deer(U * 0.75), 'scale(-1 1)'))], [14, at(8, 24, box(0, 0, 30, 10, 14, '#a8743f') + box(2, -10, 20, 8, 12, '#ffd34d'))]])));
      sprites.push(spr(26 - 30, 28 - 4 - 34 - 30, 60, 60, at(30, 30, gearWheel(20, '#3fbf6f')), 'spin', { dur: 14 }), spr(52 - 18, 28 - 4 - 62 - 18, 36, 36, at(18, 18, gearWheel(12, '#f2b705')), 'spin rev', { dur: 9 }));
      for (let i = 0; i < 3; i++) sprites.push(spr(24, 28 - 96 - i * 6, 26, 26, at(13, 13, puff(0, 0, 8, '#f4f7fb', i)), 'smoke', { dur: 7, delay: -i * 2.3 }));
      flying(flock(13, '#2b3350', 3), -rad * 0.55, 60, -12); drifting(2);
      break;
    }
    case 'finops': {
      back.push(at(rad * 0.3, -rad * 0.58, sun(58, '#ffe08a', '#ff9a3c')));
      back.push(at(0, 30, islet(110, 'desert', [[-18, at(-10, -14, P([[-70, 0], [0, -78], [8, 10]], '#efc37c') + P([[0, -78], [66, 0], [8, 10]], '#c9954f'))], [6, at(-62, 8, cactus(U * 1.3))], [8, at(66, 12, cactus(U))], [12, at(10, 20, gold(U * 1.1))], [10, at(-22, 16, dune(U * 1.4))], [14, at(52, 26, rockLump(U, '#c46a3a'))]])));
      for (let i = 0; i < 3; i++) sprites.push(spr(-rad * 0.7, (0.24 + i * 0.16) * rad, rad * 1.4, 30, `<path d="M0 15q${n(rad * 0.0875)} -12 ${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0t${n(rad * 0.175)} 0" fill="none" stroke="#FFF0DC" stroke-width="5" opacity=".28"/>`, 'heat', { dur: 5 + i * 1.5, delay: -i }));
      sprites.push(spr(-90, -rad * 0.62, 180, 90, at(90, 45, at(-40, 6, bird(34, '#3a2a22')) + at(36, -10, bird(28, '#3a2a22'))), 'circle', { dur: 24 }));
      break;
    }
    case 'networking': {
      back.push(stars(rad, 'net', 60));
      back.push(at(0, 30, islet(104, 'ice', [[-16, at(-30, -12, P([[-50, 0], [-10, -90], [6, 8]], glow('#d6f1ff')) + P([[-10, -90], [40, 0], [6, 8]], glow('#8fd0ff')))], [-10, at(44, -8, crystal(U * 1.4, 1.2))], [6, at(-58, 12, penguin(U * 0.8))], [8, at(-36, 18, penguin(U * 0.66))], [10, at(30, 16, penguin(U * 0.74))], [-2, at(4, 2, arch(U * 1.1, '#bfe2ff', 0.7))], [12, at(70, 18, drift(U))], [13, at(-8, 26, drift(U * 1.2))]])));
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * TAU) / 5 + TAU / 10, x = Math.cos(a) * 214, y = Math.sin(a) * 214; back.push(at(x, y, G(`<path d="M-70 0Q0 -30 70 0" fill="none" stroke="#9cc7ea" stroke-width="9"/><path d="M-70 -3Q0 -33 70 -3" fill="none" stroke="#e6f4ff" stroke-width="5"/>` + R(-72, -6, 6, 16, '#bfe2ff') + R(66, -6, 6, 16, '#bfe2ff'), `rotate(${n((a * 180) / Math.PI + 90)})`))); }
      [['#7CF5C0', -0.66, 0], ['#9A8CFF', -0.5, 2], ['#7CF5C0', -0.8, 4]].forEach(([c, y, s], i) => sprites.push(spr(-rad * 0.8, y * rad, rad * 1.6, 150, at(rad * 0.8, 110, auroraBand(rad * 1.5, 120, c, s)), 'aurora', { dur: 11 + i * 4, delay: -i * 3 })));
      break;
    }
    case 'reliability': {
      back.push(stars(rad, 'rel', 20)); clouds(5, [-0.8, -0.45]);
      back.push(at(0, 34, islet(122, 'volcanic', [[-18, at(-34, -8, volcano(U * 2.1))], [-12, at(62, -16, volcano(U * 1.1))], [8, at(34, 14, E(0, 0, 54, 20, '#38b6ff') + E(-10, -4, 28, 8, '#7fd0ff'))], [12, at(-70, 20, rockLump(U * 1.3, '#5a3a2e'))], [14, at(-18, 28, R(-22, 0, 44, 4, glow('#ff6a00')))], [10, at(86, 14, darkPine(U * 0.7))]])));
      for (let i = 0; i < 4; i++) sprites.push(spr(-34 - 16, 34 - 8 - 96 - 20, 34, 34, at(17, 17, puff(0, 0, 11, '#6b6d77', i)), 'smoke', { dur: 8, delay: -i * 2 }));
      sprites.push(spr(-34 - 50, 34 - 8 - 150, 100, 80, C(50, 60, 40, '#FF6A00', ' opacity=".16"') + C(50, 60, 24, '#FF8A3D', ' opacity=".2"'), 'pulse', { dur: 4 }));
      break;
    }
    case 'advanced': {
      back.push(at(-rad * 0.46, -rad * 0.66, sun(26, '#fff3c4', '#ffe9cf')));
      back.push(at(0, 40, islet(96, 'snow', [[-14, at(-6, -6, peak(U * 2.2))], [-10, at(58, 0, peak(U * 1.1))], [-9, at(-64, 2, peak(U * 0.9, '#8a9bb6'))], [8, at(-12, -126, flag(U * 0.7, '#1e6ad6'))], [12, at(40, 22, drift(U))]])));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; back.push(at(Math.cos(a) * rad * 0.74, Math.sin(a) * rad * 0.34 + rad * 0.5, cloud(120 + (i % 3) * 30, '#ffffff', i + 40))); }
      for (let i = 0; i < 3; i++) sprites.push(spr(-rad * 0.95, (0.3 + i * 0.16) * rad, 200, 80, at(100, 46, cloud(150, '#ffffff', i + 60)), 'drift', { dur: 90 + i * 30, delay: -(i * 40) }));
      flying(bird(22, '#2b3350'), -rad * 0.42, 50, -9, 60, 40);
      break;
    }
    default:
      clouds(5); drifting(1);
  }
  const light = zone.light || null;
  return { back: relight(back.join(''), light), sprites: sprites.map((s) => ({ ...s, svg: relight(s.svg, s.cls.startsWith('drift') || s.cls === 'fly' || s.cls === 'smoke' ? light : null) })) };
}
