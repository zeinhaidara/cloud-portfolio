// CI/CD & GitOps: windy plains. A hill of windmills with turning blades, kites, gulls and long streaking clouds.
import * as THREE from '../vendor/three.module.min.js';
import { makeBird, makeFlock, flyFlock, makeRibbon, waveRibbon, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, tree, house, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const mills = [[-1.7, -0.9, 1.15, '#e05a47'], [1.6, -1.3, 0.9, '#3f7be0'], [0.4, 1.6, 0.8, '#f2b705']];
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'village'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    for (const [x, zz, k, c] of mills) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * k, 0.7 * k, 3.4 * k, 7), flat('#fff5e6'));
      tower.position.set(x, 1.7 * k, zz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62 * k, 0.9 * k, 7), flat(c));
      cap.position.set(x, 3.85 * k, zz);
      top.add(tower, cap);
    }
    [[2.7, 1.2, 1.5], [-2.8, 1.1, 1.3], [-0.9, 2.5, 1.2]].forEach(([x, zz, k]) => { const t = tree(k); t.position.set(x, 0, zz); top.add(t); });
    const hut = house(1.6, '#e05a47');
    hut.position.set(2.3, 0, -0.6);
    top.add(hut);
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // blades turn on their own hubs, all facing the same wind
  const bladeMat = flat('#8b5a2b'), bladeG = new THREE.BoxGeometry(0.42, 3.8, 0.08);
  const rotors = mills.map(([x, zz, k]) => {
    const hub = new THREE.Group();
    for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(bladeG, bladeMat); b.rotation.z = r; hub.add(b); }
    hub.scale.setScalar(k * 0.9);
    hub.position.set(x, H / 2 - 0.6 + 3.3 * k, zz + 0.6 * k);
    hub.userData = { x, zz, k };
    root.add(hub);
    return hub;
  });
  const eye = new THREE.Vector3();

  // kites tugging on invisible strings, each in a project colour
  const kiteG = new THREE.OctahedronGeometry(0.6, 0).scale(0.75, 1.15, 0.1), tailG = new THREE.BoxGeometry(0.06, 1.4, 0.04).translate(0, -1.3, 0);
  const kites = ['#e05a47', '#f2b705', '#2f9bff'].map((c, i) => {
    const k = new THREE.Mesh(kiteG, flat(c));
    k.add(new THREE.Mesh(tailG, flat('#ffffff')));
    k.userData = { a: i * 2.1, r: 9 + i * 4, y: 6 + i * 1.6, v: 0.1 + i * 0.03 };
    z.group.add(k);
    return k;
  });

  // gulls riding the wind and pale clouds streaking past
  const white = flat('#ffffff'), grey = flat('#c8d2e0');
  const flocks = [makeFlock(() => makeBird(white, grey), 3, 12, 9, 0.2, 0, 1.6), makeFlock(() => makeBird(white, grey), 2, 21, 12, -0.13, 2.2, 1.6)];
  flocks.forEach((f) => z.group.add(f));
  const L = z.r * 0.9, streaks = [];
  for (let i = 0; i < 5; i++) { const b = makeRibbon(L * (0.5 + (i % 3) * 0.15), 0.9 + (i % 2) * 0.5, col('#ffffff'), { additive: false, segs: 18 }); b.userData.s = 3 + i * 0.7; b.userData.o = i * 12; b.position.set(0, 5 + i * 1.7, (i - 2) * 6); z.group.add(b); streaks.push(b); }

  return {
    update(t, dt, w, appear, camera) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      if (camera) root.worldToLocal(eye.copy(camera.position));
      rotors.forEach((h, i) => {
        const u = h.userData;
        if (camera) { const a = Math.atan2(eye.x - u.x, eye.z - u.zz); h.rotation.y = a; h.position.x = u.x + Math.sin(a) * 0.6 * u.k; h.position.z = u.zz + Math.cos(a) * 0.6 * u.k; } // the sails turn to the viewer
        h.rotation.z += dt * (1.3 + i * 0.35) * (0.15 + k);
      });
      for (const kt of kites) { const u = kt.userData; u.a += dt * u.v; kt.visible = k > 0.02; if (kt.visible) { kt.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 1.3 + u.a) * 0.7, Math.sin(u.a) * u.r); kt.rotation.set(0.3, -u.a + Math.PI / 2, Math.sin(t * 2 + u.a) * 0.25); kt.scale.setScalar(1.5 * k); } }
      for (const f of flocks) flyFlock(f, t, dt, k, 8);
      for (const b of streaks) { b.visible = k > 0.01; if (b.visible) { b.material.opacity = 0.32 * k; b.position.x = ((t * b.userData.s + b.userData.o) % (L * 1.6)) - L * 0.8; waveRibbon(b, t, 0.18, 0.3, 1.4); } }
    },
  };
}
