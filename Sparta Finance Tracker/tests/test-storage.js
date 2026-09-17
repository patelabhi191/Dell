/* Selective reset + the keep-data-here switch.

   Both exist because test data and real data used to share one bucket: rows left
   behind while trying something out look, to the cloud merge, exactly like real
   work. Two bugs found on the way here are pinned too:

     - "Reset all data" only ever cleared Dashboard and Contributions. Every
       Yearly row, Monthly row, Plan segment and Note survived a button whose
       label promised otherwise.
     - sparta.updatedAt was bumped by persist() alone, so an evening of Yearly
       work never advanced the stamp fbConnect uses to pick a winner, and a
       trivial Dashboard change on another device outranked and overwrote it.

   The load-bearing checks here are the ones about what SURVIVES a clear: wiping
   too much is the failure that cannot be undone.                             */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => { ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };
const section = t => console.log(`\n── ${t} ──`);
const YEAR = 2026;

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  /* One fixture touching every store, so each clear can be judged by what it
     left alone as much as by what it emptied. The Monthly row carries an allot
     so the Yearly-only case can be checked for orphans. */
  const seed = () => page.evaluate(y => {
    state.yf.txns = [
      { id: 'bill', type: 'expense', date: `${y}-07-19`, amt: 900, desc: 'Card', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'buy',  type: 'expense', date: `${y}-07-05`, amt: 200, desc: 'Shop', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'bill', allotM: `${y}-07` },
      { id: 'solo', type: 'expense', date: `${y}-07-08`, amt: 40,  desc: 'Cash', cat: 'Dining Out', who: 'ABI', tab: 'me' }];
    state.yf.cats = { exp: ['Credit Bill', 'Invented'], inc: ['Paycheck'] };
    state.yf.planned = { [y]: { 'Credit Bill': 900 } };
    state.yf.start = { [y]: 5000 };
    state.holdings = [{ id: 'h', sym: 'AAPL', acct: 'TFSA', qty: 1, avg: 1, price: 2, manual: true }];
    state.cash = { TFSA: 100, FHSA: 0, Other: 0 };
    state.history = [{ t: Date.now(), v: { ALL: 1 }, k: 'k1' }];
    state.contribs = [{ id: 'c', t: Date.now(), acct: 'TFSA', amt: 100, y, cad: true }];
    state.limitsY = { ['TFSA-' + y]: 7000 };
    state.yearly = [{ y: y - 1, tfsaAbi: 10 }];
    state.plan.segments = [{ id: 's', name: 'Seg', start: 0, items: [] }];
    state.notes.points = [{ id: 'n', text: 'hello' }];
    state.notes.text = 'prose';
    state.me.rules = { loblaws: 'Groceries' };
    state.me.imported = ['fp1'];
    localStorage.setItem('sparta.pinOn', 'true');
    localStorage.setItem('sparta.pinCode', '123456');
    localStorage.setItem('sparta.tabOrder', JSON.stringify(['plan', 'dash']));
    localStorage.setItem('sparta.fbSyncKey', 'my-key');
    persist(); yfPersist(); mePersist(); planPersist(); notesPersist();
  }, YEAR);

  const snap = () => page.evaluate(() => ({
    yf: (state.yf.txns || []).map(t => t.id + ':' + t.tab + (t.allot ? '->' + t.allot : '')),
    cats: (state.yf.cats.exp || []).join(','),
    planned: Object.keys(state.yf.planned || {}).length,
    start: Object.keys(state.yf.start || {}).length,
    holdings: state.holdings.length, cash: state.cash.TFSA, history: state.history.length,
    contribs: state.contribs.length, limitsY: Object.keys(state.limitsY || {}).length,
    yearly: state.yearly.length,
    plan: state.plan.segments.length, notes: state.notes.points.length, prose: state.notes.text,
    rules: Object.keys(state.me.rules).length, imported: (state.me.imported || []).length,
    pin: localStorage.getItem('sparta.pinCode'),
    pinOn: localStorage.getItem('sparta.pinOn'),
    tabOrder: localStorage.getItem('sparta.tabOrder'),
    syncKey: localStorage.getItem('sparta.fbSyncKey'),
  }));
  const clear = ids => page.evaluate(i => spartaReset(i, false), ids);

  // ── 1. each tick clears its own and nothing else ─────────────────────────
  section('1. a tick clears its own store and leaves the rest standing');
  await seed();
  const start = await snap();
  check(start.yf.length === 3 && start.holdings === 1 && start.contribs === 1
    && start.plan === 1 && start.notes === 1, 'fixture covers every store',
    JSON.stringify([start.yf.length, start.holdings, start.contribs, start.plan, start.notes]));

  await clear(['dash']);
  let a = await snap();
  check(a.holdings === 0 && a.cash === 0 && a.history === 0, 'Dashboard empties',
    JSON.stringify([a.holdings, a.cash, a.history]));
  check(a.contribs === 1 && a.yf.length === 3 && a.plan === 1 && a.notes === 1 && a.rules === 1,
    'and Contributions, Yearly, Monthly, Plan and Notes are untouched',
    JSON.stringify([a.contribs, a.yf.length, a.plan, a.notes, a.rules]));

  await seed(); await clear(['contrib']);
  a = await snap();
  check(a.contribs === 0 && a.limitsY === 0 && a.yearly === 0, 'Contributions empties',
    JSON.stringify([a.contribs, a.limitsY, a.yearly]));
  check(a.holdings === 1 && a.yf.length === 3, 'leaving Dashboard and the ledger alone',
    JSON.stringify([a.holdings, a.yf.length]));

  await seed(); await clear(['plan']);
  a = await snap();
  check(a.plan === 0 && a.notes === 1, 'Plan empties without taking the notepad with it',
    JSON.stringify([a.plan, a.notes]));

  /* The list is one tick per TAB, in tab-bar order, so the notepad has none of
     its own -- it is a panel on Dashboard and Contributions, and folding it into
     either would be arbitrary. It must therefore survive every tick. */
  await seed(); await clear(['dash', 'contrib']);
  a = await snap();
  check(a.notes === 1 && a.prose === 'prose',
    'the notepad has no tick of its own and survives the two tabs it sits on',
    JSON.stringify([a.notes, a.prose]));

  /* Archives has no store yet. The tick exists so the list mirrors the tab bar
     and the id is reserved; it must be a harmless no-op, not a crash. */
  await seed();
  const arch = await page.evaluate(() => spartaReset(['archive'], false));
  a = await snap();
  check(arch === 1 && a.yf.length === 3 && a.holdings === 1 && a.plan === 1 && a.notes === 1,
    'the Archives tick is a no-op today and disturbs nothing',
    JSON.stringify([arch, a.yf.length, a.holdings, a.plan, a.notes]));

  /* ── 2. the one that cannot be done by deleting a key ─────────────────────
     Yearly and Monthly share state.yf.txns and are told apart by t.tab, so each
     of these clears a ROW FILTER out of one ledger. */
  section('2. Yearly and Monthly share a ledger and still clear separately');
  await seed(); await clear(['yearly']);
  a = await snap();
  check(JSON.stringify(a.yf) === JSON.stringify(['buy:me', 'solo:me']),
    "clearing Yearly drops its rows and keeps Monthly's", JSON.stringify(a.yf));
  check(!a.yf.some(r => /->/.test(r)),
    'and detaches what pointed at the bill, rather than orphaning it in no total at all',
    JSON.stringify(a.yf));
  check(/Credit Bill/.test(a.cats) && !/Invented/.test(a.cats),
    'the category list goes back to the shipped defaults', a.cats);
  check(a.planned === 0 && a.start === 0, 'planned amounts and starting balances go with it',
    JSON.stringify([a.planned, a.start]));
  check(a.rules === 1 && a.imported === 1, "Monthly's rules and import log are untouched",
    JSON.stringify([a.rules, a.imported]));

  await seed(); await clear(['monthly']);
  a = await snap();
  check(JSON.stringify(a.yf) === JSON.stringify(['bill:yf']),
    "clearing Monthly drops its rows and keeps Yearly's", JSON.stringify(a.yf));
  check(a.rules === 0 && a.imported === 0, 'with the merchant rules and import log',
    JSON.stringify([a.rules, a.imported]));
  check(/Invented/.test(a.cats) && a.planned === 1,
    "Yearly's own categories and planned amounts are untouched", a.cats);

  await seed(); await clear(['yearly', 'monthly']);
  a = await snap();
  check(a.yf.length === 0, 'ticking both empties the ledger entirely', JSON.stringify(a.yf));

  // ── 3. what a clear must never touch ─────────────────────────────────────
  section('2b. the checklist mirrors the tab bar, on one row');
  /* The drawer is display:none until opened, so every rect would read 0 and a
     "they share one row" check would pass while proving nothing. Open it first
     and assert the boxes are real before trusting their positions. */
  await page.click('#settingsBtn');
  await page.waitForTimeout(250);
  const ticks = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#resetRows .reset-row')];
    const boxes = rows.map(r => r.getBoundingClientRect());
    const tops = new Set(boxes.map(b => Math.round(b.top)));
    return { ids: rows.map(r => r.querySelector('input').value),
             labels: rows.map(r => r.querySelector('b').textContent),
             rowsUsed: tops.size,
             laidOut: boxes.length > 0 && boxes.every(b => b.width > 20 && b.height > 10) };
  });
  check(ticks.laidOut, 'the ticks are actually laid out — the rest of this section means nothing otherwise');
  check(JSON.stringify(ticks.ids) === JSON.stringify(['dash','contrib','yearly','monthly','archive','plan']),
    'six ticks, one per tab, in tab-bar order', JSON.stringify(ticks.ids));
  check(!ticks.labels.some(l => /note/i.test(l)), 'and no Notes tick among them',
    JSON.stringify(ticks.labels));
  check(ticks.rowsUsed === 1, 'all six share a single row', String(ticks.rowsUsed));

  section('2c. the drawer never exceeds 75% of the screen');
  const fit = await page.evaluate(() => {
    const d = document.getElementById('drawer');
    return { pct: Math.round(d.clientHeight / innerHeight * 100),
             scrolls: d.scrollHeight > d.clientHeight + 1,
             helpsHidden: [...document.querySelectorAll('.sec-help')].every(p => p.hidden),
             iButtons: document.querySelectorAll('.sec-i').length };
  });
  check(fit.pct <= 75, 'capped at 75vh however tall the content grows', String(fit.pct) + '%');
  check(fit.iButtons >= 6 && fit.helpsHidden,
    'every instruction starts folded away behind its own i button',
    JSON.stringify([fit.iButtons, fit.helpsHidden]));
  const help = await page.evaluate(async () => {
    const b = document.querySelector('[data-help="helpClear"]');
    b.click();
    const open = { hidden: document.getElementById('helpClear').hidden, aria: b.getAttribute('aria-expanded') };
    b.click();
    return { open, shut: { hidden: document.getElementById('helpClear').hidden, aria: b.getAttribute('aria-expanded') } };
  });
  check(help.open.hidden === false && help.open.aria === 'true'
     && help.shut.hidden === true && help.shut.aria === 'false',
    'the i button toggles its note open and shut, and says so to a screen reader',
    JSON.stringify(help));
  await page.click('#settingsBtn');            // put the drawer back
  await page.waitForTimeout(200);

  section('3. credentials and preferences survive every combination');
  await seed();
  await clear(['dash', 'contrib', 'yearly', 'monthly', 'archive', 'plan']);
  a = await snap();
  check(a.yf.length === 0 && a.holdings === 0 && a.contribs === 0 && a.plan === 0,
    'everything ticked empties every tab', JSON.stringify([a.yf.length, a.holdings, a.plan]));
  check(a.pin === '123456' && a.pinOn === 'true',
    'the PIN survives — wiping it would lock you out of your own app', String(a.pin));
  check(a.syncKey === 'my-key', 'the Firebase settings survive, so sync is not disconnected', a.syncKey);
  check(a.tabOrder === JSON.stringify(['plan', 'dash']),
    'and the tab order survives — a preference, not a row of yours', a.tabOrder);
  check((await page.evaluate(() => spartaReset([], false))) === 0,
    'clearing nothing is a no-op, not an "everything" shortcut');

  /* ── 4. a local clear must not travel ─────────────────────────────────────
     Every persist path ends in cloudSaveDebounced(), so without a guard a clear
     here would be pushed up and take the cloud copy with it. */
  section('4. a this-browser-only clear does not reach the cloud');
  const travel = await page.evaluate(() => {
    const seen = [];
    const realSave = window.cloudSaveDebounced, realPush = window.cloudPushAll;
    window.cloudSaveDebounced = () => { seen.push('save') };
    window.cloudPushAll = () => { seen.push('push'); return Promise.resolve() };
    const flag = [];
    spartaReset(['plan'], false);
    flag.push(fbLocalOnly);                       // must be back down afterwards
    window.cloudSaveDebounced = realSave; window.cloudPushAll = realPush;
    return { seen, flagAfter: flag[0] };
  });
  check(travel.seen.indexOf('push') < 0, 'nothing is pushed on a local-only clear',
    JSON.stringify(travel.seen));
  check(travel.flagAfter === false, 'and the guard is lowered again afterwards',
    String(travel.flagAfter));
  const guarded = await page.evaluate(async () => {
    const wrote = [];
    const real = fbDB, realEdited = fbUserEdited;
    fbDB = { child: () => ({ set: () => { wrote.push('core'); return Promise.resolve() } }) };
    fbUserEdited = true;
    fbLocalOnly = true;
    await cloudSaveDebounced();
    await new Promise(r => setTimeout(r, 1500));     // past the 1200ms debounce window
    const blocked = wrote.length;
    fbLocalOnly = false;                             // the same call, guard down
    state.plan.segments = [{ id: 'g', name: 'Guard', start: 0, items: [] }];
    await cloudSaveDebounced();
    await new Promise(r => setTimeout(r, 1500));
    const allowed = wrote.length;
    fbDB = real; fbUserEdited = realEdited;
    return { blocked, allowed };
  });
  check(guarded.blocked === 0,
    'nothing is written to the cloud while the guard is up', JSON.stringify(guarded));
  check(guarded.allowed > 0,
    'and the very same call does write once it is down — so the check is not vacuous',
    JSON.stringify(guarded));

  // ── 5. the timestamp every merge decision rests on ───────────────────────
  section('5. every store advances sparta.updatedAt');
  const stamps = await page.evaluate(async () => {
    const read = () => JSON.parse(localStorage.getItem('sparta.updatedAt') || '0');
    const out = {};
    const bump = async (name, fn) => {
      localStorage.setItem('sparta.updatedAt', '1');
      state.updatedAt = 1;
      fn();
      out[name] = read() > 1;
    };
    await bump('yearly', () => yfPersist());
    await bump('monthly', () => mePersist());
    await bump('plan', () => planPersist());
    await bump('notes', () => notesPersist());
    await bump('dash', () => persist());
    out.boot = state.bootStamp;
    return out;
  });
  ['yearly', 'monthly', 'plan', 'notes', 'dash'].forEach(k =>
    check(stamps[k] === true, `a ${k} save moves the stamp`, String(stamps[k])));
  check(typeof stamps.boot === 'number',
    'bootStamp stays a frozen number — startup migrations must not fabricate a fresh one',
    String(stamps.boot));

  // ── 6. the keep-data-here switch ─────────────────────────────────────────
  section('6. the switch is locked shut without a cloud to fall back on');
  const locked = await page.evaluate(() => ({
    can: localCanTurnOff(),
    disabled: document.getElementById('localToggle').disabled,
    note: document.getElementById('localOffNote').textContent,
    checked: document.getElementById('localToggle').checked }));
  check(!locked.can && locked.disabled,
    'with no cloud configured the control cannot be switched off', JSON.stringify(locked));
  check(/connect cloud sync/i.test(locked.note), 'and says why', locked.note);
  check(locked.checked, 'it reads as on, which is what it is');

  section('7. with it off, only the exempt keys reach the disk');
  const off = await page.evaluate(y => {
    localSetOff(true);
    Object.keys(localStorage).filter(k => /^sparta\./.test(k) && STORE_EXEMPT.indexOf(k) < 0)
      .forEach(k => localStorage.removeItem(k));
    state.plan.segments = [{ id: 'z', name: 'After', start: 0, items: [] }];
    state.yf.txns = [{ id: 'q', type: 'expense', date: `${y}-07-01`, amt: 5, cat: 'Food', who: 'ABI', tab: 'yf' }];
    planPersist(); yfPersist(); persist(); notesPersist(); mePersist();
    return { keys: Object.keys(localStorage).filter(k => /^sparta\./.test(k)).sort(),
             plan: (store.get('sparta.plan', null) || {}).segments,
             yf: (store.get('sparta.yf.data', null) || {}).txns };
  }, YEAR);
  check(JSON.stringify(off.keys) === JSON.stringify(['sparta.localOff', 'sparta.pinCode', 'sparta.pinOn']),
    'the disk holds the switch and the PIN, and nothing else', JSON.stringify(off.keys));
  check(off.plan && off.plan.length === 1 && off.yf && off.yf.length === 1,
    'while reads and writes still work, out of memory', JSON.stringify([!!off.plan, !!off.yf]));
  const back = await page.evaluate(() => {
    localSetOff(false);
    planPersist();
    return { onDisk: !!localStorage.getItem('sparta.plan'),
             note: document.getElementById('localOffNote').textContent };
  });
  check(back.onDisk, 'switching it back on writes to the disk again', String(back.onDisk));
  check(/On \u2014/.test(back.note) && !/Off \u2014/.test(back.note),
    'and the note reads as on again', back.note);
  const exempt = await page.evaluate(() =>
    STORE_EXEMPT.slice().sort().join(','));
  check(exempt === 'sparta.localOff,sparta.pinCode,sparta.pinOn',
    'the exempt list is exactly the switch and the PIN', exempt);

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nSTORAGE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
