import * as THREE from 'three';

// Night scene: projects as planets. Controlled by app.js through the returned API.
export function createWorld({ canvas, labelsHost, projects, onPick }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0c1017, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c1017, 0.006);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x302838, 1.25));
  scene.add(new THREE.PointLight(0xfff0d8, 4.5, 0, 0.5));

  const N = 2600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 90 + Math.random() * 140, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 0.55, fog: false }));
  scene.add(stars);

  const glowTex = (color) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, color + 'ff'); grd.addColorStop(0.25, color + '66'); grd.addColorStop(1, color + '00');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.4, 40, 40), new THREE.MeshBasicMaterial({ color: 0xffc66e })));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#ffad48'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(16, 16, 1);
  scene.add(halo);

  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15 }, extra));
  const bodies = {}, labels = {};

  projects.forEach((p) => {
    const q = p.planet, s = q.size, col = new THREE.Color(p.color).getHex();
    const ring = new THREE.Mesh(new THREE.RingGeometry(q.orbit - 0.04, q.orbit + 0.04, 160), new THREE.MeshBasicMaterial({ color: 0x2a3340, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    const g = new THREE.Group(), spin = new THREE.Group(), extras = [];
    g.add(spin);

    if (q.shape === 'ringed') {
      spin.add(new THREE.Mesh(new THREE.SphereGeometry(s, 40, 40), std(col, { emissive: 0x4a2400, emissiveIntensity: 0.5 })));
      const r = new THREE.Mesh(new THREE.RingGeometry(s * 1.5, s * 2.2, 80), new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      r.rotation.x = Math.PI / 2.4;
      g.add(r);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(s * 0.22, 20, 20), std(0xdde3ee));
      g.add(moon);
      extras.push((t) => moon.position.set(Math.cos(t * 1.4) * s * 2.8, Math.sin(t * 0.7) * s * 0.4, Math.sin(t * 1.4) * s * 2.8));
    } else if (q.shape === 'shield') {
      spin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.62, 1), std(0x103a38, { emissive: col, emissiveIntensity: 0.35, flatShading: true })));
      spin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s * 1.15, 1), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.65 })));
      const gates = [0, 1, 2].map((i) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(s * (1.55 + i * 0.28), 0.025, 8, 90), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 - i * 0.18 }));
        g.add(t);
        return t;
      });
      extras.push((t) => gates.forEach((m, i) => { m.rotation.x = t * (0.5 + i * 0.25) + i; m.rotation.y = t * (0.3 + i * 0.2); }));
    } else if (q.shape === 'stack') {
      [-0.75, 0, 0.75].forEach((y, i) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(s * (1 - i * 0.12), s * (1 - i * 0.12), 0.38, 40), std(col, { emissive: 0x112244, emissiveIntensity: 0.4 }));
        d.position.y = y * s;
        spin.add(d);
      });
    } else if (q.shape === 'knot') {
      spin.add(new THREE.Mesh(new THREE.TorusKnotGeometry(s * 0.75, s * 0.2, 120, 14, 2, 3), std(col, { emissive: 0x2a1850, emissiveIntensity: 0.5 })));
    } else {
      spin.add(new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.1, 0), std(col, { emissive: 0x0a2a55, emissiveIntensity: 0.5, flatShading: true })));
      spin.add(new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.6, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.35 })));
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(p.color), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false }));
    glow.scale.set(s * 6, s * 6, 1);
    g.add(glow);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(s * 2.4, 2.6), 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = p.id;
    g.add(hit);
    scene.add(g);
    bodies[p.id] = { p, q, g, spin, hit, extras, angle: q.phase };

    const l = document.createElement('div');
    l.className = 'plabel';
    l.style.setProperty('--c', p.color);
    l.innerHTML = '<i></i>' + p.title + '<b class="check" aria-hidden="true"></b>';
    l.addEventListener('click', () => { if (active) onPick(p.id); });
    labelsHost.appendChild(l);
    labels[p.id] = l;
  });

  /* camera rig */
  const FAR = 150, HOME = 46;
  const rig = { yaw: 0.6, pitch: 0.95, dist: FAR, target: new THREE.Vector3(), off: 0 };
  const goal = { dist: FAR, follow: null };
  const tmp = new THREE.Vector3();
  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let active = false, running = false, down = null, moved = 0;
  canvas.addEventListener('pointerdown', (e) => { if (!active) return; down = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy);
      rig.yaw -= dx * 0.005;
      rig.pitch = Math.min(1.4, Math.max(0.08, rig.pitch + dy * 0.005));
      down = { x: e.clientX, y: e.clientY };
    } else canvas.classList.toggle('hover', !!pick(e));
  });
  canvas.addEventListener('pointerup', (e) => {
    canvas.classList.remove('drag');
    if (down && moved < 6) { const id = pick(e); if (id) onPick(id); }
    down = null;
  });
  canvas.addEventListener('wheel', (e) => {
    if (!active) return;
    e.preventDefault();
    const lim = goal.follow ? [5, 24] : [14, 70];
    goal.dist = Math.min(lim[1], Math.max(lim[0], goal.dist * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(Object.values(bodies).map((b) => b.hit), false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt); // frame-rate independent easing
    t += dt;
    for (const b of Object.values(bodies)) {
      if (!reduced) { b.angle += dt * b.q.speed; b.spin.rotation.y += dt * 0.5; }
      b.g.position.set(Math.cos(b.angle) * b.q.orbit, 0, Math.sin(b.angle) * b.q.orbit);
      b.extras.forEach((fn) => fn(t));
    }
    halo.material.opacity = 0.85 + Math.sin(t * 1.5) * 0.08;
    if (!reduced) stars.rotation.y += dt * 0.004;

    if (goal.follow) tmp.copy(bodies[goal.follow].g.position); else tmp.set(0, 0, 0);
    rig.target.lerp(tmp, k);
    rig.dist += (goal.dist - rig.dist) * k;
    const pitchGoal = goal.follow ? 0.45 : 0.55;
    if (!down) rig.pitch += (pitchGoal - rig.pitch) * k * 0.5;
    if (!goal.follow && !down && !reduced) rig.yaw += dt * 0.03;
    const offGoal = goal.follow && W > 900 ? 210 : 0;
    rig.off += (offGoal - rig.off) * k;
    camera.setViewOffset(W, H, rig.off, 0, W, H);

    const cp = Math.cos(rig.pitch);
    camera.position.set(rig.target.x + Math.sin(rig.yaw) * cp * rig.dist, rig.target.y + Math.sin(rig.pitch) * rig.dist, rig.target.z + Math.cos(rig.yaw) * cp * rig.dist);
    camera.lookAt(rig.target);
    camera.updateMatrixWorld();

    for (const b of Object.values(bodies)) {
      tmp.copy(b.g.position);
      tmp.y += b.q.size * 1.9 + 0.8;
      tmp.project(camera);
      const l = labels[b.p.id];
      l.style.visibility = tmp.z < 1 ? 'visible' : 'hidden';
      l.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * W) + 'px,' + ((-tmp.y * 0.5 + 0.5) * H - 10) + 'px) translate(-50%,-100%)';
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; clock.getDelta(); requestAnimationFrame(frame); }

  let stopTimer = null;
  return {
    setActive(on) {
      active = on;
      clearTimeout(stopTimer);
      if (on) {
        rig.dist = FAR; rig.pitch = 0.95;
        goal.dist = goal.follow ? Math.max(12, bodies[goal.follow].q.size * 9.5) : HOME;
        start();
      } else {
        goal.dist = FAR;
        stopTimer = setTimeout(() => { if (!active) running = false; }, 1000);
      }
    },
    flyTo(id) {
      goal.follow = id;
      if (active) goal.dist = id ? Math.max(12, bodies[id].q.size * 9.5) : HOME;
    },
    setMarks(focused, seen) {
      for (const id in labels) {
        labels[id].classList.toggle('seen', seen.has(id));
        labels[id].classList.toggle('dim', !!focused && focused !== id);
      }
    },
  };
}
