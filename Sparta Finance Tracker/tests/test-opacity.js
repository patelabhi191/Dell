/* The inline opacities inside render functions, measured against what they are
   actually painted on.

   These are the same fault as the holdings sub-lines, in four more places that
   the design review could see but could not reach: an `opacity` in a JS template
   literal, stacked on a colour that was already tuned. `opacity` composites the
   whole element, while getComputedStyle().color keeps reporting full strength --
   so every one of them reads as fine from the declaration and is not.

   THE BACKDROP IS SAMPLED, NOT DERIVED. Walking up the ancestors for a
   background with a usable alpha finds nothing here -- every glass surface in
   this app is about .03 -- and falls through to the page, which reports a
   comfortable and wrong number. That is how the first holdings check passed
   against a failing value. Each probe instead hides its glyphs, takes ONE
   fullPage screenshot and reads the pixel underneath at the span's page
   coordinate. That needs no model of the compositing order and, unlike even a
   correct compositor, it survives backdrop-filter, which blurs what is behind
   rather than layering it. fullPage rather than a per-element clip, which throws
   the moment a row sits below the fold.

   THE BAR IS 4.7, NOT 4.5. None of this text reaches the large-text exemption
   (the biggest is 14px bold, and 18.66px bold is the threshold), so the body bar
   of 4.5 applies -- plus about .2 of margin, because these backdrops are
   animated decorative fields and vary with time and with position. A figure
   inside that margin is treated as failing. */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => {
  c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);

const BAR = 4.7;
// The page, and the hardcoded fallback the derived-background version used.
const PAGEISH = ['rgb(7,21,32)', 'rgb(11,15,25)'];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const l1 = L(a), l2 = L(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };

/* Sample every element matching `sel`, compositing the DECLARED alpha and then
   the element opacity onto the pixel really painted underneath. Two
   multiplications, which is the compounding these sites were getting wrong:
   --text-dim is itself rgba(...,.55) before any opacity touches it. */
async function probe(page, sel) {
  const spans = await page.evaluate((s) => {
    const out = [];
    document.querySelectorAll('[data-oprobe]').forEach(e => e.removeAttribute('data-oprobe'));
    document.querySelectorAll(s).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;        // the display:none trap
      if (!(el.textContent || '').trim()) return;
      const cs = getComputedStyle(el);
      el.setAttribute('data-oprobe', String(i));
      out.push({
        text: (el.textContent || '').trim().slice(0, 16), op: Number(cs.opacity),
        color: cs.color, fontPx: parseFloat(cs.fontSize), weight: cs.fontWeight,
        inlineOp: /opacity/.test(el.getAttribute('style') || ''),
        past: !!el.closest('.pl-row.past'), down: !!el.closest('.down'),
        x: Math.round(r.left + r.width / 2 + scrollX),
        y: Math.round(r.top + r.height / 2 + scrollY),
      });
    });
    return out;
  }, sel);
  if (!spans.length) return [];
  await page.evaluate(() => document.querySelectorAll('[data-oprobe]')
    .forEach(e => { e.style.visibility = 'hidden' }));
  const sheet = (await page.screenshot({ fullPage: true })).toString('base64');
  await page.evaluate(() => document.querySelectorAll('[data-oprobe]')
    .forEach(e => { e.style.visibility = '' }));
  const bgs = await page.evaluate(async ({ b, pts }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return pts.map(p => { const d = g.getImageData(p.x, p.y, 1, 1).data; return [d[0], d[1], d[2]] });
  }, { b: sheet, pts: spans.map(s => ({ x: s.x, y: s.y })) });
  return spans.map((sp, k) => {
    const bg = bgs[k];
    const m = (sp.color.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
    const declAlpha = m.length > 3 ? m[3] : 1;
    const ink = m.slice(0, 3).map((v, q) => v * declAlpha + bg[q] * (1 - declAlpha));
    const eff = ink.map((v, q) => v * sp.op + bg[q] * (1 - sp.op));
    return { ...sp, declAlpha, bg: `rgb(${bg.join(',')})`, eff: +ratio(eff, bg).toFixed(2) };
  });
}

