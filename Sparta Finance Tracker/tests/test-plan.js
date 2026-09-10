/* Plan tab: forward-looking cash segments.

   The checks that matter most here are the arithmetic (a running balance or a
   "lowest point" that is quietly wrong is worse than one that is obviously
   broken) and the promise that a greyed-out past row is still fully editable. */
const { serve, open, launch, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (c, label, extra = '') => { c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);

(async () => {
  const srv = await serve(APP);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const { page, errs, ctx } = await open(browser, url);
  let confirmSeen = 0;
  page.on('dialog', d => { confirmSeen++; d.accept(); });
  await page.setViewportSize({ width: 1440, height: 1200 });

  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(200); };
  const days = () => page.evaluate(() => [...document.querySelectorAll('.pl-row .pl-day')].map(e => e.textContent));
  const bals = () => page.evaluate(() => [...document.querySelectorAll('.pl-row .pl-bal')].map(e => e.textContent));
  const addItem = async (d, type, nm, amt, notes = '') => {
    await page.fill('.pl-f-date', d);
    await page.click(`.pl-typeseg button[data-t="${type}"]`);
    await page.fill('.pl-f-name', nm);
    await page.fill('.pl-f-amt', String(amt));
    await page.fill('.pl-f-notes', notes);
    await page.click('.pl-addbtn'); await page.waitForTimeout(110);
  };

  await go('plan');

  section('1. segments');
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg').length) === 0, 'starts with none');
  await page.click('#plNewSeg'); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 1,
    'a new segment opens straight away');
  check(await page.evaluate(() => document.activeElement.className) === 'pl-segname',
    'focus lands in the name so it can be titled immediately');
  await page.fill('.pl-segname', 'Sept → Dec 2026 runway');
  await page.fill('.pl-start', '13632');
  await page.waitForTimeout(450);
  check(await page.evaluate(() => state.plan.segments[0].name) === 'Sept → Dec 2026 runway', 'name saved');
  check(await page.evaluate(() => state.plan.segments[0].start) === 13632, 'starting balance saved');

  section('2. clicking a field must not toggle the segment');
  await page.click('.pl-segname'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 1,
    'clicking the name leaves it open');
  await page.click('.pl-start'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 1,
    'clicking the balance leaves it open');
  await page.click('.pl-caret'); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 0,
    'clicking the header collapses it');
  check(await page.evaluate(() => !document.querySelector('.pl-segbody')), 'the body is gone when collapsed');
  await page.click('.pl-caret'); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 1, 'and re-opens');

  section('3. items sort by date, whatever order they go in');
  await addItem('2026-11-15', 'expense', 'Flights home', 2300, 'Book by 10 Oct');
  await addItem('2026-09-15', 'income', 'Paycheck', 4200);
  await addItem('2026-09-02', 'expense', 'Credit Bill — Aug cycle', 1780, 'Paid, kept for the record');
  await addItem('2026-10-05', 'expense', 'Car insurance', 1240);
  check(JSON.stringify(await days()) === JSON.stringify(['02 SEP', '15 SEP', '05 OCT', '15 NOV']),
    'listed soonest first regardless of entry order', JSON.stringify(await days()));

  section('4. running balance and the lowest point');
  // 13632 −1780 = 11852 · +4200 = 16052 · −1240 = 14812 · −2300 = 12512
  check(JSON.stringify(await bals()) === JSON.stringify(['$11,852', '$16,052', '$14,812', '$12,512']),
    'income adds, expense subtracts, balance carries', JSON.stringify(await bals()));
  const foot = await page.evaluate(() => document.querySelector('.pl-foot').textContent);
  check(/\$11,852/.test(foot), 'lowest point is the true minimum, not the last or smallest row', foot.trim());
  check(/2 Sep/.test(foot), 'lowest point names its date', foot.trim());
  check(/\$12,512/.test(foot), 'ending balance shown', foot.trim());
  check((await page.evaluate(() => document.querySelector('.pl-segsum').textContent)).includes('$12,512'),
    'the collapsed one-liner shows the same ending figure');

  section('5. past items: greyed, marked — and still editable');
  check(await page.evaluate(() => document.querySelectorAll('.pl-row.past').length) === 1,
    'only the passed row is greyed');
  check(await page.evaluate(() => !!document.querySelector('.pl-row.past .pl-clock')),
    'it carries the clock icon');
  check(await page.evaluate(() => document.querySelector('.pl-row.past').offsetHeight > 0),
    'greyed, never hidden');
  // the promise being defended: greyed must not have quietly become read-only
  await page.click('.pl-row.past .pl-act.edit'); await page.waitForTimeout(160);
  check(await page.inputValue('.pl-f-name') === 'Credit Bill — Aug cycle', 'a past row loads into the form');
  check(await page.evaluate(() => document.querySelector('.pl-form').classList.contains('editing')),
    'the form switches to edit mode');
  await page.fill('.pl-f-amt', '1795');
  await page.click('.pl-addbtn'); await page.waitForTimeout(160);
  check(await page.evaluate(() => state.plan.segments[0].items.find(i => i.date === '2026-09-02').amt) === 1795,
    'editing a passed row actually saves');
  check(JSON.stringify(await bals()) === JSON.stringify(['$11,837', '$16,037', '$14,797', '$12,497']),
    'balances recompute after the edit', JSON.stringify(await bals()));
  check(await page.evaluate(() => document.querySelectorAll('.pl-row').length) === 4, 'no duplicate row created');
  check(await page.inputValue('.pl-f-name') === '', 'the form clears after saving');

  section('6. cancel an edit, and delete a row');
  await page.click('.pl-row .pl-act.edit'); await page.waitForTimeout(140);
  await page.click('.pl-cancel'); await page.waitForTimeout(140);
  check(await page.evaluate(() => !document.querySelector('.pl-form').classList.contains('editing')),
    'cancel leaves edit mode');
  check(await page.evaluate(() => state.plan.segments[0].items.length) === 4, 'cancel changes nothing');
  await page.click('.pl-row:last-of-type .pl-act.del'); await page.waitForTimeout(160);
  check(await page.evaluate(() => state.plan.segments[0].items.length) === 3, 'delete removes one item');
  check((await days()).length === 3, 'and the list redraws');

  section('7. typing in the form is never rebuilt under the caret');
  await page.evaluate(() => { const i = document.querySelector('.pl-f-name');
    i.value = 'HALF TYPED'; i.focus(); i.setSelectionRange(4, 4); });
  await page.evaluate(() => render());
  await page.waitForTimeout(120);
  const kept = await page.evaluate(() => { const i = document.querySelector('.pl-f-name');
    return { f: document.activeElement === i, c: i.selectionStart, v: i.value }; });
  check(kept.f && kept.c === 4 && kept.v === 'HALF TYPED', 'render() leaves the form alone',
    JSON.stringify(kept));
  // editing the starting balance rewrites derived numbers but must not rebuild inputs
  await page.evaluate(() => { const i = document.querySelector('.pl-start');
    i.focus(); i.value = '20000'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  check(await page.evaluate(() => document.activeElement.classList.contains('pl-start')),
    'focus survives a starting-balance edit');
  check((await bals())[0] === '$18,205', 'balances follow the new start immediately', (await bals())[0]);
  await page.evaluate(() => { const i = document.querySelector('.pl-start');
    i.value = '13632'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);

  section('8. persistence and cloud payload');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('sparta.plan') || 'null')),
    'sparta.plan is written');
  const cp = await page.evaluate(() => corePayload().plan);
  check(cp && cp.segments[0].items.length === 3, 'corePayload() carries the plan', JSON.stringify(cp).slice(0, 70));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  await go('plan');
  check(await page.evaluate(() => state.plan.segments[0].name) === 'Sept → Dec 2026 runway', 'survives a reload');
  check(await page.evaluate(() => document.querySelectorAll('.pl-seg.open').length) === 1,
    'the open/closed state survives too');
  check((await days()).length === 3, 'items come back');

  section('9. deleting a segment');
  await page.click('#plNewSeg'); await page.waitForTimeout(200);
  await page.fill('.pl-seg:last-child .pl-segname', 'Scratch');
  await page.waitForTimeout(450);
  check(await page.evaluate(() => state.plan.segments.length) === 2, 'two segments now');
  const before = confirmSeen;
  await page.click('.pl-seg:last-child .pl-segdel'); await page.waitForTimeout(250);
  check(confirmSeen === before + 1, 'deleting asks first');
  check(await page.evaluate(() => state.plan.segments.length) === 1, 'only that segment goes');
  check(await page.evaluate(() => state.plan.segments[0].name) === 'Sept → Dec 2026 runway',
    'the other one is untouched');
  check(await page.evaluate(() => state.plan.segments[0].open) === true,
    'and clicking delete did not toggle anything open or shut');

  section('10. normalizePlan() repairs junk rather than throwing');
  const norm = await page.evaluate(() => {
    const out = [];
    const run = v => { state.plan = v; try { normalizePlan();
      out.push({ ok: true, n: state.plan.segments.length,
                 items: state.plan.segments[0] ? state.plan.segments[0].items.length : 0,
                 firstAmt: state.plan.segments[0] && state.plan.segments[0].items[0]
                   ? state.plan.segments[0].items[0].amt : null,
                 ids: state.plan.segments.every(s => !!s.id) }); }
      catch (e) { out.push({ ok: false, err: e.message }); } };
    run(null); run('nonsense'); run({ segments: { a: 1 } });
    run({ segments: [null, 7, { name: 'ok', start: 'abc', items: [
      { date: 'not-a-date', type: 'weird', amt: '-40', name: 'x' }, null, 5 ] }] });
    return out;
  });
  check(norm.every(r => r.ok), 'no shape throws', JSON.stringify(norm.map(r => r.ok)));
  check(norm[0].n === 0 && norm[1].n === 0 && norm[2].n === 0, 'junk reduces to no segments');
  check(norm[3].n === 1 && norm[3].items === 1, 'a mixed list keeps only the usable entries',
    `${norm[3].n} seg / ${norm[3].items} items`);
  check(norm[3].firstAmt === 40, 'a negative amount is stored as a magnitude', String(norm[3].firstAmt));
  check(norm[3].ids, 'missing ids are filled in');

  section('11. layout');
  await page.evaluate(() => { state.plan = { segments: [{ id: 's1', name: 'Geo', start: 1000, open: true,
    items: [{ id: 'i1', date: '2026-12-01', type: 'expense', name: 'Thing', amt: 100, notes: '' }] }] };
    planPersist(); renderPlan(); });
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => {
    const sp = document.querySelector('.pl-split');
    const [a, b] = [...sp.children].map(c => c.getBoundingClientRect().width);
    return { list: +(a / sp.getBoundingClientRect().width).toFixed(3), b };
  });
  check(Math.abs(g.list - 0.6) < 0.02, 'list is 60% at 1440px', String(g.list));
  for (const w of [900, 700, 560, 390]) {
    await page.setViewportSize({ width: w, height: 1200 });
    await page.waitForTimeout(180);
    const m = await page.evaluate(() => {
      const p = document.querySelector('.plan-skin');
      const sp = document.querySelector('.pl-split');
      const c = [...sp.children];
      return { over: +(p.scrollWidth - p.clientWidth).toFixed(1),
               stacked: c[1].getBoundingClientRect().top > c[0].getBoundingClientRect().top + 10 };
    });
    check(m.over <= 0.5, `${w}px: no overflow`, `${m.over}px`);
    if (w <= 900) check(m.stacked, `${w}px: list above, form below`);
  }
  await page.setViewportSize({ width: 1440, height: 1200 });

  section('12. the skin: teal glass settling into the app background');
  const skin = await page.evaluate(() => {
    const el = document.querySelector('.plan-skin');
    const cs = getComputedStyle(el);
    return { img: cs.backgroundImage, radius: cs.borderTopLeftRadius,
             font: cs.fontFamily,
             anims: document.getAnimations().filter(a => a.animationName === 'planskin').length };
  });
  check(/linear-gradient\(165deg/.test(skin.img), 'a 165deg gradient', skin.img.slice(0, 40));
  check(skin.img.includes('rgb(12, 63, 74)'), 'starts on the deep teal #0C3F4A');
  check(skin.img.includes('rgb(7, 21, 32)'), 'lands on the app background #071520');
  check(skin.anims === 0, 'the old cross-fade animation is gone', String(skin.anims));
  check(/Jakarta/.test(skin.font), 'Plus Jakarta Sans is applied', skin.font.slice(0, 40));

  section('13. edge aurora');
  const au = await page.evaluate(() => {
    const l = document.querySelector('.pl-aurora');
    const blobs = [...document.querySelectorAll('.pl-aurora span')];
    const skinBox = document.querySelector('.plan-skin').getBoundingClientRect();
    const names = ['plDrift1', 'plDrift2'];
    const running = document.getAnimations()
      .filter(a => names.includes(a.animationName) && a.playState === 'running').length;
    // every blob must be anchored to a side, not drifting across the reading column
    const mid = blobs.map(b => { const r = b.getBoundingClientRect();
      const c = (r.left + r.width / 2 - skinBox.left) / skinBox.width; return +c.toFixed(2); });
    return { count: blobs.length, running,
             z: getComputedStyle(l).zIndex,
             contentZ: getComputedStyle(document.querySelector('.plan-skin h3')).zIndex,
             clipped: getComputedStyle(document.querySelector('.plan-skin')).overflow,
             mid };
  });
  check(au.count === 4, 'four blobs', String(au.count));
  check(au.running === 4, 'all four are drifting while Plan is open', String(au.running));
  check(au.z === '0' && au.contentZ === '1', 'the aurora sits behind the content',
    `${au.z} vs ${au.contentZ}`);
  check(au.clipped === 'hidden', 'the panel clips it');
  check(au.mid.every(c => c < 0.3 || c > 0.7), 'each blob stays on a side, clear of the middle',
    JSON.stringify(au.mid));

  // motion has to be measurable, not just "an animation exists" -- and it must
  // stay off the reading column
  const sample = async (fx, fy) => {
    const b = await page.evaluate(([a, c]) => { const r = document.querySelector('.plan-skin').getBoundingClientRect();
      return { x: Math.round(r.x + r.width * a), y: Math.round(r.y + r.height * c) }; }, [fx, fy]);
    const buf = await page.screenshot({ clip: { x: b.x, y: b.y, width: 2, height: 2 } });
    return page.evaluate(async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s;
      await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 2;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); }, buf.toString('base64'));
  };
  const seek = async ms => { await page.evaluate(t => document.getAnimations()
      .filter(a => ['plDrift1','plDrift2'].includes(a.animationName))
      .forEach(a => { a.pause(); a.currentTime = t; }), ms); await page.waitForTimeout(180); };
  const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  // Three points per side, taking the largest change: a big soft blob moves
  // least at its own centre, so a single sample can sit in a flat spot and
  // read as "no motion" when the side is plainly drifting.
  const LEFT = [[0.03,0.35],[0.06,0.55],[0.03,0.75]];
  const RIGHT = [[0.96,0.55],[0.90,0.30],[0.96,0.20]];
  const MID = [[0.5,0.5],[0.45,0.3],[0.55,0.7]];
  const grab = async pts => { const o = []; for (const [x,y] of pts) o.push(await sample(x,y)); return o; };
  await seek(0);
  const a = { l: await grab(LEFT), r: await grab(RIGHT), c: await grab(MID) };
  await seek(18000);
  const b2 = { l: await grab(LEFT), r: await grab(RIGHT), c: await grab(MID) };
  const maxD = (p, q) => Math.max(...p.map((v, i) => dist(v, q[i])));
  check(maxD(a.l, b2.l) > 5, 'the left edge visibly moves', `d=${maxD(a.l,b2.l).toFixed(1)}`);
  check(maxD(a.r, b2.r) > 5, 'the right edge visibly moves', `d=${maxD(a.r,b2.r).toFixed(1)}`);
  check(maxD(a.c, b2.c) < 1.5, 'the middle stays still, so reading is undisturbed',
    `d=${maxD(a.c,b2.c).toFixed(1)}`);
  await page.evaluate(() => document.getAnimations()
    .filter(a => ['plDrift1','plDrift2'].includes(a.animationName)).forEach(a => a.play()));

  // the perf claim: display:none means these cost nothing on every other tab
  await go('dash'); await page.waitForTimeout(250);
  const off = await page.evaluate(() => document.getAnimations()
    .filter(a => ['plDrift1','plDrift2'].includes(a.animationName) && a.playState === 'running').length);
  check(off === 0, 'nothing animates once you leave the Plan tab', String(off));
  await go('plan'); await page.waitForTimeout(250);
  const back = await page.evaluate(() => document.getAnimations()
    .filter(a => ['plDrift1','plDrift2'].includes(a.animationName) && a.playState === 'running').length);
  check(back === 4, 'and it picks up again on return', String(back));

  check(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
  console.log(`\nPLAN: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
