/* Bill Payment + per-bill allotment.

   Two changes that belong together, because both are about one bill being one
   bill:

   1. `allot` holds the ID of the Yearly expense a Monthly line itemises into,
      not its category name. A name merged every bill sharing it in a month into
      one pool: a $1,000 Amex and a $500 PC card both reported the pair's
      combined figure against their own amount.

   2. A payment on a card statement is kept as a Bill Payment row instead of
      being dropped. August's balance of $750 is $1,250 of purchases less the
      $500 that cleared July, so dropping the payment left the bill reading $500
      over-itemised. The row is negative, files against the bill like any other
      line, and is left out of every chart, the month total and the category
      filter -- the only place it appears is this month's list, merged into one
      line pinned under its bill.                                            */
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
  await page.click('#viewSeg button[data-view="monthly"]');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    // the note as a person reads it, stripped of markup
    window.spendOf = id => {
      const t = (state.yf.txns || []).find(x => x.id === id);
      return t ? yfSpendNote(t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
    };
    window.paidOf = id => {
      const t = (state.yf.txns || []).find(x => x.id === id);
      return t ? yfPaidNote(t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
    };
    window.load = txns => {
      state.yf.txns = txns;
      txns.forEach(t => { if (t.type === 'expense' && t.cat && t.tab !== 'me'
        && !state.yf.cats.exp.includes(t.cat)) state.yf.cats.exp.push(t.cat); });
      renderYF(); renderME();
    };
  });

  /* ── 1. two bills, one category, one month ───────────────────────────────
     The screenshot that started this: a $1,000 Amex and a $500 PC card, both
     filed under Credit Bill in July, each reporting the pair's combined total against
     its own amount because the pool was keyed by the name they shared. */
  section('1. two bills sharing a category keep separate books');
  const split = await page.evaluate(([y]) => {
    load([
      { id: 'amex', type: 'expense', date: `${y}-07-19`, amt: 1000, desc: 'Credit Amex', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'pc',   type: 'expense', date: `${y}-07-19`, amt: 500,  desc: 'Credit July PC', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'a1', type: 'expense', date: `${y}-07-04`, amt: 700, desc: 'Loblaws', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'amex', allotM: `${y}-07` },
      { id: 'a2', type: 'expense', date: `${y}-07-06`, amt: 305, desc: 'Presto',  cat: 'Transit',   who: 'ABI', tab: 'me', allot: 'amex', allotM: `${y}-07` },
      { id: 'p1', type: 'expense', date: `${y}-07-08`, amt: 200, desc: 'Fido',    cat: 'TV/Phone/Internet', who: 'ABI', tab: 'me', allot: 'pc', allotM: `${y}-07` },
    ]);
    return { amex: spendOf('amex'), pc: spendOf('pc') };
  }, [YEAR]);
  check(/^\$1,005 Spend$/.test(split.amex),
    'the $1,000 Amex reports only what was filed against IT', split.amex);
  check(/^\$200 Spend$/.test(split.pc),
    'and the $500 PC card reports only its own', split.pc);
  check(split.amex !== split.pc,
    'the two no longer read the same figure against different amounts');

  section('2. "Allot to" lists each expense, not one merged category');
  const opts = await page.evaluate(([y]) => {
    meMonth = `${y}-07`; renderME();
    const sel = document.getElementById('meImpAllot');
    return { text: [...sel.options].map(o => o.textContent),
             vals: [...sel.options].map(o => o.value),
             bills: yfBillsIn(`${y}-07`).map(b => b.label + '|' + b.amt) };
  }, [YEAR]);
  check(opts.text.some(o => /Credit Amex/.test(o)) && opts.text.some(o => /Credit July PC/.test(o)),
    'both July cards are on the list, named by their description',
    JSON.stringify(opts.text));
  check(/1,000/.test(opts.text.join(' ')) && /500/.test(opts.text.join(' ')),
    'each carries its own amount', JSON.stringify(opts.text));
  check(opts.vals.includes('amex') && opts.vals.includes('pc'),
    'and the value is the bill row itself', JSON.stringify(opts.vals));

  section('3. legacy rows keyed by name are repointed');
  const mig = await page.evaluate(([y]) => {
    // one month, two bills under one name: nothing records which was meant, so
    // the larger takes them and either can be re-pointed by editing the row
    state.yf.txns = [
      { id: 'big',   type: 'expense', date: `${y}-07-19`, amt: 1000, desc: 'Big',   cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'small', type: 'expense', date: `${y}-07-19`, amt: 500,  desc: 'Small', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'old', type: 'expense', date: `${y}-07-04`, amt: 90, desc: 'legacy', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'Credit Bill', allotM: `${y}-07` },
      { id: 'gone', type: 'expense', date: `${y}-09-04`, amt: 20, desc: 'orphan', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'No Such Bill', allotM: `${y}-09` },
    ];
    normalizeYF();
    const g = state.yf.txns.find(t => t.id === 'gone');
    return { old: state.yf.txns.find(t => t.id === 'old').allot, orphan: g.allot || null,
             again: (normalizeYF(), state.yf.txns.find(t => t.id === 'old').allot) };
  }, [YEAR]);
  check(mig.old === 'big', 'a name-keyed allot lands on the larger bill of that month', String(mig.old));
  check(mig.orphan === null,
    'one naming a bill that does not exist is detached, not left in no total at all',
    String(mig.orphan));
  check(mig.again === 'big', 'and a second pass leaves it alone — the migration is idempotent');

  section('4. renaming the category cannot break the link');
  const ren = await page.evaluate(([y]) => {
    load([
      { id: 'b', type: 'expense', date: `${y}-07-19`, amt: 900, desc: 'Card', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
      { id: 'a', type: 'expense', date: `${y}-07-06`, amt: 200, desc: 'Shop', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'b', allotM: `${y}-07` }]);
    state.yfYear = y; renderYF();
    window.prompt = () => 'Card Bill';
    yfRenameCat('expense', 'Credit Bill'); renderYF();
    return { allot: state.yf.txns.find(t => t.id === 'a').allot, note: spendOf('b') };
  }, [YEAR]);
  check(ren.allot === 'b', 'the allocation still points at the same row', String(ren.allot));
  check(/^\$200 Spend$/.test(ren.note), 'and the bill still reports it', ren.note);

  /* ── 5. the scenario this was built for ──────────────────────────────────
     July's bill is 500, August's is 750. August's statement lists 1,250 of
     purchases and the 500 that cleared July. 1,250 − 500 = 750, so the bill the
     user typed off the PDF reconciles exactly. */
  section('5. July 500, August 750: the payment makes the statement reconcile');
  const rec = await page.evaluate(([y]) => {
    window.SEED5 = y => ([
      { id: 'jul', type: 'expense', date: `${y}-07-19`, amt: 500, desc: 'July card', cat: 'Credit Bill', who: 'POO', tab: 'yf' },
      { id: 'aug', type: 'expense', date: `${y}-08-19`, amt: 750, desc: 'Aug card',  cat: 'Credit Bill', who: 'POO', tab: 'yf' },
      { id: 'c1', type: 'expense', date: `${y}-08-03`, amt: 800, desc: 'Costco', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` },
      { id: 'c2', type: 'expense', date: `${y}-08-11`, amt: 450, desc: 'Ikea',   cat: 'Shopping',  who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` },
      { id: 'pay', type: 'expense', date: `${y}-08-02`, amt: -500, desc: 'PAYMENT THANK YOU', cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` },
    ]);
    load(SEED5(y));
    const aug = state.yf.txns.find(t => t.id === 'aug');
    return { note: spendOf('aug'), paid: paidOf('aug'), amt: aug.amt,
             spend: yfBillSpend(aug), paidN: yfBillPaid(aug),
             over: yfAttachAllot('aug'), julNote: spendOf('jul'), julPaid: paidOf('jul') };
  }, [YEAR]);
  check(/^\$1,250 Spend$/.test(rec.note),
    'August reports the $1,250 charged to it, under the amount', rec.note);
  check(/^\$500 Bill Paid$/.test(rec.paid),
    'and the $500 that cleared July, under the description', rec.paid);
  check(rec.spend - rec.paidN === rec.amt,
    'the two together still account for the bill: 1,250 - 500 = the 750 off the PDF',
    JSON.stringify([rec.spend, rec.paidN, rec.amt]));
  check(rec.over === 0, 'nothing is flagged as over-allotted', String(rec.over));
  check(rec.julNote === '' && rec.julPaid === '',
    "July's bill is untouched by any of it", JSON.stringify([rec.julNote, rec.julPaid]));

  /* The reported figure used to be the two netted together, and it bailed out
     when that net came to zero or less -- so $1,449 cleared against a $791 bill
     with only $1,200 of charges found reported NOTHING, which reads as
     reconciled. Splitting the two facts removes the failure by construction:
     each note answers for its own rows and neither can cancel the other. */
  section('5b. neither note can be cancelled out by the other');
  const short = await page.evaluate(([y]) => {
    const mk = (charges, paid, amt) => {
      load([
        { id: 'amex', type: 'expense', date: `${y}-07-19`, amt, desc: 'Amex Blue', cat: 'Credit Bill', who: 'ABI', tab: 'yf' },
        { id: 'c', type: 'expense', date: `${y}-07-05`, amt: charges, desc: 'Charges', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'amex', allotM: `${y}-07` },
        { id: 'p', type: 'expense', date: `${y}-07-02`, amt: -paid, desc: 'PAYMENT', cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: 'amex', allotM: `${y}-07` }]);
      return { note: spendOf('amex'), paid: paidOf('amex') };
    };
    const bare = (() => {
      load([{ id: 'amex', type: 'expense', date: `${y}-07-19`, amt: 791.34, desc: 'Amex Blue', cat: 'Credit Bill', who: 'ABI', tab: 'yf' }]);
      return spendOf('amex');
    })();
    const out = { under: mk(1200, 1449, 791.34), zero: mk(1449, 1449, 791.34),
                  exact: mk(2240.34, 1449, 791.34), bare };
    // put section 5's ledger back: the sections after this one build on it
    load(SEED5(y));
    return out;
  }, [YEAR]);
  check(/^\$1,200 Spend$/.test(short.under.note) && /^\$1,449 Bill Paid$/.test(short.under.paid),
    'cleared by more than was charged: both figures still shown, neither netted away',
    JSON.stringify([short.under.note, short.under.paid]));
  check(/^\$1,449 Spend$/.test(short.zero.note) && /^\$1,449 Bill Paid$/.test(short.zero.paid),
    'charges equal to the payments read as themselves, not as silence',
    JSON.stringify([short.zero.note, short.zero.paid]));
  check(/^\$2,240 Spend$/.test(short.exact.note) && /^\$1,449 Bill Paid$/.test(short.exact.paid),
    'and the reconciling case reads the same way — no special case anywhere',
    JSON.stringify([short.exact.note, short.exact.paid]));
  check(short.bare === '',
    'a bill with nothing filed against it still reports nothing at all', short.bare);

  section('6. the payment shows in the list and nowhere else');
  const hidden = await page.evaluate(([y]) => {
    meMonth = `${y}-08`; renderME();
    const bars = [...document.querySelectorAll('#meBars .me-bar-name')].map(b => b.title);
    const trend = Object.keys(meMonthlyByCat(String(y)));
    const filter = [...document.getElementById('meTxCat').options].map(o => o.textContent);
    const matrix = [...document.querySelectorAll('#meMatrix td')].map(td => td.textContent);
    return { bars, trend, filter, matrix, chartable: meChartableCats(y),
             total: document.getElementById('meTotal').textContent };
  }, [YEAR]);
  check(!hidden.bars.includes('Bill Payment'), 'no bar in the top graph', JSON.stringify(hidden.bars));
  check(!hidden.trend.includes('Bill Payment'), 'no line in the 12-month trend', JSON.stringify(hidden.trend));
  check(!hidden.chartable.includes('Bill Payment'), 'not offered as a trend filter');
  check(!hidden.filter.some(o => /Bill Payment/.test(o)),
    'not offered in the table category filter', JSON.stringify(hidden.filter));
  check(!hidden.matrix.some(t => /Bill Payment/.test(t)), 'no row in Category by month');
  /* The bill is the money that left the bank; its purchases are the breakdown of
     that same money, and the payment is a balance being cleared. Only the bill
     counts, and it would count whether or not a payment had been imported. */
  check(hidden.total === '$750.00',
    'the month total is the bill itself, unmoved by either', hidden.total);

  section('7. the payment line is merged and pinned under its bill');
  const list = await page.evaluate(([y]) => {
    state.yf.txns.push(
      { id: 'pay2', type: 'expense', date: `${y}-08-06`, amt: -150, desc: 'AUTOPAY', cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` });
    renderME();
    const rows = [...document.querySelectorAll('#meBody tr')].map(tr => ({
      cls: tr.className, date: tr.children[0].textContent.trim(),
      desc: tr.children[1].textContent.trim(), amt: tr.children[2].textContent.trim(),
      cat: tr.children[3].textContent.trim(), who: tr.children[4].textContent.trim() }));
    return { rows, billAt: rows.findIndex(r => /Aug card/.test(r.desc)),
             payAt: rows.findIndex(r => r.cls === 'me-payrow') };
  }, [YEAR]);
  const pay = list.rows[list.payAt] || {};
  check(list.rows.filter(r => r.cls === 'me-payrow').length === 1,
    'two payment rows draw as ONE line', JSON.stringify(list.rows.map(r => r.desc)));
  check(list.payAt === list.billAt + 1, 'sitting directly under the bill it clears',
    JSON.stringify([list.billAt, list.payAt]));
  check(/Previous Month Bill/.test(pay.desc) && /×2/.test(pay.desc),
    'described as the previous bill, counted', pay.desc);
  check(pay.amt === '-$650.00', 'summed to what was cleared', pay.amt);
  check(/Bill Payment/.test(pay.cat), 'under the Bill Payment category', pay.cat);
  check(pay.who === 'POO', 'and attributed to whoever the BILL belongs to', pay.who);
  check(/^${YEAR}-08-02$/.test(pay.date) || pay.date === `${YEAR}-08-02`,
    'dated the earliest of them', pay.date);

  section('8. expanding the line reaches the real rows');
  const open = await page.evaluate(() => {
    document.querySelector('[data-mepay]').click();
    const rows = [...document.querySelectorAll('#meBody tr')];
    return { kids: rows.filter(r => r.className === 'me-paykid').length,
             editable: rows.filter(r => r.className === 'me-paykid')
               .every(r => r.querySelector('[data-meedit]') && r.querySelector('[data-medel]')),
             ledger: (state.yf.txns || []).filter(t => t.cat === 'Bill Payment').length };
  });
  check(open.kids === 2, 'both payments are there behind it', String(open.kids));
  check(open.editable, 'each still editable and deletable');
  check(open.ledger === 2, 'and the ledger kept both rows all along — only the display merged');

  section('9. Bill Payment is last on the pickers, and never invented');
  const cats = await page.evaluate(() => ({
    all: meAllCats(), last: meAllCats()[meAllCats().length - 1],
    spend: ME_CATS.includes('Bill Payment') }));
  check(cats.last === 'Bill Payment', 'pinned to the bottom of the list', cats.last);
  check(!cats.spend, 'and kept out of the spending categories themselves');
  check(cats.all.slice(0, -1).every((c, i, a) => i === 0 || a[i - 1].localeCompare(c) <= 0),
    'the rest stay A to Z', JSON.stringify(cats.all));

  section('10. Add Expense: a payment needs a bill, and is stored negative');
  const add = await page.evaluate(([y]) => {
    load([{ id: 'aug', type: 'expense', date: `${y}-08-19`, amt: 750, desc: 'Aug card', cat: 'Credit Bill', who: 'ABI', tab: 'yf' }]);
    meMonth = `${y}-08`; renderME();
    const set = (a, c, amt) => {
      document.getElementById('meAmt').value = String(amt);
      document.getElementById('meDesc').value = 'Cleared it';
      document.getElementById('meAllot').value = a;
      document.getElementById('meCat').value = c;
    };
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m };
    const n0 = state.yf.txns.length;
    set('', 'Bill Payment', 300); meSaveTx();          // no bill: refused
    const refused = { added: state.yf.txns.length - n0, msg };
    set('aug', 'Bill Payment', 300); meSaveTx();       // with a bill: stored negative
    window.toast = rt;
    const row = state.yf.txns[state.yf.txns.length - 1];
    return { refused, amt: row.amt, cat: row.cat, allot: row.allot, note: spendOf('aug'), paid: paidOf('aug') };
  }, [YEAR]);
  check(add.refused.added === 0 && /needs a bill/.test(add.refused.msg),
    'a payment with no bill is refused, and told why', add.refused.msg);
  check(add.amt === -300, 'typed in plain, stored negative', String(add.amt));
  check(add.allot === 'aug' && add.cat === 'Bill Payment', 'filed against the bill',
    JSON.stringify([add.allot, add.cat]));
  check(/^\$300 Bill Paid$/.test(add.paid), 'and the bill says so under its description', add.paid);
  /* Only a payment against it so far: there is a Bill Paid line and no Spend
     line, rather than one netted figure that would have to go negative. */
  check(add.note === '',
    'with no charges yet there is no Spend line to print', add.note);
  const net = await page.evaluate(([y]) => {
    state.yf.txns.push({ id: 'buy', type: 'expense', date: `${y}-08-04`, amt: 600,
      desc: 'Costco', cat: 'Groceries', who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` });
    renderYF(); renderME();
    return { note: spendOf('aug'), paid: paidOf('aug') };
  }, [YEAR]);
  check(/^\$600 Spend$/.test(net.note),
    'and a $600 purchase gives it one, reporting the purchase itself', net.note);
  check(/^\$300 Bill Paid$/.test(net.paid), 'with the paid line unchanged beside it', net.paid);

  /* A payment is stored negative but typed in plain, so the edit form has to hand
     back what was typed. Handing back "-300" made saving fail the amount>0 guard,
     which meant a payment could be opened for editing and never saved. */
  const round = await page.evaluate(() => {
    const row = (state.yf.txns || []).filter(t => t.cat === 'Bill Payment').pop();
    meStartEdit(row.id);
    const shown = document.getElementById('meAmt').value;
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m };
    document.getElementById('meDesc').value = 'Cleared it again';
    meSaveTx(); window.toast = rt;
    const after = (state.yf.txns || []).find(t => t.id === row.id);
    return { shown, amt: after.amt, desc: after.desc, msg };
  });
  check(round.shown === '300', 'the edit form shows the figure as it was typed', round.shown);
  check(round.amt === -300 && round.desc === 'Cleared it again',
    'and saving keeps it negative rather than being refused',
    JSON.stringify([round.amt, round.desc, round.msg]));

  /* The contributor filter can take the bill out of view while leaving the
     payments in it -- the bill is Poo's card, the payments were made from Abi's
     account. The line still has to land somewhere sensible, and "somewhere
     sensible" is its own date order, not silently at the bottom where it would
     read as the oldest thing in the month. */
  section('11. with the bill out of view the line falls back to date order');
  const loose = await page.evaluate(([y]) => {
    load([
      { id: 'aug', type: 'expense', date: `${y}-08-19`, amt: 750, desc: 'Aug card', cat: 'Credit Bill', who: 'POO', tab: 'yf' },
      { id: 'e1', type: 'expense', date: `${y}-08-28`, amt: 30, desc: 'Late buy', cat: 'Groceries', who: 'ABI', tab: 'me' },
      { id: 'e2', type: 'expense', date: `${y}-08-01`, amt: 20, desc: 'Early buy', cat: 'Groceries', who: 'ABI', tab: 'me' },
      { id: 'pz', type: 'expense', date: `${y}-08-14`, amt: -100, desc: 'AUTOPAY', cat: 'Bill Payment', who: 'ABI', tab: 'me', allot: 'aug', allotM: `${y}-08` }]);
    mePayOpen.clear();                                     // start collapsed
    meMonth = `${y}-08`; meWhoFilter = 'ABI'; renderME();   // Poo's bill is filtered away
    const rows = [...document.querySelectorAll('#meBody tr')].map(tr =>
      tr.className === 'me-payrow' ? 'PAY' : tr.children[1].textContent.trim());
    meWhoFilter = 'ALL'; renderME();
    return rows;
  }, [YEAR]);
  check(JSON.stringify(loose) === JSON.stringify(['Late buy', 'PAY', 'Early buy']),
    'it sits between the rows either side of its date, not dumped at the end',
    JSON.stringify(loose));

  section('12. bank transfers are still dropped');
  const drop = await page.evaluate(() => ({
    pay: ['PAYMENT THANK YOU', 'AUTOPAY 1234', 'PRE-AUTH PAYMENT', 'CC PAYMENT'].map(meIsPayment),
    tr:  ['TRANSFER TO SAVINGS', 'E-TRANSFER JOE', 'TRANSFER FROM CHEQUING'].map(meIsExcluded),
    trPay: ['TRANSFER TO SAVINGS', 'E-TRANSFER JOE'].map(meIsPayment) }));
  check(drop.pay.every(Boolean), 'every card-payment wording is recognised', JSON.stringify(drop.pay));
  check(drop.tr.every(Boolean), 'every transfer wording is still excluded', JSON.stringify(drop.tr));
  check(drop.trPay.every(v => !v), 'and a transfer is never mistaken for a card payment');

  check(errs.length === 0, 'no page errors', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');
  await ctx.close(); await browser.close(); srv.close();
  console.log(`\nBILL PAYMENT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
