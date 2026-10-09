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
    const d = document.getElementById('drawer');          // the frame
    const g = document.querySelector('.drawer-grid');     // the scroller
    const cs = getComputedStyle(d);
    const chrome = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return { pct: Math.round(d.getBoundingClientRect().height / innerHeight * 100),
             content: g.scrollHeight + chrome,
             pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
             // the rim light hangs off the frame, so the frame must not scroll
             frameScrolls: d.scrollHeight > d.clientHeight + 1,
             gridScrolls: g.scrollHeight > g.clientHeight + 1,
             helpsHidden: [...document.querySelectorAll('.sec-help')].every(p => p.hidden),
             iButtons: document.querySelectorAll('.sec-i').length };
  });
  check(fit.pct <= 75, 'capped at 75vh however tall the content grows', String(fit.pct) + '%');
  /* The cap alone does not stop the panel scrolling — it only decides where it
     gets cut off. Below ~870px of window the 75% rule itself is the binding
     constraint and a scrollbar is unavoidable; above it, this is. An eighth
     card, or the gaps drifting back up, breaks it. */
  check(fit.content <= 660, 'and its content stays short enough to need no scrollbar on a laptop',
    fit.content + 'px');
  check(new Set(fit.pad).size === 1,
    'the frame is one even margin all the way round, so it reads as a single block',
    JSON.stringify(fit.pad));
  /* The bug this split fixed: with the grid and the frame being one element, the
     rim light was inside the scroll container and slid out of view with the
     content. The frame must stay put whatever the grid does. */
  check(!fit.frameScrolls, 'the frame itself never scrolls — the grid inside it does',
    JSON.stringify([fit.frameScrolls, fit.gridScrolls]));
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
    flag.push(fbLocalOnly);                       // STAYS up: see the check below
    window.cloudSaveDebounced = realSave; window.cloudPushAll = realPush;
    return { seen, flagAfter: flag[0] };
  });
  check(travel.seen.indexOf('push') < 0, 'nothing is pushed on a local-only clear',
    JSON.stringify(travel.seen));
  /* This check used to read `=== false`, and that was the bug, not the contract.
     Suppressing the saves inside the clear loop is not enough on its own:
     lastCoreJSON still holds the PRE-clear payload, so the next ordinary edit in
     this tab sees a payload that differs from it and pushes the EMPTIED core --
     against a confirm that promises the cloud copy is left alone and a reconnect
     will pull it back. The guard therefore stays up for the life of the tab, and
     the sync status says so. It also stops fbRecheckOnWake pulling the copy back
     and undoing the clear, so it protects it in both directions. */
  check(travel.flagAfter === true,
    'and the guard STAYS up — this tab is no longer an authority on the cloud',
    String(travel.flagAfter));
  /* The half that actually matters, and the one that fails against the old
     build: an ordinary edit AFTER a local-only clear must not travel either. */
  const afterClear = await page.evaluate(async () => {
    const wrote = [];
    const real = fbDB, realEdited = fbUserEdited, realLocal = fbLocalOnly;
    fbDB = { child: () => ({ set: () => { wrote.push('core'); return Promise.resolve() } }) };
    fbUserEdited = true; fbLocalOnly = false; lastCoreJSON = '';
    spartaReset(['plan'], false);                 // the clear under test
    state.cash.TFSA = 999;                        // ...then an ordinary edit
    persist();
    await new Promise(r => setTimeout(r, 1500));  // past the 1200ms debounce
    const leaked = wrote.length;
    // a reload is what lifts the park; Settings -> Pull from cloud is the other route
    fbLocalOnly = false;
    state.cash.TFSA = 1001;
    persist();
    await new Promise(r => setTimeout(r, 1500));
    const after = wrote.length;
    fbDB = real; fbUserEdited = realEdited; fbLocalOnly = realLocal;
    return { leaked, after };
  });
  check(afterClear.leaked === 0,
    'an edit made AFTER a local-only clear does not push the emptied ledger',
    JSON.stringify(afterClear));
  check(afterClear.after > 0,
    '...and the same edit does push once the park is lifted — so it is not vacuous',
    JSON.stringify(afterClear));
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

  section('4b. a tab left open overnight cannot upload its stale ledger');
  /* The incident this closes: a laptop tab open since yesterday, its 60-second
     price refresh waking with the machine. persist() left the timestamp alone --
     correct -- but still called cloudSaveDebounced(), and fbUserEdited is sticky
     for the life of a tab, so yesterday's edit let today's timer through. `core`
     is written wholesale, so that stale ledger replaced a phone's real work with
     NO interaction from anyone. */
  const autoPush = await page.evaluate(async () => {
    const wrote = [];
    const real = fbDB, realEdited = fbUserEdited;
    fbDB = { child: () => ({ set: () => { wrote.push('core'); return Promise.resolve() } }) };
    fbUserEdited = true;                       // as it would be, a day later
    // exactly how fetchPrices and compactHistory save
    automated(() => { state.cash.TFSA = (state.cash.TFSA || 0) + 1; persist() });
    await new Promise(r => setTimeout(r, 1500));
    const afterAutomated = wrote.length;
    // the identical write, made by a person
    state.cash.TFSA = (state.cash.TFSA || 0) + 1; persist();
    await new Promise(r => setTimeout(r, 1500));
    const afterUser = wrote.length;
    fbDB = real; fbUserEdited = realEdited;
    return { afterAutomated, afterUser };
  });
  check(autoPush.afterAutomated === 0,
    'an automated save writes nothing to the cloud, even with the edit flag stuck on',
    JSON.stringify(autoPush));
  /* Without this the check above passes by breaking sync altogether. */
  check(autoPush.afterUser > 0,
    'while the same change made by a person still syncs — so nothing was just switched off',
    JSON.stringify(autoPush));

  section('4c. waking a tab re-checks the cloud before trusting itself');
  const wake = await page.evaluate(async () => {
    const real = fbDB, realEdited = fbUserEdited, realStamp = state.updatedAt;
    const wrote = [];
    state.updatedAt = 1000;                                   // this tab is old
    const remote = { core: { updatedAt: 9000, cash: { TFSA: 4242, FHSA: 0, Other: 0 },
                             holdings: [], contribs: [], yf: { txns: [] } } };
    fbDB = { get: () => Promise.resolve({ exists: () => true, val: () => remote }),
             child: () => ({ set: () => { wrote.push('core'); return Promise.resolve() } }) };
    fbUserEdited = true;
    await fbRecheckOnWake();
    await new Promise(r => setTimeout(r, 200));
    const pulled = state.cash.TFSA;
    fbDB = real; fbUserEdited = realEdited; state.updatedAt = realStamp;
    return { pulled, wrote: wrote.length };
  });
  check(wake.pulled === 4242,
    'a newer cloud copy is pulled in on wake rather than left stale', JSON.stringify(wake));
  check(wake.wrote === 0, 'and the wake check itself pushes nothing', JSON.stringify(wake));

  const noClobber = await page.evaluate(async () => {
    const real = fbDB, realStamp = state.updatedAt;
    state.updatedAt = 9999;                                   // this tab is the newer one
    const remote = { core: { updatedAt: 1, cash: { TFSA: -1, FHSA: 0, Other: 0 } } };
    fbDB = { get: () => Promise.resolve({ exists: () => true, val: () => remote }),
             child: () => ({ set: () => Promise.resolve() }) };
    const before = state.cash.TFSA;
    await fbRecheckOnWake();
    const after = state.cash.TFSA;
    fbDB = real; state.updatedAt = realStamp;
    return { before, after };
  });
  check(noClobber.before === noClobber.after,
    'an OLDER cloud copy is left alone — the check pulls, it does not blindly overwrite',
    JSON.stringify(noClobber));

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


  /* ── 9. the sells store ──────────────────────────────────────────────────
     A store that backs up but never restores, or that survives a clear, is
     worse than not having one -- so all three paths are pinned together. */
  section('9. closed positions round-trip');
  await page.evaluate(() => {
    state.sells = [{ id: 's1', t: Date.UTC(2026, 8, 18), sym: 'NVDA', acct: 'TFSA',
                     qty: 4, price: 905, avg: 775, ccy: 'USD' },
                   { id: 's2', t: Date.UTC(2026, 5, 27), sym: 'ENB', acct: 'Other',
                     qty: 60, price: 38.7, avg: 41.7, ccy: 'CAD' }];
    persist();
  });
  const sKey = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => /\.dash\.sells$/.test(k)));
  check(sKey.length === 1 && /^sparta\.[a-z0-9]+\.dash\.sells$/.test(sKey[0]),
    'sells are written under the namespaced Dashboard key', sKey.join(','));
  check(await page.evaluate(() => corePayload().sells.length) === 2,
    'and they are in corePayload(), so a backup carries them');
  /* The currency is the load-bearing field: without it a row cannot be
     formatted, and a converted total would be wrong tomorrow. */
  check(await page.evaluate(() => {
    const s = corePayload().sells[0];
    return s.ccy === 'USD' && s.price === 905 && s.avg === 775 && !('proceeds' in s) && !('pnl' in s);
  }), 'each row carries native price, cost and currency — never a derived total');

  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  check(await page.evaluate(() => state.sells.length) === 2, 'they survive a reload');

  // a payload written before sells existed must not wipe the ones here
  check(await page.evaluate(() => {
    const p = corePayload(); delete p.sells;
    applyPayload(p);
    return state.sells.length;
  }) === 2, 'an older payload with no sells key leaves them alone, rather than emptying them');

  check(await page.evaluate(() => {
    const p = corePayload(); p.sells = [{ id: 'x', t: 1, sym: 'Z', acct: 'TFSA', qty: 1, price: 2, avg: 1, ccy: 'USD' }];
    applyPayload(p);
    return state.sells.length === 1 && state.sells[0].sym === 'Z';
  }), 'and a payload that HAS them replaces what is here');

  /* Seed the neighbours first: earlier sections in this file clear several
     stores, so asserting on whatever happens to be left would be asserting on
     the fixture rather than on the tick. */
  await page.evaluate(() => {
    state.sells = [{ id: 's9', t: 1, sym: 'Q', acct: 'TFSA', qty: 1, price: 2, avg: 1, ccy: 'USD' }];
    state.yf.txns = [{ id: 'keepme', date: '2026-01-01', type: 'expense', amt: 5, cat: 'Rent', tab: 'yf' }];
    state.notes = { points: [{ id: 'p', text: 'keep' }], text: '', stocks: ['KEEP'] };
    persist(); yfPersist(); notesPersist();
  });
  await page.evaluate(() => { RESET_CLEAR.dash() });
  check(await page.evaluate(() => state.sells.length) === 0,
    'the Dashboard tick empties the sells');
  check(await page.evaluate(() =>
    state.yf.txns.some(t => t.id === 'keepme') && state.notes.stocks.includes('KEEP')),
    'and leaves the Yearly ledger and the notes standing, so the tick is still scoped');

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');

  /* ── 10. a figure that is not a finite number ────────────────────────────
     Section 8 covers a record arriving with the wrong SHAPE. This one covers
     the same record arriving with the right shape and a missing NUMBER, which
     is worse in one specific way: it does not throw, so no try/catch fires and
     nothing reaches the console. `s + undefined` is NaN, NaN propagates through
     every sum it meets, and the result is "$NaN" sitting in the figure the user
     is reading.

     It also corrupts rather than merely displaying: JSON.stringify writes NaN
     as null, so the bad figure survives a save, and arcSnapshot seals it into an
     archive where it reads as $0 forever -- and an archive is the one thing in
     this app that is meant never to change.

     Both sources are real. A Firebase write can be truncated, and the PIN is
     documented as something to read and reset in the Firebase console, so rows
     do get edited by hand there.

     Each case is a SEPARATE browser context: these are boot-time coercions, so
     the storage has to be in place before the app reads it, and reusing one
     page would prove nothing about load. */
  const bootWith = async seed => {
    const c = await browser.newContext();
    const p = await c.newPage();
    await stub(p);
    const pe = [];
    p.on('pageerror', e => pe.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) pe.push(m.text()); });
    await p.addInitScript(sd => {
      try { localStorage.clear(); for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, v); } catch (e) { }
    }, seed);
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForTimeout(400);
    return { c, p, pe };
  };
  // Rendered money anywhere on a tab that is actually on screen.
  const badCells = (p, view) => p.evaluate(v => {
    const out = [];
    document.querySelectorAll('#' + v + 'View *').forEach(el => {
      if (el.children.length) return;
      const t = (el.textContent || '').trim();
      if (/NaN|undefined/.test(t)) out.push(t.slice(0, 70));
    });
    return [...new Set(out)];
  }, view);

  section('10. a figure that is not a finite number');

  /* 10a. ONE expense row with no `amt` used to take out End, Saved, Off-paper,
     both monthly averages and the chart axis together -- and the chart then
     emitted y1="NaN" nine times, which was the only visible sign of it. */
  {
    const { c, p, pe } = await bootWith({
      'sparta.yf.data': JSON.stringify({
        txns: [
          { id: 'g1', type: 'expense', date: `${YEAR}-03-01`, cat: 'Rent', tab: 'yf', who: 'ABI' },
          { id: 'g2', type: 'expense', date: `${YEAR}-04-01`, amt: 250, cat: 'Rent', tab: 'yf', who: 'ABI' },
        ],
        planned: {}, start: { [YEAR]: 1000 }, cats: { exp: ['Rent'], inc: ['Paycheck'] },
      }),
    });
    await p.click('#viewSeg button[data-view="yearly"]');
    await p.waitForTimeout(350);
    const t = await p.evaluate(() => ({
      end: document.getElementById('yfEndVal').textContent.trim(),
      saved: document.getElementById('yfSaved').textContent.trim(),
      spend: yfActual('expense', null),
      amt: state.yf.txns.find(x => x.id === 'g1').amt,
    }));
    check(t.amt === 0, '10a: a row with no amt is zeroed, not left undefined', String(t.amt));
    /* ...and NOT dropped. It still has a date, a category and a description, so
       it is a record the user can correct; deleting their row to tidy a total
       would be the worse trade. */
    check(await p.evaluate(() => state.yf.txns.length) === 2,
      '10a: and the row is kept, so it can be corrected rather than lost');
    check(Number.isFinite(t.spend) && t.spend === 250,
      '10a: the year total counts the row it can read', String(t.spend));
    check(t.end === '$750' && !/NaN/.test(t.saved),
      '10a: End and Saved are real figures', JSON.stringify([t.end, t.saved]));
    check((await badCells(p, 'yearly')).length === 0,
      '10a: nothing on the Yearly tab renders NaN', JSON.stringify(await badCells(p, 'yearly')));
    /* The nine SVG attribute errors are the half that was visible in a console. */
    check(pe.length === 0, '10a: and the chart emits no NaN coordinates', pe.slice(0, 3).join(' | '));
    await c.close();
  }

  /* 10b. The same, one tab over: a deposit with no amount, and one with no
     account at all -- which no total can count, so it must at least stay
     visible and legible rather than printing the word "undefined". */
  {
    const { c, p, pe } = await bootWith({
      'sparta.contrib.cadFixed': 'true',
      'sparta.contrib.entries': JSON.stringify([
        { id: 'k1', acct: 'TFSA', amt: 3000, y: YEAR, who: 'ABI', cad: true },
        { id: 'k2', acct: 'TFSA', y: YEAR, who: 'ABI', cad: true },
        { id: 'k3', y: YEAR, who: 'ABI', cad: true, amt: 50 },
      ]),
    });
    await p.click('#viewSeg button[data-view="contrib"]');
    await p.waitForTimeout(350);
    check(await p.evaluate(y => contributed('TFSA', y), YEAR) === 3000,
      '10b: a deposit with no amount counts as nothing, not as NaN',
      String(await p.evaluate(y => contributed('TFSA', y), YEAR)));
    check((await badCells(p, 'contrib')).length === 0,
      '10b: and nothing on the Contributions tab renders NaN or "undefined"',
      JSON.stringify(await badCells(p, 'contrib')));
    check(pe.length === 0, '10b: no page errors', pe.slice(0, 3).join(' | '));
    await c.close();
  }

  /* 10c. migrateContribCAD multiplies by the rate and then sets cad:true and
     WRITES BACK, so a non-finite amount passing through it was locked in
     permanently rather than merely rendered badly. */
  {
    const { c, p } = await bootWith({
      'sparta.fx': '1.37',
      'sparta.contrib.entries': JSON.stringify([
        { id: 'm1', acct: 'TFSA', amt: 100, y: YEAR, who: 'ABI' },
        { id: 'm2', acct: 'TFSA', y: YEAR, who: 'ABI' },
      ]),
    });
    const amts = await p.evaluate(() => state.contribs.map(x => x.amt));
    check(amts.every(Number.isFinite), '10c: the one-time CAD migration cannot lock in a NaN',
      JSON.stringify(amts));
    await c.close();
  }

  /* 10d. A holding with no average cost makes invested() and marketVal() NaN,
     and the Dashboard hero then reads "C$NaN unrealized". A price is allowed to
     be ABSENT -- `h.price ?? h.avg` is the "no live quote yet" path -- but ??
     does not catch NaN, so a non-finite one has to be turned back into the
     absence it was standing in for. Cash is checked here too: cashInScope()
     adds all three buckets, so one bad bucket is the whole hero total. */
  {
    const { c, p, pe } = await bootWith({
      'sparta.dash.holdings': JSON.stringify([
        { id: 'd1', sym: 'NOAVG', acct: 'TFSA', qty: 5, ccy: 'USD', nat: true },
        { id: 'd2', sym: 'OK', acct: 'TFSA', qty: 2, avg: 10, price: 12, ccy: 'USD', nat: true },
      ]),
      'sparta.dash.cash': JSON.stringify({ TFSA: 'not a number', FHSA: 100, Other: 0 }),
    });
    const d = await p.evaluate(() => ({
      inv: invested(state.holdings), mkt: marketVal(state.holdings),
      cash: cashInScope(), avg: state.holdings.find(h => h.sym === 'NOAVG').avg,
      hero: (document.getElementById('totalVal') || {}).textContent || '',
    }));
    check(d.avg === 0, '10d: a holding with no average cost is zeroed', String(d.avg));
    check(Number.isFinite(d.inv) && Number.isFinite(d.mkt),
      '10d: invested() and marketVal() stay finite', JSON.stringify([d.inv, d.mkt]));
    check(d.cash === 100, '10d: a junk cash bucket counts as zero, not as NaN', String(d.cash));
    check((await badCells(p, 'dash')).length === 0,
      '10d: nothing on the Dashboard renders NaN', JSON.stringify(await badCells(p, 'dash')));
    check(pe.length === 0, '10d: no page errors', pe.slice(0, 3).join(' | '));
    await c.close();
  }

  /* 10e. A holding written before the native-currency migration has no `nat`,
     so migrateNative() repairs it and calls persist() -- while `state` is still
     being built, about two thousand lines above where the sync flags are
     declared. cloudSaveDebounced() reads fbApplying and fbUserEdited, both of
     which were `let`, so that was a temporal dead zone and every load threw
     "Cannot access 'fbApplying' before initialization".
     It stayed hidden because cloudSaveDebounced is `async`: the throw became an
     unhandled REJECTION rather than an exception, so the window error handler
     never fired, no toast appeared, and init carried on regardless. */
  {
    const { c, p, pe } = await bootWith({
      'sparta.dash.holdings': JSON.stringify([
        { id: 'L1', sym: 'AAPL', acct: 'TFSA', qty: 10, avg: 180.5, price: 212.4 },
      ]),
    });
    check(pe.length === 0,
      '10e: a holding predating the native-currency migration boots clean',
      pe.slice(0, 2).join(' | '));
    /* The migration must still have DONE its work -- a check that only looked
       for silence would pass against a build where it had been deleted. */
    const h = await p.evaluate(() => state.holdings[0]);
    check(h.nat === true && h.ccy === 'USD',
      '10e: and the migration it was running still ran', JSON.stringify(h));
    await c.close();
  }

  /* 10f. An Archives record only needs a `year` to be kept, which is
     deliberate. But the card reads six figures out of `stats`, and
     arc$(undefined) is "$NaN", so a truncated record painted $NaN six times
     across its own header. The rollover already guarded its own deref of
     prev.stats; this is the other reader of the same missing object, and it is
     the one on screen. */
  {
    const { c, p, pe } = await bootWith({
      'sparta.archives': JSON.stringify([{ year: YEAR - 1 }, { year: YEAR - 2, stats: {} }]),
    });
    await p.click('#viewSeg button[data-view="archive"]');
    await p.waitForTimeout(350);
    /* The card root is `.ay` -- `.arc-card` matches nothing here, and a click
       loop over an empty list would leave every card collapsed while the
       assertions below still passed (bug class 7). The six figures live in the
       card HEADER, so they render collapsed too; the card is expanded anyway so
       the body's figures are covered as well. */
    check(await p.evaluate(() => document.querySelectorAll('#arcList .ay').length) === 2,
      '10f: both truncated records are still kept and shown',
      String(await p.evaluate(() => document.querySelectorAll('#arcList .ay').length)));
    /* One at a time, re-querying in between: renderArchives() rebuilds the
       whole list on every toggle, so a forEach over one NodeList clicks a node
       that has already been replaced and only the first card ever opens. */
    for (const i of [0, 1]) {
      await p.evaluate(n => {
        const h = document.querySelectorAll('#arcList .ay .ay-head')[n];
        if (h) h.click();
      }, i);
      await p.waitForTimeout(350);
    }
    check(await p.evaluate(() => document.querySelectorAll('#arcList .ay.open').length) === 2,
      '10f: and both actually expanded, so the body is covered too',
      String(await p.evaluate(() => document.querySelectorAll('#arcList .ay.open').length)));
    check((await badCells(p, 'archive')).length === 0,
      '10f: and neither paints a NaN figure', JSON.stringify(await badCells(p, 'archive')));
    check(await p.evaluate(() => state.archives.every(a =>
      a.stats && ['start', 'end', 'invested', 'moved', 'saved', 'offPaper', 'growth']
        .every(k => Number.isFinite(a.stats[k])))),
      '10f: every stats field is a real number afterwards');
    check(pe.length === 0, '10f: no page errors', pe.slice(0, 3).join(' | '));
    await c.close();
  }

  /* 10g. The year was never guaranteed to be a NUMBER, and three lookups use
     `a.year===year` against a figure off the clock. A record carrying the
     string "2026" matched none of them, so + Add year believed there was no
     prior record for this year and pushed a second one -- one year, two cards,
     and the older of them is the one holding any hand corrections. */
  {
    const Y = new Date().getFullYear();
    const { c, p, pe } = await bootWith({
      'sparta.archives': JSON.stringify([
        { id: 'strYear', year: String(Y), sealed: false,
          stats: { start: 10, end: 20, invested: 0, moved: 0, saved: 10, offPaper: 10, growth: 100 },
          entries: 1, entriesYf: 1, entriesMe: 0 },
      ]),
    });
    check(await p.evaluate(() => typeof state.archives[0].year) === 'number',
      '10g: a string year is coerced to a number',
      await p.evaluate(() => typeof state.archives[0].year));
    await p.click('#viewSeg button[data-view="archive"]');
    await p.waitForTimeout(300);
    await p.evaluate(() => arcAddYear());
    await p.waitForTimeout(300);
    /* Compared with +a.year, NOT a.year===y. Strict equality counts only the
       NUMERIC-year records, so against the unfixed build it saw just the newly
       pushed one, reported 1, and passed while two records sat in the store --
       the duplicate it exists to catch was invisible to it. */
    const forY = await p.evaluate(y => state.archives.filter(a => +a.year === y).length, Y);
    check(forY === 1,
      '10g: + Add year REPLACES it rather than adding a second card for one year',
      'records for ' + Y + ': ' + forY);
    check(await p.evaluate(() => document.querySelectorAll('#arcList .ay').length) === 1,
      '10g: and only one card is on screen');
    check(pe.length === 0, '10g: no page errors', pe.slice(0, 3).join(' | '));
    await c.close();
  }

  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nSTORAGE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
