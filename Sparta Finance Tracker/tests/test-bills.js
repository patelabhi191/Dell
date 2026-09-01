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
  check(parity.monthlyCount === '4', 'Monthly still lists all 4 entries', parity.monthlyCount);

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nBILLS & ALLOCATIONS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
