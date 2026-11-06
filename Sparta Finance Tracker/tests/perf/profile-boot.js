const { serve, launch, stub } = require('../lib.js');
const { SEED, stats } = require('./fixture-5-years.js');
const { APP } = require('../paths');
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] };
const f2 = n => (Math.round(n * 100) / 100).toFixed(2);

(async () => {
  const srv = await serve(APP); const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  console.log('FIXTURE:', JSON.stringify(stats));
  console.log('seed payload:', (stats.seedBytes / 1024).toFixed(0), 'KB\n');

  /* ---- 1. COLD BOOT, repeated, each in a brand-new context ----
     Every script in this app runs synchronously in the body, so the whole boot
     -- adoption, the normalisers, compactHistory, arcAutoSeal and the first
     render() -- has finished by domContentLoaded. That is the number a user
     waits for, so it is the one reported. */
  const boots = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await stub(page);
    await page.addInitScript(s => {
      try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) {}
    }, SEED);
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(url, { waitUntil: 'load' });
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return { dcl: n.domContentLoadedEventEnd - n.startTime,
               load: n.loadEventEnd - n.startTime,
               respEnd: n.responseEnd - n.startTime,
               domInt: n.domInteractive - n.startTime };
    });
    boots.push(t);
    if (i === 0) {
      const sane = await page.evaluate(() => ({
        hero: (document.getElementById('heroVal') || {}).textContent,
        rows: document.querySelectorAll('#hbody tr').length,
        txns: state.yf.txns.length, hist: state.history.length,
        arch: state.archives.length, contribs: state.contribs.length,
        plan: state.plan.segments.length,
        lsBytes: Object.keys(localStorage).reduce((a, k) => a + k.length + localStorage.getItem(k).length, 0),
        lsKeys: Object.keys(localStorage).length,
      }));
      console.log('LOADED STATE:', JSON.stringify(sane));
      console.log('page errors on boot:', errs.length ? errs.join(' | ') : 'none');
      console.log('localStorage after boot:', (sane.lsBytes / 1024 / 1024).toFixed(2), 'MB in', sane.lsKeys, 'keys');
      console.log('  (the adoption block copies every plain sparta.* key into the');
      console.log('   namespaced drawer, so the footprint is about double the seed)\n');
    }
    await ctx.close();
  }
  console.log('COLD BOOT, 5 runs, ms:');
  console.log('  responseEnd (network+parse of the 560KB file):', f2(med(boots.map(b => b.respEnd))));
  console.log('  domInteractive:                               ', f2(med(boots.map(b => b.domInt))));
  console.log('  domContentLoaded  <- app fully booted:        ', f2(med(boots.map(b => b.dcl))));
  console.log('  loadEventEnd:                                 ', f2(med(boots.map(b => b.load))));
  console.log('  all five dcl:', boots.map(b => f2(b.dcl)).join('  '), '\n');

  /* ---- 2. where the boot time goes ---- */
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  await page.addInitScript(s => {
    try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) {}
  }, SEED);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) errs.push('console: ' + m.text()) });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const phases = await page.evaluate(() => {
    const t = (label, fn, iters) => {
      const runs = [];
      for (let i = 0; i < (iters || 7); i++) { const a = performance.now(); fn(); runs.push(performance.now() - a) }
      runs.sort((x, y) => x - y);
      return { label, med: runs[Math.floor(runs.length / 2)], min: runs[0], max: runs[runs.length - 1] };
    };
    const out = [];
    out.push(t('JSON.parse the yf ledger', () => JSON.parse(localStorage.getItem('sparta.' + DB_ID + '.yf.data') || localStorage.getItem('sparta.yf.data'))));
    out.push(t('normalizeYF()', () => normalizeYF()));
    out.push(t('normalizeME()', () => normalizeME()));
    out.push(t('normalizePlan()', () => normalizePlan()));
    out.push(t('normalizeNotes()', () => normalizeNotes()));
    out.push(t('normalizeArchives()', () => normalizeArchives()));
    out.push(t('histPts(4000 points)', () => histPts(state.history)));
    out.push(t('render()  [Dashboard]', () => render()));
    out.push(t('renderYF()', () => renderYF()));
    out.push(t('renderME()', () => renderME()));
    out.push(t('renderContribs()', () => renderContribs()));
    out.push(t('renderArchives()', () => renderArchives()));
    out.push(t('renderPlan()', () => renderPlan()));
    out.push(t('renderNotes()', () => renderNotes()));
    out.push(t('snapshot() + persist()', () => { snapshot(true); persist() }, 5));
    out.push(t('persist() alone', () => persist(), 5));
    return out;
  });
  console.log('PHASE COSTS (median of 7, ms) -- re-invoked on the loaded fixture:');
  phases.forEach(p => console.log('  ' + p.label.padEnd(30), f2(p.med).padStart(8),
    ' [min ' + f2(p.min) + ' max ' + f2(p.max) + ']'));

  /* compactHistory and arcAutoSeal do real work only on their FIRST run, so
     their inputs are reset before each timing or the number is a no-op. */
  const firstRun = await page.evaluate(() => {
    const raw = JSON.parse(JSON.stringify(state.history));
    const runs = [];
    for (let i = 0; i < 5; i++) {
      state.history = JSON.parse(JSON.stringify(raw));
      const a = performance.now(); const removed = compactHistory();
      runs.push({ ms: performance.now() - a, removed, left: state.history.length });
    }
    const arcRaw = JSON.parse(JSON.stringify(state.archives));
    const arcRuns = [];
    for (let i = 0; i < 5; i++) {
      state.archives = []; store.set('sparta.arcDeleted', []);
      const a = performance.now(); const n = arcAutoSeal();
      arcRuns.push({ ms: performance.now() - a, sealed: n });
    }
    state.archives = arcRaw; store.set('sparta.archives', arcRaw);
    return { compact: runs, arc: arcRuns };
  });
  console.log('\nFIRST-RUN COSTS (input reset before each, ms):');
  console.log('  compactHistory():', f2(med(firstRun.compact.map(r => r.ms))),
    '-> removed', firstRun.compact[0].removed, 'of 4000, leaving', firstRun.compact[0].left);
  console.log('  arcAutoSeal():   ', f2(med(firstRun.arc.map(r => r.ms))),
    '-> sealed', firstRun.arc[0].sealed, 'years from the ledger');

  /* ---- 3. tab switches, click to painted ---- */
  console.log('\nTAB SWITCH (click -> next frame after render, ms):');
  for (const v of ['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan']) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      await page.click('#viewSeg button[data-view="' + (v === 'dash' ? 'yearly' : 'dash') + '"]');
      await page.waitForTimeout(220);
      const ms = await page.evaluate(async view => {
        const btn = document.querySelector('#viewSeg button[data-view="' + view + '"]');
        const a = performance.now();
        btn.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return performance.now() - a;
      }, v);
      runs.push(ms);
    }
    console.log('  ' + v.padEnd(10), f2(med(runs)).padStart(8), ' [all: ' + runs.map(r => f2(r)).join(' ') + ']');
  }

  /* ---- 4. typing latency under load ---- */
  console.log('\nTYPING LATENCY under this ledger (ms per keystroke, in-page handler + frame):');
  await page.click('#viewSeg button[data-view="dash"]');
  await page.waitForTimeout(300);
  const typing = await page.evaluate(async () => {
    const out = {};
    const run = async (sel, label) => {
      const el = document.querySelector(sel); if (!el) return out[label] = 'absent';
      el.focus();
      const runs = [];
      for (let i = 0; i < 25; i++) {
        const a = performance.now();
        el.value += 'x';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => requestAnimationFrame(r));
        runs.push(performance.now() - a);
      }
      runs.sort((x, y) => x - y);
      out[label] = { med: runs[Math.floor(runs.length / 2)], max: runs[runs.length - 1] };
    };
    await run('#npText', 'notepad');
    await run('#npStockInput', 'eye-on-stocks input');
    return out;
  });
  Object.entries(typing).forEach(([k, v]) => console.log('  ' + k.padEnd(22),
    typeof v === 'string' ? v : f2(v.med).padStart(8) + '  [max ' + f2(v.max) + ']'));

  const typeYf = await page.evaluate(async () => {
    document.querySelector('#viewSeg button[data-view="yearly"]').click();
    await new Promise(r => setTimeout(r, 400));
    const el = document.querySelector('#yfSearch') || document.querySelector('#yfTxTable') && null;
    if (!el) return 'no yearly filter field found';
    el.focus();
    const runs = [];
    for (let i = 0; i < 20; i++) {
      const a = performance.now();
      el.value = 'Expense ' + (i % 7);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(r));
      runs.push(performance.now() - a);
    }
    runs.sort((x, y) => x - y);
    return { med: runs[Math.floor(runs.length / 2)], max: runs[runs.length - 1] };
  });
  console.log('  ' + 'yearly filter field'.padEnd(22),
    typeof typeYf === 'string' ? typeYf : f2(typeYf.med).padStart(8) + '  [max ' + f2(typeYf.max) + ']');

  console.log('\nPAGE ERRORS across the whole profile:', errs.length ? '\n  ' + errs.join('\n  ') : 'none');
  await ctx.close(); await browser.close(); srv.close();
})();
