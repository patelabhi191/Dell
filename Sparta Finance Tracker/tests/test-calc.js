/* The two calculators under Eye on Stocks.

   They are stateless and ledger-free by design -- they read their inputs,
   print an answer and keep nothing -- so what is worth pinning is the
   arithmetic, the guards, and the two presentation rules that were wrong on
   the first pass: a percentage of a zero buying price is a DASH rather than
   zero or infinity (the same rule Yearly applies to savings growth), and the
   new average is NOT coloured, because a cost basis moving is a fact and not
   good or bad news. */
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

  const avg = (p, q, ap, aq) => O.page.evaluate(([p, q, ap, aq]) => {
    const set = (id, v) => document.getElementById(id).value = (v === null ? '' : String(v));
    set('cavPrice', p); set('cavQty', q); set('cavAddPrice', ap); set('cavAddQty', aq);
    document.getElementById('cavGo').click();
    const e = document.getElementById('cavOut');
    const h = e.querySelector('.calc-head'), l = e.querySelector('.calc-line'), x = e.querySelector('.calc-err');
    return { err: x ? x.textContent : null, head: h ? h.textContent : null,
      line: l ? l.textContent : null, cls: h ? h.className : '' };
  }, [p, q, ap, aq]);

  const grow = (b, s) => O.page.evaluate(([b, s]) => {
    const set = (id, v) => document.getElementById(id).value = (v === null ? '' : String(v));
    set('cgBuy', b); set('cgSell', s);
    document.getElementById('cgGo').click();
    const e = document.getElementById('cgOut');
    const h = e.querySelector('.calc-head'), l = e.querySelector('.calc-line'), x = e.querySelector('.calc-err');
    return { err: x ? x.textContent : null, head: h ? h.textContent : null,
      line: l ? l.textContent : null, cls: h ? h.className : '' };
  }, [b, s]);

  /* ── 1. the average, checked against arithmetic done here ─────────────── */
  section('1. average buying price');
  const a1 = await avg(180.50, 10, 212.40, 5);
  const want1 = (10 * 180.50 + 5 * 212.40) / 15;          // 191.1333…
  check(a1.head === want1.toFixed(4), '1: (held*avg + buying*price) / total shares',
    `${a1.head} vs ${want1.toFixed(4)}`);
  check(/15 shares/.test(a1.line), '1: ...over the combined share count', a1.line);
  check(/2867\.00/.test(a1.line), '1: ...and the total cost keeps its cents', a1.line);
  check(/averaged UP/.test(a1.line), '1: buying higher is reported as averaging up', a1.line);

  const a2 = await avg(200, 10, 100, 10);
  check(a2.head === '150.00', '1: averaging down lands halfway', a2.head);
  check(/averaged DOWN by 50\.00/.test(a2.line), '1: ...and says by how much', a2.line);

  const a3 = await avg(0, 0, 50, 3);
  check(a3.head === '50.00' && /opening average/.test(a3.line),
    '1: a first purchase IS the average, rather than an error', `${a3.head} / ${a3.line}`);

  const a4 = await avg(10, 0.5, 20, 0.25);
  check(a4.head === (( 0.5*10 + 0.25*20 ) / 0.75).toFixed(4) && /0\.75 shares/.test(a4.line),
    '1: fractional share counts work and are not rounded to whole shares',
    `${a4.head} / ${a4.line}`);

  /* ── 2. the guards ────────────────────────────────────────────────────── */
  section('2. the average calculator refuses rather than inventing a figure');
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
  check(/\+31\.90 per share/.test(r1.line), '3: ...and the cash difference is given too', r1.line);
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
  check(/25\.00 per share/.test(r4.line),
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

  /* ── 5. Enter runs the calculation the field belongs to ───────────────── */
  section('5. Enter works in both blocks');
  const ent = await O.page.evaluate(async () => {
    const fire = id => { const el = document.getElementById(id); el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) };
    document.getElementById('cavOut').innerHTML = '';
    document.getElementById('cgOut').innerHTML = '';
    document.getElementById('cavPrice').value = '10'; document.getElementById('cavQty').value = '1';
    document.getElementById('cavAddPrice').value = '20'; document.getElementById('cavAddQty').value = '1';
    document.getElementById('cgBuy').value = '10'; document.getElementById('cgSell').value = '11';
    fire('cavAddQty'); fire('cgSell');
    await new Promise(r => setTimeout(r, 60));
    return { avg: document.querySelector('#cavOut .calc-head').textContent,
             grow: document.querySelector('#cgOut .calc-head').textContent };
  });
  check(ent.avg === '15.00', '5: Enter in the average block calculates the average', ent.avg);
  check(ent.grow === '+10.00%', '5: Enter in the growth block calculates the growth', ent.grow);

  /* ── 6. it is genuinely stateless ─────────────────────────────────────── */
  section('6. nothing is stored and nothing is synced');
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
    document.getElementById('cavGo').click();
    document.getElementById('cgGo').click();
    const after = { len: localStorage.length,
      edited: typeof fbUserEdited !== 'undefined' ? fbUserEdited : null,
      stamp: localStorage.getItem('sparta.updatedAt') };
    return { keys, same: after.len === before.len,
      editedUnchanged: after.edited === before.edited,
      stampUnchanged: after.stamp === before.stamp };
  });
  check(clean.keys.length === 0 && clean.same,
    '6: calculating writes nothing to storage', JSON.stringify(clean.keys));
  check(clean.editedUnchanged,
    '6: ...does not flip the user-edited flag, which gates every cloud upload',
    String(clean.editedUnchanged));
  check(clean.stampUnchanged,
    '6: ...and does not move sparta.updatedAt, which decides who wins a reconnect',
    String(clean.stampUnchanged));

  check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
  await O.ctx.close();
  await browser.close(); srv.close();
  console.log(`\nCALCULATORS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
