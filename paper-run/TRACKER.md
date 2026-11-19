# Paper Run Tracker

Start date: 2026-11-18 | Starting cash: $10,000 (paper) | Goal: +25% in 12 months ($12,500) | Active share: 30%

## Plan (dollar targets, no margin)
| Sleeve | Ticker | Target $ |
|---|---|---|
| Core | VOO | 1,260 |
| Core | QQQ | 1,400 |
| Core | SMH | 980 |
| Core | NVDA | 490 |
| Core | MSFT | 420 |
| Core | AMZN | 350 |
| Core | GOOGL | 350 |
| Core | IWM | 560 |
| Core | VXUS | 420 |
| Core | GLD | 350 |
| Core | SGOV | 420 |
| **Core total** | | **7,000** |
| Active | AMD, AVGO, PLTR, TSLA, META, NFLX | 3,000 held as cash until a dip signal |

## Active rules
- Buy a dip when price is 8%+ below its 20-day closing high. Max $1,000 per stock, max 5 stocks at once.
- Sell half at +15% from average cost.
- Sell all at -8% from average cost (stop loss).
- Never spend more than cash on hand. No shorting.

## Trade ledger
| Date | Ticker | Side | Shares | Price | Amount | Note |
|---|---|---|---|---|---|---|
| | | | | | | |

## Checkpoints (value vs $10,000)
| Date | Cash | Positions value | Total | Return | Note |
|---|---|---|---|---|---|
| 2026-11-18 | 10,000 | 0 | 10,000 | 0.0% | Run created, nothing bought yet |

## Live tracking with Finnhub (script: tracker.py)
1. `copy .env.example .env` and put your Finnhub key in `.env` (stays on your machine, git-ignored).
2. Start the run once: `python tracker.py --buy-core` (logs core buys at today's prices into `trades.csv`).
3. Each day: `python tracker.py` (updates `history.csv`, prints and saves `REPORT.txt`).
4. When you act on a signal, add a line to `trades.csv`: `date,ticker,side,shares,price`.
Note: Finnhub's free plan has no historical candles, so the 20-day high is built from the daily prices the script saves. Dip signals become reliable after about 20 days of runs.
