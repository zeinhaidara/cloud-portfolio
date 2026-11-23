// Code Clinic page: filter the cards by category (toggle buttons) and by words in their title, skills and stack.
// Everything is in the page already; without JavaScript all cards show and the controls do nothing.
(function () {
  const list = document.getElementById('cc-list');
  if (!list) return;
  const cards = [...list.children], buttons = [...document.querySelectorAll('.cc-cats button')];
  const q = document.getElementById('cc-q'), count = document.getElementById('cc-count'), empty = document.getElementById('cc-empty');
  let cat = '';

  function apply() {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const c of cards) {
      const ok = (!cat || c.dataset.cat === cat) && words.every((w) => c.dataset.text.includes(w));
      c.hidden = !ok;
      if (ok) shown++;
    }
    count.textContent = 'Showing ' + shown + ' of ' + cards.length + ' challenges';
    empty.hidden = shown > 0;
  }
  function choose(value) {
    cat = value;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.cat === value));
    apply();
  }
  for (const b of buttons) b.addEventListener('click', () => choose(b.dataset.cat));
  q.addEventListener('input', apply);
  document.getElementById('cc-clear').addEventListener('click', () => { q.value = ''; choose(''); q.focus(); });
  apply(); // a browser may restore the search text on back navigation
})();
