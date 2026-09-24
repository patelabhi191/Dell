/* UI tests: real interaction flows across all five tabs, the modals,
   the settings drawer and the PIN gate. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  let { ctx, page, errs } = await open(browser, url);
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(120); };
  const vis = s => page.isVisible(s);
  const txt = s => page.textContent(s).then(t => t.trim());
  const count = s => page.locator(s).count();

  // ── 1. Tab routing ────────────────────────────────────────────────────────
  section('tab routing: one view visible, correct theme + locks');
  const VIEWS = { dash: 'dashView', contrib: 'contribView', yearly: 'yearlyView', monthly: 'monthlyView', archive: 'archiveView' };
  for (const [tab, id] of Object.entries(VIEWS)) {
    await go(tab);
    const shown = [];
    for (const [t2, id2] of Object.entries(VIEWS)) if (await vis('#' + id2)) shown.push(t2);
    check(shown.length === 1 && shown[0] === tab, `${tab}: exactly one view visible`, `(visible: ${shown.join(',')})`);
    const cls = await page.evaluate(() => [...document.body.classList].filter(c => c.endsWith('-view')));
    check(cls.length === 1 && cls[0] === `${tab}-view`, `${tab}: body theme class is ${tab}-view`, `(got ${cls.join(',')})`);
    const locked = await page.evaluate(() => ({
      ccy: document.getElementById('ccySeg').classList.contains('locked'),
      acct: document.getElementById('acctSeg').classList.contains('locked'),
    }));
    const wantLocked = tab !== 'dash';
    check(locked.ccy === wantLocked && locked.acct === wantLocked,
      `${tab}: currency/account selectors ${wantLocked ? 'locked' : 'unlocked'}`);
  }
  await go('contrib');
  check(await page.evaluate(() => document.querySelector('#ccySeg button.active').dataset.ccy) === 'CAD',
    'contrib forces CAD');

  // year/month bars belong to their own tab only
  for (const [tab, bar] of [['contrib', 'yearBar'], ['yearly', 'yfYearWrap'], ['monthly', 'meMonthWrap']]) {
    await go(tab);
    const on = await page.evaluate(b => document.getElementById(b).classList.contains('show'), bar);
    const others = await page.evaluate(b => ['yearBar', 'yfYearWrap', 'meMonthWrap']
      .filter(x => x !== b && document.getElementById(x).classList.contains('show')), bar);
    check(on && others.length === 0, `${tab}: only #${bar} selector shown`, others.length ? `(also ${others})` : '');
  }

  // ── 2. Dashboard flows ────────────────────────────────────────────────────
  section('dashboard: add cash, withdraw, add holding, sell modal');
  await go('dash');
  const rows0 = await count('#hbody tr');
  // Dashboard cash is stored in USD base and converted for display, so the
  // user-visible contract is the DISPLAYED delta in the selected currency.
  const cashNum = async () => +(await txt('#cashT')).replace(/[^0-9.]/g, '');
  const c0 = await cashNum();
  await page.selectOption('#cashAcct', 'TFSA');
  await page.fill('#cashAmt', '500');
  await page.click('#addCash');
  await page.waitForTimeout(120);
  const c1 = await cashNum();
  check(Math.abs((c1 - c0) - 500) < 0.02, 'add cash: displayed TFSA cash rises by exactly C$500',
    `(${c0.toFixed(2)} -> ${c1.toFixed(2)})`);
  await page.fill('#cashAmt', '200');
  await page.click('#rmCash');
  await page.waitForTimeout(120);
  const c2 = await cashNum();
  check(Math.abs((c1 - c2) - 200) < 0.02, 'withdraw: displayed TFSA cash falls by exactly C$200',
    `(${c1.toFixed(2)} -> ${c2.toFixed(2)})`);
  check(Math.abs(await page.evaluate(() => state.cash.TFSA) - (2500.5 + 300 / 1.37)) < 0.02,
    'cash stored in USD base (300 CAD net / 1.37)',
    `(got ${(await page.evaluate(() => state.cash.TFSA)).toFixed(4)})`);

  await page.fill('#fSym', 'MSFT');
  await page.selectOption('#fAcct', 'TFSA');
  await page.fill('#fQty', '5');
  await page.fill('#fPrice', '400');
  await page.fill('#fManual', '410');
  await page.click('#addHolding');
  await page.waitForTimeout(150);
  check(await count('#hbody tr') === rows0 + 1, 'add holding: one new row rendered');
  check(await page.evaluate(() => !!state.holdings.find(h => h.sym === 'MSFT')), 'add holding: present in state');

  // same symbol + account averages into the existing position
  const before = await page.evaluate(() => state.holdings.filter(h => h.sym === 'MSFT').length);
  await page.fill('#fSym', 'MSFT'); await page.selectOption('#fAcct', 'TFSA');
  await page.fill('#fQty', '5'); await page.fill('#fPrice', '420'); await page.fill('#fManual', '410');
  await page.click('#addHolding'); await page.waitForTimeout(150);
  const after = await page.evaluate(() => state.holdings.filter(h => h.sym === 'MSFT'));
  check(after.length === before && after[0].qty === 10, 'same symbol+account averages into one position',
    `(qty=${after[0].qty}, avg=${after[0].avg})`);
  check(Math.abs(after[0].avg - 410) < 0.01, 'averaged cost = (5*400 + 5*420)/10 = 410', `(got ${after[0].avg})`);

  await page.click('#hbody tr:first-child .rm.sell');
  await page.waitForTimeout(120);
  check(await vis('#sellModal'), 'sell modal opens');
  await page.click('#sellCancel'); await page.waitForTimeout(120);
  check(!(await vis('#sellModal')), 'sell modal closes on cancel');

  const syms = () => page.evaluate(() =>
    [...document.querySelectorAll('#hbody tr .sym')].map(e => e.textContent.trim().split('\n')[0]));
  // Two sort MODES, not a direction toggle (see `let sortBy` comment in source):
  //   'sym' = A->Z always, 'pl' = highest P/L % first always.
  await page.click('#sortSym'); await page.waitForTimeout(120);
  const asc = await syms();
  check(JSON.stringify(asc) === JSON.stringify([...asc].sort()), 'symbol mode sorts A->Z',
    `(${asc.map(x => x.slice(0, 4)).join(',')})`);
  const symCls = await page.evaluate(() => [...document.getElementById('sortSym').classList]);
  check(symCls.includes('on') && symCls.includes('asc'), 'symbol header marked on+asc (up arrow)');

  await page.click('#sortPL'); await page.waitForTimeout(120);
  const plOrder = await page.evaluate(() =>
    [...document.querySelectorAll('#hbody tr')].map(r => {
      const c = r.querySelector('.pl'); return c ? parseFloat(c.textContent.replace(/[^0-9.\-]/g, '')) : null;
    }));
  check(await page.evaluate(() => document.getElementById('sortPL').classList.contains('on')
    && !document.getElementById('sortSym').classList.contains('on')),
    'P/L mode takes over the active marker');
  check(plOrder.length > 0, 'P/L mode renders rows', `(${plOrder.length} rows)`);

  await page.click('#sortSym'); await page.waitForTimeout(120);
  check(JSON.stringify(await syms()) === JSON.stringify(asc), 'switching back to symbol mode restores A->Z');

  // ── 3. Contributions flows ────────────────────────────────────────────────
  section('contributions: deposit, log, edit modal');
  await go('contrib');
  const tBefore = await page.evaluate(() => contributed('TFSA', 2026));
  await page.fill('#depAmtT', '1000');
  await page.click('#depBtnT'); await page.waitForTimeout(150);
  check(await page.evaluate(() => contributed('TFSA', 2026)) === tBefore + 1000,
    'TFSA deposit adds 1000 to the viewed year');
  check((await txt('#cTfsaAmt')).includes('5,200'), 'TFSA card shows 5,200.00', `(got ${await txt('#cTfsaAmt')})`);

  await page.click('#logToggle'); await page.waitForTimeout(150);
  check(await vis('#logBody'), 'deposit log expands');
  check(await count('#cbody tr') > 0, 'deposit log lists entries', `(${await count('#cbody tr')} rows)`);

  await page.click('#cbody tr:first-child .yf-edit'); await page.waitForTimeout(150);
  const cedOpen = await vis('#cedModal');
  check(cedOpen, 'edit-deposit modal opens');
  if (cedOpen) { await page.click('#cedCancel'); await page.waitForTimeout(100); }
  check(!(await vis('#cedModal')), 'edit-deposit modal closes');

  // ── 4. Yearly Finance flows ───────────────────────────────────────────────
  section('yearly finance: transaction CRUD, categories, filters');
  await go('yearly');
  const txBefore = await count('#yfTxBody tr');
  await page.selectOption('#yfType', 'expense');
  await page.fill('#yfDate', '2026-04-09');
  await page.fill('#yfAmt', '77.25');
  await page.fill('#yfDesc', 'Test Expense');
  await page.selectOption('#yfCat', 'Misc');
  await page.click('#yfSave'); await page.waitForTimeout(180);
  check(await count('#yfTxBody tr') === txBefore + 1, 'add transaction: row appears');
  check(await page.evaluate(() => state.yf.txns.some(t => t.desc === 'Test Expense')), 'transaction saved to state');

  await page.click('#yfTxBody tr:first-child .yf-edit'); await page.waitForTimeout(150);
  check(await vis('#yfCancelEdit'), 'edit mode shows Cancel edit');
  await page.click('#yfCancelEdit'); await page.waitForTimeout(120);
  check(!(await vis('#yfCancelEdit')), 'cancel edit exits edit mode');

  const catBefore = await page.evaluate(() => state.yf.cats.exp.length);
  await page.fill('#yfNewExpCat', 'QA Category');
  await page.click('#yfAddExpCat'); await page.waitForTimeout(150);
  check(await page.evaluate(() => state.yf.cats.exp.length) === catBefore + 1, 'add expense category');
  check(await page.evaluate(() => state.yf.cats.exp.includes('QA Category')), 'new category present');
  // duplicate (case-insensitive) must be rejected
  await page.fill('#yfNewExpCat', 'qa category');
  await page.click('#yfAddExpCat'); await page.waitForTimeout(150);
  check(await page.evaluate(() => state.yf.cats.exp.length) === catBefore + 1,
    'duplicate category rejected (case-insensitive)');

  for (const m of ['income', 'expense', 'both']) {
    await page.click(`#yfModeSeg button[data-mode="${m}"]`); await page.waitForTimeout(120);
    check(await page.evaluate(mm => document.querySelector(`#yfModeSeg button[data-mode="${mm}"]`).classList.contains('active'), m),
      `mode segment "${m}" activates`);
  }
  await page.click('#yfFilterSeg button[data-f="expense"]'); await page.waitForTimeout(150);
  // rows tag the type as IN / EXP via .tag-inc / .tag-exp
  const expOnly = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#yfTxBody tr')];
    return { n: rows.length, allExp: rows.length > 0 && rows.every(r => !!r.querySelector('.tag-exp')) };
  });
  check(expOnly.allExp, 'transaction filter: every visible row is an EXP row',
    `(${expOnly.n} rows)`);
  await page.click('#yfFilterSeg button[data-f="all"]'); await page.waitForTimeout(120);

  // ── 5. Monthly Expense flows + shared ledger ──────────────────────────────
  section('monthly expense: shared ledger with yearly, gear popover');
  await go('monthly');
  // meMonthOptions() = every month with data + last 12 + one month ahead
  const nMonths = await count('#meMonthSel option');
  check(nMonths >= 13, 'month selector spans last 12 months plus one ahead', `(${nMonths} options)`);
  check(await page.evaluate(() => {
    const v = [...document.querySelectorAll('#meMonthSel option')].map(o => o.value);
    return JSON.stringify(v) === JSON.stringify([...v].sort().reverse());
  }), 'month options are newest-first');
  await page.click('#meGear'); await page.waitForTimeout(120);
  check(await vis('#mePop'), 'category popover opens');
  await page.click('#mePopNone'); await page.waitForTimeout(120);
  check(await page.evaluate(() => state.me.chartCats.length) === 0, '"None" clears chart categories');
  await page.click('#mePopAll'); await page.waitForTimeout(120);
  check(await page.evaluate(() => state.me.chartCats.length) > 0, '"All" restores chart categories');

  // add an expense on Monthly; it must show up on Yearly (same state.yf.txns)
  const yfBefore = await page.evaluate(() => state.yf.txns.length);
  // the form takes a month, not a date: the #meDate field was removed when
  // Monthly moved to month-only entry
  await page.selectOption('#meFormMonth', '2026-01');
  await page.fill('#meAmt', '55.55');
  await page.fill('#meDesc', 'Shared Ledger Probe');
  // filing is either/or and starts on neither, so a category has to be chosen
  await page.selectOption('#meCat', 'Groceries');
  await page.click('#meSave'); await page.waitForTimeout(180);
  check(await page.evaluate(() => state.yf.txns.length) === yfBefore + 1,
    'monthly expense writes into state.yf.txns (single shared ledger)');
  await go('yearly');
  await page.selectOption('#yfTxMonth', { index: 0 }).catch(() => { });
  await page.waitForTimeout(150);
  check(await page.evaluate(() => state.yf.txns.some(t => t.desc === 'Shared Ledger Probe' && t.type === 'expense')),
    'the monthly-added row is an expense in the yearly ledger');

  // ── 6. Settings drawer ────────────────────────────────────────────────────
  section('settings drawer: open, tab order, reset');
  await go('dash');
  await page.click('#settingsBtn'); await page.waitForTimeout(150);
  check(await vis('#drawer'), 'settings drawer opens');
  check(await count('#tabOrder .taborder-row') === 6, 'tab-order list shows 6 tabs');
  const first0 = await page.evaluate(() => document.querySelector('#tabOrder .taborder-row').dataset.tab);
  await page.click('#tabOrder .taborder-row:nth-child(2) [data-up]'); await page.waitForTimeout(150);
  const first1 = await page.evaluate(() => document.querySelector('#tabOrder .taborder-row').dataset.tab);
  check(first0 !== first1, 'move-left reorders tabs', `(${first0} -> ${first1})`);
  check(await page.evaluate(() => document.querySelector('#viewSeg button').dataset.view) === first1,
    'tab bar DOM order follows the setting');
  await page.click('#tabOrderReset'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.querySelector('#tabOrder .taborder-row').dataset.tab) === 'dash',
    'reset restores default order');
  await page.click('#settingsBtn'); await page.waitForTimeout(120);
  check(!(await vis('#drawer')), 'settings drawer closes');

  check(errs.length === 0, 'no uncaught page errors during all flows',
    errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close();

  // ── 7. Persistence across reload ──────────────────────────────────────────
  section('persistence across reload');
  const s2 = await open(browser, url);
  await s2.page.evaluate(() => {
    state.yf.txns.push({ id: 'persist1', type: 'expense', date: '2026-05-05', amt: 12.34, desc: 'Persist Probe', cat: 'Misc' });
    yfPersist();
  });
  await s2.page.reload({ waitUntil: 'load' });
  await s2.page.waitForTimeout(250);
  check(await s2.page.evaluate(() => state.yf.txns.some(t => t.desc === 'Persist Probe')),
    'yearly transaction survives a reload');
  await s2.ctx.close();

  // ── 8. PIN gate ───────────────────────────────────────────────────────────
  section('PIN gate');
  const pinSeed = Object.assign({}, SEED, { 'sparta.pinOn': 'true', 'sparta.pinCode': '"246813"' });
  const s3 = await open(browser, url, pinSeed);
  check(await s3.page.isVisible('#pinGate'), 'gate shown when pinOn + pinCode set');
  check(await s3.page.evaluate(() => getComputedStyle(document.body).overflow) === 'hidden',
    'body scroll locked while gated');
  for (const d of '999999') await s3.page.click(`#pinKeys button[data-k="${d}"]`);
  await s3.page.waitForTimeout(500);
  check(await s3.page.isVisible('#pinGate'), 'wrong PIN keeps the gate up');
  check((await s3.page.textContent('#pinMsg')).length > 0, 'wrong PIN shows a message',
    `("${(await s3.page.textContent('#pinMsg')).trim()}")`);
  for (const d of '246813') await s3.page.click(`#pinKeys button[data-k="${d}"]`);
  await s3.page.waitForTimeout(900);
  check(!(await s3.page.isVisible('#pinGate')), 'correct PIN unlocks');
  check(await s3.page.isVisible('#dashView'), 'app is usable after unlock');
  await s3.ctx.close();

  const s4 = await open(browser, url, Object.assign({}, SEED, { 'sparta.pinOn': 'false' }));
  check(!(await s4.page.isVisible('#pinGate')), 'no gate when pinOn is false');
  await s4.ctx.close();

  section('quote links: the arrow beside each ticker, and its configurable base');
  {
    const s6 = await open(browser, url);
    const p6 = s6.page;
    const hrefs = () => p6.evaluate(() =>
      [...document.querySelectorAll('#hbody .qlink')].map(a => a.getAttribute('href')));
    const stored = () => p6.evaluate(() => localStorage.getItem('sparta.quoteUrl'));

    const def = await hrefs();
    check(def.length === 4, 'every holding carries a link', String(def.length));
    check(def[0] === 'https://ca.finance.yahoo.com/quote/AAPL',
      'which defaults to the Yahoo quote page for that ticker', def[0]);
    /* target=_blank without rel=noopener hands the opened page a window.opener
       back into this one. Not optional. */
    check(await p6.evaluate(() => {
      const a = document.querySelector('#hbody .qlink');
      return a.getAttribute('target') === '_blank' && /noopener/.test(a.getAttribute('rel'));
    }), 'and opens in a new tab without handing it a window.opener');

    await p6.fill('#quoteUrl', 'https://example.com/q/');
    await p6.click('#quoteUrlSave'); await p6.waitForTimeout(250);
    check((await hrefs())[0] === 'https://example.com/q/AAPL',
      'saving a new base repoints every row', (await hrefs())[0]);
    await p6.fill('#quoteUrl', 'https://example.com/q');
    await p6.click('#quoteUrlSave'); await p6.waitForTimeout(250);
    check((await hrefs())[0] === 'https://example.com/q/AAPL',
      'and it lands in the same place with or without a trailing slash',
      (await hrefs())[0]);

    /* new URL() happily accepts javascript: and mailto:. A javascript: href sitting
       behind a target=_blank anchor is not something to leave in the page, so the
       scheme is checked separately -- and a refusal must not wipe what was there. */
    for (const junk of ['javascript:alert(1)', 'mailto:a@b.c', 'not a url']) {
      await p6.fill('#quoteUrl', junk);
      await p6.click('#quoteUrlSave'); await p6.waitForTimeout(200);
      check(await stored() === '"https://example.com/q"' &&
            (await hrefs())[0] === 'https://example.com/q/AAPL',
        `${junk.slice(0, 18)} is refused and the previous base survives`, await stored());
    }

    await p6.fill('#quoteUrl', '');
    await p6.click('#quoteUrlSave'); await p6.waitForTimeout(250);
    check(await stored() === null && (await hrefs())[0].startsWith('https://ca.finance.yahoo.com'),
      'clearing the field drops the key and falls back to the default');

    /* It is a preference, like the currency and the tab order -- not part of the
       portfolio. So it must not be namespaced per database, and Clear data must
       not take it. */
    check(await p6.evaluate(() => STORE_DEVICE.includes('sparta.quoteUrl')),
      'the base is a device preference, so Clear data leaves it alone');

    check(s6.errs.length === 0, 'no page errors from the quote links', s6.errs.join(' | '));
    await s6.ctx.close();
  }

  section('dashboard chart: a dot per point, and its value on hover');
  {
    const DAY = 86400e3;
    // one closing point a day for a week, values chosen so each is distinct
    const hist = [];
    for (let i = 6; i >= 0; i--)
      hist.push({ t: Date.now() - i * DAY, v: { ALL: 20000 + (6 - i) * 1100, TFSA: 1, FHSA: 1, Other: 1 }, k: 'k' + i });
    const s5 = await open(browser, url,
      Object.assign({}, SEED, { 'sparta.dash.history': JSON.stringify(hist) }));
    const p5 = s5.page;
    await p5.click('#rangeSeg button[data-r="1W"]');
    await p5.waitForTimeout(300);

    const geo = await p5.evaluate(() => {
      const r = document.getElementById('chart').getBoundingClientRect();
      return { top: r.top, h: r.height, w: r.width, pts: dashPts.length };
    });
    // everything below measures 0 and passes meaninglessly if the chart never drew
    check(geo.w > 100 && geo.h > 50 && geo.pts === 7,
      'the chart is laid out with all seven points', JSON.stringify(geo));

    const dotCount = () => p5.evaluate(() =>
      document.querySelectorAll('#chart path[vector-effect]').length);
    // 7 day dots + the end-of-line dot + the (hidden) hover marker
    check(await dotCount() === 9, 'a dot is drawn on every point', String(await dotCount()));

    const hoverPt = async i => {
      const cx = await p5.evaluate(i => {
        const r = document.getElementById('chart').getBoundingClientRect();
        return r.left + (dashXof(dashPts[i].t) / 640) * r.width;
      }, i);
      await p5.mouse.move(cx, geo.top + geo.h / 2);
      /* .ctip carries `transition:opacity .15s`. Reading the computed opacity on
         a timer returns a mid-interpolation value -- this section really did fail
         intermittently on 0.969446 before this was a wait rather than a sleep
         (bug class 11). Waiting on the settled value is deterministic; a sleep
         long enough to "usually" work is just a slower race. */
      await p5.waitForFunction(
        () => getComputedStyle(document.getElementById('dashTip')).opacity === '1',
        null, { timeout: 2000 });
      return p5.evaluate(() => {
        const t = document.getElementById('dashTip');
        return { txt: t.textContent, op: getComputedStyle(t).opacity,
                 guide: document.getElementById('dashHover').getAttribute('opacity') };
      });
    };

    const seen = [];
    for (let i = 0; i < 7; i++) seen.push(await hoverPt(i));
    check(seen.every(s => s.op === '1' && s.guide === '1'),
      'hovering shows the tooltip and its guide', JSON.stringify(seen.map(s => s.op)));
    /* Reporting DISTINCT values in order is the non-vacuity guard: a lookup that
       always returned the last point would satisfy "a tooltip appeared". */
    check(new Set(seen.map(s => s.txt)).size === 7,
      'each point reports its own figure, not the same one seven times',
      JSON.stringify(seen.map(s => s.txt)));
    check(/Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug/.test(seen[0].txt),
      'a past point is labelled with its date', seen[0].txt);
    check(/^Today \d\d:\d\d/.test(seen[6].txt),
      'a point taken today is labelled with its time, not called a close', seen[6].txt);

    /* The tooltip must read through fmt(), so it can never disagree with the hero
       figure above it. Flipping the currency is what proves that. */
    const cadTxt = seen[3].txt;
    await p5.click('#ccySeg button[data-ccy="USD"]').catch(() => {});
    await p5.waitForTimeout(250);
    const usd = await hoverPt(3);
    check(usd.txt !== cadTxt && /\$/.test(usd.txt),
      'the figure follows the currency toggle rather than hardcoding C$',
      JSON.stringify([cadTxt, usd.txt]));
    await p5.click('#ccySeg button[data-ccy="CAD"]').catch(() => {});
    await p5.waitForTimeout(200);

    // a stale tooltip after a range switch would be a plainly wrong number
    await hoverPt(3);
    await p5.click('#rangeSeg button[data-r="1D"]');
    const hidden = await p5.waitForFunction(
      () => getComputedStyle(document.getElementById('dashTip')).opacity === '0',
      null, { timeout: 2000 }).then(() => true).catch(() => false);
    check(hidden, 'switching range hides a tooltip that was open');

    await p5.click('#rangeSeg button[data-r="1W"]');
    await p5.waitForTimeout(250);
    /* drawChart() replaces svg.innerHTML on every render and on every 60s price
       refresh. Handlers bound inside it would stack up invisibly -- nothing else
       in the suite would notice, and the page would just get slower. Count the
       real addEventListener calls rather than trusting the guard flag, which
       would report "bound" whether or not it was doing its job. */
    const leak = await p5.evaluate(() => {
      const wrap = document.getElementById('chart').parentElement;
      let added = 0;
      const real = wrap.addEventListener.bind(wrap);
      wrap.addEventListener = (...a) => { added++; return real(...a) };
      for (let i = 0; i < 12; i++) drawChart();          // a dozen price refreshes
      return { added, pts: dashPts.length };
    });
    check(leak.added === 0 && leak.pts === 7,
      'a dozen redraws add no further listeners, and still draw every point',
      JSON.stringify(leak));
    const still = await hoverPt(2);
    check(still.op === '1' && still.txt.length > 4,
      'and hovering still works after all those redraws', still.txt);

    check(s5.errs.length === 0, 'no page errors from the chart', s5.errs.join(' | '));
    await s5.ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\nUI: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
