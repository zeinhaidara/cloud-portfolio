// Observability: rainy highlands. Two striped lighthouses sweeping their beams over the rain, with lightning flashes.
import * as THREE from '../vendor/three.module.min.js';
import { makeBolt, flashBolt, sstep } from './kit.js';

export default function build(api, z) {
  const { flat, baked, rockBase, rockLump, pine, col } = api;
  const root = new THREE.Group();
  (z.big || z.group).add(root); // the engine scales the large-feature group with distance
  const s = 2.6, R = 1.55 * s, H = 0.4 * s;
  const towers = [[-1.2, -0.6, 1.25], [2.3, 1.2, 0.8]];
  const islet = baked(() => {
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, 'rainy'));
    const top = new THREE.Group();
    top.position.y = H / 2;
    for (const [x, zz, k] of towers) {
      for (let i = 0; i < 4; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry((0.52 - i * 0.07) * k, (0.6 - i * 0.07) * k, 1.1 * k, 9), flat(i % 2 ? '#e05a47' : '#f4f8ff')); seg.position.set(x, (0.55 + i * 1.1) * k, zz); top.add(seg); }
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * k, 0.5 * k, 0.16 * k, 9), flat('#3a3f54')); deck.position.set(x, 4.5 * k, zz);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5 * k, 0.6 * k, 9), flat('#e05a47')); roof.position.set(x, 5.4 * k, zz);
      top.add(deck, roof);
    }
    [[-3.3, 1.4, 2.6], [3.4, -1.5, 2.2], [0.6, 2.9, 1.8]].forEach(([x, zz, k]) => { const r = rockLump(k, '#7b7f8c'); r.position.set(x, 0.1, zz); top.add(r); });
    [[-2.6, -2.2, 1.5], [1.4, -2.6, 1.3]].forEach(([x, zz, k]) => { const p = pine(k, false); p.position.set(x, 0, zz); top.add(p); });
    g.add(top);
    return g;
  });
  islet.position.y = -0.6;
  root.add(islet);

  // the lamp rooms glow and each throws a slowly sweeping beam
  const lampMat = flat('#fff3b0', { emissive: col('#ffd34d'), emissiveIntensity: 0.9, roughness: 0.3 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, blending: THREE.AdditiveBlending });
  const beamG = new THREE.ConeGeometry(1.5, 11, 12, 1, true).rotateZ(-Math.PI / 2).translate(5.5, 0, 0);
  const lamps = [];
  const sweeps = towers.map(([x, zz, k], i) => {
    const y = H / 2 - 0.6 + 4.95 * k, lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * k, 0.34 * k, 0.5 * k, 8), lampMat);
    lamp.position.set(x, y, zz);
    lamps.push(lamp);
    const sweep = new THREE.Group();
    sweep.position.set(x, y, zz);
    sweep.add(new THREE.Mesh(beamG, beamMat));
    sweep.userData = { v: 0.55 - i * 0.2, a: i * 2 };
    root.add(lamp, sweep);
    return sweep;
  });

  const bolts = [makeBolt(17), makeBolt(14)];
  bolts[0].position.set(-13, 18, -8); bolts[1].position.set(15, 16, 9);
  bolts.forEach((b) => z.group.add(b));

  return {
    update(t, dt, w, appear) {
      root.scale.setScalar(Math.max(0.001, appear));
      const k = sstep(0.03, 0.45, w) * appear;
      beamMat.opacity = 0.07 * k; // a soft sweep, not a solid wedge against the bright daytime sky
      lampMat.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.15;
      for (const b of sweeps) { b.visible = k > 0.02; if (b.visible) b.rotation.y = b.userData.a + t * b.userData.v; }
      for (const l of lamps) l.visible = k > 0.02; // sub-pixel from far away
      for (const b of bolts) flashBolt(b, dt, k, api.reduced);
    },
  };
}
