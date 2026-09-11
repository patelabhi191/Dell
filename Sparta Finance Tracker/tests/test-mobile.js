/* Phone layout: everything the open tab needs must be on screen.

   The failure this guards against is subtle -- nothing errors, nothing looks
   broken in a screenshot of the top of the page, but a control sits hundreds of
   pixels off to the right where nobody will find it. Before this, Yearly's
   Income/Expense filter was 607px past the right edge at 390px wide. */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);
const VIEWS = ['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan'];

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForTimeout(350);
  await page.evaluate(() => { state.plan = { segments: [{ id: 's', name: 'Runway', start: 13632, open: true,
    items: [{ id: 'i', date: '2026-12-01', type: 'expense', name: 'Credit Bill — Sept cycle',
              amt: 1910, notes: 'Estimate, trending high' }] }] };
    planPersist(); renderPlan(); });
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(320); };

  section('1. the open tab\'s controls are on screen, not off to the right');
  for (const v of VIEWS) {
    await go(v);
    const off = await page.evaluate(() => {
      const vw = innerWidth, bad = [];
      // the per-tab controls: year/month pickers and the chart-mode filter
      document.querySelectorAll('.tabbar .yearbar select, .tabbar .yearbar label, .tabbar .yearbar button')
        .forEach(el => { if (!el.offsetParent) return;
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > vw + 1 || b.left < -1))
            bad.push(((el.id || el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 14) + '"')); });
      return bad;
    });
    check(off.length === 0, `${v}: every control reachable without side-scrolling`, off.join(', '));
  }

  section('2. the tab bar wraps instead of dragging its controls off-screen');
  await go('yearly');
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.tabbar'), seg = document.getElementById('viewSeg');
    const wrap = document.getElementById('yfYearWrap');
    return { barScrolls: b.scrollWidth - b.clientWidth,
             segScrolls: seg.scrollWidth - seg.clientWidth,
             segFullWidth: Math.abs(seg.getBoundingClientRect().width - b.clientWidth) < 3,
             controlsBelow: wrap.getBoundingClientRect().top > seg.getBoundingClientRect().bottom - 1,
             modeSeg: document.getElementById('yfModeSeg').getBoundingClientRect().right <= innerWidth + 1 };
  });
  check(bar.barScrolls === 0, 'the bar itself no longer scrolls as one piece', `${bar.barScrolls}px`);
  check(bar.segScrolls > 0, 'the tab list still scrolls sideways on its own', `${bar.segScrolls}px`);
  check(bar.segFullWidth, 'the tab list takes the full row');
  check(bar.controlsBelow, 'the year picker sits on the row BELOW the tabs');
  check(bar.modeSeg, 'the Income/Expense filter is fully on screen (was 607px out)');

  section('3. the page does not pan sideways; wide tables scroll inside their panel');
  for (const v of VIEWS) {
    await go(v);
    const m = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - innerWidth,
      table: (() => { const t = document.querySelector('div[id$="View"]:not([style*="none"]) .tscroll');
        return t ? t.scrollWidth - t.clientWidth : 0; })(),
    }));
    check(m.page <= 1, `${v}: the whole page stays within the screen`, `${m.page}px`);
  }
  await go('dash');
  const dash = await page.evaluate(() => { const t = document.querySelector('.tscroll');
    return { tableScrolls: t.scrollWidth - t.clientWidth,
             panelFits: document.querySelector('.holdings').getBoundingClientRect().right <= innerWidth + 1 }; });
  check(dash.tableScrolls > 0, 'the holdings table scrolls inside its own panel', `${dash.tableScrolls}px`);
  check(dash.panelFits, 'and its panel fits the screen');

  section('4. Plan rows stay readable rather than crushing the name');
  for (const w of [390, 360, 320]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await go('plan');
    const p = await page.evaluate(() => {
      const seg = document.querySelector('.pl-seg.open'), nm = document.querySelector('.pl-nm');
      const row = document.querySelector('.pl-row');
      const amt = document.querySelector('.pl-amt');
      return { over: seg.scrollWidth - seg.clientWidth,
               nameW: Math.round(nm.getBoundingClientRect().width),
               // two lines: the amount sits below the name, not beside it
               twoLine: amt.getBoundingClientRect().top > nm.getBoundingClientRect().bottom - 2,
               rowFits: row.getBoundingClientRect().right <= innerWidth + 1 };
    });
    check(p.over === 0, `${w}px: the segment body does not overflow`, `${p.over}px`);
    check(p.nameW >= 80, `${w}px: the name keeps usable width`, `${p.nameW}px`);
    check(p.twoLine, `${w}px: amount drops below the name instead of squeezing it`);
    check(p.rowFits, `${w}px: the row fits the screen`);
  }
  await page.setViewportSize({ width: 390, height: 850 });

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nMOBILE: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
