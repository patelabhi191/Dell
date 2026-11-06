/* A five-years-of-use ledger, deterministic (seeded LCG, no Math.random) so the
   profile is repeatable. Shapes taken from tests/lib.js SEED and the
   normalise* functions, not invented. */
const YEARS = [2022, 2023, 2024, 2025, 2026];
const NOW = new Date('2026-10-17T13:00:00Z').getTime();
let _s = 20261017;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];
const amt = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
const pad = n => String(n).padStart(2, '0');

const YF_EXP = ['Food','Credit Bill','Health/medical','Home','Transportation','Personal',
  'Grocery','Misc','Travel','Debt','Other','Education\\Tuition','Investment','Other Bank'];
const YF_INC = ['Gift/Stocks','Paycheck','Bonus','Temp','US/CA Support','Other'];
const ME_CATS = ['Groceries','Dining Out','Transit','Shopping','Health/medical',
  'TV/Phone/Internet','Entertainment','General','Taxi','Utilities'];
const WHO = ['ABI','POO'];

const txns = [];
let n = 0;
for (const y of YEARS) {
  const lastM = y === 2026 ? 10 : 12;
  for (let m = 1; m <= lastM; m++) {
    // two paycheques a month
    for (const d of [15, 28]) txns.push({ id: 'i' + (++n), type: 'income',
      date: `${y}-${pad(m)}-${pad(d)}`, amt: amt(3900, 4400), desc: 'DVS Pay',
      cat: 'Paycheck', who: pick(WHO), tab: 'yf' });
    // one Yearly bill a month, plus Monthly allocations against it
    const billId = `bill-${y}-${pad(m)}`;
    txns.push({ id: billId, type: 'expense', date: `${y}-${pad(m)}-02`,
      amt: amt(900, 2200), desc: 'Visa statement', cat: 'Credit Bill',
      who: pick(WHO), tab: 'yf' });
    for (let k = 0; k < 6; k++) txns.push({ id: 'a' + (++n), type: 'expense',
      date: `${y}-${pad(m)}-${pad(3 + k * 4)}`, amt: amt(20, 260),
      desc: 'Itemised ' + k, cat: pick(ME_CATS), who: pick(WHO), tab: 'me',
      allot: billId, allotM: `${y}-${pad(m)}`, src: 'Visa' });
    // seven more Yearly expenses a month
    for (let k = 0; k < 14; k++) txns.push({ id: 'e' + (++n), type: 'expense',
      date: `${y}-${pad(m)}-${pad(1 + (k * 2) % 28)}`, amt: amt(30, 1600),
      desc: 'Expense ' + k, cat: pick(YF_EXP), who: pick(WHO), tab: 'yf' });
    // twelve plain Monthly rows a month
    for (let k = 0; k < 36; k++) txns.push({ id: 'me' + (++n), type: 'expense',
      date: `${y}-${pad(m)}-${pad(1 + k % 28)}`, amt: amt(8, 190),
      desc: 'Shop ' + k, cat: pick(ME_CATS), who: pick(WHO), tab: 'me' });
    // one refund a quarter -- the sharpest edge this review found
    if (m % 3 === 0) txns.push({ id: 'r' + (++n), type: 'expense',
      date: `${y}-${pad(m)}-${pad(20)}`, amt: -amt(15, 120), desc: 'Refund',
      cat: pick(ME_CATS), who: pick(WHO), tab: 'me' });
  }
}

const planned = {}, start = {};
for (const y of YEARS) {
  planned[y] = {}; YF_EXP.forEach(c => planned[y][c] = amt(100, 1800));
  YF_INC.forEach(c => planned[y][c] = amt(200, 4200));
  start[y] = amt(6000, 42000);
}

// 4,000 history points -- the cap snapshot() enforces -- spread over 90 days,
// which is what a tab left open will do and what compactHistory exists to fold.
const history = [];
for (let i = 0; i < 4000; i++) {
  const t = NOW - Math.floor((89 - (i / 4000) * 89) * 86400e3) - Math.floor(rnd() * 8e7);
  const all = amt(60000, 190000);
  history.push({ t, k: String(t) + '-' + i,
    v: { ALL: all, TFSA: all * 0.42, FHSA: all * 0.31, Other: all * 0.27 } });
}
history.sort((a, b) => a.t - b.t);

// a contribution a week for five years
const contribs = [];
for (let i = 0; i < 260; i++) {
  const t = NOW - i * 7 * 86400e3;
  contribs.push({ id: 'c' + i, t, acct: pick(['TFSA', 'FHSA']), amt: amt(50, 700),
    y: new Date(t).getFullYear(), who: pick(WHO), cad: true });
}

