const { serve, launch, stub } = require('../lib.js');
const { SEED } = require('./fixture-5-years.js');
const { APP } = require('../paths');
(async () => {
  const srv = await serve(APP); const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch(); const ctx = await browser.newContext();
  const page = await ctx.newPage(); await stub(page);
  await page.addInitScript(s => { try { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) } catch (e) {} }, SEED);
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    // count how many times the whole ledger is re-filtered by one renderYF()
    const realTxns = yfTxns;
    let calls = 0, rowsVisited = 0;
    window.yfTxns = yfTxns = function () { calls++; rowsVisited += state.yf.txns.length; return realTxns.apply(this, arguments) };
    renderYF();
    const out = { calls, rowsVisited, ledger: state.yf.txns.length,
      cats: state.yf.cats.exp.length + state.yf.cats.inc.length };
    yfTxns = realTxns;
    return out;
  });
  console.log('ONE renderYF() on a ' + r.ledger + '-row ledger with ' + r.cats + ' configured categories:');
  console.log('  yfTxns() calls:        ', r.calls);
  console.log('  rows re-filtered:      ', r.rowsVisited.toLocaleString());
  console.log('  rows that would suffice:', r.ledger.toLocaleString());
  console.log('  wasted factor:         ', (r.rowsVisited / r.ledger).toFixed(1) + '×');

  /* THE POINT OF THIS SECOND MEASUREMENT IS THE SHAPE, NOT THE MILLISECONDS.
     It used to show the factor growing with the CATEGORY count, which a user
     can add to without limit: 20 categories cost 27 yfTxns() calls and 92,907
     re-filtered rows, 46 cost 53 calls and 182,373 rows at 42.5 ms. Since
     yfCatIndex() the per-category calls are gone, so this run should print the
     SAME call count at 46 categories as at 20 -- if it ever starts rising with
     them again, a per-category yfActual() has come back. */
  const grown = await page.evaluate(() => {
    state.yf.cats.exp = state.yf.cats.exp.concat(
      Array.from({ length: 26 }, (_, i) => 'Extra category ' + i));
    const real = yfTxns; let calls = 0, rows = 0;
    window.yfTxns = yfTxns = function () { calls++; rows += state.yf.txns.length; return real.apply(this, arguments) };
    const a = performance.now(); renderYF(); const ms = performance.now() - a;
    const out = { calls, rows, ms, cats: state.yf.cats.exp.length + state.yf.cats.inc.length };
    yfTxns = real; return out;
  });
  console.log('\nSame ledger, categories grown from ' + r.cats + ' to ' + grown.cats + ' (a user can add these freely):');
  console.log('  yfTxns() calls:  ', grown.calls, '  rows re-filtered:', grown.rows.toLocaleString());
  console.log('  renderYF():      ', grown.ms.toFixed(1), 'ms');
  const flat = grown.calls === r.calls;
  console.log('  -> ' + (flat
    ? 'FLAT in the category count (' + r.calls + ' calls either way). '
      + 'Was 27 -> 53 before yfCatIndex().'
    : 'RISING with the category count: ' + r.calls + ' -> ' + grown.calls
      + ' calls. A per-category ledger scan is back.'));
  await ctx.close(); await browser.close(); srv.close();
})();
