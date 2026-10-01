/* Archives: one sealed card per closed year.

   The promise an archive makes is that it still says what it said. So the two
   things worth testing hardest are (a) that a freshly taken snapshot agrees
   with the Yearly tab it was taken from, figure for figure, and (b) that it
   STOPS agreeing the moment the ledger moves underneath it — a card that
   quietly re-derives itself is a live view wearing an archive's clothes.

   Both are written so they can fail: the "snapshot" checks first prove the live
   tab really did change, so a card that merely never updates anything would not
   sail through. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

const Y = new Date().getFullYear();
const pad = m => String(m).padStart(2, '0');

/* A ledger with a known answer, built so every figure the card shows is
   separable by hand:
     income   9 x 6000                       = 54,000
     Rent     9 x 2000                       = 18,000
     Investment 9 x 700                      =  6,300   -> "Invested"
     Other Bank 9 x 250                      =  2,250   -> "Moved else"
   plus one Yearly bill and one Monthly row allotted to it (the allocation must
   NOT be counted again as spending), one Monthly row that is not allotted, and
   one row in the previous year that must not appear at all. */
const BILL_ID = 'bill-visa';
function ledger() {
  const t = [];
  for (let m = 1; m <= 9; m++) {
    t.push({ id: 'i' + m, date: `${Y}-${pad(m)}-12`, type: 'income', cat: 'Paycheck', desc: 'pay', amt: 6000, who: 'ABI', tab: 'yf' });
    t.push({ id: 'r' + m, date: `${Y}-${pad(m)}-12`, type: 'expense', cat: 'Rent', desc: 'rent', amt: 2000, who: 'ABI', tab: 'yf' });
    t.push({ id: 'v' + m, date: `${Y}-${pad(m)}-12`, type: 'expense', cat: 'Investment', desc: 'inv', amt: 700, who: 'ABI', tab: 'yf' });
    t.push({ id: 'o' + m, date: `${Y}-${pad(m)}-12`, type: 'expense', cat: 'Other Bank', desc: 'mov', amt: 250, who: 'ABI', tab: 'yf' });
  }
  t.push({ id: BILL_ID, date: `${Y}-02-01`, type: 'expense', cat: 'Credit Card', desc: 'Visa', amt: 500, who: 'ABI', tab: 'yf' });
  // a Monthly row allotted to that bill: it is spent out of the bill, not on top of it
  t.push({ id: 'mall', date: `${Y}-02-09`, type: 'expense', cat: 'Grocery', desc: 'on the card', amt: 120, who: 'ABI', tab: 'me', allot: BILL_ID, allotM: `${Y}-02` });
  // ordinary Monthly rows, which belong in the category grid
  for (let m = 1; m <= 6; m++)
    t.push({ id: 'g' + m, date: `${Y}-${pad(m)}-05`, type: 'expense', cat: 'Grocery', desc: 'shop', amt: 400, who: 'ABI', tab: 'me' });
  t.push({ id: 'd1', date: `${Y}-03-18`, type: 'expense', cat: 'Dining', desc: 'out', amt: 160, who: 'POO', tab: 'me' });
  // last year — must not reach this year's card at all
  t.push({ id: 'old', date: `${Y - 1}-05-05`, type: 'income', cat: 'Paycheck', desc: 'old', amt: 99999, who: 'ABI', tab: 'yf' });
  return t;
}
const ledgerLen = ledger().length;
const START = 13554;
const INC = 54000, RENT = 18000, INV = 6300, MOV = 2250, BILL = 500;
const EXP = RENT + INV + MOV + BILL;            // allotted Monthly rows excluded

const seed = Object.assign({}, SEED, {
  'sparta.yf.data': JSON.stringify({ txns: ledger(), start: { [Y]: START }, planned: {} }),
});

