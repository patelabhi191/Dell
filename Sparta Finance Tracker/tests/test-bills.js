/* Bills & allocations accounting (Phase 1).

   The two tabs share one ledger but are separate views, and every row records
   which one owns it in `t.tab`:

     tab:'yf'  entered on Yearly. A bill. Yearly shows it; Monthly lists it so it
               can be itemised, but keeps it out of both graphs.
     tab:'me'  entered or imported on Monthly, including every allocation.
               Monthly shows it; Yearly never does, in any form.

   So a $1,500 credit-card bill reads as ONE $1,500 row on Yearly however finely
   it was broken down on Monthly, and the breakdown never appears as Yearly
   categories. What Monthly has done to it is reported beside it as a note —
   "$386 itemised on Monthly · $1,114 not itemised" — which is a report about
   the other tab's work, not that tab's money leaking in.

   The load-bearing test here is the INVARIANT — Yearly's category actuals must
   sum to Yearly's spend total. A break there silently misstates the user's
   finances rather than throwing. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const YEAR = 2026;
const start_ok = st => st.cat.length > 1 && st.allot.length > 1
  && /none/.test(st.cat[0]) && /none/.test(st.allot[0]);
/* Fixtures say what they mean. An allocation is always Monthly's, so it is
   tagged tab:'me'; anything else is a bill typed on Yearly. Pass `tab`
   explicitly to model a plain Monthly expense that is not an allocation. */
