/* ASK: the question panel in Yearly's reserved slot.

   The rule this suite exists to defend: the panel never computes money of its
   own. Every figure comes back from the primitives the tab is drawn from, so
   the headline and the table beside it cannot disagree. Each check below
   recomputes the expected number INDEPENDENTLY from the fixture rather than
   asking the engine twice -- a test that calls yfAsk to decide what yfAsk
   should say would pass on any arithmetic at all.

   The fixture (tests/lib.js SEED) holds nine Yearly rows across Jan-Mar 2026:
   $9,300 in, $3,668.04 out, an $8,000 opening balance, and two rent rows that
   TIE at $1,450 -- which is why the biggest-single-expense answer has to say
   so rather than silently pick one. */
const { serve, stub, launch, open, SEED } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const section = t => console.log(`\n── ${t} ──`);
const digits = s => String(s).replace(/[^0-9]/g, '');

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const O = await open(browser, url, SEED);
  await O.page.evaluate(() => applyView('yearly'));
  await O.page.waitForTimeout(400);

  /* ── 1. every intent answers, and answers the question asked ──────────── */
  section('1. each intent returns the figure the ledger holds');
  const got = await O.page.evaluate(() => {
    const ask = q => { const r = yfAsk(q); return { ok: r.ok, head: r.head, line: r.line,
      src: r.src, intent: r.intent, reason: r.reason } };
    return {
      spend:   ask('what did I spend this year'),
      earn:    ask('what did I earn'),
      saved:   ask('what have I saved'),
      balance: ask('what is my balance'),
      cat:     ask('what did I spend on Grocery'),
      top:     ask('top categories'),
      single:  ask('biggest single expense'),
      month:   ask('which month was dearest'),
      budget:  ask('am I over budget'),
      over:    ask('anything over $1000'),
      refund:  ask('any refunds'),
      who:     ask('split between us'),
      project: ask('at this rate what do I end the year with'),
      count:   ask('how many transactions'),
      march:   ask('what did I spend in march'),
    };
  });

  // independently recomputed from the fixture, not from the app
  const yf = JSON.parse(SEED['sparta.yf.data']);
  const rows = yf.txns;
  const inc = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amt, 0);
  const exp = rows.filter(t => t.type !== 'income').reduce((s, t) => s + t.amt, 0);
  const start = yf.start['2026'];

  check(got.spend.ok && digits(got.spend.head) === String(Math.round(exp)),
    '1: spend is the ledger total', `${got.spend.head} vs ${Math.round(exp)}`);
  check(got.earn.ok && digits(got.earn.head) === String(Math.round(inc)),
    '1: earn is the ledger total', `${got.earn.head} vs ${Math.round(inc)}`);
  check(got.saved.ok && digits(got.saved.head) === String(Math.round(inc - exp)),
    '1: saved is income less spend', `${got.saved.head} vs ${Math.round(inc - exp)}`);
  check(got.balance.ok && digits(got.balance.head) === String(Math.round(start + inc - exp)),
    '1: balance adds the opening balance', `${got.balance.head} vs ${Math.round(start + inc - exp)}`);
  const groc = rows.filter(t => t.cat === 'Grocery').reduce((s, t) => s + t.amt, 0);
  check(got.cat.ok && digits(got.cat.head) === String(Math.round(groc)),
    '1: a category question answers for THAT category, not the year',
    `${got.cat.head} vs ${Math.round(groc)}`);
  check(got.top.ok && /Home/.test(got.top.head),
    '1: top categories leads with the largest', got.top.head);
  check(got.month.ok && /JAN/.test(got.month.head) && /MAR/.test(got.month.line),
    '1: dearest and leanest months are both named', `${got.month.head} / ${got.month.line}`);
  check(got.count.ok && got.count.head === String(rows.length),
    '1: the entry count matches the ledger', `${got.count.head} vs ${rows.length}`);
  const mar = rows.filter(t => t.type !== 'income' && t.date.slice(5, 7) === '03')
    .reduce((s, t) => s + t.amt, 0);
  check(got.march.ok && digits(got.march.head) === String(Math.round(mar)),
    '1: a named month narrows the window', `${got.march.head} vs ${Math.round(mar)}`);

  /* ── 2. the tie, which is the reason this answer is not a single row ──── */
  section('2. a tie is reported as a tie');
  const tied = rows.filter(t => t.type !== 'income' && t.amt === 1450).length;
  check(tied === 2, '2: PRECONDITION -- the fixture really has two rows at the same amount',
    String(tied));
  check(got.single.ok && digits(got.single.head) === '145000',
    '2: the biggest single expense is the largest row', got.single.head);
  check(got.single.ok && /tie/.test(got.single.line),
    '2: ...and the answer says two entries tie rather than picking one silently',
    got.single.line);

  /* ── 3. every answer names the view it was computed from ──────────────── */
  section('3. provenance, because Yearly and Monthly count different things');
  const answered = Object.values(got).filter(r => r.ok);
  check(answered.length >= 12, '3: PRECONDITION -- most intents answered on this fixture',
    `${answered.length} of ${Object.keys(got).length}`);
  check(answered.every(r => /Yearly|Monthly/.test(r.src || '')),
    '3: every answer carries a source label',
    JSON.stringify([...new Set(answered.map(r => r.src))]));

  /* ── 4. the guards: no data is said, never printed as $0 ──────────────── */
  section('4. an empty period is reported, not answered with zero');
  const empty = await O.page.evaluate(() => {
    const keep = state.yf.txns;
    state.yf.txns = [];
    const r = yfAsk('what did I spend this year');
    const b = yfAsk('biggest single expense');
    state.yf.txns = keep;
    return { r, b };
  });
  check(empty.r.ok === false && empty.r.reason === 'nodata',
    '4: a year with no rows reports no data rather than $0', JSON.stringify(empty.r));
  check(empty.b.ok === false,
    '4: ...and so does the biggest-expense question', JSON.stringify(empty.b.reason));
  const unknown = await O.page.evaluate(() => yfAsk('what is the weather'));
  check(unknown.ok === false && unknown.reason === 'nomatch',
    '4: a question it cannot answer says so instead of guessing', JSON.stringify(unknown));

  /* ── 5. ordering: specific intents beat general ones ──────────────────── */
  section('5. intent precedence');
  check(got.single.intent === 'single',
    '5: "biggest single expense" is not swallowed by the word "expense"', got.single.intent);
  check(got.project.intent === 'project',
    '5: "at this rate ... end the year" is not answered as the balance', got.project.intent);
  check(got.cat.intent === 'cat',
    '5: "spend on Grocery" is the category question, not the year total', got.cat.intent);
  check(got.over.intent === 'over',
    '5: "over $1000" is the threshold question, not the budget one', got.over.intent);
  const falseCat = await O.page.evaluate(() => yfAsk('what did I spend on nonsense'));
  check(falseCat.ok === true && falseCat.intent === 'spend',
    '5: a category name that does not exist falls THROUGH to the year total, not to no-data',
    JSON.stringify({ ok: falseCat.ok, intent: falseCat.intent }));

  /* ── 6. the year a question names is the year it is answered for ──────── */
  section('6. a question naming another year uses that year');
  const otherYr = await O.page.evaluate(() => {
    /* yfPlanned() reads the global state.yfYear, so the budget intent had to
       stop using it. Pin that: a 2025 plan must not be answered from 2026's. */
    state.yf.planned['2025'] = { Food: 1 };
    state.yf.txns.push({ id: 'y25', type: 'expense', date: '2025-06-01', amt: 900,
      desc: 'Old', cat: 'Food', who: 'ABI', tab: 'yf' });
    const r = yfAsk('what did I spend in 2025');
    const b = yfAsk('am I over budget in 2025');
    state.yf.txns = state.yf.txns.filter(t => t.id !== 'y25');
    delete state.yf.planned['2025'];
    return { r, b, viewing: state.yfYear };
  });
  check(otherYr.viewing === 2026,
    '6: PRECONDITION -- the tab is still showing 2026', String(otherYr.viewing));
  check(otherYr.r.ok && digits(otherYr.r.head) === '900',
    '6: the 2025 figure comes from 2025 rows', otherYr.r.head);
  check(otherYr.b.ok && /Food/.test(otherYr.b.line || ''),
    '6: and the budget answer uses the plan of the year ASKED about, not the year on screen',
    `${otherYr.b.head} ${otherYr.b.line}`);

  /* ── 7. the panel, the chips and the dialog ───────────────────────────── */
  section('7. the panel and its help dialog');
  const ui = await O.page.evaluate(async () => {
    const chips = [...document.querySelectorAll('[data-ask]')];
    chips[0].click();
    await new Promise(r => setTimeout(r, 80));
    const out = document.getElementById('askOut');
    const trigger = document.querySelector('.sec-i[data-dialog]');
    trigger.focus(); trigger.click();
    await new Promise(r => setTimeout(r, 120));
    return { chips: chips.length, first: chips[0].textContent,
      head: out.querySelector('.ask-head') ? out.querySelector('.ask-head').textContent : '',
      src: out.querySelector('.ask-src') ? out.querySelector('.ask-src').textContent : '',
      live: out.getAttribute('aria-live'),
      open: document.getElementById('askHelpModal').classList.contains('open'),
      expanded: trigger.getAttribute('aria-expanded'),
      focusIn: document.activeElement && document.activeElement.id };
  });
  check(ui.chips >= 8, '7: the chip row is populated', `${ui.chips} chips`);
  check(/spend/i.test(ui.first),
    '7: the most-asked question leads, not whichever intent matches last', ui.first);
  check(/\$/.test(ui.head) && /YEARLY/i.test(ui.src),
    '7: pressing a chip renders a figure and its source', `${ui.head} / ${ui.src}`);
  check(ui.live === 'polite', '7: the answer is announced to a screen reader', String(ui.live));
  check(ui.open === true && ui.expanded === 'true',
    '7: the i button opens the help dialog and says so', JSON.stringify(ui));
  check(ui.focusIn === 'askHelpClose', '7: focus moves into the dialog', String(ui.focusIn));

  await O.page.keyboard.press('Escape');
  await O.page.waitForTimeout(140);
  const closed = await O.page.evaluate(() => ({
    open: document.getElementById('askHelpModal').classList.contains('open'),
    expanded: document.querySelector('.sec-i[data-dialog]').getAttribute('aria-expanded'),
    back: document.activeElement && document.activeElement.className }));
  check(closed.open === false && closed.expanded === 'false',
    '7: Escape closes it -- a dialog that ignores Escape is a trap', JSON.stringify(closed));
  check(/sec-i/.test(closed.back || ''),
    '7: ...and focus goes back to the button that opened it', String(closed.back));

  /* The drawer's six info buttons were wired to a listener bound to #drawer,
     so this one would have rendered and done nothing. Both must work now. */
  const drawerHelp = await O.page.evaluate(async () => {
    document.getElementById('settingsBtn').click();
    await new Promise(r => setTimeout(r, 260));
    const b = document.querySelector('#drawer .sec-i[data-help]');
    const p = document.getElementById(b.dataset.help);
    const before = p.hidden; b.click();
    return { toggled: p.hidden !== before, expanded: b.getAttribute('aria-expanded') };
  });
  check(drawerHelp.toggled && drawerHelp.expanded === 'true',
    "7: the drawer's own info buttons still work after the listener moved to the document",
    JSON.stringify(drawerHelp));

  check(O.errs.length === 0, 'no page errors', O.errs.join(' | '));
  await O.ctx.close();
  await browser.close(); srv.close();
  console.log(`\nASK: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
