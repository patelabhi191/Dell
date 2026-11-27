const { serve, launch, stub } = require('../lib.js');
const { SEED, stats } = require('./fixture-5-years.js');
const { APP } = require('../paths');
const RAW_HISTORY = JSON.parse(SEED['sparta.dash.history']);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] };
const f2 = n => (Math.round(n * 100) / 100).toFixed(2);
const spread = a => `${f2(Math.min(...a))}–${f2(Math.max(...a))}`;

(async () => {
  const srv = await serve(APP); const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  await page.addInitScript(s => {
    try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) {}
  }, SEED);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) errs.push('console: ' + m.text()) });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  /* ---- compactHistory on GENUINELY RAW points.
     The first pass reset state.history to a copy taken AFTER boot had already
     folded it to 92, so it measured a no-op and reported "removed 0 of 4000".
     The raw array is injected from the fixture instead. */
  const compact = await page.evaluate(raw => {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      state.history = JSON.parse(JSON.stringify(raw));
      const before = state.history.length;
      const a = performance.now(); const removed = compactHistory();
      runs.push({ ms: performance.now() - a, before, removed, left: state.history.length });
    }
    return runs;
  }, RAW_HISTORY);
  console.log('compactHistory() on 4,000 RAW points, 5 runs with the input reset each time:');
  console.log('  median', f2(med(compact.map(r => r.ms))), 'ms   spread', spread(compact.map(r => r.ms)), 'ms');
  console.log('  folded', compact[0].before, '->', compact[0].left, 'points (removed', compact[0].removed + ')\n');

  /* ---- histPts on raw too ---- */
  const hp = await page.evaluate(raw => {
    const runs = []; for (let i = 0; i < 7; i++) { const a = performance.now(); histPts(raw); runs.push(performance.now() - a) }
    return runs;
  }, RAW_HISTORY);
  console.log('histPts() on 4,000 raw points:', f2(med(hp)), 'ms   spread', spread(hp), 'ms\n');

  /* ---- typing, on the surfaces that actually have input handlers ---- */
  await page.click('#viewSeg button[data-view="dash"]');
  await page.waitForTimeout(400);
  const typing = await page.evaluate(async () => {
    const out = {};
    // #npPoints carries a DELEGATED input listener; the fields inside it are the
    // notepad's 40 points. This is the real typing surface on the Dashboard.
    const field = document.querySelector('#npPoints input, #npPoints textarea, #npPoints [contenteditable]');
    if (!field) { out.notepad = 'no field inside #npPoints'; }
    else {
      field.focus(); const runs = [];
      for (let i = 0; i < 30; i++) {
        const a = performance.now();
        if ('value' in field) field.value += 'x'; else field.textContent += 'x';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => requestAnimationFrame(r));
        runs.push(performance.now() - a);
      }
      runs.sort((x, y) => x - y);
      out.notepad = { tag: field.tagName.toLowerCase(), med: runs[Math.floor(runs.length / 2)],
        p90: runs[Math.floor(runs.length * 0.9)], max: runs[runs.length - 1] };
    }
    return out;
  });
  console.log('TYPING in a notepad point (delegated input on #npPoints, 30 keystrokes):');
  console.log(' ', typeof typing.notepad === 'string' ? typing.notepad
    : `<${typing.notepad.tag}>  median ${f2(typing.notepad.med)} ms, p90 ${f2(typing.notepad.p90)}, max ${f2(typing.notepad.max)}`);

  // the sell modal's qty/price recompute a live preview on every keystroke
  const sellType = await page.evaluate(async () => {
    const row = document.querySelector('#hbody .rm.sell');
    if (!row) return 'no sell button';
    row.click();
    await new Promise(r => setTimeout(r, 350));
    const el = document.getElementById('sellQty');
    if (!el || !el.offsetParent) return 'sell modal did not open';
    el.focus(); const runs = [];
    for (let i = 0; i < 30; i++) {
      const a = performance.now();
      el.value = String(1 + (i % 9)) + '.' + (i % 10);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(r));
      runs.push(performance.now() - a);
    }
    runs.sort((x, y) => x - y);
    const close = document.getElementById('sellCancel') || document.querySelector('#sellModal .btn');
    if (close) close.click();
    return { med: runs[Math.floor(runs.length / 2)], p90: runs[Math.floor(runs.length * 0.9)], max: runs[runs.length - 1] };
  });
  console.log('TYPING in the sell modal qty (live preview recompute, 30 keystrokes):');
  console.log(' ', typeof sellType === 'string' ? sellType
    : `median ${f2(sellType.med)} ms, p90 ${f2(sellType.p90)}, max ${f2(sellType.max)}`);

  /* ---- an idle control: how long does a bare rAF cost here? That is the floor
     every "per keystroke" figure above sits on, and without it a 16ms frame
     reads as 16ms of app work. ---- */
  const floor = await page.evaluate(async () => {
    const runs = [];
    for (let i = 0; i < 30; i++) { const a = performance.now(); await new Promise(r => requestAnimationFrame(r)); runs.push(performance.now() - a) }
    runs.sort((x, y) => x - y);
    return { med: runs[Math.floor(runs.length / 2)], max: runs[runs.length - 1] };
  });
  console.log('\nMEASUREMENT FLOOR -- a bare requestAnimationFrame with no work:',
    f2(floor.med), 'ms  [max', f2(floor.max) + ']');
  console.log('  (every per-keystroke figure above includes one of these)');

  /* ---- tab switch: separate the APP work from the frame wait ---- */
  console.log('\nTAB SWITCH, in-page handler only (applyView + its render), 7 runs:');
  for (const v of ['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan']) {
    const runs = [];
    for (let i = 0; i < 7; i++) {
      await page.evaluate(o => document.querySelector(`#viewSeg button[data-view="${o}"]`).click(),
        v === 'dash' ? 'yearly' : 'dash');
      await page.waitForTimeout(150);
      runs.push(await page.evaluate(view => {
        const btn = document.querySelector(`#viewSeg button[data-view="${view}"]`);
        const a = performance.now(); btn.click(); return performance.now() - a;
      }, v));
    }
    console.log('  ' + v.padEnd(10), f2(med(runs)).padStart(8), 'ms   spread', spread(runs));
  }

  console.log('\nPAGE ERRORS:', errs.length ? '\n  ' + errs.join('\n  ') : 'none');
  await ctx.close(); await browser.close(); srv.close();
})();
