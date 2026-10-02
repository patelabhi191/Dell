/* Dates and year rollover.

   The app derives years from getFullYear() (LOCAL) but used to derive date
   prefills from toISOString() (UTC). Those disagree for the last hours of
   every evening west of Greenwich, which filed records under the wrong day —
   and on Dec 31, the wrong year. These tests pin both the clock and the
   timezone so the boundary is exercised deterministically. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

// Pin Date before any page script runs. __setNow() lets a test advance it.
const fakeClock = ms => `(()=>{const R=Date;let cur=${ms};
  const F=function(...a){ if(!(this instanceof F)) return new R(cur).toString();
    return a.length?new R(...a):new R(cur); };
  F.prototype=R.prototype; F.now=()=>cur; F.UTC=R.UTC; F.parse=R.parse;
  Object.setPrototypeOf(F,R); window.Date=F; window.__setNow=t=>{cur=t;};})()`;

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();

  const open = async (tz, ms) => {
    const ctx = await browser.newContext({ timezoneId: tz });
    const page = await ctx.newPage();
    await stub(page);
    await page.addInitScript(fakeClock(ms));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const snap = page => page.evaluate(() => {
    document.querySelector('#viewSeg button[data-view="yearly"]').click();
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return {
      local: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
      utc: d.toISOString().slice(0, 10),
      localYear: d.getFullYear(),
      cYear: state.cYear, yfYear: state.yfYear,
      yrT: document.getElementById('yrT').textContent,
      yfDate: document.getElementById('yfDate').value,
      meMonth,
    };
  });

  // ── 1. the bug's original form: New Year's Eve, evening, west of Greenwich ──
  console.log("\n── Toronto, Dec 31 2026 20:00 local (UTC already says Jan 1) ──");
  let { ctx, page } = await open('America/Toronto', Date.UTC(2027, 0, 1, 1, 0, 0));
  let s = await snap(page);
  console.log(`     local ${s.local} · UTC ${s.utc}`);
  check(s.localYear === 2026 && s.cYear === 2026 && s.yfYear === 2026,
    'year selectors correctly still on 2026', `${s.yrT}`);
  check(s.yfDate === '2026-12-31', 'Yearly Finance prefills 2026-12-31, not next year', s.yfDate);
  check(s.meMonth === '2026-12', 'Monthly Expense opens on 2026-12', s.meMonth);
  await ctx.close();

  // ── 2. the same fault in the other direction ──
  console.log("\n── Tokyo, Jan 1 2027 08:00 local (UTC still says Dec 31) ──");
  ({ ctx, page } = await open('Asia/Tokyo', Date.UTC(2026, 11, 31, 23, 0, 0)));
  s = await snap(page);
  console.log(`     local ${s.local} · UTC ${s.utc}`);
  check(s.localYear === 2027 && s.cYear === 2027, 'year selectors already on 2027', `${s.yrT}`);
  check(s.yfDate === '2027-01-01', 'prefills 2027-01-01, not last year', s.yfDate);
  check(s.meMonth === '2027-01', 'opens on 2027-01', s.meMonth);
  await ctx.close();

  // ── 3. the everyday form — last evening of an ordinary month ──
  console.log('\n── Toronto, Aug 31 2026 23:00 local (month boundary) ──');
  ({ ctx, page } = await open('America/Toronto', Date.UTC(2026, 8, 1, 3, 0, 0)));
  s = await snap(page);
  console.log(`     local ${s.local} · UTC ${s.utc}`);
  check(s.yfDate === '2026-08-31', 'prefills Aug 31, not Sep 1', s.yfDate);
  check(s.meMonth === '2026-08', 'still opens on August', s.meMonth);
  await ctx.close();

  // ── 4. away from the boundary nothing changed ──
  console.log('\n── Toronto, Jan 1 2027 12:00 local (no disagreement) ──');
  ({ ctx, page } = await open('America/Toronto', Date.UTC(2027, 0, 1, 17, 0, 0)));
  s = await snap(page);
  check(s.yfDate === s.local && s.meMonth === s.local.slice(0, 7),
    'ordinary case unaffected', `${s.yfDate} / ${s.meMonth}`);

  // ── 5. CSV date parsing must not shift a day either ──
  const parsed = await page.evaluate(() => ({
    numeric: meParseDate('2026-01-05'),
    slashes: meParseDate('01/05/2026'),
    wordy: meParseDate('5 January 2026'),
    junk: meParseDate('not a date'),
  }));
  check(parsed.numeric === '2026-01-05', 'CSV: ISO date parses unchanged', parsed.numeric);
  check(parsed.slashes === '2026-01-05', 'CSV: MM/DD/YYYY parses correctly', parsed.slashes);
  check(parsed.wordy === '2026-01-05', 'CSV: worded date does not shift a day', parsed.wordy);
  check(parsed.junk === null, 'CSV: unparseable date returns null', String(parsed.junk));
  await ctx.close();

  // ── 6. fresh load on Jan 1 2027: does everything read 2027? ──
  console.log('\n── Fresh load on Jan 1 2027 ──');
  ({ ctx, page } = await open('America/Toronto', Date.UTC(2027, 0, 1, 17, 0, 0)));
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => {
    const opts = id => [...document.getElementById(id).options].map(o => o.value);
    document.querySelector('#viewSeg button[data-view="yearly"]').click();
    return {
      YEAR, cYear: state.cYear, logYear: state.logYear, yfYear: state.yfYear,
      yrT: document.getElementById('yrT').textContent,
      yrF: document.getElementById('yrF').textContent,
      depYrT: opts('depYrT')[0], depYrF: opts('depYrF')[0],
      yfYearSel: document.getElementById('yfYearSel').value,
      yfYearTop: opts('yfYearSel')[0],
      yfStartYear: opts('yfStartYear'),
      tfsa2027: defaultLimit('TFSA', 2027), fhsa2027: defaultLimit('FHSA', 2027),
    };
  });
  check(y.YEAR === 2027 && y.cYear === 2027 && y.yfYear === 2027 && y.logYear === '2027',
    'every year value reads 2027', JSON.stringify({ YEAR: y.YEAR, cYear: y.cYear, yfYear: y.yfYear }));
  check(y.yrT === '2027' && y.yrF === '2027', 'TFSA/FHSA cards show 2027', `${y.yrT}/${y.yrF}`);
  check(y.yfYearSel === '2027', 'Yearly Finance opens on 2027', y.yfYearSel);
  check(y.depYrT === '2028' && y.depYrF === '2028', 'contribution pickers top out at 2028',
    `${y.depYrT}/${y.depYrF}`);
  check(y.yfYearTop === '2028', 'Yearly Finance picker offers 2028', y.yfYearTop);
  check(y.yfStartYear.includes('2028') && y.yfStartYear.includes('2029'),
    'starting-balance year offers 2028 and 2029', JSON.stringify(y.yfStartYear));
  check(y.tfsa2027 === 7000, 'TFSA 2027 carries forward the last announced $7,000', String(y.tfsa2027));
  check(y.fhsa2027 === 8000, 'FHSA 2027 is $8,000', String(y.fhsa2027));
  await ctx.close();

  // ── 7. page left open across midnight ──
  console.log('\n── Page left open across midnight ──');
  ({ ctx, page } = await open('America/Toronto', Date.UTC(2026, 11, 31, 23, 59, 0)));
  const before = await page.evaluate(() => ({ YEAR, cYear: state.cYear }));
  const after = await page.evaluate(t => {
    window.__setNow(t);
    checkYearRollover();            // what the 60s interval calls
    return {
      YEAR, cYear: state.cYear, logYear: state.logYear,
      yrT: document.getElementById('yrT').textContent,
      depYrT: [...document.getElementById('depYrT').options].map(o => o.value)[0],
      toast: (document.getElementById('toast') || {}).textContent,
    };
  }, Date.UTC(2027, 0, 1, 5, 0, 30));
  check(before.YEAR === 2026 && before.cYear === 2026, 'starts on 2026', JSON.stringify(before));
  check(after.YEAR === 2027 && after.cYear === 2027 && after.logYear === '2027',
    'rolls over to 2027', JSON.stringify({ YEAR: after.YEAR, cYear: after.cYear }));
  check(after.yrT === '2027', 'cards repaint as 2027', after.yrT);
  check(after.depYrT === '2028', 'picker now tops out at 2028', after.depYrT);
  check(/Happy 2027/.test(after.toast || ''), 'toast announces the new year', JSON.stringify(after.toast));
  await ctx.close();

  await browser.close(); srv.close();
  console.log(`\nDATES + YEAR ROLLOVER: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
