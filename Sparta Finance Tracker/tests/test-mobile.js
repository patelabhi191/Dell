/* Phone layout: everything the open tab needs must be on screen.

   The failure this guards against is subtle -- nothing errors, nothing looks
   broken in a screenshot of the top of the page, but a control sits hundreds of
   pixels off to the right where nobody will find it. Before this, Yearly's
   Income/Expense filter was 607px past the right edge at 390px wide. */
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);
const VIEWS = ['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan'];

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForTimeout(350);
  await page.evaluate(() => { state.plan = { segments: [{ id: 's', name: 'Runway', start: 13632, open: true,
    items: [{ id: 'i', date: '2026-12-01', type: 'expense', name: 'Credit Bill — Sept cycle',
              amt: 1910, notes: 'Estimate, trending high' }] }] };
    planPersist(); renderPlan(); });
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(320); };

  section('1. the open tab\'s controls are on screen, not off to the right');
  for (const v of VIEWS) {
    await go(v);
    const off = await page.evaluate(() => {
      const vw = innerWidth, bad = [];
      // the per-tab controls: year/month pickers and the chart-mode filter
      document.querySelectorAll('.tabbar .yearbar select, .tabbar .yearbar label, .tabbar .yearbar button')
        .forEach(el => { if (!el.offsetParent) return;
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > vw + 1 || b.left < -1))
            bad.push(((el.id || el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 14) + '"')); });
      return bad;
    });
    check(off.length === 0, `${v}: every control reachable without side-scrolling`, off.join(', '));
  }

  section('2. the tab bar wraps instead of dragging its controls off-screen');
  await go('yearly');
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.tabbar'), seg = document.getElementById('viewSeg');
    const wrap = document.getElementById('yfYearWrap');
    return { barScrolls: b.scrollWidth - b.clientWidth,
             segScrolls: seg.scrollWidth - seg.clientWidth,
             segFullWidth: Math.abs(seg.getBoundingClientRect().width - b.clientWidth) < 3,
             controlsBelow: wrap.getBoundingClientRect().top > seg.getBoundingClientRect().bottom - 1,
             modeSeg: document.getElementById('yfModeSeg').getBoundingClientRect().right <= innerWidth + 1 };
  });
  check(bar.barScrolls === 0, 'the bar itself no longer scrolls as one piece', `${bar.barScrolls}px`);
  check(bar.segScrolls > 0, 'the tab list still scrolls sideways on its own', `${bar.segScrolls}px`);
  check(bar.segFullWidth, 'the tab list takes the full row');
  check(bar.controlsBelow, 'the year picker sits on the row BELOW the tabs');
  check(bar.modeSeg, 'the Income/Expense filter is fully on screen (was 607px out)');

  section('3. the page does not pan sideways; wide tables scroll inside their panel');
  for (const v of VIEWS) {
    await go(v);
    const m = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - innerWidth,
      table: (() => { const t = document.querySelector('div[id$="View"]:not([style*="none"]) .tscroll');
        return t ? t.scrollWidth - t.clientWidth : 0; })(),
    }));
    check(m.page <= 1, `${v}: the whole page stays within the screen`, `${m.page}px`);
  }
  await go('dash');
  const dash = await page.evaluate(() => { const t = document.querySelector('.tscroll');
    return { tableScrolls: t.scrollWidth - t.clientWidth,
             panelFits: document.querySelector('.holdings').getBoundingClientRect().right <= innerWidth + 1 }; });
  check(dash.tableScrolls > 0, 'the holdings table scrolls inside its own panel', `${dash.tableScrolls}px`);
  check(dash.panelFits, 'and its panel fits the screen');

  section('4. Plan rows stay readable rather than crushing the name');
  for (const w of [390, 360, 320]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await go('plan');
    const p = await page.evaluate(() => {
      const seg = document.querySelector('.pl-seg.open'), nm = document.querySelector('.pl-nm');
      const row = document.querySelector('.pl-row');
      const amt = document.querySelector('.pl-amt');
      return { over: seg.scrollWidth - seg.clientWidth,
               nameW: Math.round(nm.getBoundingClientRect().width),
               // two lines: the amount sits below the name, not beside it
               twoLine: amt.getBoundingClientRect().top > nm.getBoundingClientRect().bottom - 2,
               rowFits: row.getBoundingClientRect().right <= innerWidth + 1 };
    });
    check(p.over === 0, `${w}px: the segment body does not overflow`, `${p.over}px`);
    check(p.nameW >= 80, `${w}px: the name keeps usable width`, `${p.nameW}px`);
    check(p.twoLine, `${w}px: amount drops below the name instead of squeezing it`);
    check(p.rowFits, `${w}px: the row fits the screen`);
  }
  await page.setViewportSize({ width: 390, height: 850 });

  section('5. wave backdrops sit behind their motifs and idle elsewhere');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  const EXPECT = { yearly: 'wv-yf', monthly: 'wv-me', archive: 'wv-arc' };
  for (const [v, cls] of Object.entries(EXPECT)) {
    await go(v);
    const w = await page.evaluate(c => {
      const wv = document.querySelector('.' + c);
      if (!wv) return { missing: true };
      const field = wv.parentElement;
      // the layer must be the FIRST child, so the motif icons paint over it
      // .arc-mesh is background texture rather than an icon and is deliberately
      // the faintest thing on the page, so it is not held to the icon threshold
      const motifs = [...field.querySelectorAll('.fin,.mo,.arc')]
        .filter(m => !m.classList.contains('arc-mesh'));
      return {
        first: field.firstElementChild === wv,
        wvZ: getComputedStyle(wv).zIndex,
        motifZ: motifs.length ? getComputedStyle(motifs[0]).zIndex : null,
        motifMin: motifs.length ? Math.min(...motifs.map(m => +getComputedStyle(m).opacity)) : null,
        running: getComputedStyle(wv).animationPlayState,
      };
    }, cls);
    check(!w.missing && w.first, `${v}: the wave layer is behind its motifs`);
    check(w.wvZ === '0' && w.motifZ === '1', `${v}: stacking is wave 0 / motifs 1`, `${w.wvZ}/${w.motifZ}`);
    check(w.motifMin >= 0.15, `${v}: motifs still readable over the waves`, `min opacity ${w.motifMin}`);
    check(w.running === 'running', `${v}: its own wave animates`);
  }
  // a field stays in the DOM at opacity:0, and opacity alone does not stop animation
  await go('dash');
  const idle = await page.evaluate(() => ['wv-yf', 'wv-me', 'wv-arc']
    .map(c => getComputedStyle(document.querySelector('.' + c)).animationPlayState));
  check(idle.every(s => s === 'paused'), 'all three idle once you leave their tabs', idle.join(','));

  section('6. the waves add no overflow at phone width');
  await page.setViewportSize({ width: 390, height: 850 });
  await page.waitForTimeout(300);
  for (const v of ['yearly', 'monthly', 'archive']) {
    await go(v);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 1, `${v}: no sideways pan introduced`, `${over}px`);
  }
  await page.setViewportSize({ width: 390, height: 850 });

  section('7. Yearly\'s wave reaches ~81% down, and dissolves rather than stopping');
  // Stretched vertically (scale(1,1.27) ahead of the rotate) so the ribbon runs
  // further down the page. The horizontal extent is what proves it is a pure
  // vertical change -- a translate or a uniform scale would move it too.
  await page.setViewportSize({ width: 1360, height: 900 });
  await go('yearly');
  await page.addStyleTag({ content: '.wv{animation:none!important}' });
  await page.waitForTimeout(250);
  /* Measured against the SAME ribbon with the stretch removed, rather than against
     two remembered pixel values. The old form hardcoded left===657 && right===1346,
     which quietly also asserted "the viewport is exactly this wide" -- so thinning
     the scrollbar by a few pixels failed it, with nothing about the wave having
     changed. What is actually being claimed is that the change is vertical ONLY. */
  const yw = await page.evaluate(() => {
    const g = document.querySelector('.wv-yf g');
    const tf = g.getAttribute('transform');
    const on = g.getBoundingClientRect();
    g.setAttribute('transform', tf.replace(/scale\([^)]*\)\s*/, ''));   // same ribbon, unstretched
    const off = g.getBoundingClientRect();
    g.setAttribute('transform', tf);
    return { tf, pct: +((on.bottom / innerHeight) * 100).toFixed(1),
             dLeft: +(on.left - off.left).toFixed(1),
             dRight: +(on.right - off.right).toFixed(1),
             grew: +(on.height - off.height).toFixed(1) };
  });
  check(yw.pct >= 79 && yw.pct <= 83, 'the design covers about 81% from the top', `${yw.pct}%`);
  check(Math.abs(yw.dLeft) <= 0.5 && Math.abs(yw.dRight) <= 0.5,
    'and sits exactly where it did horizontally',
    `left ${yw.dLeft >= 0 ? '+' : ''}${yw.dLeft}px, right ${yw.dRight >= 0 ? '+' : ''}${yw.dRight}px`);
  check(yw.grew > 1,
    'while genuinely reaching further down than the unstretched ribbon — not a no-op',
    `+${yw.grew}px tall`);
  check(/^scale\(1,1\.27\) rotate\(48 980 60\) translate\(760,0\) scale\([\d.]+,1\) translate\(-760,0\)$/.test(yw.tf),
    'the stretch is applied after the rotate, so the angle is unchanged', yw.tf);
  /* The ribbon is lengthened along its OWN axis by the inner scale, pivoted at the
     paths' start (local x=760) so only the far end travels. An earlier attempt
     extended each of the 64 paths along its own exit tangent instead; because every
     path leaves at a different heading they stopped being parallel offsets of each
     other and splayed into a fan. These two pin what stops that coming back. */
  check(Math.abs(yw.dLeft) <= 0.5,
    'the ribbon still starts where it did — the stretch is pivoted, not a slide',
    `left ${yw.dLeft >= 0 ? '+' : ''}${yw.dLeft}px`);
  const tail = await page.evaluate(() => {
    const g = document.querySelector('.wv-yf g');
    const inner = g.firstElementChild;
    const paths = [...g.querySelectorAll('path')];
    /* Nesting is the effect. Every path must carry the SAME transform chain, which
       is what a group-level stretch guarantees and per-path extension cannot. */
    return { masked: inner && inner.tagName === 'g' && /yfTail/.test(inner.getAttribute('mask') || ''),
             n: paths.length,
             ownTransforms: paths.filter(p => p.getAttribute('transform')).length,
             fades: !!document.getElementById('yfTailG') };
  });
  check(tail.masked && tail.fades,
    'the tail fade is a mask inside the rotate, so it runs along the ribbon not the screen',
    JSON.stringify(tail));
  check(tail.n === 64 && tail.ownTransforms === 0,
    'all 64 lines are still moved as one object, none individually',
    JSON.stringify([tail.n, tail.ownTransforms]));
  const others = await page.evaluate(() => ['wv-me', 'wv-arc'].map(c =>
    document.querySelector('.' + c + ' g').getAttribute('transform')));
  check(others.every(t => /^rotate\(/.test(t)), 'Monthly and Archives are left alone',
    JSON.stringify(others));

  section('8. every view: controls reachable, scrollers reach their far edge');
  /* Rooted on the view container. An earlier version of this sweep selected
     `main *` — there is no <main> in this app, so it matched nothing and passed
     on every tab at every width while telling us nothing. Smooth scrolling is
     disabled first, or the footer check reads a position mid-animation. */
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const VIEW_IDS = { dash: 'dashView', contrib: 'contribView', yearly: 'yearlyView',
                     monthly: 'monthlyView', archive: 'archiveView', plan: 'planView' };
  for (const W of [390, 320]) {
    await page.setViewportSize({ width: W, height: 780 });
    await page.waitForTimeout(200);
    for (const [v, id] of Object.entries(VIEW_IDS)) {
      await go(v);
      const r = await page.evaluate(vid => {
        const root = document.getElementById(vid);
        const inScroller = el => { let p = el.parentElement;
          while (p && p !== document.body) { const o = getComputedStyle(p).overflowX;
            if ((o === 'auto' || o === 'scroll') && p.clientWidth < p.scrollWidth) return true;
            p = p.parentElement; }
          return false; };
        const ctrls = [], wide = [], stuck = [];
        root.querySelectorAll('button,select,input,textarea,a[href]').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) return;
          if ((b.right > innerWidth + 1 || b.left < -1) && !inScroller(el))
            ctrls.push((el.id || el.tagName) + '@' + Math.round(b.right));
        });
        // collect first, act after — interleaving the reads and writes below
        // thrashes layout badly enough to take minutes
        const cand = [];
        root.querySelectorAll('*').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 1) cand.push(el); });
        cand.forEach(el => {
          const o = getComputedStyle(el).overflowX;
          if (o === 'auto' || o === 'scroll') {
            const max = el.scrollWidth - el.clientWidth;
            el.scrollLeft = max; const got = Math.round(el.scrollLeft); el.scrollLeft = 0;
            if (Math.abs(got - max) > 2) stuck.push((el.className || el.tagName) + ' ' + got + '/' + max);
          } else if (!inScroller(el) && el.getBoundingClientRect().right > innerWidth + 1)
            wide.push((el.id || el.className || el.tagName).toString().slice(0, 30));
        });
        window.scrollTo(0, document.documentElement.scrollHeight);
        const f = document.querySelector('footer').getBoundingClientRect();
        const footerSeen = f.top < innerHeight + 2 && f.bottom > -2;
        window.scrollTo(0, 0);
        return { ctrls: ctrls.slice(0, 3), wide: [...new Set(wide)].slice(0, 3),
                 stuck: stuck.slice(0, 3), footerSeen,
                 subjects: root.querySelectorAll('*').length };
      }, id);
      // Non-vacuity guard: an earlier sweep matched nothing and passed everywhere.
      // Archives is still a placeholder, so it legitimately holds only a few nodes.
      const floor = v === 'archive' ? 3 : 20;
      check(r.subjects >= floor, `${W} ${v}: the sweep actually has something to inspect`,
        `${r.subjects} elements`);
      check(r.ctrls.length === 0, `${W} ${v}: every control reachable`, r.ctrls.join(' | '));
      check(r.wide.length === 0, `${W} ${v}: nothing overflows without a scroller`, r.wide.join(' | '));
      check(r.stuck.length === 0, `${W} ${v}: sideways scrollers reach their far edge`, r.stuck.join(' | '));
      check(r.footerSeen, `${W} ${v}: the page scrolls down to the footer`);
    }
  }
  section('9. the date field matches the controls beside it and stays in its card');
  /* A native input[type=date] is not a text box: iOS sizes it to its own idea of
     the content and lets its min-content push past the grid column. On Yearly it
     came out shorter than the Type select next to it and spilled over the card's
     right edge. Both sides of the 560px breakpoint are checked, because the form
     swaps font-size AND padding there and the fix has to hold in both.

     KNOWN LIMIT, do not over-trust this section: the height and appearance checks
     were verified to FAIL against the unfixed file, but the "stays inside the
     card" one passes either way here — Chromium's date control has a far smaller
     min-content width than iOS Safari's, so the overflow that prompted this
     cannot be reproduced in this runner. `min-width:0` on the input is the fix
     for it and the assertion guards against a Chromium-visible regression, but
     the iOS case itself is only confirmable on a real device. */
  for (const W of [320, 390, 430, 561, 900]) {
    await page.setViewportSize({ width: W, height: 880 });
    await page.click('#viewSeg button[data-view="yearly"]');
    await page.waitForTimeout(280);
    const r = await page.evaluate(() => {
      const R = i => document.getElementById(i).getBoundingClientRect();
      const d = R('yfDate'), t = R('yfType'), a = R('yfAmt'), c = R('yfCat');
      const card = document.getElementById('yfForm').closest('section').getBoundingClientRect();
      const cs = getComputedStyle(document.getElementById('yfDate'));
      return {
        h: [d, t, a, c].map(x => +x.height.toFixed(1)),
        laidOut: d.width > 40 && d.height > 20,
        spill: +(d.right - card.right).toFixed(1),
        appearance: cs.webkitAppearance || cs.appearance,
        align: cs.textAlign
      };
    });
    // everything measures 0 if the tab never rendered, which would pass the rest
    check(r.laidOut, `${W}px: the date field is actually laid out`, JSON.stringify(r.h));
    check(new Set(r.h).size === 1,
      `${W}px: date, type, amount and category are all the same height`, JSON.stringify(r.h));
    check(r.spill < 0, `${W}px: the date field stays inside the card`,
      `${r.spill}px past the right edge`);
    check(r.appearance === 'none' && r.align === 'left',
      `${W}px: it is styled as one of ours, not left native`,
      JSON.stringify([r.appearance, r.align]));
  }
  await page.setViewportSize({ width: 390, height: 850 });

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nMOBILE: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
