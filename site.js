// All-projects page: filter the table by text, zone, domain, stack and validation level.
// Filters are mirrored in the query string so a filtered view can be shared. Without JavaScript the full table shows.
(function () {
  const form = document.getElementById('filters');
  if (!form) return;
  const rows = [...document.querySelectorAll('#plist tbody tr')];
  const f = { q: document.getElementById('f-q'), zone: document.getElementById('f-zone'), domain: document.getElementById('f-domain'), stack: document.getElementById('f-stack'), v: document.getElementById('f-v') };
  const count = document.getElementById('count'), empty = document.getElementById('empty'), wrap = document.querySelector('.plist');
  const params = new URLSearchParams(location.search);
  for (const k in f) if (params.has(k)) f[k].value = params.get(k);

  function apply() {
    const q = f.q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const r of rows) {
      const d = r.dataset;
      const ok = (!f.zone.value || d.zone === f.zone.value) && (!f.domain.value || d.domain === f.domain.value) && (!f.v.value || d.v === f.v.value)
        && (!f.stack.value || d.stack.split('|').includes(f.stack.value)) && q.every((w) => d.text.includes(w));
      r.hidden = !ok;
      if (ok) shown++;
    }
    count.textContent = shown + ' of ' + rows.length + ' projects';
    empty.hidden = shown > 0;
    wrap.hidden = shown === 0;
    const p = new URLSearchParams();
    for (const k in f) if (f[k].value) p.set(k, f[k].value);
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }
  form.addEventListener('input', apply);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(apply));
  document.getElementById('f-clear').addEventListener('click', () => { form.reset(); setTimeout(apply); });
  apply();
})();
