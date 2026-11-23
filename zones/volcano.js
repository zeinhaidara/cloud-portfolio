// Reliability: a volcano and campfires beside a calm lake. A glowing crater, slow ash puffs, flickering flames.
import * as THREE from '../vendor/three.module.min.js';
import { sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, rockLump, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'volcanic'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.7, 4.4, 8), flat('#3a2e2e')); cone.position.set(-0.9, 2.2, -0.9);
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 7), flat('#4b3c3c')); shoulder.position.set(-3.0, 1.1, 0.3);
    const lake = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.08, 18), flat('#4fb3d9')); lake.position.set(2.1, 0.03, 1.3);
    const shore = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.05, 18), flat('#2e2626')); shore.position.set(2.1, 0.01, 1.3);
    top.add(cone, shoulder, shore, lake);
    [[3.6, -1.6, 2], [0.5, 2.9, 1.6], [-2.8, -2.4, 1.8]].forEach(([x, zz, k]) => { const r = rockLump(k, '#5a3a2e'); r.position.set(x, 0.1, zz); top.add(r); });
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // the crater glows; two lava streaks run down the cone
  const lavaMat = flat('#ff6a1f', { emissive: col('#ff4d00'), emissiveIntensity: 1, roughness: 0.4 });
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.2, 8), lavaMat);
  crater.position.set(-0.9, H / 2 - 0.6 + 4.35, -0.9);
  root.add(crater);
  for (const [a, len] of [[0.6, 2.2], [2.5, 1.6]]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, len, 0.06), lavaMat);
    st.position.set(-0.9 + Math.cos(a) * 1.15, H / 2 - 0.6 + 3.5 - len * 0.2, -0.9 + Math.sin(a) * 1.15);
    st.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5);
    root.add(st);
  }

  // campfires on the lake shore flicker
  const flameMat = flat('#ffb040', { emissive: col('#ff7a1f'), emissiveIntensity: 0.9, roughness: 0.4 });
  const flames = [[1.0, 1.9], [2.6, 3.0], [3.4, 0.5]].map(([x, zz], i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 5), flameMat); f.position.set(x, H / 2 - 0.6 + 0.35, zz); f.userData.ph = i * 1.7; root.add(f); return f; });

  // ash puffs rise from the crater, swell and thin out
  const ashMat = new THREE.MeshBasicMaterial({ color: col('#6b6570'), transparent: true, opacity: 0.45, depthWrite: false, forceSinglePass: true });
  const ashG = new THREE.SphereGeometry(1, 8, 6);
  const puffs = [0, 1, 2].map((i) => { const m = new THREE.Mesh(ashG, ashMat); m.userData.o = i / 3; root.add(m); return m; }); // the zone's smoke column carries the rest

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      lavaMat.emissiveIntensity = 0.8 + Math.sin(t * 1.6) * 0.2;
      flames.forEach((f) => { f.visible = k > 0.02; if (f.visible) { const q = 0.85 + Math.sin(t * 9 + f.userData.ph) * 0.15; f.scale.set(q, 0.8 + Math.sin(t * 7 + f.userData.ph) * 0.25, q); } });
      for (const m of puffs) { m.visible = k > 0.02; if (m.visible) { const p = (t * 0.05 + m.userData.o) % 1; m.position.set(-0.9 + p * 2.2, H / 2 - 0.6 + 4.6 + p * 7, -0.9 + p * 0.8); m.scale.setScalar((0.5 + p * 1.8) * Math.sin(Math.PI * Math.min(1, p * 1.1))); } }
    },
  };
}
