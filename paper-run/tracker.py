"""Text paper-run tracker using Finnhub quotes (free tier). Key stays in your local .env.

  python tracker.py --buy-core   # one-time: log core buys at today's prices
  python tracker.py              # daily: fetch prices, update history, print report + signals
"""
import argparse, csv, json, os, sys, urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
START_CASH, ACTIVE_PCT = 10000.0, 30
CORE = {"VOO": 18, "QQQ": 20, "SMH": 14, "NVDA": 7, "MSFT": 6, "AMZN": 5,
        "GOOGL": 5, "IWM": 8, "VXUS": 6, "GLD": 5, "SGOV": 6}   # weights of the core mix (sum 100)
ACTIVE = ["AMD", "AVGO", "PLTR", "TSLA", "META", "NFLX"]
DIP, TAKE, STOP, MAX_POS, POS_PCT = 8, 15, 8, 5, 10
TRADES, HIST, REPORT = HERE / "trades.csv", HERE / "history.csv", HERE / "REPORT.txt"


def load_key():
    for line in (HERE / ".env", HERE.parent / ".env"):
        if line.exists():
            for l in line.read_text().splitlines():
                if l.startswith("FINNHUB_API_KEY="):
                    return l.split("=", 1)[1].strip().strip('"\'')
    return os.getenv("FINNHUB_API_KEY") or sys.exit("Put FINNHUB_API_KEY=... in paper-run/.env")


def quote(sym, key):
    req = urllib.request.Request(f"https://finnhub.io/api/v1/quote?symbol={sym}",
                                 headers={"X-Finnhub-Token": key})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r).get("c") or 0.0     # c = current price; 0 means no data


def read_csv(p):
    return list(csv.DictReader(p.open())) if p.exists() else []


def write_rows(p, cols, rows, mode="w"):
    new = mode == "w" or not p.exists()
    with p.open(mode if p.exists() else "w", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(cols)
        w.writerows(rows)


def update_history(prices):
    today = date.today().isoformat()
    rows = [r for r in read_csv(HIST) if r["date"] != today]
    rows += [{"date": today, "ticker": t, "close": p} for t, p in prices.items() if p]
    write_rows(HIST, ["date", "ticker", "close"], [[r["date"], r["ticker"], r["close"]] for r in rows])
    return rows


def hi20(rows, t):
    cl = [(r["date"], float(r["close"])) for r in rows if r["ticker"] == t]
    cl = sorted(cl)[-20:]
    return (max(c for _, c in cl) if cl else 0), len(cl)


def book():
    pos, cash, realized = {}, START_CASH, 0.0
    for x in read_csv(TRADES):
        q, px, t = float(x["shares"]), float(x["price"]), x["ticker"]
        p = pos.setdefault(t, {"qty": 0.0, "cost": 0.0})
        if x["side"] == "buy":
            p["qty"] += q; p["cost"] += q * px; cash -= q * px
        else:
            avg = p["cost"] / p["qty"] if p["qty"] else 0
            realized += q * (px - avg); p["cost"] -= avg * q; p["qty"] -= q; cash += q * px
            if p["qty"] < 1e-9:
                p["qty"] = p["cost"] = 0.0
    return pos, cash, realized


def buy_core(prices):
    pos, cash, _ = book()
    rows = []
    for t, w in CORE.items():
        if pos.get(t, {}).get("qty", 0) > 0 or not prices.get(t):
            continue
        amt = START_CASH * w / 100 * (1 - ACTIVE_PCT / 100)
        if amt > cash:
            continue
        qty = int(amt / prices[t] * 1e4) / 1e4
        cash -= qty * prices[t]
        rows.append([date.today().isoformat(), t, "buy", qty, prices[t]])
        print(f"BUY {qty} {t} @ {prices[t]:.2f} = ${qty * prices[t]:,.2f}")
    write_rows(TRADES, ["date", "ticker", "side", "shares", "price"], rows, "a")


def report(prices, hist):
    pos, cash, realized = book()
    px = lambda t: prices.get(t) or (pos[t]["cost"] / pos[t]["qty"] if pos.get(t, {}).get("qty") else 0)
    held = sum(p["qty"] * px(t) for t, p in pos.items() if p["qty"] > 0)
    total = cash + held
    deployed = sum(p["cost"] for t, p in pos.items() if t in ACTIVE and p["qty"] > 0)
    avail = max(0, min(START_CASH * ACTIVE_PCT / 100 - deployed, cash))
    n_act = sum(1 for t in ACTIVE if pos.get(t, {}).get("qty", 0) > 0)
    L = [f"PAPER RUN REPORT {date.today()}", "",
         f"Total ${total:,.2f} | Return {(total / START_CASH - 1) * 100:+.1f}% | Goal +25% = ${START_CASH * 1.25:,.0f} "
         f"({max(0, (total / START_CASH - 1) * 100 / 25 * 100):.0f}% of the way)",
         f"Cash ${cash:,.2f} | Active budget left ${avail:,.2f} | Active slots {n_act}/{MAX_POS} | Realized ${realized:+,.2f}", "",
         "POSITIONS"]
    for t, p in pos.items():
        if p["qty"] > 0:
            g = p["qty"] * px(t) - p["cost"]
            L.append(f"  {t:6} {p['qty']:>10.4f} sh  avg {p['cost'] / p['qty']:>8.2f}  now {px(t):>8.2f}  {g:+9.2f} ({g / p['cost'] * 100:+.1f}%)")
    if len(L) == 7:
        L.append("  none")
    L += ["", "SIGNALS (active sleeve)"]
    for t in ACTIVE:
        q, price = pos.get(t, {}), prices.get(t, 0)
        if not price:
            L.append(f"  {t:5} no price"); continue
        if q.get("qty", 0) > 0:
            g = (price / (q["cost"] / q["qty"]) - 1) * 100
            s = (f"STOP: sell all ({g:+.1f}%)" if g <= -STOP else
                 f"TAKE PROFIT: sell half = {q['qty'] / 2:.4f} sh ({g:+.1f}%)" if g >= TAKE else f"hold ({g:+.1f}%)")
        else:
            hi, n = hi20(hist, t)
            dd = (price / hi - 1) * 100 if hi else 0
            size = min(avail, total * POS_PCT / 100)
            s = f"no dip ({dd:+.1f}% vs 20d high {hi:.2f}, {n}d history)"
            if hi and dd <= -DIP:
                s = (f"dip {dd:+.1f}% but slots full" if n_act >= MAX_POS else
                     f"dip {dd:+.1f}% but no active cash" if size < 1 else
                     f"BUY DIP: ${size:,.0f} = {size / price:.4f} sh @ {price:.2f} ({dd:+.1f}% vs high)")
        L.append(f"  {t:5} {price:>8.2f}  {s}")
    L.append("\nLog any trade you take by adding a line to trades.csv (date,ticker,side,shares,price).")
    text = "\n".join(L)
    print(text); REPORT.write_text(text + "\n")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--buy-core", action="store_true")
    key = load_key()
    prices = {}
    for t in list(CORE) + ACTIVE:
        try:
            prices[t] = quote(t, key)
        except Exception as e:
            print(f"{t}: quote failed ({e})"); prices[t] = 0.0
    hist = update_history(prices)
    if ap.parse_args().buy_core:
        buy_core(prices)
    report(prices, hist)


if __name__ == "__main__":
    main()
