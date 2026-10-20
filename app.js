// Homepage: one 3D world of project islands (world.js) by day and by night. Flat SVG islands are the no-WebGL fallback.
const PROJECTS = [
  { id: 'orbital', title: 'Orbital Expeditions', sub: 'EKS microservices', color: '#ff8a1f', kind: 'CASE STUDY · AWS EKS',
    blurb: 'A fictional space travel storefront: six microservices on EKS, an event-driven order flow through EventBridge and SQS, Terraform and Helm delivery, and Grafana dashboards.',
    tags: ['EKS', 'DynamoDB', 'RDS', 'EventBridge', 'SQS', 'Terraform'], main: ['Read the case study', 'orbital.html'],
    src: 'https://github.com/zeinhaidara/aws-retail-microservices-eks', note: 'Live demo retired Oct 2026. Captures are in the case study.',
    island: { b: 'rocket' }, planet: { orbit: 9, speed: 0.11, phase: 0.4, size: 1.25, shape: 'ringed' } },
  { id: 'healthcare', title: 'Healthcare SecOps', sub: 'Featured · secure platform', color: '#12b981', kind: 'CASE STUDY · SECURE PLATFORM',
    blurb: 'A patient API on EKS Fargate behind scan gates, GitOps with Argo CD, Terraform approvals, least-privilege IAM and detective controls. Every change and accepted risk is logged with evidence.',
    tags: ['EKS Fargate', 'Argo CD', 'Terraform', 'Trivy', 'Checkov', 'GuardDuty'], main: ['Read the case study', 'healthcare.html'],
    src: 'https://github.com/zeinhaidara/healthcare-eks-secops', note: 'Includes a ship-a-change simulator. Synthetic data only; no compliance claim.',
    island: { b: 'shield' }, planet: { orbit: 14, speed: 0.08, phase: 2.2, size: 1.2, shape: 'shield' } },
  { id: 'gcp', title: 'AI Log Analyzer', sub: 'GCP · Gemini + BigQuery', color: '#f2b705', kind: 'CASE STUDY · GOOGLE CLOUD',
    blurb: 'Upload a log and an ADK agent on private Cloud Run investigates it with Gemini on Vertex AI, using similar past incidents from BigQuery as context. Event-driven through Pub/Sub, with Firestore, Cloud Storage and private Google API egress.',
    tags: ['Cloud Run', 'Gemini', 'ADK', 'BigQuery', 'Pub/Sub', 'Firestore', 'VPC'], main: ['Read the case study', 'gcp.html'],
    src: 'https://github.com/zeinhaidara/gcp-ai-log-analyzer', note: 'Team project with a colleague. Live app runs on synthetic logs.',
    island: { b: 'observatory' }, planet: { orbit: 34, speed: 0.03, phase: 0.85, size: 1.1, shape: 'octa' } },
  { id: 'threetier', title: 'Three-tier delivery', sub: 'EC2 + ECS Fargate', color: '#7c5cff', kind: 'AWS · APPLICATION PLATFORM',
    blurb: 'One FastAPI and MySQL application on two compute paths, private EC2 Auto Scaling and ECS Fargate, behind an ALB. A load-test workflow drives Auto Scaling under sustained traffic.',
    tags: ['EC2', 'ECS Fargate', 'RDS', 'Terraform', 'Load testing'], main: ['View the repository', 'https://github.com/zeinhaidara/aws-3-tier-github-actions'],
    island: { b: 'tower' }, planet: { orbit: 19, speed: 0.06, phase: 4.1, size: 1, shape: 'stack' } },
  { id: 'pipeline', title: 'GitHub → AWS pipeline', sub: 'OIDC, no stored keys', color: '#2f9bff', kind: 'AWS · SECURE CI/CD',
    blurb: 'A tested, security-scanned change moves through dev, stage and main to an S3 website, with short-lived OIDC credentials and no long-lived AWS keys.',
    tags: ['GitHub Actions', 'OIDC', 'IAM', 'S3'], main: ['View the repository', 'https://github.com/zeinhaidara/github-to-aws-pipeline'],
    island: { b: 'gear' }, planet: { orbit: 24, speed: 0.045, phase: 5.5, size: 0.9, shape: 'knot' } },
  { id: 'northbridge', title: 'Northbridge Health', sub: 'Azure AKS · in progress', color: '#1e6ad6', kind: 'AZURE · PLATFORM BLUEPRINT',
    blurb: 'An Azure referral-platform blueprint with reusable Terraform modules, AKS, private endpoints, workload identity, Key Vault and staged delivery. Resilience evidence is still pending.',
    tags: ['Azure AKS', 'Key Vault', 'Terraform', 'Helm'], main: ['View the repository', 'https://github.com/zeinhaidara/azure-endtoend-platform'], note: 'Work in progress.',
    island: { b: 'bridge' }, planet: { orbit: 29, speed: 0.035, phase: 1.3, size: 1.05, shape: 'octa' } },
];

