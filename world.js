import * as THREE from 'three';

const PROJECTS = [
  { id: 'orbital', title: 'Orbital Expeditions', kind: 'CASE STUDY · AWS EKS', color: 0xffad48, orbit: 9, speed: 0.11, phase: 0.4, size: 1.25,
    blurb: 'A fictional space travel storefront built as six microservices on EKS, with an event-driven order flow through EventBridge and SQS, Terraform and Helm delivery, and a Prometheus and Grafana dashboard.',
    tags: ['EKS', 'DynamoDB', 'RDS', 'EventBridge', 'SQS', 'Terraform', 'Grafana'],
    main: ['Read the case study', 'orbital.html'], src: 'https://github.com/zeinhaidara/aws-retail-microservices-eks', note: 'Live demo retired Oct 2026. Captures are preserved in the case study.' },
  { id: 'healthcare', title: 'Healthcare SecOps', kind: 'CASE STUDY · SECURE PLATFORM', color: 0x4fd1c5, orbit: 14, speed: 0.08, phase: 2.2, size: 1.2,
    blurb: 'A read-only patient API on EKS Fargate, delivered through scan gates, GitOps with Argo CD, Terraform behind approvals, least-privilege IAM and detective controls. Every change and accepted risk is logged with evidence.',
    tags: ['EKS Fargate', 'Argo CD', 'Terraform', 'GuardDuty', 'Trivy', 'Checkov', 'IRSA'],
    main: ['Read the case study', 'healthcare.html'], src: 'https://github.com/zeinhaidara/healthcare-eks-secops', note: 'Includes a ship-a-change simulator: try to sneak a secret past the gates. Synthetic data only; no compliance claim is made.' },
  { id: 'threetier', title: 'AWS three-tier delivery', kind: 'AWS · APPLICATION PLATFORM', color: 0x7aa2ff, orbit: 19, speed: 0.06, phase: 4.1, size: 1,
    blurb: 'One FastAPI and MySQL application on two compute paths, private EC2 Auto Scaling and ECS Fargate, behind an Application Load Balancer. A load-test workflow exercises Auto Scaling under sustained traffic.',
    tags: ['EC2', 'ECS Fargate', 'RDS', 'Terraform', 'Load testing'],
    main: ['View the repository', 'https://github.com/zeinhaidara/aws-3-tier-github-actions'], src: null, note: '' },
  { id: 'pipeline', title: 'GitHub to AWS pipeline', kind: 'AWS · SECURE CI/CD', color: 0xb58cff, orbit: 24, speed: 0.045, phase: 5.5, size: 0.9,
    blurb: 'A tested, security-scanned change moves through dev, stage and main before an S3 website deployment. Short-lived OIDC credentials connect GitHub Actions to AWS with no long-lived keys.',
    tags: ['GitHub Actions', 'OIDC', 'IAM', 'S3'],
    main: ['View the repository', 'https://github.com/zeinhaidara/github-to-aws-pipeline'], src: null, note: '' },
  { id: 'northbridge', title: 'Northbridge Health', kind: 'AZURE · PLATFORM BLUEPRINT', color: 0x4aa3ff, orbit: 29, speed: 0.035, phase: 1.3, size: 1.05,
    blurb: 'An Azure referral-platform blueprint with reusable Terraform modules, AKS, private endpoints, workload identity, Key Vault and staged delivery. Resilience and rebuild evidence is still pending.',
    tags: ['Azure AKS', 'Key Vault', 'Terraform', 'Helm'],
    main: ['View the repository', 'https://github.com/zeinhaidara/azure-endtoend-platform'], src: null, note: 'Work in progress.' },
];

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const seen = new Set();
let focused = null;

/* ---------- UI (works with or without WebGL) ---------- */
const dock = $('dock');
const labels = {};
const dockBtns = {};
PROJECTS.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-pressed', 'false');
  b.style.setProperty('--c', hex(p.color));
  b.innerHTML = '<i></i>' + p.title;
  b.addEventListener('click', () => focus(p.id));
  dock.appendChild(b);
  dockBtns[p.id] = b;
  const l = document.createElement('div');
  l.className = 'label';
  l.style.setProperty('--c', hex(p.color));
  l.innerHTML = '<i></i>' + p.title.toUpperCase();
  document.body.appendChild(l);
  labels[p.id] = l;
});

