/* PAPER: what this app puts on a printed page.
   There were no @media print rules at all before this suite, and the result was
   not subtly wrong -- every figure was invisible. --text is #EAF0FA, 1.14:1 on
   white, and the dark page it is legible against is painted by a fixed
   decorative layer that a print engine drops; so the ink landed on white paper
   at a contrast nobody can read, and the numbers are the entire reason to print
   a finance tracker.

   MEASURED, NOT DERIVED, for the same reason test-ui.js's contrast section
   samples pixels: a ratio computed from the tokens agrees with itself and says
   nothing about what the paper gets. Everything below renders under
   emulateMedia({media:'print'}), hides the glyphs, takes one full-page
   screenshot and reads the pixel underneath each figure.

   Section 3 is the one that keeps the rest honest: it deletes the @media print
   block at runtime and re-measures the same figures, so a future change that
   removes or breaks the block cannot leave this suite passing on the screen
   styles alone. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = '/tmp/claude-0/test-print';

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const l1 = L(a), l2 = L(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };

/* One capture per call: find the painted boxes, tag them, hide the glyphs, take
   ONE fullPage screenshot, sample each box's page-relative centre, put the
   glyphs back. Per-element clips throw the moment a row sits below the fold,
   which most of Yearly does. */
async function sample(page, sels) {
  const probes = await page.evaluate(sl => {
    const out = [];
    sl.forEach(s => document.querySelectorAll(s).forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (!(el.textContent || '').trim()) return;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return;
      el.setAttribute('data-prprobe', '1');
      out.push({ sel: s, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20),
        color: cs.color, op: Number(cs.opacity),
        x: Math.round(r.left + r.width / 2 + scrollX),
        y: Math.round(r.top + r.height / 2 + scrollY) });
    }));
    return out;
  }, sels);
  if (!probes.length) return [];
  await page.evaluate(() => document.querySelectorAll('[data-prprobe]')
    .forEach(e => { e.style.visibility = 'hidden' }));
  const sheet = (await page.screenshot({ fullPage: true })).toString('base64');
  await page.evaluate(() => document.querySelectorAll('[data-prprobe]')
    .forEach(e => { e.style.visibility = ''; e.removeAttribute('data-prprobe') }));
  const bgs = await page.evaluate(async ({ b, pts }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return pts.map(p => {
      if (p.x < 0 || p.y < 0 || p.x >= c.width || p.y >= c.height) return null;
      const d = g.getImageData(p.x, p.y, 1, 1).data; return [d[0], d[1], d[2]];
    });
  }, { b: sheet, pts: probes.map(p => ({ x: p.x, y: p.y })) });
  return probes.map((p, i) => {
    const bg = bgs[i];
    if (!bg) return { ...p, bg: null, eff: null };
    const fg = (p.color.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    const eff = fg.map((v, q) => v * p.op + bg[q] * (1 - p.op));
    return { ...p, bg: `rgb(${bg.join(',')})`, white: bg.every(v => v >= 245),
      eff: +ratio(eff, bg).toFixed(2) };
  }).filter(r => r.bg);
}

/* GROUND TRUTH FOR PAPER, and the reason this suite does not stop at the
   emulated screenshot. A screenshot always paints backgrounds; a PRINTER does
   not -- Chromium's own default is background graphics OFF, which is why
   #EAF0FA ink is legible on the dark page on screen and arrives on a white
   sheet at 1.14:1. page.pdf() with its defaults is exactly that behaviour, so
   this rasterises the real document and counts how much of it is ink dark
   enough to read. No coordinate mapping from DOM to page is needed, and none
   would survive a repagination. */
async function pdfInk(page, tag) {
  fs.mkdirSync(OUT, { recursive: true });
  const f = `${OUT}/${tag}.pdf`;
  fs.writeFileSync(f, await page.pdf({ format: 'Letter' }));   // defaults: no backgrounds
  execFileSync('pdftoppm', ['-r', '72', '-png', '-f', '1', '-l', '3', f, `${OUT}/${tag}`]);
  const pngs = fs.readdirSync(OUT).filter(n => n.startsWith(tag + '-') && n.endsWith('.png')).sort();
  const out = [];
  for (const n of pngs) {
    const hist = await page.evaluate(async b => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const l = (r, gg, b2) => { const f2 = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) };
        return 0.2126 * f2(r) + 0.7152 * f2(gg) + 0.0722 * f2(b2) };
      let dark = 0, mid = 0, tot = 0;
      for (let i = 0; i < d.length; i += 4) { const v = l(d[i], d[i + 1], d[i + 2]); tot++;
        if (v < 0.25) dark++; else if (v < 0.6) mid++ }
      return { tot, dark, mid };
    }, fs.readFileSync(`${OUT}/${n}`).toString('base64'));
    out.push({ page: n, ...hist });
  }
  return out;
}

