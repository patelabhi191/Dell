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

  console.log('\n── 10. allotting with no bill creates one that tracks ──');
  await reset();
  await addVia(`${YEAR}-09`, '100', 'Grocery', 'Loblaws', 'Credit Bill');
  let bill = await page.evaluate(() => state.yf.txns.find(t => t.derived));
  check(!!bill && bill.date === `${YEAR}-09-15` && bill.amt === 100,
    'bill auto-created on the 15th at $100', JSON.stringify(bill && { d: bill.date, a: bill.amt }));
  await addVia(`${YEAR}-09`, '58', 'Home', 'Bell', 'Credit Bill');
  bill = await page.evaluate(() => state.yf.txns.find(t => t.derived));
  check(bill.amt === 158, 'it grows to $158 as more is itemised', String(bill.amt));
  const sc1 = await page.evaluate(() => ({ spend: yfActual('expense', null), cb: yfActual('expense', 'Credit Bill') }));
  check(sc1.spend === 158 && sc1.cb === 0, 'total is $158 and Credit Bill nets to zero',
    JSON.stringify(sc1));

  console.log('\n── 11. typing a total fixes the bill, overage warns ──');
  await page.evaluate(([y]) => {
    const b = state.yf.txns.find(t => t.derived);
    b.amt = 2000; delete b.derived;            // what typing an amount does
    yfSyncDerivedBills(); renderYF();
  }, [YEAR]);
  await addVia(`${YEAR}-09`, '40', 'Food', 'Taco Bell', 'Credit Bill');
  const fixed = await page.evaluate(() => {
    const b = state.yf.txns.find(t => t.cat === 'Credit Bill' && !t.allot);
    return { amt: b.amt, derived: !!b.derived, cb: yfActual('expense', 'Credit Bill'), spend: yfActual('expense', null) };
  });
  check(fixed.amt === 2000 && !fixed.derived, 'bill holds at $2,000 and no longer tracks',
    JSON.stringify(fixed));
  check(fixed.cb === 1802 && fixed.spend === 2000, 'remainder $1,802, total $2,000', JSON.stringify(fixed));
  const over = await page.evaluate(async ([y]) => {
    meMonth = `${y}-09`; renderME();
    document.getElementById('meAmt').value = '5000';
    meFillCatSelect(); meFillAllotSelect();
    document.getElementById('meCat').value = 'Travel';
    document.getElementById('meDesc').value = 'Flights';
    document.getElementById('meAllot').value = 'Credit Bill';
    meSaveTx();
    await new Promise(r => setTimeout(r, 80));
    return document.getElementById('toast').textContent;
  }, [YEAR]);
  check(/Over-allotted/.test(over), 'over-allotting warns rather than blocking', JSON.stringify(over));

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

  console.log('\n── 15. importing with no bill on record starts one ──');
  await reset();
  await importRows(`${YEAR}-09`, 'Credit Bill', STMT);
  const dbill = await page.evaluate(() => state.yf.txns.find(t => t.derived));
  check(!!dbill && dbill.amt === 198 && dbill.date === `${YEAR}-09-15`,
    'derived bill created at $198 on the 15th', JSON.stringify(dbill && { a: dbill.amt, d: dbill.date }));
  const sc = await page.evaluate(() => ({ spend: yfActual('expense', null), cb: yfActual('expense', 'Credit Bill') }));
  check(sc.spend === 198 && sc.cb === 0, 'total $198, Credit Bill nets to zero', JSON.stringify(sc));

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
  console.log('\n── 19. allocations and derived bills are visibly different ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'p', type: 'expense', date: `${y}-08-04`, amt: 45, desc: 'Cash lunch', cat: 'Food', who: 'ABI' },
      { id: 'd', type: 'expense', date: `${y}-08-15`, amt: 0, desc: 'Other Bank (from itemised)', cat: 'Other Bank', who: 'ABI', derived: true }];
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
  check(/auto/.test(pills['Other Bank (from itemised)'] || ''), 'a derived bill is marked auto');
  // Allotted rows are deliberately absent from the Yearly log now (see 22), so
  // there is no allocation pill to find there — but a derived bill does appear
  // in Yearly, and still needs its "auto" marking.
  const yfPills = await page.evaluate(() => {
    const rowFor = re => [...document.querySelectorAll('#yfTxBody tr')].find(r => re.test(r.textContent));
    return {
      alloc: !!rowFor(/Loblaws/),
      derivedTags: (rowFor(/from itemised/) || { children: [] }).children[4]
        ? rowFor(/from itemised/).children[4].innerHTML : '',
    };
  });
  check(yfPills.alloc === false, 'the Yearly log has no allotted row to tag');
  check(/auto/.test(yfPills.derivedTags), 'a derived bill in the Yearly log is marked auto',
    yfPills.derivedTags.slice(0, 90));

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
  // sitting in August, file a March expense against March's Credit Bill
  await addInMonth(`${YEAR}-08`, `${YEAR}-03`, '250', 'Grocery', 'Old March buy', 'Credit Bill');
  const filed = await page.evaluate(() => state.yf.txns.find(t => t.desc === 'Old March buy'));
  check(filed && filed.date === `${YEAR}-03-15` && filed.allotM === `${YEAR}-03`,
    'filed against March, not the month being viewed', JSON.stringify({ d: filed && filed.date, m: filed && filed.allotM }));
  const marchBill = await page.evaluate(() =>
    state.yf.txns.find(t => t.derived && t.cat === 'Credit Bill'));
  check(marchBill && marchBill.date === `${YEAR}-03-15` && marchBill.amt === 250,
    "March's Credit Bill was created and updated", JSON.stringify(marchBill && { d: marchBill.date, a: marchBill.amt }));
  check(await page.evaluate(() => meMonth) === `${YEAR}-03`,
    'the tab follows the month just written to');
  const marchRows = await rows(`${YEAR}-03`);
  check(marchRows.some(r => r.desc === 'Old March buy'), 'and it shows under March',
    JSON.stringify(marchRows.map(r => r.desc)));

  // a second one into the same month tops the same bill up
  await addInMonth(`${YEAR}-03`, `${YEAR}-03`, '150', 'Food', 'More March', 'Credit Bill');
  const topped = await page.evaluate(() => state.yf.txns.find(t => t.derived && t.cat === 'Credit Bill').amt);
  check(topped === 400, "March's bill grows to $400, not a second bill", String(topped));
  const inv23 = await page.evaluate(() => {
    const sum = state.yf.cats.exp.reduce((s, c) => s + yfActual('expense', c), 0);
    return { sum, spend: yfActual('expense', null) };
  });
  check(Math.abs(inv23.sum - inv23.spend) < 0.005, 'invariant holds across months',
    `Σactual ${inv23.sum.toFixed(2)} vs spend ${inv23.spend.toFixed(2)}`);

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nBILLS & ALLOCATIONS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
