// Shared pieces for zone decor modules: low-poly birds and wavy translucent ribbons (aurora, heat shimmer).
import * as THREE from '../vendor/three.module.min.js';

export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const birdBody = new THREE.BoxGeometry(0.12, 0.1, 0.42), birdWing = new THREE.BoxGeometry(0.62, 0.025, 0.22), birdTail = new THREE.BoxGeometry(0.1, 0.03, 0.3);
/** the original box bird: body and two hinged wings; optional tail in a third colour */
export function makeBird(bodyMat, wingMat, tailMat) {
  const b = new THREE.Group();
  b.add(new THREE.Mesh(birdBody, bodyMat));
  const wl = new THREE.Group(), wr = new THREE.Group();
  const ml = new THREE.Mesh(birdWing, wingMat), mr = new THREE.Mesh(birdWing, wingMat);
  ml.position.x = -0.31; mr.position.x = 0.31;
  wl.add(ml); wr.add(mr);
  b.add(wl, wr);
  if (tailMat) { const t = new THREE.Mesh(birdTail, tailMat); t.position.z = -0.32; b.add(t); }
  b.userData = { wl, wr, ph: Math.random() * 6 };
  return b;
}
/** birds circling a centre: [{ r, y, v, n }] -> groups with userData for flyFlocks() */
export function makeFlock(make, n, r, y, v, a0 = 0, scale = 1) {
  const flock = new THREE.Group(), birds = [];
  for (let i = 0; i < n; i++) {
    const b = make(i), side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
    b.position.set(side * 0.9, Math.abs(side) * 0.1, Math.abs(side) * 0.9);
    flock.add(b);
    birds.push(b);
  }
  flock.userData = { r, y, v, a: a0, birds, scale };
  return flock;
}
export function flyFlock(f, t, dt, k, flap = 9) {
  const u = f.userData;
  f.visible = k > 0.02;
  if (!f.visible) return;
  u.a += dt * u.v;
  f.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.4 + u.r) * 0.8, Math.sin(u.a) * u.r);
  f.rotation.y = -u.a + (u.v > 0 ? Math.PI : 0);
  f.scale.setScalar(Math.max(0.001, u.scale * k));
  for (const b of u.birds) { const w = Math.sin(t * flap + b.userData.ph) * 0.6; b.userData.wl.rotation.z = w; b.userData.wr.rotation.z = -w; }
}

/** a translucent band whose vertices are waved every frame */
export function makeRibbon(length, height, color, { additive = true, segs = 28 } = {}) {
  const geo = new THREE.PlaneGeometry(length, height, segs, 3);
  // soft edges: per-vertex alpha fades the band out at the top, the bottom and both ends
  const n = geo.attributes.position.count, rgba = new Float32Array(n * 4), rowA = [0, 0.55, 1, 0];
  for (let i = 0; i < n; i++) { const row = Math.floor(i / (segs + 1)), u = (i % (segs + 1)) / segs; rgba.set([1, 1, 1, rowA[row] * Math.min(1, Math.sin(u * Math.PI) * 2.2)], i * 4); }
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  const mat = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData = { base: geo.attributes.position.array.slice(), ph: Math.random() * 6 };
  return mesh;
}
export function waveRibbon(mesh, t, amp, freq, speed) {
  const a = mesh.geometry.attributes.position, b = mesh.userData.base, ph = mesh.userData.ph;
  for (let i = 0; i < a.count; i++) {
    const x = b[i * 3];
    a.array[i * 3 + 2] = Math.sin(x * freq + t * speed + ph) * amp + Math.sin(x * freq * 2.3 + t * speed * 0.6) * amp * 0.4;
    a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(x * freq * 1.7 + t * speed * 1.3 + ph) * amp * 0.25;
  }
  a.needsUpdate = true;
}

/** a jagged bolt of light: one thin strip whose zigzag is redrawn at every strike */
export function makeBolt(h, color = '#e8f1ff') {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 6 * 3), 3));
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false; m.visible = false;
  m.userData = { h, next: 1 + Math.random() * 5, age: 9 };
  return m;
}
/** strikes now and then while the zone is in view; never when the visitor prefers reduced motion */
export function flashBolt(m, dt, k, reduced) {
  const u = m.userData;
  if (reduced) { m.visible = false; return; }
  u.next -= dt; u.age += dt;
  if (u.next < 0 && k > 0.3) {
    u.next = 3 + Math.random() * 6; u.age = 0;
    const a = m.geometry.attributes.position.array, n = 8;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      const nx = x + (Math.random() - 0.5) * 1.6, ny = y - u.h / n, w = 0.16 * (1 - i / (n * 1.4)), o = i * 18;
      a.set([x - w, y, 0, x + w, y, 0, nx - w, ny, 0, x + w, y, 0, nx + w, ny, 0, nx - w, ny, 0], o);
      x = nx; y = ny;
    }
    m.geometry.attributes.position.needsUpdate = true;
  }
  const f = u.age < 0.16 ? (1 - u.age / 0.16) * (0.65 + 0.35 * Math.sin(u.age * 120)) : 0;
  m.visible = f > 0.01 && k > 0.02;
  m.material.opacity = f * k;
}

/** a flat gear: toothed outline with a hole, one mesh */
export function makeGear(r, teeth, depth, mat) {
  const sh = new THREE.Shape(), n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * ([1.18, 1.18, 1, 1][i % 4]);
    if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.32, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), mat);
  m.geometry.translate(0, 0, -depth / 2);
  return m;
}
