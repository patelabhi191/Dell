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
  check(await page.evaluate(() => document.getElementById('notepadPanel').parentElement.id) === 'dashView',
    'on Dashboard it lives in #dashView');
  await go('contrib');
  check(await page.evaluate(() => document.getElementById('notepadPanel').parentElement.id) === 'contribView',
    'on Contributions it lives in #contribView');
  check(await page.evaluate(() => {
    const p = document.getElementById('notepadPanel');
    return p.parentElement.lastElementChild === p;
  }), 'it is the last panel on the view');

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
  check(await page.inputValue('#npText') === 'Strategy text', 'the prose shows on Contributions');
  await page.fill('#npText', 'Edited on Contributions'); await page.waitForTimeout(500);
  await page.fill('#npPoints .np-row input', 'Edited point'); await page.waitForTimeout(500);
  await go('dash');
  check(await page.inputValue('#npText') === 'Edited on Contributions',
    'the Contributions prose edit shows on Dashboard');
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
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('sparta.notes') || 'null')),
    'sparta.notes is written');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  await go('dash');
  check(await page.inputValue('#npText') === 'Edited on Contributions', 'prose survives a reload');
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

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nNOTES: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
