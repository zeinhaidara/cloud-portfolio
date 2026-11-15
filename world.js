import * as THREE from './vendor/three.module.min.js';

// One continuous 3D world. The sun sits in the middle with the capital islands on their original orbits; ten climate
// zones form a ring around it. A zone is data (data/world.json): sky, fog, light, particles, flora, creatures. Every
// frame each zone gets a weight from the distance between the camera's focus point and the zone centre, and sky, fog,
// lights, cloud tint, particles and zone decor are blended by those weights, so flying between zones never cuts.
// Island, prop and building models are the original low-poly ones.
export function createWorld({ canvas, data, labels: labelEls, onPick = () => {}, onInteract = () => {}, onState = () => {}, onError = () => {} }) {
  performance.mark('world:start');
  const reducedQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQ.matches;
  const mobile = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
  const col = (c) => new THREE.Color(c);
  const rand = (a, b) => a + Math.random() * (b - a);
  const RING = data.ring;

  /* ---------- palette (the original day values) ---------- */
  const CP = { orb: col('#f6c453'), halo: col('#f0a64a'), core: col('#ffeccf'), sea: col('#e6eef6'), ring: col('#f4f8fc'), ringOp: 0.4 };
  const glows = []; // materials that light up where the air is dark: { mat, max, min }
  const lamps = []; // point lights that switch on with them: { light, max }
  const beams = []; // translucent light beams

  /* ---------- sky dome (three-stop gradient, colours are blended per frame) ---------- */
  const skyU = { top: { value: col('#5f97c9') }, horizon: { value: col('#c9dceb') }, bottom: { value: col('#8fb4d4') } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;\nvoid main(){ float h = normalize(vP).y;\n vec3 c = h > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.55, h)) : mix(horizon, bottom, smoothstep(0.0, -0.45, h));\n gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  }));
  dome.frustumCulled = false;
  scene.add(dome);
  scene.fog = new THREE.Fog(col('#bfd3e4'), 60, 240);

  /* ---------- light ---------- */
  const hemi = new THREE.HemisphereLight(col('#e2edf6'), col('#7f9f72'), 1.25);
  const dir = new THREE.DirectionalLight(col('#ffe9cf'), 1.15);
  dir.position.set(30, 60, 25);
  const core = new THREE.PointLight(CP.core.clone(), 3.2, 0, 0.5);
  scene.add(hemi, dir, core);

  /* ---------- the sun ---------- */
  const glowTex = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.4)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  const dotTex = glowTex();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 40, 40), new THREE.MeshBasicMaterial({ color: CP.orb.clone(), fog: false }));
  scene.add(orb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: CP.halo.clone(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(18, 18, 1);
  scene.add(halo);

  /* ---------- clouds you can poke, and a sea of clouds below ---------- */
  const cloudMat = new THREE.MeshStandardMaterial({ color: col('#f4f7fb'), emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clouds = [], cloudOf = [];
  const CLOUDS = mobile ? 26 : 44;
  let puffN = 0;
  for (let i = 0; i < CLOUDS; i++) {
    const n = 3 + (i % 3), puffs = [];
    for (let j = 0; j < n; j++) {
      const s = rand(1.2, 2.4);
      puffs.push(new THREE.Matrix4().compose(new THREE.Vector3((j - n / 2) * 1.6, Math.random() * 0.7, (Math.random() - 0.5) * 1.5), new THREE.Quaternion(), new THREE.Vector3(s * 1.3, s * 0.85, s)));
    }
    // the first eleven are the original clouds around the capital; the rest drift between and around the zones, never through one
    const inner = i < 11, low = i % 2 === 0;
    const userData = inner
      ? { r: low ? rand(8, 34) : rand(41, 52), a: (i / 11) * Math.PI * 2 + Math.random() * 0.4, y: low ? rand(-12, -8) : rand(3, 9), v: rand(0.008, 0.02), s: rand(0.8, 1.3), poof: -1 }
      : { r: i % 3 ? rand(64, RING.radius - RING.zoneRadius - 4) : rand(RING.radius + RING.zoneRadius + 4, RING.radius + RING.zoneRadius + 46), a: Math.random() * Math.PI * 2, y: low ? rand(-16, -9) : rand(7, 16), v: rand(0.002, 0.006), s: rand(1.1, 2.0), poof: -1 };
    const c = { userData, puffs, first: puffN, position: new THREE.Vector3() };
    puffs.forEach(() => cloudOf.push(c));
    puffN += n;
    clouds.push(c);
  }
  const cloudMesh = new THREE.InstancedMesh(puff, cloudMat, puffN);
  cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cloudMesh.frustumCulled = false;
  scene.add(cloudMesh);
  const seaMat = new THREE.MeshStandardMaterial({ color: CP.sea.clone(), emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 1, flatShading: true, transparent: true, opacity: 0.6 });
  const SEA = mobile ? 150 : 260, sea = new THREE.InstancedMesh(puff, seaMat, SEA);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  for (let i = 0; i < SEA; i++) {
    const r = Math.sqrt(Math.random()) * (RING.radius + 110), a = Math.random() * Math.PI * 2, w = rand(5, 9) * (r > 120 ? 1.25 : 1);
    m4.compose(v4.set(Math.cos(a) * r, rand(-48, -42), Math.sin(a) * r), q4.setFromAxisAngle(v4.clone().set(0, 1, 0), Math.random() * 6), s4.set(w, w * rand(0.18, 0.28), w * rand(0.7, 1)));
    sea.setMatrixAt(i, m4);
  }
  sea.frustumCulled = false;
  scene.add(sea);

  /* ---------- shared building blocks ---------- */
  const flatCache = new Map(); // plain colours share one material; anything with extra options (and so possibly animated) stays its own
  const flat = (color, extra) => {
    if (extra) return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, flatShading: true }, extra));
    const key = String(color);
    if (!flatCache.has(key)) flatCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }));
    return flatCache.get(key);
  };
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
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, blending: THREE.AdditiveBlending }));
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
  const ISLET_CLIMATES = ['forest', 'rocky', 'ice', 'village', 'rainy', 'tropical', 'forest', 'village', 'rocky'];
  ISLET_CLIMATES.forEach((climate, i) => {
    const s = rand(0.6, 1.05), R = 1.55 * s, H = 0.4 * s, anim = [];
    const g = new THREE.Group();
    g.add(rockBase(s, R, H, climate));
    const top = new THREE.Group();
    top.position.y = H / 2;
    decorate(climate, s, R, top, anim, '#e05a47');
    if (i % 2 === 0 && climate !== 'rainy') { const l = lantern(s, false); l.position.set(R * 0.5, 0, -R * 0.3); top.add(l); }
    g.add(top);
    g.userData = { r: rand(43, 60), a: (i / ISLET_CLIMATES.length) * Math.PI * 2 + rand(0, 0.5), y: rand(-6, 5), v: rand(0.006, 0.014), bob: rand(0, 6), anim };
    scene.add(g);
    islets.push(g);
  });


  /* ---------- a faint rainbow and paper planes by day ---------- */
  const bowMats = [];
  const bow = new THREE.Group();
  ['#e88a8a', '#e9b77a', '#e6d98a', '#9fd39a', '#8fb8e0', '#ab9ad8'].forEach((c, i) => {
    const m = new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true });
    bowMats.push(m);
    bow.add(new THREE.Mesh(new THREE.TorusGeometry(70 - i * 1.6, 0.8, 6, 64, Math.PI), m));
  });
  bow.position.set(88, -30, 18);
  bow.rotation.y = -Math.PI / 2 + 0.25;
  scene.add(bow);
  const planes = [];
  const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.7, -0.45, 0.05, -0.4, 0, -0.08, -0.4, 0, 0, 0.7, 0.45, 0.05, -0.4, 0, -0.08, -0.4], 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, paper));
    g.userData = { r: rand(18, 34), y: rand(4, 10), a: rand(0, 6.28), v: rand(0.12, 0.2) * (i % 2 ? -1 : 1), ph: rand(0, 6) };
    scene.add(g);
    planes.push(g);
  }

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

  bowMats.forEach((b) => { b.opacity = 0.24; });

  /* ---------- simple shared landmarks for the Code Clinic islands ---------- */
  const INK = '#1d2340';
  const bx = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? flat(c) : c); m.position.set(x, y, z); return m; };
  Object.assign(BUILD, {
    signpost(c, s) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 1.5 * s, 6), flat(INK));
      post.position.y = 0.75 * s;
      g.add(post);
      [['#ff8a1f', 1.36, 0.28], ['#12b981', 1.1, -0.26], ['#2f9bff', 0.84, 0.24], [c, 0.58, -0.2]].forEach(([cc, y, x]) => g.add(bx(0.62 * s, 0.2 * s, 0.05 * s, cc, x * s, y * s, 0.03 * s)));
      const h = house(s * 1.2, '#e05a47');
      h.position.set(-0.7 * s, 0, 0.25 * s);
      g.add(h);
      return g;
    },
    wheel(c, s) {
      const g = new THREE.Group(), w = new THREE.Group();
      g.add(bx(0.12 * s, 0.5 * s, 0.12 * s, '#8b5a2b', 0, 0.25 * s, 0));
      w.add(new THREE.Mesh(new THREE.TorusGeometry(0.46 * s, 0.07 * s, 6, 20), flat(c)));
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 1.3 * s, 5), flat('#a8743f')); sp.rotation.z = (i / 4) * Math.PI; w.add(sp); }
      w.add(new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 6), flat(INK)));
      w.position.y = 0.95 * s;
      g.add(w);
      return g;
    },
    terminal(c, s) {
      const g = new THREE.Group();
      g.add(bx(1.1 * s, 0.12 * s, 0.5 * s, '#9aa4b8', 0, 0.06 * s, 0), bx(0.16 * s, 0.16 * s, 0.1 * s, INK, 0, 0.2 * s, 0), bx(1.0 * s, 0.7 * s, 0.1 * s, '#e8edf6', 0, 0.62 * s, 0),
        bx(0.86 * s, 0.56 * s, 0.02 * s, '#2b3350', 0, 0.62 * s, 0.055 * s), bx(0.3 * s, 0.06 * s, 0.02 * s, c, -0.18 * s, 0.7 * s, 0.07 * s), bx(0.18 * s, 0.06 * s, 0.02 * s, '#ffffff', -0.24 * s, 0.56 * s, 0.07 * s));
      return g;
    },
    crate(c, s) {
      const g = new THREE.Group();
      [[c, -0.36, 0.15, 0], ['#2f9bff', 0.4, 0.15, 0.05], ['#ff8a1f', 0.02, 0.45, 0], ['#12b981', -0.08, 0.75, 0.02]].forEach(([cc, x, y, z], i) => g.add(bx((i === 3 ? 0.5 : 0.7) * s, 0.3 * s, 0.32 * s, cc, x * s, y * s, z * s)));
      return g;
    },
    beacon(c, s) {
      const g = new THREE.Group();
      g.add(bx(0.6 * s, 0.22 * s, 0.4 * s, '#9aa4b8', 0, 0.11 * s, 0));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.14 * s, 1.3 * s, 4), flat(INK));
      mast.position.y = 0.87 * s;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 10, 8), flat(c, { emissive: col(c), emissiveIntensity: 0.9 }));
      lamp.position.y = 1.58 * s;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.34 * s, 0.03 * s, 5, 12, Math.PI * 0.6), flat(c));
      arc.position.y = 1.58 * s; arc.rotation.z = Math.PI * 0.2;
      g.add(mast, lamp, arc);
      return g;
    },
    vault(c, s) {
      const g = new THREE.Group();
      g.add(bx(0.95 * s, 0.9 * s, 0.6 * s, '#9aa4b8', 0, 0.45 * s, 0));
      const door = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.08 * s, 14), flat(c));
      door.rotation.x = Math.PI / 2; door.position.set(0, 0.47 * s, 0.32 * s);
      g.add(door, bx(0.42 * s, 0.06 * s, 0.04 * s, '#ffffff', 0, 0.47 * s, 0.37 * s), bx(0.06 * s, 0.42 * s, 0.04 * s, '#ffffff', 0, 0.47 * s, 0.37 * s));
      return g;
    },
  });

  /* ---------- flora as instanced parts: unit geometries, shared materials, one InstancedMesh per part and zone ---------- */
  const UNIT = { cyl: new THREE.CylinderGeometry(1, 1, 1, 6), cone: new THREE.ConeGeometry(1, 1, 7), box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 8, 6), dod: new THREE.DodecahedronGeometry(1, 0), oct: new THREE.OctahedronGeometry(1, 0) };
  const MAT = { trunk: flat('#8b5a2b'), leaf: flat('#3fbf6f'), pineDark: flat('#2f8f5a'), white: flat('#ffffff'), bark: flat('#a87a4a'), coco: flat('#6b4a2b'), cactus: flat('#3f9f5a'), sand: flat('#c46a3a'), grey: flat('#9aa0ad'),
    lava: flat('#5a3a2e'), dune: flat('#e3b067'), crystal: flat('#bfe9ff', { emissive: col('#8fd0ff'), emissiveIntensity: 0.5 }), water: flat('#38b6ff', { emissive: col('#38b6ff'), emissiveIntensity: 0.15, roughness: 0.2 }) };
  const part = (geo, mat, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => ({ geo, mat, m: new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const FLORA = {
    tree: [part('cyl', 'trunk', 0, 0.17, 0, 0.07, 0.35, 0.07), part('cone', 'leaf', 0, 0.65, 0, 0.3, 0.7, 0.3)],
    pine: [part('cyl', 'trunk', 0, 0.17, 0, 0.07, 0.35, 0.07), part('cone', 'pineDark', 0, 0.65, 0, 0.3, 0.7, 0.3)],
    pineSnow: [part('cyl', 'trunk', 0, 0.17, 0, 0.07, 0.35, 0.07), part('cone', 'pineDark', 0, 0.65, 0, 0.3, 0.7, 0.3), part('cone', 'white', 0, 0.88, 0, 0.17, 0.3, 0.17)],
    palm: [...[0, 1, 2, 3].map((i) => part('cyl', 'bark', i * 0.035, 0.12 + i * 0.22, 0, 0.058, 0.24, 0.058, 0, 0, -0.12)),
      ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return part('box', 'leaf', 0.14 + Math.cos(a) * 0.2, 0.98, Math.sin(a) * 0.2, 0.48, 0.03, 0.13, 0, -a, -0.35); }), part('sph', 'coco', 0.14, 0.92, 0, 0.06, 0.06, 0.06)],
    cactus: [part('cyl', 'cactus', 0, 0.3, 0, 0.085, 0.6, 0.085), part('cyl', 'cactus', -0.13, 0.38, 0, 0.05, 0.22, 0.05), part('cyl', 'cactus', -0.08, 0.28, 0, 0.05, 0.12, 0.05, 0, 0, Math.PI / 2),
      part('cyl', 'cactus', 0.13, 0.48, 0, 0.05, 0.22, 0.05), part('cyl', 'cactus', 0.08, 0.38, 0, 0.05, 0.12, 0.05, 0, 0, Math.PI / 2)],
    rockSand: [part('dod', 'sand', 0, 0.08, 0, 0.2, 0.14, 0.22, 0.4, 0.8, 0)], rockGrey: [part('dod', 'grey', 0, 0.08, 0, 0.2, 0.14, 0.22, 0.4, 0.8, 0)], rockLava: [part('dod', 'lava', 0, 0.1, 0, 0.26, 0.18, 0.28, 0.4, 0.8, 0)],
    crystal: [part('oct', 'crystal', 0, 0.25, 0, 0.14, 0.3, 0.14)], drift: [part('sph', 'white', 0, 0.02, 0, 0.42, 0.1, 0.32)], dune: [part('sph', 'dune', 0, 0.02, 0, 0.52, 0.11, 0.36)], pond: [part('cyl', 'water', 0, 0.02, 0, 0.42, 0.03, 0.42)],
  };
  function instancer(parent) {
    const lists = new Map(), tmp = new THREE.Matrix4();
    return {
      add(kind, matrix) { for (const p of FLORA[kind] || []) { const k = p.geo + '|' + p.mat; if (!lists.has(k)) lists.set(k, []); lists.get(k).push(tmp.multiplyMatrices(matrix, p.m).clone()); } },
      flush() {
        const made = [];
        for (const [k, arr] of lists) {
          const [g, m] = k.split('|'), mesh = new THREE.InstancedMesh(UNIT[g], MAT[m], arr.length);
          arr.forEach((mx, i) => mesh.setMatrixAt(i, mx));
          mesh.computeBoundingSphere();
          parent.add(mesh);
          made.push(mesh);
        }
        lists.clear();
        return made;
      },
    };
  }

  /* ---------- bake a static model into one mesh with vertex colours (one draw call per island) ---------- */
  const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
  const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, transparent: true, opacity: 0.42, depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0.22 });
  function bake(group, material = bakedMat, shade = true) {
    group.updateMatrixWorld(true);
    const P3 = [], C3 = [];
    group.traverse((o) => {
      if (!o.isMesh || (o.material.transparent && o.material.opacity < 0.5 && o.material !== material) || o.material.visible === false) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const a = g.attributes.position.array, c = o.material.color, colors = o.material.vertexColors && g.attributes.color;
      for (let i = 0; i < a.length; i += 3) {
        P3.push(a[i], a[i + 1], a[i + 2]);
        const v = i / 3;
        C3.push(c.r * (colors ? colors.getX(v) : 1), c.g * (colors ? colors.getY(v) : 1), c.b * (colors ? colors.getZ(v) : 1));
      }
      g.dispose();
    });
    if (shade && P3.length) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 1; i < P3.length; i += 3) { if (P3[i] < lo) lo = P3[i]; if (P3[i] > hi) hi = P3[i]; }
      const span = hi - lo || 1;
      for (let i = 0; i < P3.length; i += 3) { const k = 0.8 + 0.2 * Math.sqrt((P3[i + 1] - lo) / span); C3[i] *= k; C3[i + 1] *= k; C3[i + 2] *= k; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, material);
  }
  // models built only to be baked must not stay in the glow/lamp lists
  function baked(fn, material) { const g0 = glows.length, l0 = lamps.length, b0 = beams.length, m = bake(fn(), material); glows.length = g0; lamps.length = l0; beams.length = b0; return m; }
  // the decorative islets without moving parts become one mesh each
  for (const g of islets) if (!g.userData.anim.length) { const m = bake(g); g.clear(); g.add(m); }

  /* ---------- the capital: projects on their original orbits ---------- */
  const ORBIT = (i) => 8 + i * 5.2;
  const capitalLod = [];
  let capitalFar = false;
  const bodies = {}, rings = [], packets = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  data.islands.filter((p) => p.orbit != null).sort((a, b) => a.orbit - b.orbit).forEach((p) => {
    const idx = p.orbit, orbit = ORBIT(idx), s = 1.5 * p.size, colHex = col(p.color).getHex();
    const ring = new THREE.Mesh(new THREE.RingGeometry(orbit - 0.05, orbit + 0.05, 200), new THREE.MeshBasicMaterial({ color: CP.ring.clone(), side: THREE.DoubleSide, transparent: true, forceSinglePass: true, opacity: CP.ringOp, fog: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2;
    scene.add(ring);
    rings.push(ring);
    const pm = new THREE.MeshStandardMaterial({ color: colHex, emissive: colHex, emissiveIntensity: 0.35, roughness: 0.4 });
    glows.push({ mat: pm, max: 1.4, min: 0.35 });
    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), pm);
    packet.userData = { orbit, a: p.phase + Math.PI * 0.9, v: p.speed * 2.4 };
    scene.add(packet);
    packets.push(packet);
    const g = new THREE.Group(), anim = [];
    const island = makeIsland({ color: p.color, island: { b: p.building, climate: p.ground }, planet: { phase: p.phase } }, s, anim);
    const rock = island.children[0];
    island.remove(rock);
    island.add(bake(rock));
    const top = island.children[0], still = new THREE.Group();
    for (const c of top.children.slice(1)) { // children[0] is the project's landmark
      let live = false;
      c.traverse((o) => { if (o.isLight || (o.isMesh && (o.material.transparent || o.material.emissiveIntensity > 0.5))) live = true; });
      if (!live) still.add(c);
    }
    if (still.children.length) top.add(bake(still));
    const farCopy = bake(island, bakedMat, false); // same silhouette and colours in one draw call
    farCopy.visible = false;
    g.add(island, farCopy);
    capitalLod.push({ g, near: island, far: farCopy });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(s * 2.2, 12, 12), hitMat);
    hit.position.y = 0.4 * s;
    hit.userData.id = p.name;
    g.add(hit);
    scene.add(g);
    bodies[p.name] = { id: p.name, zone: 'capital', g, island, hit, anim, s, lift: s * 2.9 + 0.6, focus: 9 + s * 3.2, hover: 0, angle: p.phase,
      place(t, dt) { this.angle += dt * p.speed * 0.6; this.g.position.set(Math.cos(this.angle) * orbit, Math.sin(t * 0.9 + idx * 1.3) * 0.3, Math.sin(this.angle) * orbit); },
      pos(v) { return v.copy(this.g.position); } };
  });

  /* ---------- the "Say hi" balloon ---------- */
  const hi = data.islands.find((p) => p.building === 'balloon');
  if (hi) {
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
    const hit = new THREE.Mesh(new THREE.SphereGeometry(2.6 * s, 12, 12), hitMat);
    hit.position.y = 1.8 * s;
    hit.userData.id = hi.name;
    g.add(hit);
    scene.add(g);
    anim.push((t) => { balloon.rotation.z = Math.sin(t * 0.7) * 0.05; balloon.rotation.y = t * 0.15; burner.scale.setScalar(1 + Math.abs(Math.sin(t * 9)) * 0.25); });
    const farBalloon = bake(balloon, bakedMat, false);
    farBalloon.visible = false;
    g.add(farBalloon);
    capitalLod.push({ g, near: balloon, far: farBalloon });
    bodies[hi.name] = { id: hi.name, zone: 'capital', g, island: balloon, hit, anim, s, lift: 5.2 * s * 0.75, focus: 16, hover: 0, angle: 2.9,
      place(t, dt) { this.angle -= dt * 0.035; this.g.position.set(Math.cos(this.angle) * 29, 12 + Math.sin(t * 0.5) * 0.7, Math.sin(this.angle) * 29); },
      pos(v) { return v.copy(this.g.position); } };
  }

  for (const l of lamps) l.light.visible = false; // daylight needs no lamp lights; retain them for darker local weather

  /* ---------- zones: data in, scene out ---------- */
  const PARTICLE = { // velocity model per particle type: [vy base, vy spread, vx drift, wobble, opacity, lines?]
    snow: [-1.1, -1.3, 0.3, 0.7, 0.95], motes: [0.25, 0.4, 0.15, 0.5, 0.8], heat: [1.0, 1.8, 0.2, 0.6, 0.55], dust: [0.08, 0.1, 0.5, 0.3, 0.5], ember: [1.0, 1.8, 0.2, 0.9, 0.95],
    rain: [-20, -10, 3, 0, 0.55, 1], gust: [0, 0.8, 22, 0, 0.35, 1],
  };
  const zones = {}, zoneList = [];
  const mxA = new THREE.Matrix4(), mxB = new THREE.Matrix4(), qA = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  for (const zc of data.zones) {
    const A = zc.air;
    const z = { id: zc.id, cfg: zc, center: new THREE.Vector3(zc.x, 0, zc.z), r: zc.r, w: 0, raw: 0, appear: 0, decor: null, decorState: A.decor ? 0 : 3, parts: null,
      c: { top: col(zc.sky[0]), hor: col(zc.sky[1]), bot: col(zc.sky[2]), fog: col(A.fog[0]), near: A.fog[1], far: A.fog[2], hemiSky: col(A.hemi[0]), hemiGround: col(A.hemi[1]), hemiI: A.hemi[2], sun: col(A.sun[0]), sunI: A.sun[1], cloud: col(A.cloud), lit: A.lit } };
    zones[zc.id] = z;
    zoneList.push(z);
  }
  function makeParticles(z, config) {
    if (config && PARTICLE[config.type]) {
      const n = Math.round(config.count * (mobile ? 0.5 : 1)), lines = !!PARTICLE[config.type][5];
      const arr = new Float32Array(n * (lines ? 6 : 3)), off = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()); off[i * 3] = Math.cos(a) * d; off[i * 3 + 1] = rand(-1, 1); off[i * 3 + 2] = Math.sin(a) * d; seed[i] = Math.random(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3).setUsage(THREE.DynamicDrawUsage));
      const mat = lines ? new THREE.LineBasicMaterial({ color: col(config.color), transparent: true, opacity: 0, depthWrite: false })
        : new THREE.PointsMaterial({ map: dotTex, color: col(config.color), size: config.size || 0.3, transparent: true, opacity: 0, depthWrite: false });
      const obj = lines ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
      obj.frustumCulled = false;
      obj.visible = false;
      scene.add(obj);
      const bounds = new THREE.Sphere(new THREE.Vector3(z.center.x, 5, z.center.z), Math.hypot(z.r * 1.15 + 8, 16));
      z.parts = { n, arr, off, seed, geo, mat, obj, lines, bounds, k: PARTICLE[config.type], size: config.size || 0.3 };
    }
  }
  /* The weather-and-terrain sphere of a zone: what makes it readable from the capital. All of it is data
     (air.sphere in data/world.json) and shared geometry; nothing here is a hard shell.
       haze    two soft camera-facing glows in the zone's haze colour (not fogged, so they keep their colour far away)
       canopy  a low-poly cloud formation: 'cap' over the zone, 'column' of smoke, 'ring' of cloud below a summit
       terrain one large baked landform with a few big props, for zones without their own decor module */
  const WHITE = new THREE.Color(1, 1, 1);
  function buildSphere(z) {
    const S = z.cfg.air.sphere;
    if (!S) return;
    z.sphere = { haze: [], canopy: null, base: S.strength || 0.5 };
    if (S.haze) {
      [[z.r * 3.1, 3, 0.55], [z.r * 1.9, 9, 0.9]].forEach(([size, y, k]) => {
        const mat = new THREE.SpriteMaterial({ map: dotTex, color: col(S.haze).lerp(WHITE, k > 0.8 ? 0.4 : 0), transparent: true, opacity: 0, depthWrite: false, fog: false });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(size, size * 0.72, 1);
        sp.position.y = y;
        sp.renderOrder = 1;
        sp.userData.k = k;
        z.group.add(sp);
        z.sphere.haze.push(sp);
      });
    }
    if (S.canopy) {
      const [shape, color, count] = S.canopy, n = mobile ? Math.ceil(count * 0.6) : count;
      const mat = new THREE.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: 0.25, roughness: 1, flatShading: true, transparent: true, opacity: 0.92, fog: false });
      const mesh = new THREE.InstancedMesh(puff, mat, n);
      for (let i = 0; i < n; i++) {
        const a = i * 2.4, d = 0.4 + 0.45 * ((i * 0.618) % 1), w = z.r * (0.1 + ((i * 7) % 5) * 0.02); // caps are a broken ring of cloud, so the landform stays visible from above
        if (shape === 'column') vA.set(Math.cos(a) * (1.5 + i * 0.5), 6 + i * 2.6, Math.sin(a) * (1.5 + i * 0.5)), vB.set(1, 0.8, 1).multiplyScalar(1.5 + i * 0.42);
        else if (shape === 'ring') vA.set(Math.cos((i / n) * 6.283) * z.r * 0.42, -5 - (i % 3), Math.sin((i / n) * 6.283) * z.r * 0.42), vB.set(w * 1.5, w * 0.36, w * 1.1);
        else vA.set(Math.cos(a) * d * z.r, 14 + ((i * 5) % 4), Math.sin(a) * d * z.r), vB.set(w * 1.5, w * 0.4, w * 1.1); // 'cap'
        mesh.setMatrixAt(i, mxA.compose(vA, qA.setFromAxisAngle(UP, a), vB));
      }
      mesh.computeBoundingSphere();
      z.group.add(mesh);
      z.sphere.canopy = mesh;
      z.sphere.fadeNear = shape === 'cap';
    }
    const T = S.terrain;
    if (T) {
      const s = T.scale || 4, R = 1.55 * s, H = 0.4 * s;
      const land = baked(() => {
        const g = new THREE.Group();
        g.add(rockBase(s, R, H, T.ground || z.cfg.ground));
        for (const [shape, color, x, zz, w, h] of T.shapes || []) {
          const m = new THREE.Mesh(UNIT[shape === 'box' ? 'box' : shape === 'disc' ? 'cyl' : 'cone'], flat(color));
          m.scale.set(w, h, shape === 'cone' ? w : w * (shape === 'disc' ? 1 : 0.8));
          m.position.set(x * R, H / 2 + h / 2, zz * R);
          m.rotation.y = x * 3;
          g.add(m);
        }
        (T.flora || []).forEach(([kind, count, size]) => {
          for (let i = 0; i < count; i++) {
            const a = i * 2.4 + kind.length, d = R * (0.3 + 0.5 * ((i * 0.37 + kind.length * 0.13) % 1));
            mxA.compose(vA.set(Math.cos(a) * d, H / 2, Math.sin(a) * d), qA.setFromAxisAngle(UP, a * 2), vB.set(size, size, size));
            for (const p of FLORA[kind] || []) { const m = new THREE.Mesh(UNIT[p.geo], MAT[p.mat]); m.applyMatrix4(mxB.multiplyMatrices(mxA, p.m)); g.add(m); }
          }
        });
        return g;
      });
      land.position.y = -0.8;
      z.big.add(land);
    }
  }
  function populate(z) {
    if (!z || z.group || z.id === 'capital') return;
    const zc = z.cfg, A = zc.air;
    z.group = new THREE.Group();
    z.group.position.copy(z.center);
    z.spin = new THREE.Group();
    z.group.add(z.spin);
    z.big = new THREE.Group();
    z.group.add(z.big);
    z.solid = [];
    scene.add(z.group);
    const mine = data.islands.filter((p) => p.zone === zc.id && p.orbit == null && p.building !== 'balloon');
    const ghosts = data.uncharted.filter((u) => u.zone === zc.id);
    const slots = zc.range ? 5 : mine.length, orbitR = slots > 1 ? (zc.range ? RING.islandOrbit : 6) : 0;
    z.orbitR = orbitR;
    if (orbitR) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(orbitR - 0.05, orbitR + 0.05, 120), new THREE.MeshBasicMaterial({ color: CP.ring.clone(), side: THREE.DoubleSide, transparent: true, forceSinglePass: true, opacity: CP.ringOp, fog: false }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.2;
      z.group.add(ring);
      z.ring = ring;
    }
    const inst = instancer(z.spin), s = 1.2, R = 1.55 * s, H = 0.4 * s;
    const slotPos = (i) => { const a = -Math.PI / 2 + (i / Math.max(1, slots)) * Math.PI * 2; return vA.set(Math.cos(a) * orbitR, Math.sin(i * 2.1) * 0.5, Math.sin(a) * orbitR).clone(); };
    mine.forEach((p, k) => {
      const i = p.slot != null ? p.slot : k, at0 = slotPos(i), rot = (p.name.length * 1.7 + i) % 6.28;
      const mesh = baked(() => { const g = new THREE.Group(); g.add(rockBase(s, R, H, p.ground)); const top = new THREE.Group(); top.position.y = H / 2; top.add((BUILD[p.building] || BUILD.tower)(p.color, s * 0.9, []));
        const lp = lantern(s, false); lp.position.set(Math.cos(4.2) * R * 0.75, 0, Math.sin(4.2) * R * 0.75); top.add(lp); g.add(top); return g; });
      mesh.position.copy(at0);
      mesh.rotation.y = rot;
      z.spin.add(mesh);
      z.solid.push(mesh);
      (A.flora || []).forEach((kind, f, all) => {
        const a = 0.6 + (f / all.length) * Math.PI * 2 + i, d = R * (kind === 'pond' ? 0.45 : 0.74), sc = s * (0.85 + ((i * 7 + f * 3) % 5) * 0.07);
        mxA.compose(at0, qA.setFromAxisAngle(UP, rot), vB.set(1, 1, 1));
        mxB.compose(vA.set(Math.cos(a) * d, H / 2, Math.sin(a) * d), qA.setFromAxisAngle(UP, a * 3), vB.set(sc, sc, sc));
        inst.add(kind, mxA.multiply(mxB));
      });
      const hit = new THREE.Mesh(new THREE.SphereGeometry(s * 2.2, 10, 10), hitMat);
      hit.position.copy(at0); hit.position.y += 0.4 * s;
      hit.userData.id = p.name;
      z.spin.add(hit);
      bodies[p.name] = { id: p.name, zone: zc.id, g: mesh, island: mesh, hit, anim: [], s, lift: s * 2.6 + 0.6, focus: 9 + s * 3.2, hover: 0, pos(v) { return mesh.getWorldPosition(v); } };
    });
    if (z.solid.length > 1) {
      // Same geometry, colours and orbiting transform; one opaque draw call in the existing far tier.
      z.farSolid = bake(new THREE.Group().add(...z.solid.map((mesh) => mesh.clone())), bakedMat, false);
      z.farSolid.visible = false;
      z.spin.add(z.farSolid);
    }
    z.ghosts = ghosts.map((u) => {
      const at0 = slotPos(u.slot);
      const mesh = baked(() => { const g = new THREE.Group(); g.add(rockBase(s * 0.85, R * 0.85, H * 0.85, 'rocky')); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.9 * s, 4), flat('#ffffff')); f.position.y = 0.6 * s; g.add(f, bx(0.34 * s, 0.2 * s, 0.02 * s, '#ffffff', 0.18 * s, 0.94 * s, 0)); return g; }, ghostMat);
      mesh.position.copy(at0);
      mesh.renderOrder = 2;
      z.spin.add(mesh);
      return { n: u.n, mesh };
    });
    if (z.ghosts.length > 1) {
      z.farGhost = bake(new THREE.Group().add(...z.ghosts.map((g) => g.mesh.clone())), ghostMat, false);
      z.farGhost.visible = false;
      z.farGhost.renderOrder = 2;
      z.spin.add(z.farGhost);
    }
    z.flora = inst.flush(); // small island props: hidden in the far tier
    makeParticles(z, A.particles);
    buildSphere(z);
    for (const p of mine) { addLabel(labelEls.islands[p.name], 'island', bodies[p.name]); hitList.push(bodies[p.name].hit); bodyList.push(bodies[p.name]); }
    for (const g of z.ghosts) addLabel(labelEls.ghosts[g.n], 'ghost', { zone: z.id, mesh: g.mesh });
    // everything placed so far keeps its local transform: no per-frame matrix recomposition (the zone, its spin and its large-feature group still move)
    z.group.traverse((o) => { if (o !== z.group && o !== z.spin && o !== z.big) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
    invalidate();
  }
  const pending = zoneList.filter((z) => z.id !== 'capital');
  const zoneOfIsland = Object.fromEntries(data.islands.map((p) => [p.name, p.zone]));
  const BASE = Object.fromEntries(Object.entries(zones.capital.c).map(([k, v]) => [k, v.clone ? v.clone() : v]));
  // zone decor (centrepiece, creatures, special effects) lives in small modules that load on demand
  const api = { THREE, scene, flat, glowMat, col, rand, bake, baked, bakedMat, rockBase, tree, pine, palm, cactus, rockLump, house, crystal, lantern, UNIT, MAT, mobile, get reduced() { return reduced; } };
  let idleDone = false;
  function loadDecor(z) {
    if (z.decorState !== 0 || !z.group) return;
    z.decorState = 1;
    import(`./zones/${z.cfg.air.decor}.js`).then((m) => { z.decor = m.default(api, z); z.decorState = 2; invalidate(); }).catch((error) => {
      z.decorState = 3;
      console.error(`Could not load scenery for ${z.cfg.name}`, error);
      onError(z.cfg.name);
    });
  }
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
  idle(() => { idleDone = true; invalidate(); }); // decor modules load after first paint; a zone the camera reaches earlier loads at once

  /* ---------- fireworks for the full tour ---------- */
  const bursts = [];
  function burst(center, color) {
    const n = 90, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p.set([center.x, center.y, center.z], i * 3); v.push(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 9))); }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col(color), size: 0.45, transparent: true, depthWrite: false }));
    scene.add(pts);
    bursts.push({ pts, v, life: 0 });
  }

  /* ---------- camera rig: the original orbiting camera, with glides between places ---------- */
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let HOME = 62, ZONE = 54, OVER = 420, W = 1, H = 1;
  const rig = { yaw: -1.58, pitch: 0.95, dist: 170, target: new THREE.Vector3(), off: 0, offY: 0, px: 0, py: 0 };
  const goal = { dist: HOME, follow: null, zone: 'capital', point: null, pitch: 0.6, over: false };
  let flight = null, dirty = true, panelOpen = false, t = 0, compiled = false;
  const tmp = new THREE.Vector3(), dest = new THREE.Vector3();
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    const tall = W / H < 0.9;
    camera.aspect = W / H;
    camera.fov = tall ? 64 : 50; // phones: wider lens and a step back so every island fits
    HOME = tall ? 74 : 62; ZONE = tall ? 66 : 54; OVER = tall ? 620 : 420;
    if (tall) {
      const halfFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      const extent = Math.max(RING.radius + RING.zoneRadius * 2.5, RING.archive.radius + RING.archive.zoneRadius * 2.5);
      OVER = Math.max(OVER, extent * 1.15 / Math.sin(halfFov));
    }
    if (!goal.follow) goal.dist = goal.over ? OVER : goal.zone === 'capital' ? HOME : ZONE;
    camera.updateProjectionMatrix();
    invalidate();
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();
  function destination(v) {
    if (goal.follow && bodies[goal.follow]) return bodies[goal.follow].pos(v);
    if (goal.point) return v.copy(goal.point);
    if (goal.zone && zones[goal.zone] && !goal.over) return v.copy(zones[goal.zone].center);
    return v.set(0, 0, 0);
  }
  function glide() {
    destination(dest);
    const d = dest.distanceTo(rig.target);
    flight = reduced ? null : { t0: performance.now(), ms: 700 + Math.min(1500, d * 7), from: rig.target.clone(), fromDist: rig.dist, bump: Math.min(0.9, d / 260) };
    if (reduced) { rig.target.copy(dest); rig.dist = goal.dist; rig.pitch = goal.pitch; }
    invalidate();
  }

  /* ---------- input: drag to orbit, wheel or pinch to zoom, hover, click ---------- */
  const pts = new Map();
  let down = null, moved = 0, hovered = null, touched = false, pinch = 0;
  const mouse = { x: 0, y: 0 };
  const interact = () => { if (!touched) { touched = true; onInteract(); } };
  const zoomTo = (d) => { goal.dist = Math.min(OVER * 1.15, Math.max(8, d)); goal.over = goal.dist > 230; flight = null; invalidate(); };
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { down = { x: e.clientX, y: e.clientY }; moved = 0; }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); down = null; moved = 99; }
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    const rc = canvas.getBoundingClientRect();
    if (e.pointerType === 'mouse') { mouse.x = ((e.clientX - rc.left) / W) * 2 - 1; mouse.y = ((e.clientY - rc.top) / H) * 2 - 1; }
    const p = pts.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (p && pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) { interact(); zoomTo(goal.dist * (pinch / d)); pinch = d; }
      return;
    }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) interact();
      rig.yaw -= dx * 0.005;
      rig.pitch = Math.min(1.35, Math.max(0.1, rig.pitch + dy * 0.005));
      down = { x: e.clientX, y: e.clientY };
      invalidate();
    } else {
      const h = pick(e);
      if (h !== hovered) { hovered = h; invalidate(); }
      canvas.classList.toggle('hover', !!hovered || !!pickCloud(e));
    }
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; mouse.x = mouse.y = 0; invalidate(); });
  const release = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (pts.size) { const p = pts.values().next().value; down = { x: p.x, y: p.y }; moved = 99; return; }
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
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); interact(); zoomTo(goal.dist * (1 + Math.sign(e.deltaY) * (e.ctrlKey ? 0.04 : 0.09))); }, { passive: false });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const bodyList = Object.values(bodies), hitList = bodyList.map((b) => b.hit);
  function cast(e) {
    const rc = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / W) * 2 - 1, -((e.clientY - rc.top) / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(e) { cast(e); const h = ray.intersectObjects(hitList, false); return h.length ? h[0].object.userData.id : null; }
  function pickCloud(e) { if (rig.dist > 160) return null; cast(e); const h = ray.intersectObject(cloudMesh, false); return h.length ? cloudOf[h[0].instanceId] : null; }

  /* ---------- blending: one sky for the whole world, mixed from the zones near the focus point ---------- */
  const acc = { top: new THREE.Color(), hor: new THREE.Color(), bot: new THREE.Color(), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color(), cloud: new THREE.Color() };
  const COLS = Object.keys(acc), NUMS = ['near', 'far', 'hemiI', 'sunI', 'lit'], num = {};
  let over = 0, lit = 0;
  function blend() {
    over = sstep(130, 280, rig.dist); // far out, the sky returns to the neutral base
    let sum = 0;
    for (const z of zoneList) { z.raw = 1 - sstep(z.r * 0.75, z.r * 2.3, Math.hypot(rig.target.x - z.center.x, rig.target.z - z.center.z)); sum += z.raw; }
    const norm = (sum > 1 ? 1 / sum : 1) * (1 - over);
    let used = 0;
    for (const k of COLS) acc[k].setRGB(0, 0, 0);
    for (const k of NUMS) num[k] = 0;
    const add = (c, w) => { for (const k of COLS) { acc[k].r += c[k].r * w; acc[k].g += c[k].g * w; acc[k].b += c[k].b * w; } for (const k of NUMS) num[k] += c[k] * w; };
    for (const z of zoneList) { z.w = z.raw * norm; if (z.w > 0.0005) { add(z.c, z.w); used += z.w; } }
    if (used < 1) add(BASE, 1 - used);
    skyU.top.value.copy(acc.top); skyU.horizon.value.copy(acc.hor); skyU.bottom.value.copy(acc.bot);
    const reach = Math.max(1, rig.dist / 62); // fog keeps its look at any zoom
    scene.fog.color.copy(acc.fog); scene.fog.near = num.near * reach; scene.fog.far = num.far * reach;
    hemi.color.copy(acc.hemiSky); hemi.groundColor.copy(acc.hemiGround); hemi.intensity = num.hemiI;
    dir.color.copy(acc.sun); dir.intensity = num.sunI;
    cloudMat.color.copy(acc.cloud); cloudMat.opacity = 0.95 - 0.5 * num.lit;
    seaMat.color.copy(acc.cloud).lerp(CP.sea, 0.3); seaMat.opacity = 0.6 - 0.4 * over;
    lit = num.lit;
    for (const mat of bowMats) mat.opacity = 0.24 * (1 - lit);
    for (const g of glows) g.mat.emissiveIntensity = (g.min || 0) + (g.max - (g.min || 0)) * lit;
    for (const l of lamps) { l.light.visible = lit > 0.001; l.light.intensity = l.max * lit; }
    for (const b of beams) b.opacity = 0.1 * lit;
  }

  const view = new THREE.Frustum(), viewMatrix = new THREE.Matrix4(), isletBounds = new THREE.Sphere(new THREE.Vector3(), 8);
  function stepParticles(z, dt, camDist) {
    const fade = 1 - sstep(360, 420, camDist), p = z.parts;
    const on = !reduced && fade > 0.001 && view.intersectsSphere(p.bounds);
    p.obj.visible = on;
    if (!on) return;
    const [vy0, vy1, vx0, wob, op] = p.k, B = z.r * 1.15, Bh = 15, cx = z.center.x, cz = z.center.z, cy = 5;
    const detail = sstep(0, 0.5, z.w), n = Math.ceil(p.n * (0.14 + 0.86 * detail));
    for (let i = 0; i < n; i++) {
      const s = p.seed[i], j = i * 3;
      const vx = vx0 + (wob ? Math.sin(t * 1.3 + s * 20) * wob : 0), vy = vy0 + s * vy1, vz = wob ? Math.cos(t * 1.1 + s * 17) * wob * 0.7 : 0;
      let x = p.off[j] + (vx * dt) / B, y = p.off[j + 1] + (vy * dt) / Bh, zz = p.off[j + 2] + (vz * dt) / B;
      if (y > 1) y -= 2; else if (y < -1) y += 2;
      if (x * x + zz * zz > 1) { x = -x * 0.98; zz = -zz * 0.98; }
      p.off[j] = x; p.off[j + 1] = y; p.off[j + 2] = zz;
      const X = cx + x * B, Y = cy + y * Bh, Z = cz + zz * B;
      if (p.lines) { const o = i * 6, sp = Math.hypot(vx, vy, vz) || 1, len = vy0 < -5 ? 0.9 : 3 + s * 4; p.arr[o] = X; p.arr[o + 1] = Y; p.arr[o + 2] = Z; p.arr[o + 3] = X - (vx / sp) * len; p.arr[o + 4] = Y - (vy / sp) * len; p.arr[o + 5] = Z - (vz / sp) * len; }
      else { p.arr[j] = X; p.arr[j + 1] = Y; p.arr[j + 2] = Z; }
    }
    p.geo.setDrawRange(0, n * (p.lines ? 2 : 1));
    p.geo.attributes.position.needsUpdate = true;
    if (!p.lines) p.mat.size = Math.min(4.5, Math.max(0.2, camDist * 0.016)) * (p.size / 0.3) * (1.5 - 0.5 * sstep(0, 0.1, z.w));
    p.mat.opacity = op * (0.6 + 0.4 * sstep(0, 0.625, z.w)) * fade;
  }

  /* ---------- labels: real links in the page, positioned over their islands ---------- */
  const L = [];
  const addLabel = (el, kind, ref) => { if (el) L.push({ el, kind, ref, on: null }); };
  for (const b of Object.values(bodies)) addLabel(labelEls.islands[b.id], 'island', b);
  for (const z of zoneList) addLabel(labelEls.zones[z.id], 'zone', z);
  function placeLabels() {
    for (const l of L) {
      let show, y = 0;
      if (l.kind === 'zone') { show = l.ref.w < 0.45 && (over > 0.2 || l.ref.id !== 'capital'); tmp.copy(l.ref.center); y = l.ref.id === 'capital' ? 9 : 11 + over * 26; } // above the enlarged landform, so the label never hides its biome
      else if (l.kind === 'ghost') { show = zones[l.ref.zone].w > 0.35; if (show) l.ref.mesh.getWorldPosition(tmp); y = 2.6; }
      else { const zw = zones[l.ref.zone].w; show = goal.follow === l.ref.id || (l.ref.zone === 'capital' ? zw > 0.12 && over < 0.5 : zw > 0.35); if (show) l.ref.pos(tmp); y = l.ref.lift; }
      if (show) { tmp.y += y; tmp.project(camera); if (tmp.z > 1 || Math.abs(tmp.x) > 1.15 || Math.abs(tmp.y) > 1.15) show = false; }
      if (show !== l.on) { l.on = show; l.el.classList.toggle('on', show); }
      if (show) l.el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' + ((-tmp.y * 0.5 + 0.5) * H - 10).toFixed(1) + 'px) translate(-50%,-100%)';
      if (l.kind === 'island') { const hot = hovered === l.ref.id; if (hot !== l.hot) { l.hot = hot; l.el.classList.toggle('hot', hot); } }
    }
  }

  /* ---------- loop ---------- */
  let firstFrame = false, lastT = performance.now(), fpsN = 0, fpsT = 0, fps = 60, slow = 0, stateT = 0;
  let paused = false, pausedAt = 0, frameId = 0, good = 0, hold = 0;
  const maxRatio = pixelRatio;
  function setRatio(r) { pixelRatio = r; renderer.setPixelRatio(r); resize(); slow = good = 0; hold = 6; }
  function schedule() { if (!frameId && !paused && !document.hidden) frameId = requestAnimationFrame(frame); }
  function invalidate() { dirty = true; if (compiled) schedule(); }
  function frame(now) {
    frameId = 0;
    if (paused || document.hidden) { lastT = now; return; }
    const elapsed = (now - lastT) / 1000, real = Math.min(elapsed, 0.05);
    lastT = now;
    fpsN++; fpsT += elapsed;
    if (fpsT >= 1) { fps = Math.round(fpsN / fpsT); fpsN = fpsT = 0; hold = Math.max(0, hold - 1); if (reduced || hold) slow = good = 0; else if (fps < 40 && pixelRatio > 0.8) { good = 0; if (++slow >= 3) setRatio(Math.max(0.8, pixelRatio - (pixelRatio > 1 ? 0.25 : 0.1))); } else if (fps >= 57 && pixelRatio < maxRatio) { slow = 0; if (++good >= 8) setRatio(Math.min(maxRatio, pixelRatio + 0.1)); } else slow = good = 0; /* weak GPU: fewer pixels under sustained pressure, restored slowly when there is headroom */ }
    if (reduced && !dirty && !flight) return; // reduced motion: a still scene, redrawn only when the view changes
    dirty = false;
    const dt = reduced ? 0 : real, k = reduced ? 1 : 1 - Math.pow(0.0015, real);
    t += dt;

    for (const b of bodyList) {
      if (b.place) b.place(t, dt);
      const target = hovered === b.id ? 1 : 0;
      if (b.hover !== target) { b.hover += (target - b.hover) * (reduced ? 1 : Math.min(1, real * 10)); if (Math.abs(b.hover - target) < 0.002) b.hover = target; b.island.scale.setScalar(1 + 0.07 * b.hover); if (!b.island.matrixAutoUpdate) b.island.updateMatrix(); }
      if (b.place) b.g.position.y += 0.5 * b.hover;
    }
    for (const pk of packets) { pk.userData.a += dt * pk.userData.v; const a = pk.userData.a; pk.position.set(Math.cos(a) * pk.userData.orbit, -0.6 + Math.sin(t * 2 + a) * 0.15, Math.sin(a) * pk.userData.orbit); pk.rotation.set(t, t * 0.7, 0); }
    for (const c of clouds) {
      const u = c.userData;
      u.a += dt * u.v;
      c.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.3 + u.r) * 0.4, Math.sin(u.a) * u.r);
      let ps = 1;
      if (u.poof >= 0) { u.poof += dt / 4; ps = u.poof < 0.08 ? 1 + u.poof * 6 : u.poof < 0.2 ? (1.48 * (0.2 - u.poof)) / 0.12 : sstep(0.35, 1, u.poof); if (u.poof >= 1) u.poof = -1; }
      const sc = Math.max(0.001, u.s * ps * sstep(14, 30, c.position.distanceTo(camera.position))); // never fill the lens
      mxA.makeScale(sc, sc, sc).setPosition(c.position);
      for (let j = 0; j < c.puffs.length; j++) cloudMesh.setMatrixAt(c.first + j, mxB.multiplyMatrices(mxA, c.puffs[j]));
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
    sea.rotation.y += dt * 0.003;
    for (const g of islets) { const u = g.userData; u.a += dt * u.v; g.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.6 + u.bob) * 0.4, Math.sin(u.a) * u.r); g.rotation.y = u.a * 2; }
    const dayK = 1 - sstep(0.2, 0.8, lit); // birds and planes stay out of the heavy weather
    for (const f of flocks) {
      const u = f.userData;
      f.visible = dayK > 0.02 && !capitalFar;
      if (!f.visible) continue;
      u.a += dt * u.v;
      f.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.4 + u.r) * 1.2, Math.sin(u.a) * u.r);
      f.rotation.y = -u.a + (u.v > 0 ? Math.PI : 0);
      f.scale.setScalar(Math.max(0.001, 0.7 * dayK * sstep(16, 30, f.position.distanceTo(camera.position))));
      u.birds.forEach((b) => { const w = Math.sin(t * 9 + b.userData.ph) * 0.6; b.userData.wl.rotation.z = w; b.userData.wr.rotation.z = -w; });
    }
    for (const p of planes) { p.visible = dayK > 0.02; p.scale.setScalar(Math.max(0.001, dayK)); const u = p.userData; u.a += dt * u.v; p.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.8 + u.ph) * 0.8, Math.sin(u.a) * u.r); p.rotation.set(Math.sin(t * 0.8 + u.ph) * 0.15, -u.a + (u.v > 0 ? Math.PI : 0), (u.v > 0 ? -1 : 1) * 0.35); }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const bu = bursts[i], arr = bu.pts.geometry.attributes.position.array;
      bu.life += real / 1.8;
      bu.v.forEach((v, j) => { v.y -= 5 * real; v.multiplyScalar(1 - real * 0.8); arr[j * 3] += v.x * real; arr[j * 3 + 1] += v.y * real; arr[j * 3 + 2] += v.z * real; });
      bu.pts.geometry.attributes.position.needsUpdate = true;
      bu.pts.material.opacity = 1 - bu.life;
      if (bu.life >= 1) { scene.remove(bu.pts); bu.pts.geometry.dispose(); bu.pts.material.dispose(); bursts.splice(i, 1); }
      invalidate();
    }
    halo.material.opacity = 0.62 + Math.sin(t * 1.5) * 0.06;

    // camera: glide with an eased pull-back on long trips, then the original soft follow
    destination(dest);
    let bump = 0;
    if (flight) {
      const x = Math.min(1, (now - flight.t0) / flight.ms), e = ease(x);
      rig.target.lerpVectors(flight.from, dest, e);
      bump = Math.sin(Math.PI * x) * flight.bump;
      rig.dist = (flight.fromDist + (goal.dist - flight.fromDist) * e) * (1 + bump);
      if (x >= 1) flight = null;
    } else {
      rig.target.lerp(dest, k);
      rig.dist += (goal.dist - rig.dist) * k;
    }
    if (!down) rig.pitch += (goal.pitch - rig.pitch) * k * 0.5;
    if (!goal.follow && !down && goal.zone === 'capital' && !goal.point) rig.yaw += dt * 0.025;
    const offGoal = panelOpen && W > 900 ? 210 : 0;
    rig.off += (offGoal - rig.off) * k;
    const offYGoal = goal.follow || touched ? 0 : (W / H < 0.9 ? -0.06 : 0.08) * H; // keeps the archipelago clear of the intro text
    rig.offY += (offYGoal - rig.offY) * k;
    camera.setViewOffset(W, H, rig.off, rig.offY, W, H);
    rig.px += ((reduced || down ? 0 : mouse.x) - rig.px) * Math.min(1, real * 2.5); // gentle mouse parallax
    rig.py += ((reduced || down ? 0 : mouse.y) - rig.py) * Math.min(1, real * 2.5);
    const yaw = rig.yaw - rig.px * 0.1, pitch = Math.min(1.35, Math.max(0.1, rig.pitch + rig.py * 0.05)), cp = Math.cos(pitch);
    camera.position.set(rig.target.x + Math.sin(yaw) * cp * rig.dist, rig.target.y + Math.sin(pitch) * rig.dist, rig.target.z + Math.cos(yaw) * cp * rig.dist);
    camera.lookAt(rig.target);
    camera.updateMatrixWorld();
    dome.position.copy(camera.position);
    view.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const g of islets) {
      isletBounds.center.copy(g.position);
      g.visible = view.intersectsSphere(isletBounds);
      if (g.visible) for (const fn of g.userData.anim) fn(t, dt);
    }

    blend();
    // far tier for the capital: beyond 150 units its islands are drawn as their one-mesh copies and the birds rest (back under 120)
    const capDist = camera.position.length();
    if (capitalFar ? capDist < 120 : capDist > 150) { capitalFar = !capitalFar; for (const l of capitalLod) { if (capitalFar) l.g.remove(l.near); else l.g.add(l.near); l.far.visible = capitalFar; } for (const pk of packets) pk.visible = !capitalFar; }
    // Use this frame's camera after reattaching near models, including a single reduced-motion redraw.
    for (const b of bodyList) if (!(capitalFar && b.place)) for (const fn of b.anim) fn(t, dt, camera);
    if (pending.length) { populate(pending.shift()); invalidate(); }
    for (const z of zoneList) {
      if (!z.group) continue;
      z.spin.rotation.y += dt * (z.cfg.air.spin || 0);
      const camDist = camera.position.distanceTo(z.center), outside = 1 - sstep(0.1, 0.75, z.w);
      z.group.scale.setScalar(1 + 0.25 * outside + over * 0.3); // from far away a zone is drawn a little larger, never into its neighbours
      z.big.scale.setScalar(1 + 0.3 * outside + over * 1.1); // its landform and centrepiece grow more: the silhouette is what reads from the capital
      // far tier: hide the small island props beyond 170 units, bring them back under 145 (hysteresis, no flicker)
      if (z.far ? camDist < 145 : camDist > 170) {
        z.far = !z.far;
        for (const m of z.flora) m.visible = !z.far;
        if (z.farSolid) { z.farSolid.visible = z.far; for (const m of z.solid) m.visible = !z.far; }
        if (z.farGhost) { z.farGhost.visible = z.far; for (const g of z.ghosts) g.mesh.visible = !z.far; }
      }
      if (z.ring) z.ring.material.opacity = 0.4 + 0.5 * z.w;
      if (z.sphere) {
        for (const sp of z.sphere.haze) sp.material.opacity = z.sphere.base * sp.userData.k * (0.25 + 0.75 * outside);
        if (z.sphere.canopy) z.sphere.canopy.material.opacity = (z.sphere.fadeNear ? 0.92 - 0.78 * (1 - outside) : 0.92) * (1 - 0.35 * over);
      }
      if (z.w > 0.001 || idleDone) loadDecor(z);
      if (z.parts) stepParticles(z, dt, camDist);
      if (z.decor && !(z.resting && z.w === 0)) { z.appear = Math.min(1, z.appear + (reduced ? 1 : real / 1.2)); z.decor.update(t, dt, z.w, z.appear, camera); if (z.appear < 1) invalidate(); z.resting = z.w === 0 && z.appear >= 1; }
    }
    placeLabels();
    renderer.render(scene, camera);
    if (!firstFrame) { firstFrame = true; performance.mark('world:first-frame'); }
    if (reduced || now - stateT > 80) { stateT = now; onState(state()); }
    if (!reduced || dirty || flight) schedule();
  }
  function state() {
    let here = null, best = 0;
    for (const z of zoneList) if (z.raw > best) { best = z.raw; here = z.id; }
    return { x: rig.target.x, z: rig.target.z, dist: rig.dist, yaw: rig.yaw, over, here: best > 0.25 ? here : null, weights: Object.fromEntries(zoneList.map((z) => [z.id, +z.w.toFixed(3)])), lit, fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio, paused, frames: renderer.info.render.frame, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, spheres: zoneList.filter((z) => z.sphere).length };
  }
  performance.mark('world:built');
  // Compile every shader variant off the main thread before the first frame (parallel compile where the browser
  // has it); the warm-up group holds one object per variant that zones add later.
  const warm = new THREE.Group();
  warm.add(new THREE.Mesh(UNIT.box, bakedMat), new THREE.Mesh(UNIT.box, ghostMat), new THREE.InstancedMesh(UNIT.box, MAT.trunk, 1), new THREE.Points(UNIT.box, new THREE.PointsMaterial({ map: dotTex, transparent: true, depthWrite: false })), new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, fog: false })), new THREE.InstancedMesh(UNIT.box, new THREE.MeshStandardMaterial({ flatShading: true, transparent: true, fog: false }), 1));
  warm.scale.setScalar(0.0001);
  scene.add(warm);
  const ready = renderer.compileAsync(scene, camera).catch(() => {}).then(() => { scene.remove(warm); compiled = true; lastT = performance.now(); schedule(); });
  reducedQ.addEventListener('change', () => {
    reduced = reducedQ.matches; lastT = performance.now(); fpsN = fpsT = 0;
    if (reduced && flight) { destination(dest); rig.target.copy(dest); rig.dist = goal.dist; rig.pitch = goal.pitch; flight = null; }
    invalidate();
  });
  document.addEventListener('visibilitychange', () => { lastT = performance.now(); invalidate(); });

  return {
    ready,
    state,
    pause(value) {
      if (paused === !!value) return;
      paused = !!value;
      const now = performance.now();
      if (paused) { pausedAt = now; cancelAnimationFrame(frameId); frameId = 0; }
      else { if (flight) flight.t0 += now - pausedAt; lastT = now; invalidate(); }
    },
    /** glide to an island and follow it; null returns to the current zone */
    flyTo(id) {
      if (id) populate(zones[zoneOfIsland[id]]);
      const b = id && bodies[id];
      goal.follow = b ? id : null; goal.point = null; goal.over = false;
      if (b) { goal.zone = b.zone; goal.dist = b.focus; goal.pitch = 0.38; } else { goal.dist = goal.zone === 'capital' ? HOME : ZONE; goal.pitch = goal.zone === 'capital' ? 0.6 : 0.52; }
      glide();
    },
    goZone(id) { if (!zones[id]) return; interact(); populate(zones[id]); Object.assign(goal, { follow: null, point: null, over: false, zone: id, dist: id === 'capital' ? HOME : zones[id].r < 20 ? 30 : ZONE, pitch: id === 'capital' ? 0.6 : 0.52 }); glide(); },
    goOverview() { interact(); Object.assign(goal, { follow: null, point: null, over: true, dist: OVER, pitch: 1.08 }); glide(); },
    /** glide to any point of the world plane (minimap) */
    goPoint(x, z) { interact(); Object.assign(goal, { follow: null, over: false, point: new THREE.Vector3(x, 0, z), dist: Math.min(goal.dist, 90), pitch: 0.52 }); goal.zone = null; glide(); },
    zoomBy(f) { zoomTo(goal.dist * f); },
    setPanel(open) { panelOpen = open; invalidate(); },
    celebrate(colors) { if (reduced) return; colors.forEach((c, i) => setTimeout(() => { const a = rand(0, 6.28), r = rand(4, 22); burst(new THREE.Vector3(rig.target.x + Math.cos(a) * r, rand(9, 16), rig.target.z + Math.sin(a) * r), c); }, i * 260)); },
    redraw() { invalidate(); },
  };
}
