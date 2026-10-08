/* Archives: one sealed card per closed year.

   The promise an archive makes is that it still says what it said. So the two
   things worth testing hardest are (a) that a freshly taken snapshot agrees
   with the Yearly tab it was taken from, figure for figure, and (b) that it
   STOPS agreeing the moment the ledger moves underneath it — a card that
   quietly re-derives itself is a live view wearing an archive's clothes.

   Both are written so they can fail: the "snapshot" checks first prove the live
   tab really did change, so a card that merely never updates anything would not
   sail through. */
const { serve, open, launch, stub, SEED } = require('./lib');
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
  // Add year seals THIS year with one press and asks nothing. Any prompt that
  // does appear is counted, so a stray one would show up as a failure below.
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
  check(prompts === 0, 'Add year seals this year with one press and asks nothing');
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
    // Highlights lead the row now, so the tables are columns 2 and 3
    expRows: [...document.querySelectorAll('.ay-3 > div:nth-child(2) .ay-t tr td:first-child')].map(e => e.textContent),
    incRows: [...document.querySelectorAll('.ay-3 > div:nth-child(3) .ay-t tr td:first-child')].map(e => e.textContent),
    first: (document.querySelector('.ay-contrib .l') || {}).innerText || '',
    firstLines: document.querySelectorAll('.ay-contrib .l span').length,
    contribInList: document.querySelectorAll('.ay-hl .t-contrib').length,
    contribSpan: document.querySelector('.ay-contrib')
      ? getComputedStyle(document.querySelector('.ay-contrib')).gridColumn : '',
    contribPane: document.querySelector('.ay-contrib')
      ? getComputedStyle(document.querySelector('.ay-contrib')).backgroundColor : '',
    // every point wears one of the five tone classes, none left unclassified
    tones: [...document.querySelectorAll('.ay-hl li')].map(li =>
      (li.className.match(/t-\w+/) || [''])[0]),
    hlPanes: document.querySelectorAll('.ay-hlbox').length,
    secPanes: [...document.querySelectorAll('.ay-sec')]
      .filter(e => getComputedStyle(e).backgroundImage !== 'none'
                || getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
    hl: document.querySelectorAll('.ay-hl li').length,
    cmCats: [...document.querySelectorAll('.ay-cm tbody tr td:first-child')].map(e => e.textContent),
    cmCols: document.querySelectorAll('.ay-cm thead th').length,
    // the trend is Monthly's chart now: one PATH per chosen category, dots on each
    trendLines: document.querySelectorAll('.arc-tw path').length,
    trendDots: document.querySelectorAll('.arc-tw .archit').length,
    legend: [...document.querySelectorAll('.arc-legend span')].map(e => e.textContent),
    gear: !!document.querySelector('.arc-gear'),
    yAxis: [...document.querySelectorAll('.arc-tw text')].filter(t => /^\$/.test(t.textContent)).map(t => t.textContent),
    bars: document.querySelectorAll('.ay-sec:nth-child(1) rect').length,
    chev: getComputedStyle(document.querySelector('.ay-chev')).transform,
  }));
  check(body.secs.join('|') === 'Month by month|Highlights|Expenses|Income|12-month trend|Category by month · Monthly',
    'the body is laid out in the agreed order', body.secs.join(' / '));
  check(body.expRows.includes('Rent') && body.expRows.includes('Investment')
     && body.expRows.includes('Credit Card'),
    'the Expenses table lists every category the year used, configured or not',
    body.expRows.join(','));
  check(body.incRows.join(',') === 'Paycheck', 'the Income table lists its own', body.incRows.join(','));
  check(/ABI put .* into TFSA/.test(body.first) && /POO added/.test(body.first),
    'the contributions line sits under Expenses and Income', body.first.replace(/\n/g, ' | '));
  check(body.firstLines === 2, 'with ABI on one line and POO on the next', String(body.firstLines));
  check(body.contribInList === 0, 'and is NOT in the highlights list any more');
  check(body.contribSpan === '2 / 4', 'spanning both table columns', body.contribSpan);
  check(body.contribPane === 'rgba(0, 0, 0, 0)',
    'with no pane of its own \u2014 Highlights is still the only block on glass', body.contribPane);
  check(body.tones.length > 1 && body.tones.every(Boolean) && new Set(body.tones).size >= 3,
    'every highlight is coloured by what it says, across at least three tones',
    [...new Set(body.tones)].join(','));
  check(body.hlPanes === 1, 'Highlights sits on a pane of its own', String(body.hlPanes));
  check(body.secPanes === 0,
    'and it is the ONLY one — the body is a single sheet of glass, not a stack of cards',
    String(body.secPanes));
  check(body.hl > 1, 'and carry the Yearly highlight cards underneath it', String(body.hl));
  check(body.cmCats.includes('Grocery') && body.cmCats.includes('Dining'),
    'Category by month lists Monthly\'s categories', body.cmCats.join(','));
  check(!body.cmCats.includes('Rent'),
    'and not Yearly\'s — a bill in a month says nothing about habits');
  check(body.cmCols === 14, 'the grid is category + 12 months + total', String(body.cmCols));
  check(body.trendLines === 1 && body.trendDots === 12,
    'the trend draws exactly ONE line, with a point on every month',
    `${body.trendLines} lines, ${body.trendDots} dots`);
  check(body.gear && body.legend.length === 1,
    'with Monthly\'s gear and the chosen category named beside it', body.legend.join(','));
  check(body.yAxis.length === 3 && body.yAxis[0] === '$0',
    'and Monthly\'s three-stop value axis, anchored at $0', body.yAxis.join(' '));
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
      // anything wider than its card, ignoring the three deliberate side-scrollers.
      // className on an SVG element is an SVGAnimatedString, not a string, so the
      // label has to come off the tag — the first version printed [object …].
      const out = [...document.querySelectorAll('.ay *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1) &&
          !e.closest('.ay-scroll') && !e.closest('.arc-tw') && !e.closest('.arc-pop');
      }).map(e => e.tagName.toLowerCase() + '.' + (typeof e.className === 'string' ? e.className : '(svg)'));
      return {
        laidOut: c.height > 200 && kids.every(r => r.height >= 0),
        cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
        hl: Math.round(kids[0].width),
        exp: Math.round(kids[1].width), inc: Math.round(kids[2].width),
        divider: kids.length > 1 ? getComputedStyle(g.children[1]).borderLeftWidth : '0px',
        pan: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        out,
      };
    });
    // bug class 14: everything below reads 0 and passes meaninglessly if the
    // card never actually drew
    check(o.laidOut, `${W}px: the card is actually laid out`, JSON.stringify([o.cols, o.hl]));
    check(o.out.length === 0 && o.pan <= 0, `${W}px: nothing escapes the card and the page does not pan`,
      o.out.join(',') + ' pan=' + o.pan);
    if (W > 760) {
      check(o.cols === 3, `${W}px: three columns`, String(o.cols));
      check(near(o.exp, o.inc, 2), `${W}px: Expenses and Income are equal`, `${o.exp} / ${o.inc}`);
      check(near(o.hl / (o.hl + o.exp + o.inc), 0.45, 0.02),
        `${W}px: Highlights take 45% and the tables split the rest`,
        `${o.hl} of ${o.hl + o.exp + o.inc}`);
      check(parseFloat(o.divider) > 0, `${W}px: a hairline divides the columns`, o.divider);
    } else {
      check(o.cols === 1, `${W}px: one column`, String(o.cols));
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

  // ─────────────────────────────────────────────────────────────────────────
  section('8 · the trend reads the SEALED year, not the live ledger');

  await page.click('#arcAddYear');
  await page.waitForSelector('.ay');
  // the Add year toast sits over the card for 2.6s and swallows the click that
  // would open it — wait it out rather than clicking into it
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'));
  await page.click('.ay-head');
  await page.waitForSelector('.arc-tw');
  const beforeTrend = await page.$$eval('.arc-tw .archit', n => n.length);
  const beforeLegend = await page.$eval('.arc-legend', e => e.textContent);
  // gut every Monthly row, then redraw. The chart must not move.
  await page.evaluate(() => {
    state.yf.txns = state.yf.txns.filter(t => t.tab !== 'me');
    yfPersist(); renderArchives();
  });
  // renderArchives() rebuilds the cards but keeps the open ones open, so there is
  // nothing to click here — clicking would CLOSE it and take the chart away
  await page.waitForSelector('.arc-tw');
  check(await page.$$eval('.arc-tw .archit', n => n.length) === beforeTrend && beforeTrend > 0,
    'deleting every Monthly row leaves the sealed chart untouched',
    `${beforeTrend} points`);
  check(await page.$eval('.arc-legend', e => e.textContent) === beforeLegend,
    'and its legend with it', beforeLegend);
  // the gear's selection is a device preference, so it must not live in the record
  check(await page.evaluate(() => !('chartCats' in state.archives[0])),
    'the category choice is NOT stored inside the archive');
  const stampBefore = await page.evaluate(() => state.updatedAt);
  await page.waitForTimeout(60);
  await page.evaluate(() => arcSetChartCat('Grocery'));
  check(await page.evaluate(() => state.updatedAt) === stampBefore,
    'so choosing categories does not re-stamp the ledger or push a new copy up');

  // the picker is one-of-N, and picking really does change the line
  await page.click('.arc-gear');
  await page.waitForSelector('.arc-pop.open');
  const picker = await page.evaluate(() => ({
    inputs: [...document.querySelectorAll('[data-arccat]')].map(i => i.type),
    names: new Set([...document.querySelectorAll('[data-arccat]')].map(i => i.name)).size,
    checked: document.querySelectorAll('[data-arccat]:checked').length,
    opts: [...document.querySelectorAll('[data-arccat]')].map(i => i.dataset.arccat),
  }));
  check(picker.inputs.every(t => t === 'radio') && picker.names === 1,
    'the category picker is radios in one group, so it reads as one-of-these',
    picker.inputs.join(','));
  check(picker.checked === 1, 'with exactly one chosen at a time', String(picker.checked));
  const lineBefore = await page.$eval('.arc-tw path', e => e.getAttribute('d'));
  const shown = await page.$eval('.arc-legend span', e => e.textContent);
  const other = picker.opts.find(c => c !== shown);
  await page.click(`[data-arccat="${other}"]`);
  await page.waitForTimeout(300);
  check(await page.$eval('.arc-tw path', e => e.getAttribute('d')) !== lineBefore,
    'and choosing another category actually redraws the line', other);
  check(await page.$$eval('.arc-tw path', n => n.length) === 1,
    'still exactly one line afterwards');
  check(await page.$eval('.arc-legend span', e => e.textContent) === other,
    'with the legend naming what is drawn');

  // ─────────────────────────────────────────────────────────────────────────
  section('8b · the dummy year button');

  await page.evaluate(() => { state.archives = []; arcPersist(); renderArchives() });
  await page.waitForTimeout(200);
  const ledgerBefore = await page.evaluate(() => state.yf.txns.length);
  for (let i = 0; i < 3; i++) {
    await page.click('#arcAddDummy');
    await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'));
  }
  const dum = await page.evaluate(() => ({
    years: state.archives.map(a => a.year),
    allDummy: state.archives.every(a => a.dummy === true),
    metas: [...document.querySelectorAll('.ay-meta')].map(e => e.textContent.trim()),
    ledger: state.yf.txns.length,
    order: [...document.querySelectorAll('#arcBar button')].map(e => e.id),
    sameTwice: JSON.stringify(arcDummyRec(2019).stats) === JSON.stringify(arcDummyRec(2019).stats),
    differByYear: JSON.stringify(arcDummyRec(2019).stats) !== JSON.stringify(arcDummyRec(2018).stats),
  }));
  check(dum.years.length === 3 && new Set(dum.years).size === 3,
    'each press adds a card on its own year rather than fighting over a slot', dum.years.join());
  check(dum.allDummy, 'all three are flagged as dummies');
  check(dum.metas.every(m => /^Dummy/.test(m)),
    'and say so on their face, so a fabricated year cannot read as a sealed one', dum.metas[0]);
  check(dum.ledger === ledgerBefore,
    'the ledger is untouched — a dummy reads and writes no real rows',
    `${ledgerBefore} -> ${dum.ledger}`);
  check(dum.order.join() === 'arcAddDummy,arcAddYear', 'the button sits left of Add year', dum.order.join());
  check(dum.sameTwice, 'the figures are derived from the year, so a year always renders the same');
  check(dum.differByYear, 'and two different years cannot come out identical');

  // a dummy must survive the automatic seal, or opening the app would overwrite
  // test data with real figures
  const kept = await page.evaluate(() => {
    const y = state.archives[0].year, before = JSON.stringify(state.archives[0].stats);
    arcAutoSeal();
    const now = state.archives.find(a => a.year === y);
    return { survived: !!now && !!now.dummy, same: now && JSON.stringify(now.stats) === before };
  });
  check(kept.survived && kept.same, 'and the automatic seal steps over it rather than replacing it');

  // it has to render a whole card off fabricated data, not just a header
  await page.locator('.ay-head').nth(0).click();
  await page.waitForSelector('.ay-body');
  const shape = await page.evaluate(() => ({
    secs: document.querySelectorAll('.ay-bh').length,
    bars: document.querySelectorAll('.ay-sec svg rect').length,
    trend: document.querySelectorAll('.arc-tw .archit').length,
    rows: document.querySelectorAll('.ay-cm tbody tr').length,
    contrib: !!document.querySelector('.ay-contrib'),
  }));
  check(shape.secs === 6 && shape.bars === 24 && shape.trend === 12 && shape.rows > 0 && shape.contrib,
    'an expanded dummy draws the whole card — bars, trend, matrix and contributions',
    JSON.stringify(shape));
  await page.evaluate(() => { state.archives = []; arcPersist(); renderArchives() });

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();

  // ─────────────────────────────────────────────────────────────────────────
  // The rollover gets its own contexts, because it needs the clock moved.
  section('9 · the year rollover');

  const P2 = m => String(m).padStart(2, '0');
  const rollLedger = () => {
    const t = [];
    [2025, 2026].forEach(yy => {
      const months = yy === 2025 ? 6 : 12;
      for (let m = 1; m <= months; m++) {
        t.push({ id: `i${yy}${m}`, date: `${yy}-${P2(m)}-12`, type: 'income', cat: 'Paycheck', desc: 'pay', amt: 6000, who: 'ABI', tab: 'yf' });
        t.push({ id: `r${yy}${m}`, date: `${yy}-${P2(m)}-12`, type: 'expense', cat: 'Rent', desc: 'rent', amt: 2000, who: 'ABI', tab: 'yf' });
      }
    });
    return t;
  };
  // freeze the page clock before a line of app code runs
  const freeze = iso => `(()=>{const F=new Date('${iso}').getTime();const R=Date;
    class D extends R{constructor(...a){if(!a.length)super(F);else super(...a)}
      static now(){return F}}
    window.Date=D;})();`;
  const bootAt = async (iso, store) => {
    const c = await browser.newContext();
    const pg = await c.newPage(); await stub(pg);
    await pg.addInitScript(freeze(iso));
    await pg.addInitScript(st => { try { localStorage.clear();
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); } catch (e) { } }, store);
    const er = []; pg.on('pageerror', e => er.push(e.message));
    pg.on('dialog', d => d.accept());
    await pg.goto(url, { waitUntil: 'load' }); await pg.waitForTimeout(450);
    return { pg, c, er };
  };
  const dump = pg => pg.evaluate(() => { const o = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k) } return o });
  const look = pg => pg.evaluate(() => ({
    yfYear: state.yfYear,
    years: state.archives.map(a => a.year).sort(),
    sealed: state.archives.filter(a => a.sealed).map(a => a.year).sort(),
    ends: Object.fromEntries(state.archives.map(a => [a.year, Math.round(a.stats.end)])),
    start: JSON.parse(JSON.stringify(state.yf.start || {})),
    rows2026: state.yf.txns.filter(t => t.date.startsWith('2026')).length,
    rows2027: state.yf.txns.filter(t => t.date.startsWith('2027')).length,
    startField: (document.getElementById('yfStart') || {}).value,
  }));
  const rollSeed = Object.assign({}, SEED, { 'sparta.yf.data':
    JSON.stringify({ txns: rollLedger(), start: { 2025: 5000, 2026: 13554 }, planned: {} }) });

  // 31 Dec 2026 — 2025 was never archived, so opening the app backfills it
  let A = await bootAt('2026-12-31T10:00:00Z', rollSeed);
  let a = await look(A.pg);
  check(a.years.join() === '2025', 'a past year the ledger holds is sealed on open, unprompted', a.years.join());
  check(a.ends[2025] === 29000, 'with that year’s own figures', String(a.ends[2025]));
  check(a.yfYear === 2026 && !a.years.includes(2026), 'the year still running is left alone');
  const afterDec = await dump(A.pg); await A.c.close();

  // 1 Jan 2027 — same browser, next day
  let B = await bootAt('2027-01-01T09:00:00Z', afterDec);
  let b2 = await look(B.pg);
  check(b2.years.join() === '2025,2026', '1 January seals the year that just ended', b2.years.join());
  check(b2.ends[2026] === 61554, 'at its closing balance', String(b2.ends[2026]));
  check(b2.sealed.join() === '2025,2026', 'and both read as sealed, not as previews');
  check(b2.yfYear === 2027 && b2.rows2027 === 0, 'the new year opens empty');
  check(b2.rows2026 === 24, 'WITHOUT deleting a single row of the old one — an archive is a copy',
    String(b2.rows2026));
  check(b2.start['2027'] === 61554, 'and 2027 opens at 2026’s closing balance', String(b2.start['2027']));
  check(b2.startField === '61554', 'which is sitting in the editable Start field, not locked away', b2.startField);
  const afterJan = await dump(B.pg); await B.c.close();

  // idempotence — the thing that would quietly corrupt a year
  let C = await bootAt('2027-01-02T09:00:00Z', afterJan);
  let c3 = await look(C.pg);
  check(c3.years.join() === '2025,2026', 'opening again the next day seals nothing twice', c3.years.join());
  check(c3.start['2027'] === 61554, 'and does not re-carry the opening balance');
  const afterTwo = await dump(C.pg); await C.c.close();

  // a hand-typed Start must survive the next load
  const edited = Object.assign({}, afterTwo);
  // storage is namespaced per database, and the SEED also leaves a bare
  // sparta.yf.data behind — the app reads sparta.<db>.yf.data, so editing the
  // first match silently edited a key nothing reads
  const nsKeyFor = (o, suffix) => Object.keys(o).find(x => new RegExp('^sparta\\.[a-z0-9]+\\.' + suffix + '$').test(x))
    || Object.keys(o).find(x => new RegExp(suffix + '$').test(x));
  const k = nsKeyFor(edited, 'yf\\.data');
  const yfd = JSON.parse(edited[k]); yfd.start['2027'] = 0; edited[k] = JSON.stringify(yfd);
  let E = await bootAt('2027-01-03T09:00:00Z', edited);
  check(await E.pg.evaluate(() => state.yf.start['2027']) === 0,
    'a Start deliberately typed as 0 is not overwritten by the carry-forward');
  await E.c.close();

  // a hand-corrected archive must survive too
  const touched = Object.assign({}, afterDec);
  const ak = nsKeyFor(touched, 'archives');
  const arcs = JSON.parse(touched[ak]);
  arcs[0].sealed = false; arcs[0].edited = true; arcs[0].stats.end = 12345;
  touched[ak] = JSON.stringify(arcs);
  let F = await bootAt('2027-01-04T09:00:00Z', touched);
  check(await F.pg.evaluate(() => state.archives.find(a => a.year === 2025).stats.end) === 12345,
    'a figure corrected by hand is never overwritten by the automatic seal');
  await F.c.close();

  // and an unedited PREVIEW of a year that has since ended is upgraded
  const preview = Object.assign({}, afterDec);
  const pv = JSON.parse(preview[ak]);
  pv[0].sealed = false; delete pv[0].edited; pv[0].stats.end = 1;
  preview[ak] = JSON.stringify(pv);
  let G = await bootAt('2027-01-05T09:00:00Z', preview);
  const gg = await G.pg.evaluate(() => state.archives.find(a => a.year === 2025));
  check(gg.sealed === true && Math.round(gg.stats.end) === 29000,
    'but a provisional preview of a closed year is re-taken and sealed',
    `${gg.sealed} / ${Math.round(gg.stats.end)}`);
  await G.c.close();


  /* ── 10. WHAT CROSSES FROM YEARLY AND MONTHLY, AND WHAT DOES NOT ──────────
     An archive is a summary, not a copy of the ledger, and the line between
     the two is easy to move by accident. This section seeds one year where
     every answer is hand-computable and pins BOTH halves: each figure that is
     carried, against arithmetic done here rather than by the app; and each
     thing that is deliberately left behind, so dropping something new goes
     noticed and picking something up unintentionally does too.

     The asymmetry it pins is the important part. Everything derived from
     yfTxns() is YEARLY-TAB ONLY -- that function ends in `t.tab!=='me'` -- so
     Monthly's rows reach the card through exactly one field, byCat, and
     through no total at all. */
  {
    const AY = 2025;                       // a closed year, so it seals as sealed
    const T = [
      // Yearly tab
      { id:'q1', tab:'yf', type:'income',  date:`${AY}-01-15`, amt:5000, cat:'Paycheck',    who:'ABI' },
      { id:'q2', tab:'yf', type:'income',  date:`${AY}-02-15`, amt:5000, cat:'Paycheck',    who:'ABI' },
      { id:'q3', tab:'yf', type:'expense', date:`${AY}-01-05`, amt:1200, cat:'Rent',        who:'ABI' },
      { id:'q4', tab:'yf', type:'expense', date:`${AY}-02-05`, amt:1200, cat:'Rent',        who:'ABI' },
      { id:'q5', tab:'yf', type:'expense', date:`${AY}-03-01`, amt:3000, cat:'Investment',  who:'ABI' },
      { id:'q6', tab:'yf', type:'expense', date:`${AY}-03-02`, amt: 800, cat:'Other Bank',  who:'ABI' },
      { id:'q7', tab:'yf', type:'expense', date:`${AY}-04-10`, amt: 500, cat:'Credit Bill', who:'ABI' },
      // a Yearly row whose category was later removed from the configured list
      { id:'q8', tab:'yf', type:'expense', date:`${AY}-06-03`, amt: 410, cat:'Gone from list', who:'ABI' },
      // Monthly tab
      { id:'n1', tab:'me', type:'expense', date:`${AY}-01-07`, amt:220, cat:'Groceries',  who:'ABI', mOnly:true },
      { id:'n2', tab:'me', type:'expense', date:`${AY}-01-19`, amt:130, cat:'Dining Out', who:'ABI', mOnly:true },
      { id:'n3', tab:'me', type:'expense', date:`${AY}-02-11`, amt:310, cat:'Groceries',  who:'ABI', mOnly:true },
      { id:'n4', tab:'me', type:'expense', date:`${AY}-05-03`, amt: 95, cat:'Transit',    who:'POO', mOnly:true },
      // allocations against q7: they must add to NO total, but DO belong in the
      // grid, under the bill's month rather than their own date
      { id:'n5', tab:'me', type:'expense', date:`${AY}-04-14`, amt:300, cat:'Shopping',  who:'ABI', allot:'q7', allotM:`${AY}-04` },
      { id:'n6', tab:'me', type:'expense', date:`${AY}-04-16`, amt:200, cat:'Groceries', who:'ABI', allot:'q7', allotM:`${AY}-04` },
      // paying the card is not spending -- ME_NONSPEND keeps it out of the grid
      { id:'n7', tab:'me', type:'expense', date:`${AY}-04-28`, amt:500, cat:'Bill Payment', who:'ABI', mOnly:true },
      // a Monthly INCOME row. Neither Monthly creator can make one (both
      // hardcode type:'expense'), but an import or an old file can.
      { id:'n8', tab:'me', type:'income',  date:`${AY}-07-04`, amt:640, cat:'Refund', who:'ABI', mOnly:true },
      // next year, which must not leak into this one
      { id:'z1', tab:'yf', type:'income',  date:`${AY+1}-01-15`, amt:9999, cat:'Paycheck', who:'ABI' },
    ];
    const tSeed = Object.assign({}, SEED, {
      'sparta.yf.data': JSON.stringify({ txns: T,
        cats: { exp: ['Rent','Investment','Other Bank','Credit Bill','Never used'], inc: ['Paycheck','Bonus'] },
        planned: { [AY]: { Rent: 15000, Investment: 4000 } },
        start: { [AY]: 10000 } }),
    });
    const X = await open(browser, url, tSeed);
    const snap = await X.page.evaluate(y => arcSnapshot(y), AY);

    // ── carried, and correct ────────────────────────────────────────────────
    // Yearly income 5000+5000; expenses 1200+1200+3000+800+500+410 = 7110
    check(snap.stats.start === 10000, 'Start comes across from yf.start', snap.stats.start);
    check(snap.stats.end === 10000 + 10000 - 7110, 'End is start + Yearly income − Yearly expenses', snap.stats.end);
    check(snap.stats.saved === 2890, 'Saved is end − start', snap.stats.saved);
    check(snap.stats.invested === 3000, 'Invested comes from the Investment category', snap.stats.invested);
    check(snap.stats.moved === 800, 'Moved else comes from Other Bank', snap.stats.moved);
    check(snap.stats.offPaper === 2890 + 3000 + 800, 'Off-paper savings adds the three back together', snap.stats.offPaper);
    check(Math.abs(snap.stats.growth - 28.9) < 0.001, 'Growth is end/start − 1', snap.stats.growth);
    check(JSON.stringify(snap.mInc) === JSON.stringify([5000,5000,0,0,0,0,0,0,0,0,0,0]),
      'the twelve income months are carried', JSON.stringify(snap.mInc));
    check(JSON.stringify(snap.mExp) === JSON.stringify([1200,1200,3800,500,0,410,0,0,0,0,0,0]),
      'the twelve expense months are carried, allocations excluded', JSON.stringify(snap.mExp));
    // a category removed from the configured list still has money against it,
    // and leaving it out would make the table disagree with the End above it
    check(snap.exp.some(r => r.c === 'Gone from list' && r.v === 410),
      'a category no longer on the configured list is still carried',
      JSON.stringify(snap.exp.map(r => r.c)));
    check(!snap.exp.some(r => r.c === 'Never used') && !snap.inc.some(r => r.c === 'Bonus'),
      'a configured category with no money against it is dropped');
    // Monthly reaches the card through byCat and nothing else
    check(JSON.stringify(snap.byCat['Groceries']) === JSON.stringify([220,310,0,200,0,0,0,0,0,0,0,0]),
      'the grid carries Monthly rows AND allocations, under the bill\'s month',
      JSON.stringify(snap.byCat['Groceries']));
    check(snap.byCat['Transit'] && snap.byCat['Transit'][4] === 95,
      'a Monthly row from either person is carried', JSON.stringify(snap.byCat['Transit']));
    check(!('Bill Payment' in snap.byCat), 'paying a card is kept out of the grid, as on the Monthly tab');
    check(snap.contrib.abiT === 3000, 'contributions are read at seal time and stored', JSON.stringify(snap.contrib));
    check(snap.highlights.length > 0 && snap.highlights.every(h => h.key && h.title && h.line),
      'the highlights are stored whole, not re-derived later', snap.highlights.length);
    /* NOT a string search for 9999 -- growth is 28.89999999999999, so that
       assertion failed on the build's own arithmetic rather than on a leak. */
    check(snap.mInc.reduce((a, v) => a + v, 0) === 10000 && !snap.mInc.includes(9999) &&
      !snap.inc.some(r => r.v === 9999),
      'next January\'s income does not leak into this year',
      JSON.stringify(snap.inc));

    // ── NOT carried. Each of these is a deliberate limit, pinned so that
    //    changing it has to be a decision rather than an accident. ──────────
    check(!('planned' in snap) && !JSON.stringify(snap).includes('15000'),
      'the budget (yf.planned) is NOT carried — the highlights were computed from it at seal time, but it cannot be shown again');
    check(!('txns' in snap) && !('rows' in snap) && !JSON.stringify(snap).includes('Loblaws'),
      'no row-level detail is carried — no dates, descriptions or who');
    check(!('cats' in snap), 'the configured category lists are NOT carried');
    // ── the three fixes ────────────────────────────────────────────────────
    // (a) entries counts EVERY row in the year, not just Yearly's: q1-q8 on
    //     Yearly, n1-n8 on Monthly (n8 being the income row).
    check(snap.entries === 16, 'entries counts every row in the year, both tabs', snap.entries);
    check(snap.entriesYf === 8 && snap.entriesMe === 8,
      'and the split is kept, so the card can say which is which',
      `${snap.entriesYf} / ${snap.entriesMe}`);
    // the ledger holds 17 rows; a count that just took the array's length would
    // read 17, so this also pins that next year's row is excluded
    check(await X.page.evaluate(() => state.yf.txns.length) === 17 && snap.entries === 16,
      'next year\'s row is in the ledger but not in the count', snap.entries);

    // (b) a Monthly INCOME row no longer vanishes. It stays OUT of every total
    //     -- End is a Yearly figure -- and is carried in a field of its own.
    check(snap.mInc.reduce((a, v) => a + v, 0) === 10000,
      'a Monthly income row still does not touch the income months');
    check(!('Refund' in snap.byCat), 'nor the category grid, which is expenses only');
    check(snap.stats.end === 12890, 'and it does not move End');
    check(Array.isArray(snap.meInc) && snap.meInc.length === 12 && snap.meInc[6] === 640,
      'but it IS carried, in meInc, under July', JSON.stringify(snap.meInc));
    // and Monthly spending is in the grid but in no total, which is the shape
    // of the whole thing rather than a bug: Yearly's End models a bank balance
    const meSpend = 220 + 130 + 310 + 95 + 500;        // un-allotted Monthly rows
    check(!snap.mExp.some(v => v === meSpend) && snap.stats.end === 12890,
      'Monthly spending appears in the grid but in no total — End is a Yearly-only figure');

    /* ── and the card has to SHOW all three, or the fix is only in the data ──
       Switch to the Archives view FIRST. Everything inside a display:none tab
       measures 0x0, so the rendered checks below would read every note as
       invisible while its text was perfectly correct (bug class 14). */
    await goArchive(X.page);
    await X.page.evaluate(y => {
      state.archives = [arcSnapshot(y)]; arcPersist(); renderArchives();
      document.querySelector('.ay-yr').click();
    }, AY);
    /* wait for the body to have finished opening rather than guessing at it --
       a fixed sleep measured the notes mid-transition and read them as 0-high */
    await X.page.waitForFunction(() => {
      const e = document.querySelector('.ay.open .ay-menote');
      return !!e && e.getBoundingClientRect().height > 5;
    }, null, { timeout: 5000 });
    const shown = await X.page.evaluate(() => {
      const c = document.querySelector('.ay.open');
      const sec = [...c.querySelectorAll('.ay-sec')]
        .find(x => /Category by month/i.test(x.querySelector('.ay-bh')?.textContent || ''));
      const vis = e => { if (!e) return false; const r = e.getBoundingClientRect();
        return r.width > 50 && r.height > 5 };
      const note = sec && sec.querySelector('.ay-bnote:not(.ay-menote)');
      const me = sec && sec.querySelector('.ay-menote');
      return { meta: c.querySelector('.ay-meta').textContent.replace(/\s+/g, ' ').trim(),
        note: note && note.textContent.trim(), noteVisible: vis(note),
        me: me && me.textContent.replace(/\s+/g, ' ').trim(), meVisible: vis(me) };
    });
    check(/16 entries/.test(shown.meta) && /8 yearly/.test(shown.meta) && /8 monthly/.test(shown.meta),
      'the card says 16 entries and breaks it down', shown.meta);
    check(shown.noteVisible && /not spending on top of them/i.test(shown.note || ''),
      'the grid carries a line saying it is detail inside the figures above', shown.note);
    check(shown.meVisible && /\$640/.test(shown.me || '') && /counted in none/i.test(shown.me || ''),
      'and the Monthly income is stated, with its figure', shown.me);

    /* The line must be ABSENT when there is no Monthly income -- a note that is
       always there says nothing, and this is the half that would rot silently. */
    const noMe = await X.page.evaluate(y => {
      const snap = arcSnapshot(y);
      snap.meInc = Array(12).fill(0);
      state.archives = [snap]; arcPersist(); renderArchives();
      document.querySelector('.ay-yr').click();
      return true;
    }, AY);
    await X.page.waitForTimeout(350);
    check(noMe && await X.page.evaluate(() => !document.querySelector('.ay.open .ay-menote')),
      'with no Monthly income the line is absent, not an empty one');
    check(await X.page.evaluate(() => !!document.querySelector('.ay.open .ay-bnote')),
      '...while the grid\'s own note stays, since it is always true');

    await X.ctx.close();
  }

  /* ======================================================================
     Section 11. The rollover's two doors into the real ledger, the tombstone,
     and the three places a card contradicted itself.

     Every check here is written to FAIL against the build before it: each one
     names the figure the old code produced, so none of them can pass by
     measuring nothing. */
  section('11. the rollover writes nothing invented, and a delete sticks');
  {
    const R = await open(browser, url, SEED);
    const page = R.page;
    await page.click('#viewSeg button[data-view="archive"]');
    await page.waitForTimeout(300);

    // ---- 11a. a dummy year must not become this year's opening balance ----
    const dum = await page.evaluate(() => {
      const now = new Date().getFullYear();
      state.archives = [arcDummyRec(now - 1)];
      delete state.yf.start[now];
      const carried = arcCarryStart();
      return { carried, seeded: now in state.yf.start, end: state.archives[0].stats.end };
    });
    /* The old code read prev.stats.end unconditionally. arcDummyRec builds end
       from 12 x ~6,400 income less 12 x ~3,650 expenses on a $6k-$30k start, so
       this is a five-figure number appearing in the Yearly Start tile from
       nowhere -- and persisted. */
    check(dum.end > 20000, 'a dummy year does carry a large fabricated End',
      String(dum.end));
    check(dum.carried === false && dum.seeded === false,
      'and it is NOT written into state.yf.start — invented money stays invented',
      JSON.stringify(dum));

    // ---- 11b. ...while a real prior year still carries, which is the feature ----
    const real = await page.evaluate(() => {
      const now = new Date().getFullYear();
      state.archives = [{ id: 'r1', year: now - 1, sealed: true, stats: { start: 1000, end: 4321.5 } }];
      delete state.yf.start[now];
      return { carried: arcCarryStart(), start: state.yf.start[now] };
    });
    check(real.carried === true && near(real.start, 4321.5),
      'a real sealed year still carries its End forward', JSON.stringify(real));

    // ---- 11c. a record with no stats must not throw ----
    /* normalizeArchives only requires a `year`, so a truncated cloud write or a
       hand-edited record can arrive without stats. The throw was swallowed by the
       try/catch around the whole rollover, which silently skipped the SEAL too. */
    const nostats = await page.evaluate(() => {
      const now = new Date().getFullYear();
      state.archives = [{ id: 'r2', year: now - 1 }];
      delete state.yf.start[now];
      try { return { carried: arcCarryStart(), seeded: now in state.yf.start } }
      catch (e) { return { threw: e.message } }
    });
    check(!nostats.threw && nostats.carried === false && nostats.seeded === false,
      'a record with no stats is skipped rather than thrown on', JSON.stringify(nostats));

    // ---- 11d. the rollover keeps the persistence contract ----
    /* Without touchUpdatedAt the stamp stays stale, so fbRecheckOnWake compares it
       against the remote, the cloud wins, and the year that was just sealed
       disappears again mid-session. Asserting the STAMP MOVED is the only
       observable half of that from here. */
    const stamped = await page.evaluate(() => {
      const y = new Date().getFullYear() - 1;
      state.archives = [];
      store.set('sparta.arcDeleted', []);
      state.yf.start[y] = 5000;
      state.yf.txns = [{ id: 'z1', date: y + '-03-04', type: 'income', cat: 'Paycheck', amt: 1234, who: 'ABI', tab: 'yf' }];
      yfPersist();
      const before = state.updatedAt;
      state.updatedAt = 1;                      // a stale stamp, as the old path left it
      const n = arcAutoSeal();
      return { n, before, after: state.updatedAt, years: state.archives.map(a => a.year) };
    });
    check(stamped.n === 1 && stamped.years.length === 1,
      'a past year with ledger rows is auto-sealed', JSON.stringify(stamped.years));
    check(stamped.after > 1,
      'and the seal bumps updatedAt, so the cloud cannot win and undo it',
      String(stamped.after));

    // ---- 11e. a deleted archive stays deleted across a reload ----
    const del = await page.evaluate(() => {
      const y = new Date().getFullYear() - 1;
      state.archives = state.archives.filter(a => a.year !== y);
      arcBury(y); arcPersist(); renderArchives();
      return { years: state.archives.map(a => a.year), buried: arcBuried() };
    });
    check(del.years.length === 0 && del.buried.length === 1,
      'deleting a year removes it and leaves a tombstone', JSON.stringify(del));
    const resealed = await page.evaluate(() => {
      // the exact call the boot block makes, with the ledger rows still in place
      const n = arcAutoSeal();
      return { n, years: state.archives.map(a => a.year) };
    });
    check(resealed.n === 0 && resealed.years.length === 0,
      'and the rollover does NOT rebuild it — the confirm said it cannot be undone',
      JSON.stringify(resealed));
    const lifted = await page.evaluate(() => {
      const y = new Date().getFullYear() - 1;
      arcUnbury(y);
      return { buried: arcBuried(), n: arcAutoSeal(), years: state.archives.map(a => a.year) };
    });
    check(lifted.buried.length === 0 && lifted.years.length === 1,
      '...but asking for it back lifts the stone, so delete is respected not permanent',
      JSON.stringify(lifted));

    // ---- 11f. a dummy card does not contradict itself ----
    const d = await page.evaluate(() => {
      const rec = arcDummyRec(2019);
      const row = n => (rec.exp || []).find(x => x.c === n);
      return { entries: rec.entries, yf: rec.entriesYf, me: rec.entriesMe,
        invTile: rec.stats.invested, invRow: row('Investment') && row('Investment').v,
        movTile: rec.stats.moved, movRow: row('Other Bank') && row('Other Bank').v,
        sorted: (rec.exp || []).every((x, i, a) => !i || a[i - 1].v >= x.v) };
    });
    check(d.entries === d.yf + d.me,
      'entries === entriesYf + entriesMe, the way a real record partitions them',
      JSON.stringify([d.entries, d.yf, d.me]));
    check(d.invTile === d.invRow && d.movTile === d.movRow,
      'and the Invested / Moved-else tiles equal their own Expenses rows',
      JSON.stringify([d.invTile, d.invRow, d.movTile, d.movRow]));
    check(d.sorted, 'the Expenses rows are still ordered biggest first');

    // ---- 11g. no all-zero Contributions pane ----
    const cl = await page.evaluate(() => ({
      zero: arcContribLine({ abiT: 0, abiF: 0, pooT: 0, pooF: 0 }),
      one: arcContribLine({ abiT: 0, abiF: 500, pooT: 0, pooF: 0 }),
      none: arcContribLine(null) }));
    check(cl.zero === '' && cl.none === '',
      'a year with no registered contributions renders no Contributions pane',
      JSON.stringify(cl.zero));
    check(/ABI put/.test(cl.one),
      '...while one non-zero figure still renders the whole pane');

    // ---- 11h. the trend axis keeps a floor ----
    const ax = await page.evaluate(() => {
      const neg = Array(12).fill(0).map((_, i) => (i < 3 ? -200 : 0));
      const html = arcTrend({ id: 't1', year: 2025, byCat: { Refunds: neg }, stats: {} }, 'x').html;
      return [...html.matchAll(/<text[^>]*>\$([\d.k]+)<\/text>/g)].map(m => m[1]);
    });
    /* peak===0 gave step=1 and top=1: an axis reading $0 / $0.5 / $1. The floor is
       500, the figure Monthly's own chart starts from. (A negative month still
       plots below the x-axis and clips -- renderMEChart clips it at the same
       place, so that is parity, not a bug, and is not asserted here.) */
    check(ax.includes('500') && !ax.includes('0.5'),
      'a net-negative category gets a $500 axis, not $0 / $0.5 / $1',
      JSON.stringify(ax));

    // ---- 11i. the section headings win their own specificity tie ----
    const sz = await page.evaluate(() => {
      state.archives = [arcDummyRec(2018)];
      normalizeArchives(); arcOpen.add(state.archives[0].id); renderArchives();
      const px = s => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(s));
      const bh = [...document.querySelectorAll('#archiveView .ay-bh')]
        .map(e => parseFloat(getComputedStyle(e).fontSize));
      return { label: px('--fs-label'), bh, n: bh.length };
    });
    /* #archiveView p is (1,0,1) and .ay-bh is a bare class, so the id won whatever
       the source order: all six headings drew at 12.5px with line-height 1.65. */
    check(sz.n >= 6, 'an open card shows its six section headings', String(sz.n));
    check(sz.bh.every(v => near(v, sz.label, 0.05)),
      'and every one of them is --fs-label, not the 12.5px prose size',
      JSON.stringify([sz.label, [...new Set(sz.bh)]]));

    check(R.errs.length === 0, 'no page errors across section 11', R.errs.join(' | '));
    await R.ctx.close();
  }

  console.log(`\nARCHIVES: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
