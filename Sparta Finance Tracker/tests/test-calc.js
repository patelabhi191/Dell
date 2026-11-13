/* The Stock Calculator under Eye on Stocks.

   Two sums, ONE button. That is the whole design and most of this suite:
   whichever block you type in first locks the other, so Calculate is never
   ambiguous about which sum it is doing, and Clear empties the boxes without
   touching anything else.

   It is stateless and ledger-free by design -- it reads its inputs, prints an
   answer and keeps nothing -- so what is worth pinning is the arithmetic, the
   guards, the locking, and the two presentation rules that were wrong on the
   first pass: a percentage of a zero buying price is a DASH rather than zero
   or infinity (the same rule Yearly applies to savings growth), and the new
   average is NOT coloured, because a cost basis moving is a fact and not good
   or bad news. */
const { serve, launch, open, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const O = await open(browser, url, SEED);
  await O.page.evaluate(() => applyView('dash'));
  await O.page.waitForTimeout(350);

  /* Every case starts from Clear, because a value left in one block LOCKS the
     other -- so a test that only set its own fields would be measuring the
     previous case. Values go in through a real `input` event, which is what
     the locking listens to. */
  const run = (vals) => O.page.evaluate((vals) => {
    calcClear();
    for (const [id, v] of Object.entries(vals)) {
      const el = document.getElementById(id);
      el.value = (v === null ? '' : String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.getElementById('calcGo').click();
    const e = document.getElementById('calcOut');
    const h = e.querySelector('.calc-head'), l = e.querySelector('.calc-line'),
          x = e.querySelector('.calc-err');
    return { err: x ? x.textContent : null, head: h ? h.textContent : null,
      line: l ? l.textContent : null, cls: h ? h.className : '' };
  }, vals);

  const avg = (p, q, ap, aq) =>
    run({ cavPrice: p, cavQty: q, cavAddPrice: ap, cavAddQty: aq });
  const grow = (b, s) => run({ cgBuy: b, cgSell: s });

  /* ── 1. the average, checked against arithmetic done here ─────────────── */
  section('1. average buying price');
  const a1 = await avg(180.50, 10, 212.40, 5);
  const want1 = (10 * 180.50 + 5 * 212.40) / 15;          // 191.1333…
  check(a1.head === want1.toFixed(4), '1: (held*avg + buying*price) / total shares',
    `${a1.head} vs ${want1.toFixed(4)}`);
  check(/15 shares/.test(a1.line), '1: ...over the combined share count', a1.line);
  check(/2867\.00/.test(a1.line), '1: ...and the total cost keeps its cents', a1.line);
  check(/avg UP/.test(a1.line), '1: buying higher is reported as averaging up', a1.line);

  const a2 = await avg(200, 10, 100, 10);
  check(a2.head === '150.00', '1: averaging down lands halfway', a2.head);
  check(/avg DOWN 50\.00/.test(a2.line), '1: ...and says by how much', a2.line);

  const a3 = await avg(0, 0, 50, 3);
  check(a3.head === '50.00' && /opening average/.test(a3.line),
    '1: a first purchase IS the average, rather than an error', `${a3.head} / ${a3.line}`);

  const a4 = await avg(10, 0.5, 20, 0.25);
  check(a4.head === ((0.5 * 10 + 0.25 * 20) / 0.75).toFixed(4) && /0\.75 shares/.test(a4.line),
    '1: fractional share counts work and are not rounded to whole shares',
    `${a4.head} / ${a4.line}`);

  /* ── 2. the guards ────────────────────────────────────────────────────── */
  section('2. the average refuses rather than inventing a figure');
  const g1 = await avg(100, 5, null, 2);
  check(/all four/.test(g1.err || ''), '2: a blank box is named, not treated as zero', String(g1.err));
  const g2 = await avg(100, -5, 120, 2);
  check(/negative/.test(g2.err || ''), '2: negative counts are refused', String(g2.err));
  const g3 = await avg(0, 0, 0, 0);
  check(/at least one share/.test(g3.err || ''),
    '2: nothing held and nothing bought has no average, and does not print 0',
    String(g3.err));
  check(g3.head === null, '2: ...and prints no headline figure at all', String(g3.head));
  const g4 = await avg(100, 5, 120, 0);
  check(/leaves the average where it is/.test(g4.err || ''),
    '2: buying zero shares is explained rather than silently returning the old average',
    String(g4.err));

  /* ── 3. growth and decline ────────────────────────────────────────────── */
  section('3. growth or decline');
  const r1 = await grow(180.50, 212.40);
  check(r1.head === '+' + (((212.40 - 180.50) / 180.50) * 100).toFixed(2) + '%',
    '3: percentage is the gain over the buying price', r1.head);
  check(/\+31\.90 a share/.test(r1.line), '3: ...and the cash difference is given too', r1.line);
  check(/up/.test(r1.cls), '3: a gain is coloured as one', r1.cls);

  const r2 = await grow(900, 845.25);
  check(r2.head === '−6.08%', '3: a decline carries a real minus sign, not a hyphen', r2.head);
  check(/down/.test(r2.cls), '3: ...and the loss colour', r2.cls);

  const r3 = await grow(100, 100);
  check(r3.head === '0.00%' && /flat/.test(r3.cls),
    '3: no change is neither a gain nor a loss', `${r3.head} ${r3.cls}`);

  /* THE RULE THIS SUITE EXISTS FOR. Yearly prints a dash when savings growth
     has a zero start, for the reason that there is nothing to have grown
     FROM. A percentage off a zero buying price is the same fact. */
  const r4 = await grow(0, 25);
  check(r4.head === '—',
    '3: a percentage from a zero buying price is a DASH, not 0% and not infinity', r4.head);
  check(/25\.00 a share/.test(r4.line),
    '3: ...while the cash difference, which IS defined, is still reported', r4.line);

  const r5 = await grow(100, null);
  check(/both boxes/.test(r5.err || ''), '3: a blank box is refused', String(r5.err));
  const r6 = await grow(-5, 10);
  check(/negative/.test(r6.err || ''), '3: negative prices are refused', String(r6.err));

  /* ── 4. the two presentation rules ────────────────────────────────────── */
  section('4. what the colours are allowed to say');
  check(a1.cls === 'calc-head' && a2.cls === 'calc-head',
    '4: the new average is NOT coloured either way -- a cost basis moving is a fact, not a verdict',
    `${a1.cls} / ${a2.cls}`);
  check(!/\d\.\d{3}/.test(r1.head), '4: a percentage is two decimals, not four', r1.head);

  /* ── 5. one button for two sums ───────────────────────────────────────── */
  section('5. the shared Calculate button');
  const none = await O.page.evaluate(() => {
    calcClear();
    document.getElementById('calcGo').click();
    const x = document.querySelector('#calcOut .calc-err');
    return x ? x.textContent : null;
  });
  check(/Fill one of the two/.test(none || ''),
    '5: with both blocks empty the button says which to fill, rather than guessing',
    String(none));

  /* Locking is the whole reason one button is unambiguous, so it is checked
     through the DOM the user sees: disabled inputs AND the dimming class. */
  const lockState = () => O.page.evaluate(() => {
    const dis = ids => ids.map(i => document.getElementById(i).disabled);
    return {
      avgLocked: document.getElementById('calcBlockAvg').classList.contains('locked'),
      growLocked: document.getElementById('calcBlockGrow').classList.contains('locked'),
      avgDis: dis(CALC_AVG), growDis: dis(CALC_GROW),
    };
  });
  const type = (id, v) => O.page.evaluate(([id, v]) => {
    const el = document.getElementById(id);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, v]);

  await O.page.evaluate(() => calcClear());
  const open0 = await lockState();
  check(!open0.avgLocked && !open0.growLocked &&
        open0.avgDis.every(d => !d) && open0.growDis.every(d => !d),
    '5: with nothing typed BOTH blocks are open -- there is no default winner',
    JSON.stringify(open0));

  await type('cavQty', '10');
  const lockG = await lockState();
  check(lockG.growLocked && lockG.growDis.every(d => d),
    '5: one keystroke in the average block greys out growth AND disables its boxes',
    JSON.stringify(lockG));
  check(!lockG.avgLocked && lockG.avgDis.every(d => !d),
    '5: ...while the block being used stays fully usable', JSON.stringify(lockG));

  /* Emptying the field by hand must RELEASE the other block: locking is a
     consequence of what is typed, not a latch that only Clear can undo. */
  await type('cavQty', '');
  const released = await lockState();
  check(!released.avgLocked && !released.growLocked && released.growDis.every(d => !d),
    '5: deleting what you typed re-opens the other block -- the lock is not a latch',
    JSON.stringify(released));

  await type('cgBuy', '5');
  const lockA = await lockState();
  check(lockA.avgLocked && lockA.avgDis.every(d => d) && !lockA.growLocked,
    '5: the lock works the other way round too -- neither block is privileged',
    JSON.stringify(lockA));

  /* ── 6. Clear ─────────────────────────────────────────────────────────── */
  section('6. Clear empties the boxes and nothing else');
  const cleared = await O.page.evaluate(() => {
    /* Something in every box, one block locked, an answer on screen, and a
       note + a holding to prove Clear's reach stops at the inputs. */
    const notes = JSON.stringify(state.notes);
    const holds = JSON.stringify(state.holdings);
    CALC_AVG.forEach(id => { const e = document.getElementById(id); e.disabled = false; e.value = '7' });
    CALC_GROW.forEach(id => { const e = document.getElementById(id); e.disabled = false; e.value = '9' });
    calcLock();
    calcRun();
    const hadOut = document.getElementById('calcOut').innerHTML.length > 0;
    document.getElementById('calcClear').click();
    return {
      hadOut,
      vals: CALC_AVG.concat(CALC_GROW).map(id => document.getElementById(id).value),
      out: document.getElementById('calcOut').innerHTML,
      anyDisabled: CALC_AVG.concat(CALC_GROW).some(id => document.getElementById(id).disabled),
      anyLocked: ['calcBlockAvg', 'calcBlockGrow']
        .some(id => document.getElementById(id).classList.contains('locked')),
      notesSame: JSON.stringify(state.notes) === notes,
      holdsSame: JSON.stringify(state.holdings) === holds,
    };
  });
  check(cleared.hadOut, '6: (the answer really was on screen before Clear)', String(cleared.hadOut));
  check(cleared.vals.every(v => v === ''), '6: every box in BOTH blocks is emptied',
    JSON.stringify(cleared.vals));
  check(cleared.out === '', '6: ...and the answer goes with them', JSON.stringify(cleared.out));
  check(!cleared.anyDisabled && !cleared.anyLocked,
    '6: ...leaving both blocks unlocked and typeable again',
    `${cleared.anyDisabled} / ${cleared.anyLocked}`);
  check(cleared.notesSame && cleared.holdsSame,
    '6: Clear reaches the text boxes ONLY -- notes and holdings are untouched',
    `${cleared.notesSame} / ${cleared.holdsSame}`);

  /* ── 7. Enter runs whichever block is in play ─────────────────────────── */
  section('7. Enter is the shared button');
  const entAvg = await O.page.evaluate(async () => {
    calcClear();
    const set = (id, v) => { const e = document.getElementById(id); e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true })) };
    set('cavPrice', '10'); set('cavQty', '1'); set('cavAddPrice', '20'); set('cavAddQty', '1');
    const el = document.getElementById('cavAddQty'); el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return document.querySelector('#calcOut .calc-head').textContent;
  });
  check(entAvg === '15.00', '7: Enter in the average block calculates the average', entAvg);

  const entGrow = await O.page.evaluate(async () => {
    calcClear();
    const set = (id, v) => { const e = document.getElementById(id); e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true })) };
    set('cgBuy', '10'); set('cgSell', '11');
    const el = document.getElementById('cgSell'); el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return document.querySelector('#calcOut .calc-head').textContent;
  });
  check(entGrow === '+10.00%', '7: Enter in the growth block calculates the growth', entGrow);

  /* ── 8. where the panel sits ──────────────────────────────────────────── */
  section('8. the panel is placed, not left loose in the grid');
  const place = await O.page.evaluate(() => {
    const grid = document.getElementById('dashView');
    const calc = document.getElementById('calcPanel'), eye = document.getElementById('eyePanel');
    const loose = [...grid.children].some(c => c === calc);
    const gap = Math.round(calc.getBoundingClientRect().top - eye.getBoundingClientRect().bottom);
    return { loose, sameCol: calc.parentElement === eye.parentElement,
      afterEye: eye.nextElementSibling === calc, gap,
      inList: typeof DASH_LEFT !== 'undefined' && DASH_LEFT.includes('calcPanel') };
  });
  /* A panel that is NOT in DASH_LEFT/DASH_RIGHT becomes a direct child of the
     grid, which puts it on a new grid ROW -- below BOTH stretched columns.
     That is what opened ~800px of dead space under Eye on Stocks. */
  check(place.inList, '8: calcPanel is in the left column list, so dashLayout places it',
    String(place.inList));
  check(!place.loose, '8: ...and is therefore not a loose grid child on a row of its own',
    String(place.loose));
  check(place.sameCol && place.afterEye,
    '8: it sits in the same column as Eye on Stocks, directly after it',
    `${place.sameCol} / ${place.afterEye}`);
  check(place.gap === 20, '8: ...one column gap below it, with no dead space', `${place.gap}px`);

  /* ── 8b. inputs at the edges ──────────────────────────────────────────── */
  section('8b. figures the formatter could not print, and boxes it could not read');
  const big = await avg('1e21', 1, '1e21', 1);
  check(/too large/.test(big.err || '') && big.head === null,
    '8b: a figure past the formatter is refused, not printed as "1e+21.00"', String(big.err));
  const bigG = await grow(1, '1e22');
  check(/too large/.test(bigG.err || ''), '8b: ...in the growth block too', String(bigG.err));

  /* Four decimals cannot show a sub-penny price at all: 0.00003 came out as
     "0.00" and the line read "avg UP 0.00 - cost 0.00". */
  const penny = await avg(0.00001, 1, 0.00003, 1);
  check(penny.head === '0.00002' && /avg UP 0\.00001/.test(penny.line) && /cost 0\.00004/.test(penny.line),
    '8b: a sub-penny price keeps its digits', `${penny.head} / ${penny.line}`);
  check(a1.head === want1.toFixed(4), '8b: ...and ordinary prices are still four decimals',
    a1.head);

  const hair = await grow(100, 100.00001);
  check(hair.head === '+<0.01%' && /growth/.test(hair.line),
    '8b: a move too small for two decimals is "<0.01%", not "+0.00%" beside the word growth',
    `${hair.head} / ${hair.line}`);
  check(r3.head === '0.00%', '8b: ...while a true no-change is still exactly 0.00%', r3.head);

  /* A number box holding text it cannot parse reports value "" with the
     characters still on screen. */
  await O.page.evaluate(() => calcClear());
  await O.page.click('#cgBuy'); await O.page.keyboard.type('1e');
  const half = await O.page.evaluate(() => ({
    bad: document.getElementById('cgBuy').validity.badInput,
    avgLocked: document.getElementById('calcBlockAvg').classList.contains('locked') }));
  await O.page.keyboard.press('Enter'); await O.page.waitForTimeout(80);
  const halfMsg = await O.page.evaluate(() => document.getElementById('calcOut').textContent);
  check(half.bad && half.avgLocked,
    '8b: a box with unreadable text in it still counts as the block in use', JSON.stringify(half));
  check(/both boxes with numbers/.test(halfMsg),
    '8b: ...and Calculate says to fix it, not "fill one of the two sets"', halfMsg);

  /* A browser restoring a form after a reload fills the boxes without firing
     `input`, so the lock never ran. */
  const restored = await O.page.evaluate(() => {
    calcClear();
    document.getElementById('cavPrice').value = '5';       // no input event, as a restore does it
    document.getElementById('cgBuy').value = '10';
    window.dispatchEvent(new Event('pageshow'));
    return { growLocked: document.getElementById('calcBlockGrow').classList.contains('locked'),
      growDisabled: document.getElementById('cgBuy').disabled };
  });
  check(restored.growLocked && restored.growDisabled,
    '8b: boxes filled by a form restore are locked on pageshow, so one block is visibly in play',
    JSON.stringify(restored));
  await O.page.evaluate(() => calcClear());

  /* ── 9. it is genuinely stateless ─────────────────────────────────────── */
  section('9. nothing is stored and nothing is synced');
  const clean = await O.page.evaluate(() => {
    /* fbUserEdited is ALREADY true on a seeded boot -- normalizeYF's allot
       repointing and the Monthly import tagging both persist during load, and
       each marks the edit. So the flag's value says nothing; what matters is
       that calculating does not CHANGE it, nor write a key, nor move the
       updated-at stamp that decides which device wins a sync. */
    const before = { len: localStorage.length,
      edited: typeof fbUserEdited !== 'undefined' ? fbUserEdited : null,
      stamp: localStorage.getItem('sparta.updatedAt') };
    const keys = Object.keys(localStorage).filter(k => /calc|cav|cg/i.test(k));
    calcClear();
    document.getElementById('cavPrice').value = '10';
    document.getElementById('cavQty').value = '1';
    document.getElementById('cavAddPrice').value = '20';
    document.getElementById('cavAddQty').value = '1';
    calcRun();
    document.getElementById('calcClear').click();
    const after = { len: localStorage.length,
      edited: typeof fbUserEdited !== 'undefined' ? fbUserEdited : null,
      stamp: localStorage.getItem('sparta.updatedAt') };
    return { keys, same: after.len === before.len,
      editedUnchanged: after.edited === before.edited,
      stampUnchanged: after.stamp === before.stamp };
  });
  check(clean.keys.length === 0 && clean.same,
    '9: calculating and clearing write nothing to storage', JSON.stringify(clean.keys));
  check(clean.editedUnchanged,
    '9: ...does not flip the user-edited flag, which gates every cloud upload',
    String(clean.editedUnchanged));
  check(clean.stampUnchanged,
    '9: ...and does not move sparta.updatedAt, which decides who wins a reconnect',
    String(clean.stampUnchanged));

  check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
  await O.ctx.close();
  await browser.close(); srv.close();
  console.log(`\nSTOCK CALCULATOR: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