const goArchive = async page => {
  await page.click('#viewSeg button[data-view="archive"]');
  await page.waitForFunction(() => document.getElementById('archiveView').style.display === 'block');
};
const card = () => document.querySelector('.ay');
const stat = k => (document.querySelector('.ay-s b.' + k) || {}).textContent;

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url, seed);
  // Add year asks WHICH year, so a prompt has to be answered with one — Playwright's
  // bare accept() sends an empty string, not the default the page offered.
  let dialogs = 0, prompts = 0;
  const answerYear = d => { dialogs++; d.type() === 'prompt' ? (prompts++, d.accept(String(Y))) : d.accept() };
  page.on('dialog', answerYear);

  await page.setViewportSize({ width: 1280, height: 950 });
  await goArchive(page);

  // ─────────────────────────────────────────────────────────────────────────
  section('1 · the empty state, and what Add year produces');

  check((await page.$eval('#arcList', e => e.textContent)).includes('No years archived yet'),
    'an empty Archives says so rather than showing nothing');
  check(await page.$eval('#arcBar', e => getComputedStyle(e).display) === 'flex',
    'the Add year button is on screen for Archives');
  check(await page.$eval('#yearBar', e => getComputedStyle(e).display) === 'none'
     && await page.$eval('#yfYearWrap', e => getComputedStyle(e).display) === 'none',
    'and the other tabs\' year controls are not');

  await page.click('#arcAddYear');
  await page.waitForSelector('.ay');
  check(prompts === 1, 'Add year asks which year rather than assuming this one');
  check(await page.$$eval('.ay', n => n.length) === 1, 'Add year seals one card');

  const money = n => '$' + Math.round(n).toLocaleString('en-CA');
  const figs = await page.evaluate(() => ({
    sta: document.querySelector('.ay-s b.sta').textContent,
    end: document.querySelector('.ay-s b.end').textContent,
    inv: document.querySelector('.ay-s b.inv').textContent,
    mov: document.querySelector('.ay-s b.mov').textContent,
    sav: document.querySelector('.ay-s b.sav').textContent,
    off: document.querySelector('.ay-s b.off').textContent,
    gro: document.querySelector('.ay-gro em').textContent,
    yr: document.querySelector('.ay-yr').textContent,
    meta: document.querySelector('.ay-meta').textContent,
  }));
  check(figs.yr === String(Y), 'the card is headed with the year', figs.yr);
  check(figs.sta === money(START), 'Start is the year\'s opening balance', figs.sta);
  check(figs.end === money(START + INC - EXP), 'End is start + income − spending', figs.end);
  check(figs.inv === money(INV), 'Invested is the Investment category', figs.inv);
  check(figs.mov === money(MOV), 'Moved else is the Other Bank category', figs.mov);
  check(figs.sav === money(INC - EXP), 'Saved total is end − start', figs.sav);
  check(figs.off === money(INC - EXP + INV + MOV),
    'Off paper sav adds back what left the account but was not spent', figs.off);
  const wantGro = ((START + INC - EXP) / START - 1) * 100;
  check(figs.gro === '+' + wantGro.toFixed(1) + '%', 'Savings growth is end/start − 1', figs.gro);
  check(/Preview/i.test(figs.meta), 'the running year is labelled a preview, not sealed', figs.meta);

  // the allotted Monthly row is the one that could be double-counted
  check(!figs.end.includes(String(120)) && figs.end === money(START + INC - EXP),
    'a Monthly row allotted to a bill is not counted on top of the bill');

  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs++; d.type() === 'prompt' ? d.accept('banana') : d.accept() });
  await page.click('#arcAddYear');
  await page.waitForTimeout(250);
  check(await page.$$eval('.ay', n => n.length) === 1,
    'a year it cannot parse is refused rather than archived as NaN');
  page.removeAllListeners('dialog');
  page.on('dialog', answerYear);

  // ─────────────────────────────────────────────────────────────────────────
  section('2 · the card agrees with the Yearly tab it came from');

  await page.click('#viewSeg button[data-view="yearly"]');
  await page.waitForTimeout(250);
  const live = await page.evaluate(() => ({
    start: document.getElementById('yfStartVal').textContent,
    end: document.getElementById('yfEndVal').textContent,
  }));
  check(live.start.replace(/\.\d+$/, '').startsWith(figs.sta.slice(0, 7)),
    'Yearly\'s START reads the same opening balance', `${live.start} vs ${figs.sta}`);
  check(live.end.replace(/\.\d+$/, '').startsWith(figs.end.slice(0, 7)),
    'Yearly\'s END reads the same closing balance', `${live.end} vs ${figs.end}`);
  await goArchive(page);

  // ─────────────────────────────────────────────────────────────────────────
  section('3 · it is a snapshot, not a live view');

  // Delete a whole year of income from the ledger. The LIVE tab must move;
  // the sealed card must not. Checking the live side first is what stops this
  // passing for a card that simply never renders anything.
  await page.evaluate(() => {
    state.yf.txns = state.yf.txns.filter(t => t.type !== 'income');
    yfPersist(); if (typeof renderYF === 'function') renderYF();
    if (typeof renderArchives === 'function') renderArchives();
  });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    sta: document.querySelector('.ay-s b.sta').textContent,
    end: document.querySelector('.ay-s b.end').textContent,
  }));
  await page.click('#viewSeg button[data-view="yearly"]');
  await page.waitForTimeout(250);
  const liveNow = await page.$eval('#yfEndVal', e => e.textContent);
  check(liveNow !== live.end, 'removing the income really did move the live Yearly figure',
    `${live.end} → ${liveNow}`);
  await goArchive(page);
  check(after.end === figs.end && after.sta === figs.sta,
    'but the sealed card still reads exactly what it read when it was taken',
    `${after.end} vs ${figs.end}`);

  // put the ledger back for the sections that follow
  await page.evaluate(ts => { state.yf.txns = ts; yfPersist(); if (typeof renderYF === 'function') renderYF(); },
    ledger());
  await page.waitForTimeout(150);

  // ─────────────────────────────────────────────────────────────────────────
  section('4 · expanding a card');

  check(await page.$$eval('.ay-body', n => n.length) === 0, 'a collapsed card has no body');
  await page.click('.ay-head');
  await page.waitForSelector('.ay-body');
  const body = await page.evaluate(() => ({
    secs: [...document.querySelectorAll('.ay-bh')].map(e => e.textContent),
    expRows: [...document.querySelectorAll('.ay-3 > div:nth-child(1) .ay-t tr td:first-child')].map(e => e.textContent),
    incRows: [...document.querySelectorAll('.ay-3 > div:nth-child(2) .ay-t tr td:first-child')].map(e => e.textContent),
    first: (document.querySelector('.ay-hl .first .l') || {}).textContent || '',
    hl: document.querySelectorAll('.ay-hl li').length,
    cmCats: [...document.querySelectorAll('.ay-cm tbody tr td:first-child')].map(e => e.textContent),
    cmCols: document.querySelectorAll('.ay-cm thead th').length,
    trend: (document.querySelector('.ay-sec:nth-last-child(2) polyline') || {}).getAttribute
      ? document.querySelector('.ay-sec:nth-last-child(2) polyline').getAttribute('points').trim().split(/\s+/).length : 0,
    bars: document.querySelectorAll('.ay-sec:nth-child(1) rect').length,
    chev: getComputedStyle(document.querySelector('.ay-chev')).transform,
  }));
  check(body.secs.join('|') === 'Month by month|Expenses|Income|Highlights|12-month trend|Category by month · Monthly',
    'the body is laid out in the agreed order', body.secs.join(' / '));
  check(body.expRows.includes('Rent') && body.expRows.includes('Investment')
     && body.expRows.includes('Credit Card'),
    'the Expenses table lists every category the year used, configured or not',
    body.expRows.join(','));
  check(body.incRows.join(',') === 'Paycheck', 'the Income table lists its own', body.incRows.join(','));
  check(/ABI put .* into TFSA/.test(body.first) && /POO added/.test(body.first),
    'Highlights lead with the contributions line', body.first);
  check(body.hl > 1, 'and carry the Yearly highlight cards underneath it', String(body.hl));
  check(body.cmCats.includes('Grocery') && body.cmCats.includes('Dining'),
    'Category by month lists Monthly\'s categories', body.cmCats.join(','));
  check(!body.cmCats.includes('Rent'),
    'and not Yearly\'s — a bill in a month says nothing about habits');
  check(body.cmCols === 14, 'the grid is category + 12 months + total', String(body.cmCols));
  check(body.trend === 12, 'the trend draws a point per month', String(body.trend));
  // one bar per SERIES per month, not one per row: nine months earn and nine spend
  check(body.bars === 18, 'the bars draw one per series per month with money in it', String(body.bars));
  check(body.chev !== 'none', 'the chevron turns when the card is open', body.chev);

  await page.click('.ay-head');
  await page.waitForTimeout(200);
  check(await page.$$eval('.ay-body', n => n.length) === 0, 'and clicking again collapses it');

  // ─────────────────────────────────────────────────────────────────────────
  section('5 · the expanded layout holds its shape');

  await page.click('.ay-head');
  await page.waitForSelector('.ay-body');
  for (const W of [1280, 900, 760, 390]) {
    await page.setViewportSize({ width: W, height: 950 });
    await page.waitForTimeout(220);
    const o = await page.evaluate(() => {
      const g = document.querySelector('.ay-3');
      const c = document.querySelector('.ay').getBoundingClientRect();
      const kids = [...g.children].map(e => e.getBoundingClientRect());
      const hold = document.querySelector('.ay-hold');
      const hr = hold ? hold.getBoundingClientRect() : null;
      // anything wider than its card, ignoring the two deliberate side-scrollers
      const out = [...document.querySelectorAll('.ay *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1) && !e.closest('.ay-scroll');
      }).map(e => (e.className || e.tagName) + ':' + Math.round(r2(e)));
      function r2(e) { return e.getBoundingClientRect().right - c.right }
      return {
        laidOut: c.height > 200 && kids.every(r => r.height >= 0),
        cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
        exp: Math.round(kids[0].width), inc: Math.round(kids[1].width),
        holdW: hr ? Math.round(hr.width) : 0,
        holdH: hr ? Math.round(hr.height) : 0,
        rowH: Math.round(kids[0].height),
        wideW: Math.round(kids[kids.length - 1].width),
        pan: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        out,
      };
    });
    // bug class 14: everything below reads 0 and passes meaninglessly if the
    // card never actually drew
    check(o.laidOut, `${W}px: the card is actually laid out`, JSON.stringify([o.cols, o.exp]));
    check(o.out.length === 0 && o.pan <= 0, `${W}px: nothing escapes the card and the page does not pan`,
      o.out.join(',') + ' pan=' + o.pan);
    if (W > 760) {
      check(o.cols === 3, `${W}px: three columns`, String(o.cols));
      check(near(o.exp, o.inc, 2), `${W}px: Expenses and Income are equal`, `${o.exp} / ${o.inc}`);
      check(near(o.holdW / o.exp, 0.5, 0.06), `${W}px: the reserved strip is half their width — 40/40/20`,
        `${o.holdW} vs ${o.exp}`);
      check(o.holdH > o.rowH + 10, `${W}px: and spans BOTH rows rather than collapsing to one`,
        `${o.holdH} vs row ${o.rowH}`);
      check(near(o.wideW, o.exp + o.inc + 16, 3), `${W}px: Highlights take the 80% underneath`,
        `${o.wideW} vs ${o.exp + o.inc + 16}`);
    } else {
      check(o.cols === 1, `${W}px: one column`, String(o.cols));
      check(o.holdW === 0, `${W}px: the reserved strip is dropped rather than leaving a gap`, String(o.holdW));
    }
  }
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.waitForTimeout(200);

  // ─────────────────────────────────────────────────────────────────────────
  section('6 · the row actions, and the listener behind them');

  // re-rendering does not stack handlers: the cards are rebuilt on every render
  // and anything bound per-card would both die and pile up.
  // Call the renderer and the binder a dozen times, then COUNT how many times a
  // single click runs the toggle. Counting rather than checking the card's final
  // state matters: stacked listeners toggle an even number of times and land
  // back where they started, which would read as correct.
  const before = await page.$$eval('.ay-body', n => n.length);
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) { renderArchives(); arcBind() }
    window.__renders = 0;
    const real = window.renderArchives;
    window.renderArchives = function () { window.__renders++; return real.apply(this, arguments) };
  });
  await page.waitForTimeout(150);
  check(await page.$eval('#arcList', e => e.dataset.bound) === '1',
    'the list binds its one delegated listener and keeps it');
  await page.click('.ay-head');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__renders) === 1,
    'so one click after twelve rebinds runs the toggle exactly once',
    'ran ' + (await page.evaluate(() => window.__renders)) + ' times');
  check(await page.$$eval('.ay-body', n => n.length) === (before ? 0 : 1),
    'and the card ends up on the other side of where it started');

  // Add year on a year already archived replaces it rather than duplicating
  const d0 = dialogs;
  await page.click('#arcAddYear');
  await page.waitForTimeout(250);
  check(dialogs > d0, 're-archiving an existing year asks first');
  check(await page.$$eval('.ay', n => n.length) === 1,
    'and replaces it rather than listing the year twice');

  // edit
  const vals = ['1000', '2000', '300', '400', '500', '600'];
  let pi = 0;
  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs++; d.type() === 'prompt' ? d.accept(vals[pi++]) : d.accept(); });
  await page.click('.ay-act[data-act="edit"]');
  await page.waitForTimeout(400);
  const ed = await page.evaluate(() => ({
    sta: document.querySelector('.ay-s b.sta').textContent,
    end: document.querySelector('.ay-s b.end').textContent,
    gro: document.querySelector('.ay-gro em').textContent,
  }));
  check(ed.sta === '$1,000' && ed.end === '$2,000', 'edit writes the figures it was given', JSON.stringify(ed));
  check(ed.gro === '+100.0%', 'and recomputes growth from them rather than keeping the old one', ed.gro);

  // a negative growth paints red, which is the only thing the sign drives
  await page.evaluate(() => {
    const a = state.archives[0];
    a.stats.start = 2000; a.stats.end = 1000; a.stats.growth = -50;
    renderArchives();
  });
  await page.waitForTimeout(150);
  check(await page.$eval('.ay-gro em', e => e.textContent) === '−50.0%',
    'a fall is shown with a true minus sign');
  check(await page.$eval('.ay-gro em', e => e.classList.contains('dn')),
    'and in the losing colour');

  // delete: cancel keeps it, accept removes it
  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.click('.ay-act[data-act="del"]');
  await page.waitForTimeout(250);
  check(await page.$$eval('.ay', n => n.length) === 1, 'cancelling the delete keeps the card');
  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs++; d.accept(); });
  await page.click('.ay-act[data-act="del"]');
  await page.waitForTimeout(250);
  check(await page.$$eval('.ay', n => n.length) === 0, 'accepting it removes the card');
  check((await page.$eval('#arcList', e => e.textContent)).includes('No years archived'),
    'and the empty state comes back');
  check(await page.evaluate(() => state.yf.txns.length) === ledgerLen,
    'deleting an archive leaves the ledger it was taken from alone',
    String(await page.evaluate(() => state.yf.txns.length)));

  // ─────────────────────────────────────────────────────────────────────────
  section('7 · it is stored, and it is stored in the right place');

  page.removeAllListeners('dialog');
  page.on('dialog', answerYear);
  await page.click('#arcAddYear');
  await page.waitForSelector('.ay');
  const stored = await page.evaluate(() => {
    const k = Object.keys(localStorage).filter(k => /archives/.test(k));
    return { keys: k, n: k.length ? (JSON.parse(localStorage.getItem(k[0])) || []).length : -1 };
  });
  check(stored.n === 1, 'the archive is written to localStorage', JSON.stringify(stored));
  // storage is namespaced per database by fingerprint, so the key is
  // sparta.<db>.archives rather than a bare sparta.archives
  check(stored.keys.every(k => /^sparta\.[a-z0-9]+\.archives$/.test(k)),
    'under the namespaced archives key, not a loose one', stored.keys.join(','));

  const inPayload = await page.evaluate(() => {
    const p = corePayload();
    return { has: Array.isArray(p.archives), n: (p.archives || []).length };
  });
  check(inPayload.has && inPayload.n === 1, 'and it rides in the cloud payload, so a phone sees it too',
    JSON.stringify(inPayload));

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  await goArchive(page);
  check(await page.$$eval('.ay', n => n.length) === 1, 'it survives a reload');
  check(await page.$eval('.ay-s b.end', e => e.textContent) === figs.end,
    'with its figures intact', await page.$eval('.ay-s b.end', e => e.textContent));

  // Clear data's Archives tick
  const otherBefore = await page.evaluate(() => ({ yf: state.yf.txns.length, h: state.holdings.length }));
  await page.evaluate(() => { RESET_CLEAR.archive() });
  await page.waitForTimeout(250);
  const otherAfter = await page.evaluate(() => ({ yf: state.yf.txns.length, h: state.holdings.length,
    arc: state.archives.length }));
  check(otherAfter.arc === 0, 'the Archives tick empties the archives');
  check(otherAfter.yf === otherBefore.yf && otherAfter.h === otherBefore.h,
    'and touches nothing else', JSON.stringify([otherBefore, otherAfter]));
  await goArchive(page);
  check((await page.$eval('#arcList', e => e.textContent)).includes('No years archived'),
    'the list redraws itself after the clear rather than showing cards that are gone');

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nARCHIVES: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
