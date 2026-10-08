/* Does user text survive a trip through innerHTML as TEXT?

   This file builds its HTML with template literals and direct innerHTML
   assignment, which is fine, and it carries eleven local escaping helpers
   because of it. The ones below were the sites that had none, each found by
   firing a real payload at the real render path rather than by reading:

     - a Yearly CATEGORY NAME, typed in the UI, went raw into its table cell;
     - a CSV HEADER CELL was echoed back raw by the column-detection strip;
     - a CSV SYMBOL column went raw into the holdings import preview;
     - a TICKER went raw into title=" and aria-label=" on every holdings row;
     - the SAVED QUOTE LINK went raw into href=" on two render paths.

   Every check asserts the payload is INERT, not that it is absent: the text
   must still be shown, just not as markup. So each one pairs "no element was
   created / no handler was attached" with "the literal string is still on
   screen". A test that only looked for the absence of an <img> would pass just
   as well against a build that silently dropped the name.

   The category list and the ledger both travel in corePayload(), so the first
   of these reached every synced device, not just the browser that typed it. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);

/* The handler is entity-encoded because two of these sites upper-case their
   input first. HTML entities are digits and punctuation, so toUpperCase() is a
   no-op on them, and the attribute parser decodes them afterwards -- which is
   exactly why upper-casing is not sanitising. */
