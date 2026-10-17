const { serve, launch, stub } = require('../lib.js');
const { SEED } = require('./fixture-5-years.js');
const { APP } = require('../paths');
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] };
const f2 = n => (Math.round(n * 100) / 100).toFixed(2);

(async () => {
  const srv = await serve(APP); const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await stub(page);
  await page.addInitScript(s => {
    try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) {}
  }, SEED);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(500);

  /* ---- storage footprint, split by drawer ---- */
  const store = await page.evaluate(() => {
    const out = { plain: 0, ns: 0, other: 0, keys: [] };
    Object.keys(localStorage).forEach(k => {
      const n = k.length + (localStorage.getItem(k) || '').length;
      out.keys.push([k, n]);
      if (/^sparta\.[A-Za-z0-9]{4,}\./.test(k) && !/^sparta\.(dash|yf|me|contrib)\./.test(k)) out.ns += n;
      else if (k.startsWith('sparta.')) out.plain += n;
      else out.other += n;
    });
    out.keys.sort((a, b) => b[1] - a[1]);
    return out;
  });
  console.log('LOCALSTORAGE FOOTPRINT');
  console.log('  total      ', (((store.plain + store.ns + store.other)) / 1048576).toFixed(2), 'MB');
  console.log('  namespaced ', (store.ns / 1048576).toFixed(2), 'MB   <- what the app reads');
  console.log('  plain      ', (store.plain / 1048576).toFixed(2), 'MB   <- pre-namespace originals, never deleted');
  console.log('  biggest keys:');
  store.keys.slice(0, 6).forEach(([k, n]) => console.log('    ' + (n / 1024).toFixed(0).padStart(5) + ' KB  ' + k));
  console.log('  against a typical 5 MB origin quota: ' +
    (((store.plain + store.ns + store.other) / 1048576 / 5) * 100).toFixed(0) + '% used\n');

  /* ---- IS ANYTHING QUADRATIC? Same code, four ledger sizes.
     Linear => time roughly doubles with rows. Quadratic => it quadruples. ---- */
  const base = JSON.parse(SEED['sparta.yf.data']);
  console.log('SCALING -- the brief asks for anything quadratic in row count.');
  console.log('Same functions, the ledger truncated to four sizes (median of 5):\n');
  console.log('  rows    normalizeYF   renderYF   renderME   render()  renderContribs');
  const rowsSet = [860, 1720, 3441, 6882];
  const table = [];
  for (const want of rowsSet) {
    const t = await page.evaluate(({ b, want }) => {
      // grow by repeating with fresh ids when we need more than the fixture has
      let txns = b.txns.slice(0, Math.min(want, b.txns.length));
      let g = 0;
      while (txns.length < want) txns = txns.concat(b.txns.map(r => Object.assign({}, r, { id: r.id + '-g' + g })).slice(0, want - txns.length)), g++;
      state.yf = Object.assign({}, b, { txns });
      normalizeYF();
      const run = fn => { const r = []; for (let i = 0; i < 5; i++) { const a = performance.now(); fn(); r.push(performance.now() - a) } r.sort((x, y) => x - y); return r[2] };
      return { n: state.yf.txns.length,
        nyf: run(() => normalizeYF()), yf: run(() => renderYF()), me: run(() => renderME()),
        dash: run(() => render()), con: run(() => renderContribs()) };
    }, { b: base, want });
    table.push(t);
    console.log('  ' + String(t.n).padEnd(8) + f2(t.nyf).padStart(9) + f2(t.yf).padStart(12) +
      f2(t.me).padStart(11) + f2(t.dash).padStart(11) + f2(t.con).padStart(13));
  }
  console.log('\n  growth factor per doubling of rows (2.0 = linear, 4.0 = quadratic):');
  for (let i = 1; i < table.length; i++) {
    const p = table[i - 1], c = table[i];
    const r = (a, b) => b > 0.05 ? (a / b).toFixed(2) : 'n/a';
    console.log(`    ${p.n} -> ${c.n}:  normalizeYF ${r(c.nyf, p.nyf)}   renderYF ${r(c.yf, p.yf)}   renderME ${r(c.me, p.me)}   render() ${r(c.dash, p.dash)}   renderContribs ${r(c.con, p.con)}`);
  }
  console.log('\nPAGE ERRORS:', errs.length ? '\n  ' + errs.join('\n  ') : 'none');
  await ctx.close(); await browser.close(); srv.close();
})();
