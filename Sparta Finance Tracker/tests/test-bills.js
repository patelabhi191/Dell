/* Bills & allocations accounting (Phase 1).

   An expense carrying `allot` is an allocation: part of a bill already recorded
   under that category, itemised into a category of its own. It must never add
   to a total. The load-bearing test here is the INVARIANT — for any ledger,
   the category actuals must sum to the spend total. A break there silently
   misstates the user's finances rather than throwing. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const YEAR = 2026;
const tx = (o, i) => Object.assign({ id: 'b' + i, type: 'expense', who: 'ABI', desc: '' }, o);

const load = (page, txns) => page.evaluate(([t, y]) => {
  state.yfYear = y;
  state.yf.txns = t;
  // every category used must exist, or the Yearly table has no row to report
  t.forEach(x => {
    if (x.type === 'expense' && x.cat && !state.yf.cats.exp.includes(x.cat)) state.yf.cats.exp.push(x.cat);
    if (x.allot && !state.yf.cats.exp.includes(x.allot)) state.yf.cats.exp.push(x.allot);
  });
  render(); renderYF();
  const cats = state.yf.cats.exp;
  const actuals = {};
  cats.forEach(c => { actuals[c] = yfActual('expense', c); });
  const sum = Object.values(actuals).reduce((s, v) => s + v, 0);
  return { spend: yfActual('expense', null), actuals, sum };
}, [txns, YEAR]);

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  // ── 1. THE INVARIANT: category actuals always sum to the spend total ──
  console.log('\n── 1. invariant: Σ actual(cat) === spend ──');
  const cases = {
    'plain expenses only': [
      { date: `${YEAR}-01-05`, amt: 1000, cat: 'Home' },
      { date: `${YEAR}-02-05`, amt: 250, cat: 'Food' },
    ],
    'bill + allocations (the credit-card case)': [
      { date: `${YEAR}-09-05`, amt: 2000, cat: 'Credit Bill' },
      { date: `${YEAR}-09-06`, amt: 100, cat: 'Groceries', allot: 'Credit Bill' },
      { date: `${YEAR}-09-12`, amt: 58, cat: 'TV/Phone/Internet', allot: 'Credit Bill' },
      { date: `${YEAR}-09-18`, amt: 40, cat: 'Dining Out', allot: 'Credit Bill' },
    ],
    'derived bill (itemise first)': [
      { date: `${YEAR}-09-15`, amt: 198, cat: 'Credit Bill', derived: true },
      { date: `${YEAR}-09-06`, amt: 100, cat: 'Groceries', allot: 'Credit Bill' },
      { date: `${YEAR}-09-12`, amt: 58, cat: 'TV/Phone/Internet', allot: 'Credit Bill' },
      { date: `${YEAR}-09-18`, amt: 40, cat: 'Dining Out', allot: 'Credit Bill' },
    ],
    'over-allocated bill': [
      { date: `${YEAR}-09-05`, amt: 2000, cat: 'Credit Bill' },
      { date: `${YEAR}-09-06`, amt: 2100, cat: 'Groceries', allot: 'Credit Bill' },
    ],
    'two bill categories in one month': [
      { date: `${YEAR}-09-05`, amt: 2000, cat: 'Credit Bill' },
      { date: `${YEAR}-09-05`, amt: 900, cat: 'Other Bank' },
      { date: `${YEAR}-09-06`, amt: 100, cat: 'Groceries', allot: 'Credit Bill' },
      { date: `${YEAR}-09-07`, amt: 400, cat: 'Home', allot: 'Other Bank' },
    ],
    'allocations spanning months': [
      { date: `${YEAR}-08-05`, amt: 500, cat: 'Credit Bill' },
      { date: `${YEAR}-09-05`, amt: 700, cat: 'Credit Bill' },
      { date: `${YEAR}-08-09`, amt: 120, cat: 'Groceries', allot: 'Credit Bill' },
      { date: `${YEAR}-09-09`, amt: 300, cat: 'Groceries', allot: 'Credit Bill' },
    ],
    'mixed: bill, allocation and unrelated spend': [
      { date: `${YEAR}-09-05`, amt: 2000, cat: 'Credit Bill' },
      { date: `${YEAR}-09-06`, amt: 100, cat: 'Groceries', allot: 'Credit Bill' },
      { date: `${YEAR}-09-20`, amt: 45, cat: 'Travel' },
      { date: `${YEAR}-09-01`, amt: 5000, cat: 'Paycheck', type: 'income' },
    ],
  };
  for (const [name, rows] of Object.entries(cases)) {
    const r = await load(page, rows.map(tx));
    check(Math.abs(r.sum - r.spend) < 0.005, name, `Σactual ${r.sum.toFixed(2)} vs spend ${r.spend.toFixed(2)}`);
  }

  // ── 2. the user's exact numbers ──
  console.log("\n── 2. no double counting ──");
  const r2 = await load(page, cases['bill + allocations (the credit-card case)'].map(tx));
  check(r2.spend === 2000, 'year total stays $2,000 after itemising $198', String(r2.spend));
  check(r2.actuals['Credit Bill'] === 1802, 'Credit Bill shows the $1,802 remainder',
    String(r2.actuals['Credit Bill']));
  check(r2.actuals['Groceries'] === 100 && r2.actuals['TV/Phone/Internet'] === 58
    && r2.actuals['Dining Out'] === 40, 'itemised categories carry 100 / 58 / 40',
    JSON.stringify([r2.actuals['Groceries'], r2.actuals['TV/Phone/Internet'], r2.actuals['Dining Out']]));

  // ── 3. Scenario 1: derived bill leaves no phantom remainder ──
  console.log('\n── 3. Scenario 1 — itemise first ──');
  const r3 = await load(page, cases['derived bill (itemise first)'].map(tx));
  check(r3.spend === 198, 'total equals what was itemised', String(r3.spend));
  check(r3.actuals['Credit Bill'] === 0, 'Credit Bill nets to zero, no phantom remainder',
    String(r3.actuals['Credit Bill']));

  // ── 4. over-allocation shows as negative rather than being hidden ──
  console.log('\n── 4. over-allocation ──');
  const r4 = await load(page, cases['over-allocated bill'].map(tx));
  check(r4.actuals['Credit Bill'] === -100, 'Credit Bill reads −$100, surfacing the overage',
    String(r4.actuals['Credit Bill']));
  check(r4.spend === 2000, 'total is still the bill, not the over-allocation', String(r4.spend));

  // ── 5. existing ledgers must be untouched ──
  console.log('\n── 5. migration: a ledger with no allot/derived is unchanged ──');
  const plain = [
    { date: `${YEAR}-01-05`, amt: 1000, cat: 'Home' },
    { date: `${YEAR}-02-05`, amt: 250, cat: 'Food' },
    { date: `${YEAR}-03-05`, amt: 75, cat: 'Travel' },
  ].map(tx);
  const r5 = await load(page, plain);
  check(r5.spend === 1325, 'plain ledger totals exactly as before', String(r5.spend));
  check(r5.actuals['Home'] === 1000 && r5.actuals['Food'] === 250 && r5.actuals['Travel'] === 75,
    'each category unchanged', JSON.stringify([r5.actuals['Home'], r5.actuals['Food'], r5.actuals['Travel']]));

  // ── 6. Monthly agrees with Yearly for the same month ──
  console.log('\n── 6. Monthly / Yearly parity ──');
  const parity = await page.evaluate(([rows, y]) => {
    state.yfYear = y;
    state.yf.txns = rows;
    rows.forEach(x => { if (x.cat && !state.yf.cats.exp.includes(x.cat)) state.yf.cats.exp.push(x.cat); });
    meMonth = `${y}-09`;
    render(); renderYF(); renderME();
    const mrow = n => {
      const tr = [...document.querySelectorAll('#yfMBody tr')].find(r => r.children[0].textContent.trim() === n);
      return tr ? tr.children[9].textContent.trim() : null;   // September
    };
    return {
      monthlyTotal: document.getElementById('meTotal').textContent,
      monthlyCount: document.getElementById('meCount').textContent,
      yearlyChartSept: mrow('EXPENSE'),
    };
  }, [cases['bill + allocations (the credit-card case)'].map(tx), YEAR]);
  check(/2,000/.test(parity.monthlyTotal) && /2,000/.test(parity.yearlyChartSept),
    'Monthly total and Yearly September EXPENSE both read $2,000',
    `${parity.monthlyTotal} / ${parity.yearlyChartSept}`);
  // phase 2 appends the itemised figure to this field, on purpose
  check(/^4\b/.test(parity.monthlyCount) && /198/.test(parity.monthlyCount),
    'Monthly lists all 4 entries and names the $198 itemised', parity.monthlyCount);

  // ───────────────────────── Phase 2 ─────────────────────────
  const addVia = (month, amt, cat, desc, allot) => page.evaluate(([m, a, c, d, al]) => {
    meMonth = m; renderME();
    document.getElementById('meAmt').value = a;
    meFillCatSelect(); meFillAllotSelect();
    document.getElementById('meCat').value = c;
    document.getElementById('meDesc').value = d;
    document.getElementById('meAllot').value = al || '';
    meSaveTx();
    return true;
  }, [month, amt, cat, desc, allot]);
  const reset = () => page.evaluate(y => { state.yfYear = y; state.yf.txns = []; render(); renderYF(); }, YEAR);
  const rows = month => page.evaluate(m => {
    meMonth = m; renderME();
    return [...document.querySelectorAll('#meBody tr')].map(tr => ({
      date: tr.children[0].textContent.trim(),
      desc: tr.children[1].textContent.trim(),
      amt: tr.children[2].textContent.trim(),
    }));
  }, month);

  console.log('\n── 7. the form has no date field ──');
  check(await page.evaluate(() => !document.getElementById('meDate')), 'Date input removed');
  check(await page.evaluate(() => !!document.getElementById('meAllot')), '"Allot to" select present');

  console.log('\n── 8. month-only entry ──');
  await reset();
  await addVia(`${YEAR}-08`, '100', 'Grocery', 'Lablows', '');
  const mo = await page.evaluate(() => state.yf.txns.map(t => ({ d: t.date, mOnly: !!t.mOnly })));
  check(mo[0].d === `${YEAR}-08-15` && mo[0].mOnly, 'stored as the 15th, flagged month-only',
    JSON.stringify(mo[0]));
  const augRows = await rows(`${YEAR}-08`);
  check(augRows[0].date === `AUG ${YEAR}`, 'list shows the month, not an invented day', augRows[0].date);

  console.log("\n── 9. the user's 18th-to-17th cycle ──");
  await reset();
  // the August statement, entered in August, plus purchases from 20 Jul onward
  await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'bill', type: 'expense', date: `${y}-08-20`, amt: 2000,
      desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' }];
    render();
  }, [YEAR]);
  // imported rows keep real July dates but are allotted to August
  await page.evaluate(([y]) => {
    state.yf.txns.push(
      { id: 'j1', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'j2', type: 'expense', date: `${y}-07-28`, amt: 58, desc: 'Bell', cat: 'Home', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'a1', type: 'expense', date: `${y}-08-10`, amt: 40, desc: 'Taco Bell', cat: 'Food', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` });
    renderYF(); renderME();
  }, [YEAR]);
  const jul = await rows(`${YEAR}-07`), aug = await rows(`${YEAR}-08`);
  check(jul.length === 0, 'nothing shows under July', JSON.stringify(jul.map(r => r.desc)));
  check(aug.length === 4, 'all three purchases plus the bill show under August',
    JSON.stringify(aug.map(r => r.desc)));
  check(aug.some(r => r.date === `${YEAR}-07-20`), 'the 20 July purchase keeps its real date',
    JSON.stringify(aug.map(r => r.date)));
  const cyc = await page.evaluate(() => ({ spend: yfActual('expense', null), cb: yfActual('expense', 'Credit Bill') }));
  check(cyc.spend === 2000, 'year total still $2,000', String(cyc.spend));
  check(cyc.cb === 1802, 'Credit Bill nets to $1,802', String(cyc.cb));

  console.log('\n── 10. nothing is invented: you can only itemise into a bill that exists ──');
  await reset();
  // Allot to now offers only the bills Yearly already holds for that month, so
  // there is never a missing one to create. Forcing the old path proves it.
  await addVia(`${YEAR}-09`, '100', 'Grocery', 'Loblaws', 'Credit Bill');
  const none = await page.evaluate(() => ({
    invented: state.yf.txns.filter(t => t.cat === 'Credit Bill' && !t.allot).length,
    derived: state.yf.txns.filter(t => t.derived).length,
    spend: yfActual('expense', null),
  }));
  check(none.invented === 0, 'no bill is conjured for a month that has none', String(none.invented));
  check(none.derived === 0, 'and nothing is flagged derived — the concept is gone');
  // The dropdown cannot offer a bill that does not exist, so setting that value
  // through the form simply does not take: the row saves as ORDINARY spending.
  // The UI can no longer produce an orphan allocation at all.
  const orphan = await page.evaluate(() => state.yf.txns.map(t => t.allot || null));
  check(orphan.every(a => a === null), 'the row saves as ordinary spending, not an orphan allocation',
    JSON.stringify(orphan));
  check(none.spend === 100, 'so it counts as an ordinary $100 expense', String(none.spend));

  console.log('\n── 11. the dropdown offers that month\'s real bills, and only those ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'v', type: 'expense', date: `${y}-07-12`, amt: 1550, desc: 'Vacation', cat: 'Travel', who: 'ABI' },
      { id: 'c', type: 'expense', date: `${y}-07-20`, amt: 1910, desc: 'Credit Bill', cat: 'Credit Bill', who: 'ABI' },
      { id: 'i', type: 'income',  date: `${y}-07-15`, amt: 4200, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { id: 'h', type: 'expense', date: `${y}-08-18`, amt: 1450, desc: 'Rent', cat: 'Home', who: 'ABI' }];
    yfPersist(); meMonth = `${y}-07`; renderME();
  }, [YEAR]);
  const julOpts = await page.evaluate(() => [...document.getElementById('meAllot').options].map(o => o.value));
  check(julOpts.length === 3 && julOpts.includes('Travel') && julOpts.includes('Credit Bill'),
    'July offers exactly its two expenses, not every category', JSON.stringify(julOpts));
  check(!julOpts.includes('Home'), "August's bill is not on July's list");
  check(!julOpts.includes('Paycheck'), 'income is never an allot target');
  const labelled = await page.evaluate(() =>
    [...document.getElementById('meAllot').options].map(o => o.textContent).join(' | '));
  check(/1,910/.test(labelled) && /1,550/.test(labelled),
    'each option shows what it is worth', labelled);

  // the form's own Month picker re-scopes the list
  await page.evaluate(([y]) => { const s = document.getElementById('meFormMonth');
    s.value = `${y}-08`; s.dispatchEvent(new Event('change', { bubbles: true })); }, [YEAR]);
  await page.waitForTimeout(150);
  const augOpts = await page.evaluate(() => [...document.getElementById('meAllot').options].map(o => o.value));
  check(augOpts.length === 2 && augOpts.includes('Home'), 'switching the form to August swaps the list',
    JSON.stringify(augOpts));

  // a month Yearly knows nothing about
  await page.evaluate(([y]) => { const s = document.getElementById('meFormMonth');
    s.value = `${y}-10`; s.dispatchEvent(new Event('change', { bubbles: true })); }, [YEAR]);
  await page.waitForTimeout(150);
  const empty = await page.evaluate(() => ({
    opts: document.getElementById('meAllot').options.length,
    note: document.getElementById('meAllotNote').textContent }));
  check(empty.opts === 1, 'an empty month offers only — none —', String(empty.opts));
  check(/add one there first/.test(empty.note), 'and the note says why', empty.note);

  console.log('\n── 11b. the double-count that auto-creation used to cause ──');
  await reset();
  const dc = await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'i1', type: 'expense', date: `${y}-07-04`, amt: 300, desc: 'Loblaws',
      cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-07` }];
    yfAttachAllot('Credit Bill', `${y}-07`, 'ABI');          // the old auto-create path
    const rowsAfter = state.yf.txns.length;
    state.yf.txns.push({ id: 'b1', type: 'expense', date: `${y}-07-20`, amt: 1910,
      desc: 'Credit Bill July', cat: 'Credit Bill', who: 'ABI' });
    const list = state.yf.txns.filter(t => t.type === 'expense');
    return { rowsAfter, bills: list.filter(t => t.cat === 'Credit Bill' && !t.allot).length,
             total: +yfSpendOf(list).toFixed(2), cb: +yfCatOf(list, 'Credit Bill').toFixed(2) };
  }, [YEAR]);
  check(dc.rowsAfter === 1, 'itemising into a missing bill adds no row', String(dc.rowsAfter));
  check(dc.bills === 1, 'so the month ends with ONE Credit Bill, not two', String(dc.bills));
  check(dc.total === 1910, 'the year total is $1,910, not $2,210', String(dc.total));
  check(dc.cb === 1610, 'and Credit Bill nets to $1,610 after the $300 itemised out',
    String(dc.cb));

  console.log('\n── 11c. rows the old code invented migrate without moving a total ──');
  const mig = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'd1', type: 'expense', date: `${y}-07-15`, amt: 300, desc: 'Credit Bill (from itemised)',
        cat: 'Credit Bill', who: 'ABI', derived: true },
      { id: 'i1', type: 'expense', date: `${y}-07-04`, amt: 300, desc: 'Loblaws', cat: 'Grocery',
        who: 'ABI', allot: 'Credit Bill', allotM: `${y}-07` }];
    const before = +yfSpendOf(state.yf.txns.filter(t => t.type === 'expense')).toFixed(2);
    normalizeYF();
    const after = +yfSpendOf(state.yf.txns.filter(t => t.type === 'expense')).toFixed(2);
    return { before, after, flagged: state.yf.txns.some(t => t.derived),
             amt: state.yf.txns.find(t => t.id === 'd1').amt };
  }, [YEAR]);
  check(!mig.flagged, 'the derived flag is dropped');
  check(mig.amt === 300, 'the amount is untouched', String(mig.amt));
  check(mig.before === mig.after, 'and the total does not move — a migration that shifts money is worse than the bug',
    `${mig.before} -> ${mig.after}`);

  console.log('\n── 12. trend follows the bill month ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` }];
    renderYF(); renderME();
  }, [YEAR]);
  const trend = await page.evaluate(y => meMonthlyByCat(String(y)), YEAR);
  check(trend['Grocery'][7] === 100 && trend['Grocery'][6] === 0,
    'the 20 July purchase is charted under August', JSON.stringify({ jul: trend['Grocery'][6], aug: trend['Grocery'][7] }));

  console.log('\n── 13. backfill + invariant hold after all of it ──');
  const back = await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'x', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'old', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill' }];
    normalizeYF();
    return state.yf.txns[0].allotM;
  }, [YEAR]);
  check(back === `${YEAR}-07`, 'an allocation without allotM takes it from its date', back);

  const inv = await load(page, [
    { date: `${YEAR}-08-20`, amt: 2000, cat: 'Credit Bill' },
    { date: `${YEAR}-07-20`, amt: 100, cat: 'Grocery', allot: 'Credit Bill', allotM: `${YEAR}-08` },
    { date: `${YEAR}-09-15`, amt: 158, cat: 'Credit Bill', derived: true },
    { date: `${YEAR}-09-02`, amt: 158, cat: 'Food', allot: 'Credit Bill', allotM: `${YEAR}-09` },
    { date: `${YEAR}-05-04`, amt: 75, cat: 'Travel' },
  ].map(tx));
  check(Math.abs(inv.sum - inv.spend) < 0.005, 'invariant still holds with cross-month allocations',
    `Σactual ${inv.sum.toFixed(2)} vs spend ${inv.spend.toFixed(2)}`);

  // ───────────────────────── Phase 3A: import allotment ─────────────────────────
  // Drive the real import path: seed mePending the way the parser would, then apply.
  const importRows = (month, allot, rows) => page.evaluate(([m, al, rs]) => {
    meMonth = m; renderME();
    mePending = rs.map((r, i) => ({ include: true, date: r.d, amt: r.a, desc: r.desc,
      cat: r.c, why: 'rule', changed: false, fp: 'fp' + Math.random() + i }));
    meFillAllotSelect();
    document.getElementById('meImpAllot').value = al || '';
    meApplyImport();
    return true;
  }, [month, allot, rows]);
  const STMT = [
    { d: `${YEAR}-07-20`, a: 100, desc: 'Loblaws', c: 'Grocery' },
    { d: `${YEAR}-07-28`, a: 58, desc: 'Bell', c: 'Home' },
    { d: `${YEAR}-08-10`, a: 40, desc: 'Taco Bell', c: 'Food' },
  ];

  console.log('\n── 14. importing a statement allotted to a bill ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'bill', type: 'expense', date: `${y}-08-20`, amt: 2000,
      desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' }];
    render();
  }, [YEAR]);
  await importRows(`${YEAR}-08`, 'Credit Bill', STMT);
  const imp = await page.evaluate(() => state.yf.txns.filter(t => t.allot).map(t => ({ d: t.date, m: t.allotM, a: t.amt })));
  check(imp.length === 3 && imp.every(r => r.m === `${YEAR}-08`),
    'every imported row is allotted to August', JSON.stringify(imp.map(r => r.m)));
  check(imp.some(r => r.d === `${YEAR}-07-20`), 'rows keep their own statement dates',
    JSON.stringify(imp.map(r => r.d)));
  const impJul = await rows(`${YEAR}-07`), impAug = await rows(`${YEAR}-08`);
  check(impJul.length === 0, 'nothing lands under July', JSON.stringify(impJul.map(r => r.desc)));
  check(impAug.length === 4, 'all three plus the bill show under August', String(impAug.length));
  const impTot = await page.evaluate(() => ({ spend: yfActual('expense', null), cb: yfActual('expense', 'Credit Bill') }));
  check(impTot.spend === 2000 && impTot.cb === 1802, 'total stays $2,000, Credit Bill $1,802',
    JSON.stringify(impTot));

  console.log('\n── 15. importing when the month has no bill invents nothing ──');
  await reset();
  await importRows(`${YEAR}-09`, 'Credit Bill', STMT);
  const sc = await page.evaluate(() => ({
    invented: state.yf.txns.filter(t => t.cat === 'Credit Bill' && !t.allot).length,
    spend: yfActual('expense', null),
    allots: state.yf.txns.map(t => t.allot || null) }));
  check(sc.invented === 0, 'no bill is created for the import to hang off', String(sc.invented));
  // meImpAllot is scoped the same way, so "Credit Bill" is not on offer for a
  // month Yearly has nothing in: the rows import as ordinary spending instead.
  check(sc.allots.every(a => a === null), 'the rows import as ordinary expenses',
    JSON.stringify(sc.allots));
  check(sc.spend === 198, 'and count normally toward the total', String(sc.spend));

  console.log('\n── 16. importing past a fixed bill warns ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'b', type: 'expense', date: `${y}-08-20`, amt: 100,
      desc: 'small bill', cat: 'Credit Bill', who: 'ABI' }];
    render();
  }, [YEAR]);
  await importRows(`${YEAR}-08`, 'Credit Bill', STMT);
  const warned = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('toast').textContent;
  });
  check(/Over-allotted/.test(warned), 'overage is reported, import still succeeds', JSON.stringify(warned));
  check(await page.evaluate(() => state.yf.txns.filter(t => t.allot).length) === 3,
    'all three rows imported despite the overage');

  console.log('\n── 17. REGRESSION: leaving it on none behaves as before ──');
  await reset();
  await importRows(`${YEAR}-08`, '', STMT);
  const plainImp = await page.evaluate(() => state.yf.txns.map(t => ({ d: t.date, allot: t.allot || null, a: t.amt })));
  check(plainImp.length === 3 && plainImp.every(r => r.allot === null),
    'rows import as ordinary expenses, no allot', JSON.stringify(plainImp.map(r => r.allot)));
  check(await page.evaluate(() => yfActual('expense', null)) === 198,
    'they add to the total the old way', '198');
  const pJul = await rows(`${YEAR}-07`), pAug = await rows(`${YEAR}-08`);
  check(pJul.length === 2 && pAug.length === 1,
    'and group by their own dates — 2 in July, 1 in August',
    JSON.stringify({ jul: pJul.length, aug: pAug.length }));

  console.log('\n── 18. invariant over an imported ledger ──');
  const impInv = await page.evaluate(() => {
    const cats = state.yf.cats.exp;
    const sum = cats.reduce((s, c) => s + yfActual('expense', c), 0);
    return { sum, spend: yfActual('expense', null) };
  });
  check(Math.abs(impInv.sum - impInv.spend) < 0.005, 'still holds after importing',
    `Σactual ${impInv.sum.toFixed(2)} vs spend ${impInv.spend.toFixed(2)}`);

  // ───────────────────────── Phase 3B/C: legibility ─────────────────────────
  console.log('\n── 19. an allocation is visibly different from ordinary spending ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'p', type: 'expense', date: `${y}-08-04`, amt: 45, desc: 'Cash lunch', cat: 'Food', who: 'ABI' }];
    meMonth = `${y}-08`; render(); renderYF(); renderME();
  }, [YEAR]);
  const pills = await page.evaluate(() => {
    const out = {};
    [...document.querySelectorAll('#meBody tr')].forEach(tr => {
      out[tr.children[1].textContent.trim()] = tr.children[3].innerHTML;
    });
    return out;
  });
  check(/→ Credit Bill/.test(pills['Loblaws'] || ''), 'an allocation carries a "→ Credit Bill" pill',
    (pills['Loblaws'] || '').slice(0, 90));
  check(!/acct-tag/.test(pills['Cash lunch'] || ''), 'ordinary spending carries no pill');
  // There is no "auto" marking any more: bills are only ever typed into Yearly,
  // so there is no such thing as a bill nobody entered.
  const noAuto = await page.evaluate(() => document.body.innerHTML.includes('>auto<'));
  check(!noAuto, 'nothing anywhere is tagged auto — invented bills no longer exist');
  const yfHasAlloc = await page.evaluate(() =>
    [...document.querySelectorAll('#yfTxBody tr')].some(r => /Loblaws/.test(r.textContent)));
  check(yfHasAlloc === false, 'and the Yearly log still hides the allotted row');

  console.log('\n── 20. bill rows say what was billed and itemised ──');
  const note = await page.evaluate(() => {
    const row = n => {
      const tr = [...document.querySelectorAll('#yfExpBody tr')].find(r => r.children[0].textContent.trim().startsWith(n));
      return tr ? tr.children[0].innerHTML : '';
    };
    return { cb: row('Credit Bill'), food: row('Food') };
  });
  check(/2,000 billed/.test(note.cb) && /100 itemised/.test(note.cb),
    'Credit Bill reads "$2,000 billed · $100 itemised"', note.cb.replace(/<[^>]*>/g, ' ').trim());
  check(!/billnote/.test(note.food), 'a category with nothing itemised has no sub-line');

  console.log('\n── 21. over-allotment is named, not left as a bare negative ──');
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 100, desc: 'small', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-08-04`, amt: 250, desc: 'big buy', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` }];
    renderYF();
  }, [YEAR]);
  const overNote = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('#yfExpBody tr')].find(r => r.children[0].textContent.trim().startsWith('Credit Bill'));
    return tr ? tr.children[0].innerHTML : '';
  });
  check(/150 over/.test(overNote) && /over/.test(overNote), 'names the $150 overage',
    overNote.replace(/<[^>]*>/g, ' ').trim());

  // ───────── Yearly log excludes allotted rows; Monthly picks its own month ─────────
  console.log('\n── 22. Yearly lists bank movements, not the breakdown ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'c', type: 'expense', date: `${y}-08-04`, amt: 45, desc: 'Cash lunch', cat: 'Food', who: 'ABI' }];
    meMonth = `${y}-08`; render(); renderYF(); renderME();
  }, [YEAR]);
  const yfDescs = await page.evaluate(() =>
    [...document.querySelectorAll('#yfTxBody tr')].map(tr => tr.children[3].textContent.trim()));
  check(!yfDescs.includes('Loblaws'), 'the allotted row is not in the Yearly log', JSON.stringify(yfDescs));
  check(yfDescs.includes('Aug statement') && yfDescs.includes('Cash lunch'),
    'the bill and ordinary spending still are', JSON.stringify(yfDescs));
  const meDescs = await page.evaluate(() =>
    [...document.querySelectorAll('#meBody tr')].map(tr => tr.children[1].textContent.trim()));
  check(meDescs.includes('Loblaws'), 'but Monthly still shows it', JSON.stringify(meDescs));
  const stillRight = await page.evaluate(() => ({
    spend: yfActual('expense', null), grocery: yfActual('expense', 'Grocery'),
    cb: yfActual('expense', 'Credit Bill') }));
  check(stillRight.spend === 2045 && stillRight.grocery === 100 && stillRight.cb === 1900,
    'hiding it changes no figure — Grocery still carries its $100', JSON.stringify(stillRight));

  console.log('\n── 23. adding an older transaction from the Month picker ──');
  await reset();
  const addInMonth = (viewing, pick, amt, cat, desc, allot) => page.evaluate(([v, pm, a, c, d, al]) => {
    meMonth = v; renderME();
    meFillFormMonth();
    document.getElementById('meFormMonth').value = pm;
    document.getElementById('meAmt').value = a;
    meFillCatSelect(); meFillAllotSelect();
    document.getElementById('meCat').value = c;
    document.getElementById('meDesc').value = d;
    document.getElementById('meAllot').value = al || '';
    meSaveTx();
    return true;
  }, [viewing, pick, amt, cat, desc, allot]);

  check(await page.evaluate(() => !!document.getElementById('meFormMonth')), 'Month picker present on the form');
  // March needs a real bill before anything can be itemised into it
  await page.evaluate(([y]) => {
    state.yf.txns.push({ id: 'mb', type: 'expense', date: `${y}-03-20`, amt: 900,
      desc: 'March statement', cat: 'Credit Bill', who: 'ABI' });
    yfPersist(); renderME();
  }, [YEAR]);
  // sitting in August, file a March expense against March's Credit Bill
  await addInMonth(`${YEAR}-08`, `${YEAR}-03`, '250', 'Grocery', 'Old March buy', 'Credit Bill');
  const filed = await page.evaluate(() => state.yf.txns.find(t => t.desc === 'Old March buy'));
  check(filed && filed.date === `${YEAR}-03-15` && filed.allotM === `${YEAR}-03`,
    'filed against March, not the month being viewed', JSON.stringify({ d: filed && filed.date, m: filed && filed.allotM }));
  const marchBill = await page.evaluate(([y]) =>
    state.yf.txns.find(t => t.cat === 'Credit Bill' && !t.allot && (t.date || '').startsWith(`${y}-03`)), [YEAR]);
  check(marchBill && marchBill.amt === 900,
    "March's own bill is what it attached to, unchanged at $900",
    JSON.stringify(marchBill && { d: marchBill.date, a: marchBill.amt }));
  const marchNet = await page.evaluate(() => {
    const l = state.yf.txns.filter(t => t.type === 'expense');
    return { spend: +yfSpendOf(l).toFixed(2), cb: +yfCatOf(l, 'Credit Bill').toFixed(2) };
  });
  check(marchNet.spend === 900 && marchNet.cb === 650,
    'total stays $900 and Credit Bill nets to $650 after the $250 itemised out',
    JSON.stringify(marchNet));
  check(await page.evaluate(() => meMonth) === `${YEAR}-03`,
    'the tab follows the month just written to');
  const marchRows = await rows(`${YEAR}-03`);
  check(marchRows.some(r => r.desc === 'Old March buy'), 'and it shows under March',
    JSON.stringify(marchRows.map(r => r.desc)));

  // a second one into the same month attaches to the SAME bill — the bill does
  // not grow (it is the real statement figure), the remainder just shrinks again
  await addInMonth(`${YEAR}-03`, `${YEAR}-03`, '150', 'Food', 'More March', 'Credit Bill');
  const topped = await page.evaluate(([y]) => {
    const bills = state.yf.txns.filter(t => t.cat === 'Credit Bill' && !t.allot);
    const l = state.yf.txns.filter(t => t.type === 'expense');
    return { count: bills.length, amt: bills[0] && bills[0].amt,
             cb: +yfCatOf(l, 'Credit Bill').toFixed(2), spend: +yfSpendOf(l).toFixed(2) };
  }, [YEAR]);
  check(topped.count === 1, 'still one Credit Bill for March, not a second', String(topped.count));
  check(topped.amt === 900, 'the billed figure is untouched at $900', String(topped.amt));
  check(topped.cb === 500 && topped.spend === 900,
    'remainder falls to $500 as $400 is itemised out; total still $900', JSON.stringify(topped));
  const inv23 = await page.evaluate(() => {
    const sum = state.yf.cats.exp.reduce((s, c) => s + yfActual('expense', c), 0);
    return { sum, spend: yfActual('expense', null) };
  });
  check(Math.abs(inv23.sum - inv23.spend) < 0.005, 'invariant holds across months',
    `Σactual ${inv23.sum.toFixed(2)} vs spend ${inv23.spend.toFixed(2)}`);

  // ───────── Monthly's own Month + Category filters ─────────
  console.log('\n── 24. filters at the bottom of Monthly ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: '1', type: 'expense', date: `${y}-08-04`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI' },
      { id: '2', type: 'expense', date: `${y}-08-06`, amt: 58, desc: 'Bell', cat: 'Home', who: 'ABI' },
      { id: '3', type: 'expense', date: `${y}-08-09`, amt: 40, desc: 'More food', cat: 'Grocery', who: 'POO' },
      { id: '4', type: 'expense', date: `${y}-03-11`, amt: 75, desc: 'March buy', cat: 'Travel', who: 'ABI' }];
    meMonth = `${y}-08`; meTxCat = 'all'; render(); renderYF(); renderME();
  }, [YEAR]);
  check(await page.evaluate(() => !!document.getElementById('meTxMonth')), 'Month filter present');
  check(await page.evaluate(() => !!document.getElementById('meTxCat')), 'Category filter present');

  const opts = await page.evaluate(() => [...document.getElementById('meTxCat').options].map(o => o.text));
  check(JSON.stringify(opts) === JSON.stringify(['All categories', 'Grocery', 'Home']),
    'lists only the categories present this month, sorted', JSON.stringify(opts));

  const filtered = await page.evaluate(async () => {
    const s = document.getElementById('meTxCat');
    s.value = 'Grocery'; s.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    return {
      rows: [...document.querySelectorAll('#meBody tr')].map(tr => tr.children[1].textContent.trim()),
      total: document.getElementById('meTotal').textContent,
    };
  });
  check(filtered.rows.length === 2 && filtered.rows.every(r => /Loblaws|More food/.test(r)),
    'the table narrows to the 2 Grocery rows', JSON.stringify(filtered.rows));
  check(/198/.test(filtered.total),
    'the month total above still describes the whole month', filtered.total);

  console.log('\n── 25. the bottom month filter drives the same month as the top ──');
  const moved = await page.evaluate(async ([y]) => {
    const s = document.getElementById('meTxMonth');
    s.value = `${y}-03`; s.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    return {
      meMonth,
      topSel: document.getElementById('meMonthSel').value,
      bottomSel: document.getElementById('meTxMonth').value,
      rows: [...document.querySelectorAll('#meBody tr')].map(tr => tr.children[1].textContent.trim()),
      cat: meTxCat,
    };
  }, [YEAR]);
  check(moved.meMonth === `${YEAR}-03`, 'it moved the view to March', moved.meMonth);
  check(moved.topSel === `${YEAR}-03` && moved.bottomSel === `${YEAR}-03`,
    'both selectors agree afterwards', JSON.stringify({ top: moved.topSel, bottom: moved.bottomSel }));
  check(moved.rows.length === 1 && moved.rows[0] === 'March buy', 'and shows March',
    JSON.stringify(moved.rows));
  check(moved.cat === 'all', 'the category filter resets when the month changes', moved.cat);

  console.log('\n── 26. an unreachable category falls back ──');
  const fallback = await page.evaluate(async ([y]) => {
    meTxCat = 'Grocery';                 // not present in March
    meMonth = `${y}-03`; renderME();
    return { cat: meTxCat, sel: document.getElementById('meTxCat').value,
             rows: document.querySelectorAll('#meBody tr').length };
  }, [YEAR]);
  check(fallback.cat === 'all' && fallback.sel === 'all',
    'a category with nothing in this month drops back to All', JSON.stringify(fallback));
  check(fallback.rows === 1, 'so the table is not left empty', String(fallback.rows));

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nBILLS & ALLOCATIONS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
