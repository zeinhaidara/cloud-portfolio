// Replays real investigations captured from the live GCP AI Log Analyzer (synthetic logs, 9 Oct 2026).
// Logs and findings are verbatim from the app's API; only the step animation is client-side.
(function () {
  const CASES = {
    token: {
      file: 'token-expiry.txt', history: 0, category: 'authentication',
      log: [
        '09:30:00Z INFO service=gateway trace=session-41 target=api status=200 message="Profile request accepted"',
        '09:30:00.100Z INFO service=api trace=session-41 target=auth status=200 message="Session validated"',
        '09:30:01Z INFO service=auth message="deploy revision=auth-v8 token_ttl_seconds=30 previous_ttl_seconds=3600"',
        '09:30:31Z WARN service=auth trace=session-42 message="Token expired; refresh required"',
        '09:30:31.100Z ERROR service=auth trace=session-42 status=401 message="expired_token age_seconds=31"',
        '09:30:31.200Z ERROR service=api trace=session-42 upstream=auth status=401 message="Session validation failed"',
        '09:30:32Z ERROR service=gateway trace=session-42 target=api status=401 message="Customer unexpectedly signed out"',
        '09:30:33Z WARN service=api trace=session-42 target=auth retry=1 message="Refreshing expired session"',
        '09:30:34Z INFO service=auth trace=session-42 status=200 message="New token issued; session recovered"',
        '09:30:34.100Z INFO service=api trace=session-42 upstream=auth status=200 message="Profile request recovered"',
        '09:30:35Z INFO service=gateway trace=session-42 target=api status=200 message="Profile loaded; recovery observed"',
      ],
      findings: {
        severity: 'warning',
        summary: 'Users experienced intermittent session invalidation and 401 errors following a deployment to the auth service that significantly reduced token TTL.',
        hypothesis: { title: 'Reduced Token TTL causing premature expiration', lines: [3, 4, 5, 6] },
        likely_cause: 'The deployment of auth-v8 reduced the token_ttl_seconds from 3600 to 30, causing existing sessions to expire prematurely and trigger 401 errors.',
        recommendations: [
          'Verify if the reduction in token_ttl_seconds was intentional.',
          'Review the auth service deployment configuration for unintended parameter changes.',
          'Monitor auth service logs for an increase in token refresh requests.',
          'Evaluate if the client-side session management logic handles short-lived tokens gracefully.',
          'Consider implementing a rolling update strategy to allow token transition periods.',
        ],
      },
    },
    payment: {
      file: 'payment-recovery.txt', history: 0, category: 'payment_timeout',
      log: [
        '16:40:00Z INFO service=checkout trace=payment-91 target=payments message="Payment initiated"',
        '16:40:00.100Z INFO service=payments trace=payment-91 target=provider message="Authorization sent"',
        '16:40:05Z ERROR service=provider trace=payment-91 status=504 message="Payment authorization timed out"',
        '16:40:05.100Z WARN service=payments trace=payment-91 target=provider retry=1 message="Payment timeout; first retry"',
        '16:40:07Z WARN service=payments trace=payment-91 target=provider retry=2 message="Second retry with backoff"',
        '16:40:08Z INFO service=provider trace=payment-91 status=200 message="Provider recovered; authorization accepted"',
        '16:40:08.100Z INFO service=payments trace=payment-91 upstream=provider status=200 message="Payment recovered; authorization recorded"',
        '16:40:08.200Z INFO service=checkout trace=payment-91 upstream=payments status=200 message="Order confirmed after recovery"',
        '16:40:09Z INFO service=checkout trace=payment-92 target=payments message="Next payment initiated"',
        '16:40:09.100Z INFO service=payments trace=payment-92 target=provider status=200 message="Next authorization completed without retry"',
      ],
      findings: {
        severity: 'warning',
        summary: 'A payment authorization request experienced a 504 Gateway Timeout from the provider service, which was subsequently resolved through automated retries.',
        hypothesis: { title: 'Transient Provider Latency', lines: [3, 4, 5, 6] },
        likely_cause: 'Transient network latency or temporary resource exhaustion at the provider service endpoint.',
        recommendations: [
          'Review provider service metrics for latency spikes during the 16:40:05Z window.',
          'Analyze provider service logs for resource contention or garbage collection pauses.',
          'Verify the timeout configuration for the payments service to ensure it aligns with provider SLAs.',
          'Monitor for recurring 504 errors to determine if this is a systemic issue or an isolated event.',
          'Evaluate the effectiveness of the current retry backoff strategy.',
        ],
      },
    },
    database: {
      file: 'analytics-vpc-database-test-2.txt', history: 1, category: 'database_timeout', service: 'orders',
      log: [
        '17:05:00Z INFO orders started',
        '17:05:01Z ERROR database timed out again',
        '17:05:02Z WARN retry backoff increased',
      ],
      findings: {
        severity: 'error',
        summary: 'The order processing service encountered a database timeout error during execution, triggering an automatic retry with an increased backoff period.',
        hypothesis: null,
        likely_cause: 'Intermittent database connectivity issues or resource contention causing query execution to exceed the configured timeout threshold.',
        recommendations: [
          'Check database server performance metrics for spikes in CPU or memory usage during the time of the error.',
          'Review database connection pool settings to ensure they are appropriately sized for current traffic.',
          'Analyze slow query logs to identify any long-running transactions that may be blocking other requests.',
          'Verify network latency between the application server and the database instance.',
          'Increase the database timeout threshold if the current setting is too aggressive for the workload.',
        ],
      },
    },
  };
  const STEPS = (c) => [
    ['Saved', 'Raw file to Cloud Storage, metadata and ERROR/WARN counts to Firestore.'],
    ['Queued', 'The dashboard publishes only {"log_id"} to Pub/Sub, never the log text.'],
    ['Claimed', 'Authenticated push wakes the private agent; a Firestore lease blocks duplicates.'],
    ['History', c.history ? `BigQuery returns ${c.history} similar incident from the last 7 days (${c.category}).` : `BigQuery finds no similar incident in the last 7 days (${c.category}).`],
    ['Gemini', 'One ADK call to Gemini on Vertex AI: temperature 0, structured output, log treated as data.'],
    ['Findings', 'Findings saved to Firestore; the dashboard polling picks them up.'],
    ['Recorded', 'Incident summary appended to BigQuery with a deterministic job ID.'],
  ];

  const root = document.getElementById('replay');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, fast ? 0 : ms));
  let current = 'token', run = 0;

  function showLog(c, hot) {
    const pre = $('#rp-log');
    pre.replaceChildren(...c.log.map((line, i) => {
      const row = document.createElement('div');
      const level = /\bERROR\b/.test(line) ? 'err' : /\bWARN\b/.test(line) ? 'warn' : '';
      row.className = 'ln ' + level + (hot && hot.includes(i + 1) ? ' hot' : '');
      row.innerHTML = '<span class="no">' + (i + 1) + '</span>';
      row.append(document.createTextNode(line));
      return row;
    }));
    $('#rp-file').textContent = c.file;
  }
  function reset() {
    const c = CASES[current];
    showLog(c);
    $('#rp-steps').replaceChildren(...STEPS(c).map(([name, text], i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="dot">' + (i + 1) + '</span><b>' + name + '</b><small></small>';
      li.querySelector('small').textContent = text;
      return li;
    }));
    $('#rp-out').hidden = true;
    $('#rp-run').disabled = false;
    $('#rp-run').textContent = 'Run investigation';
    $('#rp-status').textContent = 'Pick a log, then run the investigation.';
  }
  async function start() {
    const me = ++run, c = CASES[current], items = [...$('#rp-steps').children];
    $('#rp-run').disabled = true;
    $('#rp-out').hidden = true;
    items.forEach((li) => { li.className = ''; });
    const steps = STEPS(c);
    for (const [i, li] of items.entries()) {
      if (me !== run) return;
      li.className = 'run';
      $('#rp-status').textContent = steps[i][0] + ': ' + steps[i][1];
      await wait(li === items[4] ? 1100 : 520);
      if (me !== run) return;
      li.className = 'done';
    }
    const f = c.findings;
    $('#rp-sev').textContent = f.severity;
    $('#rp-sev').className = 'sev ' + f.severity;
    $('#rp-sum').textContent = f.summary;
    $('#rp-hyp').hidden = !f.hypothesis;
    if (f.hypothesis) $('#rp-hyp-t').textContent = f.hypothesis.title + ' (evidence: lines ' + f.hypothesis.lines.join(', ') + ')';
    $('#rp-cause').textContent = f.likely_cause;
    $('#rp-recs').replaceChildren(...f.recommendations.map((r) => Object.assign(document.createElement('li'), { textContent: r })));
    $('#rp-meta').textContent = 'gemini-3.1-flash-lite · history used: ' + c.history + ' · category: ' + c.category + (c.service ? ' · service: ' + c.service : '');
    showLog(c, f.hypothesis ? f.hypothesis.lines : null);
    $('#rp-status').textContent = 'Done. Evidence lines are highlighted in the log.';
    if (!f.hypothesis) $('#rp-status').textContent = 'Done. This log had one similar past incident in BigQuery as context.';
    $('#rp-out').hidden = false;
    $('#rp-run').disabled = false;
    $('#rp-run').textContent = 'Run again';
  }
  root.querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => {
    current = b.dataset.case;
    run++;
    root.querySelectorAll('[data-case]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    reset();
  }));
  $('#rp-run').addEventListener('click', start);
  reset();
})();
