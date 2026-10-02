/* REGRESSION: load baseline and optimized with identical seeded state, then
   diff the rendered output of all five tabs plus every derived money figure.
   Any difference here means the optimization changed behaviour. */
const { serve, open, launch, normalize } = require('./lib');
const { APP, BASELINE } = require('./paths');
const fs = require('fs');
if (!fs.existsSync(BASELINE)) {
  console.error('Missing baseline snapshot at ' + BASELINE + '\n' +
    'Create one, e.g.:  git show HEAD~1:"Sparta Finance Tracker/Sparta ap stock tracker.html" > tests/baseline.html');
  process.exit(2);
}

const TABS = ['dash', 'contrib', 'yearly', 'monthly', 'archive'];
const VIEW = { dash: 'dashView', contrib: 'contribView', yearly: 'yearlyView', monthly: 'monthlyView', archive: 'archiveView' };

// Every element whose text is a computed money/derived value.
const PROBES = [
  'heroValue', 'heroPL', 'heroBreak', 'tfsaVal', 'tfsaCash', 'fhsaVal', 'fhsaCash',
  'otherVal', 'otherCash', 'cashT', 'cashF', 'cashO', 'lastUpd',
  'cTfsaAmt', 'cTfsaRoom', 'cFhsaAmt', 'cFhsaRoom', 'yrT', 'yrF', 'logScope',
  'yfStartVal', 'yfEndVal', 'yfInvested', 'yfMoved', 'yfSaved', 'yfOffPaper',
  'yfAvgInc', 'yfAvgExp', 'yfPct', 'yfSavedBig',
  'yfExpPlan', 'yfExpAct', 'yfIncPlan', 'yfIncAct',
  'meTotal', 'meCompare', 'meCount', 'meAvg', 'meTopCat', 'meTopAmt', 'meDaily', 'meDays',
  'meTrendYear', 'meMatrixYear', 'meRuleCount',
];

async function capture(browser, url) {
  const { ctx, page, errs } = await open(browser, url);
  const out = { tabs: {}, probes: {}, errs, state: null };

  for (const t of TABS) {
    await page.click(`#viewSeg button[data-view="${t}"]`);
    await page.waitForTimeout(120);
    out.tabs[t] = normalize(await page.innerHTML('#' + VIEW[t]));
    // body theme class + which selectors are locked
    out.tabs[t + ':chrome'] = await page.evaluate(() => JSON.stringify({
      body: [...document.body.classList].sort(),
      ccyLocked: document.getElementById('ccySeg').classList.contains('locked'),
      acctLocked: document.getElementById('acctSeg').classList.contains('locked'),
      ccy: document.querySelector('#ccySeg button.active')?.dataset.ccy,
      bars: ['yearBar', 'yfYearWrap', 'meMonthWrap']
        .map(id => id + '=' + document.getElementById(id).classList.contains('show')).join(','),
    }));
  }

  for (const id of PROBES) {
    out.probes[id] = await page.evaluate(i => {
      const e = document.getElementById(i); return e ? e.textContent.trim() : '<<missing>>';
    }, id);
  }

  // the whole in-memory state after boot, minus volatile bookkeeping
  out.state = await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(window.state || {}));
    delete s.updatedAt; delete s.bootStamp; delete s.apiKey;
    return JSON.stringify(s);
  });

  await ctx.close();
  return out;
}

(async () => {
  const [sa, sb] = [await serve(BASELINE), await serve(APP)];
  const ua = `http://127.0.0.1:${sa.address().port}/`;
  const ub = `http://127.0.0.1:${sb.address().port}/`;
  const browser = await launch();

  const A = await capture(browser, ua);
  const B = await capture(browser, ub);
  await browser.close(); sa.close(); sb.close();

  let pass = 0, fail = 0;
  const say = (ok, label, extra = '') => {
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra}`);
  };

  console.log('\n── Rendered markup, per tab ──');
  for (const t of TABS) {
    const ok = A.tabs[t] === B.tabs[t];
    let extra = '';
    if (!ok) {
      const a = A.tabs[t], b = B.tabs[t];
      let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
      extra = `\n        first diff @${i}:\n         base: ...${a.slice(Math.max(0, i - 60), i + 90)}\n         opt : ...${b.slice(Math.max(0, i - 60), i + 90)}`;
    }
    say(ok, `${t} view markup identical`, extra);
    say(A.tabs[t + ':chrome'] === B.tabs[t + ':chrome'], `${t} theme/lock state identical`,
      A.tabs[t + ':chrome'] === B.tabs[t + ':chrome'] ? '' : `\n        base: ${A.tabs[t + ':chrome']}\n        opt : ${B.tabs[t + ':chrome']}`);
  }

  console.log('\n── Derived money / summary values ──');
  let probeFails = 0;
  for (const id of PROBES) {
    if (A.probes[id] !== B.probes[id]) {
      probeFails++;
      console.log(`  FAIL  #${id}: base="${A.probes[id]}" opt="${B.probes[id]}"`);
    }
  }
  say(probeFails === 0, `all ${PROBES.length} derived values identical`,
    probeFails ? ` (${probeFails} differ)` : '');

  console.log('\n── Post-boot application state ──');
  say(A.state === B.state, 'state object identical after boot');

  console.log('\n── Runtime errors ──');
  // The baseline is EXPECTED to log a blocked file:///C: image request; removing
  // that hardcoded path is one of the fixes, so we assert the improvement.
  const baseFileErr = A.errs.filter(e => /file:\/\/\/C:/.test(e));
  const baseOther = A.errs.filter(e => !/file:\/\/\/C:/.test(e));
  say(baseFileErr.length > 0, 'baseline logs the blocked file:///C: request (the bug being fixed)',
    `(${baseFileErr.length})`);
  say(baseOther.length === 0, 'baseline has no OTHER page errors',
    baseOther.length ? ' ' + JSON.stringify(baseOther.slice(0, 3)) : '');
  say(B.errs.length === 0, 'optimized: zero page errors',
    B.errs.length ? ' ' + JSON.stringify(B.errs.slice(0, 3)) : '');

  console.log(`\nREGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
