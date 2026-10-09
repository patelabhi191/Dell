/* Verification for the year-numeral knobs (--arc-yr-*).  Diagnostic, run by hand:
     node tests/check-yr.js

   Two things to prove, and the second is the one that catches a silent no-op:
     1. the refactor from six hardcoded rgba stops to color-mix() between
        --arc-yr-peak / --arc-yr-sheer renders the SAME as the old build;
     2. moving --arc-yr-hi / --arc-yr-lo / --arc-yr-col / --arc-yr-edge /
        --arc-yr-angle actually changes it, so the knobs are wired.

   Measured, not eyeballed, and two traps are worked around deliberately:

   * The glyphs are a gradient CLIPPED TO TEXT, so the only honest comparison is
     pixels.  Screenshot .ay-yr from each build and decode both through a canvas
     page served over http -- a data: URL has an opaque origin and cannot load
     an http image, so the canvas page must come off the same kind of server.
   * getComputedStyle leaves color-mix() UNRESOLVED inside background-image, so
     a regex over it reads nothing and every .every() assertion against it
     passes vacuously.  Colours are therefore resolved through a probe element
     whose background-COLOR is the mix -- that one does resolve. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { serve, open, launch } = require('./lib');
const { APP } = require('./paths');

/* A pixel is "the same" within this many 8-bit levels.  With the backdrop frozen
   the refactor measures max 1 / mean 0.05 against the old build, so this is slack
   for antialiasing and nothing else.  Two wrong explanations were tried first and
   are recorded so they are not tried again: the residual was NOT color-mix()
   computing to color(srgb ...) instead of legacy rgba() -- pinning the gradient
   to `in srgb` made the mean worse (0.49 -> 0.86) and was reverted -- and it was
   NOT the element box catching the bar strip.  It was the animated waves moving
   between the two screenshots. */
const TOL = 6;

async function shotYear(browser, url) {
  const { ctx, page, errs } = await open(browser, url);
  await page.click('#viewSeg button[data-view="archive"]');
  await page.waitForFunction(() => document.getElementById('archiveView').style.display === 'block');
  // a fabricated year, so there is a card with numerals on it
  const added = await page.evaluate(() => {
    if (typeof arcAddDummy !== 'function') return false;
    arcAddDummy(); return true;
  });
  await page.waitForTimeout(300);
  /* FREEZE THE BACKDROP.  The decorative waves animate, so two screenshots taken
     a moment apart differ by up to 20 levels on their own -- which is how an
     earlier run of this file "proved" that a bar-colour knob moved the year. */
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await page.waitForTimeout(120);
  const n = await page.locator('.ay-yr').count();
  return {
    ctx, page, errs, added, n,
    text: n ? await page.$eval('.ay-yr', e => e.textContent.trim()) : null,
    buf: n ? await glyphShot(page) : null,
  };
}

/* .ay-yr is a BLOCK the width of its column -- 367px for four digits -- so an
   element screenshot is mostly whatever sits behind the empty right-hand side,
   including the page's decorative waves and the card's bar strip.  Clip to the
   text's own rect instead, via a Range, so every comparison here is about the
   numerals and nothing else. */
async function glyphShot(page) {
  const clip = await page.$eval('.ay-yr', e => {
    const r = document.createRange();
    r.selectNodeContents(e);
    const b = r.getBoundingClientRect();
    return { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) };
  });
  return page.screenshot({ clip });
}

/* Resolve a colour the way the browser does, through a probe element. */
const resolve = (page, value) => page.evaluate(v => {
  const d = document.createElement('div');
  d.style.backgroundColor = v;
  document.body.appendChild(d);
  const out = getComputedStyle(d).backgroundColor;
  d.remove();
  return out;
}, value);