// The balloon in the 3D world opens this card; it is not one of the five explorable projects.
const CONTACT = { id: 'contact', title: 'Hi, I’m Zein', color: '#ff5d6c', kind: 'ABOUT · CONTACT',
  blurb: 'Cloud engineer building secure, observable platforms on AWS, Azure and Google Cloud: infrastructure as code, least-privilege access, and delivery pipelines that say no to bad changes. Always glad to talk about interesting cloud and platform problems.',
  tags: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'GitOps', 'Security'], main: ['Email me', 'mailto:zeinhaidara@gmail.com'],
  src: 'https://github.com/zeinhaidara', note: 'zeinhaidara@gmail.com' };
const ALL = [...PROJECTS, CONTACT];
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;
let focused = null, mode = 'day', world = null, worldLoad = null;
const seen = new Set(read());

function read() { try { return JSON.parse(sessionStorage.getItem('zein-seen') || '[]'); } catch { return []; } }
function save() { try { sessionStorage.setItem('zein-seen', JSON.stringify([...seen])); } catch {} }

/* ---------- day scene: islands ---------- */
const INK = '#1d2340';
const BUILD = {
  rocket: (c) => `<ellipse cx="0" cy="0" rx="34" ry="10" fill="#9aa4b8"/><path class="flame" d="M-7 -14 Q0 8 7 -14Z" fill="#ff8a00"/><path d="M-14 -16 L-24 -2 L-12 -10Z M14 -16 L24 -2 L12 -10Z" fill="${c}"/><rect x="-12" y="-66" width="24" height="54" rx="10" fill="#fff" stroke="${INK}" stroke-width="2.5"/><path d="M-12 -56 Q0 -88 12 -56Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-42" r="6" fill="#8fd0ff" stroke="${INK}" stroke-width="2"/>`,
  shield: (c) => `<circle class="pulse" cx="0" cy="-40" r="34" fill="none" stroke="${c}" stroke-width="3"/><path d="M0 -82 L32 -70 V-44 Q32 -16 0 -2 Q-32 -16 -32 -44 V-70Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/><path d="M-13 -44 L-3 -33 L15 -55" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  tower: (c) => [0, 1, 2].map((i) => `<rect x="${-24 + i * 3}" y="${-24 - i * 22}" width="${48 - i * 6}" height="20" rx="4" fill="${['#c7b8ff', '#9f88ff', c][i]}" stroke="${INK}" stroke-width="2.5"/><circle cx="${-12 + i * 3}" cy="${-14 - i * 22}" r="2.5" fill="${INK}"/><circle cx="${-4 + i * 3}" cy="${-14 - i * 22}" r="2.5" fill="#22c55e"/>`).join(''),
  gear: (c) => `<rect x="-40" y="-12" width="80" height="10" rx="5" fill="${INK}"/><g class="gear"><circle cx="-10" cy="-42" r="22" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="8 6"/><circle cx="-10" cy="-42" r="12" fill="${c}" stroke="${INK}" stroke-width="2.5"/></g><rect x="14" y="-30" width="20" height="18" rx="3" fill="#ffd34d" stroke="${INK}" stroke-width="2.5"/>`,
  observatory: (c) => `<rect x="-22" y="-40" width="44" height="38" rx="4" fill="#e8edf6" stroke="${INK}" stroke-width="2.5"/><path d="M-26 -40 A26 26 0 0 1 26 -40Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/><rect x="4" y="-80" width="9" height="32" rx="3" fill="${INK}" transform="rotate(35 8 -48)"/>`,
  bridge: (c) => `<path d="M-44 -8 Q-10 -46 24 -8" fill="none" stroke="${c}" stroke-width="7"/><path d="M-44 -8 H24" stroke="${INK}" stroke-width="4"/><rect x="28" y="-30" width="6" height="24" fill="#8b5a2b"/><circle cx="31" cy="-42" r="16" fill="#3fbf6f" stroke="${INK}" stroke-width="2.5"/><rect x="-6" y="-64" width="2.5" height="30" fill="${INK}"/><path d="M-3.5 -64 h22 l-6 6 6 6 h-22z" fill="${c}"/>`,
};
const islands = {};
// Island positions per screen shape. Wide: one sweeping row; tall (phones): featured on top, then two by two.
const LAYOUTS = {
  wide: { viewBox: '150 90 1080 690', routes: ['M330 290 Q500 200 670 300', 'M670 300 Q840 210 1010 290', 'M670 300 Q660 480 800 620', 'M1010 290 Q1130 450 1090 610'],
    pos: { orbital: [330, 290, 190], healthcare: [670, 300, 220], threetier: [1010, 290, 185], pipeline: [800, 620, 175], northbridge: [1090, 610, 175], gcp: [520, 620, 175] } },
  tall: { viewBox: '0 30 600 1120', routes: ['M150 500 Q190 330 300 240', 'M300 240 Q410 330 450 500', 'M150 500 Q90 640 150 760', 'M450 500 Q510 640 450 760'],
    pos: { healthcare: [300, 240, 210], orbital: [150, 500, 170], threetier: [450, 500, 170], pipeline: [150, 760, 160], northbridge: [450, 760, 160], gcp: [300, 1010, 160] } },
};
const pickLayout = () => (innerWidth < 760 || innerWidth / innerHeight < 0.9 ? 'tall' : 'wide');
let layout = null;
function buildIslands() {
  const next = pickLayout();
  if (next === layout) return;
  layout = next;
  const L = LAYOUTS[layout], host = $('islands');
  $('scene').setAttribute('viewBox', L.viewBox);
  L.routes.forEach((d, i) => $('r' + (i + 1)).setAttribute('d', d));
  host.replaceChildren();
  $('packets').replaceChildren();
  PROJECTS.forEach((p, i) => {
    const [x, y, w] = L.pos[p.id], b = p.island.b, h = w / 4;
    const lw = Math.max(p.title.length, p.sub.length * 0.72) * 8.6 + 34;
    const signY = y - h - (b === 'shield' ? 100 : 86);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'isl');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', p.title);
    g.innerHTML = `<g class="bob" style="animation-delay:${-i * 1.1}s">
      <ellipse cx="${x}" cy="${y + w * 0.75}" rx="${w * 0.3}" ry="8" fill="${INK}" opacity=".08"/>
      <path d="M${x - w / 2} ${y} L${x} ${y + h} L${x - w * 0.05} ${y + w * 0.55} L${x - w * 0.3} ${y + w * 0.32}Z" fill="#b07a4a"/>
      <path d="M${x} ${y + h} L${x + w / 2} ${y} L${x + w * 0.28} ${y + w * 0.36} L${x - w * 0.05} ${y + w * 0.55}Z" fill="#8b5a2b"/>
      <path d="M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y} L${x} ${y + h}Z" fill="#7bd96a" stroke="#4fae45" stroke-width="3"/>
      <path d="M${x - w / 2} ${y} L${x} ${y + h} L${x + w / 2} ${y}" fill="none" stroke="#5cc451" stroke-width="7"/>
      <g transform="translate(${x} ${y + 4})">${BUILD[b](p.color)}</g>
      <g class="sign" transform="translate(${x} ${signY})"><rect x="${-lw / 2}" y="-22" width="${lw}" height="46" rx="14"/>
        <circle class="sdot" cx="${-lw / 2 + 16}" cy="-6" r="5" fill="${p.color}"/>
        <text class="st" x="${-lw / 2 + 28}" y="-1">${p.title}</text><text class="ss" x="${-lw / 2 + 28}" y="15">${p.sub}</text>
        <g transform="translate(${lw / 2 - 4} -22)"><g class="check"><circle r="11"/><path d="M-5 0 L-1.5 3.5 L5 -3.5"/></g></g></g></g>`;
    g.addEventListener('click', () => focus(p.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(p.id); } });
    host.appendChild(g);
    islands[p.id] = g;
  });
  [['r1', '#ff8a1f', 4], ['r2', '#7c5cff', 5], ['r3', '#2f9bff', 4.5], ['r4', '#1e6ad6', 5.5], ['r1', '#12b981', 4.2, 2]].forEach(([r, c, d, b = 0]) => {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<rect x="-7" y="-7" width="14" height="14" rx="4" fill="${c}" stroke="#fff" stroke-width="2.5"/><animateMotion dur="${d}s" begin="${-b}s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="linear"><mpath href="#${r}"/></animateMotion>`;
    $('packets').appendChild(g);
  });
  if (reduced) $('scene').pauseAnimations();
  if (Object.keys(dockBtns).length) marks();
}