const ent = s => [...s].map(c => '&#' + c.charCodeAt(0) + ';').join('');

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url, SEED);
  await page.setViewportSize({ width: 1360, height: 1000 });

  const fired = [];
  await page.exposeFunction('__xss', w => fired.push(String(w)));
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(220); };

  // ─────────────────────────────────────────────────────────────────────────
  section('1. a Yearly category name is text, in the table and in the picker');
  const CAT = '<img src=x onerror="window.__xss(\'cat\')">Rent&Co';
  await go('yearly');
  /* yfFillCats() fills from whichever side #yfType is on, and it boots on
     Income -- so an expense category pushed without switching it is simply not
     in the list, and the check below would pass for the wrong reason. */
  await page.evaluate(c => {
    state.yf.cats.exp.push(c);
    document.getElementById('yfType').value = 'expense';
    renderYF(); yfFillCats();
  }, CAT);
  await page.waitForTimeout(400);

  check(!fired.includes('cat'), 'no handler ran from the category table');
  check(await page.evaluate(() => document.querySelectorAll('#yfExpBody img').length) === 0,
    'no element was created in the Expenses table');
  /* ...and the name is still READABLE. textContent, so the browser has already
     decoded the entities: this is the string the user typed, character for
     character, which is the half a drop-the-name "fix" would fail. */
  check(await page.evaluate(c => [...document.querySelectorAll('#yfExpBody td')]
    .some(td => td.textContent === c), CAT),
    'the category cell still shows the name exactly as typed');
  /* The option has no value attribute, so its TEXT is its value -- which is
     what makes over-escaping here a real risk: a stray `&amp;` would be
     selected and then saved onto the row. Checked with a plain awkward name
     rather than the payload, because option.value is `this.text`, and the DOM
     strips and collapses whitespace on the way out, so nothing containing a run
     of spaces can round-trip through it by definition. */
  const PLAIN = 'Rent&Co<b>';
  await page.evaluate(c => {
    state.yf.cats.exp.push(c);
    document.getElementById('yfType').value = 'expense';
    renderYF(); yfFillCats();
  }, PLAIN);
  await page.waitForTimeout(250);
  check(await page.evaluate(c => [...document.getElementById('yfCat').options]
    .some(o => o.value === c && o.textContent === c), PLAIN),
    'a name with & and < round-trips through the picker with .value intact');
  check(await page.evaluate(c => [...document.querySelectorAll('#yfExpBody td')]
    .some(td => td.textContent === c), PLAIN),
    'and reads back the same in the Expenses table');
  check(await page.evaluate(() => document.querySelectorAll('#yfCat img').length) === 0,
    'no element was created inside the picker');

  // ─────────────────────────────────────────────────────────────────────────
  section('2. a CSV header cell is text in the column-detection strip');
  await go('monthly');
  /* No double quotes in this one: parseCSV treats a bare `"` as a field quote
     and eats it, so a quoted payload never arrives intact -- and an unquoted
     attribute value runs perfectly well, which is the point. */
  const HDR = "Date<img src=x onerror=window.__xss('hdr')>";
  await page.evaluate(h => {
    meHandleCSV(h + ',Description,Amount\n2026-01-05,COFFEE,12.50\n');
  }, HDR);
  await page.waitForTimeout(400);

  check(!fired.includes('hdr'), 'no handler ran from the detected-columns strip');
  check(await page.evaluate(() => document.querySelectorAll('#meDetectBody img').length) === 0,
    'no element was created in the strip');
  check(await page.evaluate(h => document.getElementById('meDetectBody').textContent.includes(h), HDR),
    'the header is still echoed back in full, so the mapping can be checked');

  // ─────────────────────────────────────────────────────────────────────────
  section('3. a CSV Symbol column is text in the holdings import preview');
  await go('dash');
  /* Upper-cased and whitespace-stripped by handleCSV. Attributes are separated
     by the closing quote rather than a space, so stripping spaces achieves
     nothing; the quotes are DOUBLED because parseCSV eats a bare one inside a
     quoted field. */
  const SYM = `<IMG/SRC=""X""ONERROR=${ent("window.__xss('sym')")}>`;
  await page.evaluate(p => {
    handleCSV('Symbol,Quantity,Average Cost\n"' + p + '",5,10\n');
  }, SYM);
  await page.waitForTimeout(400);

  check(!fired.includes('sym'), 'no handler ran from the import preview');
  check(await page.evaluate(() => document.querySelectorAll('#impBody img').length) === 0,
    'no element was created in the preview');
  check(await page.evaluate(() => {
    const td = document.querySelector('#impBody tr td:nth-child(2)');
    return !!td && td.textContent.includes('ONERROR');
  }), 'the symbol cell still shows the text it was given');

  // ─────────────────────────────────────────────────────────────────────────
  section('4. a ticker cannot close title=" or aria-label=" on a holdings row');
  /* One quote is all it takes: `A" ONMOUSEOVER=...` ends the title attribute
     and everything after it is parsed as further attributes on the SAME tag. */
  const TICK = `A" ONMOUSEOVER=${ent("window.__xss('tick')")} X="`;
  await page.evaluate(t => {
    state.holdings.push({ id: 'xss1', sym: t, acct: 'TFSA', qty: 1, avg: 1,
      price: 1, ccy: 'USD', nat: true });
    render();
  }, TICK);
  await page.waitForTimeout(300);

  check(await page.evaluate(() => !document.querySelector('#hbody [onmouseover]')),
    'no event-handler attribute was created on any holdings row');
  check(await page.evaluate(t => [...document.querySelectorAll('#hbody .sym')]
    .some(s => s.textContent.includes(t)), TICK),
    'the ticker is still printed, quote and all');
  /* The quote also reaches aria-label, which is the accessible name screen
     readers announce -- a breakout there is a broken label as well as a hole. */
  check(await page.evaluate(t => [...document.querySelectorAll('#hbody a.qlink')]
    .some(a => (a.getAttribute('aria-label') || '').includes(t)), TICK),
    'aria-label holds the whole ticker as one attribute value');

  // ─────────────────────────────────────────────────────────────────────────
  section('5. a saved quote link cannot close href="');
  /* The save handler checks the SCHEME (/^https?:\/\//) and that new URL()
     accepts it, and both pass here -- the value really is an https URL. What it
     never checked is that the string is safe to drop into an attribute, and
     quoteBase() reads the store back raw on every render. */
  await page.evaluate(() => {
    store.set('sparta.quoteUrl', 'https://example.com/"onmouseover="window.__xss(\'url\')');
    render();
  });
  await page.waitForTimeout(300);

  check(await page.evaluate(() => !document.querySelector('#hbody a.qlink[onmouseover]')),
    'no handler was attached to a holdings quote link');
  check(await page.evaluate(() => {
    const a = document.querySelector('#hbody a.qlink');
    return !!a && a.getAttribute('href').startsWith('https://example.com/"onmouseover=');
  }), 'the href holds the whole pasted link as one attribute value');

  /* The Eye on Stocks row builds the same link from the same base, so it had to
     be fixed in two places. Reaching it needs more than expanding the row:
     npBody() returns "Loading..." until npQuotes holds a figure for the symbol,
     so with nothing seeded there is no anchor on the page at all -- and
     `!querySelector(...)` is then true for a build with no fix in it. The quote
     is seeded directly rather than fetched (lib.js aborts off-host requests),
     and the anchor's EXISTENCE is asserted before anything is claimed about it. */
  await page.evaluate(() => {
    state.notes.stocks = ['AAPL'];
    npQuotes['AAPL'] = { state: 'ok', price: 212.4, chg: 0.8, ccy: 'USD', name: 'Apple Inc' };
    npOpen.add('AAPL'); renderStocks();
  });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('#npStocks a.qlink')),
    'the Eye on Stocks quote link is actually on the page to be checked');
  check(await page.evaluate(() => !document.querySelector('#npStocks a.qlink[onmouseover]')),
    'and no handler was attached to it');

  await page.evaluate(() => { store.del('sparta.quoteUrl'); render(); });

  // ─────────────────────────────────────────────────────────────────────────
  check(fired.length === 0, 'nothing executed anywhere in this run', fired.join(','));
  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nESCAPING: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
