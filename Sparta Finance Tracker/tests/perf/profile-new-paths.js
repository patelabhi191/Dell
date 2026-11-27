/* The paths added after the first profiling pass: the Ask engine, Highlights,
   the dashboard normaliser, saving one row, and building the cloud payload.
   Same fixture and the same rule as the other probes: it measures, it asserts
   nothing, and run-all.sh does not run it. */
const { serve, launch, stub } = require('../lib.js');
const { SEED } = require('./fixture-5-years.js');
const { APP } = require('../paths');

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

  const base = JSON.parse(SEED['sparta.yf.data']);
  console.log('rows     ask(10 chips)  askWorst  yfHiBuild  normDash  yfPersist  corePayload+JSON  txTable rows');
  for (const mult of [0.5, 1, 2, 4]) {
    const r = await page.evaluate(({ base, mult }) => {
      const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] };
      const time = (fn, n = 5) => { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); fn(); t.push(performance.now() - a) } return med(t) };
      let tx = base.txns;
      if (mult < 1) tx = tx.slice(0, Math.floor(tx.length * mult));
      else { const out = []; for (let k = 0; k < mult; k++) tx.forEach(t => out.push(Object.assign({}, t, { id: t.id + '_' + k,
        allot: t.allot ? t.allot + '_' + k : t.allot }))); tx = out; }
      state.yf = Object.assign({}, base, { txns: tx }); normalizeYF();
      applyView('yearly');
      const qs = ASK_CHIP_ORDER.map(id => (ASK_INTENTS.find(i => i.id === id) || {}).chip).filter(Boolean);
      const per = qs.map(q => [q, time(() => yfAsk(q), 3)]);
      const worst = per.slice().sort((a, b) => b[1] - a[1])[0];
      return { rows: tx.length,
        ask: per.reduce((a, b) => a + b[1], 0), worst: worst[0] + ' ' + worst[1].toFixed(1),
        hi: time(() => yfHiBuild()), nd: time(() => normalizeDash()),
        persist: time(() => store.set('sparta.yf.data', state.yf)),
        core: time(() => JSON.stringify(corePayload()), 3),
        dom: document.querySelectorAll('#yfTxBody tr').length };
    }, { base, mult });
    console.log(String(r.rows).padEnd(8), r.ask.toFixed(1).padStart(10), '   ', r.worst.padEnd(24).slice(0, 24),
      r.hi.toFixed(1).padStart(6), r.nd.toFixed(2).padStart(9), r.persist.toFixed(1).padStart(9),
      r.core.toFixed(1).padStart(12), String(r.dom).padStart(12));
  }
  console.log('\nPAGE ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await browser.close(); srv.close();
})();