/* ---------- shared UI ---------- */
const dockBtns = {};
function buildDock() {
  PROJECTS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--c', p.color);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i></i>' + p.title + '<b class="check" aria-hidden="true"></b>';
    b.addEventListener('click', () => (focused === p.id ? overview() : focus(p.id)));
    $('dock').appendChild(b);
    dockBtns[p.id] = b;
  });
  const hi = document.createElement('button');
  hi.type = 'button';
  hi.className = 'hi';
  hi.style.setProperty('--c', CONTACT.color);
  hi.innerHTML = '<i></i>Say hi';
  hi.addEventListener('click', () => (focused === 'contact' ? overview() : focus('contact')));
  $('dock').appendChild(hi);
  dockBtns.contact = hi;
}

function focus(id) {
  const p = ALL.find((x) => x.id === id);
  if (!p) return;
  focused = id;
  const isNew = id !== 'contact' && !seen.has(id);
  if (id !== 'contact') seen.add(id);
  save();
  const panel = $('panel');
  panel.style.setProperty('--c', p.color);
  $('p-kind').textContent = p.kind;
  $('p-title').textContent = p.title;
  $('p-blurb').textContent = p.blurb;
  $('p-tags').replaceChildren(...p.tags.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
  $('p-main').textContent = p.main[0];
  $('p-main').href = p.main[1];
  $('p-src').hidden = !p.src;
  if (p.src) $('p-src').href = p.src;
  $('p-note').textContent = p.note || '';
  $('p-note').hidden = !p.note;
  panel.hidden = false;
  panel.classList.remove('pop');
  void panel.offsetWidth;
  panel.classList.add('pop');
  body.classList.add('panel-open');
  marks();
  if (world) world.flyTo(id);
  if (isNew && seen.size === PROJECTS.length) celebrate();
}
function celebrate() {
  if (world) world.celebrate([...PROJECTS.map((p) => p.color), CONTACT.color, '#ffd34d']);
  const t = $('toast');
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => { t.hidden = true; }, 7000);
}
function overview() {
  focused = null;
  $('panel').hidden = true;
  body.classList.remove('panel-open');
  marks();
  if (world) world.flyTo(null);
}
function hop(dir) {
  const i = focused ? PROJECTS.findIndex((p) => p.id === focused) : -1;
  focus(PROJECTS[(i + dir + PROJECTS.length) % PROJECTS.length].id);
}
function marks() {
  dockBtns.contact.setAttribute('aria-pressed', String(focused === 'contact'));
  PROJECTS.forEach((p) => {
    dockBtns[p.id].setAttribute('aria-pressed', String(focused === p.id));
    dockBtns[p.id].classList.toggle('seen', seen.has(p.id));
    if (islands[p.id]) {
      islands[p.id].classList.toggle('seen', seen.has(p.id));
      islands[p.id].classList.toggle('dim', !!focused && focused !== p.id);
    }
  });
  $('score').textContent = seen.size + ' / ' + PROJECTS.length + ' explored';
  if (world) world.setMarks(focused, seen);
}

