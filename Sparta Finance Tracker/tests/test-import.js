/* CSV import + the trend-filter popover.

   Five reported problems, each pinned here: refunds dropped, card payments
   (correctly) excluded, re-import unable to restore a deleted row, a statement
   silently filed under the wrong month, and a filter popover the chart painted
   over so its checkboxes could not be clicked. */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);

// a card statement with a purchase, a refund, and a payment to the card
const CSV = [
  'Date,Description,Debit,Credit,Category',
  '2026-07-04,LOBLAWS #123,120.50,,Groceries',
  '2026-07-09,SHELL GAS,60.00,,Gas',
  '2026-07-14,LOBLAWS REFUND,,45.25,Groceries',
  '2026-07-20,PAYMENT THANK YOU,,500.00,',
].join('\n');
// Single-amount-column file where purchases are negative. Auto-detect needs a
// clear majority (>60% negative) to call the convention, so the file has to look
// like a real statement -- mostly purchases, the odd refund.
const CSV_NEG = ['Date,Description,Amount',
  '2026-07-05,COSTCO WHOLESALE,-88.40',
  '2026-07-06,PETRO CANADA,-55.00',
  '2026-07-08,METRO GROCERY,-42.15',
  '2026-07-09,TIM HORTONS,-9.75',
  '2026-07-11,AMZN REFUND,32.10'].join('\n');

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(300); };
  const feed = async (text, name = 'stmt.csv') => {
    await page.setInputFiles('#meFile', { name, mimeType: 'text/csv', buffer: Buffer.from(text) });
    await page.waitForTimeout(500);
  };
  const preview = () => page.evaluate(() => mePending.map(p => ({ d: p.date, n: p.desc, a: p.amt })));
  /* "Allot all to" is required before an import can be committed, so every
     commit below needs a Yearly expense in the tab's month to land on. */
  const seedBill = () => page.evaluate(() => {
    const m = meMonth;
    if (!(state.yf.txns || []).some(t => t.tab !== 'me' && (t.date || '').slice(0, 7) === m))
      state.yf.txns.push({ id: 'bill' + m, type: 'expense', date: m + '-20', amt: 5000,
        desc: 'Statement ' + m, cat: 'Credit Bill', who: 'ABI', tab: 'yf' });
    if (!state.yf.cats.exp.includes('Credit Bill')) state.yf.cats.exp.push('Credit Bill');
    renderME();
  });
  const commit = async () => {
    await seedBill();
    await page.selectOption('#meImpAllot', 'Credit Bill');
    await page.click('#meApply');
    await page.waitForTimeout(450);
  };

  await go('monthly');

  section('1. refunds arrive as negative expenses; card payments stay excluded');
  await feed(CSV);
  const rows = await preview();
  check(rows.length === 3, 'purchase, gas and refund all queued', JSON.stringify(rows.map(r => r.a)));
  const refund = rows.find(r => /REFUND/.test(r.n));
  check(refund && refund.a === -45.25, 'the refund comes in NEGATIVE, so it offsets its category',
    refund ? String(refund.a) : 'missing');
  check(!rows.some(r => /PAYMENT THANK YOU/.test(r.n)),
    'the card payment is still excluded — it is settling the bill, not spending');
  check(await page.evaluate(() => meMoney(-45.25)) === '-$45.25',
    'a negative renders as -$45.25, not $-45.25', await page.evaluate(() => meMoney(-45.25)));

  section('2. a refund reduces the month total rather than adding to it');
  await commit();
  const sums = await page.evaluate(() => {
    const t = state.yf.txns.filter(x => (x.date || '').startsWith('2026-07'));
    return { n: t.length, net: +t.reduce((s, x) => s + x.amt, 0).toFixed(2) };
  });
  check(sums.n === 3, 'three rows landed');
  check(sums.net === 135.25, 'net spend is 120.50 + 60.00 − 45.25', String(sums.net));

  section('3. a deleted row can be restored by re-importing the same file');
  await page.evaluate(() => { const i = state.yf.txns.findIndex(t => /SHELL/.test(t.desc));
    state.yf.txns.splice(i, 1); yfPersist(); renderME(); });
  check(await page.evaluate(() => state.yf.txns.filter(t => /SHELL/.test(t.desc)).length) === 0,
    'row deleted, as if lost to a bad sync');
  await feed(CSV);
  const back = await preview();
  check(back.length === 1 && /SHELL/.test(back[0].n),
    'only the missing row is offered, not the two still present', JSON.stringify(back.map(r => r.n)));
  check((await page.textContent('#meSummary')).includes('restored'),
    'and it is reported as a restore', (await page.textContent('#meSummary')));
  await commit();
  check(await page.evaluate(() => state.yf.txns.filter(t => /SHELL/.test(t.desc)).length) === 1,
    'restored exactly once');

  section('4. re-importing a fully present file still says so');
  await feed(CSV);
  check(await page.evaluate(() => document.getElementById('mePreviewWrap').style.display) === 'none',
    'nothing offered when every row is already in the ledger');

  section('5. the month check warns when a statement is filed elsewhere');
  // "Allot to" only offers bills Yearly actually holds for the month in view, so
  // the month being viewed needs a real bill before anything can be filed into it.
  await page.evaluate(() => {
    state.yf.txns = []; state.me.imported = [];
    state.yf.txns.push({ id: 'cb', type: 'expense', date: meMonth + '-20', amt: 1910,
      desc: 'Credit Bill', cat: 'Credit Bill', who: 'ABI' });
    yfPersist(); mePersist(); renderME();
  });
  await page.waitForTimeout(200);
  const viewing = await page.evaluate(() => meMonth);
  await page.evaluate(() => { const s = document.getElementById('meImpAllot');
    s.value = 'Credit Bill'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await feed(CSV);
  const warn = await page.evaluate(() => {
    const n = document.getElementById('meMonthCheck');
    return { shown: n.style.display !== 'none', txt: n.textContent };
  });
  check(warn.shown, 'the month check is visible');
  check(/July 2026/.test(warn.txt), 'it names the months the rows are dated', warn.txt.slice(0, 90));
  if (viewing !== '2026-07') {
    check(/Check the month/.test(warn.txt),
      'and warns loudly when they will be filed under a different month', warn.txt.slice(0, 70));
  }

  section('6. single-amount file where purchases are negative');
  await page.evaluate(() => { state.yf.txns = []; state.me.imported = []; yfPersist(); mePersist(); renderME(); });
  await feed(CSV_NEG, 'neg.csv');
  const neg = await preview();
  const costco = neg.find(r => /COSTCO/.test(r.n)), amzn = neg.find(r => /AMZN/.test(r.n));
  check(costco && costco.a === 88.40, 'auto-detect flips a negative purchase to a positive expense',
    costco ? String(costco.a) : 'missing');
  check(amzn && amzn.a === -32.10, 'and the positive refund to a negative one',
    amzn ? String(amzn.a) : 'missing');

  section('6b. the manual sign override is gone; auto-detect reads both conventions');
  // "Expenses appear as" was removed — auto-detect samples the Amount column and
  // needs >60% negative to call a file negative-purchase, which it gets right on
  // both shapes. What matters now is that the control is gone and nothing broke.
  check(await page.$('#meSign') === null, 'the "Expenses appear as" select is gone');
  check(await page.$('#meSource') === null, 'the dead "Statement source" select is gone too');
  await page.evaluate(() => { state.yf.txns = []; state.me.imported = []; yfPersist(); mePersist(); renderME(); });
  await feed(CSV, 'pos2.csv');
  const posAgain = await preview();
  const lob = posAgain.find(r => /LOBLAWS/.test(r.n));
  check(lob && lob.a === 120.50, 'a positive-purchase file still reads positive',
    lob ? String(lob.a) : 'missing');

  section('6c. the typed statement source tags the rows it imports');
  await page.evaluate(() => { state.yf.txns = []; state.me.imported = []; yfPersist(); mePersist(); renderME(); });
  await feed(CSV, 'src.csv');
  await preview();
  await page.fill('#meImpSrc', 'Amex <Gold> & Co');
  await commit();
  const src = await page.evaluate(() => {
    // Allotted rows follow their BILL's month, not their own date, so stay on the
    // month the import was committed into rather than jumping to July.
    renderME();
    // Monthly's own rows only — the bill seeded for the import to land on is
    // Yearly's and was never imported, so it carries no source.
    const rows = (state.yf.txns || []).filter(t => t.type === 'expense' && t.tab === 'me');
    return { srcs: [...new Set(rows.map(t => t.src))],
             tag: document.getElementById('meBody').innerHTML };
  });
  check(src.srcs.length === 1 && src.srcs[0] === 'Amex <Gold> & Co',
    'every imported row carries the typed source', JSON.stringify(src.srcs));
  check(/Amex &lt;Gold&gt; &amp; Co/.test(src.tag) && !/<Gold>/.test(src.tag),
    'and it renders as a tag with the angle brackets escaped');
  await page.fill('#meImpSrc', '');

  section('6d. the month being filed into is shown on the button row');
  await page.evaluate(() => { state.yf.txns = []; state.me.imported = []; yfPersist(); mePersist(); renderME(); });
  await feed(CSV, 'chip.csv');
  await preview();
  const chip = await page.evaluate(() => {
    const el = document.getElementById('meApplyMonth');
    const plain = el.textContent;
    const sel = document.getElementById('meImpAllot');
    let allotted = '';
    if (sel.options.length > 1) { sel.value = sel.options[1].value; sel.onchange(); allotted = el.textContent; }
    return { plain, allotted, month: meMonthName(meMonth) };
  });
  check(chip.plain.toLowerCase().includes(chip.month.toLowerCase()),
    'the chip names the month the picker is on', chip.plain);
  /* Deliberately short. The long form ("· rows keep their own dates") pushed the
     chip onto a second line once Import and Add Expense became half-width panels,
     away from the button it belongs to. That detail is already spelled out in
     #meMonthCheck directly above the preview, so it is not lost. */
  check(chip.plain.length <= 24, 'and stays short enough to sit beside the button',
    `${chip.plain.length} chars`);
  const beside = await page.evaluate(() => {
    const c = document.getElementById('meApplyMonth'), b = document.getElementById('meApply');
    return Math.abs(c.getBoundingClientRect().top - b.getBoundingClientRect().top);
  });
  check(beside < 20, 'which it does, on the same row as Add to expenses', `${Math.round(beside)}px lower`);

  section('6e. an import will not commit until a bill is chosen');
  await page.evaluate(() => { state.yf.txns = []; state.me.imported = []; renderME(); });
  await feed(CSV, 'gate.csv');
  await preview();
  const gateNone = await page.evaluate(() => ({
    disabled: document.getElementById('meApply').disabled,
    warn: document.getElementById('meImpGate').textContent,
    shown: document.getElementById('meImpGate').style.display }));
  check(gateNone.disabled, 'with no Yearly expense in the month, Add to expenses is disabled');
  check(/no expense in Yearly Finance/.test(gateNone.warn) && gateNone.shown === 'block',
    'and the reminder says to add one there first', gateNone.warn);
  await seedBill();
  const gateSet = await page.evaluate(() => ({
    disabled: document.getElementById('meApply').disabled,
    warn: document.getElementById('meImpGate').textContent }));
  check(gateSet.disabled, 'a bill existing is not enough — Allot all to is still on none');
  check(/is on .none./.test(gateSet.warn), 'and the reminder now names that instead', gateSet.warn);
  const blocked = await page.evaluate(() => {
    const before = state.yf.txns.length;
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m };
    meApplyImport(); window.toast = rt;
    return { added: state.yf.txns.length - before, msg };
  });
  check(blocked.added === 0 && /Allot all to/.test(blocked.msg),
    'and calling it directly is refused too, not just disabled in the UI', blocked.msg);
  await page.selectOption('#meImpAllot', 'Credit Bill');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.getElementById('meApply').disabled),
    'choosing the bill releases the button');

  section('7. the 12-month trend filter is actually clickable');
  await page.evaluate(() => { document.getElementById('mePreviewWrap').style.display = 'none'; });
  await page.click('#meGear'); await page.waitForTimeout(250);
  const hit = await page.evaluate(() => {
    const cb = document.querySelector('#mePopList [data-mecat]');
    /* elementFromPoint only sees the viewport, and with the two entry panels
       stacked full width again the popover can sit below the fold — the hit test
       then reads null rather than whatever is on top. scrollIntoView does not
       help here because the popover is absolutely positioned, so scroll the
       window to put it in the middle of the screen and re-measure. */
    const abs = cb.getBoundingClientRect().top + scrollY;
    // behavior:'instant' matters — html has scroll-behavior:smooth, so a plain
    // scrollTo animates and the re-measure below reads the pre-scroll position
    window.scrollTo({ top: Math.max(0, abs - innerHeight / 2), behavior: 'instant' });
    const r = cb.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { onTop: !!(top && top.closest('#mePop')), what: top ? top.tagName + (top.id ? '#' + top.id : '') : null };
  });
  check(hit.onTop, 'the popover is on top — the chart no longer intercepts the click', String(hit.what));
  const firstCat = await page.evaluate(() => document.querySelector('#mePopList [data-mecat]').dataset.mecat);
  const before = await page.evaluate(c => state.me.chartCats.includes(c), firstCat);
  await page.click(`#mePopList [data-mecat="${firstCat}"]`, { timeout: 5000 });
  await page.waitForTimeout(250);
  const after = await page.evaluate(c => ({ inList: state.me.chartCats.includes(c),
    open: document.getElementById('mePop').classList.contains('open') }), firstCat);
  check(after.inList !== before, `clicking "${firstCat}" toggles it`, `${before} → ${after.inList}`);
  check(after.open, 'and the popover stays open instead of vanishing');

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nIMPORT: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
