// Advanced: a high summit above the clouds. A snow-capped peak with a flag, a sea of cloud far below, one eagle in thin clear air.
import * as THREE from '../vendor/three.module.min.js';
import { makeBird, makeFlock, flyFlock, makeRibbon, waveRibbon, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'snow'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const rock = flat('#8a9bb6'), mid = flat('#a9b7cf'), snow = flat('#ffffff');
    const a = new THREE.Mesh(new THREE.ConeGeometry(3.1, 5.2, 7), rock); a.position.set(-0.4, 2.6, -0.4);
    const b = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.2, 6), mid); b.position.set(-0.4, 5.1, -0.4);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.6, 6), snow); c.position.set(-0.4, 7.2, -0.4);
    const d = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 6), rock); d.position.set(2.7, 1.6, 1.0);
    const e = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.7, 6), snow); e.position.set(2.7, 3.4, 1.0);
    top.add(a, b, c, d, e);
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // a flag on the top
  const topY = H / 2 - 0.6 + 8.5;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.6, 0.07), flat('#2b3350'));
  pole.position.set(-0.4, topY + 0.6, -0.4);
  const flag = makeRibbon(1.3, 0.7, col('#e05a47'), { additive: false, segs: 10 });
  flag.position.set(0.25, topY + 1.1, -0.4);
  root.add(pole, flag);

  // a sea of cloud far below: soft white lumps drifting slowly around the peak
  const lumps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), flat('#ffffff'), 14);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < 14; i++) { const a = i * 2.4, d = 6 + (i % 5) * 3.2; lumps.setMatrixAt(i, m.compose(p.set(Math.cos(a) * d, -6.5 + (i % 3) * 0.5, Math.sin(a) * d), q, sc.set(3 + (i % 4), 0.9, 2.6 + (i % 3)))); }
  const cloudSea = new THREE.Group();
  cloudSea.add(lumps);
  z.group.add(cloudSea); // in the zone group, not the far-view-enlarged one, so it stays inside the zone

  // one eagle, big and slow
  const ink = flat('#4a3b30'), cream = flat('#e8d3b0');
  const eagle = makeFlock(() => makeBird(ink, ink, cream), 1, 13, 16, 0.07, 0, 3);
  z.group.add(eagle);

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      cloudSea.rotation.y = t * 0.012;
      cloudSea.scale.setScalar(Math.max(0.001, appear));
      flag.visible = k > 0.01;
      if (flag.visible) { flag.material.opacity = k; waveRibbon(flag, t, 0.16, 5, 4); }
      flyFlock(eagle, t, dt, k, 3.5);
    },
  };
}
