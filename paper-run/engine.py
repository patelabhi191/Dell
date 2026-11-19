"""Paper-trading engine for the Claude-run desk. Pure math + Finnhub quotes; the caller does db I/O.

python3 engine.py --state STATE.json --version N --out OUTDIR
  STATE.json : current state/main document (omit the flag on the very first run)
  writes OUTDIR/state.json, OUTDIR/trade-*.json, OUTDIR/checkpoint.json, OUTDIR/writes.json
"""
import argparse, json, sys, urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

START_CASH, ACTIVE_PCT = 10000.0, 30
CORE = {"VOO": 18, "QQQ": 20, "SMH": 14, "NVDA": 7, "MSFT": 6, "AMZN": 5,
        "GOOGL": 5, "IWM": 8, "VXUS": 6, "GLD": 5, "SGOV": 6}
ACTIVE = ["AMD", "AVGO", "PLTR", "TSLA", "META", "NFLX"]
DIP, TAKE, STOP, TRAIL, MAX_POS, POS_PCT, LOOKBACK = 8, 15, 8, 8, 5, 10, 20
ET = ZoneInfo("America/New_York")


def get(path):
    r = urllib.request.Request("https://finnhub.io/api/v1/" + path,
                               headers={"X-Finnhub-Token": "proxy-injected"})  # real key injected by proxy
    with urllib.request.urlopen(r, timeout=20) as f:
        return json.load(f)


