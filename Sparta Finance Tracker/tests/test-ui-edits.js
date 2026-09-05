/* Smoke test for today's UI edits: header restructure, ABI/POO rename,
   badge colors, filter active-state colors. */
const { serve, stub, launch } = require('./lib');
const { APP } = require('./paths');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

async function open(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return { ctx, page, errs };
}

(async () => {
  const srv = await serve(APP);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const { ctx, page, errs } = await open(browser, url);
  const go = async v => { await page.click(`#viewSeg button[data-view="${v}"]`); await page.waitForTimeout(150); };

  console.log('\n── ccySeg/acctSeg: Dashboard-only ──');
  await go('dash');
  check(await page.evaluate(() => getComputedStyle(document.getElementById('ccySeg')).display) !== 'none',
    'ccySeg visible on Dashboard');
  check(await page.evaluate(() => getComputedStyle(document.getElementById('acctSeg')).display) !== 'none',
    'acctSeg visible on Dashboard');

  for (const tab of ['contrib', 'yearly', 'monthly', 'archive']) {
    await go(tab);
    const d = await page.evaluate(() => ({
      ccy: getComputedStyle(document.getElementById('ccySeg')).display,
      acct: getComputedStyle(document.getElementById('acctSeg')).display,
    }));
    check(d.ccy === 'none' && d.acct === 'none', `${tab}: ccySeg+acctSeg hidden`, JSON.stringify(d));
  }

  console.log('\n── who-filter: correct one shown per tab, in the header ──');
  const WHOMAP = { contrib: 'cWhoSeg', yearly: 'yfWhoSeg', monthly: 'meWhoSeg' };
  for (const tab of ['contrib', 'yearly', 'monthly']) {
    await go(tab);
    const state = await page.evaluate(ids => {
      const r = {};
      for (const id of ids) r[id] = getComputedStyle(document.getElementById(id)).display;
      return r;
    }, Object.values(WHOMAP));
    const mine = WHOMAP[tab];
    const othersHidden = Object.entries(state).filter(([id]) => id !== mine).every(([, d]) => d === 'none');
    check(state[mine] !== 'none', `${tab}: ${mine} visible`, JSON.stringify(state));
    check(othersHidden, `${tab}: other two who-filters hidden`, JSON.stringify(state));
    const inHeader = await page.evaluate(id =>
      !!document.querySelector('.topctl #' + id), mine);
    check(inHeader, `${tab}: ${mine} physically lives inside .topctl (header)`);
  }
  await go('dash');
  const dashHidden = await page.evaluate(ids => ids.every(id => getComputedStyle(document.getElementById(id)).display === 'none'), Object.values(WHOMAP));
  check(dashHidden, 'dash: all 3 who-filters hidden');
  await go('archive');
  const archHidden = await page.evaluate(ids => ids.every(id => getComputedStyle(document.getElementById(id)).display === 'none'), Object.values(WHOMAP));
  check(archHidden, 'archive: all 3 who-filters hidden');

  console.log('\n── ABI/POO rename + colored active states ──');
  await go('contrib');
  const btnTexts = await page.evaluate(() =>
    [...document.querySelectorAll('#cWhoSeg button')].map(b => b.textContent.trim()));
  check(JSON.stringify(btnTexts) === JSON.stringify(['All', 'ABI', 'POO']), 'cWhoSeg buttons read All/ABI/POO', JSON.stringify(btnTexts));

  await page.click('#cWhoSeg button[data-who="ABI"]');
  await page.waitForTimeout(120);
  const abiColor = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#cWhoSeg button[data-who="ABI"]')).backgroundImage);
  check(abiColor.includes('gradient'), 'ABI active button has a gradient background (teal)', abiColor.slice(0, 60));

  await page.click('#cWhoSeg button[data-who="POO"]');
  await page.waitForTimeout(120);
  const pooColor = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#cWhoSeg button[data-who="POO"]')).backgroundImage);
  check(pooColor.includes('gradient') && pooColor !== abiColor, 'POO active button has a DIFFERENT gradient (violet)', pooColor.slice(0, 60));

  console.log('\n── Who column badges: colored pills, correct class per value ──');
  await page.evaluate(() => {
    state.contribs.push({ id: 'x1', t: Date.now(), y: new Date().getFullYear(), acct: 'TFSA', amt: 100, cad: true, who: 'ABI' });
    state.contribs.push({ id: 'x2', t: Date.now(), y: new Date().getFullYear(), acct: 'TFSA', amt: 50, cad: true, who: 'POO' });
    render();
  });
  await page.click('#cWhoSeg button[data-who="ALL"]');
  await page.waitForTimeout(150);
  await page.click('#logToggle');
  await page.waitForTimeout(150);
  const badgeClasses = await page.evaluate(() =>
    [...document.querySelectorAll('#cbody tr')].map(tr => {
      const spans = tr.querySelectorAll('.acct-tag');
      return spans.length >= 2 ? spans[1].className : null;
    }).filter(Boolean));
  check(badgeClasses.some(c => c.includes('tag-tfsa')), 'at least one ABI row uses tag-tfsa (teal)', JSON.stringify(badgeClasses));
  check(badgeClasses.some(c => c.includes('tag-fhsa')), 'at least one POO row uses tag-fhsa (violet)', JSON.stringify(badgeClasses));

  console.log('\n── Contributor + Description paired on one line ──');
  await go('yearly');
  const yfPair = await page.evaluate(() => {
    const who = document.getElementById('yfWho').closest('div');
    const desc = document.getElementById('yfDesc').closest('div');
    return who.getBoundingClientRect().top === desc.getBoundingClientRect().top;
  });
  check(yfPair, 'Yearly Finance: Contributor + Description same row (same top offset)');

  // Monthly's form was later reorganised into three rows on request:
  //   ADD EXPENSE | Month  /  Amount | Allot to  /  Description | Category  /  button | Contributor
  // so Description now pairs with Category, and Contributor with the button.
  await go('monthly');
  const meRows = await page.evaluate(() => {
    const top = id => Math.round(document.getElementById(id).closest('div').getBoundingClientRect().top);
    return {
      amt: top('meAmt'), allot: top('meAllot'),
      desc: top('meDesc'), cat: top('meCat'),
      who: top('meWho'),
      whoBottom: Math.round(document.getElementById('meWho').closest('div').getBoundingClientRect().bottom),
      // compare grid CELLS: the button's cell has no label and is bottom-aligned,
      // so the button element itself starts lower than the Contributor input's cell
      save: Math.round(document.getElementById('meSave').closest('div.duo').getBoundingClientRect().top),
      month: Math.round(document.getElementById('meFormMonth').getBoundingClientRect().top),
      heading: Math.round(document.getElementById('meFormTitle').getBoundingClientRect().top),
    };
  });
  check(meRows.amt === meRows.allot, 'Monthly form row 1: Amount + Allot to', JSON.stringify(meRows));
  check(meRows.desc === meRows.cat, 'Monthly form row 2: Description + Category');
  // align-self:end shrinks the button's cell to the bottom of its row track, so
  // its top sits below the Contributor cell's; what matters is that it sits
  // inside that row's vertical band
  check(meRows.save >= meRows.who && meRows.save <= meRows.whoBottom,
    'Monthly form row 3: button + Contributor',
    `save-cell ${meRows.save} within ${meRows.who}..${meRows.whoBottom}`);
  check(Math.abs(meRows.month - meRows.heading) < 20, 'Month sits on the heading line',
    `month ${meRows.month} vs heading ${meRows.heading}`);
  check(meRows.amt > meRows.heading && meRows.desc > meRows.amt && meRows.who > meRows.desc,
    'and the three rows run in order under the heading');

  check(errs.length === 0, 'no page errors across the whole run', errs.length ? JSON.stringify(errs.slice(0, 5)) : '');

  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nUI EDITS SMOKE TEST: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
