// "Ship a change": a small simulation of the healthcare-eks-secops delivery gates.
// Gate names and rules come from the repo's controls register; the changes are simulated.
(function () {
  const STAGES = [
    { id: 'pr', name: 'Pull request', sub: 'ci.yml · read-only token · no AWS access' },
    { id: 'gitleaks', name: 'Secrets', sub: 'gitleaks over full history' },
    { id: 'trivy', name: 'Dependencies', sub: 'Trivy · fixable HIGH/CRITICAL fails' },
    { id: 'checkov', name: 'IaC policy', sub: 'Checkov · Terraform, Dockerfile, workflows' },
    { id: 'codeql', name: 'Code analysis', sub: 'CodeQL + SonarCloud gate' },
    { id: 'image', name: 'Image', sub: 'build, Trivy scan, push to ECR by SHA' },
    { id: 'dev', name: 'Argo CD → dev', sub: 'digest committed to Git · auto sync' },
    { id: 'prod', name: 'Argo CD → prod', sub: 'tracks main · admin approves sync' },
  ];
  const SCENARIOS = {
    clean: { failAt: null },
    secret: { failAt: 'gitleaks', msg: 'gitleaks found an AWS access key in app/src/settings.py. The job fails and main requires it, so the merge is blocked.' },
    vuln: { failAt: 'trivy', msg: 'Trivy found a HIGH severity vulnerability with a fixed version available in app/requirements.txt. Fixable HIGH or CRITICAL fails the job, so the merge is blocked.' },
    bucket: { failAt: 'checkov', msg: 'Checkov CKV_AWS_20: the S3 bucket ACL allows public read. A skip needs an entry in the exceptions register, and this one has none, so the merge is blocked.' },
  };

  const root = document.getElementById('sim');
  if (!root) return;
  const track = document.getElementById('sim-track');
  const log = document.getElementById('sim-log');
  const approve = document.getElementById('sim-approve');
  const picks = root.querySelectorAll('[data-scn]');
  const fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = {};
  let run = 0;

  STAGES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="dot" aria-hidden="true">' + (i + 1) + '</span><b>' + s.name + '</b><small>' + s.sub + '</small>';
    track.appendChild(li);
    els[s.id] = li;
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, fast ? 0 : ms));
  const set = (id, state) => { els[id].className = state; };
  const say = (text, tone) => { log.className = 'sim-log ' + (tone || ''); log.textContent = text; };
  const lock = (on) => picks.forEach((b) => { b.disabled = on; });

  async function start(key, btn) {
    const me = ++run;
    const scn = SCENARIOS[key];
    picks.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    approve.hidden = true;
    STAGES.forEach((s) => set(s.id, ''));
    lock(true);
    say('Running: ' + btn.textContent.trim() + '…');
    for (const s of STAGES) {
      if (me !== run) return;
      if (s.id === 'prod') {
        set('prod', 'wait');
        say('Dev synced automatically. Prod tracks main and waits for an admin to approve the sync in Argo CD.', 'ok');
        approve.hidden = false;
        approve.focus({ preventScroll: true });
        lock(false);
        return;
      }
      set(s.id, 'run');
      await wait(550);
      if (me !== run) return;
      if (scn.failAt === s.id) {
        set(s.id, 'fail');
        say(scn.msg + ' Nothing reached the cluster.', 'bad');
        lock(false);
        return;
      }
      set(s.id, 'pass');
    }
  }

  picks.forEach((b) => b.addEventListener('click', () => start(b.dataset.scn, b)));
  approve.addEventListener('click', () => {
    set('prod', 'pass');
    approve.hidden = true;
    say('Prod synced to the same image digest that was scanned and tested in dev.', 'ok');
  });
})();
