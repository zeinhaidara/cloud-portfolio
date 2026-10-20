import * as THREE from 'three';

// One 3D world of floating islands, by day and by night. setMode() blends sky, light, clouds,
// stars and every lantern; the islands themselves never change. Contact lives in the balloon.
// solo: render one project's island inside a page section (case-study hero) instead of the whole archipelago.
export function createWorld({ canvas, labelsHost, projects, onPick = () => {}, onInteract = () => {}, mode = 'day', solo = null }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  const col = (c) => new THREE.Color(c);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- palette: [day, night] ---------- */
  const P = {
    top: [col('#3d9bf0'), col('#04060c')], horizon: [col('#d4ecff'), col('#1c2747')], bottom: [col('#94cdff'), col('#0a1020')],
    fog: [col('#cfe7ff'), col('#0d1426')],
    hemiSky: [col('#eaf6ff'), col('#7d8fc4')], hemiGround: [col('#8fb87a'), col('#1a1f33')], hemi: [1.6, 0.55],
    dirColor: [col('#fff2dc'), col('#9fb6ff')], dir: [1.5, 0.45],
    orb: [col('#ffd34d'), col('#eef2ff')], halo: [col('#ffb347'), col('#8fa8ff')], core: [col('#fff0d8'), col('#b9c8ff')], coreI: [4.5, 1.2],
    cloud: [col('#ffffff'), col('#1c2540')], cloudEm: [0.35, 0], cloudOp: [1, 0.3],
    sea: [col('#ffffff'), col('#0e1528')], seaEm: [0.3, 0], seaOp: [0.75, 0.45],
    ring: [col('#ffffff'), col('#7f95d6')], ringOp: [0.55, 0.35],
  };
  const glows = []; // materials that light up at night: { mat, max, min }
  const lamps = []; // point lights that switch on at night: { light, max }
  const beams = []; // translucent light beams that appear at night

  /* ---------- sky dome (three-stop gradient) ---------- */
  const skyU = { top: { value: P.top[0].clone() }, horizon: { value: P.horizon[0].clone() }, bottom: { value: P.bottom[0].clone() } };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;\nvoid main(){ float h = normalize(vP).y;\n vec3 c = h > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.55, h)) : mix(horizon, bottom, smoothstep(0.0, -0.45, h));\n gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  })));
  scene.fog = new THREE.Fog(P.fog[0].clone(), 60, 240);

  /* ---------- light ---------- */
  const hemi = new THREE.HemisphereLight(P.hemiSky[0].clone(), P.hemiGround[0].clone(), P.hemi[0]);
  const dir = new THREE.DirectionalLight(P.dirColor[0].clone(), P.dir[0]);
  dir.position.set(30, 60, 25);
  const core = new THREE.PointLight(P.core[0].clone(), P.coreI[0], 0, 0.5);
  scene.add(hemi, dir, core);

  /* ---------- stars and shooting stars (night) ---------- */
  const N = 2400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = rand(140, 340), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.7, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  const meteor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
  meteor.userData = { life: 1, next: 3, v: new THREE.Vector3() };
  scene.add(meteor);

  /* ---------- sun by day, moon by night ---------- */
  const glowTex = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.4)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  const orbMat = new THREE.MeshBasicMaterial({ color: P.orb[0].clone() });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 40, 40), orbMat);
  scene.add(orb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: P.halo[0].clone(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(18, 18, 1);
  scene.add(halo);
  if (solo) { orb.position.set(-26, 16, -48); halo.position.copy(orb.position); core.position.set(-10, 14, 12); }

  /* ---------- clouds you can poke, and a sea of clouds below ---------- */
  const cloudMat = new THREE.MeshStandardMaterial({ color: P.cloud[0].clone(), emissive: 0xffffff, emissiveIntensity: P.cloudEm[0], roughness: 1, flatShading: true, transparent: true });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clouds = [];
  for (let i = 0; i < 11; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const s = rand(1.2, 2.4);
      m.scale.set(s * 1.3, s * 0.85, s);
      m.position.set((j - n / 2) * 1.6, Math.random() * 0.7, (Math.random() - 0.5) * 1.5);
      m.userData.cloud = c;
      c.add(m);
    }
    const low = i % 2 === 0; // low clouds drift under the islands, high ones ring the archipelago
    c.userData = { r: low ? rand(8, 34) : rand(41, 52), a: (i / 11) * Math.PI * 2 + Math.random() * 0.4, y: low ? rand(-12, -8) : rand(3, 9), v: rand(0.008, 0.02), s: rand(0.8, 1.3), poof: -1 };
    scene.add(c);
    clouds.push(c);
  }
  const seaMat = new THREE.MeshStandardMaterial({ color: P.sea[0].clone(), emissive: 0xffffff, emissiveIntensity: P.seaEm[0], roughness: 1, flatShading: true, transparent: true, opacity: P.seaOp[0] });
  const SEA = 70, sea = new THREE.InstancedMesh(puff, seaMat, SEA);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  for (let i = 0; i < SEA; i++) {
    const r = Math.sqrt(Math.random()) * 120, a = Math.random() * Math.PI * 2, w = rand(5, 9);
    m4.compose(v4.set(Math.cos(a) * r, rand(-48, -42), Math.sin(a) * r), q4.setFromAxisAngle(v4.clone().set(0, 1, 0), Math.random() * 6), s4.set(w, w * rand(0.18, 0.28), w * rand(0.7, 1)));
    sea.setMatrixAt(i, m4);
  }
  scene.add(sea);

  /* ---------- shared building blocks ---------- */
  const flat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, flatShading: true }, extra));
  const glowMat = (color, glowColor, max) => {
    const m = flat(color, { emissive: col(glowColor), emissiveIntensity: 0 });
    glows.push({ mat: m, max });
    return m;
  };
  function tree(s) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.35 * s, 6), flat('#8b5a2b'));
    trunk.position.y = 0.17 * s;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 0.7 * s, 7), flat('#3fbf6f'));
    top.position.y = 0.65 * s;
    t.add(trunk, top);
    return t;
  }
  function lantern(s, withLight) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.7 * s, 6), flat('#1d2340'));
    post.position.y = 0.35 * s;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 12, 12), glowMat('#ffe2a8', '#ffb347', 2.4));
    lamp.position.y = 0.76 * s;
    g.add(post, lamp);
    if (withLight) {
      const light = new THREE.PointLight(0xffb45a, 0, 9 * s, 1.6);
      light.position.y = 0.9 * s;
      g.add(light);
      lamps.push({ light, max: 14 });
    }
    return g;
  }
  /* ---------- climates: the same low-poly island, a different vibe each ---------- */
  const CLIMATE = {
    meadow: { top: '#7bd96a', lip: '#5cc451', rock: '#a8743f', rock2: '#8b5a2b' },
    desert: { top: '#efc37c', lip: '#dba45e', rock: '#c46a3a', rock2: '#9c4f2a' },
    castle: { top: '#86cf6a', lip: '#68b24f', rock: '#9aa0ad', rock2: '#747a88' },
    snow: { top: '#f4f8ff', lip: '#d9e6f6', rock: '#8a9bb6', rock2: '#6b7b96' },
    city: { top: '#cfd5df', lip: '#aeb6c4', rock: '#8a6c52', rock2: '#6e5440' },
    volcanic: { top: '#4b3c3c', lip: '#3a2e2e', rock: '#2e2626', rock2: '#5a3a2e' },
    tropical: { top: '#8fe06a', lip: '#ecd59a', rock: '#a8743f', rock2: '#8b5a2b' },
    forest: { top: '#5fbf55', lip: '#479c40', rock: '#8b6a45', rock2: '#6e5236' },
    rocky: { top: '#a2a6ae', lip: '#8a8e97', rock: '#6f737c', rock2: '#575b63' },
    ice: { top: '#e6f4ff', lip: '#bfe2ff', rock: '#9cc7ea', rock2: '#7aaed8' },
    village: { top: '#9bd77a', lip: '#7cbf5c', rock: '#a8743f', rock2: '#8b5a2b' },
    rainy: { top: '#6fb57a', lip: '#58995f', rock: '#7b7f8c', rock2: '#62666f' },
  };
  function rockBase(s, R, H, climate = 'meadow') {
    const c = CLIMATE[climate] || CLIMATE.meadow;
    const g = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.94, H, 7), flat(c.top));
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.9, 0.18 * s, 7), flat(c.lip));
    lip.position.y = -H / 2 - 0.09 * s;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(R * 0.9, 2.1 * s, 7), flat(c.rock));
    rock.rotation.x = Math.PI;
    rock.position.y = -H / 2 - 0.18 * s - 1.05 * s;
    const rock2 = new THREE.Mesh(new THREE.ConeGeometry(R * 0.45, 1.1 * s, 6), flat(c.rock2));
    rock2.rotation.x = Math.PI;
    rock2.position.set(R * 0.3, -H / 2 - 0.9 * s, R * 0.2);
    g.add(grass, lip, rock, rock2);
    return g;
  }


  /* climate props, placed around the rim so the project building keeps the centre */
  const at = (obj, a, d, y = 0) => { obj.position.set(Math.cos(a) * d, y, Math.sin(a) * d); return obj; };
  function pine(s, snowy) {
    const t = tree(s);
    if (snowy) {
      t.children[1].material = flat('#2f8f5a');
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17 * s, 0.3 * s, 7), flat('#ffffff'));
      cap.position.y = 0.88 * s;
      t.add(cap);
    }
    return t;
  }
  function rockLump(s, color = '#9aa0ad') {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 * s, 0), flat(color));
    r.scale.set(1, 0.7, 1.1);
    r.rotation.set(rand(0, 3), rand(0, 3), 0);
    r.position.y = 0.08 * s;
    return r;
  }
  function cactus(s) {
    const g = new THREE.Group(), m = flat('#3f9f5a');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.09 * s, 0.6 * s, 7), m);
    body.position.y = 0.3 * s;
    [[-1, 0.32], [1, 0.42]].forEach(([side, y]) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.22 * s, 6), m);
      arm.position.set(side * 0.13 * s, y * s + 0.06 * s, 0);
      const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.12 * s, 6), m);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(side * 0.08 * s, y * s - 0.04 * s, 0);
      g.add(arm, elbow);
    });
    g.add(body);
    return g;
  }
  function palm(s) {
    const g = new THREE.Group(), bark = flat('#a87a4a'), leaf = flat('#3fbf6f');
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.065 * s, 0.24 * s, 6), bark);
      seg.position.set(i * 0.035 * s, (0.12 + i * 0.22) * s, 0);
      seg.rotation.z = -0.12;
      g.add(seg);
    }
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.48 * s, 0.03 * s, 0.13 * s), leaf);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(0.14 * s + Math.cos(a) * 0.2 * s, 0.98 * s, Math.sin(a) * 0.2 * s);
      f.rotation.set(0, -a, -0.35);
      g.add(f);
    }
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 8), flat('#6b4a2b'));
    coco.position.set(0.14 * s, 0.92 * s, 0);
    g.add(coco);
    return g;
  }
  function house(s, roof) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.26 * s, 0.3 * s), flat('#fff5e6'));
    walls.position.y = 0.13 * s;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 0.22 * s, 4), flat(roof));
    top.rotation.y = Math.PI / 4;
    top.position.y = 0.37 * s;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.01 * s), glowMat('#2b3350', '#ffd27a', 2));
    win.position.set(0.06 * s, 0.14 * s, 0.155 * s);
    g.add(walls, top, win);
    return g;
  }
  function crystal(s, h = 0.5) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 * s, 0), glowMat('#bfe9ff', '#8fd0ff', 1.3));
    c.scale.set(1, (h / 0.14) * 0.55, 1);
    c.position.y = h * 0.5 * s;
    return c;
  }
  function raincloud(s, anim) {
    const g = new THREE.Group();
    const m = flat('#9aa3b5', { roughness: 1 });
    [[-0.25, 0, 0.32], [0.12, 0.08, 0.38], [0.42, -0.02, 0.28]].forEach(([x, y, r]) => {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), m);
      p.position.set(x * s, y * s, 0);
      p.scale.y = 0.75;
      g.add(p);
    });
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x8fc4ff, transparent: true, opacity: 0.75 });
    const drops = [];
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.018 * s, 0.16 * s, 0.018 * s), dropMat);
      d.userData = { x: rand(-0.5, 0.65) * s, z: rand(-0.25, 0.25) * s, o: Math.random() };
      g.add(d);
      drops.push(d);
    }
    anim.push((t) => drops.forEach((d) => {
      const k = (t * 1.4 + d.userData.o) % 1;
      d.position.set(d.userData.x, -0.25 * s - k * 1.9 * s, d.userData.z);
    }));
    return g;
  }
  function decorate(climate, s, R, top, anim, color) {
    const ring = (n, f = 0.74, a0 = 0.6) => Array.from({ length: n }, (_, i) => [a0 + (i / n) * Math.PI * 2, R * f]);
    switch (climate) {
      case 'desert': {
        ring(3, 0.74, 0.5).forEach(([a, d], i) => top.add(at(i === 1 ? rockLump(s, '#c46a3a') : cactus(s * (0.9 + i * 0.15)), a, d)));
        [1.8, 3.6].forEach((a) => {
          const dune = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 10, 6), flat('#e3b067'));
          dune.scale.set(1.3, 0.28, 0.9);
          top.add(at(dune, a, R * 0.78));
        });
        break;
      }
      case 'castle': {
        const stone = flat('#c3c8d2'), n = 7, side = 2 * R * 0.93 * Math.sin(Math.PI / n);
        for (let i = 0; i < n; i++) {
          if (i === 2) continue; // the gate
          const mid = ((i + 0.5) / n) * Math.PI * 2;
          const wall = new THREE.Mesh(new THREE.BoxGeometry(side * 0.96, 0.3 * s, 0.14 * s), stone);
          at(wall, mid, R * 0.93 * Math.cos(Math.PI / n), 0.15 * s);
          wall.rotation.y = -mid + Math.PI / 2;
          top.add(wall);
        }
        [0, 3, 5].forEach((i) => {
          const a = (i / n) * Math.PI * 2;
          const tw = new THREE.Group();
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.19 * s, 0.75 * s, 8), stone);
          body.position.y = 0.37 * s;
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.38 * s, 8), flat(color));
          roof.position.y = 0.93 * s;
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.12 * s, 0.01 * s), glowMat('#2b3350', '#ffcf73', 2));
          slit.position.set(0, 0.5 * s, 0.185 * s);
          tw.add(body, roof, slit);
          top.add(at(tw, a, R * 0.88));
        });
        break;
      }
      case 'snow': {
        ring(3, 0.72, 0.4).forEach(([a, d], i) => top.add(at(pine(s * (0.8 + i * 0.15), true), a, d)));
        [1.5, 3.3].forEach((a, i) => top.add(at(crystal(s, 0.45 + i * 0.2), a, R * 0.68)));
        [2.4, 5.2].forEach((a) => {
          const drift = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 10, 6), flat('#ffffff'));
          drift.scale.set(1.3, 0.3, 1);
          top.add(at(drift, a, R * 0.6));
        });
        break;
      }
      case 'city': {
        const tones = ['#f6d6a8', '#cfe3ff', '#ffd1dc', '#d8f2d0', '#e6dcff', '#fff1b8'];
        ring(6, 0.72, 0.3).forEach(([a, d], i) => {
          const h = (0.45 + ((i * 37) % 6) * 0.13) * s, w = (0.26 + (i % 3) * 0.05) * s;
          const b = new THREE.Group();
          const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), flat(tones[i]));
          box.position.y = h / 2;
          b.add(box);
          for (let k = 0; k < Math.floor(h / (0.2 * s)); k++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.06 * s, 0.01 * s), glowMat('#2b3350', '#ffd27a', 1.8));
            win.position.set(0, (0.12 + k * 0.2) * s, w / 2 + 0.002);
            b.add(win);
          }
          at(b, a, d);
          b.rotation.y = -a - Math.PI / 2; // windows face outwards
          top.add(b);
        });
        break;
      }
      case 'volcanic': {
        const v = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.75 * s, 1.15 * s, 8, 1, true), flat('#3a2e2e', { side: THREE.DoubleSide }));
        cone.position.y = 0.57 * s;
        const lavaM = flat('#ff6a00', { emissive: col('#ff5a00'), emissiveIntensity: 0.9 });
        glows.push({ mat: lavaM, max: 2.6, min: 0.9 });
        const lava = new THREE.Mesh(new THREE.CylinderGeometry(0.21 * s, 0.21 * s, 0.05 * s, 10), lavaM);
        lava.position.y = 1.08 * s;
        const flow = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.75 * s, 0.05 * s), lavaM);
        flow.position.set(0, 0.68 * s, 0.4 * s);
        flow.rotation.x = -0.45;
        v.add(flow);
        v.add(cone, lava);
        const puffs = [0, 1, 2].map((i) => {
          const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 * s, 1), flat('#6b6d77', { transparent: true }));
          v.add(p);
          return [p, i / 3];
        });
        anim.push((t) => puffs.forEach(([p, o]) => {
          const k = (t * 0.25 + o) % 1;
          p.position.set(Math.sin(k * 4 + o * 9) * 0.12 * s, (1.15 + k * 1.5) * s, 0);
          p.scale.setScalar(0.6 + k * 1.4);
          p.material.opacity = 0.75 * (1 - k);
        }));
        top.add(at(v, 1.9, R * 0.58));
        [0.5, 3.6, 5.2].forEach((a, i) => {
          const crack = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.02 * s, 0.05 * s), lavaM);
          crack.rotation.y = a + i;
          top.add(at(crack, a, R * 0.7, 0.01 * s));
        });
        top.add(at(rockLump(s, '#5a3a2e'), 2.3, R * 0.75));
        break;
      }
      case 'tropical': {
        ring(2, 0.74, 0.9).forEach(([a, d], i) => top.add(at(palm(s * (0.95 + i * 0.15)), a, d)));
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.03 * s, 16), flat('#38b6ff', { emissive: col('#38b6ff'), emissiveIntensity: 0.15, roughness: 0.2 }));
        top.add(at(pond, 2.2, R * 0.5, 0.01 * s));
        const fallM = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.7 });
        const fall = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 2.6 * s, 0.05 * s), fallM);
        at(fall, 2.2, R * 0.98, -1.3 * s);
        fall.rotation.y = -2.2 + Math.PI / 2;
        top.add(fall);
        anim.push((t) => { fallM.opacity = 0.55 + Math.sin(t * 6) * 0.12; });
        break;
      }
      case 'forest':
        ring(5, 0.6, 0.2).forEach(([a, d], i) => top.add(at(pine(s * (0.8 + (i % 3) * 0.2)), a, d * (0.4 + (i % 2) * 0.6))));
        break;
      case 'rocky':
        ring(4, 0.55, 0.1).forEach(([a, d], i) => top.add(at(rockLump(s * (1 + (i % 2) * 0.6), i % 2 ? '#8a8e97' : '#b4b8c0'), a, d)));
        top.add(at(tree(s * 0.8), 2.2, R * 0.2));
        break;
      case 'ice':
        ring(4, 0.5, 0.3).forEach(([a, d], i) => top.add(at(crystal(s, 0.5 + (i % 3) * 0.3), a, d)));
        break;
      case 'village':
        ring(3, 0.55, 0.5).forEach(([a, d], i) => {
          const h = house(s, ['#e05a47', '#3f7be0', '#f2b705'][i]);
          h.rotation.y = -a + Math.PI / 2;
          top.add(at(h, a, d));
        });
        top.add(at(tree(s), 4.2, R * 0.6));
        break;
      case 'rainy': {
        top.add(at(tree(s), 0.8, R * 0.3));
        top.add(at(tree(s * 0.8), 3.5, R * 0.5));
        const rc = raincloud(s, anim);
        rc.position.y = 2.4 * s;
        top.add(rc);
        break;
      }
      default:
        [0.6, 2.4].forEach((a, i) => top.add(at(tree(s * (0.8 + i * 0.15)), a, R * 0.72)));
    }
  }

  /* ---------- project buildings ---------- */
  const BUILD = {
    rocket(c, s, anim) {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * s, 0.7 * s, 0.12 * s, 16), flat('#9aa4b8'));
      pad.position.y = 0.06 * s;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 1.15 * s, 18), flat('#ffffff'));
      body.position.y = 0.95 * s;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 0.55 * s, 18), flat(c));
      nose.position.y = 1.8 * s;
      const win = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 12, 12), glowMat('#8fd0ff', '#8fd0ff', 1.6));
      win.position.set(0, 1.1 * s, 0.27 * s);
      g.add(pad, body, nose, win);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.4 * s, 0.32 * s), flat(c));
        const a = (i / 3) * Math.PI * 2;
        fin.position.set(Math.sin(a) * 0.32 * s, 0.5 * s, Math.cos(a) * 0.32 * s);
        fin.rotation.y = a;
        g.add(fin);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.4 * s, 10), new THREE.MeshBasicMaterial({ color: 0xff8a00 }));
      flame.rotation.x = Math.PI;
      flame.position.y = 0.3 * s;
      g.add(flame);
      anim.push((t) => { flame.scale.y = 0.8 + Math.abs(Math.sin(t * 18)) * 0.6; });
      return g;
    },
    shield(c, s, anim) {
      const g = new THREE.Group();
      const sh = new THREE.Shape();
      sh.moveTo(0, 1); sh.lineTo(0.8, 0.75); sh.lineTo(0.8, 0.1);
      sh.quadraticCurveTo(0.8, -0.6, 0, -1); sh.quadraticCurveTo(-0.8, -0.6, -0.8, 0.1); sh.lineTo(-0.8, 0.75); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
      geo.translate(0, 0, -0.125);
      const shield = new THREE.Mesh(geo, glowMat(c, c, 0.5));
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(new THREE.Vector3(-0.35, 0.02, 0), new THREE.Vector3(-0.08, -0.26, 0)));
      path.add(new THREE.LineCurve3(new THREE.Vector3(-0.08, -0.26, 0), new THREE.Vector3(0.4, 0.32, 0)));
      const tick = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.09, 8, false), glowMat('#ffffff', '#ffffff', 0.8));
      tick.position.z = 0.22;
      const badge = new THREE.Group();
      badge.add(shield, tick);
      badge.scale.setScalar(0.85 * s);
      badge.position.y = 1.25 * s;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 * s, 0.035 * s, 8, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1 * s;
      g.add(badge, ring);
      const wp = new THREE.Vector3();
      anim.push((t, dt, cam) => {
        badge.position.y = (1.25 + Math.sin(t * 1.6) * 0.08) * s;
        badge.getWorldPosition(wp);
        badge.lookAt(cam.position.x, wp.y, cam.position.z); // always show the check to the viewer
        const k = (t * 0.45) % 1;
        ring.scale.setScalar(0.6 + k * 0.9);
        ring.material.opacity = (1 - k) * 0.8;
      });
      return g;
    },
    tower(c, s, anim) {
      const g = new THREE.Group();
      ['#c7b8ff', '#9f88ff', c].forEach((cc, i) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry((1.0 - i * 0.12) * s, 0.38 * s, (0.8 - i * 0.08) * s), flat(cc));
        b.position.y = (0.22 + i * 0.44) * s;
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.07 * s, 0.02 * s), glowMat(i === 2 ? '#22c55e' : '#8fd0ff', i === 2 ? '#22c55e' : '#8fd0ff', 2));
        led.position.set(-0.1 * s, b.position.y, (0.41 - i * 0.04) * s);
        g.add(b, led);
        anim.push((t) => { b.scale.x = 1 + Math.max(0, Math.sin(t * 1.5 - i * 0.6)) * 0.06; });
      });
      return g;
    },
    gear(c, s, anim) {
      const g = new THREE.Group();
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.45 * s, 0.13 * s, 8, 24), flat(c)));
      for (let i = 0; i < 8; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.2 * s, 0.22 * s), flat(c));
        const a = (i / 8) * Math.PI * 2;
        tooth.position.set(Math.cos(a) * 0.62 * s, Math.sin(a) * 0.62 * s, 0);
        tooth.rotation.z = a;
        wheel.add(tooth);
      }
      wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.3 * s, 12).rotateX(Math.PI / 2), glowMat('#1d2340', '#2f9bff', 1.5)));
      wheel.position.set(-0.25 * s, 1.0 * s, 0);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.1 * s, 0.4 * s), flat('#1d2340'));
      belt.position.y = 0.12 * s;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.26 * s, 0.26 * s), glowMat('#ffd34d', '#ffb347', 0.6));
      crate.position.y = 0.3 * s;
      g.add(wheel, belt, crate);
      anim.push((t) => { wheel.rotation.z = -t * 1.2; crate.position.x = (((t * 0.35) % 1) - 0.5) * 1.3 * s; });
      return g;
    },
    observatory(c, s, anim) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.62 * s, 0.85 * s, 10), flat('#e8edf6'));
      base.position.y = 0.42 * s;
      const head = new THREE.Group();
      head.position.y = 0.85 * s;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), flat(c, { roughness: 0.5 }));
      const tilt = 0.9, len = 0.85 * s;
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, len, 10), glowMat('#1d2340', '#8fd0ff', 1.4));
      scope.rotation.z = -tilt;
      scope.position.set(Math.sin(tilt) * len * 0.35, 0.42 * s, 0);
      const bh = 6 * s, beamGeo = new THREE.ConeGeometry(1.3 * s, bh, 24, 1, true);
      beamGeo.translate(0, -bh / 2, 0); // apex at the telescope tip
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.rotation.z = Math.PI - tilt;
      beam.position.set(Math.sin(tilt) * len * 0.85, 0.42 * s + Math.cos(tilt) * len * 0.5, 0);
      beams.push(beam.material);
      head.add(dome, scope, beam);
      const logs = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.05 * s, 0.36 * s), i === 2 ? glowMat('#fff6d6', '#f2b705', 1.2) : flat('#ffffff'));
        sheet.position.y = (0.03 + i * 0.07) * s;
        sheet.rotation.y = i * 0.25;
        logs.add(sheet);
      }
      logs.position.set(-0.85 * s, 0, 0.35 * s);
      g.add(base, head, logs);
      anim.push((t) => { head.rotation.y = t * 0.35; });
      return g;
    },
    bridge(c, s) {
      const g = new THREE.Group();
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.6 * s, 0.08 * s, 8, 24, Math.PI), glowMat(c, c, 0.6));
      arch.position.set(-0.25 * s, 0.1 * s, 0);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.08 * s, 0.32 * s), flat('#1d2340'));
      deck.position.set(-0.25 * s, 0.12 * s, 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 1.1 * s, 6), flat('#1d2340'));
      pole.position.set(0.55 * s, 0.6 * s, -0.2 * s);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.24 * s, 0.03 * s), flat(c));
      flag.position.set(0.77 * s, 1.03 * s, -0.2 * s);
      const t = tree(s);
      t.position.set(0.55 * s, 0, 0.35 * s);
      g.add(arch, deck, pole, flag, t);
      return g;
    },
  };
  function makeIsland(p, s, anim) {
    const isl = new THREE.Group();
    const R = 1.55 * s, H = 0.4 * s;
    const climate = p.island.climate || 'meadow';
    isl.add(rockBase(s, R, H, climate));
    const top = new THREE.Group();
    top.position.y = H / 2;
    top.add(BUILD[p.island.b](p.color, s, anim));
    decorate(climate, s, R, top, anim, p.color);
    const lp = lantern(s, true);
    lp.position.set(Math.cos(4.2) * R * 0.75, 0, Math.sin(4.2) * R * 0.75);
    top.add(lp);
    isl.add(top);
    isl.rotation.y = p.planet.phase;
    return isl;
  }

  /* ---------- decorative islets around the edge ---------- */
  const islets = [];
  const ISLET_CLIMATES = solo ? ['forest', 'ice', 'village', 'rainy', 'rocky'] : ['forest', 'rocky', 'ice', 'village', 'rainy', 'tropical', 'forest', 'village', 'rocky'];
  ISLET_CLIMATES.forEach((climate, i) => {
    const s = rand(0.6, 1.05), R = 1.55 * s, H = 0.4 * s, anim = [];
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, climate));
    const top = new THREE.Group();
    top.position.y = H / 2;
    decorate(climate, s, R, top, anim, '#e05a47');
    if (i % 2 === 0 && climate !== 'rainy') { const l = lantern(s, false); l.position.set(R * 0.5, 0, -R * 0.3); top.add(l); }
    g.add(top);
    g.userData = { r: solo ? rand(16, 30) : rand(43, 60), a: (i / ISLET_CLIMATES.length) * Math.PI * 2 + rand(0, 0.5), y: rand(-6, 5), v: rand(0.006, 0.014), bob: rand(0, 6), anim };
    scene.add(g);
    islets.push(g);
  });

  /* ---------- birds by day ---------- */
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2b3350 });
  const birdBody = new THREE.BoxGeometry(0.12, 0.1, 0.42), birdWing = new THREE.BoxGeometry(0.62, 0.025, 0.22);
  const flocks = [];
  [[33, 13, 0.11, 0], [24, 16, -0.09, 2.5]].forEach(([r, y, v, a0]) => {
    const flock = new THREE.Group();
    const birds = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(birdBody, birdMat));
      const wl = new THREE.Group(), wr = new THREE.Group();
      const ml = new THREE.Mesh(birdWing, birdMat), mr = new THREE.Mesh(birdWing, birdMat);
      ml.position.x = -0.31; mr.position.x = 0.31;
      wl.add(ml); wr.add(mr);
      b.add(wl, wr);
      const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
      b.position.set(side * 0.9, Math.abs(side) * 0.1, Math.abs(side) * 0.9);
      b.userData = { wl, wr, ph: i * 0.7 };
      flock.add(b);
      birds.push(b);
    }
    flock.userData = { r, y, v, a: a0, birds };
    flock.scale.setScalar(0.7);
    scene.add(flock);
    flocks.push(flock);
  });

  /* ---------- fireflies by night ---------- */
  const FF = 160, ffBase = new Float32Array(FF * 3), ffPos = new Float32Array(FF * 3), ffPh = new Float32Array(FF);
  for (let i = 0; i < FF; i++) {
    const r = rand(5, 38), a = rand(0, 6.28);
    ffBase.set([Math.cos(a) * r, rand(-1, 6), Math.sin(a) * r], i * 3);
    ffPh[i] = rand(0, 6.28);
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({ color: 0xe4ff8a, size: 0.32, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  scene.add(fireflies);

  /* ---------- projects on their orbits ---------- */
  const ORBIT = (i) => 8 + i * 5.2;
  const bodies = {}, labels = {}, rings = [], packets = [];
  function addLabel(id, title, color, extraClass) {
    const l = document.createElement('div');
    l.className = 'plabel' + (extraClass ? ' ' + extraClass : '');
    l.style.setProperty('--c', color);
    l.innerHTML = '<i></i>' + title + '<b class="check" aria-hidden="true"></b>';
    l.addEventListener('click', () => onPick(id));
    l.addEventListener('pointerenter', () => { hovered = id; });
    l.addEventListener('pointerleave', () => { if (hovered === id) hovered = null; });
    labelsHost.appendChild(l);
    labels[id] = l;
  }
  projects.forEach((p, idx) => {
    const q = p.planet, orbit = solo ? 0 : ORBIT(idx), s = 1.5 * q.size, colHex = col(p.color).getHex();
    const ring = new THREE.Mesh(new THREE.RingGeometry(orbit - 0.05, orbit + 0.05, 200), new THREE.MeshBasicMaterial({ color: P.ring[0].clone(), side: THREE.DoubleSide, transparent: true, opacity: P.ringOp[0], fog: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2;
    if (!solo) scene.add(ring);
    rings.push(ring);

    const pm = new THREE.MeshStandardMaterial({ color: colHex, emissive: colHex, emissiveIntensity: 0.35, roughness: 0.4 });
    glows.push({ mat: pm, max: 1.4, min: 0.35 });
    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), pm);
    packet.userData = { orbit, a: q.phase + Math.PI * 0.9, v: q.speed * 2.4 };
    if (!solo) { scene.add(packet); packets.push(packet); }

    const g = new THREE.Group();
    const anim = [];
    const island = makeIsland(p, s, anim);
    g.add(island);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(s * 2.2, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4 * s;
    hit.userData.id = p.id;
    g.add(hit);
    scene.add(g);
    bodies[p.id] = { id: p.id, g, island, hit, anim, s, lift: s * 2.9 + 0.6, focus: 9 + s * 3.2, hover: 0,
      place(t, dt) { if (!reduced) this.angle += dt * q.speed * 0.6; this.g.position.set(Math.cos(this.angle) * orbit, Math.sin(t * 0.9 + idx * 1.3) * 0.3, Math.sin(this.angle) * orbit); },
      angle: q.phase };
    if (!solo) addLabel(p.id, p.title, p.color);
  });

  /* ---------- the "Say hi" balloon ---------- */
  if (!solo) {
    const s = 1.5, g = new THREE.Group(), balloon = new THREE.Group(), anim = [];
    const env = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 14, 12), flat('#ff5d6c', { roughness: 0.6 }));
    env.scale.y = 1.15;
    env.position.y = 2.7 * s;
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.21 * s, 0.09 * s, 6, 28), flat('#ffffff'));
    band.rotation.x = Math.PI / 2;
    band.position.y = 2.7 * s;
    const neck = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 0.9 * s, 14), flat('#ff5d6c'));
    neck.rotation.x = Math.PI;
    neck.position.y = 1.55 * s;
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.42 * s, 0.62 * s), flat('#a8743f'));
    basket.position.y = 0.2 * s;
    const burner = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 10, 10), glowMat('#ffd38a', '#ff9a3c', 3));
    burner.position.y = 0.95 * s;
    const light = new THREE.PointLight(0xff9a3c, 0, 10 * s, 1.6);
    light.position.y = 1.4 * s;
    lamps.push({ light, max: 18 });
    balloon.add(env, band, neck, basket, burner, light);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([x, z]) => {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.85 * s, 4), flat('#1d2340'));
      rope.position.set(x * 0.26 * s, 0.82 * s, z * 0.26 * s);
      balloon.add(rope);
    });
    g.add(balloon);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(2.6 * s, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.8 * s;
    hit.userData.id = 'contact';
    g.add(hit);
    scene.add(g);
    anim.push((t) => { balloon.rotation.z = Math.sin(t * 0.7) * 0.05; balloon.rotation.y = t * 0.15; burner.scale.setScalar(1 + Math.abs(Math.sin(t * 9)) * 0.25); });
    bodies.contact = { id: 'contact', g, island: balloon, hit, anim, s, lift: 5.2 * s * 0.75, focus: 16, hover: 0, angle: 2.9,
      place(t, dt) { if (!reduced) this.angle -= dt * 0.035; this.g.position.set(Math.cos(this.angle) * 29, 12 + Math.sin(t * 0.5) * 0.7, Math.sin(this.angle) * 29); } };
    addLabel('contact', 'Say hi', '#ff5d6c', 'contact');
  }

  /* ---------- fireworks for the full tour ---------- */
  const bursts = [];
  function burst(center, color) {
    const n = 90, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p.set([center.x, center.y, center.z], i * 3);
      const d = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 9));
      v.push(d);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const night = mix > 0.5;
    const mat = new THREE.PointsMaterial({ color: col(color), size: night ? 0.55 : 0.45, transparent: true, depthWrite: false, blending: night ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts, v, life: 0 });
  }

  /* ---------- day ↔ night blend ---------- */
  let mix = mode === 'night' ? 1 : 0;
  const tween = { from: mix, to: mix, start: 0, dur: 1800 };
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (pair, m) => pair[0] + (pair[1] - pair[0]) * m;
  let lit = 0, birdK = 1;
  function applyMix(m) {
    skyU.top.value.copy(P.top[0]).lerp(P.top[1], m);
    skyU.horizon.value.copy(P.horizon[0]).lerp(P.horizon[1], m);
    skyU.bottom.value.copy(P.bottom[0]).lerp(P.bottom[1], m);
    scene.fog.color.copy(P.fog[0]).lerp(P.fog[1], m);
    hemi.color.copy(P.hemiSky[0]).lerp(P.hemiSky[1], m);
    hemi.groundColor.copy(P.hemiGround[0]).lerp(P.hemiGround[1], m);
    hemi.intensity = lerp(P.hemi, m);
    dir.color.copy(P.dirColor[0]).lerp(P.dirColor[1], m);
    dir.intensity = lerp(P.dir, m);
    core.color.copy(P.core[0]).lerp(P.core[1], m);
    core.intensity = lerp(P.coreI, m);
    orbMat.color.copy(P.orb[0]).lerp(P.orb[1], m);
    halo.material.color.copy(P.halo[0]).lerp(P.halo[1], m);
    cloudMat.color.copy(P.cloud[0]).lerp(P.cloud[1], m);
    cloudMat.emissiveIntensity = lerp(P.cloudEm, m);
    cloudMat.opacity = lerp(P.cloudOp, m);
    seaMat.color.copy(P.sea[0]).lerp(P.sea[1], m);
    seaMat.emissiveIntensity = lerp(P.seaEm, m);
    seaMat.opacity = lerp(P.seaOp, m);
    starMat.opacity = sstep(0.3, 1, m);
    rings.forEach((r) => { r.material.color.copy(P.ring[0]).lerp(P.ring[1], m); r.material.opacity = lerp(P.ringOp, m); });
    lit = sstep(0.35, 0.9, m);
    glows.forEach((g) => { g.mat.emissiveIntensity = (g.min || 0) + (g.max - (g.min || 0)) * lit; });
    lamps.forEach((l) => { l.light.intensity = l.max * lit; });
    beams.forEach((b) => { b.opacity = 0.1 * lit; });
    ffMat.opacity = lit * 0.9;
    const birds = 1 - sstep(0, 0.6, m);
    birdK = birds;
    flocks.forEach((f) => { f.visible = birds > 0.01; });
  }
  applyMix(mix);

  /* ---------- camera rig ---------- */
  const FAR = 170;
  let HOME = 54;
  const rig = { yaw: -1.58, // opens looking through the widest gap between islands
    pitch: 0.95, dist: FAR, target: new THREE.Vector3(), off: 0, offY: 0, px: 0, py: 0 };
  const goal = { dist: HOME, follow: null };
  const tmp = new THREE.Vector3();
  let W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = solo ? 40 : W / H < 0.9 ? 64 : 50; // phones: wider lens and a step back so every island fits
    HOME = solo ? (W / H < 0.9 ? 20 : 15) : W / H < 0.9 ? 74 : 62;
    if (!goal.follow) goal.dist = HOME;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------- input: drag, zoom, hover, parallax, click ---------- */
  let down = null, moved = 0, hovered = null, touched = false;
  const mouse = { x: 0, y: 0 };
  const interact = () => { if (!touched) { touched = true; onInteract(); } };
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
  canvas.addEventListener('pointermove', (e) => {
    const rc = canvas.getBoundingClientRect();
    if (e.pointerType === 'mouse') { mouse.x = ((e.clientX - rc.left) / W) * 2 - 1; mouse.y = ((e.clientY - rc.top) / H) * 2 - 1; }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) interact();
      rig.yaw -= dx * 0.005;
      if (!solo) rig.pitch = Math.min(1.35, Math.max(0.1, rig.pitch + dy * 0.005));
      down = { x: e.clientX, y: e.clientY };
    } else {
      hovered = pick(e);
      canvas.classList.toggle('hover', !!hovered || !!pickCloud(e));
    }
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; mouse.x = mouse.y = 0; });
  const release = (e) => {
    canvas.classList.remove('drag');
    if (down && moved < 6 && e.type === 'pointerup') {
      const id = pick(e);
      if (id) onPick(id);
      else { const c = pickCloud(e); if (c && c.userData.poof < 0) c.userData.poof = 0; }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  if (!solo) canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    interact();
    const lim = goal.follow ? [8, 30] : [22, 100];
    goal.dist = Math.min(lim[1], Math.max(lim[0], goal.dist * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hits = () => Object.values(bodies).map((b) => b.hit);
  function cast(e) {
    const rc = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / W) * 2 - 1, -((e.clientY - rc.top) / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(e) {
    cast(e);
    const h = ray.intersectObjects(hits(), false);
    return h.length ? h[0].object.userData.id : null;
  }
  function pickCloud(e) {
    cast(e);
    const h = ray.intersectObjects(clouds, true);
    return h.length ? h[0].object.userData.cloud : null;
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let t = 0;
  let paused = false;
  function frame() {
    if (paused) { clock.getDelta(); requestAnimationFrame(frame); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
    t += dt;

    let bump = 0;
    if (tween.from !== tween.to) {
      const x = reduced ? 1 : Math.min(1, Math.max(0, (performance.now() - tween.start) / tween.dur));
      mix = tween.from + (tween.to - tween.from) * ease(x);
      bump = Math.sin(Math.PI * x);
      if (x >= 1) tween.from = tween.to;
      applyMix(mix);
    }

    for (const b of Object.values(bodies)) {
      b.place(t, dt);
      b.hover += ((hovered === b.id ? 1 : 0) - b.hover) * Math.min(1, dt * 10);
      b.island.scale.setScalar(1 + 0.07 * b.hover);
      b.g.position.y += 0.5 * b.hover;
      b.anim.forEach((fn) => fn(t, dt, camera));
      if (labels[b.id]) labels[b.id].classList.toggle('hot', hovered === b.id);
    }
    for (const pk of packets) {
      if (!reduced) pk.userData.a += dt * pk.userData.v;
      const a = pk.userData.a;
      pk.position.set(Math.cos(a) * pk.userData.orbit, -0.6 + Math.sin(t * 2 + a) * 0.15, Math.sin(a) * pk.userData.orbit);
      pk.rotation.set(t, t * 0.7, 0);
    }
    for (const c of clouds) {
      const u = c.userData;
      if (!reduced) u.a += dt * u.v;
      c.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.3 + u.r) * 0.4, Math.sin(u.a) * u.r);
      let ps = 1;
      if (u.poof >= 0) { // puff up, vanish, then slowly re-form
        u.poof += dt / 4;
        ps = u.poof < 0.08 ? 1 + u.poof * 6 : u.poof < 0.2 ? (1.48 * (0.2 - u.poof)) / 0.12 : sstep(0.35, 1, u.poof);
        if (u.poof >= 1) u.poof = -1;
      }
      c.scale.setScalar(Math.max(0.001, u.s * ps * sstep(14, 30, c.position.distanceTo(camera.position)))); // never fill the lens
    }
    sea.rotation.y += dt * 0.003;
    for (const g of islets) {
      const u = g.userData;
      if (!reduced) u.a += dt * u.v;
      g.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.6 + u.bob) * 0.4, Math.sin(u.a) * u.r);
      g.rotation.y = u.a * 2;
      u.anim.forEach((fn) => fn(t, dt));
    }
    for (const f of flocks) {
      if (!f.visible) continue;
      const u = f.userData;
      if (!reduced) u.a += dt * u.v;
      f.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.4 + u.r) * 1.2, Math.sin(u.a) * u.r);
      f.rotation.y = -u.a + (u.v > 0 ? Math.PI : 0); // face along the circle
      f.scale.setScalar(Math.max(0.001, 0.7 * birdK * sstep(16, 30, f.position.distanceTo(camera.position))));
      u.birds.forEach((b) => { const w = Math.sin(t * 9 + b.userData.ph) * 0.6; b.userData.wl.rotation.z = w; b.userData.wr.rotation.z = -w; });
    }
    if (lit > 0.01) {
      for (let i = 0; i < FF; i++) {
        const ph = ffPh[i];
        ffPos[i * 3] = ffBase[i * 3] + Math.sin(t * 0.7 + ph) * 0.8;
        ffPos[i * 3 + 1] = ffBase[i * 3 + 1] + Math.sin(t * 1.3 + ph * 2) * 0.5;
        ffPos[i * 3 + 2] = ffBase[i * 3 + 2] + Math.cos(t * 0.6 + ph) * 0.8;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ffMat.size = (solo ? 0.09 : 0.26) + Math.sin(t * 3) * (solo ? 0.02 : 0.06);
    }
    const mt = meteor.userData;
    if (mix > 0.8 && !reduced) {
      mt.next -= dt;
      if (mt.next <= 0 && mt.life >= 1) {
        const a = rand(0, 6.28);
        meteor.position.set(Math.cos(a) * 130, rand(55, 85), Math.sin(a) * 130);
        mt.v.set(-Math.sin(a), -0.35, Math.cos(a)).normalize().multiplyScalar(rand(70, 95));
        meteor.lookAt(tmp.copy(meteor.position).add(mt.v));
        mt.life = 0; mt.next = rand(4, 9);
      }
    }
    if (mt.life < 1) {
      mt.life += dt / 1.1;
      meteor.position.addScaledVector(mt.v, dt);
      meteor.material.opacity = Math.sin(Math.PI * Math.min(1, mt.life)) * 0.9 * sstep(0.8, 1, mix);
    } else meteor.material.opacity = 0;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const bu = bursts[i], arr = bu.pts.geometry.attributes.position.array;
      bu.life += dt / 1.8;
      bu.v.forEach((v, j) => { v.y -= 5 * dt; v.multiplyScalar(1 - dt * 0.8); arr[j * 3] += v.x * dt; arr[j * 3 + 1] += v.y * dt; arr[j * 3 + 2] += v.z * dt; });
      bu.pts.geometry.attributes.position.needsUpdate = true;
      bu.pts.material.opacity = 1 - bu.life;
      if (bu.life >= 1) { scene.remove(bu.pts); bu.pts.geometry.dispose(); bu.pts.material.dispose(); bursts.splice(i, 1); }
    }
    halo.material.opacity = 0.85 + Math.sin(t * 1.5) * 0.08;
    if (!reduced) stars.rotation.y += dt * 0.004;

    if (goal.follow) tmp.copy(bodies[goal.follow].g.position); else tmp.set(0, solo ? 1.4 : 0, 0);
    rig.target.lerp(tmp, k);
    rig.dist += (goal.dist * (1 + 0.12 * bump) - rig.dist) * k;
    const pitchGoal = solo ? 0.32 : goal.follow ? 0.38 : 0.6;
    if (!down) rig.pitch += (pitchGoal - rig.pitch) * k * 0.5;
    if (!goal.follow && !down && !reduced) rig.yaw += dt * (solo ? 0.12 : 0.025);
    const offGoal = goal.follow && W > 900 ? 210 : 0;
    rig.off += (offGoal - rig.off) * k;
    // keep the archipelago clear of the intro text: up on desktop (text bottom-left), down on phones (text on top)
    const offYGoal = goal.follow || solo ? 0 : (W / H < 0.9 ? -0.06 : 0.08) * H;
    rig.offY += (offYGoal - rig.offY) * k;
    camera.setViewOffset(W, H, rig.off, rig.offY, W, H);
    rig.px += ((reduced || down ? 0 : mouse.x) - rig.px) * Math.min(1, dt * 2.5); // gentle mouse parallax
    rig.py += ((reduced || down ? 0 : mouse.y) - rig.py) * Math.min(1, dt * 2.5);

    const yaw = rig.yaw - rig.px * 0.1, pitch = Math.min(1.35, Math.max(0.1, rig.pitch + rig.py * 0.05));
    const cp = Math.cos(pitch);
    camera.position.set(rig.target.x + Math.sin(yaw) * cp * rig.dist, rig.target.y + Math.sin(pitch) * rig.dist, rig.target.z + Math.cos(yaw) * cp * rig.dist);
    camera.lookAt(rig.target);
    camera.updateMatrixWorld();

    for (const b of Object.values(bodies)) {
      tmp.copy(b.g.position);
      tmp.y += b.lift;
      tmp.project(camera);
      const l = labels[b.id];
      if (!l) continue;
      l.style.visibility = tmp.z < 1 ? 'visible' : 'hidden';
      l.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * W) + 'px,' + ((-tmp.y * 0.5 + 0.5) * H - 10) + 'px) translate(-50%,-100%)';
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setMode(m) {
      const to = m === 'night' ? 1 : 0;
      if (to === tween.to && tween.from === tween.to) return;
      tween.from = mix; tween.to = to; tween.start = performance.now();
    },
    pause(p) { paused = !!p; },
    flyTo(id) {
      goal.follow = id && bodies[id] ? id : null;
      goal.dist = goal.follow ? bodies[id].focus : HOME;
    },
    setMarks(focused, seen) {
      for (const id in labels) {
        labels[id].classList.toggle('seen', seen.has(id));
        labels[id].classList.toggle('dim', !!focused && focused !== id);
      }
    },
    celebrate(colors) {
      if (reduced) return;
      colors.forEach((c, i) => setTimeout(() => {
        const a = rand(0, 6.28), r = rand(4, 22);
        burst(new THREE.Vector3(Math.cos(a) * r, rand(9, 16), Math.sin(a) * r), c);
      }, i * 260));
    },
  };
}