const mon12 = f => Array.from({ length: 12 }, f);
const archives = [2021, 2022, 2023, 2024, 2025].map(year => {
  const mInc = mon12(() => amt(3000, 9000)), mExp = mon12(() => amt(1500, 6000));
  const ti = mInc.reduce((a, b) => a + b, 0), te = mExp.reduce((a, b) => a + b, 0);
  const st = amt(5000, 40000), end = st + ti - te, inv = amt(2000, 9000), mv = amt(500, 4000);
  const byCat = {}; ME_CATS.forEach(c => byCat[c] = mon12(() => amt(20, 600)));
  return { id: 'ar' + year, year, sealedAt: NOW, sealed: true,
    stats: { start: st, end, invested: inv, moved: mv, saved: end - st,
             offPaper: end - st + inv + mv, growth: st > 0 ? (end / st - 1) * 100 : 0 },
    entries: 540, entriesYf: 220, entriesMe: 320,
    exp: YF_EXP.map(c => ({ c, v: amt(300, 9000) })).sort((a, b) => b.v - a.v),
    inc: YF_INC.map(c => ({ c, v: amt(300, 40000) })).sort((a, b) => b.v - a.v),
    mInc, mExp, meInc: mon12(() => amt(0, 400)),
    contrib: { abiT: amt(0, 7000), abiF: amt(0, 8000), pooT: amt(0, 7000), pooF: amt(0, 8000) },
    highlights: ['peakExp','peakInc','rate','over','bestSave','topCatExp'].map(k =>
      ({ key: k, tone: 'info', title: k, line: 'Sealed ' + year })),
    byCat };
});

const SYMS = ['AAPL','VFV','NVDA','ENB','TD','RY','BNS','CNR','SHOP','ATD','MSFT','GOOGL',
  'AMZN','TSLA','META','BRK.B','XEQT','VGRO','ZSP','HXQ','SU','CVE','BCE','T','FTS',
  'AQN','NTR','WCN','CP','MFC','SLF','QSR','DOL','L','MRU','GIB.A','OTEX','CSU','TRI','WSP'];
const holdings = SYMS.slice(0, 25).map((sym, i) => ({ id: 'h' + i, sym,
  acct: pick(['TFSA','FHSA','Other']), qty: Math.round(amt(1, 400)),
  avg: amt(20, 900), ccy: pick(['CAD','USD']), nat: true, price: amt(20, 900),
  manual: true, broker: i % 3 === 0 ? 'Q' : '' }));

const sells = Array.from({ length: 60 }, (_, i) => ({ id: 's' + i,
  t: NOW - i * 11 * 86400e3, sym: pick(SYMS), acct: pick(['TFSA','FHSA','Other']),
  qty: Math.round(amt(1, 300)), price: amt(20, 900), avg: amt(20, 900),
  ccy: pick(['CAD','USD']) }));

const plan = { segments: Array.from({ length: 6 }, (_, s) => ({
  id: 'sg' + s, name: 'Segment ' + (s + 1), start: amt(1000, 20000), open: s < 2,
  items: Array.from({ length: 25 }, (_, i) => ({ id: `p${s}-${i}`,
    date: `2026-${pad(1 + (i % 12))}-${pad(1 + (i % 28))}`,
    type: i % 5 === 0 ? 'income' : 'expense', name: 'Plan item ' + i,
    amt: amt(50, 3000), notes: i % 4 === 0 ? 'note ' + i : '' })) })) };

const notes = { text: 'A '.repeat(400),
  points: Array.from({ length: 40 }, (_, i) => ({ id: 'n' + i, text: 'Point ' + i + ' ' + 'x'.repeat(60) })),
  stocks: SYMS.slice(0, 40) };

const rules = {}; for (let i = 0; i < 120; i++) rules['merchant ' + i] = pick(ME_CATS);

const SEED = {
  'sparta.ccy': '"CAD"', 'sparta.fx': '1.37', 'sparta.fbOn': 'false',
  'sparta.dash.cash': JSON.stringify({ TFSA: 12500.5, FHSA: 8200, Other: 3340.25 }),
  'sparta.dash.holdings': JSON.stringify(holdings),
  'sparta.dash.history': JSON.stringify(history),
  'sparta.dash.sells': JSON.stringify(sells),
  'sparta.contrib.cadFixed': 'true',
  'sparta.contrib.entries': JSON.stringify(contribs),
  'sparta.contrib.limitsY': JSON.stringify(
    YEARS.reduce((o, y) => (o[`TFSA-${y}`] = 7000, o[`FHSA-${y}`] = 8000, o), {})),
  'sparta.contrib.yearly': JSON.stringify(
    [2020, 2021].map(y => ({ y, tfsaAbi: 6000, tfsaPoo: 500, fhsaAbi: 8000, fhsaPoo: 0 }))),
  'sparta.yf.data': JSON.stringify({ txns, planned, start,
    cats: { exp: YF_EXP, inc: YF_INC } }),
  'sparta.me': JSON.stringify({ rules, imported: Array.from({ length: 60 }, (_, i) => 'fp-' + i),
    chartCats: ME_CATS.slice(0, 4) }),
  'sparta.archives': JSON.stringify(archives),
  'sparta.plan': JSON.stringify(plan),
  'sparta.notes': JSON.stringify(notes),
};

const bytes = Object.entries(SEED).reduce((a, [k, v]) => a + k.length + v.length, 0);
module.exports = { SEED, stats: { txns: txns.length, yf: txns.filter(t => t.tab !== 'me').length,
  me: txns.filter(t => t.tab === 'me').length, history: history.length,
  contribs: contribs.length, archives: archives.length, holdings: holdings.length,
  sells: sells.length, planItems: plan.segments.length * 25, stocks: notes.stocks.length,
  seedBytes: bytes } };
