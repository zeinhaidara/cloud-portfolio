// Security: dark gloomy forest. A fortress ringed by black pines, owls watching from the towers, wisps of heavy fog.
import * as THREE from '../vendor/three.module.min.js';
import { makeRibbon, waveRibbon, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, pine, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const stone = flat('#5a6070'), dark = flat('#3a3f54'), slate = flat('#2c3044');
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'rocky'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    const keep = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 2.1), stone); keep.position.y = 1.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.3, 4), slate); roof.position.y = 3.85; roof.rotation.y = Math.PI / 4;
    top.add(keep, roof);
    [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([x, zz]) => {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 2.8, 7), dark); tw.position.set(x, 1.4, zz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 7), slate); cap.position.set(x, 3.35, zz);
      top.add(tw, cap);
    });
    for (const [x, zz, w, d] of [[0, -2.1, 3.6, 0.45], [0, 2.1, 3.6, 0.45], [-2.1, 0, 0.45, 3.6], [2.1, 0, 0.45, 3.6]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), stone); wall.position.set(x, 0.75, zz); top.add(wall); }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), flat('#1c1f2e')); gate.position.set(0, 0.55, 2.15); top.add(gate);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3, d = R * (0.78 + (i % 3) * 0.06), p = pine(1.7 + (i % 3) * 0.35, false); p.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); top.add(p); }
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // owls on two towers: round bodies, glowing eyes, heads that slowly turn and a blink now and then
  const brown = flat('#6b5a48'), eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, fog: false });
  const owls = [[-2.1, -2.1, 0.4], [2.1, 2.1, -0.7]].map(([x, zz, ry], i) => {
    const o = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), brown), head = new THREE.Group();
    body.scale.set(1, 1.3, 0.9);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), brown));
    for (const sx of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeMat); e.position.set(sx, 0.03, 0.2); head.add(e); }
    head.position.y = 0.4;
    o.add(body, head);
    o.position.set(x, H / 2 - 0.6 + 3.3, zz);
    o.scale.setScalar(1.5);
    o.rotation.y = ry;
    o.userData = { head, ph: i * 2.3 };
    root.add(o);
    return o;
  });

  // heavy fog: low grey wisps sliding around the keep
  const wisps = [];
  for (let i = 0; i < 5; i++) { const b = makeRibbon(z.r * 0.55, 1.8, col('#9aa3b8'), { additive: false, segs: 18 }); b.userData.a = (i / 5) * Math.PI * 2; b.position.y = 0.6 + (i % 3) * 0.7; z.group.add(b); wisps.push(b); }

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      for (const o of owls) { const u = o.userData; o.visible = k > 0.02; if (o.visible) { u.head.rotation.y = Math.sin(t * 0.5 + u.ph) * 1.1; u.head.scale.y = Math.sin(t * 0.9 + u.ph) > 0.97 ? 0.15 : 1; } }
      wisps.forEach((b, i) => { b.visible = k > 0.01; if (b.visible) { const a = b.userData.a + t * 0.03 * (i % 2 ? 1 : -1), r = 7 + (i % 3) * 5; b.position.x = Math.cos(a) * r; b.position.z = Math.sin(a) * r; b.rotation.y = -a; b.material.opacity = 0.34 * k; waveRibbon(b, t, 0.3, 0.4, 0.8); } });
    },
  };
}