def r4(x): return int(x * 1e4) / 1e4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state"); ap.add_argument("--version", type=int); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    now = datetime.now(ET); today = now.strftime("%Y-%m-%d"); stamp = now.strftime("%Y%m%d-%H%M")

    st = json.loads(Path(a.state).read_text()) if a.state else None
    if st and "startCash" not in st:          # tolerate a {data:{...}} wrapper
        st = st.get("data", st)
    if not st:
        st = {"startCash": START_CASH, "cash": START_CASH, "activePct": ACTIVE_PCT, "realized": 0.0,
              "createdAt": now.isoformat(timespec="minutes"), "runs": 0, "positions": {}, "highs": {}, "last": {}}

    status = get("stock/market-status?exchange=US")
    if not status.get("isOpen"):
        print(f"Market closed ({status.get('holiday') or status.get('session')}). No changes."); (out / "writes.json").write_text("[]"); return

    q = {}
    for t in list(CORE) + ACTIVE:
        try:
            d = get(f"quote?symbol={t}")
            if d.get("c"):
                q[t] = d
        except Exception as e:
            print(f"{t}: quote failed {e}")
    if len(q) < len(CORE) // 2:
        sys.exit("Too many quote failures; aborting without writes.")

    P, H, trades = st["positions"], st["highs"], []
    for t, d in q.items():
        h = H.setdefault(t, {}); h[today] = max(h.get(today, 0), d["h"] or d["c"], d["c"])
        for k in sorted(h)[:-LOOKBACK]:
            del h[k]
        st["last"][t] = d["c"]

    def value():
        return st["cash"] + sum(p["qty"] * st["last"].get(t, p["cost"] / p["qty"]) for t, p in P.items() if p["qty"] > 0)

    def trade(t, side, qty, px, why):
        qty = r4(qty); amt = round(qty * px, 2)
        if qty <= 0 or amt < 1: return
        p = P.setdefault(t, {"qty": 0.0, "cost": 0.0, "sleeve": "core" if t in CORE else "active"})
        extra = {}
        if side == "buy":
            if amt > st["cash"] + 1e-6: return             # no margin
            p["qty"] = r4(p["qty"] + qty); p["cost"] = round(p["cost"] + amt, 2); st["cash"] = round(st["cash"] - amt, 2)
            p.update(peak=px, tp=False, opened=today)
        else:
            qty = min(qty, p["qty"]); amt = round(qty * px, 2)  # no shorting
            avg = p["cost"] / p["qty"]; pnl = round(qty * (px - avg), 2)
            share = qty / p["qty"]
            extra = {"avgCost": round(avg, 4), "pnl": pnl, "pnlPct": round((px / avg - 1) * 100, 2),
                     "portion": "all" if share > 0.999 else f"{share * 100:.0f}%"}
            st["realized"] = round(st["realized"] + pnl, 2)
            p["cost"] = round(p["cost"] - avg * qty, 2); p["qty"] = r4(p["qty"] - qty); st["cash"] = round(st["cash"] + amt, 2)
            if p["qty"] <= 1e-4: p.update(qty=0.0, cost=0.0, closed=today)
        trades.append({"ts": now.isoformat(timespec="minutes"), "ticker": t, "side": side, "qty": qty, "price": px,
                       "amount": amt, "sleeve": p["sleeve"], "reason": why, "cashAfter": st["cash"], **extra})

    # core: buy anything not yet held
    for t, w in CORE.items():
        if t in q and P.get(t, {}).get("qty", 0) == 0:
            amt = st["startCash"] * w / 100 * (1 - st["activePct"] / 100)
            trade(t, "buy", amt / q[t]["c"], q[t]["c"], f"Core allocation {w * (100 - st['activePct']) / 100:.1f}%")

    # active sleeve
    signals = {}
    for t in ACTIVE:
        if t not in q: signals[t] = "no quote"; continue
        px, p = q[t]["c"], P.get(t)
        if p and p["qty"] > 0:
            avg = p["cost"] / p["qty"]; g = (px / avg - 1) * 100; p["peak"] = max(p.get("peak", px), px)
            if g <= -STOP:
                trade(t, "sell", p["qty"], px, f"Stop loss at {g:+.1f}%"); signals[t] = "sold: stop loss"
            elif not p.get("tp") and g >= TAKE:
                trade(t, "sell", p["qty"] / 2, px, f"Take profit on half at {g:+.1f}%"); p["tp"] = True; signals[t] = "sold half: take profit"
            elif p.get("tp") and px <= p["peak"] * (1 - TRAIL / 100):
                trade(t, "sell", p["qty"], px, f"Trailing stop, {TRAIL}% below peak {p['peak']:.2f}"); signals[t] = "sold rest: trailing stop"
            else:
                signals[t] = f"holding {g:+.1f}%"
            continue
        hi = max(H.get(t, {}).values() or [px]); dd = (px / hi - 1) * 100
        n_act = sum(1 for x in ACTIVE if P.get(x, {}).get("qty", 0) > 0)
        deployed = sum(P[x]["cost"] for x in ACTIVE if P.get(x, {}).get("qty", 0) > 0)
        avail = max(0, min(st["startCash"] * st["activePct"] / 100 - deployed, st["cash"]))
        size = min(avail, value() * POS_PCT / 100)
        if dd <= -DIP and p and p.get("closed") == today:
            signals[t] = f"dip {dd:+.1f}% but sold today"
        elif dd <= -DIP and n_act < MAX_POS and size >= 1:
            trade(t, "buy", size / px, px, f"Dip buy {dd:+.1f}% below recent high {hi:.2f}"); signals[t] = "bought dip"
        else:
            signals[t] = f"watching ({dd:+.1f}% vs high {hi:.2f})"

    tot = round(value(), 2)
    st.update(runs=st["runs"] + 1, updatedAt=now.isoformat(timespec="minutes"), totalValue=tot,
              returnPct=round((tot / st["startCash"] - 1) * 100, 2), signals=signals,
              trackingDays=len({d for h in H.values() for d in h}))
    cp = {"ts": now.isoformat(timespec="minutes"), "total": tot, "cash": st["cash"], "returnPct": st["returnPct"], "trades": len(trades)}

    writes = []
    (out / "state.json").write_text(json.dumps(st))
    w = {"op": "set", "collection": "state", "doc_id": "main", "file_path": str((out / "state.json").resolve())}
    if a.version: w["if_version"] = a.version
    writes.append(w)
    for x in trades:
        did = f"{stamp}-{x['ticker']}-{x['side']}"
        f = out / f"trade-{did}.json"; f.write_text(json.dumps(x))
        writes.append({"op": "set", "collection": "trades", "doc_id": did, "file_path": str(f.resolve())})
    (out / "checkpoint.json").write_text(json.dumps(cp))
    writes.append({"op": "set", "collection": "checkpoints", "doc_id": stamp, "file_path": str((out / "checkpoint.json").resolve())})
    (out / "writes.json").write_text(json.dumps(writes, indent=1))

    print(f"Total ${tot:,.2f} ({st['returnPct']:+.2f}%) | cash ${st['cash']:,.2f} | realized ${st['realized']:+,.2f} | {len(trades)} trades")
    for x in trades:
        print(f"  {x['side'].upper()} {x['qty']} {x['ticker']} @ {x['price']} = ${x['amount']:,.2f}  ({x['reason']})")
    print("Signals:", "; ".join(f"{k} {v}" for k, v in signals.items()))
    print(f"Writes: {out / 'writes.json'}")


if __name__ == "__main__":
    main()
