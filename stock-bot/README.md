# Claude Paper-Trading Bot (Alpaca Paper + Anthropic)

Paper money only. One small Claude Haiku call per run (~1–2k input tokens, <=600 output) = a fraction of a cent.

## 1. Install (Windows PowerShell)
```powershell
cd path\to\stock-bot
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env
```
Keys: Alpaca **paper** keys (alpaca.markets -> sign up free -> Paper Trading -> API Keys) and an Anthropic key (console.anthropic.com).

## 2. Test once
```powershell
python bot.py --dry-run   # decides + logs, places NO orders
python bot.py             # real paper orders
```
Check `trade_log.csv` and the Alpaca paper dashboard.

## 3. Schedule daily (Task Scheduler)
1. Start menu -> **Task Scheduler** -> **Create Basic Task**.
2. Name: `Claude Paper Bot`; Trigger: **Daily**, time e.g. 9:45 AM Eastern (convert to your PC's time; US market opens 9:30 ET).
3. Action: **Start a program**
   - Program: `C:\full\path\to\stock-bot\.venv\Scripts\python.exe`
   - Arguments: `bot.py`
   - Start in: `C:\full\path\to\stock-bot`
4. Finish -> open task Properties -> tick **Run whether user is logged on or not** and **Run task as soon as possible after a scheduled start is missed**.
5. Right-click the task -> **Run** to test. (Weekend/holiday runs just queue orders for the next open; to skip them, set Trigger to Weekly Mon–Fri.)

## Costs / limits
- Alpaca paper trading, API and the IEX market-data feed (used here) are free; news is included. IEX prices are slightly delayed/limited vs. full SIP — fine for daily decisions.
- Anthropic API is pay-as-you-go (not free). Haiku keeps it ~pennies per month.

## Safety
- Endpoint is hardcoded to `https://paper-api.alpaca.markets` and verified at startup (`https://alpaca.markets` is just the website, not an API).
- Code enforces: no shorting, buys capped to cash (minus 5% reserve and pending orders), 25% max per holding, symbols limited to `WATCHLIST` — even if the model ignores the rules.
- Edit `WATCHLIST` and limits at the top of `bot.py`. Not financial advice.
