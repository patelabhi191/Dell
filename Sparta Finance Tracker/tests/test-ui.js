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

  /* ── FOUR ACCOUNT CARDS ──────────────────────────────────────────────────
     Other used to span both columns, which made it read as a different kind of
     thing rather than the third account. With a fourth card beside it the row
     is a plain 2x2 and every account is the same shape. */
  {
    const V = await open(browser, url);
    await V.page.setViewportSize({ width: 1280, height: 1100 });
    await V.page.waitForTimeout(400);
    const look = () => V.page.evaluate(() => {
      const r = document.getElementById('statRow');
      const shown = [...r.children].filter(c => getComputedStyle(c).display !== 'none');
      return { ids: shown.map(c => c.id || 'acct'),
        widths: shown.map(c => Math.round(c.getBoundingClientRect().width)),
        rows: new Set(shown.map(c => Math.round(c.getBoundingClientRect().y))).size,
        over: r.scrollWidth - r.clientWidth };
    });
    let v = await look();
    check(v.ids.length === 4 && v.ids.includes('pooCard'),
      'there are four cards, including the new one', JSON.stringify(v.ids));
    check(new Set(v.widths).size === 1,
      'all four are the same width — Other no longer spans the row', JSON.stringify(v.widths));
    check(v.rows === 2 && v.over === 0, 'they sit two by two with no overflow', JSON.stringify(v));

    /* It is a placeholder, not an account: nothing may write to it, it is in no
       total, and the account filter does not know about it. */
    const hero0 = await V.page.evaluate(() => document.getElementById('heroValue').textContent);
    check(await V.page.evaluate(() => document.getElementById('pooVal').textContent) === 'C$0.00',
      'it reads zero, formatted like the others rather than a bare 0');
    check(await V.page.evaluate(() => !('POO' in state.cash) && !state.holdings.some(h => h.acct === 'POO')),
      'and it is not an account in state');
    await V.page.evaluate(() => { state.ccy = 'USD'; render() });
    await V.page.waitForTimeout(200);
    check(await V.page.evaluate(() => document.getElementById('pooVal').textContent) === '$0.00',
      'but it still follows the USD/CAD switch');
    check(await V.page.evaluate(() => document.getElementById('heroValue').textContent) !== hero0,
      'the switch really was thrown', hero0);
    await V.page.evaluate(() => { state.ccy = 'CAD'; render() });

    // Other still hides itself when nothing is in it, leaving three
    await V.page.evaluate(() => {
      state.holdings = state.holdings.filter(h => h.acct !== 'Other');
      state.cash.Other = 0; persist(); render();
    });
    await V.page.waitForTimeout(250);
    v = await look();
    check(!v.ids.includes('otherCard') && v.ids.includes('pooCard'),
      'an unused Other still hides itself, and the placeholder stays', JSON.stringify(v.ids));

    for (const w of [1024, 560, 390]) {
      await V.page.setViewportSize({ width: w, height: 1100 });
      await V.page.waitForTimeout(250);
      const r = await look();
      check(r.over === 0 && new Set(r.widths).size === 1,
        `${w}px: still even, still no overflow`, JSON.stringify(r.widths));
    }
    await V.page.setViewportSize({ width: 1360, height: 1000 });
    check(V.errs.length === 0, 'no page errors from the account cards', V.errs.join(' | '));
    await V.ctx.close();
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
    /* Four figures used to print in full. Past 9,999 the amount is a K now, so
       what this pins is that the cell holds the SHORT form and not a truncated
       long one. */
    check(/^\+\$9,9\d\d\.\d\d$|^\+\$\d+(\.\d)?K$/.test(money),
      'a four-figure amount is exact, a five-figure one is a K', money);

    /* There used to be an assertion here that short and long content gave
       IDENTICAL column widths. It encoded the fixed-proportion layout, and under
       a content-sized table it is false by design -- the columns are SUPPOSED to
       follow the content. It also passed three times over while the thing on
       screen got worse, because a column's width says nothing about the gap the
       eye actually sees. The property wanted is measured below instead: the
       distance between the rendered TEXT of adjacent columns, evenly spread. */
    await W.page.setViewportSize({ width: 1280, height: 1100 });
    await W.page.waitForTimeout(300);
    check(await W.page.evaluate(() =>
      document.querySelectorAll('#sellTable thead th')[2].textContent.trim()) === 'Profit',
      'the header is "Profit" — the values already carry the % sign');

    // back to the worst case for the sweep
    await W.page.evaluate(() => {
      const now = Date.now();
      state.sells = [
        { id: 'a', t: now - 2 * 864e5, sym: 'BRK.B', acct: 'TFSA', qty: 12345, price: 9.9, avg: 0.5, ccy: 'CAD' },
        { id: 'b', t: now - 3 * 864e5, sym: 'AAOX', acct: 'FHSA', qty: 5, price: 2.3, avg: 1.48, ccy: 'USD' }];
      persist(); render();
    });
    await W.page.waitForTimeout(300);

    for (const w of [1440, 1280, 1024, 900, 560, 430, 390, 320]) {
      await W.page.setViewportSize({ width: w, height: 1100 });
      await W.page.waitForTimeout(300);
      const fit = await W.page.evaluate(() => {
        const p = document.getElementById('sellsPanel');
        /* Real overflow only. A probe measuring a cell's whole textContent
           joins the ticker and its sub-line into one string and reports ~56px
           of overflow that is not there. */
        const bad = [];
        p.querySelectorAll('tbody td, thead th').forEach(td => {
          if (getComputedStyle(td).display === 'none') return;
          if (td.scrollWidth > td.clientWidth + 1) bad.push([td.className || '-', td.scrollWidth - td.clientWidth]);
        });
        const amt = p.querySelector('td.pl');
        const r = document.createRange(); r.selectNode(amt.childNodes[0]);
        return { bad, amtLines: r.getClientRects().length,
          cols: [...p.querySelectorAll('#sellBody tr:first-child td')]
            .filter(t => getComputedStyle(t).display !== 'none').map(t => t.clientWidth) };
      });
      check(fit.bad.length === 0, `${w}px: no cell overflows its column`, JSON.stringify(fit.bad));
      /* Hiding the percentage CELLS at phone width without removing the <col>
         shifted every remaining cell onto the wrong column: the amount
         inherited width:0 and the two buttons were handed 38%. */
      check(fit.amtLines === 1 && fit.cols.every(c => c > 20),
        `${w}px: the amount stays on one line and no column collapses`,
        JSON.stringify(fit));
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
    /* ── sized for figures that will actually occur ──────────────────────
       The first attempt sized the columns for +1234.56% and a six-figure
       amount, neither of which will appear, so the Profit column held slack and
       the gap beside the ticker got worse. The stated worst cases are
       +999.99% (three digits plus the sign) and seven digits of value. */
    await W.page.setViewportSize({ width: 1280, height: 1100 });
    await W.page.waitForTimeout(300);
    await W.page.evaluate(() => {
      state.sells = [{ id: 'w', t: Date.now() - 864e5, sym: 'ENB.TO', acct: 'FHSA',
        qty: 8888, price: 200.5, avg: 18.23, ccy: 'CAD' }];     // +999.99%, seven figures
      persist(); render();
    });
    await W.page.waitForTimeout(300);
    const worst = await W.page.evaluate(() => {
      const td = document.querySelector('#sellBody td.pc');
      return { pct: td.textContent.trim(),
        amt: document.querySelector('#sellBody td.pl').childNodes[0].textContent.trim() };
    });
    check(/^\+9\d\d\.\d\d%$/.test(worst.pct), 'the worst case really is a three-digit percentage', worst.pct);
    /* Seven figures do not fit at any desktop width, so past a million the
       amount is shortened the way Eye on Stocks shortens market cap. */
    check(/^\+C\$\d\.\d\dM$/.test(worst.amt), 'and a seven-figure amount is shortened', worst.amt);

    /* The whole ladder, both sides of every boundary. A test that only tried
       5,000,000 would pass against a threshold set anywhere below it. */
    const bound = await W.page.evaluate(() => {
      const f = (v, c) => sellAmt(v, c || 'USD');
      return { u9999: f(9999.99), k10: f(10000), k104: f(10400), k1045: f(10450),
               k100: f(99999), k116: f(116043), m1: f(999999), m1e6: f(1000000),
               m162: f(1620000), neg: f(-10400, 'CAD'), negM: f(-2500000, 'CAD') };
    });
    check(bound.u9999 === '+$9,999.99', 'up to 9,999.99 stays exact to the cent', bound.u9999);
    check(bound.k10 === '+$10K', '10,000 reads 10K — no trailing .0', bound.k10);
    check(bound.k104 === '+$10.4K', '10,400 reads 10.4K', bound.k104);
    check(bound.k1045 === '+$10.4K', 'and 10,450 still rounds to one decimal', bound.k1045);
    check(bound.k100 === '+$100K' && bound.k116 === '+$116K',
      'six figures lose the decimal when it rounds away', `${bound.k100} ${bound.k116}`);
    /* 999,999 is the trap: (999999/1e3).toFixed(1) is "1000.0", so a naive K
       ladder prints +$1000K one pound short of +$1.00M. The M branch starts at
       999,950 for exactly that reason. */
    check(bound.m1 === '+$1.00M', '999,999 reads 1.00M, not 1000K', bound.m1);
    check(bound.m1e6 === '+$1.00M' && bound.m162 === '+$1.62M',
      'and a million and up is an M', `${bound.m1e6} ${bound.m162}`);
    check(bound.neg === '−C$10.4K' && bound.negM === '−C$2.50M',
      'a shortened loss keeps its sign and its currency', `${bound.neg} ${bound.negM}`);

    /* Typical figures must not leave the Profit column holding slack -- that is
       the complaint. Under a content-sized table the column follows what is IN
       it, so the probe reads the cell's own rendered text rather than the
       worst case it could ever hold: sizing for +999.99% when +55.53% is on
       screen is exactly the slack that was being complained about. */
    await W.page.evaluate(() => {
      state.sells = [{ id: 't', t: Date.now() - 864e5, sym: 'AAOX', acct: 'FHSA',
        qty: 60, price: 8.6, avg: 5.53, ccy: 'USD' }];
      persist(); render();
    });
    await W.page.waitForTimeout(300);
    const slack = await W.page.evaluate(() => {
      const td = document.querySelector('#sellBody td.pc');
      /* A Range over the cell's own text node, NOT a probe span. A probe built
         from getComputedStyle(td).font measured "+55.52%" at 64px against the
         54px it really renders at -- the shorthand does not carry everything
         that is set on this cell -- which made the check pass by over-stating
         what the column needed. Measure the ink that is on screen. */
      const r = document.createRange(); r.selectNodeContents(td);
      const ink = r.getBoundingClientRect().width;
      const cs = getComputedStyle(td);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      return { text: td.textContent.trim(), col: td.clientWidth,
               need: Math.ceil(ink + pad) };
    });
    /* This used to assert the Profit column was its content plus a few px. The
       table is a FIXED five-slot grid now -- 20/20/25/25/10 -- so the column is
       a quarter of the panel whatever is in it, and being wider than its content
       is the point rather than a fault. What still has to hold is the other
       direction: the slot must be big enough, i.e. the content must not be
       clipped by it. */
    check(slack.col >= slack.need,
      'the Profit slot is at least as wide as what is in it', JSON.stringify(slack));

    /* ── FLUSH WITH THE PANEL, AND EVEN WHERE IT COUNTS ──────────────────
       Two properties, and the first is the one that was got wrong twice.

       A content-sized table centred in the panel evened the gaps perfectly, but
       it floated with margin either side while the summary tiles, the date row
       and the footnote all ran edge to edge -- so it read as a separate thing
       dropped into the panel rather than part of it. .htable gives every other
       table in the app width:100%, and this one now takes it too.

       What made the gap uneven was never the width, it was where the surplus
       went: with Date and Ticker left-aligned against two right-aligned figures,
       the slack from both sides piles into the single boundary between them.
       Sending it to the trailing actions column instead keeps it out of the
       figures entirely -- that column's extra width is the margin before the
       row's buttons, which the holdings table already carries at 56px. */
    const geom = () => W.page.evaluate(() => {
      const ink = el => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n, best = null;
        while ((n = w.nextNode())) {
          if (!n.nodeValue.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          const q = r.getClientRects()[0];
          if (!q) continue;
          if (!best) best = { l: q.left, r: q.right, top: q.top };
          else if (Math.abs(q.top - best.top) < 4) {
            best.l = Math.min(best.l, q.left); best.r = Math.max(best.r, q.right);
          }
        }
        return best;
      };
      const run = sel => [...document.querySelectorAll(sel)]
        .filter(c => getComputedStyle(c).display !== 'none').map(ink).filter(Boolean);
      const sp = c => c.slice(1).map((x, i) => Math.round(x.l - c[i].r));
      const R = e => e.getBoundingClientRect();
      const panel = document.getElementById('sellsPanel');
      const pcs = getComputedStyle(panel), prr = R(panel);
      const pl = prr.left + parseFloat(pcs.paddingLeft);
      const pw = (prr.right - parseFloat(pcs.paddingRight)) - pl;
      const tbl = R(document.getElementById('sellTable'));
      /* The panel's other full-width children are the yardstick -- comparing the
         table against the PANEL would pass on a table that merely happened to be
         as wide as the padding box. */
      const tiles = R(document.getElementById('sellSum'));
      const note = R(document.getElementById('sellNote2'));
      const act = document.querySelector('#sellBody tr:first-child .sl-act');
      const cell = act && act.closest('td');
      const cs = cell && getComputedStyle(cell);
      return {
        head: sp(run('#sellTable thead th')),
        edgeL: Math.round(tbl.left - tiles.left), edgeR: Math.round(tiles.right - tbl.right),
        noteL: Math.round(tbl.left - note.left), noteR: Math.round(note.right - tbl.right),
        /* the buttons must hug the right edge however wide that column gets:
           a block-level flex fills the cell and centres them instead */
        actGap: cell ? Math.round(R(cell).right - parseFloat(cs.paddingRight) - R(act).right) : null,
        /* the five-slot grid: every column's text must START on its slot edge */
        panelW: Math.round(pw),
        starts: run('#sellTable thead th').map(i => Math.round(i.l - pl)),
        actLeft: act ? Math.round(R(act).left - pl) : null,
        actBox: act ? [Math.round(R(act.querySelector('.rm')).width),
                       Math.round(R(act.querySelector('.rm')).height)] : null,
      };
    });
    const SEEDS = {
      typical: [{ id: 't', t: Date.now() - 864e5, sym: 'AAOX', acct: 'FHSA',
        qty: 60, price: 8.6, avg: 5.53, ccy: 'USD' }],              // +55.52%, +$184.20
      worst: [{ id: 'w', t: Date.now() - 864e5, sym: 'ENB.TO', acct: 'FHSA',
        qty: 8888, price: 200.5, avg: 18.23, ccy: 'CAD' }],         // +999.99%, seven figures
      long: [{ id: 'l', t: Date.now() - 864e5, sym: 'BRK.B', acct: 'Other',
        qty: 12345, price: 9.9, avg: 0.5, ccy: 'CAD' }],            // the widest of everything
    };
    for (const [name, rows] of Object.entries(SEEDS)) {
      await W.page.evaluate(r => { state.sells = r; persist(); render() }, rows);
      for (const w of [1440, 1280, 1024, 900, 560, 430, 390, 320]) {
        await W.page.setViewportSize({ width: w, height: 1100 });
        await W.page.waitForTimeout(300);
        const g = await geom();
        /* THE COMPLAINT, as a number. The centred build sits 25-239px inside
           its panel depending on the width, so this fails against it outright. */
        check(Math.abs(g.edgeL) <= 1 && Math.abs(g.edgeR) <= 1,
          `${w}px (${name}): the table runs edge to edge like the tiles above it`,
          JSON.stringify(g));
        check(Math.abs(g.noteL) <= 1 && Math.abs(g.noteR) <= 1,
          `${w}px (${name}): and lines up with the footnote below it`,
          JSON.stringify({ L: g.noteL, R: g.noteR }));
        /* The buttons start on the LAST slot edge, not against the panel's
           right edge. That is the deliberate consequence of left-aligning the
           whole grid: at a wide panel the 10% slot is far more than a glyph
           needs, so they sit inside it. Asserted against the slot rather than
           the panel so the number means something at every width. */
        const lastEdge = Math.round(g.panelW * (g.starts.length >= 4 ? 0.90 : 0.867));
        check(g.actLeft !== null && Math.abs(g.actLeft - lastEdge) <= 3,
          `${w}px (${name}): the row's buttons start on the last slot edge`,
          JSON.stringify({ at: g.actLeft, edge: lastEdge }));
        /* ...and the tap target survives it. The <=560px block sets
           min-width:28px on every .rm; min-width:0 in the slot rule is what
           stops that re-introducing an offset, so the box must still be 28. */
        check(g.actBox && g.actBox[0] >= 26 && g.actBox[1] >= 22,
          `${w}px (${name}): and keep a 28px tap target`, JSON.stringify(g.actBox));
      }
    }

    /* ── THE FIVE SLOTS ──────────────────────────────────────────────────
       20 / 20 / 25 / 25 / 10, chosen by hand. Every column's text starts on its
       slot edge -- 0, 20%, 40%, 65% -- so the panel reads as one ruled grid.
       Equal fifths were tried first and rejected by measurement: a fixed grid
       lets no column borrow from its neighbour, and the widest real row
       overflowed a fifth by 18px.

       Only the unfolded state. Below the container query the percentages
       renormalise over four columns (20/20/25/10 of 75%), which is correct but
       lands on different edges, and pinning both here would just be restating
       the arithmetic. The folded state is covered by the no-clip sweep. */
    for (const [name, rows] of Object.entries(SEEDS)) {
      await W.page.evaluate(r => { state.sells = r; persist(); render() }, rows);
      for (const w of [1440, 1280, 900, 560]) {
        await W.page.setViewportSize({ width: w, height: 1100 });
        await W.page.waitForTimeout(300);
        const g = await geom();
        if (g.starts.length < 4) continue;                 // folded; see above
        const want = [0, 0.20, 0.40, 0.65].map(f => Math.round(g.panelW * f));
        const off = g.starts.map((x, i) => Math.abs(x - want[i]));
        check(Math.max(...off) <= 3,
          `${w}px (${name}): every column starts on its slot edge`,
          JSON.stringify({ at: g.starts, want }));
      }
    }

    /* ── NOTHING CLIPS, NOTHING WRAPS, NOTHING SCROLLS ───────────────────
       The thing actually asked for: "make sure everything is intact and does
       not overlap or push other elements or go to another line." A fixed grid
       is exactly where that can go wrong -- a slot cannot borrow from its
       neighbour, so content that does not fit is clipped rather than
       accommodated, silently. Five money shapes across the K and M boundaries,
       every width, every visible cell. */
    const SHAPES = {
      small: { sym:'AAOX',  acct:'FHSA',  qty:75,    price:8.6,   avg:5.39,  ccy:'USD' },
      k10:   { sym:'NVDA',  acct:'TFSA',  qty:100,   price:150,   avg:50,    ccy:'USD' },
      k104:  { sym:'MSFT',  acct:'TFSA',  qty:100,   price:154,   avg:50,    ccy:'USD' },
      big:   { sym:'BRK.B', acct:'Other', qty:12345, price:9.9,   avg:0.5,   ccy:'CAD' },
      mil:   { sym:'ENB.TO',acct:'FHSA',  qty:8888,  price:200.5, avg:18.23, ccy:'CAD' },
    };
    for (const [sname, row] of Object.entries(SHAPES)) {
      await W.page.evaluate(r => {
        state.sells = [{ ...r, id: 'x', t: Date.now() - 864e5 }]; persist(); render();
      }, row);
      for (const w of [1440, 1280, 1024, 900, 560, 430, 390, 320]) {
        await W.page.setViewportSize({ width: w, height: 1100 });
        await W.page.waitForTimeout(260);
        const f = await W.page.evaluate(() => {
          const p = document.getElementById('sellsPanel');
          const sc = p.querySelector('.tscroll');
          const vis = el => getComputedStyle(el).display !== 'none';
          const clip = [...p.querySelectorAll('tbody tr:first-child td, thead th')]
            .filter(vis).filter(c => c.scrollWidth > c.clientWidth + 1)
            .map(c => (c.className || 'cell') + '+' + (c.scrollWidth - c.clientWidth));
          /* A Range over a text node reports one rect per LINE -- but also one per
             FRAGMENT when an ancestor clips it, and `#sellsPanel .sym small` now
             clips on purpose. Rect count alone cannot tell the two apart and read a
             deliberate ellipsis as a wrap. Distinct line TOPS can: a wrap opens a
             new line box, a clip stays on the one it had. */
          const lines = n => {
            const r = document.createRange(); r.selectNodeContents(n);
            return new Set([...r.getClientRects()].filter(q => q.width)
              .map(q => Math.round(q.top))).size;
          };
          const wrap = [], ell = [];
          p.querySelectorAll('tbody tr:first-child td').forEach(td => {
            if (!vis(td)) return;
            td.childNodes.forEach(n => {
              if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
              const L = lines(n);
              if (L > 1) wrap.push((td.className || 'cell') + ':' + L);
            });
            td.querySelectorAll('small, .sl-sub, .sl-d, .sl-y').forEach(sub => {
              if (!vis(sub)) return;
              const L = lines(sub);
              if (L > 1) wrap.push('sub:' + L);
              // and record how much the ellipsis is hiding, so it stays a trim
              if (sub.scrollWidth - sub.clientWidth > 1)
                ell.push((sub.tagName.toLowerCase()) + '-' + (sub.scrollWidth - sub.clientWidth));
            });
          });
          const amt = p.querySelector('#sellBody td.pl');
          return { clip, wrap, ell, over: Math.round(sc.scrollWidth - sc.clientWidth),
            txt: amt ? amt.childNodes[0].textContent.trim() : '' };
        });
        check(f.clip.length === 0, `${w}px (${sname} ${f.txt}): nothing is clipped by its slot`,
          f.clip.join(' '));
        /* Where the ellipsis does fire it must be trimming, not swallowing: a
           20% slot is 66px at 320px and the account name alone is ~38px of it, so
           anything past ~16px hidden would be eating the figure rather than its
           tail. Only the grey sub-line may clip at all -- .sl-d, .sl-y and
           .sl-sub carry figures that must read whole. */
        check(f.ell.every(e => e.startsWith('small-') && +e.split('-')[1] <= 16),
          `${w}px (${sname}): only the grey sub-line clips, and only its tail`,
          f.ell.join(' '));
        check(f.wrap.length === 0, `${w}px (${sname}): and nothing wraps to a second line`,
          f.wrap.join(' '));
        check(f.over === 0, `${w}px (${sname}): no sideways scrollbar`, `${f.over}px`);
      }
    }

    /* There was an even-GAPS assertion here. It is gone on purpose: a fixed
       slot grid decides where text starts, so the distance between two texts is
       whatever the slots and the content make it -- with the grid in place the
       header gaps read 38 / 22 / 41 and that is correct, not a regression. The
       slot-edge check above is the property that replaced it. Pinning both
       would be contradictory. */
    /* With the widest content there IS no surplus -- the table is already at its
       natural width -- so the gaps are whatever the content makes them and no
       layout choice can even them out. Asserted so that is on the record rather
       than looking like a case that was quietly skipped. */
    await W.page.evaluate(r => { state.sells = r; persist(); render() }, SEEDS.long);
    await W.page.setViewportSize({ width: 1280, height: 1100 });
    await W.page.waitForTimeout(300);
    const tight = await geom();
    check(Math.min(...tight.head) >= 16,
      'with the widest content the columns are still not touching',
      JSON.stringify(tight.head));

    await W.page.setViewportSize({ width: 1280, height: 1100 });
    await W.page.waitForTimeout(300);

    /* The fold follows the PANEL, not the window: a container query. Put the
       panel in the wide column at one viewport width and then the narrow one --
       a viewport-keyed rule cannot tell these apart. */
    const pctAt = () => W.page.evaluate(() => {
      const pc = document.querySelector('#sellBody td.pc');
      return !!pc && getComputedStyle(pc).display !== 'none';
    });
    await W.page.setViewportSize({ width: 1280, height: 1100 });
    await W.page.waitForTimeout(300);
    const inRight = await pctAt();
    await W.page.evaluate(() => {
      document.querySelector('#dashView > .col').appendChild(document.getElementById('sellsPanel'));
    });
    await W.page.waitForTimeout(350);
    const inLeft = await pctAt();
    check(inLeft && inRight === true,
      'Profit shows in both columns at 1280 — the wide one certainly',
      JSON.stringify({ right: inRight, left: inLeft }));
    await W.page.evaluate(() => {
      // squeeze the panel itself without touching the window
      document.getElementById('sellsPanel').style.maxWidth = '300px';
    });
    await W.page.waitForTimeout(350);
    check(!(await pctAt()),
      'and folds when the PANEL is narrowed, with the window unchanged');
    await W.page.evaluate(() => {
      document.getElementById('sellsPanel').style.maxWidth = '';
      dashLayout();
    });
    await W.page.waitForTimeout(300);

    await W.page.setViewportSize({ width: 1360, height: 1000 });
    await W.page.waitForTimeout(250);
    /* Read both buttons rather than hardcoding the numbers, so the two cannot
       drift apart later. */
    const btns = await W.page.evaluate(() => {
      const g = e => { const c = getComputedStyle(e);
        return [c.fontSize, c.padding, c.backgroundColor, c.borderRadius].join('|') };
      return { search: g(document.getElementById('sellSearch')), add: g(document.getElementById('npAdd')) };
    });
    check(btns.search === btns.add,
      'Search is the same button as "+ Add point"', JSON.stringify(btns));

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


  /* ======================================================================
     A history point is {t, v:{ALL,TFSA,FHSA,Other}, k}. Builds before the
     per-account filter existed wrote a single number instead -- as `v`, or as
     `total` -- and a half-written cloud record can arrive with no `v` at all.
     Three of those five shapes used to throw at drawChart's `p.v[key]`, as a
     startup error that killed the chart for the rest of the session, and the
     other two were dropped silently.

     Every case asserts a DRAWN or an EMPTY chart plus a clean error log, so
     neither a throw nor a quietly blank panel can pass. */
  section('dashboard chart: every history shape the app can be handed');
  {
    const H = 3600e3, now = Date.now();
    // dated INSIDE the default 1D span -- otherwise the span filter removes the
    // point before the map and no shape is exercised at all
    const mk = f => [0, 1, 2, 3, 4].map(i => f(now - (5 - i) * H, i));
    const SHAPES = [
      ['current {v:{ALL..}}', mk((t, i) => ({ t, k: 'k' + i, v: { ALL: 20000 + i * 900, TFSA: 5000 + i * 100, FHSA: 3000, Other: 1000 } })), true, true],
      ['legacy number v', mk((t, i) => ({ t, k: 'k' + i, v: 20000 + i * 900 })), true, false],
      ['legacy {t,total}', mk((t, i) => ({ t, k: 'k' + i, total: 20000 + i * 900 })), true, false],
      ['v is null', mk((t, i) => ({ t, k: 'k' + i, v: null })), false, false],
      ['v missing', mk((t, i) => ({ t, k: 'k' + i })), false, false],
      ['v NaN / junk', mk((t, i) => ({ t, k: 'k' + i, v: { ALL: NaN, TFSA: 'x', FHSA: null } })), false, false],
      ['garbage rows', [null, 7, { t: 'nope' }, { t: now - H, k: 'a', v: { ALL: 100 } }, { t: now, k: 'b', v: { ALL: 200 } }], true, false],
    ];
    for (const [name, hist, drawsAll, drawsTFSA] of SHAPES) {
      const S = await open(browser, url,
        Object.assign({}, SEED, { 'sparta.dash.history': JSON.stringify(hist) }));
      const q = async () => S.page.evaluate(() => ({
        paths: document.querySelectorAll('#chart path').length,
        empty: getComputedStyle(document.getElementById('chartEmpty')).display !== 'none',
      }));
      const onAll = await q();
      await S.page.click('#acctSeg button[data-acct="TFSA"]');
      await S.page.waitForTimeout(150);
      const onTFSA = await q();
      // the cloud round trip, which threw on a legacy point at encPoint(v.ALL)
      const rt = await S.page.evaluate(() => {
        try { const back = decodeHistory(encodeHistory());
          return { ok: true, n: back.length,
            shapes: [...new Set(back.map(e => Object.keys(e.v || {}).sort().join('/')))].join(' + ') } }
        catch (e) { return { ok: false, err: e.message } }
      });
      check(S.errs.length === 0, `${name}: no page error`, S.errs.join(' | '));
      check(onAll.paths > 0 === drawsAll && onAll.empty === !drawsAll,
        `${name}: the ALL scope ${drawsAll ? 'draws' : 'shows the empty state'}`,
        JSON.stringify(onAll));
      /* The point of normalising a legacy total onto ALL alone: it knew the
         total, it never knew the split, so TFSA must read EMPTY rather than
         draw a line that dives to a zero nobody recorded. */
      check(onTFSA.paths > 0 === drawsTFSA && onTFSA.empty === !drawsTFSA,
        `${name}: the TFSA scope ${drawsTFSA ? 'draws' : 'shows the empty state'}`,
        JSON.stringify(onTFSA));
      check(rt.ok && !/TFSA/.test(drawsTFSA ? '' : rt.shapes),
        `${name}: survives a cloud round trip without inventing account figures`,
        JSON.stringify(rt));
      await S.ctx.close();
    }
    // one mixed history: the old points keep ALL, the new ones keep all four
    const MX = await open(browser, url, Object.assign({}, SEED, {
      'sparta.dash.history': JSON.stringify(mk((t, i) => i < 2
        ? { t, k: 'k' + i, total: 20000 + i * 900 }
        : { t, k: 'k' + i, v: { ALL: 20000 + i * 900, TFSA: 5000, FHSA: 3000, Other: 1000 } })) }));
    const mixed = await MX.page.evaluate(async () => {
      const n = () => dashPts.length;
      const out = { all: n() };
      document.querySelector('#acctSeg button[data-acct="TFSA"]').click();
      await new Promise(r => setTimeout(r, 150));
      out.tfsa = n();
      out.shapes = [...new Set(state.history.map(e => Object.keys(e.v).sort().join('/')))];
      return out;
    });
    check(mixed.all === 5 && mixed.tfsa === 3,
      'a mixed history plots all five on ALL and only the three that knew TFSA on TFSA',
      JSON.stringify(mixed));
    check(MX.errs.length === 0, 'and no page errors from the mixed history', MX.errs.join(' | '));
    await MX.ctx.close();
  }

  /* ======================================================================
     Five fixed slots mean a column cannot borrow width from its neighbour, so
     anything that does not fit is simply drawn over the cell beside it. The
     money got sellAmt; the ticker's grey sub-line shares slot 2 and had nothing,
     so "FHSA · 0.12345678" drew 28.5px into the Profit % cell at 1440px.

     The assertion is on PAINTED boxes, not on Range ink: an element with
     overflow:hidden has a rect equal to its own box, and that is what can land on
     a neighbour. Range rects ignore ancestor clipping and would report an overlap
     that is not on screen. */
  section('past sells: nothing is drawn outside its slot, at any width');
  {
    const D = Date.now() - 3 * 86400e3;
    const SELLS = [
      { id: 's1', t: D, sym: 'AAPL', acct: 'TFSA', qty: 10, price: 212.4, avg: 180.5, ccy: 'USD' },
      { id: 's2', t: D, sym: 'BRK.B', acct: 'Other', qty: 12345, price: 412.9, avg: 395.1, ccy: 'USD' },
      { id: 's3', t: D, sym: 'VFV', acct: 'FHSA', qty: 0.12345678, price: 148.9, avg: 132.1, ccy: 'CAD' },
      { id: 's4', t: D, sym: 'ENB', acct: 'FHSA', qty: 1234.56, price: 52.75, avg: 48.2, ccy: 'CAD' },
      { id: 's5', t: D, sym: 'TD', acct: 'TFSA', qty: 987654.321, price: 88.1, avg: 70, ccy: 'CAD' },
    ];
    const F = await open(browser, url, SEED);
    await F.page.click('#viewSeg button[data-view="dash"]');
    await F.page.waitForTimeout(300);
    await F.page.evaluate(rows => { state.sells = rows; render() }, SELLS);
    await F.page.waitForTimeout(200);

    const qtys = await F.page.evaluate(() => [10, 12345, 0.12345678, 1234.56, 987654.321, 1e6, 99999]
      .map(q => sellQty(q)));
    check(JSON.stringify(qtys) === JSON.stringify(
      ['10', '12345', '0.1235', '1234.56', '987.7K', '1000K', '99999']),
      'sellQty keeps whole lots exact, trims a fraction to 4dp and sends six figures to K',
      JSON.stringify(qtys));

    let worst = 0, rowSpread = [];
    for (const w of [1440, 1280, 1100, 900, 700, 560, 414, 375, 320]) {
      await F.page.setViewportSize({ width: w, height: 1000 });
      await F.page.evaluate(() => renderSells());
      await F.page.waitForTimeout(140);
      const r = await F.page.evaluate(() => {
        const t = document.getElementById('sellTable');
        const over = [];
        const heights = [];
        t.querySelectorAll('tbody tr').forEach((tr, ri) => {
          heights.push(Math.round(tr.getBoundingClientRect().height));
          [...tr.children].forEach((td, ci) => {
            if (getComputedStyle(td).display === 'none') return;   // the folded .pc column
            const inner = td.getBoundingClientRect().right - parseFloat(getComputedStyle(td).paddingRight);
            td.querySelectorAll('*').forEach(el => {
              const q = el.getBoundingClientRect();
              if (q.width && q.right - inner > 0.5) over.push(`r${ri}c${ci}+${(q.right - inner).toFixed(1)}`);
            });
          });
        });
        const sc = t.closest('.tscroll');
        return { over, heights: [...new Set(heights)],
          side: sc ? sc.scrollWidth - sc.clientWidth : 0,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      check(r.over.length === 0, `${w}px: no element is painted outside its slot`, r.over.join(' '));
      check(r.side <= 0, `${w}px: and the table needs no sideways scroll`, String(r.side));
      if (r.page > 0) worst = Math.max(worst, r.page);
      rowSpread.push(r.heights.length);
    }
    check(worst === 0, 'and the page itself never scrolls sideways at any width', String(worst));
    /* All five rows the same height at every width is what "does not go to
       another line" means: a wrapped sub-line would make one row taller. */
    check(rowSpread.every(n => n === 1),
      'every sell row is the same height — nothing wrapped to a second line',
      JSON.stringify(rowSpread));
    await F.page.setViewportSize({ width: 1360, height: 1000 });
    check(F.errs.length === 0, 'no page errors from the slot sweep', F.errs.join(' | '));
    await F.ctx.close();
  }

  /* An overdraft is allowed on purpose -- refusing would make a real correction
     impossible once the money had moved on -- so the one sentence that announces
     it has to be right. money() strips the sign by design (it exists to be
     wrapped by signed()), and called bare it turned -412 into C$412.00 in the
     same toast that had just said -C$1,200.00. */
  section('past sells: an overdraft is announced as a debit');
  {
    const O = await open(browser, url, SEED);
    await O.page.click('#viewSeg button[data-view="dash"]');
    await O.page.waitForTimeout(300);
    const note = await O.page.evaluate(() => {
      state.cash.TFSA = -412; state.ccy = 'CAD'; state.fx = 1;
      const n = sellCashNote('TFSA');
      render();
      return { note: n, panel: document.getElementById('cashT').textContent,
        positive: (state.cash.TFSA = 500, sellCashNote('TFSA')) };
    });
    check(/[-\u2212]/.test(note.note), 'the overdraft note carries a minus sign', note.note);
    check(note.note.indexOf(note.panel) > -1,
      'and it is the SAME string the Available-balance panel shows, to the character',
      JSON.stringify([note.note, note.panel]));
    check(note.positive === '',
      'a healthy balance adds no note at all', JSON.stringify(note.positive));
    check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ...and the minus goes in FRONT of the currency symbol, which is the half
     the section above does not pin: it asserts the note CARRIES a minus and
     that it matches the panel character for character, so both could be wrong
     together and it would still pass. They were -- fmt() left the sign where
     toLocaleString puts it, inside the symbol, so an overdraft read
     "C$-412.00" while Archives' arc$ and Monthly's meMoney both put it first.
     signed() and signedNat() always placed their own sign, which is why only
     the bare-negative path was affected and it went unnoticed this long.

     An overdraft is a supported state, not an edge case: sellReverse may
     overdraw an account on purpose, because refusing would make a real
     correction impossible once the money had moved on. */
  section('past sells: and the minus sits outside the currency symbol');
  {
    const O = await open(browser, url, SEED);
    await O.page.click('#viewSeg button[data-view="dash"]');
    await O.page.waitForTimeout(300);
    const f = await O.page.evaluate(() => {
      state.ccy = 'CAD'; state.fx = 1;
      state.cash.TFSA = -412;
      /* A negative quantity reaches fmtNat through a holding's value cell, and
         a negative EPS reaches it through Eye on Stocks -- ordinary for any
         company losing money. */
      state.holdings.push({ id: 'shrt', sym: 'SHORT', acct: 'Other', qty: -3,
        avg: 10, price: 4, ccy: 'CAD', nat: true });
      render();
      return {
        panel: document.getElementById('cashT').textContent.trim(),
        card: document.getElementById('tfsaCash').textContent.trim(),
        note: sellCashNote('TFSA'),
        negEps: fmtNat(-1.23, 'USD'),
        // the positive side, which must not have moved by a single byte
        posFmt: fmt(1234.5), posNat: fmtNat(1234.5, 'CAD'), zero: fmt(0),
        // signed() wraps money(), which strips the sign on purpose
        signedNeg: signed(-50), signedNatNeg: signedNat(-50, 'USD'),
      };
    });
    const M = '−';
    check(f.panel === M + 'C$412.00',
      'the Available-balance panel reads −C$412.00, not C$-412.00', f.panel);
    check(f.card === 'Cash ' + M + 'C$412.00',
      'and so does the account card sub-line', f.card);
    check(!/C\$-/.test(f.note) && f.note.indexOf(f.panel) > -1,
      'the overdraft note follows it and still matches the panel exactly', f.note);
    check(f.negEps === M + '$1.23',
      'fmtNat does the same, so a negative EPS is not "$-1.23"', f.negEps);
    /* The claim that makes this safe to land: nothing POSITIVE moved. */
    check(f.posFmt === 'C$1,234.50' && f.posNat === 'C$1,234.50' && f.zero === 'C$0.00',
      'a positive or zero figure is byte-identical to before',
      JSON.stringify([f.posFmt, f.posNat, f.zero]));
    check(f.signedNeg === M + 'C$50.00' && f.signedNatNeg === M + '$50.00',
      'and signed()/signedNat() are unchanged -- money() still strips the sign',
      JSON.stringify([f.signedNeg, f.signedNatNeg]));
    /* No figure anywhere on the tab may carry a minus INSIDE the symbol. Stated
       over the whole view so a formatter added later is covered too. */
    const inside = await O.page.evaluate(() => [...new Set(
      [...document.querySelectorAll('#dashView *')]
        .filter(e => !e.children.length)
        .map(e => (e.textContent || '').trim())
        .filter(t => /C?\$\s*-/.test(t)))]);
    check(inside.length === 0,
      'and nothing on the Dashboard prints a minus inside the symbol',
      JSON.stringify(inside));
    check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ── the holdings sub-lines are readable when the position is DOWN ───────
     Both sub-lines in a holdings row carry an inline opacity, and `opacity`
     composites the whole element over what is behind it -- so the ratio that
     matters is the COMPOSITED colour. getComputedStyle().color still reports
     the full-strength value, which is exactly why this reads as fine and is
     not: declared, the loss colour is 6.86:1.

     At the .75 the P/L percentage used to carry it composited to 4.28:1,
     against a 4.5 requirement -- 11px is nowhere near the large-text exemption.
     The GAIN colour is far brighter and passed either way, so the failure only
     ever appeared on a position that was losing money, which is the number most
     worth being able to read.

     Computed rather than asserted against a remembered pixel value (bug class
     12): the claim is "this clears AA", not "this is 4.73". */
  section('holdings: the sub-lines clear AA once composited, losses included');
  {
    const O = await open(browser, url, SEED);
    await O.page.click('#viewSeg button[data-view="dash"]');
    await O.page.waitForTimeout(600);     // past the panel transition (bug class 11)
    /* THE BACKDROP IS SAMPLED, NOT DERIVED, and that is the whole point of this
       section. The first version of it walked up the ancestors for a background
       whose alpha was over .9 and, finding none -- every glass surface in this
       app is translucent at about .03 -- fell through to a hardcoded page
       colour. Against the page the loss colour reads 4.73:1 at opacity .8;
       against the panel the row is really on it is 4.36:1. So the test PASSED a
       value that fails, and a fix was landed on the strength of it.

       Hiding only the glyphs and screenshotting the pixel underneath is ground
       truth: it needs no model of the compositing order, and unlike a pure
       compositor it also survives backdrop-filter, which blurs what is behind
       rather than simply layering it. */
    /* ONE full-page screenshot with every probed glyph hidden, then each span is
       sampled at its PAGE-relative coordinate. Per-element clips were the first
       attempt and they throw the moment a row sits below the fold, which it does
       at any ordinary viewport; `fullPage` also sidesteps the smooth-scroll trap,
       where a rect read straight after scrollIntoView() is still the pre-scroll
       one. One capture, so the backdrop is read from a single consistent paint. */
    const spans = await O.page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#hbody span[style*="opacity"]').forEach((el, i) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        el.setAttribute('data-plprobe', String(i));
        out.push({ i, text: (el.textContent || '').trim(), op: Number(cs.opacity),
          color: cs.color, down: !!el.closest('.down'),
          x: Math.round(r.left + r.width / 2 + scrollX),
          y: Math.round(r.top + r.height / 2 + scrollY) });
      });
      return out;
    });
    await O.page.evaluate(() => {
      document.querySelectorAll('[data-plprobe]').forEach(e => { e.style.visibility = 'hidden' });
    });
    const sheet = (await O.page.screenshot({ fullPage: true })).toString('base64');
    await O.page.evaluate(() => {
      document.querySelectorAll('[data-plprobe]').forEach(e => { e.style.visibility = '' });
    });
    const bgs = await O.page.evaluate(async ({ b, pts }) => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return pts.map(p => { const d = g.getImageData(p.x, p.y, 1, 1).data; return [d[0], d[1], d[2]] });
    }, { b: sheet, pts: spans.map(sp => ({ x: sp.x, y: sp.y })) });
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) };
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const l1 = L(a), l2 = L(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };
    const m = spans.map((sp, k) => {
      const bg = bgs[k];
      const fg = (sp.color.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
      const eff = fg.map((v, q) => v * sp.op + bg[q] * (1 - sp.op));
      return { text: sp.text, op: sp.op, bg: `rgb(${bg.join(',')})`,
        eff: +ratio(eff, bg).toFixed(2), down: sp.down };
    });
    /* The fixture has to CONTAIN a losing position, or the only check that
       could fail is not exercised at all (bug class 7). SEED's NVDA is held
       at 900 and marked at 845.25. */
    check(m.some(r => r.down), 'the fixture holds a position that is down, so the loss colour is on screen',
      JSON.stringify(m.map(r => r.down)));
    /* The backdrop is asserted to be the PANEL and not the page, because that
       is the error this section exists to prevent recurring: if a future change
       makes the sampled pixel read as #071520 again, the ratios go comfortable
       and meaningless, and this check says so before the next one passes. */
    const PAGEISH = ['rgb(7,21,32)', 'rgb(11,15,25)'];   // the page, and the old hardcoded fallback
    check(m.length > 0 && m.every(r => PAGEISH.indexOf(r.bg) < 0),
      'the sampled backdrop is the glass panel, not the page behind it',
      JSON.stringify([...new Set(m.map(r => r.bg))]));
    check(m.length > 0 && m.every(r => r.eff >= 4.5),
      'every holdings sub-line composites to at least 4.5:1 on what it is painted on',
      JSON.stringify(m.map(r => ({ t: r.text.slice(0, 9), op: r.op, bg: r.bg, eff: r.eff }))));
    /* The two sub-lines are the same kind of thing and should not disagree --
       one of them having been .75 is how the failure got in. */
    check(new Set(m.map(r => r.op)).size === 1,
      'and the two sub-lines share one opacity rather than two invented values',
      JSON.stringify([...new Set(m.map(r => r.op))]));
    check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ── closing a modal puts the keyboard back where it was ────────────────
     Both dialogs move focus into themselves on open, which is right, and
     neither put it back -- so pressing Escape on the sell dialog opened from a
     holdings row left focus on <body>, and the way back to that row was to Tab
     from the top of the page.

     The cancel and Escape paths are what this covers, and they are the common
     ones. A CONFIRMED sale re-renders the table that held the button, so there
     is genuinely nothing to go back to; that is asserted too, so the fallback
     is pinned as deliberate rather than looking like the same bug half-fixed. */
  section('modals: focus returns to the control that opened them');
  {
    const O = await open(browser, url, SEED);
    await O.page.click('#viewSeg button[data-view="dash"]');
    await O.page.waitForTimeout(350);

    // focus the $ button on the first holdings row the way a keyboard would
    await O.page.evaluate(() => document.querySelector('#hbody .rm.sell').focus());
    const before = await O.page.evaluate(() => ({
      tag: document.activeElement.tagName,
      id: document.activeElement.dataset.id,
    }));
    check(before.tag === 'BUTTON' && !!before.id,
      'a holdings sell button has focus to begin with', JSON.stringify(before));

    await O.page.evaluate(() => document.querySelector('#hbody .rm.sell').click());
    await O.page.waitForTimeout(200);
    check(await O.page.evaluate(() => document.activeElement.id) === 'sellQty',
      'opening the dialog moves focus into it');

    // Escape, the path a user takes when they change their mind
    await O.page.keyboard.press('Escape');
    await O.page.waitForTimeout(200);
    const after = await O.page.evaluate(() => ({
      open: document.getElementById('sellModal').classList.contains('open'),
      tag: document.activeElement.tagName,
      id: document.activeElement.dataset.id,
      isBody: document.activeElement === document.body,
    }));
    check(!after.open, 'Escape closes it');
    check(!after.isBody && after.id === before.id,
      'and focus is back on the very button that opened it', JSON.stringify(after));

    /* The confirm path: the row is replaced by the render, so the remembered
       button is detached and focusing it would do nothing silently. Asserted so
       the limitation is on the record. */
    await O.page.evaluate(() => {
      state.cash.TFSA = 10000;
      document.querySelector('#hbody .rm.sell').focus();
      document.querySelector('#hbody .rm.sell').click();
    });
    await O.page.waitForTimeout(200);
    await O.page.evaluate(() => { $('sellQty').value = '1'; $('sellPrice').value = '10'; });
    await O.page.evaluate(() => confirmSell());
    await O.page.waitForTimeout(300);
    check(await O.page.evaluate(() => !document.getElementById('sellModal').classList.contains('open')),
      'a confirmed sale closes the dialog');
    check(await O.page.evaluate(() => document.activeElement === document.body),
      'and leaves focus at the document, because the row it came from is gone');

    check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\nUI: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
