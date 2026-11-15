// Networking: icy archipelago. An iceberg with penguins, frozen bridges between the island slots.
import * as THREE from '../vendor/three.module.min.js';

export default function build(api, z) {
  const { flat, baked, rockBase, pine, col } = api;
  const root = new THREE.Group();
  z.group.add(root);
  const s = 2.5, R = 1.55 * s, H = 0.4 * s;
  const iceA = flat('#d6f1ff'), iceB = flat('#9cc7ea');
  const berg = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'ice'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    [[-0.9, -0.6, 1.3, 3.6, iceA], [0.5, -1.1, 0.9, 2.4, iceB], [-1.9, 0.5, 0.7, 1.7, iceB], [1.6, 0.2, 0.6, 1.3, iceA]].forEach(([x, zz, r, h, m]) => { const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), m); spike.position.set(x, h / 2, zz); spike.rotation.y = x; top.add(spike); });
    [[2.3, 1.6, 1.4], [-2.5, -1.7, 1.2]].forEach(([x, zz, k]) => { const p = pine(k, true); p.position.set(x, 0, zz); top.add(p); });
    [[0.4, 1.9], [-1.4, 2.2], [2.6, -0.9]].forEach(([x, zz]) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 6), flat('#ffffff')); d.scale.set(1.3, 0.3, 1); d.position.set(x, 0.05, zz); top.add(d); });
    g.add(top);
    return g;
  });
  berg.position.y = -0.6;
  root.add(berg);

  // penguins on the iceberg
  const ink = flat('#2b3350'), white = flat('#f4f8ff'), orange = flat('#ff8a1f');
  const bodyG = new THREE.CylinderGeometry(0.13, 0.2, 0.52, 7), bellyG = new THREE.SphereGeometry(0.15, 8, 6), beakG = new THREE.ConeGeometry(0.05, 0.14, 4), footG = new THREE.BoxGeometry(0.1, 0.03, 0.16), headG = new THREE.SphereGeometry(0.14, 8, 6);
  const penguins = [[0.9, 1.3, 0.4], [1.5, 0.9, 1.2], [0.2, 1.8, -0.5], [-0.6, 1.5, 2.1], [2.2, 0.3, 0.9]].map(([x, zz, ry], i) => {
    const p = new THREE.Group();
    const body = new THREE.Mesh(bodyG, ink); body.position.y = 0.3;
    const head = new THREE.Mesh(headG, ink); head.position.y = 0.62;
    const belly = new THREE.Mesh(bellyG, white); belly.scale.set(0.8, 1.5, 0.5); belly.position.set(0, 0.3, 0.12);
    const beak = new THREE.Mesh(beakG, orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.62, 0.17);
    const f1 = new THREE.Mesh(footG, orange), f2 = new THREE.Mesh(footG, orange); f1.position.set(-0.08, 0.02, 0.06); f2.position.set(0.08, 0.02, 0.06);
    p.add(body, head, belly, beak, f1, f2);
    p.position.set(x, H / 2 - 0.6, zz);
    p.rotation.y = ry;
    p.scale.setScalar(1.25 - (i % 3) * 0.15);
    p.userData = { ph: i * 1.3, y: H / 2 - 0.6 };
    root.add(p);
    return p;
  });

  // frozen bridges between neighbouring island slots; they turn with the islands
  const O = z.orbitR, span = 2 * O * Math.sin(Math.PI / 5) - 4.4, midR = O * Math.cos(Math.PI / 5);
  const bridges = baked(() => {
    const g = new THREE.Group(), ice = flat('#bfe2ff');
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / 5) * Math.PI * 2, b = new THREE.Group();
      const arch = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.16, 5, 18, Math.PI), ice);
      arch.scale.y = 0.26;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.08, 0.5), flat('#e6f4ff'));
      deck.position.y = 0.02;
      b.add(arch, deck);
      for (let k = -2; k <= 2; k++) { const ic = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5 + (k & 1) * 0.3, 4), flat('#9cc7ea')); ic.rotation.x = Math.PI; ic.position.set((k * span) / 5.5, -0.3, 0); b.add(ic); }
      b.position.set(Math.cos(a) * midR, 0.1, Math.sin(a) * midR);
      b.rotation.y = -(a + Math.PI / 2);
      g.add(b);
    }
    return g;
  });
  z.spin.add(bridges);


  return {
    update(t, dt, w, appear, camera) {
      root.scale.setScalar(Math.max(0.001, appear));
      bridges.scale.setScalar(Math.max(0.001, appear));
      const near = w > 0.05;
      for (const p of penguins) { p.visible = near; if (near) { p.rotation.z = Math.sin(t * 4 + p.userData.ph) * 0.12; p.position.y = p.userData.y + Math.abs(Math.sin(t * 4 + p.userData.ph)) * 0.05; } }
    },
  };
}
