/* Yearly Finance HIGHLIGHTS: generator correctness, guards, rotation,
   and the timer-leak risk that comes from renderYF()'s many callers. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

// A deliberately shaped year: JUNE is the spending peak, MARCH the income
// spike, FEB runs a deficit, Rent is the biggest category and blows its plan.
const YEAR = 2026;
const SEED_TX = [
  { type: 'income',  date: `${YEAR}-01-01`, amt: 3000, desc: 'Pay',      cat: 'Paycheck',  who: 'ABI' },
  { type: 'expense', date: `${YEAR}-01-05`, amt: 1000, desc: 'Jan rent', cat: 'Food',      who: 'ABI' },
  { type: 'income',  date: `${YEAR}-02-01`, amt: 3000, desc: 'Pay',      cat: 'Paycheck',  who: 'ABI' },
  { type: 'expense', date: `${YEAR}-02-05`, amt: 3400, desc: 'Feb rent', cat: 'Food',      who: 'POO' },
  { type: 'income',  date: `${YEAR}-03-01`, amt: 9000, desc: 'Bonus',    cat: 'Bonus',     who: 'ABI' },
  { type: 'expense', date: `${YEAR}-03-05`, amt: 1100, desc: 'Mar rent', cat: 'Food',      who: 'ABI' },
  { type: 'income',  date: `${YEAR}-06-01`, amt: 3000, desc: 'Pay',      cat: 'Paycheck',  who: 'ABI' },
  { type: 'expense', date: `${YEAR}-06-05`, amt: 7200, desc: 'Reno',     cat: 'Home',      who: 'POO' },
];
const seed = (page, txns = SEED_TX, planned = { Food: 3000 }) => page.evaluate(([tx, pl, yr]) => {
  state.yfYear = yr;
  state.yf.txns = tx.map((t, i) => Object.assign({ id: 'x' + i }, t));
  state.yf.planned = { [yr]: pl };
  if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
  if (!state.yf.cats.inc.includes('Bonus')) state.yf.cats.inc.push('Bonus');
  render();
  renderYF();          // render() covers Dashboard+Contributions only
}, [txns, planned, YEAR]);

const goYearly = async page => {
  await page.click('#viewSeg button[data-view="yearly"]');
  await page.waitForTimeout(250);
};
const cards = page => page.evaluate(() =>
  [...document.querySelectorAll('#yfHiSlides .yf-hi-slide')].map(el => ({
    title: el.querySelector('.yf-hi-t').textContent.trim(),
    line: el.querySelector('.yf-hi-l').textContent.trim(),
    on: el.classList.contains('on'),
  })));

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

  console.log('\n── 1. generator picks the right facts ──');
  await seed(page);
  await goYearly(page);
  const c = await cards(page);
  const find = re => c.find(x => re.test(x.line));
  check(c.length > 0, `panel renders ${c.length} cards`, JSON.stringify(c.map(x => x.title)));
  check(/JUNE/.test(find(/Biggest spending|JUNE/)?.line || ''), 'JUNE named as the biggest spending month',
    find(/JUNE/)?.line);
  check(/MAR/.test(c.find(x => x.title === 'Best earning month')?.line || ''),
    'MARCH named as the best earning month', c.find(x => x.title === 'Best earning month')?.line);
  const def = c.find(x => x.title === 'Spent more than you earned');
  check(!!def && /FEB/.test(def.line) && !/JAN/.test(def.line), 'deficit card lists FEB only', def && def.line);
  const over = c.find(x => x.title === 'Over budget');
  check(!!over && /Food/.test(over.line) && /2,500/.test(over.line),
    'Food over budget by $2,500 (5,500 spent vs 3,000 planned)', over && over.line);
  const who = c.find(x => x.title === 'Who spent what');
  check(!!who && /ABI/.test(who.line) && /POO/.test(who.line), 'contributor split present', who && who.line);
  const fam = {
    peaks: c.some(x => /Biggest spending|Best earning/.test(x.title)),
    anomaly: c.some(x => /Unusual month|Spent more than you earned|Spending trend/.test(x.title)),
    budget: c.some(x => /Over budget|Under budget/.test(x.title)),
    category: c.some(x => /Biggest expense|Main income|Largest single|Who spent/.test(x.title)),
  };
  check(Object.values(fam).every(Boolean), 'all four highlight families make the 8-card cap',
    JSON.stringify(fam));
  check(c.length === 8, 'suppressions do not over-fire on a real year (still 8 cards)', String(c.length));
  const big = c.find(x => x.title === 'Largest single expense');
  check(!!big && /7,200/.test(big.line) && /Reno/.test(big.line), 'largest single expense is the $7,200 Reno',
    big && big.line);

  console.log('\n── 2. dedupe: anomaly must not repeat the peak month ──');
  const odd = c.find(x => x.title === 'Unusual month' && /above your usual spend/.test(x.line));
  check(!odd || !/JUNE/.test(odd.line), 'expense anomaly card does not re-name JUNE',
    odd ? odd.line : '(no anomaly card, also fine)');

  console.log('\n── 3. guards ──');
  await seed(page, [
    { type: 'income', date: `${YEAR}-04-01`, amt: 100, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-04-02`, amt: 50, desc: '', cat: 'Food', who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const one = await cards(page);
  check(!one.some(x => /Biggest spending month|Best earning month/.test(x.title)),
    'one month of data produces no "highest month" card', JSON.stringify(one.map(x => x.title)));
  check(!one.some(x => x.title === 'Over budget' || x.title === 'Under budget'),
    'no planned figures produces no budget cards');

  await seed(page, [], {});
  await page.waitForTimeout(250);
  const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('yfHiPanel')).display);
  check(hidden === 'none', 'a year with no transactions hides the panel entirely', hidden);

  console.log('\n── 3b. averages use months logged, not months elapsed ──');
  // one month only: $4,200 in / $2,710 out. Months elapsed would divide by the
  // current month index and report a fraction of that.
  await seed(page, [
    { type: 'income',  date: `${YEAR}-01-01`, amt: 4200, desc: 'Pay',  cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-02`, amt: 2100, desc: 'Rent', cat: 'Home',     who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-06`, amt: 610,  desc: 'Food', cat: 'Grocery',  who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const rate1 = (await cards(page)).find(x => x.title === 'Savings rate');
  check(!!rate1 && /\$4,200/.test(rate1.line) && /\$2,710/.test(rate1.line),
    'one logged month averages to that month, not a twelfth of it', rate1 && rate1.line);
  check(!!rate1 && /across the 1 month logged/.test(rate1.line),
    'names the denominator, singular', rate1 && rate1.line);

  await seed(page, [
    { type: 'income',  date: `${YEAR}-01-01`, amt: 3000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-02`, amt: 1000, desc: '', cat: 'Home',     who: 'ABI' },
    { type: 'income',  date: `${YEAR}-02-01`, amt: 3000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-02-02`, amt: 2000, desc: '', cat: 'Home',     who: 'ABI' },
    { type: 'income',  date: `${YEAR}-03-01`, amt: 3000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-03-02`, amt: 3000, desc: '', cat: 'Home',     who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const c3 = await cards(page);
  const rate3 = c3.find(x => x.title === 'Savings rate');
  check(!!rate3 && /across the 3 months logged/.test(rate3.line), 'pluralises at 3 months',
    rate3 && rate3.line);
  check(!!rate3 && /\$3,000 in/.test(rate3.line), 'divides income by 3, not by months elapsed',
    rate3 && rate3.line);

  console.log('\n── 3c. cards that would state the obvious are suppressed ──');
  // identical income every month -> no "best earning month" to crown
  check(!c3.some(x => x.title === 'Best earning month'),
    'identical monthly income produces no "Best earning month"',
    JSON.stringify(c3.map(x => x.title)));
  // ...but the varying expense side still gets its peak
  check(c3.some(x => x.title === 'Biggest spending month'),
    'varying monthly expense still produces "Biggest spending month"');
  // single income category -> "100% of what came in" is not worth a card
  check(!c3.some(x => x.title === 'Main income source'),
    'a lone income category produces no share-of-total card');

  await seed(page, [
    { type: 'income',  date: `${YEAR}-01-01`, amt: 4200, desc: 'Pay',  cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-02`, amt: 2100, desc: 'Rent', cat: 'Home',     who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const c1 = await cards(page);
  check(!c1.some(x => x.title === 'Largest single expense'),
    'a single expense produces no "Largest single expense" card',
    JSON.stringify(c1.map(x => x.title)));
  check(!c1.some(x => x.title === 'Biggest expense'),
    'a lone expense category produces no share-of-total card');

  console.log('\n── 4. rotation + dots ──');
  await seed(page);
  await goYearly(page);
  const n = await page.evaluate(() => document.querySelectorAll('#yfHiDots .yf-hi-dot').length);
  check(n === (await cards(page)).length && n > 1, `one dot per card (${n})`);
  const before = await page.evaluate(() => yfHiIdx);
  await page.waitForTimeout(5600);
  const after = await page.evaluate(() => yfHiIdx);
  check(after !== before, 'card advances on its own after the interval', `${before} -> ${after}`);

  await page.click('#yfHiDots .yf-hi-dot[data-i="2"]');
  await page.waitForTimeout(150);
  const jumped = await page.evaluate(() => ({
    idx: yfHiIdx,
    aria: document.querySelector('#yfHiDots .yf-hi-dot[data-i="2"]').getAttribute('aria-current'),
    onCount: document.querySelectorAll('#yfHiSlides .yf-hi-slide.on').length,
  }));
  check(jumped.idx === 2 && jumped.aria === 'true', 'clicking a dot jumps to it and sets aria-current',
    JSON.stringify(jumped));
  check(jumped.onCount === 1, 'exactly one slide visible at a time');

  console.log('\n── 5. pause on hover ──');
  await page.mouse.move(0, 0);       // the dot click left the pointer inside the panel
  await page.waitForTimeout(250);
  await page.hover('#yfHiPanel');
  await page.waitForTimeout(200);
  const hov = await page.evaluate(() => ({ hover: yfHiHover, timer: yfHiTimer }));
  check(hov.hover === true && hov.timer === null, 'hovering flags hover and clears the timer',
    JSON.stringify(hov));

  // Prove the tick guard deterministically rather than racing the pointer:
  // page.hover() can scroll the panel, and a stray mouseleave landing after the
  // mouseenter would silently un-pause and make a wall-clock assertion flaky.
  const guarded = await page.evaluate(async () => {
    yfHiHover = true;
    yfHiStart();                     // a live timer, but hover is set
    const before = yfHiIdx;
    await new Promise(r => setTimeout(r, 5600));
    return { before, after: yfHiIdx, hadTimer: yfHiTimer !== null };
  });
  check(guarded.hadTimer && guarded.after === guarded.before,
    'a running tick does not advance while hover is set', JSON.stringify(guarded));

  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const left = await page.evaluate(() => ({ hover: yfHiHover, timer: yfHiTimer }));
  check(left.hover === false && left.timer !== null, 'leaving clears the flag and resumes',
    JSON.stringify(left));

  console.log('\n── 6. no timer leak (the main risk) ──');
  await page.click('#viewSeg button[data-view="monthly"]');
  await page.waitForTimeout(300);
  const offTab = await page.evaluate(() => ({ t: yfHiTimer, i: yfHiIdx }));
  check(offTab.t === null, 'leaving the Yearly tab stops the timer');
  // drive a Monthly-expense path that calls renderYF() while Yearly is hidden
  await page.evaluate(() => { if (typeof renderYF === 'function') { renderYF(); renderYF(); renderYF(); } });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => yfHiTimer) === null,
    'renderYF() while hidden does not start a timer');
  await page.waitForTimeout(5600);
  check(await page.evaluate(() => yfHiIdx) === offTab.i, 'index does not advance while hidden');

  await goYearly(page);
  await page.evaluate(() => { renderYF(); renderYF(); renderYF(); });
  await page.waitForTimeout(200);
  const idxA = await page.evaluate(() => yfHiIdx);
  await page.waitForTimeout(5600);
  const idxB = await page.evaluate(() => yfHiIdx);
  const steps = (idxB - idxA + 100 * (await page.evaluate(() => yfHiN))) % (await page.evaluate(() => yfHiN));
  check(steps === 1, 'after 3 extra renders it still advances exactly one step per tick (no stacked timers)',
    `${idxA} -> ${idxB}`);

  console.log('\n── 7. index survives a background re-render ──');
  await page.click('#yfHiDots .yf-hi-dot[data-i="3"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => renderYF());
  await page.waitForTimeout(200);
  check(await page.evaluate(() => yfHiIdx) === 3, 'still on card 3 after renderYF()');

  console.log('\n── 8. height stability ──');
  const heights = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < yfHiN; i++) {
      yfHiShow(i);
      await new Promise(r => setTimeout(r, 60));
      out.push(Math.round(document.getElementById('yfHiPanel').getBoundingClientRect().height));
    }
    return out;
  });
  check(new Set(heights).size === 1, 'panel height identical on every card', JSON.stringify(heights));

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close();

  console.log('\n── 9. mobile widths ──');
  for (const w of [320, 375, 390, 430]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: 844 } });
    const p2 = await c2.newPage();
    await stub(p2);
    await p2.goto(url, { waitUntil: 'load' });
    await p2.waitForTimeout(300);
    await seed(p2);
    await goYearly(p2);
    const o = await p2.evaluate(() => {
      const el = document.getElementById('yfHiPanel');
      return { over: el.scrollWidth - el.clientWidth, w: Math.round(el.getBoundingClientRect().width) };
    });
    check(o.over <= 0, `${w}px: highlights panel does not overflow`, JSON.stringify(o));
    await c2.close();
  }

  await browser.close(); srv.close();
  console.log(`\nYF HIGHLIGHTS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