// every coloured figure and label a printed Yearly page is read for
const YF_INK = ['#yfStartVal', '#yfEndVal', '#yfInvested', '#yfMoved', '#yfSaved',
  '#yfOffPaper', '#yfPct', '#yfSavedBig', '#yfAvgInc', '#yfAvgExp',
  '#yfExpPlan', '#yfExpAct', '#yfIncPlan', '#yfIncAct',
  '#yearlyView .label', '#yearlyView .foot', '#yearlyView .yf-statgrid .cell span',
  '#yfExpBody td', '#yfIncBody td', '#yfMBody td', '#yfMHead th', 'footer'];

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();

  /* ── 1. the precondition: on screen this is a dark app ─────────────────
     Without this the whole suite could pass against a light theme nobody
     ships, and the fix it is guarding would not be the thing being measured. */
  section('1. screen: the ink the print rules have to override');
  const O = await open(browser, url, SEED);
  await O.page.evaluate(() => applyView('yearly'));
  await O.page.waitForTimeout(300);
  const screen = await O.page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { text: cs.getPropertyValue('--text').trim(),
      body: getComputedStyle(document.body).backgroundColor,
      fields: [...document.querySelectorAll('.financefield,.aurora')]
        .filter(e => getComputedStyle(e).display !== 'none').length };
  });
  check(screen.text.toUpperCase() === '#EAF0FA',
    '1: --text on screen is the near-white the dark theme needs', screen.text);
  check(screen.fields > 0,
    '1: ...and the dark backdrop it is legible against is a decorative layer, which is what print drops',
    JSON.stringify(screen.fields));

  /* ── 2. the printed Yearly page ───────────────────────────────────────── */
  section('2. print: Yearly comes out on white paper, legibly');
  await O.page.emulateMedia({ media: 'print' });
  await O.page.waitForTimeout(250);
  const yf = await sample(O.page, YF_INK);
  check(yf.length >= 25,
    '2: there are figures and labels on the page to measure', `${yf.length} probed`);
  /* The sampled pixel being WHITE is the assertion that the decorative layer
     and the glass are both gone. If a future change lets either paint again,
     the ratios below go comfortable and meaningless, and this says so first. */
  check(yf.every(r => r.white),
    '2: every figure is painted on white -- no decorative layer, no glass left',
    JSON.stringify([...new Set(yf.filter(r => !r.white).map(r => r.bg))]).slice(0, 160));
  const bad = yf.filter(r => r.eff < 4.5);
  check(bad.length === 0,
    '2: and every one of them reads at 4.5:1 or better on it',
    JSON.stringify(bad.map(r => ({ t: r.text.slice(0, 12), c: r.color, eff: r.eff }))).slice(0, 400));
  const worst = yf.reduce((a, b) => (a && a.eff <= b.eff ? a : b), null);
  console.log(`         worst printed figure: ${worst.eff}:1  (${worst.text} ${worst.color})`);

  /* ── 3. the induced failure, measured on the real document ─────────────
     The rest of the suite reads an emulated screenshot, which always paints
     backgrounds. A printer does not. So this prints the actual PDF at
     Chromium's own defaults, rasterises it, and counts the pixels dark enough
     to read -- first as it ships, then with the @media print block deleted at
     runtime. If a later change removes or breaks that block, the ink collapses
     here and this suite cannot go on passing on the screen styles alone. */
  section('3. the real PDF: delete the @media print block and the ink collapses');
  const withBlock = await pdfInk(O.page, 'with');
  check(withBlock.length >= 2, '3: the year prints to more than one page to measure',
    `${withBlock.length} pages`);
  check(withBlock.every(p => p.dark > 1200),
    '3: every printed page carries a substantial amount of readable ink',
    JSON.stringify(withBlock.map(p => p.dark)));
  const dropped = await O.page.evaluate(() => {
    let n = 0;
    [...document.styleSheets].forEach(ss => {
      let rules; try { rules = [...ss.cssRules] } catch (e) { return }
      for (let i = rules.length - 1; i >= 0; i--) {
        const r = rules[i];
        if (r.media && /print/.test(r.media.mediaText)) { ss.deleteRule(i); n++ }
      }
    });
    return n;
  });
  check(dropped === 1, '3: PRECONDITION -- exactly one @media print block to remove',
    JSON.stringify(dropped));
  await O.page.waitForTimeout(150);
  const without = await pdfInk(O.page, 'without');
  check(without.length === withBlock.length,
    '3: it still prints the same number of pages, so this is ink and not layout',
    JSON.stringify([withBlock.length, without.length]));
  const totWith = withBlock.reduce((a, p) => a + p.dark, 0);
  const totWithout = without.reduce((a, p) => a + p.dark, 0);
  check(totWith > totWithout * 4,
    '3: without the block the readable ink falls away -- which is the bug this fixes',
    JSON.stringify({ with: totWith, without: totWithout,
      ratio: +(totWith / Math.max(1, totWithout)).toFixed(1) }));
  /* The ink does not VANISH, it washes out: the same glyphs arrive as mid-tone
     grey. That is the part that made this easy to miss -- a page that looks
     printed, and cannot be read. */
  const midWith = withBlock.reduce((a, p) => a + p.mid, 0);
  const midWithout = without.reduce((a, p) => a + p.mid, 0);
  check(midWithout > midWith,
    '3: ...into mid-tone grey rather than off the page, so it looked printed',
    JSON.stringify({ midWith, midWithout }));
  await O.ctx.close();

  /* ── 4. nothing that cannot be acted on, nothing that is only decoration ─ */
  section('4. print: the chrome and the decoration are left off the page');
  const P = await open(browser, url, SEED);
  await P.page.evaluate(() => applyView('yearly'));
  await P.page.emulateMedia({ media: 'print' });
  await P.page.waitForTimeout(250);
  const gone = await P.page.evaluate(() => {
    const shown = s => [...document.querySelectorAll(s)]
      .filter(e => getComputedStyle(e).display !== 'none').length;
    return {
      chrome: { topctl: shown('.topctl'), tabbar: shown('.tabbar'), drawer: shown('#drawer'),
        toast: shown('#toast'), modal: shown('.modal'), seg: shown('.seg') },
      controls: { btn: shown('.btn'), catbtn: shown('.yf-catbtn'), rm: shown('.rm') },
      decor: shown('.financefield,.monthlyfield,.planfield,.archivefield,.cashfield,.aurora,.orb'),
      blurred: [...document.querySelectorAll('.panel')]
        .filter(e => (getComputedStyle(e).backdropFilter || 'none') !== 'none').length,
      shadowed: [...document.querySelectorAll('.panel')]
        .filter(e => getComputedStyle(e).boxShadow !== 'none').length,
    };
  });
  check(Object.values(gone.chrome).every(v => v === 0),
    '4: no segmented controls, settings drawer, toast or dialog on paper',
    JSON.stringify(gone.chrome));
  check(Object.values(gone.controls).every(v => v === 0),
    '4: and no buttons -- a control that cannot be pressed is ink spent on nothing',
    JSON.stringify(gone.controls));
  check(gone.decor === 0, '4: the animated backdrops and the orb are off the page',
    JSON.stringify(gone.decor));
  check(gone.blurred === 0 && gone.shadowed === 0,
    '4: and the glass is flat -- a backdrop-filter prints as a grey haze',
    JSON.stringify({ blurred: gone.blurred, shadowed: gone.shadowed }));

  /* ── 5. what a printout is FOR is still on it ──────────────────────────── */
  section('5. print: the figures, their labels and their tables survive');
  const kept = await P.page.evaluate(() => {
    const txt = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : null };
    const tiles = ['yfStartVal', 'yfEndVal', 'yfInvested', 'yfMoved', 'yfSaved',
      'yfOffPaper', 'yfAvgInc', 'yfAvgExp'].map(txt);
    const panel = document.querySelector('#yearlyView .panel');
    return { tiles,
      rows: document.querySelectorAll('#yfExpBody tr').length,
      thead: getComputedStyle(document.querySelector('#yfExpTable thead')).display,
      breakInside: getComputedStyle(panel).breakInside,
      // an input is a value on paper: the number stays, the box goes
      /* the FIRST plan input belongs to whichever category sorts first and may
         carry no plan at all, which asserted nothing -- find one with a value */
      input: (() => { const i = [...document.querySelectorAll('.yf-plan-in')].find(x => x.value);
        if (!i) return null; const cs = getComputedStyle(i);
        return { v: i.value, top: cs.borderTopWidth, bottom: cs.borderBottomWidth } })(),
    };
  });
  check(kept.tiles.every(t => t && /\d/.test(t)),
    '5: all eight summary figures are on the page with a number in them',
    JSON.stringify(kept.tiles));
  check(new Set(kept.tiles).size > 1,
    '5: ...and they are not all the same value, so the fixture is really loaded',
    JSON.stringify([...new Set(kept.tiles)].length));
  check(kept.rows >= 3, '5: the expense category table keeps its rows', JSON.stringify(kept.rows));
  check(kept.thead === 'table-header-group',
    '5: its headings repeat on every page rather than only the first',
    kept.thead);
  check(kept.breakInside === 'avoid',
    '5: a panel is not split across a break, which would orphan a figure from its label',
    kept.breakInside);
  check(kept.input && kept.input.v && kept.input.top === '0px' && kept.input.bottom !== '0px',
    '5: a planned amount prints as a value on a rule, not as an empty-looking field',
    JSON.stringify(kept.input));

  /* ── 6. the two charts' own hardcoded white ────────────────────────────── */
  section('6. print: the chart gridlines and month labels are not white on white');
  const chart = await P.page.evaluate(() => {
    const line = document.querySelector('#yfChart line');
    const text = document.querySelector('#yfChart text');
    const px = s => (getComputedStyle(s).fill || '') + '|' + (getComputedStyle(s).stroke || '');
    return { line: line ? getComputedStyle(line).stroke : null,
      text: text ? getComputedStyle(text).fill : null,
      bars: document.querySelectorAll('#yfChart rect.yfb').length,
      _: px };
  });
  const notWhite = c => c && !/255,\s*255,\s*255/.test(c) && c !== 'none';
  check(notWhite(chart.line),
    '6: the gridlines are recoloured -- they are rgba(255,255,255,.08) in the markup',
    String(chart.line));
  check(notWhite(chart.text),
    '6: and so are the month labels', String(chart.text));
  const chartInk = await sample(P.page, ['#yfChart text']);
  check(chartInk.length > 0 && chartInk.every(r => r.eff >= 4.5),
    '6: the labels measure 4.5:1 on the printed page too',
    JSON.stringify(chartInk.map(r => r.eff)));

  /* ── 6b. the figures painted by clipping a gradient to the glyphs ──────
     .sparkle, .sparkle-green and .ay-yr set -webkit-text-fill-color (or color)
     to transparent and let a gradient show through the text. The gradient is a
     BACKGROUND, so a printer drops it and the glyphs arrive with no ink at all:
     not faint, blank. Three figures, and one of them is the year on an archive
     card -- the label the whole printout is identified by. */
  section('6b. print: gradient-filled figures are not blank');
  const grad = await P.page.evaluate(() => {
    const read = s => [...document.querySelectorAll(s)].map(el => {
      const cs = getComputedStyle(el);
      return { sel: s, text: (el.textContent || '').trim().slice(0, 12),
        fill: cs.webkitTextFillColor || cs.color, color: cs.color,
        bg: cs.backgroundImage, filter: cs.filter };
    });
    return [...read('.sparkle'), ...read('.sparkle-green')];
  });
  check(grad.length > 0, '6b: PRECONDITION -- the page really has gradient-filled figures on it',
    JSON.stringify(grad.map(g => g.text)));
  check(grad.every(g => !/transparent|rgba\(0, 0, 0, 0\)/.test(g.fill)),
    '6b: every one of them has real ink in the glyphs, not a transparent fill',
    JSON.stringify(grad.map(g => ({ t: g.text, fill: g.fill }))));
  check(grad.every(g => g.bg === 'none'),
    '6b: ...and the gradient they were clipping is gone rather than printed behind them',
    JSON.stringify(grad.map(g => g.bg.slice(0, 24))));
  check(grad.every(g => g.filter === 'none'),
    '6b: and the glow drop-shadow with it, which prints as a smear',
    JSON.stringify(grad.map(g => g.filter.slice(0, 24))));
  const gradInk = await sample(P.page, ['.sparkle', '.sparkle-green']);
  check(gradInk.length > 0 && gradInk.every(r => r.eff >= 4.5),
    '6b: and they measure 4.5:1 on the printed page',
    JSON.stringify(gradInk.map(r => ({ t: r.text.slice(0, 10), c: r.color, eff: r.eff }))));

  /* ── 7. the other two views a person prints ────────────────────────────── */
  section('7. print: every other view comes out legibly as well');
  /* A SEALED YEAR HAS TO BE ON THE PAGE, or Archives has one line of ink on it
     and the section asserts nothing -- which is how it first passed. The card
     carries .ay-yr, the gradient-filled year, so this is also the only place
     that bug can be caught. */
  const arcN = await P.page.evaluate(() => {
    state.archives = [{ id: 'p1', year: 2025, sealed: true,
      stats: { start: 8000, end: 21400, invested: 4000, moved: 1500, saved: 13400,
               offPaper: 18900, growth: 167.5 },
      entries: 9, entriesYf: 9, entriesMe: 0,
      exp: [{ c: 'Home', v: 17400 }, { c: 'Grocery', v: 3650 }],
      inc: [{ c: 'Paycheck', v: 50400 }],
      mInc: Array(12).fill(4200), mExp: Array(12).fill(1750),
      meInc: Array(12).fill(0),
      contrib: { abiT: 7000, abiF: 8000, pooT: 0, pooF: 0 }, highlights: [], byCat: {} }];
    normalizeArchives(); applyView('archive'); renderArchives();
    return { cards: document.querySelectorAll('#arcList .ay-yr').length };
  });
  await P.page.waitForTimeout(300);
  check(arcN.cards > 0, '7: PRECONDITION -- Archives really has a sealed card on it',
    JSON.stringify(arcN));
  const arcYr = await sample(P.page, ['#archiveView .ay-yr']);
  check(arcYr.length > 0 && arcYr.every(r => r.eff >= 4.5),
    "7: the archive card's YEAR prints with ink in it -- it was a transparent fill",
    JSON.stringify(arcYr.map(r => ({ t: r.text, c: r.color, eff: r.eff }))));
  for (const [view, sels] of [
    ['archive', ['#archiveView .ay-gro em', '#archiveView .label', '#archiveView b',
      '#archiveView .num', '#archiveView td', '#archiveView h3', '#archiveView .ay-yr']],
    ['monthly', ['#monthlyView .label', '#monthlyView .num', '#monthlyView td',
      '#monthlyView b', '#monthlyView h3', '#monthlyView th', '#monthlyView .empty',
      '#monthlyView .skeu-readout', '#monthlyView .me-bar-amt', '#monthlyView span']],
    ['dash', ['#dashView .label', '#dashView .num', '#dashView td', '#dashView th',
      '#dashView b', '#dashView h3', '#dashView span', '#dashView .foot']],
    ['contrib', ['#contribView .label', '#contribView .num', '#contribView td',
      '#contribView th', '#contribView b', '#contribView h3', '#contribView span']],
  ]) {
    await P.page.evaluate(v => applyView(v), view);
    await P.page.waitForTimeout(300);
    const m = await sample(P.page, sels);
    check(m.length > 0, `7: ${view} has printable ink on it`, `${m.length} probed`);
    check(m.length > 0 && m.every(r => r.white),
      `7: ${view} prints on white`,
      JSON.stringify([...new Set(m.filter(r => !r.white).map(r => r.bg))]).slice(0, 120));
    const b = m.filter(r => r.eff < 4.5);
    check(b.length === 0, `7: and every figure on ${view} reads at 4.5:1`,
      JSON.stringify(b.map(r => ({ t: r.text.slice(0, 12), c: r.color, eff: r.eff }))).slice(0, 400));
  }

  /* ── 8. and the browser can actually produce the document ─────────────── */
  section('8. the page really prints');
  await P.page.evaluate(() => applyView('yearly'));
  await P.page.waitForTimeout(200);
  let pdf = null, perr = '';
  try { pdf = await P.page.pdf({ format: 'Letter', printBackground: true }) }
  catch (e) { perr = e.message }
  check(pdf && pdf.length > 5000, '8: printing to Letter produces a document',
    pdf ? `${pdf.length} bytes` : perr);
  check(pdf && pdf.slice(0, 5).toString() === '%PDF-',
    '8: ...and it is a PDF rather than an error page', pdf ? pdf.slice(0, 5).toString() : '');

  check(P.errs.length === 0, 'no page errors', P.errs.join(' | '));
  await P.ctx.close();

  await browser.close(); srv.close();
  console.log(`\nPRINT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
