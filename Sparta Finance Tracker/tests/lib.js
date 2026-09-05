/* Shared test helpers: local server, deterministic network stubs, seed data. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');

const CHROME = '/opt/pw-browsers/chromium';

function serve(file) {
  const html = fs.readFileSync(file);
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function stub(page) {
  await page.route('**://**', r =>
    r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.route('**://fonts.googleapis.com/**', r =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**://api.frankfurter.dev/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"rates":{"CAD":1.37}}' }));
}

// ── Deterministic fixture spanning every data domain in the app ──────────────
const YEAR = 2026;
const SEED = {
  'sparta.ccy': '"CAD"',
  'sparta.fx': '1.37',
  'sparta.fbOn': 'false',
  'sparta.dash.cash': JSON.stringify({ TFSA: 2500.5, FHSA: 1200, Other: 340.25 }),
  'sparta.dash.holdings': JSON.stringify([
    { id: 'h1', sym: 'AAPL', acct: 'TFSA', qty: 10, avg: 180.5, ccy: 'USD', nat: true, price: 212.4, manual: true },
    { id: 'h2', sym: 'VFV', acct: 'TFSA', qty: 25, avg: 132.1, ccy: 'CAD', nat: true, price: 148.9, manual: true },
    { id: 'h3', sym: 'NVDA', acct: 'FHSA', qty: 4, avg: 900.0, ccy: 'USD', nat: true, price: 845.25, manual: true },
    { id: 'h4', sym: 'ENB', acct: 'Other', qty: 60, avg: 48.2, ccy: 'CAD', nat: true, price: 52.75, manual: true },
  ]),
  'sparta.dash.history': JSON.stringify([
    { t: Date.UTC(2026, 0, 2), v: 10000, k: '2026-01-02' },
    { t: Date.UTC(2026, 1, 2), v: 11250, k: '2026-02-02' },
    { t: Date.UTC(2026, 2, 2), v: 10980, k: '2026-03-02' },
  ]),
  // cad:true + the cadFixed flag mark these as already-CAD, so the one-time
  // migrateContribCAD() pass leaves them alone (it is exercised separately).
  'sparta.contrib.cadFixed': 'true',
  'sparta.contrib.entries': JSON.stringify([
    { id: 'c1', t: Date.UTC(2025, 2, 3), acct: 'TFSA', amt: 3000, y: 2025, cad: true },
    { id: 'c2', t: Date.UTC(2026, 0, 8), acct: 'TFSA', amt: 4200, y: 2026, cad: true },
    { id: 'c3', t: Date.UTC(2026, 1, 14), acct: 'FHSA', amt: 5000, y: 2026, cad: true },
  ]),
  'sparta.contrib.limitsY': JSON.stringify({ 'TFSA-2026': 7000, 'FHSA-2026': 8000 }),
  'sparta.contrib.yearly': JSON.stringify([{ y: 2024, tfsa: 6500, fhsa: 8000 }]),
  'sparta.yf.data': JSON.stringify({
    txns: [
      { id: 't1', type: 'income', date: '2026-01-15', amt: 4200, desc: 'DVS Pay', cat: 'Paycheck' },
      { id: 't2', type: 'income', date: '2026-02-15', amt: 4200, desc: 'DVS Pay', cat: 'Paycheck' },
      { id: 't3', type: 'income', date: '2026-03-15', amt: 900, desc: 'Bonus Q1', cat: 'Bonus' },
      { id: 't4', type: 'expense', date: '2026-01-04', amt: 320.55, desc: 'Loblaws', cat: 'Grocery' },
      { id: 't5', type: 'expense', date: '2026-01-19', amt: 1450, desc: 'Rent Jan', cat: 'Home' },
      { id: 't6', type: 'expense', date: '2026-02-04', amt: 288.1, desc: 'Costco', cat: 'Grocery' },
      { id: 't7', type: 'expense', date: '2026-02-21', amt: 1450, desc: 'Rent Feb', cat: 'Home' },
      { id: 't8', type: 'expense', date: '2026-03-02', amt: 96.4, desc: 'Shell Gas', cat: 'Transportation' },
      { id: 't9', type: 'expense', date: '2026-03-11', amt: 62.99, desc: 'Pharmacy', cat: 'Health/medical' },
    ],
    planned: { '2026': { Grocery: 500, Home: 1450, Transportation: 150, Paycheck: 4200 } },
    start: { '2026': 8000 },
    cats: {
      exp: ['Food', 'Credit Bill', 'Health/medical', 'Home', 'Transportation', 'Personal',
        'Grocery', 'Misc', 'Travel', 'Debt', 'Other', 'Education\\Tuition',
        'Custom category 2', 'Investment', 'Other Bank'],
      inc: ['Gift/Stocks', 'Paycheck', 'Bonus', 'Temp', 'US/CA Support', 'Other'],
    },
  }),
  'sparta.me': JSON.stringify({
    rules: { 'loblaws': 'Groceries', 'shell gas': 'Taxi' },
    imported: ['fp-1', 'fp-2'],
    chartCats: ['Groceries', 'Entertainment', 'Health/medical', 'General'],
  }),
};

async function open(browser, url, seed = SEED) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await stub(page);
  // Seed once, on the first navigation only. addInitScript re-runs on every
  // reload, so a sentinel keeps a reload from wiping what the test just wrote.
  await page.addInitScript(s => {
    try {
      if (localStorage.getItem('__seeded__')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      localStorage.setItem('__seeded__', '1');
    } catch (e) { }
  }, seed);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  return { ctx, page, errs };
}

const launch = () => chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

// Strip values that legitimately vary between two runs (ids, timestamps, today's date).
function normalize(html) {
  return html
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE')
    .replace(/data-id="[^"]*"/g, 'data-id="ID"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { serve, stub, open, launch, normalize, SEED, YEAR, CHROME };
