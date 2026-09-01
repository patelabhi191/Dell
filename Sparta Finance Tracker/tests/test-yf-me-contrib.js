/* Targeted unit-style checks for Yearly Finance / Monthly Expense contributor
   tracking. Lean by design (no UI click-throughs) — seeds state directly via
   page.evaluate and asserts on the logic, same spirit as test-data.js. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

async function open(browser, url, seed) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  await page.addInitScript(s => {
    try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) { }
  }, seed);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return { ctx, page, errs };
}

const YEAR = new Date().getFullYear();
const MONTH = new Date().toISOString().slice(0, 7);

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();

  // ── 1. Migration: normalizeYF() defaults untagged txns to ABI, leaves tagged ones alone ──
  console.log('\n── normalizeYF(): who migration ──');
  {
    const seed = {
      'sparta.yf.data': JSON.stringify({
        txns: [
          { id: 't1', type: 'expense', date: `${YEAR}-01-04`, amt: 50, desc: 'Tagged', cat: 'Grocery', who: 'POO' },
          { id: 't2', type: 'income', date: `${YEAR}-01-15`, amt: 4200, desc: 'Untagged', cat: 'Paycheck' },
        ],
      }),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    const res = await page.evaluate(() => state.yf.txns.map(t => ({ id: t.id, who: t.who })));
    const t1 = res.find(t => t.id === 't1'), t2 = res.find(t => t.id === 't2');
    check(t1 && t1.who === 'POO', 'already-tagged txn (POO) untouched by migration', `got ${t1 && t1.who}`);
    check(t2 && t2.who === 'ABI', 'untagged txn migrated to ABI', `got ${t2 && t2.who}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── 2. yfSaveTx(): who included on add + edit ──
  console.log('\n── yfSaveTx(): who read + applied ──');
  {
    const { ctx, page, errs } = await open(browser, url, {});
    await page.click('#viewSeg button[data-view="yearly"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => { state.yfYear = new Date().getFullYear(); });
    await page.fill('#yfDate', `${YEAR}-03-01`);
    await page.fill('#yfAmt', '100');
    await page.selectOption('#yfWho', 'POO');
    await page.click('#yfSave');
    await page.waitForTimeout(150);
    const added = await page.evaluate(() => state.yf.txns[state.yf.txns.length - 1]);
    check(added && added.who === 'POO', 'new transaction saved with who=POO', `got ${added && added.who}`);

    // edit path
    const id = await page.evaluate(() => state.yf.txns[state.yf.txns.length - 1].id);
    await page.click(`#yfTxBody button[data-eid="${id}"]`);
    await page.waitForTimeout(120);
    const whoInEditForm = await page.inputValue('#yfWho');
    check(whoInEditForm === 'POO', 'yfStartEdit() populates #yfWho from the record', `got ${whoInEditForm}`);
    await page.selectOption('#yfWho', 'ABI');
    await page.click('#yfSave');
    await page.waitForTimeout(150);
    const updated = await page.evaluate(i => state.yf.txns.find(t => t.id === i), id);
    check(updated && updated.who === 'ABI', 'edit path updates who', `got ${updated && updated.who}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── 3. meSaveTx(): who included on add + edit ──
  console.log('\n── meSaveTx(): who read + applied ──');
  {
    const { ctx, page, errs } = await open(browser, url, {});
    await page.click('#viewSeg button[data-view="monthly"]');
    await page.waitForTimeout(150);
    await page.evaluate(m => { meMonth = m; renderME(); }, MONTH);   // no date field: the tab's month is the month
    await page.fill('#meAmt', '42.50');
    await page.selectOption('#meWho', 'POO');
    await page.click('#meSave');
    await page.waitForTimeout(150);
    const added = await page.evaluate(() => state.yf.txns[state.yf.txns.length - 1]);
    check(added && added.who === 'POO' && added.type === 'expense', 'new expense saved with who=POO',
      `got ${JSON.stringify(added)}`);
    check(added && added.mOnly === true && added.date === `${MONTH}-15`,
      'month-only entry stored against the tab\'s month', `got ${added && added.date}`);

    const id = await page.evaluate(() => state.yf.txns[state.yf.txns.length - 1].id);
    await page.click(`#meBody button[data-meedit="${id}"]`);
    await page.waitForTimeout(120);
    const whoInEditForm = await page.inputValue('#meWho');
    check(whoInEditForm === 'POO', 'meStartEdit() populates #meWho from the record', `got ${whoInEditForm}`);
    await page.selectOption('#meWho', 'ABI');
    await page.click('#meSave');
    await page.waitForTimeout(150);
    const updated = await page.evaluate(i => state.yf.txns.find(t => t.id === i), id);
    check(updated && updated.who === 'ABI', 'edit path updates who', `got ${updated && updated.who}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── 4. meApplyImport(): imported rows default to ABI ──
  console.log('\n── meApplyImport(): default who ──');
  {
    const { ctx, page, errs } = await open(browser, url, {});
    await page.click('#viewSeg button[data-view="monthly"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      mePending = [{ include: true, date: `${new Date().getFullYear()}-02-10`, amt: 12.34, desc: 'Imported Row', cat: 'General', fp: 'fp-test-1', why: 'kw' }];
      meApplyImport();
    });
    const added = await page.evaluate(() => state.yf.txns.find(t => t.desc === 'Imported Row'));
    check(added && added.who === 'ABI', 'CSV-imported expense defaults to who=ABI', `got ${added && added.who}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── 5. Filter scoping: Yearly Finance ──
  console.log('\n── yfWhoFilter: scopes #yfTxBody only ──');
  {
    const seed = {
      'sparta.yf.data': JSON.stringify({
        txns: [
          { id: 'a1', type: 'income', date: `${YEAR}-01-15`, amt: 4200, desc: 'ABI Pay', cat: 'Paycheck', who: 'ABI' },
          { id: 'p1', type: 'income', date: `${YEAR}-01-15`, amt: 3000, desc: 'POO Pay', cat: 'Paycheck', who: 'POO' },
        ],
        planned: {}, start: {}, cats: {
          exp: ['Food', 'Credit Bill', 'Health/medical', 'Home', 'Transportation', 'Personal',
            'Grocery', 'Misc', 'Travel', 'Debt', 'Other', 'Education\\Tuition',
            'Custom category 2', 'Investment', 'Other Bank'],
          inc: ['Gift/Stocks', 'Paycheck', 'Bonus', 'Temp', 'US/CA Support', 'Other'],
        },
      }),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    await page.click('#viewSeg button[data-view="yearly"]');
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => ({
      rows: document.querySelectorAll('#yfTxBody tr').length,
      avgInc: document.getElementById('yfAvgInc').textContent,
      incAct: document.getElementById('yfIncAct').textContent,
    }));
    await page.click('#yfWhoSeg button[data-who="ABI"]');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({
      rows: document.querySelectorAll('#yfTxBody tr').length,
      avgInc: document.getElementById('yfAvgInc').textContent,
      incAct: document.getElementById('yfIncAct').textContent,
    }));
    check(before.rows === 2, 'both transactions visible before filtering', `got ${before.rows}`);
    check(after.rows === 1, 'filtering to ABI leaves only 1 row in #yfTxBody', `got ${after.rows}`);
    check(before.avgInc === after.avgInc, 'AVG INCOME card unchanged by filter (out of scope)',
      `${before.avgInc} -> ${after.avgInc}`);
    check(before.incAct === after.incAct, 'INCOME actual card unchanged by filter (out of scope)',
      `${before.incAct} -> ${after.incAct}`);
    await page.click('#yfWhoSeg button[data-who="ALL"]');
    await page.waitForTimeout(150);
    const restored = await page.evaluate(() => document.querySelectorAll('#yfTxBody tr').length);
    check(restored === 2, 'clicking All restores both rows', `got ${restored}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── 6. Filter scoping: Monthly Expense ──
  console.log('\n── meWhoFilter: scopes summary + #meBody together ──');
  {
    const seed = {
      'sparta.yf.data': JSON.stringify({
        txns: [
          { id: 'a2', type: 'expense', date: `${MONTH}-03`, amt: 100, desc: 'ABI Spend', cat: 'Grocery', who: 'ABI' },
          { id: 'p2', type: 'expense', date: `${MONTH}-04`, amt: 50, desc: 'POO Spend', cat: 'Grocery', who: 'POO' },
        ],
        planned: {}, start: {}, cats: {
          exp: ['Grocery', 'Home', 'Misc'], inc: ['Paycheck', 'Other'],
        },
      }),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    await page.click('#viewSeg button[data-view="monthly"]');
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => ({
      total: document.getElementById('meTotal').textContent,
      count: document.getElementById('meCount').textContent,
      rows: document.querySelectorAll('#meBody tr').length,
    }));
    await page.click('#meWhoSeg button[data-who="ABI"]');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({
      total: document.getElementById('meTotal').textContent,
      count: document.getElementById('meCount').textContent,
      rows: document.querySelectorAll('#meBody tr').length,
    }));
    check(before.total === '$150.00', 'unfiltered total is $150.00 (both spends)', `got ${before.total}`);
    check(after.total === '$100.00', 'filtered to ABI: total drops to $100.00', `got ${after.total}`);
    check(after.count === '1', 'filtered to ABI: count is 1', `got ${after.count}`);
    check(after.rows === 1, 'filtered to ABI: #meBody shows 1 row', `got ${after.rows}`);
    await page.click('#meWhoSeg button[data-who="ALL"]');
    await page.waitForTimeout(150);
    const restored = await page.evaluate(() => document.getElementById('meTotal').textContent);
    check(restored === '$150.00', 'clicking All restores the combined total', `got ${restored}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\nYF/ME CONTRIB VERIFICATION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
