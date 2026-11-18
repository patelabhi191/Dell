"""Claude-driven Alpaca PAPER trading bot. Run: python bot.py [--dry-run]"""
import argparse, csv, json, os, re, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
import anthropic
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.news import NewsClient
from alpaca.data.requests import StockBarsRequest, NewsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import DataFeed

# ---- Safety: paper only. Never read from env, never change. ----
PAPER_URL = "https://paper-api.alpaca.markets"   # (the bare alpaca.markets URL is the marketing site, not an API)

# ---- Settings (edit freely) ----
WATCHLIST = ["SPY", "QQQ", "VTI", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"]
MODEL = "claude-haiku-5-5"      # cheapest model; one small call per run
MAX_POSITION_PCT = 0.25         # no single holding above 25% of portfolio
CASH_RESERVE_PCT = 0.05         # always keep 5% cash unspent
MIN_ORDER_USD = 1.0
NEWS_ITEMS = 8                  # total headlines sent (keeps tokens low)
LOG_FILE = Path(__file__).with_name("trade_log.csv")
LOG_COLS = ["timestamp_utc", "portfolio_value", "cash", "symbol", "action",
            "amount", "unit", "reason", "status"]

SYSTEM = (
    "You are a cautious paper-trading portfolio manager. Reply with ONLY a JSON object, no prose:\n"
    '{"actions":[{"symbol":"AAPL","action":"buy|sell|hold","amount":123.45,"reason":"<=15 words"}]}\n'
    "Rules: buy amount = US dollars; sell amount = number of shares (<= shares held); hold amount = 0. "
    "No margin, no shorting. Total buys must not exceed 'spendable_cash'. "
    "Only use symbols from the watchlist. Keep each holding under max_position_pct of portfolio. "
    "Prefer holding when unsure. Max 5 non-hold actions."
)


def need(name):
    v = os.getenv(name)
    if not v:
        sys.exit(f"Missing {name} in .env")
    return v


def get_state(trading, data, news):
    acct = trading.get_account()
    cash, equity = float(acct.cash), float(acct.portfolio_value)
    positions = {p.symbol: {"qty": float(p.qty), "value": round(float(p.market_value), 2),
                            "pl_pct": round(float(p.unrealized_plpc) * 100, 1)}
                 for p in trading.get_all_positions()}
    start = datetime.now(timezone.utc) - timedelta(days=45)
    bars = data.get_stock_bars(StockBarsRequest(
        symbol_or_symbols=WATCHLIST, timeframe=TimeFrame.Day, start=start,
        feed=DataFeed.IEX)).data                      # IEX = free feed
    prices = {}
    for s, b in bars.items():
        c = [x.close for x in b]
        if len(c) < 2:
            continue
        pct = lambda n: round((c[-1] / c[-1 - n] - 1) * 100, 1) if len(c) > n else None
        prices[s] = {"px": round(c[-1], 2), "d1%": pct(1), "d5%": pct(5), "d20%": pct(20)}
    heads = []
    try:
        ns = news.get_news(NewsRequest(symbols=",".join(WATCHLIST), limit=NEWS_ITEMS)).data["news"]
        heads = [f"{','.join(n.symbols[:2])}: {n.headline[:100]}" for n in ns]
    except Exception as e:
        print(f"(news unavailable: {e})")
    # subtract cash already committed to open buy orders
    pending = sum(float(o.notional or 0) for o in trading.get_orders() if o.side == OrderSide.BUY)
    spendable = max(0.0, min(cash - pending, cash) - equity * CASH_RESERVE_PCT)
    return {"portfolio_value": equity, "cash": cash, "spendable_cash": round(spendable, 2),
            "max_position_pct": MAX_POSITION_PCT, "positions": positions,
            "prices": prices, "news": heads}


def ask_claude(state):
    msg = anthropic.Anthropic().messages.create(
        model=MODEL, max_tokens=600, system=SYSTEM,
        messages=[{"role": "user", "content": json.dumps(state, separators=(",", ":"))}])
    txt = msg.content[0].text
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError(f"No JSON in reply: {txt[:200]}")
    return json.loads(m.group(0)).get("actions", [])


def validate(actions, state):
    """Hard-enforce rules in code, regardless of what the model says."""
    ok, budget = [], state["spendable_cash"]
    for a in actions:
        sym, act = str(a.get("symbol", "")).upper(), str(a.get("action", "")).lower()
        reason = str(a.get("reason", ""))[:200]
        try:
            amt = float(a.get("amount", 0))
        except (TypeError, ValueError):
            amt = 0
        if sym not in WATCHLIST or act not in ("buy", "sell", "hold"):
            continue
        if act == "hold" or amt <= 0:
            ok.append((sym, "hold", 0, reason)); continue
        if act == "sell":
            held = state["positions"].get(sym, {}).get("qty", 0)
            amt = min(amt, held)                      # no shorting
            if amt <= 0:
                continue
        else:
            cur = state["positions"].get(sym, {}).get("value", 0)
            room = state["portfolio_value"] * MAX_POSITION_PCT - cur
            amt = round(min(amt, budget, room), 2)    # no margin / concentration cap
            if amt < MIN_ORDER_USD:
                continue
            budget -= amt
        ok.append((sym, act, amt, reason))
    return ok


def log_rows(rows):
    new = not LOG_FILE.exists()
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(LOG_COLS)
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="decide and log, but place no orders")
    args = ap.parse_args()
    load_dotenv(Path(__file__).with_name(".env"))
    ak, sk = need("ALPACA_API_KEY"), need("ALPACA_SECRET_KEY")
    need("ANTHROPIC_API_KEY")

    trading = TradingClient(ak, sk, paper=True)       # paper=True -> PAPER_URL
    assert str(getattr(trading._base_url, "value", trading._base_url)) == PAPER_URL, "Refusing to run: not the paper endpoint"
    data, news = StockHistoricalDataClient(ak, sk), NewsClient(ak, sk)

    state = get_state(trading, data, news)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    base = [now, round(state["portfolio_value"], 2), round(state["cash"], 2)]
    print(f"Portfolio ${state['portfolio_value']:,.2f} | cash ${state['cash']:,.2f}")

    try:
        trades = validate(ask_claude(state), state)
    except Exception as e:
        print("Decision failed:", e)
        log_rows([base + ["-", "error", 0, "", str(e)[:200]]])
        return

    rows = []
    for sym, act, amt, reason in trades:
        status, unit = "hold", ("usd" if act == "buy" else "shares" if act == "sell" else "")
        if act != "hold":
            if args.dry_run:
                status = "dry-run"
            else:
                try:
                    kw = {"notional": amt} if act == "buy" else {"qty": amt}
                    o = trading.submit_order(MarketOrderRequest(
                        symbol=sym, side=OrderSide(act), time_in_force=TimeInForce.DAY, **kw))
                    status = f"submitted:{o.id}"
                except Exception as e:
                    status = f"failed:{str(e)[:100]}"
        print(f"{act.upper():4} {sym:5} {amt} {unit} - {reason} [{status}]")
        rows.append(base + [sym, act, amt, unit, reason, status])
    if not rows:
        print("No actions."); rows.append(base + ["-", "none", 0, "", "", "no actions"])
    log_rows(rows)


if __name__ == "__main__":
    main()
