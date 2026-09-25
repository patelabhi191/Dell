/* Interleaved A/B: alternates baseline and optimized runs in one browser so
   machine drift hits both arms equally. Reports median + IQR per metric. */
const { execFileSync } = require('child_process');
const fs = require('fs');

const { APP, BASELINE } = require('./paths');
const FILES = { baseline: BASELINE, optimized: APP };
const ROUNDS = parseInt(process.argv[2] || '9', 10);

const runs = { baseline: [], optimized: [] };
for (let i = 0; i < ROUNDS; i++) {
  for (const arm of ['baseline', 'optimized']) {
    const out = execFileSync('node', ['bench.js', FILES[arm], '1'], { encoding: 'utf8' });
    runs[arm].push(JSON.parse(out));
  }
  process.stderr.write(`round ${i + 1}/${ROUNDS}\n`);
}

const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };

const METRICS = [
  ['sizeBytes', 'File size (bytes)', 'lower'],
  ['loadWall', 'Wall-clock load (ms)', 'lower'],
  ['domInteractive', 'DOM interactive (ms)', 'lower'],
  ['dcl', 'DOMContentLoaded (ms)', 'lower'],
  ['load', 'load event (ms)', 'lower'],
  ['tabSwitch', 'Switch all 5 tabs (ms)', 'lower'],
  ['animRunning', 'Running CSS animations', 'lower'],
  ['idleLayoutCount', 'Layouts during 3s idle', 'lower'],
  ['domNodes', 'DOM nodes', 'flat'],
  ['failedReqs', 'Failed requests', 'lower'],
  ['consoleErrs', 'Console errors', 'lower'],
];

const rows = [];
for (const [key, label] of METRICS) {
  const b = runs.baseline.map(r => r[key] ?? 0);
  const o = runs.optimized.map(r => r[key] ?? 0);
  const mb = med(b), mo = med(o);
  const delta = mb === 0 ? 0 : ((mo - mb) / mb) * 100;
  rows.push({
    label,
    baseline: mb, optimized: mo,
    baselineIQR: `${q(b, 0.25)}–${q(b, 0.75)}`,
    optimizedIQR: `${q(o, 0.25)}–${q(o, 0.75)}`,
    deltaPct: +delta.toFixed(1),
  });
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`\nInterleaved A/B — ${ROUNDS} rounds per arm (median, IQR in brackets)\n`);
console.log(pad('Metric', 26) + lpad('Baseline', 16) + lpad('Optimized', 16) + lpad('Change', 10));
console.log('-'.repeat(68));
for (const r of rows) {
  const sign = r.deltaPct > 0 ? '+' : '';
  console.log(
    pad(r.label, 26) +
    lpad(`${r.baseline} [${r.baselineIQR}]`, 16) +
    lpad(`${r.optimized} [${r.optimizedIQR}]`, 16) +
    lpad(`${sign}${r.deltaPct}%`, 10));
}
fs.writeFileSync('ab-results.json', JSON.stringify({ rounds: ROUNDS, rows, raw: runs }, null, 2));
console.log('\nwrote ab-results.json');
