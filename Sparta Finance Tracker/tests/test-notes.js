/* Shared notepad (Dashboard + Contributions).

   The panel is ONE element that applyView() moves between the two view
   containers, so "shared" is structural rather than synced. The checks below
   exist mainly to defend that property, plus the two things most likely to
   break it: a move quietly becoming a copy, and render() rebuilding the inputs
   under the caret. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 1360, height: 1000 });

  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(220); };
  const pts = () => page.evaluate(() => state.notes.points.map(p => p.text));
  const rows = () => page.evaluate(() =>
    [...document.querySelectorAll('#npPoints .np-row input')].map(i => i.value));

  section('1. the panel is one element, moved — never copied');
  for (const v of ['dash', 'contrib', 'yearly', 'dash', 'contrib', 'plan', 'dash']) await go(v);
  check(await page.evaluate(() => document.querySelectorAll('#notepadPanel').length) === 1,
    'exactly one #notepadPanel after seven tab switches');
  await go('dash');
  /* It is INSIDE a column now rather than a direct child: the layout keeps it
     under Holdings at the holdings width. Ancestry is what matters. */
  check(await page.evaluate(() => {
    const p = document.getElementById('notepadPanel');
    return !!p.closest('#dashView') && p.parentElement.classList.contains('col');
  }), 'on Dashboard it lives inside #dashView, in a column');
  /* It lives in the RIGHT column now, between Past sells and Import holdings.
     It used to sit under Holdings on the left; that moved when the columns were
     fixed and Eye on Stocks took the left-hand slot. */
  check(await page.evaluate(() => {
    const p = document.getElementById('notepadPanel');
    const prev = p.previousElementSibling, next = p.nextElementSibling;
    return !!prev && prev.id === 'sellsPanel' && !!next && next.id === 'importCard';
  }), 'in the right column, between Past sells and Import holdings');
  await go('contrib');
  check(await page.evaluate(() => document.getElementById('notepadPanel').parentElement.id) === 'contribView',
    'on Contributions it lives in #contribView');
  check(await page.evaluate(() => {
    const p = document.getElementById('notepadPanel');
    return p.parentElement.lastElementChild === p;
  }), 'on Contributions it is the last panel on the view');
  /* Full width on Contributions, holdings width on Dashboard -- the one thing
     that differs between the two tabs. */
  const npW = async () => page.evaluate(() => {
    const p = document.getElementById('notepadPanel');
    return { w: Math.round(p.getBoundingClientRect().width),
             parent: Math.round(p.parentElement.getBoundingClientRect().width),
             holdings: (() => { const h = document.getElementById('holdingsCard');
               return h ? Math.round(h.getBoundingClientRect().width) : null })() };
  });
  const cW = await npW();
  check(Math.abs(cW.w - cW.parent) < 4, 'on Contributions it is full width', JSON.stringify(cW));
  await go('dash');
  const dW = await npW();
  /* On Dashboard it is the RIGHT column's width -- narrower than Holdings,
     which is in the wider left column. The two tabs differ, and that is the
     point of the check. */
  check(Math.abs(dW.w - dW.parent) < 4 && dW.holdings && dW.w < dW.holdings,
    'on Dashboard it fills the right column, which is narrower than Holdings',
    JSON.stringify(dW));

  section('2. points: add, type, Enter, Backspace, delete');
  await go('dash');
  await page.click('#npAdd'); await page.waitForTimeout(120);
  check((await rows()).length === 1, 'Add point creates a row');
  check(await page.evaluate(() => document.activeElement.closest('.np-row') !== null),
    'the new row takes focus');
  await page.keyboard.type('Buy the dip');
  await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check((await rows()).length === 2, 'Enter inserts a row below');
  check(await page.evaluate(() => {
    const r = [...document.querySelectorAll('#npPoints .np-row input')];
    return document.activeElement === r[1];
  }), 'focus moves to the inserted row');
  await page.keyboard.type('Hold VFV');
  check(JSON.stringify(await pts()) === JSON.stringify(['Buy the dip', 'Hold VFV']),
    'both points are in state', JSON.stringify(await pts()));
  // Backspace on an EMPTY row removes it; on a filled row it must just edit text
  await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check((await rows()).length === 3, 'third row added');
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  check((await rows()).length === 2, 'Backspace on an empty row removes it');
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  check((await pts())[1] === 'Hold VF', 'Backspace on a filled row edits text, does not delete the row',
    JSON.stringify(await pts()));
  await page.click('#npPoints .np-row:nth-child(1) .np-del'); await page.waitForTimeout(150);
  check(JSON.stringify(await pts()) === JSON.stringify(['Hold VF']), 'the delete button removes one point');

  section('3. shared across the two tabs');
  await page.evaluate(() => { state.notes.points = [{ id: 'n1', text: 'From Dashboard' }];
    state.notes.text = 'Strategy text'; notesPersist(); renderNotes(); });
  await go('contrib');
  check((await rows())[0] === 'From Dashboard', 'the Dashboard point shows on Contributions', (await rows())[0]);
  /* The Strategy box is gone from both tabs. Its STORED value is deliberately
     left alone -- nothing in the app deletes it -- so this pins the absence of
     the field and the survival of the data in the same breath. */
  check(await page.evaluate(() => !document.getElementById('npText')),
    'the Strategy field is gone from Contributions');
  await page.fill('#npPoints .np-row input', 'Edited point'); await page.waitForTimeout(500);
  await go('dash');
  check(await page.evaluate(() => !document.getElementById('npText')),
    'and from Dashboard');
  check(await page.evaluate(() => state.notes.text) === 'Strategy text',
    'but notes.text is still in state, untouched');
  check((await rows())[0] === 'Edited point', 'the Contributions point edit shows on Dashboard');

  section('4. render() must not disturb an in-progress edit');
  await page.click('#npPoints .np-row input');
  await page.evaluate(() => { const i = document.querySelector('#npPoints .np-row input');
    i.focus(); i.setSelectionRange(3, 3); });
  await page.evaluate(() => render());
  await page.waitForTimeout(120);
  const kept = await page.evaluate(() => {
    const i = document.querySelector('#npPoints .np-row input');
    return { focused: document.activeElement === i, caret: i.selectionStart };
  });
  check(kept.focused, 'focus survives render()');
  check(kept.caret === 3, 'caret position survives render()', String(kept.caret));

  section('5. persistence');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem(nsKey('sparta.notes')) || 'null')),
    'sparta.notes is written');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  await go('dash');
  check(await page.evaluate(() => state.notes.text) === 'Strategy text',
    'notes.text survives a reload -- nothing quietly deleted it');
  check((await rows())[0] === 'Edited point', 'points survive a reload');

  section('6. normalizeNotes() repairs junk rather than throwing');
  const norm = await page.evaluate(() => {
    const out = [];
    const run = v => { state.notes = v; try { normalizeNotes();
      out.push({ ok: true, pts: state.notes.points.length, text: typeof state.notes.text,
                 ids: state.notes.points.every(p => !!p.id) }); }
      catch (e) { out.push({ ok: false, err: e.message }); } };
    run(null); run('a string'); run({ points: { a: 1 } });
    run({ points: ['plain string', { text: 'no id' }, null, 42], text: 99 });
    return out;
  });
  check(norm.every(r => r.ok), 'no shape throws', JSON.stringify(norm.map(r => r.ok)));
  check(norm[0].pts === 0 && norm[1].pts === 0 && norm[2].pts === 0, 'junk shapes reduce to an empty list');
  check(norm[3].pts === 2, 'a mixed list keeps only the usable entries', String(norm[3].pts));
  check(norm[3].ids, 'entries missing an id get one');
  check(norm.every(r => r.text === 'string'), 'text is always coerced to a string');

  section('7. cloud payload carries the notes');
  await page.evaluate(() => { state.notes = { points: [{ id: 'c1', text: 'cloud point' }], text: 'cloud prose' }; });
  const payload = await page.evaluate(() => corePayload().notes);
  check(payload && payload.text === 'cloud prose' && payload.points[0].text === 'cloud point',
    'corePayload().notes carries points and prose', JSON.stringify(payload));
  await page.evaluate(() => { applyPayload({ holdings: [], cash: {}, contribs: [],
    notes: { points: [{ id: 'r1', text: 'from remote' }], text: 'remote prose' } }); });
  await page.waitForTimeout(200);
  await go('dash');
  check((await rows())[0] === 'from remote', 'a pull replaces the notes and re-renders', (await rows())[0]);

  section('8. layout');
  for (const v of ['dash', 'contrib']) {
    await go(v);
    for (const w of [1360, 900, 560, 390]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const p = document.getElementById('notepadPanel');
        const r = p.getBoundingClientRect(), pr = p.parentElement.getBoundingClientRect();
        return { over: +(p.scrollWidth - p.clientWidth).toFixed(1), full: Math.abs(r.width - pr.width) < 2 };
      });
      check(m.over <= 0.5 && m.full, `${v} @ ${w}px: full width, no overflow`, JSON.stringify(m));
    }
  }
  await page.setViewportSize({ width: 1360, height: 1000 });

  section('9. Eye on Stocks: chips');
  await go('dash');
  await page.evaluate(() => { state.notes.stocks = []; notesPersist(); renderNotes(); });
  const chips = () => page.evaluate(() =>
    [...document.querySelectorAll('#npStocks .np-stock')].map(c => c.dataset.s));
  await page.click('#npStockInput');
  await page.keyboard.type('NVDA'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check(JSON.stringify(await chips()) === JSON.stringify(['NVDA']), 'Enter adds a chip',
    JSON.stringify(await chips()));
  check(await page.inputValue('#npStockInput') === '', 'the input clears after Enter');
  // if renderNotes() rebuilt the input, focus would die here and you could not
  // type a second ticker without re-clicking
  check(await page.evaluate(() => document.activeElement.id) === 'npStockInput',
    'focus stays in the input, so tickers can be typed one after another');
  await page.keyboard.type('VFV'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check(JSON.stringify(await chips()) === JSON.stringify(['NVDA', 'VFV']), 'a second chip adds without re-clicking');
  await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check((await chips()).length === 2, 'an empty input adds nothing');
  await page.keyboard.type('nvda'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check((await chips()).length === 2, 'a case-insensitive duplicate is ignored', JSON.stringify(await chips()));
  await page.keyboard.type('  Berkshire Hathaway  '); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check((await chips())[2] === 'Berkshire Hathaway', 'entries are trimmed and casing is preserved, not uppercased',
    (await chips())[2]);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  check(JSON.stringify(await chips()) === JSON.stringify(['NVDA', 'VFV']),
    'Backspace on an empty input removes the last chip');
  await page.click('#npStocks .np-stock:nth-child(1) [data-act="remove"]'); await page.waitForTimeout(150);
  check(JSON.stringify(await chips()) === JSON.stringify(['VFV']), 'the chip button removes that one');

  section('10. stocks: Dashboard only, persisted, render()-safe');
  /* Eye on Stocks is no longer part of the shared notepad -- it is its own
     panel and it exists on the Dashboard alone, because a watchlist with live
     quotes says nothing on a TFSA/FHSA room tracker. The points stay shared. */
  await go('contrib');
  check(await page.evaluate(() => {
    const e = document.getElementById('eyePanel');
    return !e || !e.closest('#contribView');
  }), 'Eye on Stocks does not follow the notepad to Contributions');
  check((await rows()).length > 0, '...while the points still do');
  await go('dash');
  check(await page.evaluate(() => {
    const e = document.getElementById('eyePanel');
    return !!e && !!e.closest('#dashView');
  }), 'and it is present on the Dashboard');
  await page.click('#npStockInput');
  await page.keyboard.type('XEQT'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check(JSON.stringify(await chips()) === JSON.stringify(['VFV', 'XEQT']),
    'a stock added on the Dashboard is in the list');
  check(JSON.stringify(await page.evaluate(() => corePayload().notes.stocks)) ===
    JSON.stringify(['VFV', 'XEQT']), 'corePayload() carries the stocks');
  await page.evaluate(() => { const i = document.getElementById('npStockInput');
    i.value = 'TYPING'; i.focus(); i.setSelectionRange(3, 3); });
  await page.evaluate(() => render());
  await page.waitForTimeout(120);
  const sKept = await page.evaluate(() => { const i = document.getElementById('npStockInput');
    return { focused: document.activeElement === i, caret: i.selectionStart, val: i.value }; });
  check(sKept.focused && sKept.caret === 3 && sKept.val === 'TYPING',
    'render() leaves a half-typed ticker and its caret alone', JSON.stringify(sKept));
  await page.evaluate(() => { document.getElementById('npStockInput').value = ''; });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  await go('dash');
  check(JSON.stringify(await chips()) === JSON.stringify(['VFV', 'XEQT']), 'stocks survive a reload');

  section('11. normalizeNotes() repairs the stocks list');
  const sNorm = await page.evaluate(() => {
    const out = [];
    const run = v => { state.notes = { points: [], text: '', stocks: v };
      try { normalizeNotes(); out.push({ ok: true, s: state.notes.stocks }); }
      catch (e) { out.push({ ok: false, err: e.message }); } };
    run(null); run('AAPL'); run([' AAPL ', 'aapl', '', 42, null, 'MSFT']);
    return out;
  });
  check(sNorm.every(r => r.ok), 'no shape throws', JSON.stringify(sNorm.map(r => r.ok)));
  check(JSON.stringify(sNorm[0].s) === '[]' && JSON.stringify(sNorm[1].s) === '[]',
    'null and a bare string reduce to an empty list');
  check(JSON.stringify(sNorm[2].s) === JSON.stringify(['AAPL', 'MSFT']),
    'a mixed list is trimmed, de-duped case-insensitively, junk dropped', JSON.stringify(sNorm[2].s));
  await page.evaluate(() => { state.notes = { points: [], text: '', stocks: ['VFV'] };
    notesPersist(); renderNotes(); });

  section('12. widths, now that Strategy is gone');
  /* The .np-split 60/40 pair it used to check no longer exists: the notepad is
     points alone, and Eye on Stocks is its own panel. What matters now is that
     each panel is the right WIDTH on each tab and neither overflows on a phone. */
  for (const v of ['dash', 'contrib']) {
    await go(v);
    await page.setViewportSize({ width: 1360, height: 1000 }); await page.waitForTimeout(220);
    check(await page.evaluate(() => !document.querySelector('.np-split')),
      `${v}: the old Strategy/stocks split is gone`);
    const w = await page.evaluate(() => {
      const p = document.getElementById('notepadPanel');
      const h = document.getElementById('holdingsCard');
      const r = e => e ? Math.round(e.getBoundingClientRect().width) : null;
      return { np: r(p), parent: r(p.parentElement), holdings: r(h),
               dash: !!p.closest('#dashView') };
    });
    if (w.dash) check(Math.abs(w.np - w.parent) < 4 && w.np < w.holdings,
      'dash: the notepad fills the right column, narrower than Holdings', JSON.stringify(w));
    else check(Math.abs(w.np - w.parent) < 4,
      'contrib: the notepad is full width', JSON.stringify(w));
    for (const px of [560, 390]) {
      await page.setViewportSize({ width: px, height: 1000 }); await page.waitForTimeout(200);
      const over = await page.evaluate(() => {
        const ids = ['notepadPanel', 'eyePanel'];
        return ids.map(id => { const p = document.getElementById(id);
          return p ? +(p.scrollWidth - p.clientWidth).toFixed(1) : 0 });
      });
      check(over.every(o => o <= 0.5), `${v} @ ${px}px: no overflow`, JSON.stringify(over));
    }
  }
  await page.setViewportSize({ width: 1360, height: 1000 });

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nNOTES: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
