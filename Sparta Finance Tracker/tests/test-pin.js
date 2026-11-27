/* The PIN lock.

   It is a screen lock, not encryption -- the code is kept in the browser and in
   the cloud record in the clear, by design, and can be reset from the Firebase
   console. What it has to do is the two things a lock promises: keep someone at
   the keyboard out of the ledger while it is showing, and never lock the OWNER
   out with a code that cannot be entered. Both were false. */
const { serve, launch, open, stub, SEED } = require('./lib');
const stubFor = p => stub(p);
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const locked = code => open(browser, url,
    Object.assign({}, SEED, { 'sparta.pinOn': 'true', 'sparta.pinCode': code }));
  const gateUp = p => p.evaluate(() =>
    getComputedStyle(document.getElementById('pinGate')).display !== 'none');

  /* ── 1. the lock keeps the keyboard out ───────────────────────────────── */
  section('1. nothing behind the gate can be reached while it is up');
  {
    const O = await locked('"123456"'); const p = O.page;
    await p.waitForTimeout(300);
    check(await gateUp(p), '1: a stored PIN puts the gate up on load');

    /* The gate covers the page, which stops the mouse. The keyboard was never
       stopped: eleven Tabs reached the first control underneath. */
    const escaped = [];
    for (let i = 0; i < 60; i++) {
      await p.keyboard.press('Tab');
      const a = await p.evaluate(() => { const e = document.activeElement;
        return { ok: e === document.body || !!e.closest('#pinGate'), what: e.id || e.className || e.tagName } });
      if (!a.ok) escaped.push(a.what);
    }
    check(escaped.length === 0, '1: sixty presses of Tab never leave the gate',
      escaped.slice(0, 5).join(', '));

    const blind = await p.evaluate(async () => {
      const before = JSON.stringify(state.notes.points);
      const b = document.getElementById('npAdd');
      b.focus();
      const focused = document.activeElement === b;
      b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return { focused, same: JSON.stringify(state.notes.points) === before };
    });
    check(blind.focused === false, '1: a control behind the gate cannot take focus at all',
      String(blind.focused));
    await p.keyboard.type('x'); await p.waitForTimeout(500);
    const notes = await p.evaluate(() => state.notes.points.length);
    check(blind.same && notes === 0,
      '1: ...so the ledger cannot be edited blind from a locked screen', `${notes} notes`);

    /* The rest of the page must not be offered to a screen reader either. */
    const tree = await p.evaluate(() => [...document.body.children]
      .filter(e => e.id !== 'pinGate' && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE')
      .every(e => e.inert === true));
    check(tree, '1: everything but the gate is inert while it shows');

    /* Start each attempt from an empty buffer: the Tab walk above left focus
       on a keypad button, and a stray key there is a digit already entered. */
    const clear = () => p.evaluate(() => { document.activeElement.blur(); pinBuf = ''; pinRenderDots() });
    await clear();
    for (const k of '654321') await p.keyboard.press(k);
    await p.waitForTimeout(600);
    check(await gateUp(p), '1: a wrong PIN leaves it up');

    await clear();
    for (const k of '123456') await p.keyboard.press(k);
    await p.waitForTimeout(700);
    check(!(await gateUp(p)), '1: the right PIN opens it');
    const after = await p.evaluate(() => {
      const b = document.getElementById('npAdd'); b.focus();
      return { anyInert: [...document.body.children].some(e => e.inert),
        focus: document.activeElement === b };
    });
    check(!after.anyInert && after.focus,
      '1: ...and hands the whole page back -- nothing is left inert', JSON.stringify(after));
    check(O.errs.length === 0, '1: no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ── 2. setting a PIN is a modal too ──────────────────────────────────── */
  section('2. the setup overlay holds the page, and gives it back on cancel');
  {
    const O = await open(browser, url, SEED); const p = O.page;
    await p.waitForTimeout(300);
    check(!(await gateUp(p)), '2: no PIN, no gate');
    await p.evaluate(() => pinOpen('setup'));
    await p.waitForTimeout(150);
    const held = await p.evaluate(() => { const b = document.getElementById('npAdd'); b.focus();
      return document.activeElement === b });
    check(held === false, '2: the page behind the setup overlay is held', String(held));
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    const back = await p.evaluate(() => ({ inert: [...document.body.children].some(e => e.inert),
      on: store.get('sparta.pinOn', false) }));
    check(!(await gateUp(p)) && !back.inert && back.on !== true,
      '2: Escape cancels, releases the page and sets nothing', JSON.stringify(back));
    await O.ctx.close();
  }

  /* ── 3. a code nobody can type is not a lock ──────────────────────────── */
  section('3. a stored code the keypad cannot enter must not lock the owner out');
  /* The keypad types six digits and nothing else. The gate went up for ANY
     non-empty code, so these three -- reachable from a hand-edited cloud
     record -- were a lock with no key on every device that pulled them. */
  for (const [code, why] of [['"12345"', 'five digits'], ['"abcdef"', 'letters'], ['""', 'empty']]) {
    const O = await locked(code); const p = O.page;
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ on: store.get('sparta.pinOn', false),
      line: document.getElementById('pinStatusLine').textContent,
      stamp: state.updatedAt }));
    check(!(await gateUp(p)), `3: ${why}: the gate stays down`);
    check(st.on === false && /^Off/.test(st.line),
      `3: ${why}: and Settings says the lock is off, rather than "On" with no lock`,
      JSON.stringify(st));
    await O.ctx.close();
  }
  {
    const O = await locked('123456'); const p = O.page;      // stored as a NUMBER
    await p.waitForTimeout(300);
    check(await gateUp(p), '3: a code stored as a number still locks');
    for (const k of '123456') await p.keyboard.press(k);
    await p.waitForTimeout(700);
    check(!(await gateUp(p)), '3: ...and still opens');
    await O.ctx.close();
  }

  /* ── 4. the same rule for a PIN arriving from the cloud ───────────────── */
  section('4. a pulled PIN');
  {
    const O = await open(browser, url, SEED); const p = O.page;
    await p.waitForTimeout(300);
    const pulled = await p.evaluate(() => {
      const take = pin => { applyPayload(Object.assign(corePayload(), { pin }));
        return { on: store.get('sparta.pinOn', null), code: store.get('sparta.pinCode', null) } };
      return { bad: take({ on: true, code: '12ab' }), good: take({ on: true, code: '246810' }),
        num: take({ on: true, code: 135790 }), off: take({ on: false, code: '246810' }) };
    });
    check(pulled.bad.on === false && pulled.bad.code === null,
      '4: an untypeable code does not arrive switched on', JSON.stringify(pulled.bad));
    check(pulled.good.on === true && pulled.good.code === '246810',
      '4: a real one does', JSON.stringify(pulled.good));
    check(pulled.num.on === true && pulled.num.code === '135790',
      '4: a numeric one is kept as the six characters it will be compared with',
      JSON.stringify(pulled.num));
    check(pulled.off.on === false && pulled.off.code === '246810',
      '4: and a lock switched off elsewhere stays off here, code kept', JSON.stringify(pulled.off));
    check(O.errs.length === 0, '4: no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ── 5. once per tab ──────────────────────────────────────────────────── */
  section('5. enter it once, and the tab stays unlocked until it is closed');
  {
    /* The owner's rule: the PIN keeps out someone who only has the URL. Asked
       once; a phone reloading or restoring that same tab must not ask again,
       and closing the tab must. sessionStorage is the tab's lifetime. */
    const O = await locked('"123456"'); const p = O.page;
    await p.waitForTimeout(300);
    for (const k of '123456') await p.keyboard.press(k);
    await p.waitForTimeout(700);
    check(!(await gateUp(p)), '5: unlocked');
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
    check(!(await gateUp(p)), '5: reloading the SAME tab does not ask again');
    check(await p.evaluate(() => [...document.body.children].every(e => !e.inert)),
      '5: ...and nothing is left inert behind a gate that never showed');

    /* a second tab is a new session: sessionStorage is per tab */
    const p2 = await O.ctx.newPage(); await stubFor(p2);
    await p2.goto(url, { waitUntil: 'load' }); await p2.waitForTimeout(400);
    check(await gateUp(p2), '5: a NEW tab asks for the PIN');
    await p2.close();

    /* a changed PIN asks again, even in the tab that was unlocked */
    await p.evaluate(() => { store.set('sparta.pinCode', '654321') });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
    check(await gateUp(p), '5: after the PIN is changed, even the unlocked tab asks again');
    for (const k of '654321') await p.keyboard.press(k);
    await p.waitForTimeout(700);
    check(!(await gateUp(p)), '5: ...and the new PIN opens it');
    check(await p.evaluate(() => /once per tab/.test(document.getElementById('pinStatusLine').textContent)),
      '5: Settings says how it behaves -- once per tab');
    check(O.errs.length === 0, '5: no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  /* ── 6. a PIN that arrives from the cloud ────────────────────────────── */
  section('6. a PIN pulled from the cloud locks a tab nobody has unlocked');
  {
    const O = await open(browser, url, SEED); const p = O.page;
    await p.waitForTimeout(300);
    check(!(await gateUp(p)), '6: (no PIN on this device yet, so no gate)');
    await p.evaluate(() => applyPayload(Object.assign(corePayload(), { pin: { on: true, code: '246810' } })));
    await p.waitForTimeout(300);
    check(await gateUp(p), '6: the moment the data arrives with a PIN, this tab locks');
    for (const k of '246810') await p.keyboard.press(k);
    await p.waitForTimeout(700);
    check(!(await gateUp(p)), '6: ...and the pulled PIN opens it');
    /* a later pull with the same PIN must not lock a tab that is already in */
    await p.evaluate(() => applyPayload(Object.assign(corePayload(), { pin: { on: true, code: '246810' } })));
    await p.waitForTimeout(300);
    check(!(await gateUp(p)), '6: a later sync with the same PIN leaves an unlocked tab alone');
    check(O.errs.length === 0, '6: no page errors', O.errs.join(' | '));
    await O.ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\nPIN LOCK: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
