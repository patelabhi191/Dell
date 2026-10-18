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

  console.log('\n── 3d. LEFTOVER row colours a surplus blue ──');
  // JAN surplus (+2000), FEB shortfall (-1000), MAR empty, year total +1000
  await seed(page, [
    { type: 'income',  date: `${YEAR}-01-01`, amt: 5000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-05`, amt: 3000, desc: '', cat: 'Home',     who: 'ABI' },
    { type: 'income',  date: `${YEAR}-02-01`, amt: 2000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-02-05`, amt: 3000, desc: '', cat: 'Food',     who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const mt = await page.evaluate(() => {
    const rows = {};
    [...document.querySelectorAll('#yfMBody tr')].forEach(tr => {
      const cells = [...tr.children];
      rows[cells[0].textContent.trim()] = cells.slice(1).map(td => ({
        text: td.textContent.trim(),
        cls: td.className,
        color: getComputedStyle(td).color,
      }));
    });
    const probe = document.createElement('span');
    document.body.appendChild(probe);
    probe.style.color = 'var(--yf-inc)'; const blue = getComputedStyle(probe).color;
    probe.style.color = 'var(--yf-exp)'; const orange = getComputedStyle(probe).color;
    const plain = getComputedStyle(document.body).color;
    probe.remove();
    return { rows, blue, orange, plain };
  });
  const L = mt.rows.LEFTOVER, E = mt.rows.EXPENSE, M = mt.rows.MONTHENDS;
  check(L[0].color === mt.blue && /yf-pos/.test(L[0].cls),
    'JAN surplus is blue', `${L[0].text} ${L[0].cls} ${L[0].color}`);
  check(L[1].color === mt.orange && /yf-neg/.test(L[1].cls),
    'FEB shortfall is still orange', `${L[1].text} ${L[1].cls} ${L[1].color}`);
  check(L[2].cls === '' && L[2].color !== mt.blue && L[2].color !== mt.orange,
    'an empty month stays neutral', `${L[2].text} cls="${L[2].cls}"`);
  check(L[12].color === mt.blue && /yf-pos/.test(L[12].cls),
    'TOTAL is blue when the year is up', `${L[12].text} ${L[12].cls}`);

  // scoping: the flag must not leak onto the other rows
  check(E.slice(0, 2).every(c => !/yf-pos/.test(c.cls) && c.color !== mt.blue),
    'EXPENSE positives are NOT blue', JSON.stringify(E.slice(0, 2).map(c => c.text + ':' + c.cls)));
  check(M.slice(0, 2).every(c => !/yf-pos/.test(c.cls) && c.color !== mt.blue),
    'MONTHENDS positives are NOT blue', JSON.stringify(M.slice(0, 2).map(c => c.text + ':' + c.cls)));

  // and a down year turns the TOTAL orange
  await seed(page, [
    { type: 'income',  date: `${YEAR}-01-01`, amt: 1000, desc: '', cat: 'Paycheck', who: 'ABI' },
    { type: 'expense', date: `${YEAR}-01-05`, amt: 4000, desc: '', cat: 'Home',     who: 'ABI' },
  ], {});
  await page.waitForTimeout(250);
  const down = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('#yfMBody tr')].find(r => /LEFTOVER/.test(r.children[0].textContent));
    const td = [...tr.children][13];
    return { text: td.textContent.trim(), cls: td.className, color: getComputedStyle(td).color };
  });
  check(/yf-neg/.test(down.cls), 'TOTAL is orange when the year is down',
    `${down.text} ${down.cls}`);

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

  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const left = await page.evaluate(() => ({ hover: yfHiHover, timer: yfHiTimer }));
  check(left.hover === false && left.timer !== null, 'leaving clears the flag and resumes',
    JSON.stringify(left));

  // Prove the tick guard deterministically rather than racing the pointer, and
  // do it AFTER the leave check with the pointer already off the panel. Running
  // it while the pointer physically hovered meant any scroll or layout shift in
  // the 5.6s wait dispatched a mouseleave, cleared yfHiHover and let the tick
  // advance — about one run in three. Nothing can clear the flag out here.
  const guarded = await page.evaluate(async () => {
    yfHiHover = true;
    yfHiStart();                     // a live timer, but hover is set
    const before = yfHiIdx;
    await new Promise(r => setTimeout(r, 5600));
    const out = { before, after: yfHiIdx, hadTimer: yfHiTimer !== null };
    yfHiHover = false; yfHiStart();  // hand the panel back in its normal state
    return out;
  });
  check(guarded.hadTimer && guarded.after === guarded.before,
    'a running tick does not advance while hover is set', JSON.stringify(guarded));

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

  console.log('\n── 8b. the monthly chart axis rounds up to the next 1,000 ──');
  /* The axis used to start at 5k and double, so the only tops on offer were
     5k / 10k / 20k / 40k. A $7,237 month was drawn against a 10k ceiling and
     used 72% of the height it had. These numbers are chosen to sit inside the
     old scheme's dead zone, so a revert fails them rather than passing quietly. */
  const axis = async peak => {
    await seed(page, [
      { type: 'expense', date: `${YEAR}-06-05`, amt: peak, desc: 'Peak', cat: 'Food', who: 'ABI' },
    ], {});
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const svg = document.getElementById('yfChart');
      const labels = [...svg.querySelectorAll('text')]
        .map(t => t.textContent).filter(t => t.startsWith('$'));
      const bar = svg.querySelector('rect.yfb');
      // the plot area, from the code that draws it: H=260, T=16, B=32
      const plot = 260 - 16 - 32;
      return { labels, fill: bar ? +(bar.getAttribute('height') / plot).toFixed(3) : null };
    });
  };

  let ax = await axis(7237);
  check(JSON.stringify(ax.labels) === JSON.stringify(['$0', '$4k', '$8k']),
    '7,237 tops the axis at $8k, and the midpoint follows', JSON.stringify(ax.labels));
  /* The complaint itself, measured: the tallest bar has to actually use the
     height. Under the old doubling this was 0.724, so the threshold bites. */
  check(ax.fill >= 0.9, 'and the tallest bar fills ~90% of the plot rather than 72%',
    String(ax.fill));

  ax = await axis(8000);
  check(JSON.stringify(ax.labels) === JSON.stringify(['$0', '$4k', '$8k']),
    'an exact 8,000 does not round up to 9k', JSON.stringify(ax.labels));
  check(ax.fill >= 0.99, 'and it reaches the top line', String(ax.fill));

  ax = await axis(8001);
  check(JSON.stringify(ax.labels) === JSON.stringify(['$0', '$4.5k', '$9k']),
    'one dollar over rounds to 9k, half-thousand midpoint and all',
    JSON.stringify(ax.labels));

  ax = await axis(120);
  check(JSON.stringify(ax.labels) === JSON.stringify(['$0', '$500', '$1k']),
    'a tiny year still floors the axis at $1k rather than collapsing',
    JSON.stringify(ax.labels));

  console.log('\n── 8c. the planned-vs-actual tables ──');
  /* Column ORDER is asserted by heading rather than assumed, because these two
     tables swapped Planned and Spend and the only other test that read them was
     pinned to children[2] -- it reported a totals bug when nothing about the
     totals had changed. */
  await seed(page, [
    { type: 'expense', date: `${YEAR}-02-04`, amt: 13847, desc: 'Amex', cat: 'Food', who: 'ABI' },
    { type: 'income',  date: `${YEAR}-02-01`, amt: 41800, desc: 'Pay',  cat: 'Paycheck', who: 'ABI' },
  ], { Food: 14000, Paycheck: 39600 });
  await page.waitForTimeout(200);
  const pa = await page.evaluate(() => {
    const heads = t => [...document.querySelectorAll('#' + t + ' thead th')]
      .map(th => th.textContent.trim()).filter(Boolean);
    const cell = (body, name, i) => {
      const tr = [...document.querySelectorAll('#' + body + ' tr')]
        .find(r => r.children[0].textContent.trim() === name);
      return tr ? tr.children[i].textContent.trim() : null;
    };
    const nowM = new Date().getMonth() + 1;
    return { expHead: heads('yfExpTable'), incHead: heads('yfIncTable'),
             expDiff: cell('yfExpBody', 'Food', 3),
             expMonthly: cell('yfExpBody', 'Food', 4),
             incDiff: cell('yfIncBody', 'Paycheck', 3),
             nowM };
  });
  check(JSON.stringify(pa.expHead) === JSON.stringify(['Category','Spend','Planned','Diff.','Monthly']),
    'Expenses reads Category, Spend, Planned, Diff, Monthly', JSON.stringify(pa.expHead));
  check(JSON.stringify(pa.incHead) === JSON.stringify(['Category','Earned','Planned','Diff.']),
    'Income reads Category, Earned, Planned, Diff', JSON.stringify(pa.incHead));
  /* Expenses compares the monthly RATE against the plan; Income is still the
     year-to-date question. The two tables deliberately differ, so both are
     pinned -- otherwise one silently adopting the other's formula looks fine. */
  {
    const mo = 13847 / pa.nowM;
    const want = 14000 - mo;
    const got = parseFloat(pa.expDiff.replace(/[^0-9.]/g, ''));
    check(Math.abs(got - Math.abs(want)) < 1.5 && pa.expDiff.startsWith(want > 0 ? '+' : '\u2212'),
      'an expense Diff is Planned minus Monthly, not minus the year total',
      `${pa.expDiff} (expected ~${want.toFixed(0)})`);
    check(Math.abs(parseFloat(pa.expMonthly.replace(/[^0-9.]/g, '')) - mo) < 1.5,
      'and Monthly is the year-to-date spend over the months elapsed', pa.expMonthly);
  }
  check(pa.incDiff.replace(/[^0-9]/g, '') === '2200' && pa.incDiff.startsWith('\u2212'),
    'an income Diff is still Planned minus Earned', pa.incDiff);
  /* The totals row used to build its own Diff cell and printed "$-7,200" the
     moment that number could go negative. One renderer for both now. */
  const totals = await page.evaluate(() => {
    const t = b => document.querySelector('#' + b + ' tr').children[3].textContent.trim();
    return { exp: t('yfExpBody'), inc: t('yfIncBody') };
  });
  check(!/\$-/.test(totals.exp) && !/\$-/.test(totals.inc),
    'and a negative total renders as \u2212$n, never "$-n"', JSON.stringify(totals));

  /* The overview bars sit against the YEAR's Spend and Earned, but Planned is
     entered monthly, so it is annualised here. Before this the plan bar drew at
     8.4% of the track whatever the budget said -- a sliver that looked like a
     catastrophic overspend on every category. */
  const bars = await page.evaluate(() => {
    const t = id => document.getElementById(id).textContent.trim();
    const w = id => parseFloat(document.getElementById(id).style.width);
    const lab = id => [...document.getElementById(id).closest('.panel.stat')
      .querySelectorAll('.yf-pa span')].map(e => e.textContent.trim());
    return { expLab: lab('yfExpPlan'), incLab: lab('yfIncPlan'),
             expPlan: t('yfExpPlan'), incPlan: t('yfIncPlan'),
             expPlanW: w('yfExpPlanBar'), expActW: w('yfExpActBar') };
  });
  check(JSON.stringify(bars.expLab) === JSON.stringify(['Planned', 'Spend']) &&
        JSON.stringify(bars.incLab) === JSON.stringify(['Planned', 'Earned']),
    'the overview bars are labelled Spend and Earned',
    JSON.stringify([bars.expLab, bars.incLab]));
  check(bars.expPlan.replace(/[^0-9]/g, '') === String(14000 * 12) &&
        bars.incPlan.replace(/[^0-9]/g, '') === String(39600 * 12),
    'and show the monthly plan annualised', JSON.stringify([bars.expPlan, bars.incPlan]));
  /* Non-vacuity, stated as a RELATIONSHIP rather than a remembered width: both
     panels share one paMax, so any absolute threshold here is really an
     assertion about the other panel's numbers (bug class 12). What is actually
     claimed is that the track the plan is drawn on used the annualised figure
     too -- so the two bars' widths must be in the same ratio as their values. */
  {
    const wantRatio = (14000 * 12) / 13847;
    const gotRatio = bars.expPlanW / bars.expActW;
    check(Math.abs(gotRatio - wantRatio) / wantRatio < 0.02,
      'and the plan bar is drawn from the annualised figure, not left a sliver',
      `widths ${bars.expPlanW.toFixed(1)}% / ${bars.expActW.toFixed(1)}% = ${gotRatio.toFixed(2)}x, values ${wantRatio.toFixed(2)}x`);
  }

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

  /* ── 8d. the minus goes in FRONT of the dollar sign, everywhere ──────────
     8c above pinned this for the totals Diff cell, which is where it was found
     and fixed the first time. The fix lived in that one cell, so every other
     figure on the tab kept the fault: yf$ and yf$2 left the sign wherever
     toLocaleString put it, which for a currency is the wrong side.

     None of the figures involved is exotic. A year that spends more than it
     opened with plus everything it earned has a negative End, and Saved and
     Off-paper follow it down -- so the stat row read "$-6,400" while the
     ARCHIVES card for the same sealed year read "-$6,400" through arc$. One
     number, two tabs, two spellings; that disagreement is the check that
     matters most here, because it is the one a user would actually hit.

     The formatters are asserted directly as well as through the DOM: they are
     pure, the owner's standing instruction is unit tests, and a tile check
     alone would not catch yf$2 (which no tile uses). */
  const MINUS = '−';                                // U+2212, this tab's minus
  {
    const c3 = await browser.newContext();
    const p3 = await c3.newPage();
    await stub(p3);
    const perr = [];
    p3.on('pageerror', e => perr.push(e.message));
    await p3.goto(url, { waitUntil: 'load' });
    await p3.waitForTimeout(300);

    // Start 2,000, earn 1,000, spend 9,400 -> End -6,400, Saved -8,400.
    await p3.evaluate(y => {
      state.yfYear = y;
      state.yf.txns = [
        { id: 'n1', type: 'income',  date: y + '-01-15', amt: 1000, desc: 'Pay',  cat: 'Paycheck',   who: 'ABI', tab: 'yf' },
        { id: 'n2', type: 'expense', date: y + '-02-10', amt: 9000, desc: 'Roof', cat: 'Home',       who: 'ABI', tab: 'yf' },
        { id: 'n3', type: 'expense', date: y + '-03-10', amt:  400, desc: 'WS',   cat: 'Investment', who: 'ABI', tab: 'yf' },
      ];
      state.yf.planned = { [y]: {} };
      state.yf.start = { [y]: 2000 };
      if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
      render(); renderYF();
    }, YEAR);
    await goYearly(p3);

    const tiles = await p3.evaluate(() => {
      const t = id => (document.getElementById(id).textContent || '').trim();
      return { start: t('yfStartVal'), end: t('yfEndVal'), saved: t('yfSaved'),
               off: t('yfOffPaper'), big: t('yfSavedBig'),
               inv: t('yfInvested'), moved: t('yfMoved'),
               avgI: t('yfAvgInc'), avgE: t('yfAvgExp') };
    });
    /* The whole stat row at once: no figure anywhere on it may carry a minus
       AFTER the dollar sign. Stated over the collection rather than per tile,
       so a tile added later is covered without anyone remembering to. */
    check(Object.values(tiles).every(v => !/\$\s*[-−]/.test(v)),
      '8d: no Yearly stat tile prints the minus after the $', JSON.stringify(tiles));
    /* ...and the three that really are negative say so, rather than passing the
       check above by having quietly lost their sign. */
    check(tiles.end.startsWith(MINUS) && tiles.saved.startsWith(MINUS) && tiles.big.startsWith(MINUS),
      '8d: End, Saved and the big Saved figure still read as negative',
      JSON.stringify([tiles.end, tiles.saved, tiles.big]));
    check(tiles.end === MINUS + '$6,400' && tiles.saved === MINUS + '$8,400',
      '8d: and they are the right figures', JSON.stringify([tiles.end, tiles.saved]));
    /* A figure that rounds away must not print "-$0". */
    check(await p3.evaluate(() => yf$(-0.4)) === '$0',
      '8d: a value that rounds to zero loses the sign, not gains one',
      await p3.evaluate(() => yf$(-0.4)));

    const fmts = await p3.evaluate(() => ({
      neg: yf$(-6400), pos: yf$(6400), zero: yf$(0),
      neg2: yf$2(-45.25), pos2: yf$2(45.25),
      sign: yfSign$(-249), signPos: yfSign$(249),
    }));
    check(fmts.neg === MINUS + '$6,400' && fmts.pos === '$6,400' && fmts.zero === '$0',
      '8d: yf$ places the sign itself', JSON.stringify(fmts));
    /* yf$2 reaches no tile -- it is the transaction amount cell and the delete
       confirm -- and a Yearly refund row, or a Bill Payment (stored negative),
       is exactly what lands in it. */
    check(fmts.neg2 === MINUS + '$45.25' && fmts.pos2 === '$45.25',
      '8d: and so does yf$2, which a refund row reaches', JSON.stringify(fmts));
    check(fmts.sign === MINUS + '$249' && fmts.signPos === '$249',
      '8d: yfSign$ agrees with them', JSON.stringify(fmts));

    /* THE RECONCILIATION. Seal this very year and read the card: Archives has
       always printed these six through arc$, so before the fix the two tabs
       showed the same number spelled two different ways. Compared as text, in
       both directions, because that is the whole complaint. */
    await p3.evaluate(() => { arcAddYear(); });
    await p3.click('#viewSeg button[data-view="archive"]');
    await p3.waitForTimeout(300);
    await p3.evaluate(() => {
      const c = document.querySelector('#arcList .arc-card');
      if (c) c.click();
    });
    await p3.waitForTimeout(350);
    const card = await p3.evaluate(() => {
      const g = cls => {
        const el = document.querySelector('#archiveView b.' + cls);
        return el ? el.textContent.trim() : null;
      };
      return { start: g('sta'), end: g('end'), saved: g('sav'), off: g('off') };
    });
    check(card.end !== null,
      '8d: the sealed card is on screen to be compared against', JSON.stringify(card));
    check(card.end === tiles.end && card.saved === tiles.saved && card.start === tiles.start,
      '8d: the Archives card and the Yearly tiles spell the same year identically',
      JSON.stringify({ card, tiles: { start: tiles.start, end: tiles.end, saved: tiles.saved } }));

    check(perr.length === 0, '8d: no page errors', perr.join(' | '));
    await c3.close();
  }

  /* ── 8e. the opening balance and the budget are money, and are coerced as money
     normalizeYF() has put every row's `amt` through fin() since the non-finite
     pass, but `state.yf.start` and `state.yf.planned` were taken on trust --
     and `start` is read straight into `start + totInc - totExp`, which is the
     base of End, Saved and Growth. `+` concatenates when one side is a string,
     so a start of "8000" against $4,200 in and $1,750 out printed End as
     $80,002,450 and Growth as +999930.6%, beside a Start tile still reading an
     ordinary $8,000. "abc" is truthy, survives the `|| 0` fallback, makes End
     NaN, and yf$ prints NaN as "$0" -- a year holding $2,450 reading as empty.

     arcSnapshot computes the same six figures from the same expression on
     purpose, so whatever this does is SEALED INTO THE ARCHIVE as well: that is
     asserted here rather than left to 8d, because an archive is the record
     meant to be final.

     Section 8.3 is the class: `store.get(key, default)` only applies the
     default when the key is entirely ABSENT, so a partial or hand-edited cloud
     record walks straight past it. The string-year archive bug fixed earlier in
     this review was the same mistake in the same data. */
  console.log('\n── 8e. start and planned are coerced like the money they are ──');
  {
    const c4 = await browser.newContext();
    const p4 = await c4.newPage();
    await stub(p4);
    const perr4 = [];
    p4.on('pageerror', e => perr4.push(e.message));
    await p4.goto(url, { waitUntil: 'load' });
    await p4.waitForTimeout(300);

    /* Income 4,200 · expenses 1,450 + 300 · start "8000" as a STRING.
       Written WITHOUT rendering, so the shape can be asserted before anything
       normalises it -- otherwise this whole section could pass while proving
       nothing, having silently tested a number. */
    const pre = await p4.evaluate(y => {
      state.yfYear = y;
      state.yf.txns = [
        { id: 's1', type: 'income',  date: y + '-01-15', amt: 4200, desc: 'Pay',  cat: 'Paycheck', who: 'ABI', tab: 'yf' },
        { id: 's2', type: 'expense', date: y + '-01-19', amt: 1450, desc: 'Rent', cat: 'Home',     who: 'ABI', tab: 'yf' },
        { id: 's3', type: 'expense', date: y + '-02-04', amt:  300, desc: 'Food', cat: 'Grocery',  who: 'ABI', tab: 'yf' },
      ];
      state.yf.start = { [y]: '8000' };
      state.yf.planned = { [y]: { Home: '1450', Grocery: 300 } };
      if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
      if (!state.yf.cats.exp.includes('Grocery')) state.yf.cats.exp.push('Grocery');
      return { start: typeof state.yf.start[y], plan: typeof state.yf.planned[y].Home };
    }, YEAR);
    check(pre.start === 'string' && pre.plan === 'string',
      '8e: PRECONDITION — the start and the plan really did arrive as strings',
      JSON.stringify(pre));

    await p4.evaluate(() => { render(); renderYF(); });
    await goYearly(p4);
    const t4 = await p4.evaluate(() => {
      const t = id => (document.getElementById(id).textContent || '').trim();
      // by heading, never by position: these columns have been reordered before
      const head = [...document.querySelectorAll('#yfExpTable thead th')]
        .map(th => th.textContent.trim());
      const col = head.findIndex(h => /^Planned/.test(h));
      const totals = document.querySelector('#yfExpBody tr');
      return { start: t('yfStartVal'), end: t('yfEndVal'), saved: t('yfSaved'),
               off: t('yfOffPaper'), pct: t('yfPct'),
               planCol: col, planTot: col > -1 ? totals.children[col].textContent.trim() : null,
               snap: arcSnapshot(new Date().getFullYear()) };
    });
    check(t4.end === '$10,450', '8e: End is start + income − expenses, not a concatenation',
      t4.end);
    check(t4.saved === '$2,450' && t4.start === '$8,000',
      '8e: Saved and Start agree with it', JSON.stringify([t4.start, t4.saved]));
    check(t4.pct === '+30.6%', '8e: and Growth is a real percentage', t4.pct);
    check(t4.planCol > -1 && t4.planTot === '$1,750',
      '8e: the Planned total adds the budget instead of concatenating it', t4.planTot);
    /* The same figures as the tiles, because the archive is built from the same
       expression -- and NUMBERS, so nothing downstream of a seal inherits it. */
    check(t4.snap.stats.end === 10450 && typeof t4.snap.stats.start === 'number',
      '8e: and the figure sealed into an archive is a number that agrees',
      JSON.stringify(t4.snap.stats));

    /* "abc" has no number in it at all, so fin() makes it 0 -- visible and
       editable in the Start field, which is the trade fin() already states. */
    const junk = await p4.evaluate(y => {
      state.yf.start = { [y]: 'abc' };
      renderYF();
      const t = id => (document.getElementById(id).textContent || '').trim();
      return { start: t('yfStartVal'), end: t('yfEndVal'), saved: t('yfSaved') };
    }, YEAR);
    check(junk.end === '$2,450' && junk.start === '$0',
      '8e: a start with no number in it reads as $0 and leaves End standing',
      JSON.stringify(junk));

    /* THE KEY MUST SURVIVE whatever happens to the value. arcCarryStart() tests
       `now in state.yf.start` rather than a falsy test, specifically so a
       deliberately typed 0 is not re-seeded from last year's close -- so a
       coercion that dropped the key would hand that 0 back to the rollover. */
    const keys = await p4.evaluate(y => {
      const out = {};
      [0, null, 'abc', '0'].forEach((v, i) => {
        state.yf.start = { [y]: v };
        normalizeYF();
        out['v' + i] = { kept: Object.prototype.hasOwnProperty.call(state.yf.start, String(y)),
                         val: state.yf.start[y] };
      });
      return out;
    }, YEAR);
    check(Object.values(keys).every(r => r.kept && r.val === 0),
      '8e: a 0, a null and an unusable string all stay as a 0 under their own year',
      JSON.stringify(keys));

    check(perr4.length === 0, '8e: no page errors', perr4.join(' | '));
    await c4.close();
  }

  /* ── 8f. the category tables add up to their own Totals row ──────────────
     Totals is summed from the ROWS of the ledger; the rows beneath it were
     built from the configured list. A Yearly row can carry a category that is
     not on that list -- normalizeYF() replaces cats with the defaults whenever
     a partial or hand-edited cloud record arrives without one, which is
     recurring class 8.3 -- and the money then sat in the total and in no row:
     Totals $1,950 over rows adding to $1,450, with nothing saying where the
     other $500 was.
     arcSnapshot() has unioned the configured names with the ones the year's rows
     carry since the archives were built, so the live tab and the sealed card for
     the same year disagreed about this table. That disagreement is what
     arcSnapshot reusing these functions exists to prevent, so it is asserted
     here as well as the arithmetic. */
  console.log('\n── 8f. a category off the configured list still reports its money ──');
  {
    const c5 = await browser.newContext();
    const p5 = await c5.newPage();
    await stub(p5);
    const perr5 = [];
    p5.on('pageerror', e => perr5.push(e.message));
    await p5.goto(url, { waitUntil: 'load' });
    await p5.waitForTimeout(300);

    const OFF = 'Daycare';
    const pre5 = await p5.evaluate(([y, off]) => {
      state.yfYear = y;
      state.yf.txns = [
        { id: 'o1', type: 'income',  date: y + '-01-15', amt: 4200, desc: 'Pay',  cat: 'Paycheck', who: 'ABI', tab: 'yf' },
        { id: 'o2', type: 'expense', date: y + '-01-19', amt: 1450, desc: 'Rent', cat: 'Home',     who: 'ABI', tab: 'yf' },
        { id: 'o3', type: 'expense', date: y + '-02-04', amt:  500, desc: 'Sitter', cat: off,      who: 'ABI', tab: 'yf' },
      ];
      state.yf.start = { [y]: 8000 };
      state.yf.planned = { [y]: {} };
      if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
      state.yf.cats.exp = state.yf.cats.exp.filter(c => c !== off);
      render(); renderYF();
      return { onList: state.yf.cats.exp.includes(off), rowExists: state.yf.txns.some(t => t.cat === off) };
    }, [YEAR, OFF]);
    // the induced condition, stated: a row under a name the list does not hold
    check(!pre5.onList && pre5.rowExists,
      '8f: PRECONDITION — a row carries a category the configured list does not',
      JSON.stringify(pre5));

    await goYearly(p5);
    const tbl = await p5.evaluate(() => {
      const head = [...document.querySelectorAll('#yfExpTable thead th')]
        .map(th => th.textContent.trim().toLowerCase());
      const col = head.indexOf('spend');
      const rows = [...document.querySelectorAll('#yfExpBody tr')].map(tr => ({
        name: tr.children[0].textContent.trim(),
        act: parseFloat((tr.children[col].textContent || '').replace(/[^0-9.\-\u2212]/g, '')
          .replace('\u2212', '-')) || 0,
        btns: tr.querySelectorAll('.yf-catbtn').length,
      }));
      return { col, totals: rows[0], body: rows.slice(1),
               cardCats: arcSnapshot(new Date().getFullYear()).exp.map(r => r.c) };
    });
    const row = tbl.body.find(r => r.name === OFF);
    check(!!row && row.act === 500,
      '8f: the recovered category is a row of its own with its own figure',
      JSON.stringify(row));
    const sum = +tbl.body.reduce((t, r) => t + r.act, 0).toFixed(2);
    check(sum === tbl.totals.act && tbl.totals.act === 1950,
      '8f: and the rows now add up to the Totals row above them',
      `rows ${sum} vs totals ${tbl.totals.act}`);
    /* The pencil would be a dead control on a name the list does not hold --
       yfRenameCat returns silently at indexOf -1 -- so it is not offered. */
    check(row && row.btns === 0,
      '8f: it carries no rename or delete, which could not work on it',
      String(row && row.btns));
    check(tbl.body.some(r => r.name === 'Home' && r.btns === 2),
      '8f: a configured category still carries both');
    /* THE AGREEMENT. Every category the sealed card shows is on the live tab. */
    const names = tbl.body.map(r => r.name);
    check(tbl.cardCats.length > 0 && tbl.cardCats.every(c => names.includes(c)),
      '8f: and every category the Archives card would show is on the tab too',
      JSON.stringify(tbl.cardCats));

    check(perr5.length === 0, '8f: no page errors', perr5.join(' | '));
    await c5.close();
  }

  /* ── 8g. a Spend that nets below zero draws no bar ───────────────────
     A year whose refunds outweigh its charges has a negative Spend, which is an
     ordinary documented row shape. `width:-8.33%` is invalid CSS, so the
     declaration is DROPPED and the element keeps the width it was last given --
     the bar goes on describing the previous year rather than this one. That is
     the same shape as the all-refund month that painted a bar five times its
     track on Monthly, and it is asserted the same way: by driving an ordinary
     year first, so there is a stale width in place to notice. */
  console.log('\n── 8g. a negative Spend clears its bar instead of keeping the last one ──');
  const c6 = await browser.newContext();
  const p6 = await c6.newPage();
  await stub(p6);
  const perr6 = [];
  p6.on('pageerror', e => perr6.push(e.message));
  await p6.goto(url, { waitUntil: 'load' });
  await p6.waitForTimeout(300);
  const barOf = () => p6.evaluate(() => ({
    w: document.getElementById('yfExpActBar').style.width,
    fig: (document.getElementById('yfExpAct').textContent || '').trim(),
  }));
  await p6.evaluate(y => {
    state.yfYear = y;
    state.yf.txns = [
      { id: 'h1', type: 'expense', date: y + '-01-10', amt: 9000, desc: 'Reno', cat: 'Home',     who: 'ABI', tab: 'yf' },
      { id: 'h2', type: 'income',  date: y + '-01-01', amt: 9000, desc: 'Pay',  cat: 'Paycheck', who: 'ABI', tab: 'yf' },
    ];
    state.yf.start = { [y]: 1000 };
    state.yf.planned = { [y]: { Home: 500 } };
    if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
    renderYF();
  }, YEAR);
  await goYearly(p6);
  const heavy = await barOf();
  // without a width already in place, "0%" below would prove nothing
  check(heavy.w === '100%',
    '8g: PRECONDITION — an ordinary year leaves the Spend bar at a real width',
    JSON.stringify(heavy));

  await p6.evaluate(y => {
    state.yf.txns = [
      { id: 'f1', type: 'expense', date: y + '-02-05', amt:  200, desc: 'Jacket',   cat: 'Home',     who: 'ABI', tab: 'yf' },
      { id: 'f2', type: 'expense', date: y + '-02-20', amt: -700, desc: 'Returned', cat: 'Home',     who: 'ABI', tab: 'yf' },
      { id: 'f3', type: 'income',  date: y + '-02-01', amt: 3000, desc: 'Pay',      cat: 'Paycheck', who: 'ABI', tab: 'yf' },
    ];
    renderYF();
  }, YEAR);
  await p6.waitForTimeout(150);
  const refund = await barOf();
  check(refund.fig === '−$500',
    "8g: PRECONDITION — the year's Spend really does come out below zero", refund.fig);
  check(refund.w === '0%',
    '8g: so the bar is cleared, not left at the previous year\'s length', refund.w);
  /* The figure beside it carries the meaning, exactly as a negative category
     does on Monthly: the bar says nothing rather than something false. */
  check((await p6.evaluate(() => document.getElementById('yfExpAct').textContent)).startsWith('−'),
    '8g: and the signed figure beside it still reads as negative');
  /* ── 8h. the two controls under the tables say what they do ────────────
     The refusal on a category that is in use ended "Its amount must be $0
     first", and a user who did exactly that was refused again: the guard counts
     ROWS, and a $0 row is still a row. An instruction that does not work is
     worse than no instruction, because it is followed.
     The month picker is the other half: it always offers twelve, and the two
     comments above it claimed otherwise -- one said it listed only the months
     holding records, which is what it used to do. */
  console.log('\n── 8h. the category refusal and the month picker ──');
  const del = await p6.evaluate(y => {
    state.yfYear = y;
    state.yf.txns = [{ id: 'z1', type: 'expense', date: y + '-04-04', amt: 0,
                       desc: 'zeroed', cat: 'Home', who: 'ABI', tab: 'yf' }];
    if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
    renderYF();
    const zero = state.yf.txns[0].amt === 0;
    yfDeleteCat('expense', 'Home');          // refuses before any confirm()
    return { zero, msg: document.getElementById('toast').textContent,
             stillThere: state.yf.cats.exp.includes('Home') };
  }, YEAR);
  // the whole point is that the row's amount is ALREADY zero
  check(del.zero, '8h: PRECONDITION — the only row against the category is $0',
    String(del.zero));
  check(del.stillThere && /1 transaction uses it/.test(del.msg),
    '8h: a $0 row still blocks the delete, and the count is what it names', del.msg);
  check(!/\$0/.test(del.msg),
    '8h: and it no longer tells the user to do the thing that does not work', del.msg);

  const months = await p6.evaluate(() => {
    const opts = [...document.getElementById('yfTxMonth').options].map(o => o.value);
    return { n: opts.length, first: opts[0], hasFeb: opts.includes('02') };
  });
  check(months.n === 13 && months.first === 'all' && months.hasFeb,
    '8h: the month picker offers all twelve plus All, on a year with one record',
    JSON.stringify(months));

  /* ── 8i. a date that is not a YYYY-MM-DD string ────────────────────
     Four readers do `t.date.slice(...)` or `date.localeCompare` without asking
     what they have, so a row whose date is the NUMBER 2026 threw. The throw is
     the interesting part: renderYF() catches its own body, so the tab rendered
     NOTHING and every tile kept whatever it last said; arcSnapshot() does not,
     so the same row ALSO took out the rollover, whose try/catch then swallowed
     the skipped seal -- the failure the prev.stats guard exists for.
     Checked by driving a good year first, so "the tiles are right" cannot pass
     on a tab that simply never repainted. */
  console.log('\n── 8i. a row whose date is not a string ──');
  await p6.evaluate(y => {
    state.yfYear = y;
    state.yf.txns = [{ id: 'd0', type: 'income', date: y + '-01-10', amt: 1000,
                       desc: 'Pay', cat: 'Paycheck', who: 'ABI', tab: 'yf' }];
    state.yf.start = { [y]: 0 };
    state.yf.planned = { [y]: {} };
    renderYF();
  }, YEAR);
  const before9 = await p6.evaluate(() => (document.getElementById('yfEndVal').textContent || '').trim());
  check(before9 === '$1,000',
    '8i: PRECONDITION — the tab is painting a known figure before the bad row',
    before9);

  const bad = await p6.evaluate(y => {
    state.yf.txns.push({ id: 'd1', type: 'expense', date: y, amt: 250,
                         desc: 'numeric date', cat: 'Home', who: 'ABI', tab: 'yf' });
    const wasNumber = typeof state.yf.txns[1].date === 'number';
    let threw = null;
    try { renderYF() } catch (e) { threw = e.message }
    const t = id => (document.getElementById(id).textContent || '').trim();
    let snapErr = null, snap = null;
    try { snap = arcSnapshot(y).stats } catch (e) { snapErr = e.message }
    return { wasNumber, threw, snapErr, snap,
             repaired: state.yf.txns[1].date,
             end: t('yfEndVal'), rows: document.querySelectorAll('#yfTxBody tr').length,
             sumsAgree: (() => {
               const head = [...document.querySelectorAll('#yfExpTable thead th')]
                 .map(th => th.textContent.trim().toLowerCase());
               const col = head.indexOf('spend');
               const rows = [...document.querySelectorAll('#yfExpBody tr')];
               const num = tr => parseFloat((tr.children[col].textContent || '')
                 .replace(/[^0-9.\-\u2212]/g, '').replace('\u2212', '-')) || 0;
               const tot = num(rows[0]);
               const sum = +rows.slice(1).reduce((a, tr) => a + num(tr), 0).toFixed(2);
               return { tot, sum };
             })() };
  }, YEAR);
  // the induced shape has to have been the thing it says it was
  check(bad.wasNumber, '8i: PRECONDITION — the row really did carry a numeric date',
    String(bad.wasNumber));
  check(bad.repaired === YEAR + '-01-15',
    '8i: it is repaired to a real date in the year it named, mid-month',
    JSON.stringify(bad.repaired));
  check(bad.end === '$750',
    '8i: and the tab still paints — End counts the row rather than freezing',
    bad.end);
  check(bad.snapErr === null && bad.snap && bad.snap.end === 750,
    '8i: arcSnapshot does not throw either, so the rollover still seals',
    JSON.stringify([bad.snapErr, bad.snap && bad.snap.end]));
  /* The repair has to land it in a MONTH as well as a year: the month buckets
     are what End and the Totals row are summed from, while the category rows
     are summed from the list, so a row in no month would split the two. */
  check(bad.sumsAgree.tot === 250 && bad.sumsAgree.sum === 250,
    '8i: and the Totals row and the category rows still agree about it',
    JSON.stringify(bad.sumsAgree));

  /* ── 8j. a row carrying neither 'income' nor 'expense' ───────────────
     Three figures test for 'expense' and one for 'income', so a row with
     neither counted in nothing -- not in yfSpendOf, not in a month bucket, not
     in a category row. The transaction list showed it anyway, under the EXP
     tag, because that cell reads `t.type==='income'?'IN':'EXP'`: money on
     screen, in no total. normalizePlan folds a plan item's type the same way. */
  console.log('\n── 8j. a row with no type at all ──');
  const noType = await p6.evaluate(y => {
    state.yfYear = y;
    state.yf.txns = [
      { id: 'n1', type: 'income', date: y + '-01-10', amt: 1000, desc: 'Pay', cat: 'Paycheck', who: 'ABI', tab: 'yf' },
      { id: 'n2',                 date: y + '-02-10', amt:  100, desc: 'no type', cat: 'Home', who: 'ABI', tab: 'yf' },
      { id: 'n3', type: 'Income', date: y + '-03-10', amt:  200, desc: 'capital I', cat: 'Paycheck', who: 'ABI', tab: 'yf' },
    ];
    state.yf.start = { [y]: 0 };
    state.yf.planned = { [y]: {} };
    const before = { two: state.yf.txns[1].type, three: state.yf.txns[2].type };
    renderYF();
    const t = id => (document.getElementById(id).textContent || '').trim();
    const tags = [...document.querySelectorAll('#yfTxBody tr')]
      .map(tr => tr.children[1].textContent.trim());
    return { before, types: state.yf.txns.map(x => x.type), tags,
             end: t('yfEndVal'), saved: t('yfSaved') };
  }, YEAR);
  check(noType.before.two === undefined && noType.before.three === 'Income',
    "8j: PRECONDITION — one row had no type and one had 'Income'",
    JSON.stringify(noType.before));
  check(JSON.stringify(noType.types) === JSON.stringify(['income', 'expense', 'income']),
    '8j: a missing type folds to expense, which is how the list already labelled it',
    JSON.stringify(noType.types));
  /* 1,000 in + 200 in − 100 out = 1,100. Before, the 100 was in no figure and
     the 200 was an EXPENSE, so End read 800 on the same three rows. */
  check(noType.end === '$1,100' && noType.saved === '$1,100',
    '8j: and every row now counts — in the direction it was labelled',
    JSON.stringify([noType.end, noType.saved]));
  check(JSON.stringify(noType.tags) === JSON.stringify(['IN', 'EXP', 'IN']),
    "8j: 'Income' stays income rather than crossing the year", JSON.stringify(noType.tags));

  /* ── 8k. a Diff that rounds away is nothing, not minus nothing ────────
     yf$ collapses a figure that rounds to zero so it cannot print "-$0" -- its
     comment says exactly that -- and diffCell then put the sign back on by
     hand, off the RAW value. The Monthly basis is `act/nowM`, so a plan within
     a few cents of the rate it is judged against lands there: a $100 plan
     against $1,004 over ten months is -0.40 precisely. It read "−0" in the
     over-spent colour: a category reported as over budget by nothing. */
  console.log('\n── 8k. a Diff of forty cents under ──');
  const tiny = await p6.evaluate(y => {
    const nowM = (y === new Date().getFullYear()) ? (new Date().getMonth() + 1) : 12;
    state.yfYear = y;
    // act/nowM comes to 100.40 exactly, against a plan of 100 -> diff -0.40
    state.yf.txns = [{ id: 'y1', type: 'expense', date: y + '-01-10', amt: 100.4 * nowM,
                       desc: 'rate', cat: 'Home', who: 'ABI', tab: 'yf' }];
    state.yf.start = { [y]: 0 };
    state.yf.planned = { [y]: { Home: 100 } };
    if (!state.yf.cats.exp.includes('Home')) state.yf.cats.exp.push('Home');
    renderYF();
    const head = [...document.querySelectorAll('#yfExpTable thead th')]
      .map(th => th.textContent.trim().toLowerCase());
    const col = head.findIndex(h => /^diff/.test(h));
    const tr = [...document.querySelectorAll('#yfExpBody tr')]
      .find(r => r.children[0].textContent.trim() === 'Home');
    const cell = tr && tr.children[col];
    return { nowM, raw: 100 - 100.4, col,
             txt: cell && cell.textContent.trim(), cls: cell && cell.className,
             sign: yfSign$(-0.4) };
  }, YEAR);
  // the fixture only means something if the Diff really is a hair below zero
  check(Math.abs(tiny.raw + 0.4) < 1e-9 && tiny.col > 0,
    '8k: PRECONDITION — the Diff for this row is −0.40 and the column was found',
    JSON.stringify({ raw: tiny.raw, col: tiny.col }));
  check(tiny.txt === '$0', '8k: it prints $0, with no sign in front of it', JSON.stringify(tiny.txt));
  check(tiny.cls === '', '8k: and in no colour, since it is neither over nor under',
    JSON.stringify(tiny.cls));
  check(tiny.sign === '$0', '8k: yfSign$ agrees — a bill note of −$0.40 reads $0', tiny.sign);

  /* ── 8l. a Yearly row with no category at all ─────────────────────
     Yearly files everything by category, so a row carrying none counts in the
     Totals figure and in no row of the table under it -- and the configured list
     can legitimately be EMPTY, since deleting a category is refused only while
     rows use it. An empty <select> has value '', which went straight into the
     ledger. The picker cannot offer a category that does not exist, so the form
     is the only place that can say so. Add Expense already refuses a Bill
     Payment with no bill for the same stated reason.
     The highlight card is the second half: it printed the category in brackets
     unconditionally, so such a row read "(undefined)" on the carousel. */
  console.log('\n── 8l. a row with no category ──');
  const guard = await p6.evaluate(y => {
    state.yfYear = y;
    state.yf.txns = [];
    state.yf.start = { [y]: 0 };
    state.yf.planned = { [y]: {} };
    state.yf.cats.exp = [];                 // every expense category deleted
    /* The type FIRST: yfFillCats() fills the picker from whichever side
       #yfType is on, so filling it while the form still said Income listed the
       income categories and the save below was an ordinary one -- the
       precondition caught exactly that. */
    document.getElementById('yfType').value = 'expense';
    yfFillCats(); renderYF();
    const sel = document.getElementById('yfCat');
    const pickerEmpty = sel.options.length === 0 && sel.value === '';
    document.getElementById('yfDate').value = y + '-05-05';
    document.getElementById('yfAmt').value = '500';
    document.getElementById('yfDesc').value = 'no category';
    yfSaveTx();
    return { pickerEmpty, n: state.yf.txns.length,
             msg: document.getElementById('toast').textContent };
  }, YEAR);
  // if the picker still had a value, the save below would be an ordinary one
  check(guard.pickerEmpty,
    '8l: PRECONDITION — with no categories configured the picker has no value',
    JSON.stringify(guard.pickerEmpty));
  check(guard.n === 0 && /category first/.test(guard.msg),
    '8l: the row is refused rather than filed under nothing', JSON.stringify(guard));

  const hl = await p6.evaluate(y => {
    state.yf.cats.exp = ['Home'];
    state.yf.txns = [
      { id: 'u1', type: 'expense', date: y + '-01-05', amt: 500, desc: 'A', who: 'ABI', tab: 'yf' },
      { id: 'u2', type: 'expense', date: y + '-02-05', amt: 100, desc: 'B', cat: 'Home', who: 'ABI', tab: 'yf' },
      { id: 'u3', type: 'income',  date: y + '-01-01', amt: 9000, desc: 'Pay', cat: 'Paycheck', who: 'ABI', tab: 'yf' },
    ];
    renderYF();
    return { noCat: state.yf.txns[0].cat === undefined,
             lines: [...document.querySelectorAll('#yfHiSlides .yf-hi-l')].map(e => e.textContent) };
  }, YEAR);
  // an older file can still hold one, which is what the card has to survive
  check(hl.noCat, '8l: PRECONDITION — the largest expense is a row with no category',
    String(hl.noCat));
  check(hl.lines.some(l => /\$500\.00 on A/.test(l)),
    '8l: the Largest single expense card still names it', JSON.stringify(hl.lines.find(l => /on A/.test(l))));
  check(!hl.lines.some(l => /undefined/.test(l)),
    '8l: and no card prints "(undefined)" for the category it does not have',
    JSON.stringify(hl.lines.filter(l => /undefined/.test(l))));

  check(perr6.length === 0, '8g: no page errors', perr6.join(' | '));
  await c6.close();

  /* ── 8m. a refund month is a month ─────────────────────────────────────
     expM/incM/dataM used to test `>0`, so a month whose refunds outweighed its
     charges was dropped from the Highlights entirely. Two figures came out
     wrong and neither looked wrong: the month could not be named the leanest
     though it is by definition the leanest, and the "average month" was
     averaged over the OTHER months, inflating every "% above average" line
     against it. Four cheap months + one refund month gives both a leanest
     candidate and an average that visibly moves. */
  console.log('\n── 8m. a month whose refunds outran its charges ──');
  {
    const c7 = await browser.newContext();
    const p7 = await c7.newPage(); await stub(p7);
    const perr7 = []; p7.on('pageerror', e => perr7.push(e.message));
    await p7.goto(url, { waitUntil: 'load' }); await p7.waitForTimeout(300);
    const TX = [
      { type: 'income',  date: `${YEAR}-01-01`, amt: 4000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-01-05`, amt: 1000, desc: 'Jan', cat: 'Food', who: 'ABI' },
      { type: 'income',  date: `${YEAR}-02-01`, amt: 4000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-02-05`, amt: 1200, desc: 'Feb', cat: 'Food', who: 'ABI' },
      { type: 'income',  date: `${YEAR}-03-01`, amt: 4000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-03-05`, amt: 1400, desc: 'Mar', cat: 'Food', who: 'ABI' },
      { type: 'income',  date: `${YEAR}-04-01`, amt: 4000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-04-05`, amt: 3000, desc: 'Apr', cat: 'Food', who: 'ABI' },
      // May: one small charge and a bigger refund, so the month nets to -400
      { type: 'income',  date: `${YEAR}-05-01`, amt: 4000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-05-05`, amt: 100,  desc: 'May', cat: 'Food', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-05-20`, amt: -500, desc: 'Refund', cat: 'Food', who: 'ABI' },
    ];
    await seed(p7, TX, { Food: 3000 });
    await goYearly(p7);
    const c = await cards(p7);
    const find = re => c.find(x => re.test(x.title) || re.test(x.line));

    // the precondition: May really does net below zero, or the rest proves nothing
    const may = await p7.evaluate(() => {
      const d = [...Array(12).keys()].map(i => 0);
      state.yf.txns.filter(t => t.type === 'expense' && t.date.slice(0, 4) === String(state.yfYear))
        .forEach(t => { d[+t.date.slice(5, 7) - 1] += t.amt });
      return { may: Math.round(d[4] * 100) / 100, months: d.map(v => Math.round(v)) };
    });
    check(may.may < 0, '8m: the fixture really has a month that nets below zero',
      JSON.stringify(may.may));

    const lean = find(/Leanest month/);
    check(!!lean && /MAY/i.test(lean.line),
      '8m: the refund month IS the leanest month, rather than being skipped',
      lean ? lean.line : '(no Leanest card at all)');
    check(!!lean && /refunds outran spending/.test(lean.line),
      '8m: ...and it says so, instead of "you spent just \u2212$400.00"',
      lean ? lean.line : '');

    /* The average is the half that is easy to miss. Charges are
       1000+1200+1400+3000-400 = 6200 over FIVE months = $1,240. Excluding May it
       would be 6600/4 = $1,650, and the peak's "% above average" would be
       computed against that inflated figure. */
    const peak = find(/Biggest spending month/);
    check(!!peak && /1,240/.test(peak.line),
      '8m: the average month counts the refund month, so it reads $1,240 not $1,650',
      peak ? peak.line : '(no peak card)');
    check(!!peak && /142% above/.test(peak.line),
      '8m: and the "% above average" follows from it (3000 vs 1240 = 142%)',
      peak ? peak.line : '');
    check(perr7.length === 0, '8m: no page errors', perr7.join(' | '));
    await c7.close();
  }

  /* ── 8n. growth with nothing to grow from ──────────────────────────────
     `growth` was `start>0 ? (end/start-1)*100 : 0`, so a year with no opening
     balance printed "+0.0%" in the green slot -- a year that went from $0 to
     $12,000 reporting no growth at all, in the one figure that tile exists for.
     Both tabs are asserted, because the expression served Yearly and Archives
     alike and they must not disagree about one sealed year. */
  console.log('\n── 8n. growth from a zero start is a dash, on both tabs ──');
  {
    const c8 = await browser.newContext();
    const p8 = await c8.newPage(); await stub(p8);
    const perr8 = []; p8.on('pageerror', e => perr8.push(e.message));
    await p8.goto(url, { waitUntil: 'load' }); await p8.waitForTimeout(300);
    const TX = [
      { type: 'income',  date: `${YEAR}-02-01`, amt: 9000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'income',  date: `${YEAR}-05-01`, amt: 5000, desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-03-05`, amt: 2000, desc: 'Mar', cat: 'Food', who: 'ABI' },
    ];
    await seed(p8, TX, { Food: 1000 });
    const zero = await p8.evaluate(yr => {
      delete state.yf.start[yr];                 // the ordinary case: never typed one
      renderYF();
      const el = document.getElementById('yfPct');
      return { start: state.yf.start[yr], txt: el.textContent, cls: el.className,
               end: document.getElementById('yfEndVal').textContent };
    }, YEAR);
    check(zero.start === undefined, '8n: the year genuinely has no opening balance',
      String(zero.start));
    check(/\d/.test(zero.end) && !/^\$0/.test(zero.end),
      '8n: ...while it really did end with money in it, so growth is not trivially nothing',
      zero.end);
    check(zero.txt === '\u2014', '8n: Yearly shows a dash, not "+0.0%"', zero.txt);
    check(/yf-na/.test(zero.cls) && !/sparkle-green|yf-neg/.test(zero.cls),
      '8n: ...in neither the rose nor the green, because it is undefined not good',
      zero.cls);

    // a genuine 0% year must still read +0.0% -- the two cases are NOT the same
    const real0 = await p8.evaluate(yr => {
      state.yf.start[yr] = 7000;
      state.yf.txns = [{ id: 'z1', type: 'income', date: yr + '-02-01', amt: 1000,
                         desc: 'Pay', cat: 'Paycheck', who: 'ABI' },
                       { id: 'z2', type: 'expense', date: yr + '-03-01', amt: 1000,
                         desc: 'Out', cat: 'Food', who: 'ABI' }];
      renderYF();
      const el = document.getElementById('yfPct');
      return { txt: el.textContent, cls: el.className };
    }, YEAR);
    check(real0.txt === '+0.0%' && !/yf-na/.test(real0.cls),
      '8n: a year that genuinely grew 0% still reads +0.0%, so the dash means only "undefined"',
      JSON.stringify(real0));

    // and the Archives card for a zero-start year says the same thing
    const arc = await p8.evaluate(() => {
      state.archives = [{ id: 'z', year: 2024, sealed: true,
        stats: { start: 0, end: 12000, invested: 0, moved: 0, saved: 12000,
                 offPaper: 12000, growth: 0 },
        entries: 3, entriesYf: 3, entriesMe: 0, exp: [], inc: [],
        mInc: Array(12).fill(0), mExp: Array(12).fill(0), meInc: Array(12).fill(0),
        contrib: { abiT: 0, abiF: 0, pooT: 0, pooF: 0 }, highlights: [], byCat: {} }];
      normalizeArchives(); renderArchives();
      const em = document.querySelector('#arcList .ay-gro em');
      return em ? { txt: em.textContent, cls: em.className } : null;
    });
    check(arc && arc.txt === '\u2014',
      '8n: the Archives card for the same shape shows a dash too, so the tabs agree',
      arc ? arc.txt : '(no growth slot found)');
    check(arc && /na/.test(arc.cls) && !/dn/.test(arc.cls),
      '8n: ...and in the neutral colour rather than the green it hardcodes',
      arc ? arc.cls : '');
    check(perr8.length === 0, '8n: no page errors', perr8.join(' | '));
    await c8.close();
  }

  /* ── 8o. the two category names the tiles read by name ────────────────
     Invested, Moved else and Off-paper are `yfActual('expense','Investment')`
     and `yfActual('expense','Other Bank')` -- literals, in renderYF and again
     in arcSnapshot. Renaming either category left those lookups pointing at a
     name that no longer existed, so three tiles read $0 while the money stayed
     in the rows, on the tab AND in every archive sealed from then on. The names
     are fixed now; what follows asserts the refusal, that it is visible before
     it is clicked, that it costs the ordinary categories nothing, and that the
     tiles still read the money. */
  console.log('\n── 8o. Invested/Moved else are keyed to names that cannot move ──');
  {
    const c9 = await browser.newContext();
    const p9 = await c9.newPage(); await stub(p9);
    const perr9 = []; p9.on('pageerror', e => perr9.push(e.message));
    await p9.goto(url, { waitUntil: 'load' }); await p9.waitForTimeout(300);
    const TX = [
      { type: 'income',  date: `${YEAR}-01-01`, amt: 40000, desc: 'Pay',   cat: 'Paycheck',   who: 'ABI' },
      { type: 'expense', date: `${YEAR}-02-05`, amt: 6000,  desc: 'TFSA',  cat: 'Investment', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-03-05`, amt: 2500,  desc: 'xfer',  cat: 'Other Bank', who: 'ABI' },
      { type: 'expense', date: `${YEAR}-04-05`, amt: 1200,  desc: 'Food',  cat: 'Food',       who: 'ABI' },
    ];
    await seed(p9, TX, {});
    await goYearly(p9);

    // the precondition: the tiles are reading the two categories to begin with
    const before = await p9.evaluate(() => ({
      inv: $('yfInvested').textContent, mov: $('yfMoved').textContent,
      off: $('yfOffPaper').textContent,
    }));
    check(/6,000/.test(before.inv) && /2,500/.test(before.mov),
      '8o: the fixture really has money in both wired categories',
      JSON.stringify(before));

    // 1. the rename is refused, by name, and nothing in the record moves
    const ren = await p9.evaluate(() => {
      let asked = false;
      const realPrompt = window.prompt;
      window.prompt = (...a) => { asked = true; return realPrompt.apply(window, a) };
      const before = JSON.stringify(state.yf.cats.exp);
      yfRenameCat('expense', 'Investment');
      const t = document.querySelector('#toastWrap .toast, .toast');
      window.prompt = realPrompt;
      return { asked, same: JSON.stringify(state.yf.cats.exp) === before,
               toast: t ? t.textContent : '' };
    });
    check(ren.asked === false,
      '8o: renaming Investment never even opens the prompt', JSON.stringify(ren.asked));
    check(ren.same, '8o: ...and the category list is untouched');
    check(/Invested/.test(ren.toast) && /fixed/.test(ren.toast),
      '8o: ...and the toast names the tile that depends on it, not just "no"',
      ren.toast);

    // 2. the delete is refused too -- the quieter half: allowed whenever the
    //    category has no rows yet, and it removes the only name those tiles read
    const del = await p9.evaluate(() => {
      let confirmed = false;
      const realConfirm = window.confirm;
      window.confirm = () => { confirmed = true; return true };
      state.yf.txns = state.yf.txns.filter(t => t.cat !== 'Other Bank');  // no rows left
      yfDeleteCat('expense', 'Other Bank');
      window.confirm = realConfirm;
      const t = document.querySelector('#toastWrap .toast, .toast');
      return { confirmed, still: state.yf.cats.exp.includes('Other Bank'),
               toast: t ? t.textContent : '' };
    });
    check(del.confirmed === false,
      '8o: deleting an empty Other Bank never reaches the confirm',
      JSON.stringify(del.confirmed));
    check(del.still, '8o: ...and the name is still on the list');
    check(/Moved else/.test(del.toast),
      '8o: ...and the toast names the Moved else tile', del.toast);

    // 3. an ordinary category is unaffected -- the guard is two names, not a freeze
    const ord = await p9.evaluate(() => {
      window.prompt = () => 'Groceries';
      yfRenameCat('expense', 'Food');
      return { has: state.yf.cats.exp.includes('Groceries'),
               gone: !state.yf.cats.exp.includes('Food'),
               moved: state.yf.txns.filter(t => t.cat === 'Groceries').length };
    });
    check(ord.has && ord.gone && ord.moved === 1,
      '8o: renaming Food still works and still carries its row', JSON.stringify(ord));

    // 4. the table says so before it is clicked, rather than only after
    const btns = await p9.evaluate(() => {
      renderYF();
      const row = [...document.querySelectorAll('#yfExpTable tr, #yfExpBody tr')]
        .find(tr => tr.cells[0] && tr.cells[0].textContent.trim() === 'Investment');
      if (!row) return null;
      const b = [...row.querySelectorAll('.yf-catbtn')];
      return { n: b.length, off: b.every(x => x.classList.contains('is-off')),
               titles: b.map(x => x.title).join(' | ') };
    });
    check(btns && btns.n === 2,
      '8o: the wired row keeps both controls -- a missing cell reads as a bug, not a rule',
      btns ? JSON.stringify(btns.n) : '(row not found)');
    check(btns && btns.off,
      '8o: ...dimmed with the same token the disabled Clear button uses',
      btns ? JSON.stringify(btns.off) : '');
    check(btns && /Invested/.test(btns.titles) && /fixed/.test(btns.titles),
      '8o: ...and the reason is in the tooltip', btns ? btns.titles : '');

    // 5. a record that already lost a wired name gets it back, without moving money
    const rep = await p9.evaluate(() => {
      state.yf.cats.exp = state.yf.cats.exp.filter(c => c !== 'Investment');
      state.yf.txns.push({ id: 'legacy', type: 'expense', date: '2026-05-05',
                           amt: 999, desc: 'renamed away', cat: 'Stocks', tab: 'yf' });
      normalizeYF();
      return { back: state.yf.cats.exp.includes('Investment'),
               kept: state.yf.txns.some(t => t.cat === 'Stocks' && t.amt === 999) };
    });
    check(rep.back,
      '8o: normalizeYF puts a missing wired name back, so the tile is not dead for good',
      JSON.stringify(rep.back));
    check(rep.kept,
      '8o: ...and it moves nothing -- the rows filed under the new name stay there',
      JSON.stringify(rep.kept));
    check(perr9.length === 0, '8o: no page errors', perr9.join(' | '));
    await c9.close();
  }

  await browser.close(); srv.close();
  console.log(`\nYF HIGHLIGHTS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
