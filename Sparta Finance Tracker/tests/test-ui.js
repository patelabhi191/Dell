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
  // the optional current-price field is gone; a new position starts at the buy price
  await page.click('#addHolding');
  await page.waitForTimeout(150);
  check(await count('#hbody tr') === rows0 + 1, 'add holding: one new row rendered');
  check(await page.evaluate(() => !!state.holdings.find(h => h.sym === 'MSFT')), 'add holding: present in state');

  // same symbol + account averages into the existing position
  const before = await page.evaluate(() => state.holdings.filter(h => h.sym === 'MSFT').length);
  await page.fill('#fSym', 'MSFT'); await page.selectOption('#fAcct', 'TFSA');
  await page.fill('#fQty', '5'); await page.fill('#fPrice', '420');
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


  /* ── THE BROKER MARK ─────────────────────────────────────────────────────
     Two brokers, both holding a TFSA and an FHSA, so the account alone cannot
     say where a position lives. It is a LABEL: it must change no total, no
     filter and no figure. Blank means Wealthsimple, so only the exception is
     marked. */
  {
    const B = await open(browser, url);
    const bk = () => B.page.evaluate(() =>
      [...document.querySelectorAll('#hbody .bk')].map(b => b.textContent));
    check((await bk()).length === 4 && (await bk()).every(t => t === ''),
      'every holding gets a mark and all start blank', JSON.stringify(await bk()));
    /* Blank but not invisible: the box has to hold its width or the tickers
       shift sideways the moment one row is marked. */
    /* The visible box is only as wide as the gutter it sits in, so measure the
       HIT area -- the pseudo-element — rather than the box, or this asserts the
       wrong thing and a 10x15 tap target passes for comfortable. */
    const box = await B.page.evaluate(() => {
      const b = document.querySelector('#hbody .bk');
      const r = b.getBoundingClientRect();
      const be = getComputedStyle(b, '::before');
      const grow = s => Math.abs(parseFloat(s) || 0);
      return { w: Math.round(r.width + grow(be.left) + grow(be.right)),
               h: Math.round(r.height + grow(be.top) + grow(be.bottom)),
               boxW: Math.round(r.width) };
    });
    check(box.w >= 14 && box.h >= 28,
      'a blank mark still has a comfortable hit area', JSON.stringify(box));
    check(box.boxW <= 10,
      'while the mark itself stays inside the 10px gutter, so tickers do not move',
      String(box.boxW));

    const totals0 = await B.page.evaluate(() => ({
      hero: document.getElementById('heroValue').textContent,
      rows: document.querySelectorAll('#hbody tr').length }));
    await B.page.click('#hbody .bk');
    await B.page.waitForTimeout(250);
    const marked = await B.page.evaluate(() => {
      const b = document.querySelector('#hbody .bk');
      const other = document.querySelector('.tag-other');
      return { txt: b.textContent, pressed: b.getAttribute('aria-pressed'),
        colour: getComputedStyle(b).color,
        otherColour: other ? getComputedStyle(other).color : null,
        stored: state.holdings[0].broker,
        hero: document.getElementById('heroValue').textContent,
        rows: document.querySelectorAll('#hbody tr').length };
    });
    check(marked.txt === 'Q' && marked.stored === 'Q' && marked.pressed === 'true',
      'clicking marks it Q, and says so to a screen reader', JSON.stringify(marked));
    check(marked.colour === marked.otherColour,
      'in the same grey the "Other" tag uses', marked.colour);
    /* The assertion that matters: a label must not move money. */
    check(marked.hero === totals0.hero && marked.rows === totals0.rows,
      'and it changes no figure and hides no row', `${totals0.hero} / ${marked.hero}`);

    await B.page.click('#hbody .bk'); await B.page.waitForTimeout(200);
    check(await B.page.evaluate(() => state.holdings[0].broker) === '',
      'clicking again clears it');

    await B.page.evaluate(() => { state.holdings[0].broker = 'Q'; persist(); render() });
    await B.page.reload({ waitUntil: 'load' }); await B.page.waitForTimeout(400);
    check(await B.page.evaluate(() =>
      state.holdings[0].broker === 'Q' && document.querySelector('#hbody .bk').textContent === 'Q'),
      'the mark survives a reload');
    check(await B.page.evaluate(() => corePayload().holdings[0].broker === 'Q'),
      'and travels in a backup, so it is not lost on a restore');

    /* Adding a position is unchanged, and the optional current-price field is
       gone -- a new holding starts at the buy price and is left to the refresh. */
    check(await B.page.evaluate(() => !document.getElementById('fManual')),
      'the optional current-price field is gone from Add a position');
    const added = await B.page.evaluate(() => {
      document.getElementById('fSym').value = 'TEST';
      document.getElementById('fAcct').value = 'FHSA';
      document.getElementById('fQty').value = '3';
      document.getElementById('fPrice').value = '20';
      addHolding();
      const h = state.holdings.find(x => x.sym === 'TEST');
      return h && { acct: h.acct, qty: h.qty, avg: h.avg, price: h.price, manual: h.manual };
    });
    check(added && added.acct === 'FHSA' && added.qty === 3 && added.avg === 20,
      'a position still adds under the account chosen', JSON.stringify(added));
    check(added.price === 20 && added.manual === false,
      'it starts at the buy price and is left to the live refresh', JSON.stringify(added));

    check(B.errs.length === 0, 'no page errors from the broker mark', B.errs.join(' | '));
    await B.ctx.close();
  }

  /* ── PAST SELLS ──────────────────────────────────────────────────────────
     Sells were not recorded at all before this: confirmSell() adjusted cash,
     dropped the holding and kept nothing. The panel therefore starts empty and
     fills from the first sale, and the thing worth testing hardest is that a
     trade keeps the currency it happened in -- a record that stored a converted
     total would be wrong the next day. */
  {
    const S = await open(browser, url);
    const q = sel => S.page.evaluate(x => {
      const e = document.querySelector(x); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel);

    check(await S.page.evaluate(() => Array.isArray(state.sells) && state.sells.length === 0),
      'the sells store starts empty');
    check(await S.page.evaluate(() =>
      getComputedStyle(document.getElementById('sellEmpty')).display !== 'none'),
      'and the panel says so rather than showing an empty table');

    // AAPL is USD (avg 180.50), ENB is CAD (avg 48.20) in the seed
    const sell = (sym, qty, price) => S.page.evaluate(([sym, qty, price]) => {
      const h = state.holdings.find(x => x.sym === sym);
      sellHolding(h.id);
      document.getElementById('sellQty').value = String(qty);
      document.getElementById('sellPrice').value = String(price);
      confirmSell();
    }, [sym, qty, price]);

    await sell('AAPL', 5, 250);        // +$347.50 on a $902.50 cost  => +38.50%
    await sell('ENB', 10, 40);         // −C$82.00 on a C$482.00 cost => −17.01%
    await S.page.waitForTimeout(200);

    const rec = await S.page.evaluate(() => state.sells.map(s =>
      ({ sym: s.sym, qty: s.qty, price: s.price, avg: s.avg, ccy: s.ccy })));
    check(rec.length === 2, 'both sales are recorded', JSON.stringify(rec));
    check(rec[0].ccy === 'USD' && rec[1].ccy === 'CAD',
      'each keeps the currency it happened in', rec.map(r => r.ccy).join('/'));
    check(rec[0].price === 250 && rec[0].avg === 180.5,
      'the NATIVE price and average cost are stored, not a converted total',
      JSON.stringify(rec[0]));

    /* The amount cell also carries the percentage as a hidden sub-line, shown
       only at phone width, so read the VISIBLE text or every amount reads twice. */
    const cells = await S.page.evaluate(() =>
      [...document.querySelectorAll('#sellBody tr')].map(tr =>
        [...tr.children].map(td => {
          const c = td.cloneNode(true);
          c.querySelectorAll('.sl-sub').forEach(x => x.remove());
          return c.textContent.replace(/\s+/g, ' ').trim();
        })));
    check(cells.length === 2, 'two rows are drawn', JSON.stringify(cells));
    const usd = cells.find(c => /AAPL/.test(c[1])), cad = cells.find(c => /ENB/.test(c[1]));
    check(usd[2] === '+38.50%' && usd[3] === '+$347.50',
      'the USD row reads in dollars, and the figures are right', JSON.stringify(usd));
    check(cad[2] === '−17.01%' && cad[3] === '−C$82.00',
      'the CAD row reads in Canadian dollars', JSON.stringify(cad));

    // ── the toggle must not reach this panel ──────────────────────────────
    const before = await q('#sellsPanel');
    const hero0 = await q('#heroValue');
    await S.page.evaluate(() => { state.ccy = state.ccy === 'CAD' ? 'USD' : 'CAD'; render() });
    await S.page.waitForTimeout(200);
    const after = await q('#sellsPanel');
    const hero1 = await q('#heroValue');
    /* The companion assertion is the point: without it this passes against a
       panel that renders nothing at all. */
    check(hero0 !== hero1, 'flipping USD/CAD does move the hero total', hero0 + ' -> ' + hero1);
    check(before === after, 'but changes nothing in Past sells — every figure is native');

    // ── totals are per currency and never added together ──────────────────
    const tiles = await S.page.evaluate(() =>
      [...document.querySelectorAll('#sellSum > div')].map(d =>
        [...d.querySelectorAll('.v')].map(v => v.textContent.replace(/\s+/g, ' ').trim())));
    check(tiles[0].length === 2 && tiles[0].some(t => /\$347\.50/.test(t))
      && tiles[0].some(t => /C\$82\.00/.test(t)),
      'Realised P/L shows both currencies, unmerged', JSON.stringify(tiles[0]));
    check(!tiles[0].some(t => /265|\+\$265/.test(t)),
      'and nothing anywhere is the two added together');
    /* The Sells and Winners tiles were removed -- a count of rows is readable
       from the rows. Only the two money tiles remain. */
    check(tiles.length === 2, 'there are exactly two tiles', String(tiles.length));

    // ── a USD-only portfolio gets one figure, not an empty half ───────────
    await S.page.evaluate(() => { state.sells = state.sells.filter(s => s.ccy === 'USD'); render() });
    await S.page.waitForTimeout(150);
    check((await S.page.evaluate(() =>
      document.querySelectorAll('#sellSum > div:first-child .v').length)) === 1,
      'one currency gives one figure, with no blank second line');

    // ── the account filter applies, like every other Dashboard figure ─────
    await S.page.evaluate(() => { state.filter = 'FHSA'; render() });
    await S.page.waitForTimeout(150);
    check(await S.page.evaluate(() => document.querySelectorAll('#sellBody tr').length) === 0,
      'a sale in another account is filtered out');
    await S.page.evaluate(() => { state.filter = 'ALL'; render() });

    // ── a partial sale records what was sold, and leaves the average alone ─
    await S.page.evaluate(() => { state.sells = []; render() });
    const part = await S.page.evaluate(() => {
      const h = state.holdings.find(x => x.sym === 'VFV');
      const before = { qty: h.qty, avg: h.avg };
      sellHolding(h.id);
      document.getElementById('sellQty').value = '5';
      document.getElementById('sellPrice').value = '150';
      confirmSell();
      const after = state.holdings.find(x => x.sym === 'VFV');
      return { before, after: { qty: after.qty, avg: after.avg }, rec: state.sells[0] };
    });
    check(part.rec.qty === 5 && part.after.qty === part.before.qty - 5,
      'a partial sale records 5, not the whole position', JSON.stringify(part));
    check(part.after.avg === part.before.avg,
      'and the average cost is untouched by a partial sale');

    check(S.errs.length === 0, 'no page errors from Past sells', S.errs.join(' | '));
    await S.ctx.close();
  }

  /* ── CORRECTING A SALE ───────────────────────────────────────────────────
     A wrong quantity or price used to be permanent, and it was wrong in TWO
     places: the history line and the portfolio. So every check here asserts the
     holding, the cash and the record together -- a correction that fixes the
     row and leaves the shares missing is the failure worth catching.

     Figures are hand-computed in the test rather than read back through the
     app's own helpers, or this would only be checking that it agrees with
     itself. 300 AAPL at $100 average, sold at $150. */
  {
    const C = await open(browser, url);
    const setup = () => C.page.evaluate(() => {
      state.holdings = [{ id: 'h1', sym: 'AAPL', acct: 'TFSA', qty: 300, avg: 100,
                          ccy: 'USD', price: 120, manual: true }];
      state.cash = { TFSA: 0, FHSA: 0, Other: 0 };
      state.sells = []; state.ccy = 'USD'; state.fx = 1.37;
      persist(); render();
    });
    const sell = (q, p) => C.page.evaluate(([q, p]) => {
      sellHolding('h1');
      document.getElementById('sellQty').value = String(q);
      document.getElementById('sellPrice').value = String(p);
      confirmSell();
    }, [q, p]);
    const edit = (q, p) => C.page.evaluate(([q, p]) => {
      editSell(state.sells[0].id);
      if (q != null) document.getElementById('sellQty').value = String(q);
      if (p != null) document.getElementById('sellPrice').value = String(p);
      confirmSell();
    }, [q, p]);
    const look = () => C.page.evaluate(() => ({
      holdings: state.holdings.map(h => ({ sym: h.sym, qty: h.qty, avg: +h.avg.toFixed(4), ccy: h.ccy })),
      cash: +state.cash.TFSA.toFixed(2),
      sells: state.sells.map(r => ({ qty: r.qty, price: r.price, avg: r.avg })),
    }));

    // ── quantity down: the shares come back ───────────────────────────────
    await setup(); await sell(300, 150); await edit(100, null);
    let v = await look();
    check(v.holdings.length === 1 && v.holdings[0].qty === 200 && v.holdings[0].avg === 100,
      '300 sold then corrected to 100 puts 200 back at the original cost', JSON.stringify(v.holdings));
    check(v.cash === 15000, 'and cash holds only the 100 that were really sold (100 x 150)', String(v.cash));
    check(v.sells[0].qty === 100 && v.sells[0].price === 150 && v.sells[0].avg === 100,
      'the record reads the corrected quantity, and its cost basis is NOT rewritten',
      JSON.stringify(v.sells[0]));

    // ── price only: no shares move ────────────────────────────────────────
    await setup(); await sell(100, 150); await edit(null, 160);
    v = await look();
    check(v.holdings[0].qty === 200 && v.holdings[0].avg === 100,
      'a price-only correction moves no shares', JSON.stringify(v.holdings[0]));
    check(v.cash === 16000, 'and moves cash by the price difference alone', String(v.cash));

    // ── the holding a full sale removed is re-created ─────────────────────
    await setup(); await sell(300, 150);
    check((await look()).holdings.length === 0, 'a full sale removes the holding');
    await edit(50, null);
    v = await look();
    check(v.holdings.length === 1 && v.holdings[0].qty === 250 && v.holdings[0].avg === 100
      && v.holdings[0].ccy === 'USD',
      'correcting it brings the position back, with its cost and currency', JSON.stringify(v.holdings));
    check(v.cash === 7500, 'and the cash follows', String(v.cash));

    /* ── re-averaging. Shares bought in between at a different price, then the
       sale undone: the returning shares carry their OWN cost, so the position
       blends. 300 at 133.3333 + 100 back at 100 = 400 at exactly 125. */
    await setup(); await sell(100, 150);
    await C.page.evaluate(() => { const h = state.holdings[0];
      h.avg = (h.avg * h.qty + 200 * 100) / (h.qty + 100); h.qty += 100; persist(); render() });
    check((await look()).holdings[0].avg === 133.3333, 'a re-buy at 200 blends the average to 133.3333',
      String((await look()).holdings[0].avg));
    await C.page.evaluate(() => { window.confirm = () => true; deleteSell(state.sells[0].id) });
    v = await look();
    check(v.holdings[0].qty === 400 && v.holdings[0].avg === 125,
      'undoing the sale returns them at their own cost and re-averages to 125', JSON.stringify(v.holdings[0]));
    check(v.cash === 0 && v.sells.length === 0,
      'the proceeds come back out and the record is gone', JSON.stringify({ cash: v.cash, n: v.sells.length }));

    // ── a cancelled confirm does nothing at all ───────────────────────────
    await setup(); await sell(100, 150);
    const beforeCancel = JSON.stringify(await look());
    await C.page.evaluate(() => { window.confirm = () => false; deleteSell(state.sells[0].id) });
    check(JSON.stringify(await look()) === beforeCancel,
      'cancelling the undo changes nothing');

    /* ── a correction that cannot be honoured must write NOTHING. Without the
       "changed nothing" half this passes on a partial write that has already
       moved the cash. */
    const beforeBad = JSON.stringify(await look());
    await C.page.evaluate(() => { editSell(state.sells[0].id);
      document.getElementById('sellQty').value = '9999'; confirmSell() });
    check(JSON.stringify(await look()) === beforeBad,
      'selling more than is held is refused, and leaves holding, cash and record untouched');
    check(await C.page.evaluate(() => document.getElementById('sellModal').classList.contains('open')),
      'and the dialog stays open so the figure can be fixed');
    await C.page.evaluate(() => closeSell());

    // ── overdrawing is allowed, because the money may have moved on ───────
    await setup(); await sell(100, 150);
    await C.page.evaluate(() => { state.cash.TFSA = 0; persist() });   // proceeds spent
    await C.page.evaluate(() => { window.confirm = () => true; deleteSell(state.sells[0].id) });
    check((await look()).cash === -15000,
      'undoing a sale whose proceeds were spent takes the balance negative rather than refusing',
      String((await look()).cash));

    /* ── the panel shows a WINDOW, not the whole ledger ──────────────────
       Thirty days to today by default, because a sell ledger only grows. */
    await setup(); await sell(100, 150);
    await C.page.evaluate(() => {
      // one sale today, one well outside the default window
      state.sells.push({ id: 'old', t: Date.now() - 120 * 864e5, sym: 'OLD', acct: 'TFSA',
        qty: 1, price: 2, avg: 1, ccy: 'USD' });
      persist(); render();
    });
    await C.page.waitForTimeout(200);
    const dflt = await C.page.evaluate(() => ({
      rows: document.querySelectorAll('#sellBody tr').length,
      from: document.getElementById('sellFrom').value,
      to: document.getElementById('sellTo').value,
      stored: state.sells.length,
    }));
    check(dflt.rows === 1 && dflt.stored === 2,
      'a sale outside the last 30 days is not listed, but is still stored',
      JSON.stringify(dflt));
    check(/^\d{4}-\d{2}-\d{2}$/.test(dflt.from) && /^\d{4}-\d{2}-\d{2}$/.test(dflt.to),
      'the range boxes are filled in with that window', JSON.stringify(dflt));

    // widening the range brings it back
    await C.page.evaluate(() => {
      document.getElementById('sellFrom').value = '2000-01-01';
      document.getElementById('sellSearch').click();
    });
    await C.page.waitForTimeout(200);
    check(await C.page.evaluate(() => document.querySelectorAll('#sellBody tr').length) === 2,
      'widening the From date brings the older sale back');

    /* A range typed backwards is a slip, not a request for nothing. */
    await C.page.evaluate(() => {
      document.getElementById('sellFrom').value = '2030-01-01';
      document.getElementById('sellTo').value = '2000-01-01';
      document.getElementById('sellSearch').click();
    });
    await C.page.waitForTimeout(200);
    check(await C.page.evaluate(() =>
      document.getElementById('sellFrom').value < document.getElementById('sellTo').value &&
      document.querySelectorAll('#sellBody tr').length === 2),
      'a backwards range is swapped rather than showing an empty table');

    /* Two different nothings: never sold anything, and nothing in these dates. */
    await C.page.evaluate(() => {
      document.getElementById('sellFrom').value = '2001-01-01';
      document.getElementById('sellTo').value = '2001-12-31';
      document.getElementById('sellSearch').click();
    });
    await C.page.waitForTimeout(200);
    check(await C.page.evaluate(() => {
      const none = document.getElementById('sellNone'), empty = document.getElementById('sellEmpty');
      return getComputedStyle(none).display !== 'none' && getComputedStyle(empty).display === 'none';
    }), 'an empty window says so, rather than claiming nothing was ever sold');

    // ── the two counting tiles are gone ───────────────────────────────────
    await C.page.evaluate(() => {
      document.getElementById('sellFrom').value = '2000-01-01';
      document.getElementById('sellTo').value = '2100-01-01';
      document.getElementById('sellSearch').click();
    });
    await C.page.waitForTimeout(200);
    const keys = await C.page.evaluate(() =>
      [...document.querySelectorAll('#sellSum > div .k')].map(k => k.textContent.trim()));
    check(keys.length === 2 && !keys.some(k => /Sells|Winners/.test(k)),
      'only Realised P/L and Return on cost remain', JSON.stringify(keys));

    // ── the buttons are actually on the rows ──────────────────────────────
    await setup(); await sell(100, 150);
    check(await C.page.evaluate(() =>
      document.querySelectorAll('#sellBody [data-edit]').length === 1 &&
      document.querySelectorAll('#sellBody [data-del]').length === 1),
      'each row carries a correct and an undo button');
    await C.page.click('#sellBody [data-edit]');
    await C.page.waitForTimeout(150);
    check(await C.page.evaluate(() => {
      const m = document.getElementById('sellModal');
      return m.classList.contains('open') &&
        /Correct the AAPL sale/.test(document.getElementById('sellTitle').textContent) &&
        getComputedStyle(document.getElementById('sellEffectRow')).display !== 'none';
    }), 'the pencil opens the dialog in correction mode, with the effect row shown');
    /* The sell path and the correction path share one dialog, so the mode has
       to reset -- otherwise the next ordinary sale runs the correction branch. */
    await C.page.evaluate(() => closeSell());
    await C.page.click('#hbody .rm.sell'); await C.page.waitForTimeout(150);
    check(await C.page.evaluate(() =>
      /^Sell /.test(document.getElementById('sellTitle').textContent) &&
      getComputedStyle(document.getElementById('sellEffectRow')).display === 'none'),
      'and closing it returns the dialog to plain selling');
    await C.page.evaluate(() => closeSell());

    check(C.errs.length === 0, 'no page errors from correcting a sale', C.errs.join(' | '));
    await C.ctx.close();
  }

  /* ── LAYOUT FAULTS FROM THE LAST PASS ────────────────────────────────────── */
  {
    const F = await open(browser, url, Object.assign({}, SEED, {
      'sparta.notes': JSON.stringify({ points: [], text: '', stocks: ['NVDA'] }) }));
    await F.page.setViewportSize({ width: 1360, height: 1000 });
    await F.page.waitForTimeout(400);
    const cols = () => F.page.evaluate(() =>
      getComputedStyle(document.getElementById('dashView')).gridTemplateColumns);
    const before = await cols();
    /* A long company name used to drag the whole page out of shape -- 684/428
       became 572/561 -- because `1fr` is `minmax(auto,1fr)` and that auto floor
       is the min-content width. The ellipsis caps the drawn text, not the floor. */
    await F.page.evaluate(() => {
      npQuotes['AAOI'] = { state: 'ok', ccy: 'USD', price: 12.3, chg: 1.2,
        name: 'Applied Optoelectronics Incorporated Holdings Limited Worldwide' };
      state.notes.stocks = ['AAOI']; npOpen.add('AAOI'); renderStocks(); dashLayout();
    });
    await F.page.waitForTimeout(400);
    check(await cols() === before,
      'a long watched name does not move the columns', `${before} -> ${await cols()}`);

    await F.page.evaluate(() => {
      state.holdings = [
        { id: 'g1', sym: 'GOOGL', acct: 'TFSA', qty: 1, avg: 100, ccy: 'USD', price: 100, manual: true, broker: 'Q' },
        { id: 'g2', sym: 'AAPL', acct: 'TFSA', qty: 1, avg: 40, ccy: 'USD', price: 40, manual: true }];
      persist(); render();
    });
    for (const w of [1360, 900, 560, 390, 320]) {
      await F.page.setViewportSize({ width: w, height: 900 });
      await F.page.waitForTimeout(300);
      const r = await F.page.evaluate(() => {
        const row = s => [...document.querySelectorAll('#hbody tr')].find(x => new RegExp(s).test(x.textContent));
        const m = r => { const td = r.querySelector('td'), sym = r.querySelector('.sym'),
          q = r.querySelector('.qlink'), bk = r.querySelector('.bk');
          const t = td.getBoundingClientRect(), y = sym.getBoundingClientRect(),
                qr = q.getBoundingClientRect(), k = bk.getBoundingClientRect();
          return { text: Math.round(y.left - t.left), q: Math.round(k.left - t.left),
                   wrapped: qr.top > y.top + 16,
                   topDelta: Math.round(k.top - y.top),
                   clipped: k.left < td.closest('.tscroll').getBoundingClientRect().left - 0.5 } };
        const g = row('GOOGL');
        const bk = g.querySelector('.bk'), sym = g.querySelector('.sym');
        return { marked: m(g), blank: m(row('AAPL')),
          gap: Math.round(sym.getBoundingClientRect().left - bk.getBoundingClientRect().right),
          linkGap: parseFloat(getComputedStyle(g.querySelector('.qlink')).marginLeft) };
      });
      check(!r.marked.wrapped && !r.blank.wrapped,
        `${w}px: the ↗ stays on the ticker's line`, JSON.stringify(r));
      /* The mark used to be inline, so it pushed every symbol right. Out of the
         flow, a marked row and an unmarked one start at the same place. */
      check(r.marked.text === r.blank.text,
        `${w}px: a marked row's ticker starts where an unmarked one does`,
        `${r.marked.text} / ${r.blank.text}`);
      check(r.marked.q < r.marked.text && !r.marked.clipped,
        `${w}px: and the mark sits left of it, in the gutter, not clipped by the scroller`,
        JSON.stringify({ q: r.marked.q, clipped: r.marked.clipped }));
      /* Read the arrow's own margin rather than hardcoding 6, so the two sides
         of the ticker cannot drift apart without this noticing. */
      check(r.gap === r.linkGap,
        `${w}px: the mark is spaced off the ticker exactly as the ↗ is`,
        JSON.stringify({ mark: r.gap, link: r.linkGap }));
      /* A table cell is vertically centred by default, so offsetting the mark
         from the CELL dropped it 9px below the ticker the moment another cell
         in the row was taller. It is anchored to the ticker instead. */
      check(r.marked.topDelta === 0,
        `${w}px: and it lines up with the ticker, not the middle of the cell`,
        String(r.marked.topDelta));
    }
    await F.page.setViewportSize({ width: 1360, height: 1000 });
    check(F.errs.length === 0, 'no page errors from the layout fixes', F.errs.join(' | '));
    await F.ctx.close();
  }

  /* ── EYE ON STOCKS ───────────────────────────────────────────────────────
     Three Finnhub endpoints per symbol, fetched once when a row is opened. The
     half that matters is what happens when there is nothing to fetch: for a
     Canadian portfolio the free tier returns nothing for .TO, so the no-data
     path is the ORDINARY one and has to read as deliberate. */
  {
    const E = await open(browser, url, Object.assign({}, SEED, {
      'sparta.notes': JSON.stringify({ points: [], text: '', stocks: ['NVDA', 'SHOP.TO'] }) }));
    let calls = 0;
    await E.page.route('**finnhub.io/**', r => {
      calls++;
      const u = r.request().url();
      if (/\/quote\?/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(/SHOP/.test(u) ? { c: 0 } : { c: 905.2, dp: 2.41, h: 912.75, l: 889.1, pc: 883.9 }) });
      if (/profile2/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ name: 'NVIDIA Corporation', currency: 'USD', marketCapitalization: 2230000 }) });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ metric: { '52WeekHigh': 974, '52WeekLow': 392.3, peTTM: 64.8, beta: 1.74 } }) });
    });
    await E.page.evaluate(() => { state.apiKey = 'test-key' });

    check(calls === 0, 'nothing is fetched until a row is opened — the free tier is 60/min');
    check(await E.page.evaluate(() => document.querySelectorAll('#npStocks .np-stock').length) === 2,
      'one row per watched stock');

    await E.page.click('#npStocks .np-stock[data-s="NVDA"] [data-act="toggle"]');
    await E.page.waitForFunction(() => !!document.querySelector('.np-stock[data-s="NVDA"] .np-stgrid'));
    const after1 = calls;
    check(after1 === 3, 'opening a row fetches quote, profile and metrics — three calls', String(after1));
    const body = await E.page.evaluate(() => {
      const r = document.querySelector('.np-stock[data-s="NVDA"]');
      return { head: r.querySelector('.np-stpx').textContent.replace(/\s+/g, ' ').trim(),
        cells: [...r.querySelectorAll('.np-stcell')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
        dot: !!r.querySelector('.np-rdot') };
    });
    check(/\$905\.20/.test(body.head), 'the price shows in the stock\'s own currency', body.head);
    check(body.dot, 'the 52-week bar is drawn when a range is published');
    check(body.cells.some(c => /P\/E/.test(c) && /64\.8/.test(c)), 'metrics are listed', JSON.stringify(body.cells));

    // collapse and re-open: the figures are cached for the session
    await E.page.click('#npStocks .np-stock[data-s="NVDA"] [data-act="toggle"]');
    await E.page.waitForTimeout(120);
    await E.page.click('#npStocks .np-stock[data-s="NVDA"] [data-act="toggle"]');
    await E.page.waitForTimeout(400);
    check(calls === after1, 're-opening does not fetch again', `${after1} -> ${calls}`);

    // c:0 is Finnhub saying it has no such symbol, not a price of zero
    await E.page.click('#npStocks .np-stock[data-s="SHOP.TO"] [data-act="toggle"]');
    /* .np-stmsg is also the "Loading…" placeholder, so waiting for the element
       alone wins the race against the fetch and reads the wrong text. */
    await E.page.waitForFunction(() => {
      const e = document.querySelector('.np-stock[data-s="SHOP.TO"] .np-stmsg');
      return !!e && !/Loading/.test(e.textContent);
    });
    const msg = await E.page.evaluate(() =>
      document.querySelector('.np-stock[data-s="SHOP.TO"] .np-stmsg').textContent.replace(/\s+/g, ' ').trim());
    check(/does not cover Canadian listings/i.test(msg),
      'a .TO symbol says why there is nothing, rather than looking broken', msg);

    // reading a watchlist must never make this browser look edited
    const stamp = await E.page.evaluate(() => localStorage.getItem(nsKey('sparta.updatedAt')));
    await E.page.waitForTimeout(300);
    check(await E.page.evaluate(() => localStorage.getItem(nsKey('sparta.updatedAt'))) === stamp,
      'expanding a stock does not re-stamp updatedAt — it is a read');

    check(E.errs.length === 0, 'no page errors from Eye on Stocks', E.errs.join(' | '));
    await E.ctx.close();
  }

  /* ── PAST SELLS FITS ITS COLUMN ──────────────────────────────────────────
     It lives in the narrow right column and carries five columns of figures,
     so it is measured against the worst case it will really meet: a four-digit
     quantity, a four-figure amount and a percentage. A sideways scrollbar under
     three short rows reads as something being cut off. */
  {
    const W = await open(browser, url);
    await W.page.evaluate(() => {
      const now = Date.now();
      state.sells = [
        { id: 'a', t: now - 2 * 864e5, sym: 'AAOX', acct: 'FHSA', qty: 8888, price: 2.3249, avg: 1.2, ccy: 'USD' },
        { id: 'b', t: now - 3 * 864e5, sym: 'ENB.TO', acct: 'Other', qty: 1234, price: 60, avg: 50, ccy: 'CAD' }];
      persist(); render();
    });
    await W.page.waitForTimeout(300);
    const money = await W.page.evaluate(() => {
      const td = document.querySelectorAll('#sellBody tr td')[3].cloneNode(true);
      td.querySelectorAll('.sl-sub').forEach(x => x.remove());
      return td.textContent.trim();
    });
    check(/^\+\$9,9\d\d\.\d\d$/.test(money), 'the worst case really is a four-figure amount', money);

    for (const w of [1440, 1280, 1024, 900, 560, 430, 390, 320]) {
      await W.page.setViewportSize({ width: w, height: 1100 });
      await W.page.waitForTimeout(300);
      const r = await W.page.evaluate(() => {
        const p = document.getElementById('sellsPanel'), sc = p.querySelector('.tscroll');
        const small = p.querySelector('.sym small');
        const th = [...p.querySelectorAll('thead th')];
        const pc = p.querySelector('td.pc'), sub = p.querySelector('.sl-sub');
        const act = p.querySelector('.sl-act');
        const d = p.querySelector('.sl-d'), y = p.querySelector('.sl-y');
        return {
          over: Math.round(sc.scrollWidth - sc.clientWidth),
          smallLines: small.getClientRects().length,
          headerLines: Math.max(...th.map(t => t.getClientRects().length)),
          pctShown: getComputedStyle(pc).display !== 'none',
          subShown: getComputedStyle(sub).display !== 'none',
          stacked: act.getBoundingClientRect().height > 36,
          dateOverYear: y.getBoundingClientRect().top > d.getBoundingClientRect().top + 4,
        };
      });
      check(r.over === 0, `${w}px: no sideways scroll`, `${r.over}px`);
      /* "FHSA - 8888" used to wrap under the ticker and cost a third row. */
      check(r.smallLines === 1, `${w}px: the account and quantity stay on one line`, String(r.smallLines));
      check(r.headerLines === 1, `${w}px: "% profit" is on one line`, String(r.headerLines));
      check(r.stacked, `${w}px: correct and undo are stacked, not side by side`);
      check(r.dateOverYear, `${w}px: the day and month sit above the year`);
      /* Exactly one of the two is showing -- at phone width the percentage
         column folds under the amount, the way the holdings table does. */
      check(r.pctShown !== r.subShown,
        `${w}px: the percentage shows once, in its column or under the amount`,
        JSON.stringify({ col: r.pctShown, sub: r.subShown }));
    }
    await W.page.setViewportSize({ width: 1360, height: 1000 });
    check(W.errs.length === 0, 'no page errors from Past sells at any width', W.errs.join(' | '));
    await W.ctx.close();
  }

  /* ── A NOTE WRAPS AND THE ROW GROWS ──────────────────────────────────────
     A long point used to run past the right edge and the rest was invisible. */
  {
    const N = await open(browser, url, Object.assign({}, SEED, {
      'sparta.notes': JSON.stringify({ points: [
        { id: 'p1', text: 'This is a deliberately long note that should wrap onto several lines '
          + 'instead of running off the right edge and vanishing the way it used to.' },
        { id: 'p2', text: 'Short' }], text: '', stocks: [] }) }));
    await N.page.setViewportSize({ width: 1280, height: 1200 });
    await N.page.waitForTimeout(500);
    const look = () => N.page.evaluate(() => [...document.querySelectorAll('#npPoints textarea')]
      .map(t => ({ h: Math.round(t.getBoundingClientRect().height),
                   clipped: t.scrollHeight > t.clientHeight + 1 })));
    let v = await look();
    check(v[0].h > v[1].h + 20, 'the long point is taller than the short one', JSON.stringify(v));
    /* scrollHeight counts padding but not the border, so a height set naively
       from it leaves the last line's descenders clipped. */
    check(v.every(x => !x.clipped), 'and nothing is cut off at the bottom', JSON.stringify(v));

    await N.page.click('#npPoints textarea');
    await N.page.keyboard.press('End');
    await N.page.keyboard.type(' And more typed live to push it onto a further line entirely.');
    await N.page.waitForTimeout(400);
    const grown = await look();
    check(grown[0].h > v[0].h, 'it grows as it is typed, not only on render',
      `${v[0].h} -> ${grown[0].h}`);

    /* Enter still starts the next point rather than inserting a newline -- a
       textarea would do the latter by default. */
    const before = await N.page.evaluate(() => state.notes.points.length);
    await N.page.keyboard.press('Enter');
    await N.page.waitForTimeout(200);
    check(await N.page.evaluate(() => state.notes.points.length) === before + 1,
      'Enter still adds the next point instead of a line break');
    check(!(await N.page.evaluate(() => state.notes.points[0].text)).includes('\n'),
      'and no newline was left in the point it was pressed in');

    /* A hidden tab measures 0, so the heights have to be taken again when it
       comes back or every row collapses (bug class 14). */
    await N.page.evaluate(() => applyView('contrib')); await N.page.waitForTimeout(300);
    await N.page.evaluate(() => applyView('dash')); await N.page.waitForTimeout(500);
    const back = await look();
    check(back[0].h === grown[0].h && !back[0].clipped,
      'the heights survive a trip to Contributions and back', JSON.stringify(back));

    check(N.errs.length === 0, 'no page errors from the notepad', N.errs.join(' | '));
    await N.ctx.close();
  }

  /* ── EACH PANEL KEEPS ITS SIDE ───────────────────────────────────────────
     This replaces a section that asserted the two columns were within a panel
     of each other -- the opposite of what is now wanted. Panels are assigned to
     a fixed column and only move up and down inside it. The cost is known and
     accepted: with Past sells on the right the right column runs ~950px past the
     left at 1280px, so balance is deliberately NOT checked here. */
  {
    const L = await open(browser, url, Object.assign({}, SEED, {
      'sparta.notes': JSON.stringify({ points: [{ id: 'p', text: 'Hold' }], text: '', stocks: ['NVDA'] }) }));
    const LEFT = 'heroCard,holdingsCard,eyePanel';
    const RIGHT = 'statRow,cashCard,addCard,sellsPanel,notepadPanel,importCard';
    const cols = () => L.page.evaluate(() => [...document.querySelectorAll('#dashView > .col')]
      .map(c => [...c.children].map(e => e.id || e.className.split(' ')[0]).join(',')));

    for (const w of [1440, 1280, 1024, 900, 390]) {
      await L.page.setViewportSize({ width: w, height: 1000 });
      await L.page.waitForTimeout(350);
      const c = await cols();
      check(c[0] === LEFT && c[1] === RIGHT,
        `${w}px: every panel is in its own column, in order`, JSON.stringify(c));
    }

    /* The whole point: growing a panel must not move anything. Under the old
       height-balancing this reshuffled, so it fails against that build. */
    await L.page.setViewportSize({ width: 1280, height: 1000 });
    await L.page.waitForTimeout(300);
    const before = JSON.stringify(await cols());
    await L.page.evaluate(() => {
      state.sells = Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, t: Date.now() - i * 9e7,
        sym: 'NVDA', acct: 'TFSA', qty: 4, price: 905, avg: 775, ccy: 'USD' }));
      npQuotes['NVDA'] = { state: 'ok', name: 'NVIDIA', ccy: 'USD', price: 900, chg: 1,
        lo: 300, hi: 1000, pe: 60 };
      npOpen.add('NVDA');
      state.notes.points.push({ id: 'x', text: 'another' }, { id: 'y', text: 'more' });
      persist(); render(); renderNotes(); renderStocks();
    });
    await L.page.waitForTimeout(700);
    check(JSON.stringify(await cols()) === before,
      'growing Past sells, Eye on Stocks and Notes moves nothing between columns',
      JSON.stringify(await cols()));

    /* Nothing depends on a height now, so a repeat layout must touch no DOM at
       all -- which is what keeps a typed caret alive. */
    const moves = await L.page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('#dashView > .col').forEach(c => {
        const o = c.insertBefore.bind(c); c.insertBefore = (...a) => { n++; return o(...a) };
      });
      dashLayout(); dashLayout(); return n;
    });
    check(moves === 0, 'running the layout again moves no node', String(moves));

    await L.page.evaluate(() => applyView('contrib')); await L.page.waitForTimeout(250);
    await L.page.evaluate(() => applyView('dash')); await L.page.waitForTimeout(400);
    const after = await cols();
    check(after[1] === RIGHT,
      'the notepad comes back from Contributions into the right column, in place',
      JSON.stringify(after));

    await L.page.click('#npAdd'); await L.page.waitForTimeout(150);
    await L.page.keyboard.type('still typing');
    await L.page.waitForTimeout(500);
    /* The ADDED row, not the first one -- this seed already has a point, so
       npAdd appends and the typing lands in the second input. */
    check(await L.page.evaluate(() => {
      const a = document.activeElement;
      return !!a.closest('#npPoints .np-row') && a.value === 'still typing';
    }), 'and a note can still be typed without losing the caret');

    await L.page.setViewportSize({ width: 1360, height: 1000 });
    check(L.errs.length === 0, 'no page errors from the layout', L.errs.join(' | '));
    await L.ctx.close();
  }


  await browser.close(); srv.close();
  console.log(`\nUI: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
