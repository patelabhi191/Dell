/* DATA-DRIVEN + UNIT tests, run against the real in-page functions.
   Table-driven cases for the categoriser, contribution limits, CSV parsing,
   holdings math, and the CAD-only currency invariant (ref doc §2, §8.4). */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const near = (a, b, eps = 0.005) => Math.abs(a - b) < eps;

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const { ctx, page } = await open(browser, url);

  // ── 1. meCategorise waterfall: rule > file column > keyword > Other ────────
  console.log('\n── meCategorise() waterfall (data-driven) ──');
  const CAT_CASES = [
    // desc,                fileCat,        expectedCat,   expectedWhy,  note
    ['Loblaws', null, 'Groceries', 'rule', 'saved rule wins'],
    ['Loblaws', 'Dining Out', 'Groceries', 'rule', 'rule beats file column'],
    ['Shell Gas', null, 'Taxi', 'rule', 'user rule overrides keyword'],
    ['SOMETHING ODD', 'Transit', 'Transit', 'file', 'file column used when no rule'],
    ['SOMETHING ODD', 'Travel', 'Other', 'none', 'a category no longer on the list is ignored'],
    ['SOMETHING ODD', 'Rent', 'Other', 'none', 'Rent left the Monthly list, so the file column cannot reach it'],
    ['SOMETHING ODD', 'NotACategory', 'Other', 'none', 'unknown file cat ignored'],
    ['ZZZ UNKNOWN MERCHANT', null, 'Other', 'none', 'falls through to Other'],
    // the renamed and added categories, reached by keyword
    ['PRESTO FARE', null, 'Transit', 'kw', 'transit is its own category now'],
    ['UBER TRIP 2381', null, 'Taxi/Rental', 'kw', 'Taxi became Taxi/Rental'],
    ['HERTZ RENT A CAR', null, 'Taxi/Rental', 'kw', 'and it covers rentals'],
    ['CINEPLEX ODEON', null, 'Indoor Entertainment', 'kw', 'Entertainment became Indoor'],
    ['MARRIOTT HOTEL', null, 'Outdoor Entertainment', 'kw', 'Travel became Outdoor Entertainment'],
    ['HOME DEPOT #7', null, 'Shopping', 'kw', 'Maintenance became Shopping'],
    ['NSF FEE', null, 'Fees/Subscription', 'kw', 'bank fees have a category'],
    ['NETFLIX SUBSCRIPTION', null, 'TV/Phone/Internet', 'kw', 'streaming stays with TV/Phone'],
    ['MEMBERSHIP FEE INSTALLMENT', null, 'Fees/Subscription', 'kw', 'and memberships land there too'],
  ];
  const catResults = await page.evaluate(cases =>
    cases.map(([d, f]) => meCategorise(d, f)), CAT_CASES);

  // ── the Monthly category list: alphabetical, and four names kept off it ──
  const list = await page.evaluate(() => {
    const saved = state.yf.txns;            // restored below: later checks read it
    state.yf.txns = [
      { id: 'a', type: 'expense', date: '2026-09-01', amt: 1, cat: 'Credit Bill' },
      { id: 'b', type: 'expense', date: '2026-09-02', amt: 1, cat: 'Rent' },
      { id: 'c', type: 'expense', date: '2026-09-03', amt: 1, cat: 'Taxi' },
      { id: 'd', type: 'expense', date: '2026-09-04', amt: 1, cat: 'Entertainment' },
      { id: 'e', type: 'expense', date: '2026-09-05', amt: 1, cat: 'Aardvark food' }];
    const all = meAllCats();
    const kept = meAllCats('Rent').includes('Rent');
    state.yf.txns = saved;
    return { all, kept };
  });
  const sorted = list.all.slice().sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  check(JSON.stringify(list.all) === JSON.stringify(sorted), 'the category list is sorted A→Z',
    list.all.slice(0, 3).join(' / ') + ' … ' + list.all.slice(-2).join(' / '));
  const banned = ['Rent', 'Credit Bill', 'Taxi', 'Entertainment', 'Food'].filter(c => list.all.includes(c));
  check(banned.length === 0, "Yearly's names are not offered on Monthly",
    banned.length ? JSON.stringify(banned) : 'none of them');
  check(!list.all.includes('Aardvark food'),
    'and neither is a name that exists only in the shared ledger — the lists are separate',
    JSON.stringify(list.all.slice(0, 2)));
  check(list.all.length === 13, "Monthly offers exactly its own 13 categories", String(list.all.length));
  check(list.kept, 'but the row being edited keeps its own name, so editing cannot blank it');
  CAT_CASES.forEach(([d, f, wantCat, wantWhy, note], i) => {
    const got = catResults[i];
    check(got.cat === wantCat && got.why === wantWhy,
      `"${d}" + file=${JSON.stringify(f)} -> ${wantCat}/${wantWhy}`,
      got.cat === wantCat && got.why === wantWhy ? `(${note})` : `got ${got.cat}/${got.why}`);
  });

  // keyword tier: verify a keyword actually routes without any rule
  const kw = await page.evaluate(() => {
    const saved = JSON.parse(JSON.stringify(state.me.rules));
    state.me.rules = {};                       // drop rules so keywords are reached
    const r = ['Loblaws', 'Shell Gas'].map(d => meCategorise(d, null));
    state.me.rules = saved;
    return r;
  });
  check(kw[0].why === 'kw', 'keyword tier reached once rules are cleared', `(Loblaws -> ${kw[0].cat}/${kw[0].why})`);

  // ── 2. Exclusions and dedup fingerprints ──────────────────────────────────
  console.log('\n── exclusions + dedup ──');
  const EXCL = [['PAYMENT THANK YOU', true], ['AUTOPAY 1234', true],
  ['ONLINE PAYMENT', true], ['LOBLAWS #123', false], ['RENT', false]];
  const exclRes = await page.evaluate(rows => rows.map(([d]) => meIsExcluded(d)), EXCL);
  EXCL.forEach(([d, want], i) => check(exclRes[i] === want, `meIsExcluded("${d}") === ${want}`));

  const fp = await page.evaluate(() => ({
    same: meFingerprint({ date: '2026-01-04', amt: 320.55, desc: 'Loblaws #123 Toronto' })
      === meFingerprint({ date: '2026-01-04', amt: 320.55, desc: 'Loblaws #123 Toronto' }),
    amtDiff: meFingerprint({ date: '2026-01-04', amt: 320.55, desc: 'Loblaws' })
      !== meFingerprint({ date: '2026-01-04', amt: 320.56, desc: 'Loblaws' }),
    dateDiff: meFingerprint({ date: '2026-01-04', amt: 320.55, desc: 'Loblaws' })
      !== meFingerprint({ date: '2026-01-05', amt: 320.55, desc: 'Loblaws' }),
  }));
  check(fp.same, 'identical rows produce the same fingerprint');
  check(fp.amtDiff, 'a 1-cent difference changes the fingerprint');
  check(fp.dateDiff, 'a different date changes the fingerprint');

  // ── 3. Contribution limits + room (data-driven) ───────────────────────────
  console.log('\n── limitFor() / contribution room (data-driven) ──');
  const LIMITS = [
    ['TFSA', 2026, 7000, 'explicit override from limitsY'],
    ['FHSA', 2026, 8000, 'explicit override from limitsY'],
    ['FHSA', 2022, 0, 'FHSA did not exist before 2023'],
  ];
  const limRes = await page.evaluate(rows => rows.map(([a, y]) => limitFor(a, y)), LIMITS);
  LIMITS.forEach(([a, y, want, note], i) =>
    check(limRes[i] === want, `limitFor(${a},${y}) === ${want}`,
      limRes[i] === want ? `(${note})` : `got ${limRes[i]}`));

  const room = await page.evaluate(() => ({
    tfsa2026: contributed('TFSA', 2026), fhsa2026: contributed('FHSA', 2026),
    tfsa2025: contributed('TFSA', 2025),
  }));
  check(near(room.tfsa2026, 4200), 'TFSA 2026 contributions total 4200', `got ${room.tfsa2026}`);
  check(near(room.fhsa2026, 5000), 'FHSA 2026 contributions total 5000', `got ${room.fhsa2026}`);
  check(near(room.tfsa2025, 3000), 'TFSA 2025 contributions total 3000', `got ${room.tfsa2025}`);

  // ── 4. Yearly Finance actuals (data-driven per category) ──────────────────
  console.log('\n── yfActual() per category (data-driven) ──');
  const YF = [
    ['expense', 'Grocery', 608.65], ['expense', 'Home', 2900],
    ['expense', 'Transportation', 96.40], ['expense', 'Health/medical', 62.99],
    ['income', 'Paycheck', 8400], ['income', 'Bonus', 900],
    ['expense', null, 3668.04], ['income', null, 9300],
  ];
  await page.evaluate(() => { state.yfYear = 2026; });
  const yfRes = await page.evaluate(rows => rows.map(([t, c]) => yfActual(t, c)), YF);
  YF.forEach(([t, c, want], i) =>
    check(near(yfRes[i], want), `yfActual(${t}, ${c ?? 'ALL'}) === ${want}`,
      near(yfRes[i], want) ? '' : `got ${yfRes[i]}`));

  // ── 5. CSV parser (data-driven) ───────────────────────────────────────────
  console.log('\n── parseCSV() (data-driven) ──');
  const CSV = [
    ['a,b,c\n1,2,3', [['a', 'b', 'c'], ['1', '2', '3']], 'plain rows'],
    ['a,b\n"x,y",z', [['a', 'b'], ['x,y', 'z']], 'quoted comma'],
    ['a,b\n"he said ""hi""",z', [['a', 'b'], ['he said "hi"', 'z']], 'escaped quotes'],
    ['a,b\r\n1,2', [['a', 'b'], ['1', '2']], 'CRLF line endings'],
  ];
  const csvRes = await page.evaluate(rows => rows.map(([t]) => parseCSV(t)), CSV);
  CSV.forEach(([t, want, note], i) => {
    const got = csvRes[i];
    check(JSON.stringify(got) === JSON.stringify(want), `parseCSV: ${note}`,
      JSON.stringify(got) === JSON.stringify(want) ? '' : `got ${JSON.stringify(got)}`);
  });

  // ── 6. Holdings math with mixed currencies ────────────────────────────────
  console.log('\n── holdings math (mixed USD/CAD) ──');
  const hm = await page.evaluate(() => {
    const fx = state.fx;
    return {
      fx,
      // AAPL 10@180.50 USD + NVDA 4@900 USD + VFV 25@132.10 CAD + ENB 60@48.20 CAD
      investedBase: invested(state.holdings),
      marketBase: marketVal(state.holdings),
      natToBaseCAD: natToBase(137, 'CAD'),
      natToBaseUSD: natToBase(100, 'USD'),
      tfsaOnly: invested(state.holdings.filter(h => h.acct === 'TFSA')),
    };
  });
  const expInvested = (10 * 180.5) + (4 * 900) + ((25 * 132.1) / 1.37) + ((60 * 48.2) / 1.37);
  const expMarket = (10 * 212.4) + (4 * 845.25) + ((25 * 148.9) / 1.37) + ((60 * 52.75) / 1.37);
  check(near(hm.natToBaseCAD, 100), 'natToBase(137,CAD) === 100 at fx 1.37', `got ${hm.natToBaseCAD}`);
  check(near(hm.natToBaseUSD, 100), 'natToBase(100,USD) === 100 (no conversion)', `got ${hm.natToBaseUSD}`);
  check(near(hm.investedBase, expInvested, 0.01), `invested() === ${expInvested.toFixed(2)} USD base`, `got ${hm.investedBase.toFixed(2)}`);
  check(near(hm.marketBase, expMarket, 0.01), `marketVal() === ${expMarket.toFixed(2)} USD base`, `got ${hm.marketBase.toFixed(2)}`);

  // ── 7. THE INVARIANT (ref doc §2/§8.4): only the Dashboard converts ────────
  console.log('\n── CAD-only invariant: FX must not move Contributions/Yearly/Monthly ──');
  const IDS_CAD_ONLY = ['cTfsaAmt', 'cFhsaAmt', 'yfStartVal', 'yfEndVal', 'yfInvested',
    'yfSaved', 'yfAvgInc', 'yfAvgExp', 'yfSavedBig', 'yfExpAct', 'yfIncAct',
    'meTotal', 'meDaily', 'meTopAmt'];
  const IDS_DASH = ['heroValue', 'tfsaVal', 'fhsaVal'];

  const snap = () => page.evaluate(ids => {
    const o = {}; for (const i of ids) { const e = document.getElementById(i); o[i] = e ? e.textContent.trim() : null; }
    return o;
  }, [...IDS_CAD_ONLY, ...IDS_DASH]);

  // render every view once at the base rate
  await page.evaluate(() => { renderContribs(); renderYF(); renderME(); render(); });
  const before = await snap();
  // double the exchange rate and re-render everything
  await page.evaluate(() => {
    state.fx = 2.74;
    renderContribs(); renderYF(); renderME(); render();
  });
  const after = await snap();

  let moved = [];
  for (const id of IDS_CAD_ONLY) if (before[id] !== after[id]) moved.push(`${id}: ${before[id]} -> ${after[id]}`);
  check(moved.length === 0, `all ${IDS_CAD_ONLY.length} CAD-only figures unchanged when FX doubles`,
    moved.length ? '\n        ' + moved.join('\n        ') : '');

  let dashMoved = IDS_DASH.filter(id => before[id] !== after[id]);
  check(dashMoved.length > 0, 'Dashboard figures DO react to FX (conversion still works)',
    `(${dashMoved.length}/${IDS_DASH.length} changed)`);

  // static check: none of the CAD-only render paths reference the FX rate
  console.log('\n── static check: no FX helpers inside CAD-only render paths ──');
  const fs = require('fs');
  const src = fs.readFileSync(APP, 'utf8');
  for (const fn of ['renderYF', 'renderME', 'renderContribs']) {
    const i = src.indexOf(`function ${fn}(`);
    const body = src.slice(i, i + 4000);
    const bad = /\bstate\.fx\b|\btoBase\(|\brate\(\)/.test(body);
    check(!bad, `${fn}() contains no state.fx / toBase() / rate()`);
  }

  // ── 8. Legacy CAD migration, both branches (ref doc §2) ───────────────────
  console.log('\n── migrateContribCAD(): legacy USD rows convert once, CAD rows do not ──');
  const MIG = [
    { flag: false, cad: false, amt: 1000, want: 1370, note: 'legacy row, no flag -> converted once at fx' },
    { flag: false, cad: true,  amt: 1000, want: 1000, note: 'row already marked cad -> untouched' },
    { flag: true,  cad: false, amt: 1000, want: 1000, note: 'cadFixed flag set -> migration skipped entirely' },
  ];
  for (const m of MIG) {
    const seed = Object.assign({}, require('./lib').SEED, {
      'sparta.contrib.entries': JSON.stringify([
        Object.assign({ id: 'm1', t: Date.UTC(2026, 0, 8), acct: 'TFSA', amt: m.amt, y: 2026 },
          m.cad ? { cad: true } : {})]),
    });
    if (m.flag) seed['sparta.contrib.cadFixed'] = 'true'; else delete seed['sparta.contrib.cadFixed'];
    const s2 = await open(browser, url, seed);
    const got = await s2.page.evaluate(() => contributed('TFSA', 2026));
    check(near(got, m.want), `flag=${m.flag} cad=${m.cad} amt=${m.amt} -> ${m.want}`,
      near(got, m.want) ? `(${m.note})` : `got ${got}`);
    await s2.ctx.close();
  }

  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nDATA-DRIVEN + UNIT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