/* ---------- day / night ---------- */
// The 3D world (world.js) draws both modes. If WebGL is unavailable, the flat SVG islands are the fallback and night is disabled.
function loadWorld() {
  if (!worldLoad) {
    worldLoad = import('./world.js?v=12').then((m) => {
      world = m.createWorld({ canvas: $('stage'), labelsHost: $('plabels'), projects: PROJECTS, onPick: focus, onInteract: () => body.classList.add('touched'), mode });
      world.flyTo(focused);
      world.setMarks(focused, seen);
      body.classList.add('gl');
      return world;
    }).catch((err) => {
      console.warn('3D unavailable, using flat islands', err);
      body.classList.add('nogl');
      if (mode === 'night') applyMode('day');
      buildIslands();
      addEventListener('resize', buildIslands);
      marks();
      const t = $('mode');
      t.disabled = true;
      t.title = 'Night view needs WebGL';
      return null;
    });
  }
  return worldLoad;
}

function applyMode(next) {
  mode = next;
  body.dataset.mode = mode;
  try { sessionStorage.setItem('zein-mode', mode); } catch { /* storage blocked: mode still works on this page */ }
  const t = $('mode');
  t.setAttribute('aria-pressed', String(mode === 'night'));
  t.setAttribute('aria-label', mode === 'night' ? 'Switch to day' : 'Switch to night');
}

async function setMode(next) {
  if (next === mode) return;
  if (!world) {
    const t = $('mode');
    t.classList.add('loading');
    await loadWorld();
    t.classList.remove('loading');
    if (!world) return;
  }
  applyMode(next);
  world.setMode(mode);
  history.replaceState(null, '', mode === 'night' ? '#night' : location.pathname + location.search);
}

/* ---------- boot ---------- */
buildDock();
marks();
$('mode').addEventListener('click', () => setMode(mode === 'day' ? 'night' : 'day'));
$('close').addEventListener('click', overview);
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.key === 'Escape') overview();
  else if (e.key === 'ArrowRight') hop(1);
  else if (e.key === 'ArrowLeft') hop(-1);
  else if (/^[1-9]$/.test(e.key) && PROJECTS[Number(e.key) - 1]) focus(PROJECTS[Number(e.key) - 1].id);
});
const hash = location.hash.slice(1);
let stored = null;
try { stored = sessionStorage.getItem('zein-mode'); } catch { /* storage blocked */ }
if (hash === 'night' || (hash !== 'day' && stored === 'night')) applyMode('night');
if (PROJECTS.some((p) => p.id === hash)) focus(hash);
loadWorld();
requestAnimationFrame(() => body.classList.add('ready'));
