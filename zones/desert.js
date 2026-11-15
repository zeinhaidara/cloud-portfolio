// FinOps: scorching desert. A dune islet with a pyramid, cacti and a pile of gold; vultures circle; heat shimmers.
import * as THREE from '../vendor/three.module.min.js';
import { makeBird, makeFlock, flyFlock, makeRibbon, waveRibbon, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, cactus, rockLump, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'desert'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.3, 4), flat('#efc37c'));
    pyr.position.set(-0.7, 1.15, -0.8); pyr.rotation.y = 0.5;
    const pyr2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 4), flat('#dba45e'));
    pyr2.position.set(1.6, 0.6, -1.7); pyr2.rotation.y = 0.9;
    top.add(pyr, pyr2);
    [[0.6, 0.78, 2.1], [2.4, 0.74, 1.6], [3.9, 0.76, 1.9], [5.2, 0.6, 1.3]].forEach(([a, d, k]) => { const c = cactus(k); c.position.set(Math.cos(a) * R * d, 0, Math.sin(a) * R * d); top.add(c); });
    [[1.4, 0.5], [4.6, 0.55]].forEach(([a, d]) => { const dune = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 6), flat('#e3b067')); dune.scale.set(1.3, 0.28, 0.9); dune.position.set(Math.cos(a) * R * d, 0, Math.sin(a) * R * d); top.add(dune); });
    const r1 = rockLump(2, '#c46a3a'); r1.position.set(2.7, 0.1, 0.4); top.add(r1);
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // gold: a small pile that keeps its own glow
  const goldMat = flat('#ffd34d', { emissive: col('#e0a100'), emissiveIntensity: 0.55, roughness: 0.35 });
  const gold = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3, 0), goldMat, 9);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.25 + (i % 4) * 0.22; m.compose(new THREE.Vector3(1.0 + Math.cos(a) * d, H / 2 - 0.45 + (i < 3 ? 0.42 : 0.14), 1.5 + Math.sin(a) * d), q.setFromEuler(e.set(i, i * 2, 0)), new THREE.Vector3(1, 0.8, 1).multiplyScalar(0.8 + (i % 3) * 0.25)); gold.setMatrixAt(i, m); }
  root.add(gold);

  // vultures: the original box birds, dark and slow, high above
  const dark = flat('#3a2a22'), darker = flat('#2b1f1a');
  const flocks = [makeFlock(() => makeBird(dark, darker), 3, 8, 12, 0.1, 0, 2.6), makeFlock(() => makeBird(dark, darker), 2, 17, 15, -0.07, 2.5, 2.4)];
  flocks.forEach((f) => z.group.add(f));

  // heat shimmer: pale wavering bands just above the ground, all around the islet and the island ring
  const bands = [];
  for (let i = 0; i < 7; i++) { const b = makeRibbon(z.r * 0.9, 1.6 + (i % 3) * 0.7, col('#fff0dc'), { additive: false, segs: 20 }); const a = (i / 7) * Math.PI * 2; b.position.set(Math.cos(a) * (6 + (i % 3) * 7), 1.2 + (i % 4) * 1.1, Math.sin(a) * (6 + (i % 3) * 7)); b.rotation.y = a + 1.2; z.group.add(b); bands.push(b); }

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      for (const f of flocks) flyFlock(f, t, dt, k, 3.2);
      for (const b of bands) { b.visible = k > 0.01; if (b.visible) { b.material.opacity = 0.2 * k; waveRibbon(b, t, 0.5, 0.5, 2.6); } }
    },
  };
}
