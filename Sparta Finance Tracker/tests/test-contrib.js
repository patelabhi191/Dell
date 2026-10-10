/* Targeted functional verification for the ABI/POO contributor feature:
   default contributor, migration (both branches), the yearly-backfill
   zero-amount guard now split per contributor/account, the old-shape yearly
   draft fallback, chart stacking totals, and the All/ABI/POO filter scoping
   (chart + deposit log only — hero cards/room must stay untouched). */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

// Contrib-specific open(): seeds arbitrary localStorage (not the shared SEED
// fixture) and lands on the Contributions tab, since every check here needs
// a from-scratch, tightly controlled contribs/yearly state.
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
  await page.click('#viewSeg button[data-view="contrib"]');
  await page.waitForTimeout(200);
  return { ctx, page, errs };
}

const YEAR = new Date().getFullYear();

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();

  // ── Check 1: default contributor on a fresh deposit ──
  console.log('\n── Check 1: depositContrib() defaults to ABI ──');
  {
    const { ctx, page, errs } = await open(browser, url, {});
    await page.fill('#depAmtT', '500');
    await page.click('#depBtnT');
    await page.waitForTimeout(150);
    const who = await page.evaluate(() => state.contribs[state.contribs.length - 1].who);
    check(who === 'ABI', 'new deposit defaults to who=ABI', `got ${who}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── Check 2: migration correctness + idempotency ──
  console.log('\n── Check 2: migration — tagged entries untouched, untagged -> ABI ──');
  {
    const seed = {
      'sparta.contrib.entries': JSON.stringify([
        { id: 'x1', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 100, cad: true, who: 'POO' },
        { id: 'x2', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 200, cad: true },  // no `who`
      ]),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    const res = await page.evaluate(() => state.contribs.map(c => ({ id: c.id, who: c.who })));
    const x1 = res.find(c => c.id === 'x1'), x2 = res.find(c => c.id === 'x2');
    check(x1 && x1.who === 'POO', 'already-tagged entry (POO) untouched by migration', `got ${x1 && x1.who}`);
    check(x2 && x2.who === 'ABI', 'untagged entry migrated to ABI', `got ${x2 && x2.who}`);
    const onlyTwoValues = res.every(c => c.who === 'ABI' || c.who === 'POO');
    check(onlyTwoValues, 'no third contributor value ever appears');
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── Check 3: yearly-table zero-amount guard, now per contributor-account pair ──
  console.log('\n── Check 3: saveYearly() only pushes nonzero contributor/account entries ──');
  {
    const { ctx, page, errs } = await open(browser, url, {});
    const before = await page.evaluate(() => state.contribs.length);
    await page.click('#addYearBtn');
    await page.waitForTimeout(150);
    // fill only tfsaAbi on the new draft row
    await page.fill('#ybody tr[data-rid] .yin[data-f="tfsaAbi"]', '1234');
    await page.click('#saveYears');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => state.contribs.length);
    check(after - before === 1, 'exactly one new contrib pushed (not four)', `before=${before} after=${after}`);
    const pushed = await page.evaluate(() => state.contribs[state.contribs.length - 1]);
    check(pushed && pushed.acct === 'TFSA' && pushed.who === 'ABI' && pushed.amt === 1234,
      'the pushed entry is TFSA/ABI/1234', `got ${JSON.stringify(pushed)}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── Check 4: old-shape yearly draft fallback ──
  console.log('\n── Check 4: old-shape {tfsa,fhsa} yearly draft folds into ABI ──');
  {
    const seed = { 'sparta.contrib.yearly': JSON.stringify([{ id: 'd1', y: 2024, tfsa: 500, fhsa: 200 }]) };
    const { ctx, page, errs } = await open(browser, url, seed);
    const row = await page.evaluate(() => state.yearly.find(r => r.id === 'd1'));
    check(row && row.tfsaAbi === 500 && row.tfsaPoo === 0 && row.fhsaAbi === 200 && row.fhsaPoo === 0,
      'old row folds to tfsaAbi=500,tfsaPoo=0,fhsaAbi=200,fhsaPoo=0', `got ${JSON.stringify(row)}`);
    check(row && !('tfsa' in row) && !('fhsa' in row), 'old tfsa/fhsa fields removed', `got ${JSON.stringify(row)}`);
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── Check 5: chart stacking sanity (All view) ──
  console.log('\n── Check 5: stacked chart totals match contributed() ──');
  {
    const seed = {
      'sparta.contrib.entries': JSON.stringify([
        { id: 'a1', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 100, cad: true, who: 'ABI' },
        { id: 'p1', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 50, cad: true, who: 'POO' },
      ]),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    const info = await page.evaluate(y => {
      const rects = [...document.querySelectorAll(`#cChart .bar[data-acct="TFSA"][data-year="${y}"]`)];
      return {
        count: rects.length,
        totals: rects.map(r => r.dataset.total),
        contributedTotal: contributed('TFSA', y),
        hasSeparator: !!document.querySelector('#cChart line[stroke="rgba(6,12,20,.55)"]'),
      };
    }, YEAR);
    check(info.count === 2, '2 stacked bar segments for that TFSA/year (All view)', `got ${info.count}`);
    check(info.totals.every(t => +t === 150), 'both segments report data-total=150', `got ${info.totals}`);
    check(info.contributedTotal === 150, 'contributed(TFSA,y) unchanged, still returns 150', `got ${info.contributedTotal}`);
    check(info.hasSeparator, 'separator line present between segments');
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  // ── Check 6: filter scopes chart + log, but not hero cards ──
  console.log('\n── Check 6: cWhoSeg filter scoping (chart + log only) ──');
  {
    const seed = {
      'sparta.contrib.entries': JSON.stringify([
        { id: 'a1', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 100, cad: true, who: 'ABI' },
        { id: 'p1', t: Date.now(), y: YEAR, acct: 'TFSA', amt: 50, cad: true, who: 'POO' },
      ]),
    };
    const { ctx, page, errs } = await open(browser, url, seed);
    const before = await page.evaluate(() => ({
      hero: document.getElementById('cTfsaAmt').textContent,
      room: document.getElementById('cTfsaRoom').textContent,
      barWidth: document.getElementById('cTfsaBar').style.width,
      rows: document.querySelectorAll('#cbody tr').length,
      bars: document.querySelectorAll(`#cChart .bar[data-acct="TFSA"][data-year="${YEAR}"]`).length,
    }), YEAR);
    await page.click('#cWhoSeg button[data-who="ABI"]');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({
      hero: document.getElementById('cTfsaAmt').textContent,
      room: document.getElementById('cTfsaRoom').textContent,
      barWidth: document.getElementById('cTfsaBar').style.width,
      rows: document.querySelectorAll('#cbody tr').length,
      bars: document.querySelectorAll(`#cChart .bar[data-acct="TFSA"][data-year="${YEAR}"]`).length,
      separator: !!document.querySelector('#cChart line[stroke="rgba(6,12,20,.55)"]'),
      logWho: [...document.querySelectorAll('#cbody tr td:nth-child(4)')].map(td => td.textContent.trim()),
    }), YEAR);
    check(before.hero === after.hero, 'hero TFSA value unchanged by filter', `${before.hero} -> ${after.hero}`);
    check(before.room === after.room, 'room-remaining text unchanged by filter', `${before.room} -> ${after.room}`);
    check(before.barWidth === after.barWidth, 'room progress bar width unchanged by filter');
    check(after.rows === 1, 'deposit log shows only the ABI row', `got ${after.rows} rows`);
    check(after.logWho.every(w => w === 'ABI'), 'every visible log row is ABI', `got ${JSON.stringify(after.logWho)}`);
    check(after.bars === 1, 'chart shows exactly 1 bar segment when filtered', `got ${after.bars}`);
    check(!after.separator, 'no separator line when filtered to one person');
    // click back to All
    await page.click('#cWhoSeg button[data-who="ALL"]');
    await page.waitForTimeout(150);
    const restored = await page.evaluate(y => ({
      rows: document.querySelectorAll('#cbody tr').length,
      bars: document.querySelectorAll(`#cChart .bar[data-acct="TFSA"][data-year="${y}"]`).length,
      separator: !!document.querySelector('#cChart line[stroke="rgba(6,12,20,.55)"]'),
    }), YEAR);
    check(restored.rows === 2, 'clicking All restores both log rows', `got ${restored.rows}`);
    check(restored.bars === 2, 'clicking All restores both bar segments', `got ${restored.bars}`);
    check(restored.separator, 'clicking All restores the separator line');
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  /* ── Check N: the log's scope line counts each filter where it applies ──
     Two filters hide rows in this table for different reasons, and the scope
     line subtracted one count from another and blamed the year for both. With
     the contributor filter on ABI and every deposit dated this year, it read
     "2 hidden from other years" -- about rows in the year on screen. In
     all-years mode it printed the unfiltered count beside a filtered table.
     The empty state had the matching fault: it denied deposits the tab was
     holding and pointed at the wrong control.                               */
  console.log("\n── Check N: the deposit log's scope line and empty state ──");
  {
    const { ctx, page, errs } = await open(browser, url, {});
    const r = await page.evaluate(y => {
      state.contribs = [
        { id: 'a1', t: Date.UTC(y, 0, 8), acct: 'TFSA', amt: 1000, y, cad: true, who: 'ABI' },
        { id: 'a2', t: Date.UTC(y, 1, 8), acct: 'TFSA', amt: 2000, y, cad: true, who: 'POO' },
        { id: 'a3', t: Date.UTC(y, 2, 8), acct: 'FHSA', amt: 3000, y, cad: true, who: 'POO' },
        { id: 'a4', t: Date.UTC(y - 1, 5, 8), acct: 'TFSA', amt: 400, y: y - 1, cad: true, who: 'ABI' }];
      state.cYear = y; state.logYear = String(y); state.cWho = 'ABI';
      render();
      const read = () => ({ scope: document.getElementById('logScope').textContent.trim(),
                            rows: document.querySelectorAll('#cbody tr').length });
      const oneYear = read();                       // 2026 filtered to ABI
      state.cWho = 'ALL'; render();
      const allWho = read();                        // 2026, everyone
      state.logYear = 'ALL'; state.cWho = 'ABI'; render();
      const allYears = read();
      state.logYear = String(y); state.cWho = 'POO'; render();
      const pooOnly = read();
      // every row in the year belongs to the other contributor
      state.cWho = 'ABI';
      state.contribs = state.contribs.map(c => c.y === y ? { ...c, who: 'POO' } : c);
      render();
      const empty = { msg: document.getElementById('cEmpty').textContent.trim(),
                      shown: document.getElementById('cEmpty').style.display,
                      rows: document.querySelectorAll('#cbody tr').length };
      return { oneYear, allWho, allYears, pooOnly, empty };
    }, YEAR);
    // Precondition: the filter really is hiding rows, or every claim below is vacuous.
    check(r.oneYear.rows === 1 && r.allWho.rows === 3,
      'precondition: the contributor filter really hides two rows of this year',
      JSON.stringify([r.oneYear.rows, r.allWho.rows]));
    check(r.oneYear.scope === '— 1 hidden from other years',
      'the year clause counts only rows genuinely in another year', r.oneYear.scope);
    check(r.pooOnly.scope === '— 1 hidden from other years',
      'and it does not move when the contributor filter changes', r.pooOnly.scope);
    check(r.allYears.scope === '— all years (2)' && r.allYears.rows === 2,
      'all-years mode counts the rows actually shown',
      JSON.stringify([r.allYears.scope, r.allYears.rows]));
    check(r.empty.rows === 0 && /ABI/.test(r.empty.msg) && /contributor/.test(r.empty.msg),
      'an empty table names the filter responsible instead of denying the deposits',
      JSON.stringify(r.empty));
    check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\nCONTRIB FEATURE VERIFICATION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
