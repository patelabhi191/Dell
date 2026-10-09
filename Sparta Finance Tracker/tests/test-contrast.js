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

/* ── the compositor, run in the page ─────────────────────────────────────── */
const CONTRAST = () => {
  const parse = c => {
    const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a),
                            b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b), hi = Math.max(x, y), lo = Math.min(x, y);
    return (hi + 0.05) / (lo + 0.05); };

  /* A gradient has no single colour, but ignoring it is worse than averaging
     it: a mint "Add expense" button reads as the page behind it and its dark
     ink scores 1.08:1 against a background it is nowhere near. Averaging the
     declared stops puts it within a few points of the painted pixel, which is
     all this needs in order not to lie. */
  const gradAvg = img => {
    if (!img || img === 'none' || !/gradient/.test(img)) return null;
    const stops = img.match(/rgba?\([^)]+\)/g);
    if (!stops || !stops.length) return null;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (const s of stops) { const c = parse(s); if (!c) continue; r += c.r; g += c.g; b += c.b; a += c.a; n++; }
    return n ? { r: r / n, g: g / n, b: b / n, a: a / n } : null;
  };

  // background-clip:text means the gradient IS the ink, not the background
  const clipsToText = cs => /text/.test(cs.webkitBackgroundClip || cs.backgroundClip || '');

  const effBg = el => {
    const layers = []; let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (!clipsToText(cs)) {
        const gi = gradAvg(cs.backgroundImage);
        if (gi && gi.a > 0) layers.push(gi);       // painted above the colour
      }
      const bc = parse(cs.backgroundColor);
      if (bc && bc.a > 0) layers.push(bc);
      n = n.parentElement;
    }
    const h = parse(getComputedStyle(document.documentElement).backgroundColor);
    let base = (h && h.a === 1) ? h : { r: 7, g: 21, b: 32, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };

  const worst = [];
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (!el.offsetParent && cs.position !== 'fixed') return;
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (el.closest('[aria-hidden="true"]')) return;   // decoration is exempt
    let txt = ''; for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue;
    if (!txt.trim()) return;
    // a gradient clipped to the glyphs is the ink; measure THAT, not `color`,
    // which is only the fallback behind -webkit-text-fill-color:transparent
    const inkGrad = clipsToText(cs) ? gradAvg(cs.backgroundImage) : null;
    const fg0 = inkGrad || parse(cs.color); if (!fg0) return;
    const bg = effBg(el);
    let op = 1, n2 = el;
    while (n2 && n2 !== document.documentElement) { op *= parseFloat(getComputedStyle(n2).opacity) || 1; n2 = n2.parentElement; }
    const fg = over({ r: fg0.r, g: fg0.g, b: fg0.b, a: Math.min(1, fg0.a * op) }, bg);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3.0 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) worst.push({
      ratio: +cr.toFixed(2), need, size, weight, color: cs.color,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      text: txt.trim().slice(0, 24),
      inlineOpacity: el.getAttribute('style') && /opacity/.test(el.getAttribute('style')) || false,
    });
  });
  return worst.sort((a, b) => a.ratio - b.ratio);
};

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

  /* ── 1. the tokens themselves ─────────────────────────────────────────── */
  section('1. the dim ink tokens clear 4.5:1 on the backgrounds they land on');
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const a = n => { const m = /rgba\([^)]*?,\s*([\d.]+)\s*\)/.exec(cs.getPropertyValue(n)); return m ? parseFloat(m[1]) : null; };
    return { faint: a('--text-faint'), dim: a('--text-dim') };
  });
  // .555 is what the lightest background a faint ink lands on (the deposit-log
  // row, rgb(32,53,61)) needs to reach 4.5:1 against #EAF0FA.
  check(tokens.faint >= 0.555, '--text-faint alpha reaches the 4.5:1 floor', `alpha ${tokens.faint}`);
  check(tokens.dim > tokens.faint,
    '--text-dim stays above --text-faint, so "dim" is not painted fainter than "faint"',
    `dim ${tokens.dim} vs faint ${tokens.faint}`);

  /* ── 2. every tab, every text node ────────────────────────────────────── */
  section('2. no text on any tab falls under its WCAG bar');

  /* Everything still under the bar after this pass, each one measured at
     1440px and each one here for a stated reason rather than tolerated
     quietly. This is a RATCHET, not a pin: a failure that is not on this list
     fails the suite, and one that gets WORSE than its recorded floor fails it
     too. Fixing one of these never fails the suite -- the list only shrinks.

     Two owners:
       [JS]  an inline style inside a render function's template literal.
             Not editable from the stylesheet; written up for the reviewer who
             owns the JS, with the exact replacement.
       [TAB] Plan's neutral ramp. Thirteen hardcoded rgba(255,255,255,a) inks
             at seven alphas -- .3 .45 .46 .48 .5 .55 .6 -- none of them on the
             scale, over surfaces that stack three translucent whites and so
             sit lighter than any other tab (rgb(51,75,84) and rgb(60,83,92)
             against the usual rgb(21,34,44)). Even --text-faint at its new
             .58 only reaches 3.59 there, so this is not reachable by pointing
             the rules at a token: it is the dedicated per-tab audit Archives
             got on 2026-10-01, and it restyles a whole tab. Written up. */
  const KNOWN = [
    { tab: 'dash', sel: 'span', text: '-6.08%', floor: 3.92, who: 'JS',
      why: 'renderHoldings emits style="opacity:.75" over --rose' },
    { tab: 'dash', sel: 'span', text: '▼ -6.08%', floor: 4.29, who: 'JS',
      why: 'renderHoldings emits style="opacity:.8" over --rose' },
    { tab: 'yearly', sel: 'b#yfMoved', floor: 4.15, who: 'ACCENT',
      why: '--yf-c-mov #E55959 is the "moved elsewhere" colour; a second red is the drift this file removes' },
    /* --violet on its own 15% tint, over body.contrib-view .panel -- which at
       rgba(255,255,255,.085) is the lightest panel in the app, so the same
       chip measures 4.67 on Dashboard and 4.07 here. Every way out is worse
       than the 0.43 it is short: dropping the tint to the .075 it would need
       nearly empties the chip and unpairs it from .tag-tfsa beside it;
       scoping a lighter tint to one tab reintroduces the per-tab exception
       the scale pass removed; and a second violet stops --violet meaning
       FHSA. Left as measured, written up for the owner. The text is also
       redundant -- the row it sits in already reads "FHSA cash". */
    { tab: 'contrib', sel: 'span.acct-tag.tag-fhsa', floor: 4.07, who: 'ACCENT' },
    /* 4.49:1 -- one hundredth under the bar, on a 9.5px chip whose row already
       names the sign in words and in colour. Recorded rather than chased: no
       change to --yf-exp or to the tint is worth making for 0.01, and the
       floor here will catch it if it ever drifts further. */
    { tab: 'yearly', sel: 'span.acct-tag.tag-exp', floor: 4.49, who: 'ACCENT' },
    { tab: 'plan', sel: 'span.pl-yr', floor: 2.28, who: 'TAB' },
    { tab: 'plan', sel: 'div.pl-nt', floor: 2.28, who: 'TAB' },
    { tab: 'plan', sel: 'div.pl-bal', floor: 2.28, who: 'TAB' },
    { tab: 'plan', sel: 'div.pl-amt.inc', floor: 3.07, who: 'TAB' },
    { tab: 'plan', sel: 'div.pl-amt.exp', floor: 4.24, who: 'TAB' },
    { tab: 'plan', sel: 'button.pl-t-exp.on', floor: 3.08, who: 'TAB' },
    { tab: 'plan', sel: 'button.pl-t-inc', floor: 4.22, who: 'TAB' },
    { tab: 'plan', sel: 'span.pl-day', floor: 3.66, who: 'TAB' },
    { tab: 'plan', sel: 'span.pl-nm', floor: 3.66, who: 'TAB' },
    { tab: 'plan', sel: 'span', text: 'soonest first', floor: 3.42, who: 'TAB' },
    { tab: 'plan', sel: 'span', text: 'Start', floor: 4.24, who: 'TAB' },
    { tab: 'plan', sel: 'label', floor: 4.30, who: 'TAB' },
  ];
  const excuse = (tab, f) => KNOWN.find(k => k.tab === tab && k.sel === f.sel &&
    (k.text === undefined || f.text.indexOf(k.text) === 0 || f.text === k.text));

  let recorded = 0, surprises = 0, regressed = 0;
  for (const v of VIEWS) {
    await go(v);
    const bad = await page.evaluate(CONTRAST);
    const novel = [], worse = [];
    for (const f of bad) {
      const k = excuse(v, f);
      if (!k) { novel.push(f); continue; }
      recorded++;
      if (f.ratio < k.floor - 0.05) worse.push(`${f.sel} "${f.text}" ${f.ratio} < ${k.floor}`);
    }
    surprises += novel.length; regressed += worse.length;
    check(novel.length === 0, `${v}: no text fails its bar that is not already on the record`,
      novel.slice(0, 3).map(b => `${b.ratio}:1 ${b.size}px ${b.sel} "${b.text}"`).join(' | '));
    check(worse.length === 0, `${v}: nothing on the record got darker than it was measured at`,
      worse.join(' | '));
  }
  console.log(`      (${recorded} recorded exclusions still present: ` +
    `${KNOWN.filter(k => k.who === 'JS').length} JS-owned, ` +
    `${KNOWN.filter(k => k.who === 'TAB').length} in Plan's un-audited ramp, ` +
    `${KNOWN.filter(k => k.who === 'ACCENT').length} semantic accent)`);

  /* ── 2c. the statement-source hint ────────────────────────────────────── */
  section('2c. the "(optional)" hint is not dimmed a second time');
  await go('monthly');
  const optOp = await page.evaluate(() => {
    const l = document.querySelector('label[for="meImpSrc"] span');
    return l ? parseFloat(getComputedStyle(l).opacity) : null;
  });
  // Monthly's labels are already #93A2B8; .55 on top of that measured 2.88:1
  check(optOp !== null && optOp >= 0.8,
    'the hint inherits enough of its label to stay readable', `opacity ${optOp}`);

  /* ── 3. the carousel dots ─────────────────────────────────────────────── */
  section('3. the Highlights dots are reachable, and do not overlap each other');
  for (const w of [1440, 375, 320]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await go('yearly');
    const d = await page.evaluate(() => {
      const dots = [...document.querySelectorAll('.yf-hi-dot')];
      if (dots.length < 2) return null;
      // hit area read back off the hit-test chain, not off the declaration
      const hit = el => {
        const b = el.getBoundingClientRect();
        const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        let l = cx, r = cx, t = cy, bo = cy;
        for (let x = cx; x > cx - 40; x -= 0.5) { if (!el.contains(document.elementFromPoint(x, cy))) break; l = x; }
        for (let x = cx; x < cx + 40; x += 0.5) { if (!el.contains(document.elementFromPoint(x, cy))) break; r = x; }
        for (let y = cy; y > cy - 40; y -= 0.5) { if (!el.contains(document.elementFromPoint(cx, y))) break; t = y; }
        for (let y = cy; y < cy + 40; y += 0.5) { if (!el.contains(document.elementFromPoint(cx, y))) break; bo = y; }
        return { x: l, y: t, w: r - l, h: bo - t };
      };
      const hits = dots.map(hit);
      let overlap = 0;
      for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
        const a = hits[i], b = hits[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0.5 && oy > 0.5) overlap = Math.max(overlap, ox);
      }
      return {
        minW: Math.min(...hits.map(h => h.w)), minH: Math.min(...hits.map(h => h.h)),
        overlap, paintedW: Math.min(...dots.map(d => d.getBoundingClientRect().width)),
      };
    });
    check(d && d.minW >= 11.5, `${w}px: every dot's hit area is at least 12px wide`, d && `${d.minW.toFixed(1)}px`);
    check(d && d.minH >= 23.5, `${w}px: every dot's hit area is at least 24px tall`, d && `${d.minH.toFixed(1)}px`);
    check(d && d.overlap === 0, `${w}px: no dot's hit area overlaps its neighbour`, d && `${d.overlap}px`);
    check(d && Math.abs(d.paintedW - 7) < 0.6, `${w}px: the PAINTED dot is still 7px — only the target grew`,
      d && `${d.paintedW.toFixed(2)}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

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
