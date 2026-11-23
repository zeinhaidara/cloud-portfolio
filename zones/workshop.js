// Automation: calm green forest. A workshop with three meshing gears turning slowly, deer grazing among the trees.
import * as THREE from '../vendor/three.module.min.js';
import { makeGear, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, tree, pine, house } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'forest'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const shop = house(2.9, '#c97b3a');
    shop.position.set(-1.4, 0, -0.8);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), flat('#6b6f7a')); chim.position.set(-0.4, 3.1, -1.2);
    top.add(shop, chim);
    [[2.7, 1.5, 1.9], [-2.9, 1.5, 1.7], [0.2, 2.9, 1.5], [3.0, -1.4, 1.6]].forEach(([x, zz, k], i) => { const t = i % 2 ? pine(k, false) : tree(k); t.position.set(x, 0, zz); top.add(t); });
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // gears: copper, brass and steel lying in the yard, meshing; neighbours turn opposite ways
  const gears = [[0.9, 8, '#c97b3a', 1.0, 0.5, 1.6, 0.28], [0.65, 6, '#e0a100', 2.75, 0.55, 1.0, -0.38], [0.5, 6, '#9aa0ad', 2.2, 0.6, 2.75, 0.5]].map(([r, n, c, x, y, zz, v]) => {
    const m = makeGear(r * 1.4, n, 0.3, flat(c));
    m.position.set(x, H / 2 - 0.6 + y, zz);
    m.rotation.x = -Math.PI / 2; // flat, so the teeth read from the usual view above
    m.userData.v = v;
    root.add(m);
    return m;
  });

  // two deer: a baked body with legs and a baked head with antlers that dips to graze
  const hide = flat('#b07a4a'), pale = flat('#e8d3b0'), horn = flat('#6b5a48');
  const body = baked(() => {
    const d = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.4), hide); b.position.y = 0.62;
    const rump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), pale); rump.position.set(-0.5, 0.7, 0);
    d.add(b, rump);
    for (const [x, zz] of [[0.34, 0.14], [0.34, -0.14], [-0.34, 0.14], [-0.34, -0.14]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.45, 0.09), hide); l.position.set(x, 0.22, zz); d.add(l); }
    return d;
  });
  const head = baked(() => {
    const d = new THREE.Group();
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), hide); neck.position.set(0.12, 0.25, 0); neck.rotation.z = -0.5;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), hide); skull.position.set(0.32, 0.52, 0);
    d.add(neck, skull);
    for (const sz of [-0.07, 0.07]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.38, 4), horn); a.position.set(0.28, 0.78, sz * 1.6); a.rotation.z = -0.3; d.add(a); }
    return d;
  });
  const deer = [[2.0, -2.3, 0.5, 0], [-2.4, 2.4, 2.6, 1]].map(([x, zz, ry, i]) => {
    const g = new THREE.Group(), b = i ? body.clone() : body, h = i ? head.clone() : head;
    h.position.set(0.5, 0.65, 0);
    g.add(b, h);
    g.position.set(x, H / 2 - 0.6, zz);
    g.rotation.y = ry;
    g.scale.setScalar(1.5);
    g.userData = { h, ph: i * 2.4 };
    root.add(g);
    return g;
  });

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const near = w > 0.05;
      for (const g of gears) { g.visible = near; if (near) g.rotation.z += dt * g.userData.v; }
      for (const d of deer) { d.visible = near; if (near) d.userData.h.rotation.z = -0.1 - (Math.sin(t * 0.35 + d.userData.ph) * 0.5 + 0.5) * 0.9; }
    },
  };
}
