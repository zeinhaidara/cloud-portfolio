// Kubernetes & Containers: stormy sea. A harbour islet of stacked cargo containers and a crane; swell rings, gulls and lightning.
import * as THREE from '../vendor/three.module.min.js';
import { makeBird, makeFlock, flyFlock, makeBolt, flashBolt, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, rockLump, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const colours = ['#e05a47', '#2f9bff', '#f2b705', '#12b981', '#7c5cff', '#ff8a1f'];
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'city'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const box = new THREE.BoxGeometry(1.9, 0.78, 0.78);
    [[-1.6, -1.1, 3], [-1.6, -0.2, 2], [-0.2, -1.1, 2], [1.6, -0.9, 3], [1.6, 0.0, 1], [-0.4, 1.6, 2]].forEach(([x, zz, n], j) => {
      for (let i = 0; i < n; i++) { const c = new THREE.Mesh(box, flat(colours[(j * 2 + i) % colours.length])); c.position.set(x + (i % 2) * 0.05, 0.4 + i * 0.8, zz); c.rotation.y = (j % 2) * 0.08; top.add(c); }
    });
    // a gantry crane over the stacks
    const steel = flat('#5a6070');
    for (const x of [-2.9, 0.9]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), steel); leg.position.set(x, 2.1, 0.9); top.add(leg); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.26, 0.3), flat('#e0a100'));
    beam.position.set(-1, 4.2, 0.9);
    top.add(beam);
    const r1 = rockLump(2, '#6b6f7a'); r1.position.set(2.8, 0.1, 1.4); top.add(r1);
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // the sea below: a dark disc and three swell rings that widen and fade
  const sea = new THREE.Mesh(new THREE.CylinderGeometry(z.r * 0.62, z.r * 0.62, 0.2, 28), new THREE.MeshBasicMaterial({ color: col('#3f5a78'), transparent: true, opacity: 0.55, depthWrite: false }));
  sea.position.y = -5.5;
  const water = new THREE.Group(); // in the zone group, not the far-view-enlarged one, so the sea never spills into neighbours
  water.add(sea);
  z.group.add(water);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: col('#dfeaf5'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })); r.rotation.x = -Math.PI / 2; r.position.y = -5.3; r.userData.o = i / 3; water.add(r); return r; });

  const white = flat('#f4f8ff'), grey = flat('#9aa6b8');
  const flocks = [makeFlock(() => makeBird(white, grey), 3, 11, 7, 0.2, 0, 1.5), makeFlock(() => makeBird(white, grey), 2, 20, 10, -0.14, 2.6, 1.5)];
  flocks.forEach((f) => z.group.add(f));
  const bolts = [makeBolt(16), makeBolt(13)];
  bolts[0].position.set(-14, 17, -10); bolts[1].position.set(16, 15, 6);
  bolts.forEach((b) => z.group.add(b));

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      water.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      for (const f of flocks) flyFlock(f, t, dt, k, 10);
      for (const b of bolts) flashBolt(b, dt, k, api.reduced);
      for (const r of rings) { r.visible = k > 0.02; if (r.visible) { const p = (t * 0.12 + r.userData.o) % 1; r.scale.setScalar(4 + p * z.r * 0.55); r.material.opacity = 0.35 * (1 - p) * k; } }
      islet.rotation.z = Math.sin(t * 0.9) * 0.012; // the harbour rocks a little in the swell
    },
  };
}
