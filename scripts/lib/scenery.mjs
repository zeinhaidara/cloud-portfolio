// Flat-vector scenery, drawn at build time. One illustration style everywhere:
// 2.5px dark outline, round joins, fills taken from the region palette through CSS classes.
// Classes: o = outline; c-sky c-far c-land c-land2 c-feat c-pop c-paper c-ink = palette fills;
// a-* = ambient motion (switched off by prefers-reduced-motion and the calm setting).

const n = (v) => Math.round(v * 10) / 10;
const W = 1200, H = 300;

function hills(base, amp, seed, cls, freq = 0.006) {
  let d = `M0 ${H}L0 ${n(base + amp * Math.sin(seed))}`;
  for (let x = 40; x <= W; x += 40) {
    d += `L${x} ${n(base + amp * Math.sin(x * freq + seed) + amp * 0.4 * Math.sin(x * freq * 2.7 + seed * 1.7))}`;
  }
  return `<path class="o ${cls}" d="${d}L${W} ${H}Z"/>`;
}
const ground = (y, cls) => `<path class="o ${cls}" d="M-5 ${y}H${W + 5}V${H + 5}H-5Z"/>`;
const sky = () => `<rect class="c-sky" width="${W}" height="${H}"/><g class="orb"><circle class="o sun" cx="1040" cy="64" r="26"/><path class="o moon" d="M1052 40a27 27 0 1 0 14 46a22 22 0 0 1-14-46z"/></g>`;
const cloud = (x, y, s = 1, extra = '') => `<g class="${extra}" transform="translate(${x} ${y}) scale(${s})"><path class="o c-paper" d="M0 20a14 14 0 0 1 14-14a20 20 0 0 1 38-4a15 15 0 0 1 26 8a12 12 0 0 1 4 24H6a12 12 0 0 1-6-14z"/></g>`;

/** The islander: one small inhabitant, dressed per region. */
function folk(x, y, s = 1, kit = '') {
  const kits = {
    hard: '<path class="o c-pop" d="M-9 -22a9 9 0 0 1 18 0h3v3h-24v-3z"/>',
    hood: '<path class="o c-pop" d="M-10 -12a10 12 0 0 1 20 0l2 12h-24z"/><circle class="c-paper" cx="0" cy="-12" r="6"/>',
    cap: '<path class="o c-pop" d="M-8 -20h16l6 4h-22z"/>',
    scarf: '<path class="o c-pop" d="M-9 -6h18v5h-5l2 9h-6l-1-9h-8z"/>',
    lamp: '<path class="o" fill="none" d="M9 0v-10h8"/><circle class="o c-pop a-blink" cx="17" cy="-5" r="4"/>',
    crown: '<path class="o c-pop" d="M-8 -19l3-7l5 5l5-5l3 7z"/>',
  };
  return `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-paper" d="M-8 14v-12a8 8 0 0 1 16 0v12z"/><circle class="o c-paper" cx="0" cy="-12" r="8"/><circle class="c-ink" cx="-3" cy="-13" r="1.4"/><circle class="c-ink" cx="3" cy="-13" r="1.4"/>${kits[kit] || ''}</g>`;
}
const tree = (x, y, s = 1, cls = 'c-land2') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-feat" d="M-3 0v-18h6v18z"/><circle class="o ${cls}" cx="0" cy="-30" r="17"/></g>`;
const pine = (x, y, s = 1, cls = 'c-land2') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-feat" d="M-3 0v-10h6v10z"/><path class="o ${cls}" d="M0 -62l15 24h-8l13 22h-40l13-22h-8z"/></g>`;
const flower = (x, y, cls = 'c-pop') => `<g transform="translate(${x} ${y})"><path class="o" fill="none" d="M0 0v-12"/><circle class="o ${cls}" cx="0" cy="-15" r="4.5"/></g>`;
const bird = (x, y, s = 1, extra = '') => `<path class="o ${extra}" fill="none" d="M${x} ${y}q${6 * s} ${-7 * s} ${12 * s} 0q${6 * s} ${-7 * s} ${12 * s} 0"/>`;