const show = r => JSON.stringify(r.map(x => ({ t: x.text, op: x.op, bg: x.bg, eff: x.eff })));

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 1440, height: 1200 });
  /* Freeze transitions. A property still interpolating reports its current
     intermediate value, which is a measurement of nothing (bug class 11). */
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important}' });
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(420) };

  /* ── 1. the realised-return currency suffix ───────────────────────────── */
  section('1. #sellSum: the currency suffix on a LOSING return');
  await go('dash');
  await page.evaluate(() => {
    /* Both signs, because the suffix inherits the row's up/down colour and only
       the LOSS colour ever failed -- a fixture of winners would exercise
       nothing (bug class 7). VFV is sold under cost on purpose. */
    state.sells = [
      { id: 's1', sym: 'AAPL', acct: 'TFSA', qty: 5, avg: 180, price: 210, ccy: 'USD', t: Date.now() - 864e5 },
      { id: 's2', sym: 'VFV', acct: 'TFSA', qty: 10, avg: 150, price: 130, ccy: 'CAD', t: Date.now() - 1728e5 },
    ];
    renderSells();
  });
  await page.waitForTimeout(300);
  const sell = await probe(page, '#sellSum small');
  check(sell.length >= 2, 'both currencies render a suffix, so there is something to measure',
    `${sell.length} found`);
  check(sell.some(r => r.down), 'the fixture puts a LOSING return on screen',
    JSON.stringify(sell.map(r => ({ t: r.text, down: r.down }))));
  check(sell.every(r => PAGEISH.indexOf(r.bg) < 0),
    'the sampled backdrop is the panel, not the page behind it',
    JSON.stringify([...new Set(sell.map(r => r.bg))]));
  check(sell.length > 0 && sell.every(r => r.eff >= BAR),
    `every currency suffix composites to at least ${BAR}:1`, show(sell));
  check(sell.every(r => !r.inlineOp),
    'no suffix carries an inline opacity for the up/down colour to be dimmed by');

  /* ── 2. the holdings import preview ──────────────────────────────────── */
  section('2. the import preview\'s currency cell is already fine — pinned so it stays');
  await page.evaluate(() => {
    impRows = [
      { sym: 'AAPL', acct: 'TFSA', qty: 10, avg: 180.5, px: 212.4, ccy: 'USD', include: true },
      { sym: 'XEQT', acct: 'FHSA', qty: 40, avg: 31.2, px: 33.9, ccy: 'CAD', include: true },
    ];
    renderImportPreview();
  });
  await page.waitForTimeout(300);
  const imp = await probe(page, '#impBody span[style*="opacity"]');
  check(imp.length >= 2, 'the preview rendered its currency cells', `${imp.length} found`);
  /* This one keeps its .7 deliberately. It is --text on a panel, not an alpha
     token, and it samples around 7.5:1 -- so it is NOT the same fault as the
     other four, and nothing here should be "fixed" to match them. */
  check(imp.length > 0 && imp.every(r => r.eff >= BAR),
    `the preview's .7 currency cell still clears ${BAR}:1 — correct as written`, show(imp));

  /* ── 3. the statement-source tag ─────────────────────────────────────── */
  section('3. Monthly\'s source tag is the same component as the bill tag beside it');
  await page.evaluate(() => {
    const mo = (new Date()).toISOString().slice(0, 7);
    /* A bill, an allocation against it carrying a source, a plain imported row,
       and a Bill Payment child -- so BOTH tag sites render: txTags() on the
       ordinary rows and the me-paykid sub-row's own copy. */
    state.yf.txns = [
      { id: 'bill1', type: 'expense', date: mo + '-05', amt: 1900, desc: 'Amex statement',
        cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'a1', type: 'expense', date: mo + '-07', amt: 42.5, desc: 'Metro pass',
        cat: 'Transit', who: 'ABI', tab: 'me', allot: 'bill1', allotM: mo, src: 'Amex Aug' },
      { id: 'a2', type: 'expense', date: mo + '-09', amt: 88.1, desc: 'Loblaws',
        cat: 'Groceries', who: 'ABI', tab: 'me', src: 'Amex Aug' },
      { id: 'p1', type: 'expense', date: mo + '-20', amt: -500, desc: 'PAYMENT THANK YOU',
        cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: 'bill1', allotM: mo, src: 'Amex Aug' },
    ];
    state.me.imported = []; yfPersist(); meMonth = mo; renderME();
  });
  await go('monthly');
  await page.waitForTimeout(520);
  const tags = await probe(page, '#monthlyView .acct-tag.tag-other');
  const srcTags = tags.filter(t => /Amex Aug/.test(t.text));
  const billTags = tags.filter(t => /→/.test(t.text));
  check(srcTags.length >= 2, 'both source-tag sites rendered (txTags and the me-paykid row)',
    `${srcTags.length} source tags`);
  check(billTags.length >= 1, 'the no-opacity bill tag is on screen to compare against',
    `${billTags.length} bill tags`);
  check(tags.every(r => PAGEISH.indexOf(r.bg) < 0),
    'the sampled backdrop is Monthly\'s glass, not the page',
    JSON.stringify([...new Set(tags.map(r => r.bg))]));
  check(tags.length > 0 && tags.every(r => r.eff >= BAR),
    `every .tag-other composites to at least ${BAR}:1`, show(tags));
  /* The regression guard proper. --text-dim is already an alpha ink, so ANY
     opacity on this class multiplies it down again; there is no value to tune
     to, since even .9 reached only 4.47. */
  check(srcTags.length > 0 && srcTags.every(r => !r.inlineOp),
    'no .tag-other carries an inline opacity on top of --text-dim');
  check(srcTags.length > 0 && billTags.length > 0 &&
    new Set(tags.map(r => r.op)).size === 1,
    'the two tags render at one opacity — they are one component',
    JSON.stringify([...new Set(tags.map(r => r.op))]));

  /* ── 4. Plan's "Untitled" placeholder ────────────────────────────────── */
  section('4. Plan\'s "Untitled" placeholder, and the past-row dimming under it');
  await page.evaluate(() => {
    /* Dates as offsets from today and computed IN THE PAGE, so they match
       isoLocal()'s timezone rather than the runner's, and so the fixture does
       not quietly expire one morning (bug class 13). */
    const d = new Date(); const iso = n => {
      const x = new Date(d.getTime() + n * 864e5); const p = v => String(v).padStart(2, '0');
      return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
    };
    state.plan = { segments: [{ id: 'sg', name: 'Runway', start: 12000, open: true, items: [
      { id: 'i1', date: iso(7),  type: 'expense', name: '',           amt: 1910, notes: '' },
      { id: 'i2', date: iso(-7), type: 'expense', name: '',           amt: 400,  notes: '' },
      { id: 'i3', date: iso(-3), type: 'expense', name: 'Hydro bill', amt: 120,  notes: '' },
    ] }] };
    planPersist(); renderPlan();
  });
  await go('plan');
  await page.waitForTimeout(520);
  const unt = await probe(page, '#planSegs .pl-nm span');
  const futureUnt = unt.filter(r => !r.past);
  const pastUnt = unt.filter(r => r.past);
  check(futureUnt.length >= 1, 'an untitled FUTURE row is on screen', `${futureUnt.length} found`);
  check(pastUnt.length >= 1, 'an untitled PAST row is on screen too', `${pastUnt.length} found`);
  check(unt.every(r => PAGEISH.indexOf(r.bg) < 0),
    'the sampled backdrop is the Plan aurora, not the page',
    JSON.stringify([...new Set(unt.map(r => r.bg))]));
  check(futureUnt.length > 0 && futureUnt.every(r => r.eff >= BAR),
    `"Untitled" on an ordinary row composites to at least ${BAR}:1`, show(futureUnt));

  /* THE PAST ROW USED TO BE EXCLUDED HERE, and the exclusion was asserted
     rather than asserted-around: CSS gave .pl-row.past .pl-nm an ink of
     rgba(255,255,255,.5), which halved the colour before any opacity applied,
     so the past row could not be brought over the bar from the render function
     at all. Those two checks said so and left an instruction -- "if the CSS is
     ever fixed these two checks fail, which is the signal to fold the past row
     into the check above."
     The Plan contrast pass (2026-10-19) fixed it: the past row's primary ink is
     now --text-dim, one step down from --text rather than a second dimming on
     top of an already-dim value, and the amount's opacity:.55 is gone with it.
     So the fold is done, and what was the exclusion is now the ratchet -- an
     off-scale white here fails the suite instead of being recorded. */
  const pastNamed = await probe(page, '#planSegs .pl-row.past .pl-nm');
  const nmInk = await page.evaluate(() => {
    const el = document.querySelector('#planSegs .pl-row.past .pl-nm');
    return el ? getComputedStyle(el).color : null;
  });
  check(!/^rgba\(255, 255, 255/.test(String(nmInk)),
    'the past row\'s name ink is a token, not another hand-picked white', String(nmInk));
  check(pastNamed.length > 0 && pastNamed.every(r => r.eff >= BAR),
    `every NAMED past row clears ${BAR}:1 as well`, show(pastNamed));
  check(pastUnt.length > 0 && pastUnt.every(r => r.eff >= BAR),
    `and so does "Untitled" on a past row — the fold those two checks asked for`,
    show(pastUnt));
  /* The other half of that fault: the amount was an accent colour multiplied by
     opacity:.55, which is the "dimmed twice" pattern this review kept finding. */
  const pastAmt = await page.evaluate(() => {
    const el = document.querySelector('#planSegs .pl-row.past .pl-amt');
    return el ? getComputedStyle(el).opacity : null;
  });
  check(pastAmt === '1', 'and a past amount is no longer dimmed on top of its colour', String(pastAmt));

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nOPACITY: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