function focus(id) {
  focused = id;
  const p = PROJECTS.find((x) => x.id === id);
  seen.add(id);
  $('intro').classList.add('gone');
  $('panel').hidden = false;
  $('p-kind').textContent = p.kind;
  $('p-title').textContent = p.title;
  $('p-blurb').textContent = p.blurb;
  $('p-tags').innerHTML = '';
  p.tags.forEach((t) => { const s = document.createElement('span'); s.textContent = t; $('p-tags').appendChild(s); });
  const main = $('p-main');
  main.textContent = p.main[0];
  main.href = p.main[1];
  const src = $('p-src');
  src.hidden = !p.src;
  if (p.src) src.href = p.src;
  $('p-note').textContent = p.note;
  $('p-note').hidden = !p.note;
  refreshDock();
  world && world.flyTo(id);
}

function overview() {
  focused = null;
  $('panel').hidden = true;
  refreshDock();
  world && world.flyTo(null);
}

function refreshDock() {
  PROJECTS.forEach((p) => {
    dockBtns[p.id].setAttribute('aria-pressed', String(focused === p.id));
    dockBtns[p.id].classList.toggle('seen', seen.has(p.id));
    labels[p.id].classList.toggle('seen', seen.has(p.id));
    labels[p.id].classList.toggle('dim', focused !== null && focused !== p.id);
  });
  $('score').textContent = 'Explored ' + seen.size + ' / ' + PROJECTS.length;
}

function hop(dir) {
  const i = focused ? PROJECTS.findIndex((p) => p.id === focused) : -1;
  const n = (i + dir + PROJECTS.length) % PROJECTS.length;
  focus(PROJECTS[n].id);
}

$('close').addEventListener('click', overview);
window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('a,button') && e.key === 'Enter') return;
  if (e.key === 'Escape') overview();
  else if (e.key === 'ArrowRight') hop(1);
  else if (e.key === 'ArrowLeft') hop(-1);
  else if (/^[1-5]$/.test(e.key)) focus(PROJECTS[Number(e.key) - 1].id);
});

/* ---------- 3D scene ---------- */
let world = null;
try {
  world = buildWorld();
} catch (err) {
  console.warn('WebGL unavailable', err);
  $('stage').remove();
  $('fallback').hidden = false;
  document.querySelectorAll('.label').forEach((l) => l.remove());
}
refreshDock();
const startId = decodeURIComponent(location.hash.slice(1));
if (PROJECTS.some((p) => p.id === startId)) focus(startId);

function glowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color + 'ff');
  grd.addColorStop(0.25, color + '66');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildWorld() {
  const canvas = $('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0c1017, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c1017, 0.006);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x302838, 1.25));
  const sunLight = new THREE.PointLight(0xfff0d8, 4.5, 0, 0.5);
  scene.add(sunLight);

  /* stars */
  const N = 2600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 90 + Math.random() * 120;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 0.55, sizeAttenuation: true, fog: false }));
  scene.add(stars);

  /* sun */
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 40, 40), new THREE.MeshBasicMaterial({ color: 0xffc66e }));
  scene.add(sun);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffad48'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(16, 16, 1);
  scene.add(halo);

  /* planets */
  const bodies = {};
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15 }, extra));

  PROJECTS.forEach((p) => {
    const ringGeo = new THREE.RingGeometry(p.orbit - 0.04, p.orbit + 0.04, 160);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x2a3340, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    const extras = [];
    const s = p.size;

    if (p.id === 'orbital') {
      spin.add(new THREE.Mesh(new THREE.SphereGeometry(s, 40, 40), std(p.color, { emissive: 0x4a2400, emissiveIntensity: 0.5 })));
      const r = new THREE.Mesh(new THREE.RingGeometry(s * 1.5, s * 2.2, 80), new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      r.rotation.x = Math.PI / 2.4;
      g.add(r);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(s * 0.22, 20, 20), std(0xdde3ee));
      g.add(moon);
      extras.push((t) => moon.position.set(Math.cos(t * 1.4) * s * 2.8, Math.sin(t * 0.7) * s * 0.4, Math.sin(t * 1.4) * s * 2.8));
    } else if (p.id === 'healthcare') {
      spin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.62, 1), std(0x103a38, { emissive: p.color, emissiveIntensity: 0.35, flatShading: true })));
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 1.15, 1), new THREE.MeshBasicMaterial({ color: p.color, wireframe: true, transparent: true, opacity: 0.65 }));
      spin.add(shell);
      const gates = [0, 1, 2].map((i) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(s * (1.55 + i * 0.28), 0.025, 8, 90), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.8 - i * 0.18 }));
        g.add(t);
        return t;
      });
      extras.push((t) => gates.forEach((q, i) => { q.rotation.x = t * (0.5 + i * 0.25) + i; q.rotation.y = t * (0.3 + i * 0.2); }));
    } else if (p.id === 'threetier') {
      [-0.75, 0, 0.75].forEach((y, i) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(s * (1 - i * 0.12), s * (1 - i * 0.12), 0.38, 40), std(p.color, { emissive: 0x112244, emissiveIntensity: 0.4 }));
        d.position.y = y * s;
        spin.add(d);
      });
    } else if (p.id === 'pipeline') {
      spin.add(new THREE.Mesh(new THREE.TorusKnotGeometry(s * 0.75, s * 0.2, 120, 14, 2, 3), std(p.color, { emissive: 0x2a1850, emissiveIntensity: 0.5 })));
    } else {
      spin.add(new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.1, 0), std(p.color, { emissive: 0x0a2a55, emissiveIntensity: 0.5, flatShading: true })));
      const cage = new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.6, 0), new THREE.MeshBasicMaterial({ color: p.color, wireframe: true, transparent: true, opacity: 0.35 }));
      spin.add(cage);
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(hex(p.color)), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false }));
    glow.scale.set(s * 6, s * 6, 1);
    g.add(glow);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(s * 2.4, 2.6), 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = p.id;
    g.add(hit);

    scene.add(g);
    bodies[p.id] = { p, g, spin, hit, extras, angle: p.phase };
  });

  /* camera rig */
  const home = { yaw: 0.6, pitch: 0.55, dist: 46, target: new THREE.Vector3() };
  const rig = { yaw: home.yaw, pitch: home.pitch, dist: home.dist, target: new THREE.Vector3() };
  const goal = { dist: home.dist, follow: null };
  const tmp = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let down = null, moved = 0, userDist = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    moved = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy);
      rig.yaw -= dx * 0.005;
      rig.pitch = Math.min(1.4, Math.max(0.08, rig.pitch + dy * 0.005));
      down = { x: e.clientX, y: e.clientY };
    } else {
      canvas.classList.toggle('hover', !!pick(e));
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    canvas.classList.remove('drag');
    if (down && moved < 6) { const id = pick(e); if (id) focus(id); }
    down = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const lim = goal.follow ? [5, 24] : [14, 70];
    goal.dist = Math.min(lim[1], Math.max(lim[0], goal.dist * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(Object.values(bodies).map((b) => b.hit), false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  const clock = new THREE.Clock();
  let t = 0;
  const lerp = reduced ? 1 : 0.06;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    for (const b of Object.values(bodies)) {
      if (!reduced) b.angle += dt * b.p.speed;
      const a = b.angle;
      b.g.position.set(Math.cos(a) * b.p.orbit, 0, Math.sin(a) * b.p.orbit);
      if (!reduced) b.spin.rotation.y += dt * 0.5;
      b.extras.forEach((fn) => fn(t));
    }
    halo.material.opacity = 0.85 + Math.sin(t * 1.5) * 0.08;
    if (!reduced) stars.rotation.y += dt * 0.004;

    if (goal.follow) tmp.copy(bodies[goal.follow].g.position); else tmp.set(0, 0, 0);
    rig.target.lerp(tmp, lerp);
    rig.dist += (goal.dist - rig.dist) * lerp;
    if (!goal.follow && !down && !reduced) rig.yaw += dt * 0.03;

    const cp = Math.cos(rig.pitch);
    camera.position.set(
      rig.target.x + Math.sin(rig.yaw) * cp * rig.dist,
      rig.target.y + Math.sin(rig.pitch) * rig.dist,
      rig.target.z + Math.cos(rig.yaw) * cp * rig.dist
    );
    camera.lookAt(rig.target);

    /* project labels */
    const w = window.innerWidth, h = window.innerHeight;
    for (const b of Object.values(bodies)) {
      tmp.copy(b.g.position);
      tmp.y += b.p.size * 1.9 + 0.8;
      tmp.project(camera);
      const l = labels[b.p.id];
      const vis = tmp.z < 1;
      l.style.visibility = vis ? 'visible' : 'hidden';
      l.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * w - 4) + 'px,' + ((-tmp.y * 0.5 + 0.5) * h - 8) + 'px) translateX(-50%)';
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    flyTo(id) {
      goal.follow = id;
      if (id) { goal.dist = Math.max(8, bodies[id].p.size * 6.5); rig.pitch = Math.min(rig.pitch, 0.5); }
      else goal.dist = home.dist;
    },
  };
}