function windmill(x, y, s = 1, delay = 0) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-feat" d="M-13 0l6-70h14l6 70z"/><path class="o c-pop" d="M-9 -70l9-13l9 13z"/><rect class="o c-ink" x="-4" y="-22" width="8" height="12"/><g class="a-spin" style="animation-delay:-${delay}s"><path class="o c-paper" d="M-3 -74h6l3-40h-12zM-3 -74h6l3 40h-12zM0 -77v6l40 3v-12zM0 -77v6l-40 3v-12z"/><circle class="o c-pop" cx="0" cy="-74" r="5"/></g></g>`;
}
function containers(x, y, rows) {
  const fills = ['c-feat', 'c-pop', 'c-paper', 'c-far'];
  let out = '', k = 0;
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i++) {
      const cx = x + i * 62 + r * 14, cy = y - (r + 1) * 28;
      out += `<g transform="translate(${cx} ${cy})"><rect class="o ${fills[(k++ + r) % fills.length]}" width="60" height="28"/><path class="o" fill="none" d="M12 4v20M24 4v20M36 4v20M48 4v20"/></g>`;
    }
  });
  return out;
}
const crane = (x, y) => `<g transform="translate(${x} ${y})"><path class="o c-feat" d="M-8 0v-120h16v120z"/><path class="o c-feat" d="M-60 -120h190v-12h-190z"/><path class="o" fill="none" d="M-8 -90l16 30M8 -90l-16 30M-8 -60l16 30M8 -60l-16 30M100 -120v46"/><rect class="o c-pop a-bob" x="88" y="-74" width="24" height="16"/></g>`;
const waves = (y, cls, extra = '') => {
  let d = `M-60 ${y}`;
  for (let x = -60; x <= W + 60; x += 60) d += `q15 -12 30 0t30 0`;
  return `<path class="o ${cls} ${extra}" d="${d}V${H + 5}H-60Z"/>`;
};
const lighthouse = (x, y, s = 1, delay = 0) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="c-pop a-beam" style="animation-delay:-${delay}s" d="M0 -98l150 -34v64z" opacity=".5"/><path class="o c-feat" d="M-14 0l5-84h18l5 84z"/><path class="o c-pop" d="M-12 -40h24l-1-14h-22zM-10 -70h20l-1-12h-18z"/><rect class="o c-paper" x="-11" y="-108" width="22" height="24"/><path class="o c-ink" d="M-15 -108h30l-15-14z"/><circle class="o c-pop a-blink" cx="0" cy="-96" r="6"/></g>`;
const gear = (x, y, r, cls = 'c-pop', dir = '') => {
  let teeth = '';
  for (let i = 0; i < 8; i++) teeth += `<rect class="o ${cls}" x="-4" y="${-r - 7}" width="8" height="10" transform="rotate(${i * 45})"/>`;
  return `<g transform="translate(${x} ${y})"><g class="a-spin ${dir}">${teeth}<circle class="o ${cls}" r="${r}"/><circle class="o c-paper" r="${n(r * 0.35)}"/></g></g>`;
};
const house = (x, y, s = 1, roof = 'c-feat', wall = 'c-paper') => `<g transform="translate(${x} ${y}) scale(${s})"><rect class="o ${wall}" x="-18" y="-30" width="36" height="30"/><path class="o ${roof}" d="M-24 -30l24-22l24 22z"/><rect class="o c-ink" x="-5" y="-16" width="10" height="16"/></g>`;
const boat = (x, y, s = 1, extra = 'a-bob') => `<g class="${extra}"><g transform="translate(${x} ${y}) scale(${s})"><path class="o c-feat" d="M-30 0h60l-10 14h-40z"/><path class="o" fill="none" d="M0 0v-44"/><path class="o c-paper" d="M2 -42l24 34h-24z"/><path class="o c-pop" d="M-2 -40l-18 32h18z"/></g></g>`;
const cactus = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-far" d="M-6 0v-46a6 6 0 0 1 12 0v46zM6 -22h8v-12a4 4 0 0 1 8 0v20h-16zM-6 -14h-8v-10a4 4 0 0 0-8 0v18h16z"/></g>`;
const peak = (x, y, w, h, cls = 'c-land', cap = 'c-land2') => `<path class="o ${cls}" d="M${x - w} ${y}L${x} ${y - h}L${x + w} ${y}Z"/><path class="o ${cap}" d="M${n(x - w * 0.28)} ${n(y - h * 0.72)}L${x} ${y - h}L${n(x + w * 0.28)} ${n(y - h * 0.72)}l${n(-w * 0.1)} ${n(h * 0.06)}l${n(-w * 0.09)} ${n(-h * 0.05)}l${n(-w * 0.09)} ${n(h * 0.07)}l${n(-w * 0.1)} ${n(-h * 0.06)}z"/>`;
const bridge = (x, y, w) => `<g transform="translate(${x} ${y})"><path class="o c-feat" d="M0 0q${w / 2} ${-w * 0.36} ${w} 0v8q${-w / 2} ${-w * 0.36} ${-w} 0z"/><path class="o" fill="none" d="M${n(w * 0.25)} ${n(-w * 0.13)}v10M${n(w * 0.5)} ${n(-w * 0.18)}v12M${n(w * 0.75)} ${n(-w * 0.13)}v10"/></g>`;
const floe = (x, y, w) => `<path class="o c-land" d="M${x} ${y}l${n(w * 0.15)} ${-w * 0.22}h${n(w * 0.6)}l${n(w * 0.25)} ${n(w * 0.22)}z"/>`;
const penguin = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="o c-ink" d="M-8 0v-16a8 9 0 0 1 16 0v16z"/><path class="c-paper" d="M-4 -2v-12a4 5 0 0 1 8 0v12z"/><path class="o c-pop" d="M-2 -17h4l-2 4z"/></g>`;

const SCENES = {
  meadow: () => sky() + cloud(140, 40, 1.1, 'a-drift') + cloud(620, 70, 0.8, 'a-drift slow') + hills(190, 18, 0.4, 'c-far') + hills(226, 12, 2.1, 'c-land') +
    `<g transform="translate(760 222)"><path class="o" fill="none" d="M0 0v-120M60 0v-120M120 0v-90M0 -40h120M0 -80h120M0 -120h60M0 0l60-40M60 0l60-40M0 -40l60-40M60 -80l-60 40"/><rect class="o c-feat" x="0" y="-126" width="60" height="8"/><rect class="o c-feat" x="0" y="-86" width="120" height="8"/><rect class="o c-feat" x="0" y="-46" width="120" height="8"/></g>` +
    crane(960, 226) + house(560, 232, 1.2, 'c-pop') + tree(90, 236, 1.2) + tree(380, 230, 0.9) + tree(1120, 232, 1) +
    folk(700, 236, 1.1, 'hard') + folk(880, 132, 0.8, 'hard') + folk(470, 244, 1, 'hard') +
    [200, 250, 300, 640, 1040].map((x, i) => flower(x, 252 + (i % 2) * 8, i % 2 ? 'c-feat' : 'c-pop')).join('') + hills(262, 6, 5, 'c-land2') + bird(300, 80, 1, 'a-drift') + bird(340, 96, 0.8, 'a-drift'),

  plains: () => sky() + cloud(80, 36, 1.2, 'a-drift fast') + cloud(520, 60, 0.9, 'a-drift fast') + cloud(900, 30, 1, 'a-drift') + hills(200, 10, 1.3, 'c-far', 0.004) + hills(232, 8, 3.4, 'c-land', 0.005) +
    windmill(260, 236, 1.25, 0) + windmill(640, 228, 1, 2) + windmill(980, 238, 1.4, 4) + house(440, 240, 1, 'c-pop') +
    folk(360, 244, 1, 'scarf') + folk(800, 242, 1.1, 'cap') +
    `<g class="a-sway">${Array.from({ length: 30 }, (_, i) => `<path class="o" fill="none" d="M${20 + i * 40} 268q6 -14 14 -22"/>`).join('')}</g>` +
    `<g class="a-bob"><path class="o c-pop" d="M860 96l16-14l14 16l-16 12z"/><path class="o" fill="none" d="M874 110q-20 60 -70 122"/></g>` + hills(266, 5, 2, 'c-land2') + bird(160, 110, 1, 'a-drift fast'),

  harbor: () => sky() + cloud(60, 20, 1.5, 'a-drift dark') + cloud(430, 10, 1.7, 'a-drift dark') + cloud(840, 26, 1.4, 'a-drift dark') +
    `<path class="c-paper a-flash" d="M700 0l-18 70h16l-24 70l50-88h-18l22-52z"/>` + hills(190, 8, 2.2, 'c-far', 0.003) +
    `<path class="o c-land" d="M-5 222H640V305H-5Z"/><path class="o" fill="none" d="M0 240h640"/>` + containers(60, 222, [5, 4, 2]) + crane(470, 222) + lighthouse(1080, 232, 1, 1) +
    `<path class="o c-land2" d="M1010 232h150l20 73h-190z"/>` + folk(410, 208, 1, 'hood') + folk(590, 208, 0.9, 'hood') + boat(790, 238, 1.1) + waves(244, 'c-far', 'a-wave') + waves(264, 'c-land2', 'a-wave rev'),

  forest: () => sky() + `<circle class="o c-paper" cx="210" cy="60" r="20" opacity=".9"/>` + hills(180, 16, 0.9, 'c-far') +
    [40, 120, 200, 300, 900, 990, 1080, 1160].map((x, i) => pine(x, 226 + (i % 3) * 6, 1.3 + (i % 2) * 0.3, 'c-far')).join('') + hills(228, 8, 4, 'c-land') +
    `<g transform="translate(600 236)"><path class="o c-feat" d="M-130 0v-70h20v-14h14v14h20v-14h14v14h124v-14h14v14h20v-14h14v14h20v70z"/><path class="o c-feat" d="M-150 0v-110h-6v-14h12v8h10v-8h12v8h10v-8h12v14h-6v110zM106 0v-110h-6v-14h12v8h10v-8h12v8h10v-8h12v14h-6v110z"/><path class="o c-ink" d="M-20 0v-34a20 20 0 0 1 40 0v34z"/><rect class="o c-pop a-blink" x="-134" y="-90" width="10" height="14"/><rect class="o c-pop a-blink" x="122" y="-90" width="10" height="14" style="animation-delay:-2s"/><path class="o" fill="none" d="M-128 -124v-26"/><path class="o c-pop" d="M-128 -150h22l-6 7l6 7h-22z"/></g>` +
    [380, 460, 760, 840].map((x, i) => pine(x, 250, 1.1 + (i % 2) * 0.25)).join('') + folk(520, 250, 1, 'lamp') + folk(700, 252, 1, 'lamp') + hills(268, 5, 1, 'c-land2') +
    Array.from({ length: 16 }, (_, i) => `<circle class="c-pop a-blink" cx="${60 + ((i * 73) % 1100)}" cy="${120 + ((i * 47) % 130)}" r="3" style="animation-delay:-${(i * 0.7) % 5}s"/>`).join(''),

  highlands: () => sky() + cloud(120, 18, 1.5, 'a-drift dark') + cloud(700, 30, 1.6, 'a-drift dark') + `<path class="c-paper a-flash" d="M360 0l-14 56h14l-20 60l44-76h-16l18-40z" style="animation-delay:-3s"/>` +
    hills(170, 30, 0.3, 'c-far', 0.005) + lighthouse(330, 170, 0.8, 0) + hills(214, 24, 2.6, 'c-land', 0.006) + lighthouse(820, 214, 1.15, 3) +
    `<g transform="translate(560 236)"><ellipse class="o c-paper" cx="0" cy="-10" rx="16" ry="11"/><circle class="o c-ink" cx="15" cy="-14" r="6"/><path class="o" fill="none" d="M-8 0v8M8 0v8"/></g><g transform="translate(640 244) scale(.8)"><ellipse class="o c-paper" cx="0" cy="-10" rx="16" ry="11"/><circle class="o c-ink" cx="15" cy="-14" r="6"/><path class="o" fill="none" d="M-8 0v8M8 0v8"/></g>` +
    folk(240, 236, 1, 'hood') + folk(1020, 240, 1.1, 'hood') + hills(262, 8, 5.2, 'c-land2'),

  workshop: () => sky() + cloud(200, 40, 1, 'a-drift slow') + hills(196, 12, 1.1, 'c-far') + [60, 150, 1050, 1140].map((x, i) => tree(x, 236, 1.5 + (i % 2) * 0.3, 'c-far')).join('') + hills(236, 6, 3, 'c-land') +
    `<g transform="translate(600 244)"><rect class="o c-paper" x="-150" y="-90" width="300" height="90"/><path class="o c-feat" d="M-170 -90l40-44h260l40 44z"/><rect class="o c-ink" x="-20" y="-50" width="40" height="50"/><rect class="o c-sky" x="-120" y="-66" width="50" height="34"/><rect class="o c-sky" x="70" y="-66" width="50" height="34"/><path class="o c-feat" d="M96 -134v-40h20v40z"/><g class="a-rise"><circle class="o c-paper" cx="106" cy="-186" r="8"/><circle class="o c-paper" cx="116" cy="-204" r="6"/></g></g>` +
    gear(360, 214, 30, 'c-pop') + gear(414, 240, 18, 'c-feat', 'rev') + gear(860, 222, 24, 'c-pop', 'rev') + gear(906, 244, 15, 'c-feat') +
    `<g transform="translate(250 246)"><rect class="o c-feat" x="-14" y="-28" width="28" height="28" rx="4"/><rect class="o c-paper" x="-10" y="-46" width="20" height="16" rx="3"/><circle class="c-ink" cx="-4" cy="-38" r="2"/><circle class="c-ink" cx="4" cy="-38" r="2"/><path class="o" fill="none" d="M0 -46v-8"/><circle class="o c-pop a-blink" cx="0" cy="-56" r="3"/></g>` +
    folk(720, 250, 1, 'cap') + folk(480, 252, 1, 'cap') + tree(980, 250, 1) + hills(270, 4, 2, 'c-land2'),

  desert: () => sky() + `<g class="a-shimmer">${hills(190, 22, 0.6, 'c-far', 0.004)}</g>` + hills(224, 18, 2.9, 'c-land', 0.005) +
    `<g transform="translate(820 236)"><path class="o c-land2" d="M-150 0q40 -110 150 -120q110 10 150 120z"/><path class="o c-ink" d="M-34 0v-44a34 30 0 0 1 68 0v44z"/><path class="o c-feat" d="M-42 0v-58h8v58zM34 0v-58h8v58zM-46 -58h92v-9h-92z"/><path class="o" fill="none" d="M-80 14h200"/><g transform="translate(60 6)"><path class="o c-feat" d="M-22 -18h44l-6 18h-32z"/><path class="o c-pop" d="M-16 -18l8-10l8 6l8-8l8 12z"/><circle class="o c-ink" cx="-10" cy="4" r="5"/><circle class="o c-ink" cx="10" cy="4" r="5"/></g></g>` +
    cactus(180, 246, 1.2) + cactus(480, 240, 0.9) + cactus(1110, 250, 1.1) + folk(620, 246, 1, 'scarf') + folk(960, 252, 0.9, 'hard') +
    `<g transform="translate(330 250)"><path class="o c-far" d="M-22 0q0 -10 12 -10h20q10 0 14 -8l6 4q-4 12 -16 14z"/><circle class="c-ink" cx="24" cy="-11" r="1.5"/></g>` + hills(266, 6, 4.4, 'c-land2') +
    [[700, 150], [760, 120], [900, 110]].map(([x, y], i) => `<circle class="c-pop a-blink" cx="${x}" cy="${y}" r="2.5" style="animation-delay:-${i}s"/>`).join(''),

  ice: () => sky() + `<g class="a-aurora"><path class="c-pop" d="M0 40q200 -50 400 0t400 -10t400 20v40q-200 -40 -400 -10t-400 0t-400 -10z" opacity=".55"/><path class="c-feat" d="M0 80q300 -40 600 0t600 -10v24q-300 -30 -600 0t-600 0z" opacity=".35"/></g>` +
    peak(160, 226, 130, 120, 'c-far', 'c-land') + peak(1010, 226, 150, 140, 'c-far', 'c-land') + waves(226, 'c-land2', 'a-wave') +
    `<path class="o c-land" d="M120 244q60 -44 180 -40q90 4 130 40z"/><path class="o c-land" d="M560 248q50 -50 150 -46q80 4 110 46z"/><path class="o c-land" d="M940 250q50 -36 130 -32q70 4 100 32z"/>` + bridge(410, 232, 170) + bridge(800, 234, 160) +
    `<g transform="translate(690 204)"><path class="o c-paper" d="M-30 0a30 26 0 0 1 60 0z"/><path class="o c-ink" d="M-9 0v-10a9 9 0 0 1 18 0v10z"/></g>` + penguin(250, 212, 1.1) + penguin(278, 216, 0.9) + penguin(1030, 222, 1) + folk(620, 208, 0.95, 'scarf') + folk(490, 196, 0.8, 'scarf') +
    waves(262, 'c-far', 'a-wave rev') + floe(60, 280, 70) + floe(480, 286, 50) + floe(1080, 284, 60),

  volcano: () => sky() + `<g class="a-rise slow"><circle class="o c-far" cx="330" cy="40" r="20"/><circle class="o c-far" cx="362" cy="24" r="14"/><circle class="o c-far" cx="300" cy="18" r="12"/></g>` +
    `<path class="o c-land" d="M90 240L270 76h110L570 240Z"/><path class="o c-feat a-glow" d="M270 76h110l-18 26l-14-12l-16 20l-18-18l-20 14z"/><path class="o c-feat a-glow" d="M330 108q10 40 -6 70q-10 26 4 62h-22q-12 -40 0 -64q12 -30 6 -66z"/>` +
    hills(232, 8, 1.8, 'c-far') + `<path class="o c-land2" d="M600 250q260 -34 560 0v55H600Z"/><path class="o" fill="none" d="M690 262h90M840 270h130M980 258h80"/>` +
    tree(1120, 238, 1.1, 'c-far') + tree(640, 240, 1, 'c-far') + house(1010, 238, 1, 'c-pop') +
    `<g transform="translate(790 252)"><path class="o" fill="none" d="M0 0v-26"/><path class="o c-paper" d="M-10 -40q10 -12 16 0q6 8 -6 14z"/><path class="o c-pop" d="M6 -40l14 2l-14 4z"/></g>` + folk(560, 246, 1, 'hard') + folk(900, 236, 0.9, 'cap') + boat(890, 262, 0.7, '') + hills(274, 3, 3.3, 'c-land') +
    [[300, 60], [350, 50], [320, 30]].map(([x, y], i) => `<circle class="c-pop a-blink" cx="${x}" cy="${y}" r="3" style="animation-delay:-${i * 1.3}s"/>`).join(''),

  summit: () => sky() + peak(240, 250, 200, 150, 'c-land', 'c-land2') + peak(900, 250, 240, 170, 'c-land', 'c-land2') + peak(590, 262, 260, 220, 'c-land', 'c-land2') +
    `<path class="o" fill="none" d="M590 42v-34"/><path class="o c-pop a-sway" d="M590 8h34l-8 9l8 9h-34z"/>` + folk(566, 70, 0.8, 'scarf') + `<g transform="translate(760 206)"><path class="o c-feat" d="M-22 0v-22l22-16l22 16v22z"/><rect class="o c-ink" x="-5" y="-14" width="10" height="14"/></g>` +
    `<g class="a-drift slow">${cloud(-40, 214, 2.4)}${cloud(260, 232, 2)}</g><g class="a-drift">${cloud(560, 226, 2.6)}${cloud(900, 216, 2.2)}</g>` + bird(380, 90, 1.3, 'a-drift slow') + `<path class="o c-far" d="M-5 276q300 -30 600 -6t610 -10V305H-5Z"/>`,

  capital: () => sky() + cloud(160, 36, 1, 'a-drift slow') + cloud(760, 50, 0.9, 'a-drift') + hills(176, 18, 1.5, 'c-far') +
    [[130, 200, 1.1], [200, 206, 1.4], [280, 198, 1.1], [360, 208, 1.5], [450, 202, 1.2], [540, 210, 1.5], [620, 204, 1.1]].map(([x, y, s], i) => house(x, y + 22, s, i % 2 ? 'c-feat' : 'c-pop')).join('') +
    `<g transform="translate(400 190)"><rect class="o c-paper" x="-22" y="-80" width="44" height="80"/><path class="o c-feat" d="M-28 -80l28-34l28 34z"/><circle class="o c-sky" cx="0" cy="-54" r="10"/><path class="o" fill="none" d="M0 -54v-7M0 -54h5M0 -114v-18"/><path class="o c-pop a-sway" d="M0 -132h24l-6 7l6 7h-24z"/></g>` +
    `<path class="o c-land" d="M-5 232H720q30 0 40 16H-5Z"/><path class="o c-land2" d="M-5 246H770V258H-5Z"/><path class="o" fill="none" d="M80 258v30M240 258v30M400 258v30M560 258v30M720 258v30"/>` + lighthouse(1090, 234, 0.95, 2) + `<path class="o c-land" d="M1020 234h140l30 71h-200z"/>` +
    folk(300, 232, 0.9, 'crown') + folk(520, 232, 0.9, 'cap') + folk(660, 232, 0.9, 'scarf') + `<path class="o c-feat" d="M580 232v-30h30v30z"/><path class="o c-pop" d="M586 202v-16h18v16z"/>` +
    boat(850, 256, 1.2) + boat(960, 268, 0.8) + waves(266, 'c-far', 'a-wave') + waves(282, 'c-pop', 'a-wave rev') + bird(880, 110, 1, 'a-drift') + bird(916, 124, 0.8, 'a-drift'),

  archive: () => sky() + cloud(300, 44, 1, 'a-drift slow') + waves(214, 'c-far', 'a-wave') + `<path class="o c-land" d="M340 250q120 -90 300 -84q160 6 250 84z"/>` +
    `<g transform="translate(610 190)"><path class="o c-paper" d="M-90 0v-60h180v60z"/><path class="o c-feat" d="M-104 -60l104-40l104 40z"/><path class="o c-paper" d="M-70 0v-54h14v54zM-28 0v-54h14v54zM14 0v-54h14v54zM56 0v-54h14v54z"/><path class="o c-land2" d="M-100 0h200v10h-200z"/></g>` +
    `<g transform="translate(450 214)"><path class="o" fill="none" d="M0 0v-36"/><rect class="o c-pop" x="-34" y="-58" width="68" height="24" rx="3"/><text x="0" y="-41" text-anchor="middle" class="sign">ARCHIVED</text></g>` + tree(790, 216, 1.1, 'c-far') + folk(730, 214, 0.9, 'cap') +
    `<path class="o c-feat" d="M360 238l40-10l6 8l-40 12z"/>` + waves(252, 'c-land2', 'a-wave rev') + waves(276, 'c-far', 'a-wave') + bird(900, 90, 1, 'a-drift slow'),
};

/** Full-width scenery banner for a region page. */
export function scene(kind, label) {
  const body = (SCENES[kind] || SCENES.meadow)();
  return `<svg class="scene-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${label}">${body}<rect class="tod" width="${W}" height="${H}"/></svg>`;
}

/** Small map glyphs, drawn around the origin. */
const ICONS = {
  meadow: () => `<path class="o" fill="none" d="M-14 10v-28M4 10v-28M-14 -6h18M-14 -18h18M-14 10l18-16"/><path class="o c-feat" d="M-18 -22h26v5h-26z"/>${tree(18, 12, 0.45)}`,
  plains: () => `<g transform="scale(.42) translate(0 34)"><path class="o c-feat" d="M-13 0l6-70h14l6 70z"/><g class="a-spin"><path class="o c-paper" d="M-3 -74h6l3-40h-12zM-3 -74h6l3 40h-12zM0 -77v6l40 3v-12zM0 -77v6l-40 3v-12z"/></g></g>`,
  harbor: () => `<rect class="o c-feat" x="-20" y="-2" width="20" height="11"/><rect class="o c-pop" x="0" y="-2" width="20" height="11"/><rect class="o c-paper" x="-10" y="-13" width="20" height="11"/>`,
  forest: () => `${pine(-16, 12, 0.36)}${pine(18, 12, 0.3)}<path class="o c-feat" d="M-8 12v-22h-2v-5h4v3h3v-3h6v3h3v-3h4v5h-2v22z"/>`,
  highlands: () => `<g transform="scale(.3) translate(0 46)"><path class="o c-feat" d="M-14 0l5-84h18l5 84z"/><rect class="o c-paper" x="-11" y="-108" width="22" height="24"/><path class="o c-ink" d="M-15 -108h30l-15-14z"/></g><path class="c-pop" d="M0 -18l26-6v12z" opacity=".7"/>`,
  workshop: () => `<g transform="scale(.5)">${gear(0, 0, 18, 'c-pop')}</g>${tree(-22, 12, 0.36)}`,
  desert: () => `<path class="o c-land2" d="M-24 10q10 -22 24 -22q14 0 24 22z"/><path class="o c-ink" d="M-5 10v-8a5 5 0 0 1 10 0v8z"/><circle class="o c-pop" cx="16" cy="-14" r="5"/>`,
  ice: () => `<path class="o c-land2" d="M-22 8l8-16h10l6 16zM4 8l6-12h10l6 12z"/><path class="o" fill="none" d="M-6 0q8 -10 16 0"/>`,
  volcano: () => `<path class="o c-land" d="M-22 10l14-26h12l14 26z"/><path class="o c-feat" d="M-8 -16h12l-3 6l-3-3l-3 4z"/><ellipse class="o c-land2" cx="24" cy="8" rx="10" ry="4"/>`,
  summit: () => `<path class="o c-land" d="M-24 10l18-30l10 14l6-8l14 24z"/><path class="o c-land2" d="M-11 -12l5-8l5 7l-3 2l-2-2l-2 3z"/>`,
  capital: () => `${house(-14, 10, 0.42, 'c-feat')}${house(4, 10, 0.55, 'c-pop')}<path class="o c-feat" d="M18 10v-22h8v22z"/><path class="o c-pop" d="M17 -12l5-7l5 7z"/>`,
  archive: () => `<path class="o c-paper" d="M-12 8v-12h24v12z"/><path class="o c-feat" d="M-15 -4l15-8l15 8z"/>`,
};
export const icon = (kind) => (ICONS[kind] || ICONS.meadow)();
export { folk, cloud, boat };
