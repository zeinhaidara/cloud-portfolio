// Build-time geometry for the island map: a deterministic coastline and one Voronoi cell per region.

export const VIEW = { w: 1000, h: 680 };
const CENTER = [500, 335];

/** Island coastline as a closed polygon (deterministic, gently irregular). */
export function coastline(points = 96) {
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.055 * Math.sin(3 * t + 1.1) + 0.035 * Math.sin(5 * t + 2.3) + 0.02 * Math.sin(9 * t + 0.4);
    out.push([CENTER[0] + Math.cos(t) * 425 * wobble, CENTER[1] + Math.sin(t) * 262 * wobble]);
  }
  return out;
}

/** Keep the part of polygon `poly` on the side of the bisector that is closer to `a` than to `b`. */
function clipCloser(poly, a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; // <= 0 means closer to a
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Voronoi cells of `seeds`, clipped to `outline`. Returns one polygon per seed. */
export function cells(outline, seeds) {
  return seeds.map((s, i) => {
    let poly = outline;
    seeds.forEach((o, j) => { if (i !== j && poly.length) poly = clipCloser(poly, s, o); });
    return poly;
  });
}

export const r1 = (n) => Math.round(n * 10) / 10;
export const toPath = (poly) => (poly.length ? 'M' + poly.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + 'Z' : '');

/** Smooth closed path through polygon points (Catmull-Rom to cubic Bezier). */
export function smoothPath(poly) {
  const n = poly.length;
  let d = `M${r1(poly[0][0])} ${r1(poly[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n], p3 = poly[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + 'Z';
}

export function centroid(poly) {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; x += (p[0] + q[0]) * f; y += (p[1] + q[1]) * f;
  }
  return a ? [x / (3 * a), y / (3 * a)] : poly[0] || [0, 0];
}

/** Small irregular blob, used for the archive islet and ice floes. */
export function blob(cx, cy, rx, ry, seed = 1, points = 14) {
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const w = 1 + 0.12 * Math.sin(3 * t + seed) + 0.07 * Math.sin(5 * t + seed * 2);
    out.push([cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w]);
  }
  return out;
}
