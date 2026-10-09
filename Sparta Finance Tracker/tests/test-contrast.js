/* Contrast, target size and panel-edge alignment — measured, not eyeballed.

   Three things this pins, each of which was broken when it was written:

   1. The two dim ink tokens. --text-faint at .35 measured 2.71:1 to 2.97:1
      against the REAL composited backgrounds of the six tabs, which is under
      the 4.5:1 body bar and under even the 3:1 UI bar on the lighter panels --
      and it carries every form label, every .htable th and the whole of the
      empty states. The ratio is computed by compositing the ancestor chain's
      background-colors down onto the page, because an alpha ink over glass has
      no single "background colour" to read off one element.

   2. The Highlights carousel dots. 7x7 of painted box AND 7x7 of hit area, at
      every width down to 320px, as the only control on that carousel. Grown
      with a pseudo-element the way .bk does it, so the dot still LOOKS 7px.
      The overlap half of the check matters as much as the size half: .on
      scales the button 1.25x, pseudo-element included, so a hit area sized
      without that in mind makes the active dot swallow its neighbours.

   3. The panel-edge rule, applied to the tables that never had it. A panel
      heading sits on the panel's content edge; the first column of the table
      under it was starting 7-10px inside that edge, differently per tab.

   Decoration is excluded throughout: every animated backdrop field in this app
   is inside an aria-hidden container, and WCAG exempts decorative text. */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => {
  c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);
const VIEWS = ['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan'];

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 1440, height: 1000 });
  /* Freeze transitions before measuring anything. getComputedStyle returns the
     CURRENT interpolated value of a property still in transition, so reading a
     tab button a few ms after the click can catch .seg button.active mid-fade
     -- dark #0a0f1c ink over a background that has not finished becoming white
     yet, which reports as 1.22:1 and is a measurement of nothing. */
  await page.addStyleTag({ content:
    '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => {
    state.plan = { segments: [{ id: 's', name: 'Runway', start: 13632, open: true,
      items: [{ id: 'i', date: '2026-12-01', type: 'expense', name: 'Credit Bill', amt: 1910, notes: 'x' }] }] };
    planPersist(); renderPlan();
  });
  const go = async v => {
    await page.click(`#viewSeg button[data-view="${v}"]`);
    await page.waitForTimeout(360);
    if (v === 'archive') {
      await page.evaluate(() => { const r = document.querySelector('#archiveView .ay-row'); if (r) r.click(); });
      await page.waitForTimeout(420);
    }
  };

  /* ── 4. heading and first column share the panel's edge ───────────────── */
  section('4. every table\'s first column declares the panel edge with its ink');
  /* Glyph position comes from Range, but a TRANSFORMED glyph is skipped: the
     Deposit log titles itself with a .collapse-btn whose .chev rotates 90deg
     when open, and a rotated "›" reports an advance box 6.85px left of the
     box it actually occupies. That is the caret's optical centre sitting on
     the edge, not the heading starting outside the panel -- measuring it would
     have had the test chasing a disclosure arrow. */
  const INK = `(el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let best = null, n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      let p = n.parentElement, skewed = false;
      while (p && p !== el.parentElement) {
        if (getComputedStyle(p).transform !== 'none') { skewed = true; break; }
        p = p.parentElement;
      }
      if (skewed) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter(q => q.width > 0 && q.height > 0);
      if (!rects.length) continue;
      const top = Math.min(...rects.map(q => q.top));
      for (const q of rects) if (q.top <= top + 1.5 && (best === null || q.left < best)) best = q.left;
    }
    return best;
  }`;
  const TABLES = [
    ['contrib', '#ctable', 'Deposit log'],
    ['contrib', '#ytable', 'Total contributions by year'],
    ['yearly', '#yfExpTable', 'Expenses'],
    ['yearly', '#yfIncTable', 'Income'],
    ['yearly', '#yfTxTable', 'Transactions'],
  ];
  for (const w of [1440, 900, 375]) {
    await page.setViewportSize({ width: w, height: 1000 });
    for (const v of ['contrib', 'yearly']) {
      await go(v);
      /* The Deposit log starts collapsed, and measuring inside a collapsed
         panel returns zeros -- the display:none trap. Open it first. */
      if (v === 'contrib') {
        await page.evaluate(() => {
          const t = document.getElementById('ctable');
          if (t && !t.offsetParent) {
            const b = document.getElementById('logToggle') ||
                      document.querySelector('#contribView .collapse-btn');
            if (b) b.click();
          }
        });
        await page.waitForTimeout(320);
      }
      const res = await page.evaluate(([sel, inkSrc]) => {
        const ink = eval(inkSrc);
        const out = {};
        for (const id of sel) {
          const t = document.querySelector(id);
          if (!t || !t.offsetParent) { out[id] = null; continue; }
          const panel = t.closest('.panel');
          const cell = t.querySelector('tr > th, tr > td');
          if (!panel || !cell) { out[id] = null; continue; }
          /* Against the panel's own content edge, not against the heading.
             The heading was only ever a proxy for that edge, and on the
             Deposit log the heading's first ink is a disclosure caret whose
             rotation state -- and therefore whose measured left -- changes
             with the width. The edge does not move. */
          const cs = getComputedStyle(panel);
          const edge = panel.getBoundingClientRect().left +
            parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
          out[id] = { d: +(ink(cell) - edge).toFixed(2) };
        }
        return out;
      }, [TABLES.filter(t => t[0] === v).map(t => t[1]), INK]);
      for (const [tab, id, label] of TABLES.filter(t => t[0] === v)) {
        const r = res[id];
        check(r && Math.abs(r.d) <= 1.0,
          `${w}px ${label}: first column's ink is on the panel edge`,
          r ? `Δ${r.d}px` : 'not rendered');
      }
    }
  }

  /* ── 5. the two documented exceptions must STAY inset ─────────────────── */
  section('5. the two panels that declare the edge another way are left alone');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go('dash');
  const hold = await page.evaluate(() => {
    const c = document.querySelector('#holdingsCard .htable td:first-child');
    return c ? getComputedStyle(c).paddingLeft : null;
  });
  check(hold === '10px',
    'Holdings keeps the 10px first-cell gutter the broker mark hangs in', `padding-left ${hold}`);
  await go('monthly');
  const mx = await page.evaluate(() => {
    const c = document.querySelector('.me-matrix td:first-child, .me-matrix th:first-child');
    if (!c) return null;
    const cs = getComputedStyle(c);
    return { pad: cs.paddingLeft, pos: cs.position, bg: cs.backgroundImage !== 'none' };
  });
  check(mx && mx.pos === 'sticky' && mx.bg,
    'the category matrix still declares its edge with sticky chrome, so its inset is allowed',
    mx && JSON.stringify(mx));

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nCONTRAST: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
