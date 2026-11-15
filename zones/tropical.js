// Provisioning: sunny tropics. A lagoon islet with tall palms, a hut and a waterfall; parrots circle the zone.
import * as THREE from '../vendor/three.module.min.js';
import { makeBird, makeFlock, flyFlock, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, palm, house, rockLump } = api;
  const root = new THREE.Group();
  z.group.add(root);
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'tropical'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    [[0.9, 0.7, 2.0], [2.6, 0.72, 1.6], [4.4, 0.66, 2.3], [5.5, 0.4, 1.4]].forEach(([a, d, k]) => { const p = palm(k); p.position.set(Math.cos(a) * R * d, 0, Math.sin(a) * R * d); p.rotation.y = a * 2; top.add(p); });
    const hut = house(2.2, '#e05a47');
    hut.position.set(-0.4, 0, -0.9);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 18), flat('#38b6ff'));
    pond.position.set(0.9, 0.02, 1.2);
    const r1 = rockLump(2.2, '#ecd59a'), r2 = rockLump(1.6, '#ecd59a');
    r1.position.set(-2.4, 0.1, 1.4); r2.position.set(2.6, 0.1, -1.6);
    top.add(hut, pond, r1, r2);
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);
  const fallMat = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.7, depthWrite: false });
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 0.12), fallMat);
  fall.position.set(Math.cos(0.95) * R * 0.98, -3.6, Math.sin(0.95) * R * 0.98);
  fall.rotation.y = -0.95 + Math.PI / 2;
  root.add(fall);

  // parrots: the original box birds in the project colours
  const M = { red: flat('#e05a47'), green: flat('#12b981'), blue: flat('#2f9bff'), yellow: flat('#f2b705') };
  const kinds = [[M.red, M.green, M.yellow], [M.green, M.yellow, M.blue], [M.yellow, M.blue, M.red]];
  const flocks = [makeFlock((i) => makeBird(...kinds[i % 3]), 3, 10, 6.5, 0.22, 0.4, 1.5), makeFlock((i) => makeBird(...kinds[(i + 1) % 3]), 3, 19, 8.5, -0.15, 3.1, 1.5), makeFlock((i) => makeBird(...kinds[(i + 2) % 3]), 2, 26, 5, 0.12, 5, 1.4)];
  flocks.forEach((f) => z.group.add(f));

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      fallMat.opacity = 0.55 + Math.sin(t * 6) * 0.12;
      const k = sstep(0.03, 0.4, w) * appear;
      for (const f of flocks) flyFlock(f, t, dt, k, 11);
    },
  };
}
