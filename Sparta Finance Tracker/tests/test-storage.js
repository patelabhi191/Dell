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

  section('2d. the card grid: running order, spans and the rows inside them');
  /* Everything here is measured from live rects, so it is pinned against a card
     that silently collapses or a span that stops spanning -- neither of which
     shows up in the markup. */
  const grid = await page.evaluate(() => {
    const R = e => e.getBoundingClientRect();
    const d = document.getElementById('drawer');
    const cards = [...d.querySelectorAll('.set-card')];
    const rows = new Map();
    cards.forEach(c => {
      const t = Math.round(R(c).top);
      if (!rows.has(t)) rows.set(t, []);
      rows.get(t).push(c.querySelector('h3').textContent);
    });
    const by = n => cards.find(c => c.querySelector('h3').textContent.startsWith(n));
    /* NOT the card heights: two cards in one grid row always stretch to match,
       so comparing them passes whatever the content does. The question is
       whether the content FILLS the card, which is the gap left under its last
       child. Without the fill rules App lock leaves ~9px of dead air here. */
    const slack = c => {
      const k = R(c), last = R(c.lastElementChild);
      return Math.round(k.bottom - parseFloat(getComputedStyle(c).paddingBottom) - last.bottom);
    };
    const pill = s => { const e = document.querySelector(s); return e ? Math.round(R(e).height) : null };
    const oneLine = s => new Set([...document.querySelectorAll(s)].map(e => Math.round(R(e).top))).size;
    const sg = R(document.querySelector('.syncgrid'));
    const pct = e => Math.round(R(e).width / sg.width * 100);
    const left = document.querySelector('.sg-left');
    return {
      order: [...rows.keys()].sort((a, b) => a - b).map(k => rows.get(k)),
      slackA: slack(by('App lock')), slackY: slack(by('Yearly')),
      tabPill: pill('.taborder-row'), resetPill: pill('#resetRows .reset-row'),
      tabsOnOneLine: oneLine('.taborder-row'),
      resetSitsWithPills: Math.round(R(document.getElementById('tabOrderReset')).top)
                       === Math.round(R(document.querySelector('.taborder-row')).top),
      danger: d.querySelectorAll('.set-card.danger').length,
      leftPct: pct(left), testPct: pct(document.getElementById('fbTest')),
      pushPct: pct(document.getElementById('fbPush')),
      pullPct: pct(document.getElementById('fbPull')),
      // both status rows must live inside the one dark container
      bothInside: left.contains(document.getElementById('fbToggle'))
               && left.contains(document.getElementById('localToggle')),
      finInHead: !!document.getElementById('finKeyStatus')
                  .closest('.set-card').querySelector('h3').textContent.match(/Cloud sync/),
      finText: document.getElementById('finKeyStatus').textContent,
      livePricesCard: [...cards].some(c => c.querySelector('h3').textContent === 'Live prices'),
      refreshBtn: !!document.getElementById('refreshNow')
    };
  });
  check(JSON.stringify(grid.order) === JSON.stringify(
      [['App lock', 'Yearly starting balance'], ['Tab order'], ['Dashboard shortcuts'],
       ['Cloud sync'], ['Clear data']]),
    'two cards pair on the first row, the other four run full width below',
    JSON.stringify(grid.order));
  check(grid.slackA <= 3 && grid.slackY <= 3,
    'neither of the paired cards trails off into dead space at its bottom',
    JSON.stringify([grid.slackA, grid.slackY]));
  check(grid.tabsOnOneLine === 1 && grid.resetSitsWithPills,
    'all six tab pills and Reset to default share one line', JSON.stringify(grid));
  /* .drawer input{min-height:36px} used to size the CHECKBOX inside each Clear
     data pill, standing them 42px tall beside Tab order's 35px. */
  check(grid.tabPill === grid.resetPill,
    'a Clear data pill is exactly as tall as a Tab order pill',
    JSON.stringify([grid.resetPill, grid.tabPill]));
  check(grid.danger === 0, 'no card carries the warm destructive tint any more',
    String(grid.danger));
  check(Math.abs(grid.leftPct - 60) <= 2 && Math.abs(grid.testPct - 40) <= 2
     && Math.abs(grid.pushPct - 20) <= 2 && Math.abs(grid.pullPct - 20) <= 2,
    'cloud sync splits 60 / 40 over 60 / 20 / 20',
    JSON.stringify([grid.leftPct, grid.testPct, grid.pushPct, grid.pullPct]));
  check(grid.bothInside,
    'the connection and keep-data rows sit inside one container, not two strips');
  check(!grid.livePricesCard && !grid.refreshBtn && grid.finInHead,
    'Live prices is no longer a card — it is one fact in the Cloud sync heading',
    JSON.stringify([grid.livePricesCard, grid.refreshBtn, grid.finInHead]));
  check(/^(Yes|No) /.test(grid.finText), 'and it answers Yes or No', grid.finText);

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
    const read = () => JSON.parse(localStorage.getItem(nsKey('sparta.updatedAt')) || '0');
    const out = {};
    const bump = async (name, fn) => {
      localStorage.setItem(nsKey('sparta.updatedAt'), '1');
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
  /* ...but an AUTOMATED save must not. A tab left open all day re-stamped itself
     every 60 seconds off the price timer, so on its next connect it outranked a
     phone that had genuinely been used at lunchtime and pushed its stale ledger
     over the top. Nothing the user did changed, so nothing should claim it did. */
  const auto = await page.evaluate(() => {
    const read = () => JSON.parse(localStorage.getItem(nsKey('sparta.updatedAt')) || '0');
    localStorage.setItem(nsKey('sparta.updatedAt'), '1'); state.updatedAt = 1;
    fbUserEdited = false;
    automated(() => persist());
    const afterAuto = { stamp: read(), edited: fbUserEdited, flag: fbAutomated };
    persist();                                   // the same call, not automated
    return { afterAuto, afterUser: { stamp: read(), edited: fbUserEdited } };
  });
  check(auto.afterAuto.stamp === 1 && auto.afterAuto.edited === false,
    'an automated save leaves the stamp and the user-edited flag alone',
    JSON.stringify(auto.afterAuto));
  check(auto.afterAuto.flag === false, 'and lowers its guard again afterwards');
  check(auto.afterUser.stamp > 1 && auto.afterUser.edited === true,
    'while the very same call does both when a person made it — not a vacuous check',
    JSON.stringify(auto.afterUser));
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
    return { device: STORE_DEVICE.slice(),
             keys: Object.keys(localStorage).filter(k => /^sparta\./.test(k)).sort(),
             plan: (store.get('sparta.plan', null) || {}).segments,
             yf: (store.get('sparta.yf.data', null) || {}).txns };
  }, YEAR);
  check(JSON.stringify(off.keys) === JSON.stringify(['sparta.localOff', 'sparta.pinCode', 'sparta.pinOn']),
    'the disk holds the switch and the PIN, and nothing else', JSON.stringify(off.keys));
  check(off.keys.every(k => off.device.indexOf(k) > -1),
    'and every one of them is a device key, not a database one', JSON.stringify(off.keys));
  check(off.plan && off.plan.length === 1 && off.yf && off.yf.length === 1,
    'while reads and writes still work, out of memory', JSON.stringify([!!off.plan, !!off.yf]));
  const back = await page.evaluate(() => {
    localSetOff(false);
    planPersist();
    return { onDisk: !!localStorage.getItem(nsKey('sparta.plan')),
             note: document.getElementById('localOffNote').textContent };
  });
  check(back.onDisk, 'switching it back on writes to the disk again', String(back.onDisk));
  check(/On \u2014/.test(back.note) && !/Off \u2014/.test(back.note),
    'and the note reads as on again', back.note);
  const exempt = await page.evaluate(() =>
    STORE_EXEMPT.slice().sort().join(','));
  check(exempt === 'sparta.localOff,sparta.pinCode,sparta.pinOn',
    'the exempt list is exactly the switch and the PIN', exempt);

  /* ── 8. one drawer per database ──────────────────────────────────────────
     The incident this exists for: testing against a dummy database left dummy
     rows in localStorage stamped "just now", so pointing the file at production
     made them look NEWER than the real data and the app pushed them over it.
     The timestamp was never the problem -- the dummy data was not stale, it was
     foreign, and recency cannot answer "does this belong here". */
  section('8. storage is filed under the database it belongs to');
  const fp = await page.evaluate(() => ({
    test: dbFingerprint('sparta-app', 'https://sparta.firebaseio.com', 'sparta-test'),
    dev:  dbFingerprint('sparta-app', 'https://sparta.firebaseio.com', 'sparta-dev'),
    prod: dbFingerprint('sparta-app', 'https://sparta.firebaseio.com', 'sparta-prod'),
    // same three values, different project entirely
    other: dbFingerprint('other-app', 'https://other.firebaseio.com', 'sparta-prod'),
    // normalisation: a trailing slash or a capital must NOT orphan the drawer
    slash: dbFingerprint('sparta-app', 'https://sparta.firebaseio.com/', 'sparta-prod'),
    caps:  dbFingerprint('Sparta-App', 'HTTPS://Sparta.firebaseio.com', 'Sparta-Prod'),
    pad:   dbFingerprint('  sparta-app ', 'https://sparta.firebaseio.com', ' sparta-prod  '),
    empty: dbFingerprint('', '', ''),
    nulls: dbFingerprint(null, undefined, null),
  }));
  const three = [fp.test, fp.dev, fp.prod];
  check(new Set(three).size === 3,
    'three nodes in ONE project get three different ids — SYNC_KEY is in the hash',
    JSON.stringify(three));
  check(fp.other !== fp.prod, 'and a different project differs too', JSON.stringify([fp.other, fp.prod]));
  check(three.every(v => /^[a-z0-9]{7}$/.test(v)), 'each is a short stable token', JSON.stringify(three));
  check(fp.slash === fp.prod && fp.caps === fp.prod && fp.pad === fp.prod,
    'a trailing slash, different casing or stray spaces resolve to the SAME drawer',
    JSON.stringify([fp.slash, fp.caps, fp.pad, fp.prod]));
  check(fp.empty === 'local' && fp.nulls === 'local',
    'an unconfigured app falls back to a fixed name rather than hashing nothing',
    JSON.stringify([fp.empty, fp.nulls]));

  const drawers = await page.evaluate(() => {
    const before = nsKey('sparta.yf.data');
    return { data: before, device: nsKey('sparta.pinCode'),
             namespaced: before !== 'sparta.yf.data',
             deviceBare: nsKey('sparta.pinCode') === 'sparta.pinCode',
             unknown: nsKey('something.else') };
  });
  check(drawers.namespaced && /^sparta\.[a-z0-9]+\.yf\.data$/.test(drawers.data),
    'a data key is filed under the drawer', drawers.data);
  check(drawers.deviceBare,
    'the PIN is not — it belongs to the device, and would vanish on every switch',
    drawers.device);
  check(drawers.unknown === 'something.else', 'anything not ours is left alone', drawers.unknown);

  /* The whole point: another database's rows are not compared or merged, they
     are simply never read. */
  const foreign = await page.evaluate(() => {
    localStorage.setItem('sparta.a1b2c3d.yf.data', JSON.stringify({ txns: [{ id: 'DUMMY' }] }));
    const mine = store.get('sparta.yf.data', { txns: [] });
    return { ids: (mine.txns || []).map(t => t.id),
             stillThere: !!localStorage.getItem('sparta.a1b2c3d.yf.data') };
  });
  check(!foreign.ids.includes('DUMMY'),
    "another database's rows are never read into this one", JSON.stringify(foreign.ids));
  check(foreign.stillThere,
    'and they are left intact, so switching back finds them where they were');

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nSTORAGE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