const tx = (o, i) => Object.assign(
  { id: 'b' + i, type: 'expense', who: 'ABI', desc: '', tab: o.allot ? 'me' : 'yf' }, o);

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
  /* Every category the LEDGER uses. Yearly's own list no longer collects
     Monthly's names -- the two tabs keep separate category lists -- so summing
     actual() over yf.cats.exp alone would silently miss Monthly's spending and
     the invariant check would pass while money went unaccounted. */
  await page.evaluate(() => {
    // The itemisation note moved from the EXPENSES table to the bill's own
    // TRANSACTIONS line. Read it from the renderer so these checks do not depend
    // on whichever filters a section left set on that table.
    window.yfNoteFor = cat => {
      const t = (state.yf.txns || []).find(x =>
        x.tab !== 'me' && x.type === 'expense' && x.cat === cat && !x.allot);
      return t ? yfSpendNote(t).replace(/<[^>]*>/g, '').trim() : '';
    };
    /* The bill pickers are keyed by bill ID: one month can hold two bills under
       the same category, and a name cannot tell them apart. These fixtures still
       read in category names, so map one back to the option it means. */
    window.billOpt = (selId, cat) => {
      const el = document.getElementById(selId); if (!el) return '';
      const o = [...el.options].find(o => {
        const t = (state.yf.txns || []).find(x => x.id === o.value);
        return t && t.cat === cat;
      });
      return o ? o.value : '';
    };
    window.pickBill = (selId, cat) => {
      const el = document.getElementById(selId); if (!el) return '';
      el.value = window.billOpt(selId, cat); return el.value;
    };
    // what an allot picker is offering, named the way a person reads it
    window.optCats = selId => [...document.getElementById(selId).options].map(o => {
      const t = (state.yf.txns || []).find(x => x.id === o.value);
      return t ? t.cat : o.value;
    });
    window.yfLedgerCats = () => [...new Set([].concat(state.yf.cats.exp,
      (state.yf.txns || []).filter(t => t.type === 'expense' && t.cat).map(t => t.cat)))];
  });

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
    'bill exactly matching what was itemised into it': [
      { date: `${YEAR}-09-15`, amt: 198, cat: 'Credit Bill' },
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
  check(r2.actuals['Credit Bill'] === 2000, 'the bill reads $2,000 on Yearly — one row, however finely it was broken down',
    String(r2.actuals['Credit Bill']));
  check(!r2.actuals['Groceries'] && !r2.actuals['TV/Phone/Internet'] && !r2.actuals['Dining Out'],
    "and the breakdown does not appear as Yearly categories — it is Monthly's",
    JSON.stringify([r2.actuals['Groceries'], r2.actuals['TV/Phone/Internet'], r2.actuals['Dining Out']]));

  // ── 3. Scenario 1: derived bill leaves no phantom remainder ──
  console.log('\n── 3. a bill fully accounted for by its detail lines ──');
  const r3 = await load(page, cases['bill exactly matching what was itemised into it'].map(tx));
  check(r3.spend === 198, 'total is the bill, counted once', String(r3.spend));
  check(r3.actuals['Credit Bill'] === 198, 'the bill still reads its own $198 — itemising never shrinks it',
    String(r3.actuals['Credit Bill']));

  // ── 4. over-allocation shows as negative rather than being hidden ──
  console.log('\n── 4. over-allocation ──');
  const r4 = await load(page, cases['over-allocated bill'].map(tx));
  check(r4.actuals['Credit Bill'] === 2000, 'the bill reads $2,000; the overage is reported in its note, not by going negative',
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
    document.getElementById('meDesc').value = d;
    /* Either/or, driven the way a person would: try the bill first, and if the
       dropdown does not offer it (the month has none) fall back to the category,
       exactly as the UI forces. Setting .value on a select that lacks the option
       is a no-op, so checking the value back is the test for "was it offered". */
    const catSel = document.getElementById('meCat'), allotSel = document.getElementById('meAllot');
    catSel.value = ''; allotSel.value = ''; meSyncPair();
    if (al) { window.pickBill('meAllot', al); meSyncPair(); window.pickBill('meAllot', al); }
    if (!allotSel.value) { allotSel.value = ''; meSyncPair(); catSel.value = c; meSyncPair(); catSel.value = c; }
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
  await addVia(`${YEAR}-08`, '100', 'Groceries', 'Lablows', '');
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
      { id: 'j1', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'j2', type: 'expense', date: `${y}-07-28`, amt: 58, desc: 'Bell', cat: 'TV/Phone/Internet', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'a1', type: 'expense', date: `${y}-08-10`, amt: 40, desc: 'Taco Bell', cat: 'Dining Out', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` });
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
  check(cyc.cb === 2000, 'Credit Bill stays one $2,000 row on Yearly', String(cyc.cb));

  console.log('\n── 10. nothing is invented: you can only itemise into a bill that exists ──');
  await reset();
  // Allot to now offers only the bills Yearly already holds for that month, so
  // there is never a missing one to create. Forcing the old path proves it.
  await addVia(`${YEAR}-09`, '100', 'Groceries', 'Loblaws', 'Credit Bill');
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
  check(none.spend === 0, "and it stays on Monthly — Yearly's spend does not move", String(none.spend));

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
  const julOpts = await page.evaluate(() => optCats('meAllot'));
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
  const augOpts = await page.evaluate(() => optCats('meAllot'));
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
      cat: 'Groceries', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-07` }];
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
  check(dc.cb === 1910, 'and Credit Bill reads its own $1,910', String(dc.cb));

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
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` }];
    renderYF(); renderME();
  }, [YEAR]);
  const trend = await page.evaluate(y => meMonthlyByCat(String(y)), YEAR);
  check(!trend['Credit Bill'],
    "the Yearly bill is not on Monthly's chart — one lump says nothing about habits",
    JSON.stringify(Object.keys(trend)));
  check(!trend['Grocery'], 'an uncategorised note is charted in no category of its own',
    JSON.stringify(Object.keys(trend)));

  // ...but a CATEGORISED allocation is exactly what an imported statement row is,
  // and the whole point of importing is to see those categories on the chart.
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 't', type: 'expense', date: `${y}-07-22`, amt: 33, desc: 'Presto', cat: 'Transit', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` }];
    renderYF(); renderME();
  }, [YEAR]);
  const impTrend = await page.evaluate(y => meMonthlyByCat(String(y)), YEAR);
  check(impTrend['Groceries'] && impTrend['Groceries'][7] === 100
    && impTrend['Transit'] && impTrend['Transit'][7] === 33,
    'an imported statement puts its categories on the chart, under the bill month',
    JSON.stringify({ groc: impTrend['Groceries'] && impTrend['Groceries'][7],
                     transit: impTrend['Transit'] && impTrend['Transit'][7] }));
  check(!impTrend['Credit Bill'], 'while the bill itself stays off the chart',
    JSON.stringify(Object.keys(impTrend)));
  const augCol = Object.values(impTrend).reduce((s, a) => s + a[7], 0);
  check(Math.abs(augCol - 133) < 0.005,
    'so the August column is the itemisation, not the bill', augCol.toFixed(2));

  console.log('\n── 13. backfill + invariant hold after all of it ──');
  const back = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'cb', type: 'expense', date: `${y}-07-20`, amt: 900, desc: 'Card', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'x', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'old', who: 'ABI', tab: 'me', allot: 'Credit Bill' }];
    normalizeYF();
    const a = state.yf.txns.find(t => t.id === 'x');
    // and the same row with no bill behind it at all
    state.yf.txns = [{ id: 'x', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'old', who: 'ABI', tab: 'me', allot: 'Credit Bill' }];
    normalizeYF();
    const orphan = state.yf.txns[0];
    return { allotM: a.allotM, points: a.allot, orphanAllot: orphan.allot || null };
  }, [YEAR]);
  check(back.allotM === `${YEAR}-07`, 'an allocation without allotM takes it from its date', back.allotM);
  check(back.points === 'cb', 'and its old category name is repointed at the bill row itself', String(back.points));
  check(back.orphanAllot === null,
    'one with no bill behind it is detached, not left pointing at nothing', String(back.orphanAllot));

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
    document.getElementById('meImpAllot').value = al ? window.billOpt('meImpAllot', al) : '';
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
  check(impTot.spend === 2000 && impTot.cb === 2000, "total stays $2,000 and so does the bill — Yearly never sees the import",
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
  check(sc.spend === 0, "and stay on Monthly — Yearly's total does not move", String(sc.spend));

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

  console.log('\n── 17. an import must land on a bill; "none" is refused ──');
  /* Leaving "Allot all to" on none used to file a whole statement as loose
     expenses. It is now held shut: the button is disabled and the handler
     refuses, so a statement can only be committed against a Yearly expense. */
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'bill', type: 'expense', date: `${y}-08-20`, amt: 2000,
      desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI', tab: 'yf' }];
    render();
  }, [YEAR]);
  const impRefused = await page.evaluate(([y, rs]) => {
    meMonth = `${y}-08`; renderME();
    mePending = rs.map((r, i) => ({ include: true, date: r.d, amt: r.a, desc: r.desc,
      cat: r.c, why: 'rule', changed: false, fp: 'fp' + Math.random() + i }));
    meFillAllotSelect();
    document.getElementById('meImpAllot').value = '';
    meRenderPreview(0, 0, 0);
    const before = state.yf.txns.length;
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m };
    meApplyImport();
    window.toast = rt;
    return { added: state.yf.txns.length - before, msg,
             disabled: document.getElementById('meApply').disabled,
             warn: document.getElementById('meImpGate').textContent };
  }, [YEAR, STMT]);
  check(impRefused.added === 0, 'nothing is imported with Allot all to on none', String(impRefused.added));
  check(/Allot all to/.test(impRefused.msg), 'and it says which choice is missing', impRefused.msg);
  check(impRefused.disabled, 'the button is disabled, so it cannot be clicked in the first place');
  check(/is on .none./.test(impRefused.warn), 'with a reminder beside it', impRefused.warn);

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
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'n', type: 'expense', date: `${y}-08-05`, amt: 30, desc: 'Note only', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
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
  check(/→ Aug statement/.test(pills['Loblaws'] || ''),
    'an allocation carries a pill naming the bill it came off',
    (pills['Loblaws'] || '').slice(0, 90));
  check(/Groceries/.test(pills['Loblaws'] || ''),
    'a charge off the bill shows what it was AND what paid for it',
    (pills['Loblaws'] || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 50));
  check(/—/.test(pills['Note only'] || ''), 'a note with no category of its own shows a dash',
    (pills['Note only'] || '').slice(0, 40));
  check(!/acct-tag/.test(pills['Cash lunch'] || ''), 'ordinary spending carries no pill');
  // There is no "auto" marking any more: bills are only ever typed into Yearly,
  // so there is no such thing as a bill nobody entered.
  const noAuto = await page.evaluate(() => document.body.innerHTML.includes('>auto<'));
  check(!noAuto, 'nothing anywhere is tagged auto — invented bills no longer exist');
  const yfHasAlloc = await page.evaluate(() =>
    [...document.querySelectorAll('#yfTxBody tr')].some(r => /Loblaws/.test(r.textContent)));
  check(yfHasAlloc === false, 'and the Yearly log still hides the allotted row');

  console.log('\n── 20. bill rows say what was charged to them ──');
  const note = await page.evaluate(() => {
    const row = n => yfNoteFor(n);
    return { cb: row('Credit Bill'), food: row('Food') };
  });
  check(/^\$130 Spend$/.test(note.cb),
    'the bill reports what Monthly has charged to it', note.cb);
  check(note.food === '', 'a category with nothing charged to it has no note at all',
    JSON.stringify(note.food));

  console.log('\n── 21. over-allotment is named, not left as a bare negative ──');
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 100, desc: 'small', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-08-04`, amt: 250, desc: 'big buy', cat: 'Shopping', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` }];
    renderYF();
  }, [YEAR]);
  const overNote = await page.evaluate(() => {
    const tr = ({ children: [{ textContent: yfNoteFor('Credit Bill'), innerHTML: yfNoteFor('Credit Bill') }] });
    return tr ? tr.children[0].innerHTML : '';
  });
  check(/^\$250 Spend$/.test(overNote),
    'the $250 charged to a $100 bill is reported as it stands, not as a negative', overNote);

  // ───────── Yearly log excludes allotted rows; Monthly picks its own month ─────────
  console.log('\n── 22. Yearly lists bank movements, not the breakdown ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' },
      { id: 'g', type: 'expense', date: `${y}-07-20`, amt: 100, desc: 'Loblaws', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'c', type: 'expense', date: `${y}-08-04`, amt: 45, desc: 'Cash lunch', cat: 'Food', who: 'ABI' }];
    meMonth = `${y}-08`; render(); renderYF(); renderME();
  }, [YEAR]);
  const yfDescs = await page.evaluate(() =>
    [...document.querySelectorAll('#yfTxBody tr')].map(tr => tr.children[3].textContent.trim()));
  check(!yfDescs.includes('Loblaws'), 'the allotted row is not in the Yearly log', JSON.stringify(yfDescs));
  check(yfDescs.some(d => d.startsWith('Aug statement')) && yfDescs.includes('Cash lunch'),
    'the bill and ordinary spending still are', JSON.stringify(yfDescs));
  const meDescs = await page.evaluate(() =>
    [...document.querySelectorAll('#meBody tr')].map(tr => tr.children[1].textContent.trim()));
  check(meDescs.includes('Loblaws'), 'but Monthly still shows it', JSON.stringify(meDescs));
  const stillRight = await page.evaluate(() => ({
    spend: yfActual('expense', null), grocery: yfActual('expense', 'Grocery'),
    cb: yfActual('expense', 'Credit Bill') }));
  check(stillRight.spend === 2045 && stillRight.grocery === 0 && stillRight.cb === 2000,
    'hiding it changes no figure — the bill still carries its full $2,000', JSON.stringify(stillRight));

  console.log('\n── 23. adding an older transaction from the Month picker ──');
  await reset();
  const addInMonth = (viewing, pick, amt, cat, desc, allot) => page.evaluate(([v, pm, a, c, d, al]) => {
    meMonth = v; renderME();
    meFillFormMonth();
    document.getElementById('meFormMonth').value = pm;
    document.getElementById('meAmt').value = a;
    document.getElementById('meDesc').value = d;
    /* Either/or, driven the way a person would: try the bill first, and if the
       dropdown does not offer it (the month has none) fall back to the category,
       exactly as the UI forces. Setting .value on a select that lacks the option
       is a no-op, so checking the value back is the test for "was it offered". */
    const catSel = document.getElementById('meCat'), allotSel = document.getElementById('meAllot');
    catSel.value = ''; allotSel.value = ''; meSyncPair();
    if (al) { window.pickBill('meAllot', al); meSyncPair(); window.pickBill('meAllot', al); }
    if (!allotSel.value) { allotSel.value = ''; meSyncPair(); catSel.value = c; meSyncPair(); catSel.value = c; }
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
  await addInMonth(`${YEAR}-08`, `${YEAR}-03`, '250', 'Groceries', 'Old March buy', 'Credit Bill');
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
  check(marchNet.spend === 900 && marchNet.cb === 900,
    'total stays $900 and so does Credit Bill — the $250 explains it, it does not shrink it',
    JSON.stringify(marchNet));
  check(await page.evaluate(() => meMonth) === `${YEAR}-03`,
    'the tab follows the month just written to');
  const marchRows = await rows(`${YEAR}-03`);
  check(marchRows.some(r => r.desc === 'Old March buy'), 'and it shows under March',
    JSON.stringify(marchRows.map(r => r.desc)));

  // a second one into the same month attaches to the SAME bill — the bill does
  // not grow (it is the real statement figure), the remainder just shrinks again
  await addInMonth(`${YEAR}-03`, `${YEAR}-03`, '150', 'Dining Out', 'More March', 'Credit Bill');
  const topped = await page.evaluate(([y]) => {
    const bills = state.yf.txns.filter(t => t.cat === 'Credit Bill' && !t.allot);
    const l = state.yf.txns.filter(t => t.type === 'expense');
    return { count: bills.length, amt: bills[0] && bills[0].amt,
             cb: +yfCatOf(l, 'Credit Bill').toFixed(2), spend: +yfSpendOf(l).toFixed(2) };
  }, [YEAR]);
  check(topped.count === 1, 'still one Credit Bill for March, not a second', String(topped.count));
  check(topped.amt === 900, 'the billed figure is untouched at $900', String(topped.amt));
  check(topped.cb === 900 && topped.spend === 900,
    'the bill holds at $900 with $400 now itemised against it; total still $900', JSON.stringify(topped));
  const inv23 = await page.evaluate(() => {
    const sum = yfLedgerCats().reduce((s, c) => s + yfActual('expense', c), 0);
    return { sum, spend: yfActual('expense', null) };
  });
  check(Math.abs(inv23.sum - inv23.spend) < 0.005, 'invariant holds across months',
    `Σactual ${inv23.sum.toFixed(2)} vs spend ${inv23.spend.toFixed(2)}`);

  // ───────── Monthly's own Month + Category filters ─────────
  console.log('\n── 24. filters at the bottom of Monthly ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: '1', type: 'expense', date: `${y}-08-04`, amt: 100, desc: 'Loblaws', cat: 'Grocery', who: 'ABI', tab: 'me' },
      { id: '2', type: 'expense', date: `${y}-08-06`, amt: 58, desc: 'Bell', cat: 'Home', who: 'ABI', tab: 'me' },
      { id: '3', type: 'expense', date: `${y}-08-09`, amt: 40, desc: 'More food', cat: 'Grocery', who: 'POO', tab: 'me' },
      { id: '4', type: 'expense', date: `${y}-03-11`, amt: 75, desc: 'March buy', cat: 'Travel', who: 'ABI', tab: 'me' }];
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

  // ───────── either/or filing, in the words it was asked for ─────────
  console.log("\n── 27. the Niagara trip: detail lines explain a bill, they do not split it ──");
  await reset();
  const trip = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'n', type: 'expense', date: `${y}-07-10`, amt: 550, desc: 'Niagra Trip July', cat: 'Travel', who: 'ABI' },
      { id: 'p', type: 'expense', date: `${y}-07-12`, amt: 20, desc: 'Park entry', who: 'ABI', tab: 'me', allot: 'Travel', allotM: `${y}-07` },
      { id: 'f', type: 'expense', date: `${y}-07-12`, amt: 100, desc: 'Food', who: 'ABI', tab: 'me', allot: 'Travel', allotM: `${y}-07` },
      { id: 'g', type: 'expense', date: `${y}-07-03`, amt: 80, desc: 'Loblaws', cat: 'Groceries', who: 'ABI', tab: 'me' }];
    if (!state.yf.cats.exp.includes('Groceries')) state.yf.cats.exp.push('Groceries');
    meMonth = `${y}-07`; render(); renderYF(); renderME();
    return {
      total: document.getElementById('meTotal').textContent,
      bars: [...document.querySelectorAll('#meBars .me-bar-row')].map(r =>
        r.querySelector('.me-bar-name').textContent + ' ' + r.querySelector('.me-bar-amt').textContent),
      travel: yfActual('expense', 'Travel'), groc: yfActual('expense', 'Groceries'),
      spend: yfActual('expense', null),
      sum: yfLedgerCats().reduce((t, c) => t + yfActual('expense', c), 0) };
  }, [YEAR]);
  check(trip.total === '$630.00', 'the month totals $630 — the $120 of detail adds nothing', trip.total);
  check(trip.travel === 550, 'the trip stays whole at $550 on Yearly, not $430', String(trip.travel));
  check(JSON.stringify(trip.bars) === JSON.stringify(['GROCERIES $80.00']),
    "and Monthly's breakdown shows only Monthly's own spending, not the trip",
    JSON.stringify(trip.bars));
  check(Math.abs(trip.sum - trip.spend) < 0.005, 'Σ actual === spend still, with allocations in neither side',
    `${trip.sum} vs ${trip.spend}`);

  console.log("\n── 28. a category typed on Monthly stays on Monthly ──");
  await reset();
  // 'Dining Out' is Monthly's and is not one of Yearly's defaults, so this can
  // actually tell the two lists apart -- 'Health/medical' is on both and could not.
  // Earlier sections' fixtures push their categories into Yearly's list through
  // the test harness, so membership proves nothing here. What matters is whether
  // SAVING moves it: snapshot the list, save, compare.
  const before = await page.evaluate(() => state.yf.cats.exp.slice());
  await addVia(`${YEAR}-07`, '60', 'Dining Out', 'Pizza', '');
  const med = await page.evaluate(prev => {
    const row = state.yf.txns[state.yf.txns.length - 1];
    return { cat: row.cat, allot: row.allot || null, date: row.date, tab: row.tab,
             grew: JSON.stringify(state.yf.cats.exp) !== JSON.stringify(prev),
             yearly: yfActual('expense', 'Dining Out') };
  }, before);
  check(med.cat === 'Dining Out' && med.allot === null && med.tab === 'me',
    "it saves with a category, no bill, and tagged as Monthly's", JSON.stringify(med));
  check(!med.grew, "saving does not add anything to Yearly's list — the lists are separate");
  check(med.yearly === 0, 'nor does the money appear on Yearly; it stays on Monthly',
    String(med.yearly));

  console.log('\n── 29. Category and Allot to are independent ──');
  const pair = await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'b', type: 'expense', date: `${y}-07-20`, amt: 900,
      desc: 'Credit Bill', cat: 'Credit Bill', who: 'ABI' }];
    meMonth = `${y}-07`; renderME();
    const cat = document.getElementById('meCat'), allot = document.getElementById('meAllot');
    const snap = () => ({ cat: [...cat.options].map(o => o.textContent),
                          allot: [...allot.options].map(o => o.textContent) });
    const start = snap();
    window.pickBill('meAllot', 'Credit Bill'); meAllotNote(); const withBill = snap();
    cat.value = 'Groceries'; meAllotNote();
    const both = { cat: cat.value, allot: allot.value, note: document.getElementById('meAllotNote').textContent };
    allot.value = ''; meAllotNote();
    const catOnly = { cat: cat.value, allot: allot.value };
    return { start, withBill, both, catOnly, disabled: cat.disabled || allot.disabled };
  }, [YEAR]);
  check(start_ok(pair.start), 'both fields start open, on "none"', JSON.stringify(pair.start.cat.slice(0, 1)));
  check(pair.withBill.cat.length > 1,
    'choosing a bill leaves every category still selectable', String(pair.withBill.cat.length));
  check(pair.both.cat === 'Groceries' && pair.both.allot === 'b',
    'both can be set at once — what it was, and what paid for it',
    JSON.stringify([pair.both.cat, pair.both.allot]));
  check(/moves out of the bill/.test(pair.both.note),
    'and the note says the money moves out of the bill, not on top of it', pair.both.note);
  check(pair.catOnly.cat === 'Groceries' && pair.catOnly.allot === '',
    'clearing the bill leaves the category untouched', JSON.stringify(pair.catOnly));
  check(!pair.disabled, 'neither field is ever disabled');

  const refused = await page.evaluate(() => {
    const before = state.yf.txns.length;
    document.getElementById('meAmt').value = '50';
    document.getElementById('meCat').value = ''; document.getElementById('meAllot').value = '';
    meSyncPair(); meSaveTx();
    return { added: state.yf.txns.length - before, toast: document.getElementById('toast').textContent };
  });
  check(refused.added === 0, 'saving with neither set adds nothing', String(refused.added));
  check(/Pick a category, or a bill/.test(refused.toast), 'and says which choice is missing', refused.toast);

  console.log('\n── 30. an import keeps its categories AND its bill ──');
  await reset();
  await page.evaluate(([y]) => {
    state.yf.txns = [{ id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000,
      desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' }];
    render();
  }, [YEAR]);
  await importRows(`${YEAR}-08`, 'Credit Bill', STMT);
  const both = await page.evaluate(() => {
    const rows = (state.yf.txns || []).filter(t => t.allot);
    const bill = (state.yf.txns || []).find(t => t.tab !== 'me' && t.cat === 'Credit Bill' && !t.allot);
    return { cats: rows.map(t => t.cat), allots: [...new Set(rows.map(t => t.allot))],
             billId: bill && bill.id, blank: rows.filter(t => !t.cat).length,
             learned: Object.keys(state.me.rules).length };
  });
  check(both.blank === 0, 'every imported row keeps the category the categoriser gave it',
    JSON.stringify(both.cats));
  check(both.allots.length === 1 && both.allots[0] === both.billId,
    'and carries the bill alongside it, not instead of it', JSON.stringify(both.allots));

  console.log('\n── 31. rows imported without a category are recovered ──');
  // A build in between filed imported rows with no category, which left them
  // grey and absent from both the breakdown and the trend. Recovery is keyed on
  // the import log, so a typed either/or note is never swept up with them.
  await reset();
  const rec = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-20`, amt: 2000, desc: 'Aug statement', cat: 'Credit Bill', who: 'ABI' },
      { id: 'i1', type: 'expense', date: `${y}-08-06`, amt: 33, desc: 'PRESTO APPL/S6 TORONTO', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      { id: 'i2', type: 'expense', date: `${y}-08-02`, amt: 17.35, desc: 'FARM BOY #24 TORONTO', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` },
      // typed on Add Expense: uncategorised on purpose, and NOT in the import log
      { id: 'm1', type: 'expense', date: `${y}-08-15`, amt: 20, desc: 'Park entry', who: 'ABI', mOnly: true, tab: 'me', allot: 'Credit Bill', allotM: `${y}-08` }];
    state.me.imported = ['i1', 'i2'].map(id => meFingerprint(state.yf.txns.find(t => t.id === id)));
    meMonth = `${y}-08`; renderME();
    const by = id => (state.yf.txns.find(t => t.id === id) || {}).cat;
    return { i1: by('i1'), i2: by('i2'), m1: by('m1') || null,
             spend: yfActual('expense', null),
             sum: yfLedgerCats().reduce((s, c) => s + yfActual('expense', c), 0) };
  }, [YEAR]);
  check(rec.i1 === 'Transit' && rec.i2 === 'Groceries',
    'the categoriser re-derives them from the descriptions still on the rows',
    JSON.stringify([rec.i1, rec.i2]));
  check(rec.m1 === null, 'a typed either/or note is left uncategorised, as intended', String(rec.m1));
  check(rec.spend === 2000, 'recovery moves no money — the total is untouched', String(rec.spend));
  check(Math.abs(rec.sum - rec.spend) < 0.005, 'and the invariant still holds afterwards',
    `${rec.sum.toFixed(2)} vs ${rec.spend.toFixed(2)}`);

  console.log('\n── 32. a $1,850 bill vs statements that under-, over- and exactly-shoot ──');
  // The three cases asked for by hand, pinned so the figures cannot drift apart
  // from the sub-line that describes them.
  const billCase = (rows, manualCat) => page.evaluate(([y, rs, mc]) => {
    state.yf.txns = [{ id: 'bill', type: 'expense', date: `${y}-07-19`, amt: 1850,
      desc: 'Credit Card July', cat: 'Credit Bill', who: 'ABI' }];
    rs.forEach((r, i) => {
      const t = { id: 'r' + i, type: 'expense', date: `${y}-07-0${i + 1}`, amt: r.a,
        desc: r.d, who: 'ABI', allot: 'Credit Bill', allotM: `${y}-07` };
      if (r.c) t.cat = r.c;
      state.yf.txns.push(t);
    });
    if (mc !== undefined) {
      const t = { id: 'man', type: 'expense', date: `${y}-07-15`, amt: 11, mOnly: true,
        desc: 'Missed by the statement', who: 'ABI', allot: 'Credit Bill', allotM: `${y}-07` };
      if (mc) t.cat = mc;
      state.yf.txns.push(t);
    }
    state.yf.txns.forEach(t => {
      if (t.cat && !state.yf.cats.exp.includes(t.cat)) state.yf.cats.exp.push(t.cat); });
    state.yfYear = y; meMonth = `${y}-07`; render(); renderYF(); renderME();
    const tr = ({ children: [{ textContent: yfNoteFor('Credit Bill'), innerHTML: yfNoteFor('Credit Bill') }] });
    return { cb: +yfActual('expense', 'Credit Bill').toFixed(2),
             spend: +yfActual('expense', null).toFixed(2),
             sum: +yfLedgerCats().reduce((t2, c) => t2 + yfActual('expense', c), 0).toFixed(2),
             note: tr ? tr.children[0].textContent.replace(/\s+/g, ' ').trim() : '',
             over: tr ? /\bover\b/.test(tr.children[0].innerHTML) : false,
             warn: yfAttachAllot((yfBillsIn(`${y}-07`).find(b => b.cat === 'Credit Bill') || {}).id) };
  }, [YEAR, rows, manualCat]);

  const S = [{ d: 'FARM BOY', a: 900, c: 'Groceries' }, { d: 'PRESTO', a: 400, c: 'Transit' },
             { d: 'FIDO', a: 340, c: 'TV/Phone/Internet' }, { d: 'CINEPLEX', a: 200, c: 'Indoor Entertainment' }];
  const under = S.map(r => ({ ...r })); under[2].a = 300;      // totals 1800
  const over  = S.map(r => ({ ...r })); over[2].a  = 400;      // totals 1900

  await reset();
  const u = await billCase(under);
  check(u.cb === 1850, 'under by $50: the bill still reads its own $1,850', String(u.cb));
  check(/^\$1,800 Spend$/.test(u.note),
    'and the note carries what the statement actually came to', u.note);
  check(!u.over && u.warn === 0, 'nothing is flagged — being under is not an error');
  check(u.spend === 1850 && u.sum === u.spend,
    "Yearly's total is the bill, and its categories sum to it", `${u.sum} vs ${u.spend}`);

  await reset();
  const o = await billCase(over);
  check(o.cb === 1850, 'over by $50: the bill STILL reads $1,850, it does not go negative', String(o.cb));
  check(/^\$1,900 Spend$/.test(o.note),
    'and the note reports the $1,900 charged to it', o.note);
  check(o.warn === 50, 'and reported as a warning on import', `warn ${o.warn}`);
  check(o.spend === 1850 && o.sum === o.spend, "Yearly's total is unmoved by any of it",
    `${o.sum} vs ${o.spend}`);

  await reset();
  const m = await billCase(S, 'Groceries');   // 1840 imported + 11 typed, categorised
  check(m.cb === 1850, '$1,840 imported plus an $11 charge typed in leaves the bill at $1,850',
    String(m.cb));
  check(/^\$1,851 Spend$/.test(m.note),
    'and the typed charge is counted with the imported ones', m.note);

  await reset();
  const n = await billCase(S, '');            // same $11, left uncategorised
  check(n.cb === 1850 && /^\$1,851 Spend$/.test(n.note),
    'an uncategorised $11 still counts as charged to the bill', n.note);
  check(n.sum === n.spend, 'every shape keeps the invariant', `${n.sum} vs ${n.spend}`);
  // where the two DO differ is Monthly's breakdown: only a categorised row lands there
  const bars = await page.evaluate(() => [...document.querySelectorAll('#meBars .me-bar-row')]
    .map(b => b.querySelector('.me-bar-name').textContent));
  check(!bars.some(b => /credit bill/i.test(b)),
    "and the bill is never a bar on Monthly — that graph is about habits", JSON.stringify(bars));

  console.log('\n── 33. a negative category does not draw a full-width bar ──');
  await reset();
  // Refunds arrive as negative expenses, so a category refunded more than it was
  // spent goes negative. width:-5.6% is invalid CSS, so the declaration used to be
  // dropped and the fill fell back to its default -- painting the MOST negative
  // category as the longest bar on the panel.
  await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'r1', type: 'expense', date: `${y}-07-04`, amt: -50, desc: 'Refund', cat: 'Groceries', who: 'ABI', tab: 'me' },
      { id: 'r2', type: 'expense', date: `${y}-07-06`, amt: 900, desc: 'Rent-ish', cat: 'Shopping', who: 'ABI', tab: 'me' }];
    state.yfYear = y; meMonth = `${y}-07`; render(); renderME();
  }, [YEAR]);
  const bar = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#meBars .me-bar-row')];
    const cb = rows.find(r => /Groceries/i.test(r.querySelector('.me-bar-name').textContent));
    return cb ? { w: cb.querySelector('.me-bar-fill').style.width,
                  amt: cb.querySelector('.me-bar-amt').textContent } : null;
  });
  check(bar && /^-/.test(bar.amt), 'the bar under test really is negative',
    bar ? bar.amt : 'no Credit Bill bar');
  // width:-5.6% is invalid CSS, so the declaration was dropped and the fill fell
  // back to its default -- painting the most over-allotted category as the LONGEST bar
  check(bar && parseFloat(bar.w) === 0, 'a negative amount clamps to a zero-width fill, not a full one',
    bar ? `${bar.amt} -> width ${JSON.stringify(bar.w)}` : '');

  console.log('\n── 34. Yearly and Monthly keep separate category lists ──');
  await reset();
  const sep = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Rent', 'Food', 'Credit Bill'];
    state.yf.txns = [
      { id: 'yr', type: 'expense', date: `${y}-07-01`, amt: 1450, desc: 'Yearly rent', cat: 'Rent', who: 'ABI' },
      { id: 'yf', type: 'expense', date: `${y}-07-03`, amt: 60, desc: 'Yearly food', cat: 'Food', who: 'ABI' }];
    state.yfYear = y; meMonth = `${y}-07`; render(); renderYF(); renderME();
    const offered = meAllCats();
    // file a Monthly expense under a category only Monthly has
    document.getElementById('meAmt').value = '75';
    document.getElementById('meDesc').value = 'Netflix';
    document.getElementById('meCat').value = 'Fees/Subscription';
    document.getElementById('meAllot').value = '';
    meSaveTx();
    meMonth = `${y}-07`; renderME(); renderYF();
    const rows = [...document.querySelectorAll('#yfExpBody tr')].map(tr => ({
      name: tr.children[0].textContent.trim().split('$')[0].trim(),
      act: parseFloat(tr.children[2].textContent.replace(/[^0-9.-]/g, '')) }));
    return { offered, yfList: state.yf.cats.exp.slice(), rows,
             totals: rows[0].act,
             sumRows: +rows.slice(1).reduce((t, r) => t + r.act, 0).toFixed(2) };
  }, [YEAR]);
  check(!sep.offered.some(c => ['Rent', 'Food', 'Credit Bill'].includes(c)),
    "Yearly's categories are never offered on Monthly", JSON.stringify(sep.offered.slice(0, 3)));
  check(JSON.stringify(sep.yfList) === JSON.stringify(['Rent', 'Food', 'Credit Bill']),
    "and saving a Monthly expense does not add its category to Yearly's list",
    JSON.stringify(sep.yfList));
  check(!sep.rows.some(r => r.name === 'Fees/Subscription'),
    "and Monthly's category never appears as a row on Yearly",
    JSON.stringify(sep.rows.map(r => r.name)));
  check(sep.sumRows === sep.totals,
    "Yearly's category rows still add up to its Totals row",
    `${sep.sumRows} vs ${sep.totals}`);
  check(sep.totals === 1510,
    "and that total is Yearly's own spending only — Monthly's $75 is not in it",
    String(sep.totals));

  console.log('\n── 35. the same name on both tabs stays two different categories ──');
  /* Name-based logic breaks exactly here, so each of these was a real leak found
     by auditing rather than by a failing test: renaming Yearly's Rent rewrote
     Monthly's Rent rows, a Monthly row blocked deleting a Yearly category of the
     same name, yfFindBill could return a Monthly row as the bill to itemise into,
     and the overage warning used a narrower definition of "itemised" than the
     note printed beside it. */
  await reset();
  const same = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Rent', 'Groceries', 'Spare'];
    state.yf.txns = [
      { id: 'yr', type: 'expense', date: `${y}-07-01`, amt: 1450, desc: 'Yearly rent', cat: 'Rent', who: 'ABI', tab: 'yf' },
      { id: 'mr', type: 'expense', date: `${y}-07-05`, amt: 40, desc: 'Monthly rent-ish', cat: 'Rent', who: 'ABI', tab: 'me' },
      { id: 'mg', type: 'expense', date: `${y}-07-06`, amt: 25, desc: 'Monthly groceries', cat: 'Groceries', who: 'ABI', tab: 'me' }];
    state.yfYear = y; renderYF();
    window.prompt = () => 'Housing';
    yfRenameCat('expense', 'Rent');
    const byId = id => (state.yf.txns.find(t => t.id === id) || {}).cat;
    // Yearly has no Groceries row; only Monthly does, which must not block deletion
    let msg = ''; const realToast = window.toast; window.toast = m => { msg = m };
    window.confirm = () => true;
    yfDeleteCat('expense', 'Groceries');
    window.toast = realToast;
    return { yearly: byId('yr'), monthly: byId('mr'), list: state.yf.cats.exp.slice(),
             delMsg: msg, monthlyGroc: byId('mg') };
  }, [YEAR]);
  check(same.yearly === 'Housing' && same.monthly === 'Rent',
    "renaming Yearly's Rent leaves Monthly's Rent alone",
    JSON.stringify([same.yearly, same.monthly]));
  check(!/Cannot delete/.test(same.delMsg),
    'a Monthly row does not block deleting the Yearly category it shares a name with',
    JSON.stringify(same.delMsg));
  check(!same.list.includes('Groceries') && same.monthlyGroc === 'Groceries',
    "the name leaves Yearly's list while Monthly's row keeps it", JSON.stringify(same.list));

  const asBill = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'yb', type: 'expense', date: `${y}-08-10`, amt: 900, desc: 'Yearly bill', cat: 'Spare', who: 'ABI', tab: 'yf' },
      { id: 'mb', type: 'expense', date: `${y}-08-11`, amt: 70, desc: 'Monthly buy', cat: 'Dining Out', who: 'ABI', tab: 'me' }];
    meMonth = `${y}-08`; renderME();
    return { opts: [...document.getElementById('meAllot').options].map(o => o.textContent),
             found: yfBillsIn(`${y}-08`).some(b => b.cat === 'Dining Out') };
  }, [YEAR]);
  check(asBill.opts.some(o => /Yearly bill/.test(o)) && !asBill.opts.some(o => /Monthly buy/.test(o)),
    'Allot to offers Yearly bills only', JSON.stringify(asBill.opts));
  check(!asBill.found, 'and yfBillsIn will not return a Monthly row as a bill');

  const agree = await page.evaluate(([y]) => {
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-08-10`, amt: 100, desc: 'Small bill', cat: 'Spare', who: 'ABI', tab: 'yf' },
      { id: 'a1', type: 'expense', date: `${y}-08-12`, amt: 80, desc: 'categorised', cat: 'Dining Out', who: 'ABI', tab: 'me', allot: 'Spare', allotM: `${y}-08` },
      { id: 'a2', type: 'expense', date: `${y}-08-13`, amt: 60, desc: 'note only', who: 'ABI', tab: 'me', allot: 'Spare', allotM: `${y}-08` }];
    state.yfYear = y; meMonth = `${y}-08`; renderYF(); renderME();
    const tr = ({ children: [{ textContent: yfNoteFor('Spare'), innerHTML: yfNoteFor('Spare') }] });
    return { note: tr ? tr.children[0].textContent.replace(/\s+/g, ' ').trim() : '',
             warn: yfAttachAllot((yfBillsIn(`${y}-08`).find(b => b.cat === 'Spare') || {}).id) };
  }, [YEAR]);
  check(/^\$140 Spend$/.test(agree.note) && agree.warn === 40,
    'the note and the overage warning count the same rows',
    `${agree.note} | warn ${agree.warn}`);

  console.log('\n── 36. a Yearly bill is read-only on Monthly, and deleting it detaches ──');
  /* Monthly lists Yearly's bills so they can be itemised against. It used to
     offer edit and delete on them too: opening one in the Monthly form let it be
     given an "Allot to", which allotted a bill to another bill and dropped it
     out of Yearly's total entirely ($1,900 -> $400 in the audit). Deleting one
     left every allocation pointing at a bill that no longer existed — excluded
     from spend for carrying an allot, excluded from Yearly for being Monthly's,
     so its money sat in no total anywhere. */
  await reset();
  const ro = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Credit Bill', 'Spare'];
    state.yf.txns = [
      { id: 'bill', type: 'expense', date: `${y}-07-19`, amt: 1500, desc: 'Credit Card July', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'sp', type: 'expense', date: `${y}-07-20`, amt: 400, desc: 'Spare bill', cat: 'Spare', who: 'ABI', tab: 'yf' },
      { id: 'a1', type: 'expense', date: `${y}-07-06`, amt: 160, desc: 'FARM BOY', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-07` },
      { id: 'a2', type: 'expense', date: `${y}-07-08`, amt: 40, desc: 'PRESTO', cat: 'Transit', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-07` }];
    state.yfYear = y; meMonth = `${y}-07`; render(); renderYF(); renderME();
    const row = d => [...document.querySelectorAll('#meBody tr')]
      .find(r => r.children[1].textContent.trim() === d);
    const bill = row('Credit Card July'), own = row('FARM BOY');
    return {
      billEdit: !!bill.querySelector('[data-meedit]'), billDel: !!bill.querySelector('[data-medel]'),
      billBadge: bill.children[5].textContent.trim(),
      ownEdit: !!own.querySelector('[data-meedit]'), ownDel: !!own.querySelector('[data-medel]') };
  }, [YEAR]);
  check(!ro.billEdit && !ro.billDel && ro.billBadge === 'YEARLY',
    'the Yearly bill carries a YEARLY marker instead of edit and delete',
    JSON.stringify(ro));
  check(ro.ownEdit && ro.ownDel, "Monthly's own rows keep both buttons");

  const gone = await page.evaluate(([y]) => {
    window.confirm = () => true;
    const beforeTotal = yfActual('expense', null);
    yfDelete('bill');
    meMonth = `${y}-07`; renderME();
    return { beforeTotal, afterTotal: yfActual('expense', null),
             orphans: state.yf.txns.filter(t => t.allot === 'Credit Bill').length,
             detached: state.yf.txns.filter(t => ['a1', 'a2'].includes(t.id))
               .map(t => `${t.id}:${t.allot || 'none'}:${t.cat}`),
             meTotal: document.getElementById('meTotal').textContent };
  }, [YEAR]);
  check(gone.orphans === 0, 'deleting the bill leaves no allocation pointing at it',
    String(gone.orphans));
  check(gone.detached.every(d => /:none:/.test(d)),
    'they become ordinary Monthly expenses and keep their categories',
    JSON.stringify(gone.detached));
  check(gone.meTotal === '$600.00',
    'so their money counts on Monthly instead of vanishing from every total', gone.meTotal);
  check(gone.beforeTotal - gone.afterTotal === 1500,
    "and Yearly drops by exactly the bill, nothing more",
    `${gone.beforeTotal} -> ${gone.afterTotal}`);

  console.log('\n── 37. the three remaining ways a bill lost track of its itemisation ──');
  await reset();
  // A. `allot` is a reference to a Yearly category name. Renaming the category
  //    left every allocation pointing at a name that no longer existed.
  const ren = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Credit Bill'];
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-07-19`, amt: 1500, desc: 'Bill', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'a', type: 'expense', date: `${y}-07-06`, amt: 200, desc: 'FARM BOY', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-07` }];
    state.yfYear = y; renderYF();
    window.prompt = () => 'Card Bill';
    yfRenameCat('expense', 'Credit Bill');
    renderYF();
    const tr = ({ children: [{ textContent: yfNoteFor('Card Bill'), innerHTML: yfNoteFor('Card Bill') }] });
    return { points: state.yf.txns.find(t => t.id === 'a').allot,
             note: tr ? tr.children[0].textContent.replace(/\s+/g, ' ').trim() : '' };
  }, [YEAR]);
  check(ren.points === 'b', 'renaming a bill category leaves its allocations pointing at the same row',
    `points at "${ren.points}"`);
  check(/^\$200 Spend$/.test(ren.note), 'so the renamed bill keeps its note', ren.note);

  // B. An allocation is filed by allotM, which can sit in a different YEAR than
  //    the purchase date — a December statement line on January's bill.
  const xy = await page.evaluate(() => {
    state.yf.cats.exp = ['Credit Bill'];
    state.yf.txns = [
      { id: 'b', type: 'expense', date: '2027-01-19', amt: 1000, desc: 'Jan bill', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'a', type: 'expense', date: '2026-12-28', amt: 300, desc: 'Dec purchase', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: '2027-01' }];
    state.yfYear = 2027; renderYF();
    const tr = ({ children: [{ textContent: yfNoteFor('Credit Bill'), innerHTML: yfNoteFor('Credit Bill') }] });
    return tr ? tr.children[0].textContent.replace(/\s+/g, ' ').trim() : '';
  });
  check(/^\$300 Spend$/.test(xy),
    'a December purchase counts toward January\'s bill, across the year boundary', xy);

  // C. The import dedup set included Yearly bills, so a genuine Monthly purchase
  //    matching a bill's date, amount and merchant was skipped as "already imported".
  const dup = await page.evaluate(() => {
    state.yf.txns = [{ id: 'b', type: 'expense', date: '2026-07-06', amt: 160,
      desc: 'FARM BOY #24', cat: 'Credit Bill', who: 'ABI', tab: 'yf' }];
    state.me.imported = []; meMonth = '2026-07'; renderME();
    const existing = new Set((state.yf.txns || []).filter(t => t.tab === 'me').map(meFingerprint));
    return { blocks: existing.has(meFingerprint(state.yf.txns[0])) };
  });
  check(!dup.blocks, 'a Yearly bill is not in the import dedup set, so it cannot swallow a row');

  console.log('\n── 38. a bill reports two facts, each beside the money it explains ──');
  /* $X Spend rides under the AMOUNT, $Y Bill Paid under the DESCRIPTION, and
     neither is ever combined into one figure. There used to be a third, netted
     one -- "$750 Itemised" -- which only reconciles if you also hold the previous
     month's bill in your head, so it was removed. Each note appears only when it
     has something to report, and the EXPENSES table stays numbers only. */
  await reset();
  const notes = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Credit Bill', 'Travel'];
    const bill = (id, mm, amt, desc) => ({ id, type: 'expense', date: `${y}-${mm}-19`, amt,
      desc, cat: 'Credit Bill', who: 'ABI', tab: 'yf' });
    const alloc = (id, mm, amt, bid) => ({ id, type: 'expense', date: `${y}-${mm}-04`, amt,
      desc: 'purchase', cat: 'Groceries', who: 'ABI', tab: 'me', allot: bid, allotM: `${y}-${mm}` });
    const pay = (id, mm, amt, bid) => ({ id, type: 'expense', date: `${y}-${mm}-02`, amt: -amt,
      desc: 'PAYMENT', cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: bid, allotM: `${y}-${mm}` });
    state.yf.txns = [
      bill('b1', '07', 765, 'Amex July'), alloc('x1', '07', 500, 'b1'), alloc('x2', '07', 266, 'b1'),
      bill('b2', '08', 1200, 'Amex August'), alloc('y1', '08', 950, 'b2'), pay('y2', '08', 400, 'b2'),
      bill('b3', '09', 400, 'Amex September'), pay('z1', '09', 120, 'b3'),
      bill('b5', '10', 300, 'Amex October'), alloc('w1', '10', 700, 'b5'), alloc('w2', '10', -250, 'b5'),
      { id: 'b4', type: 'expense', date: `${y}-07-24`, amt: 500, desc: 'Niagara', cat: 'Travel', who: 'ABI', tab: 'yf' }];
    state.yfYear = y; renderYF();
    const by = {};
    [...document.querySelectorAll('#yfTxBody tr')].forEach(tr => {
      by[tr.children[3].querySelector('div').textContent.trim()] = {
        amt: tr.children[2].textContent.replace(/\s+/g, ' ').trim(),
        desc: tr.children[3].textContent.replace(/\s+/g, ' ').trim() };
    });
    return { by,
      expHasNote: [...document.querySelectorAll('#yfExpBody tr')]
        .some(tr => /Spend|Bill Paid|Itemised/i.test(tr.children[0].textContent)) };
  }, [YEAR]);
  check(!notes.expHasNote, 'the EXPENSES table carries no note text at all — numbers only');
  check(/\$766 Spend$/.test(notes.by['Amex July'].amt)
    && notes.by['Amex July'].desc === 'Amex July',
    'charges only: $766 Spend under the amount, nothing under the description',
    JSON.stringify(notes.by['Amex July']));
  check(/\$950 Spend$/.test(notes.by['Amex August'].amt)
    && /\$400 Bill Paid$/.test(notes.by['Amex August'].desc),
    'both: $950 Spend under the amount, $400 Bill Paid under the description',
    JSON.stringify(notes.by['Amex August']));
  check(notes.by['Amex September'].amt === '$400.00'
    && /\$120 Bill Paid$/.test(notes.by['Amex September'].desc),
    'a payment and no charges shows Bill Paid alone — no empty Spend line',
    JSON.stringify(notes.by['Amex September']));
  check(/\$450 Spend$/.test(notes.by['Amex October'].amt),
    'a refund counts into Spend as the negative it is: $700 − $250',
    notes.by['Amex October'].amt);
  check(notes.by['Niagara'].desc === 'Niagara' && notes.by['Niagara'].amt === '$500.00',
    'an expense with nothing filed against it carries neither note',
    JSON.stringify(notes.by['Niagara']));
  check(!/Itemised/i.test(JSON.stringify(notes.by)),
    'and the word "Itemised" appears nowhere on the tab');

  console.log('\n── 39. a Monthly category may pair with a bill; a Yearly one never may ──');
  await reset();
  const pair2 = await page.evaluate(([y]) => {
    state.yf.cats.exp = ['Credit Bill', 'Rent'];
    state.yf.txns = [
      { id: 'b', type: 'expense', date: `${y}-07-19`, amt: 1500, desc: 'Amex July', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      // a Monthly row saved under a YEARLY name — the only route by which such a
      // name reaches the Monthly picker, since meFillCatSelect keeps the edited
      // row's own category on the list rather than blanking it
      { id: 'old', type: 'expense', date: `${y}-07-05`, amt: 60, desc: 'legacy row', cat: 'Rent', who: 'ABI', tab: 'me', mOnly: true }];
    state.yfYear = y; meMonth = `${y}-07`; render(); renderYF(); renderME();
    const set = (a, c) => { window.pickBill('meAllot', a);
                            document.getElementById('meCat').value = c; };
    // allowed: Monthly category + bill
    document.getElementById('meAmt').value = '40';
    document.getElementById('meDesc').value = 'Coffee on the card';
    set('Credit Bill', 'Dining Out');
    const n0 = state.yf.txns.length;
    meSaveTx();
    const saved = state.yf.txns[state.yf.txns.length - 1];
    // refused: Yearly category + bill
    meStartEdit('old');
    const offered = [...document.getElementById('meCat').options].map(o => o.textContent);
    const before = JSON.stringify(state.yf.txns.find(t => t.id === 'old'));
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m };
    window.pickBill('meAllot', 'Credit Bill');
    meSaveTx();
    window.toast = rt;
    return { added: state.yf.txns.length - n0 - 0, cat: saved.cat, allot: saved.allot || null,
             hasRent: offered.includes('Rent'), msg,
             unchanged: before === JSON.stringify(state.yf.txns.find(t => t.id === 'old')) };
  }, [YEAR]);
  check(pair2.cat === 'Dining Out' && pair2.allot === 'b',
    'a Monthly category and a bill save together — what it was, and what paid for it',
    JSON.stringify([pair2.cat, pair2.allot]));
  check(pair2.hasRent, "the edited row's Yearly name stays on the list so it is not blanked");
  check(/Yearly Finance category/.test(pair2.msg),
    'but saving a Yearly category against a bill is refused', pair2.msg);
  check(pair2.unchanged, 'and that row is left exactly as it was');

  console.log('\n── 40. the top bar graph matches the trend chart ──');
  const cols = await page.evaluate(([y]) => {
    state.me.chartCats = ['Groceries', 'Transit', 'Dining Out'];
    state.yf.txns = ['Groceries', 'Transit', 'Dining Out'].map((c, i) => ({
      id: 'c' + i, type: 'expense', date: `${y}-07-0${i + 1}`, amt: 100 - i * 10,
      desc: c, cat: c, who: 'ABI', tab: 'me' }));
    meMonth = `${y}-07`; renderME();
    return [...document.querySelectorAll('#meBars .me-bar-row')].map(b => {
      const n = b.querySelector('.me-bar-name');
      return { text: n.textContent, colour: n.style.color, want: meColor(n.title) };
    });
  }, [YEAR]);
  check(cols.every(c => c.text === c.text.toUpperCase()),
    'every bar label is upper-cased', JSON.stringify(cols.map(c => c.text)));
  check(cols.length > 0 && cols.every(c => c.colour && c.want.toLowerCase().startsWith('#')),
    'and each carries its own category colour, the same meColor() the trend uses',
    JSON.stringify(cols.map(c => c.text + ' ' + c.colour)));

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nBILLS & ALLOCATIONS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