/* "color(srgb 1 1 1 / 0.87)" and "rgba(255, 255, 255, 0.87)" -> [255,255,255,0.87] */
function rgba(s) {
  const p = (s.match(/[\d.]+/g) || []).map(Number);
  if (/^color\(srgb/.test(s)) return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m, x) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`, x === undefined ? '' : JSON.stringify(x)); };

  // the previous build straight out of git, so the baseline is not my own retelling of it
  const old = path.join(os.tmpdir(), 'yr-baseline.html');
  fs.writeFileSync(old, execFileSync('git', ['show', 'HEAD:Sparta Finance Tracker/Sparta ap stock tracker.html'],
    { cwd: path.join(__dirname, '..', '..'), maxBuffer: 1 << 28 }));

  const browser = await launch();
  const sNew = await serve(APP), sOld = await serve(old);

  console.log('════════ year numerals: the --arc-yr-* knobs ════════');

  const A = await shotYear(browser, `http://127.0.0.1:${sOld.address().port}/`);
  const B = await shotYear(browser, `http://127.0.0.1:${sNew.address().port}/`);
  ok(A.n === 1 && B.n === 1 && A.added && B.added,
    'one year card with numerals rendered in both builds', { old: A.n, new: B.n });
  ok(A.text && A.text === B.text, 'both builds show the same year, so the glyphs are comparable',
    { old: A.text, new: B.text });

  // ── a canvas page, served, to decode the PNGs ───────────────────────────────
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yrpx-'));
  fs.writeFileSync(path.join(dir, 'i.html'), '<canvas id=c></canvas>');
  const pxSrv = http.createServer((q, r) => {
    // strip the cache-busting query before touching the filesystem
    const u = q.url.split('?')[0];
    const f = path.join(dir, u === '/' ? 'i.html' : path.basename(u));
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end() }
    r.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'text/html' });
    r.end(fs.readFileSync(f));
  });
  await new Promise(res => pxSrv.listen(0, '127.0.0.1', res));
  const pxCtx = await browser.newContext();
  const px = await pxCtx.newPage();
  await px.goto(`http://127.0.0.1:${pxSrv.address().port}/`);

  let shotN = 0;
  async function compare(a, b) {
    const na = `a${++shotN}.png`, nb = `b${shotN}.png`;
    fs.writeFileSync(path.join(dir, na), a); fs.writeFileSync(path.join(dir, nb), b);
    return px.evaluate(async ([x, y]) => {
      const load = s => new Promise((r, e) => { const i = new Image(); i.onload = () => r(i); i.onerror = e; i.src = s + '?' + Math.random() });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height], max: 255 };
      const g = s => { const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
        const t = c.getContext('2d'); t.drawImage(s, 0, 0); return t.getImageData(0, 0, s.width, s.height).data };
      const da = g(ia), db = g(ib);
      let max = 0, sum = 0, n = 0;
      for (let i = 0; i < da.length; i++) { const d = Math.abs(da[i] - db[i]); sum += d; n++; if (d > max) max = d }
      return { w: ia.width, h: ia.height, max, mean: +(sum / n).toFixed(4) };
    }, [na, nb]);
  }

  const same = await compare(A.buf, B.buf);
  ok(same.max <= TOL, `the refactored gradient renders the same as before (within ${TOL} levels)`, same);

  // ── the six stops still resolve to the alphas they had ─────────────────────
  const peak = rgba(await resolve(B.page, 'color-mix(in srgb, var(--arc-yr-col) var(--arc-yr-hi), transparent)'));
  const sheer = rgba(await resolve(B.page, 'color-mix(in srgb, var(--arc-yr-col) var(--arc-yr-lo), transparent)'));
  ok(Math.abs(peak[3] - 0.87) < 0.005 && peak.slice(0, 3).every(c => Math.round(c) === 255),
    '--arc-yr-peak resolves to white at .87', peak);
  ok(Math.abs(sheer[3] - 0.41) < 0.005 && sheer.slice(0, 3).every(c => Math.round(c) === 255),
    '--arc-yr-sheer resolves to white at .41', sheer);
  const mid = [['43.4783%', 0.61], ['69.5652%', 0.73], ['13.0435%', 0.47], ['89.1304%', 0.82]];
  for (const [p, want] of mid) {
    const got = rgba(await resolve(B.page, `color-mix(in srgb, color-mix(in srgb, var(--arc-yr-col) var(--arc-yr-hi), transparent) ${p}, color-mix(in srgb, var(--arc-yr-col) var(--arc-yr-lo), transparent))`));
    ok(Math.abs(got[3] - want) < 0.005, `the ${p} stop still lands on alpha ${want}`, got[3]);
  }
  const edge = rgba(await resolve(B.page, 'color-mix(in srgb, var(--arc-yr-col) var(--arc-yr-edge), transparent)'));
  ok(Math.abs(edge[3] - 0.34) < 0.005, 'the outline still resolves to white at .34', edge);

  // ── each knob moves the rendering ──────────────────────────────────────────
  const move = async decls => {
    await B.page.evaluate(d => { const r = document.documentElement;
      for (const [k, v] of Object.entries(d)) r.style.setProperty(k, v) }, decls);
    await B.page.waitForTimeout(90);
    const shot = await glyphShot(B.page);
    const stroke = await B.page.$eval('.ay-yr', e => getComputedStyle(e).webkitTextStrokeColor);
    await B.page.evaluate(d => { const r = document.documentElement;
      for (const k of Object.keys(d)) r.style.removeProperty(k) }, decls);
    await B.page.waitForTimeout(90);
    return { shot, stroke };
  };

  const solid = await move({ '--arc-yr-hi': '100%', '--arc-yr-lo': '100%' });
  const dSolid = await compare(B.buf, solid.shot);
  ok(dSolid.max > TOL, 'hi+lo at 100% makes the year solid white -- a visible change', dSolid);

  const faint = await move({ '--arc-yr-hi': '20%', '--arc-yr-lo': '5%' });
  const dFaint = await compare(B.buf, faint.shot);
  ok(dFaint.max > TOL, 'hi+lo lowered dissolves it into the card', dFaint);
  const dBoth = await compare(solid.shot, faint.shot);
  ok(dBoth.max > TOL, 'solid and faint are not the same frame either -- non-vacuity guard', dBoth);

  const tint = await move({ '--arc-yr-col': '#FF00AA' });
  const dTint = await compare(B.buf, tint.shot);
  ok(dTint.max > TOL, '--arc-yr-col retints the numerals', dTint);
  const tinted = rgba(tint.stroke);
  ok(Math.round(tinted[0]) === 255 && Math.round(tinted[1]) === 0 && Math.round(tinted[2]) === 170,
    '--arc-yr-col carries into the outline too, so they cannot disagree', tint.stroke);

  const thick = await move({ '--arc-yr-edge': '100%' });
  ok(Math.abs(rgba(thick.stroke)[3] - 1) < 0.005, '--arc-yr-edge drives the outline alpha', thick.stroke);
  const dEdge = await compare(B.buf, thick.shot);
  ok(dEdge.max > TOL, '...and that outline is visible on screen', dEdge);

  const turned = await move({ '--arc-yr-angle': '0deg' });
  const dAng = await compare(B.buf, turned.shot);
  ok(dAng.max > TOL, '--arc-yr-angle turns the sheen', dAng);

  // a knob that does NOT belong to the year must leave it alone
  const unrelated = await move({ '--arc-bar-in': '#FF00FF' });
  const dUn = await compare(B.buf, unrelated.shot);
  ok(dUn.max <= TOL, 'a bar-colour knob does not touch the numerals', dUn);

  ok(A.errs.length === 0 && B.errs.length === 0, 'no page errors in either build', [...A.errs, ...B.errs]);

  await A.ctx.close(); await B.ctx.close(); await pxCtx.close(); await browser.close();
  pxSrv.close(); sNew.close(); sOld.close();
  console.log(`\nYEAR NUMERAL KNOBS: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
