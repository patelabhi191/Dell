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

  await browser.close(); srv.close();
  console.log(`\nYF HIGHLIGHTS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
