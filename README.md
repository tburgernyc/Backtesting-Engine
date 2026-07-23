<div align="center">

# Research Desk

### A local workspace for testing trading ideas against real market data.

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg)](LICENSE)

**Import real candles, apply clear rules, inspect the trade-offs, and keep everything on your machine.**

[Quick start](#quick-start) · [First backtest](#run-your-first-backtest) · [Data sources](#data-sources) · [Extend it](#extend-research-desk)

</div>

---

Research Desk is a practical, local-first backtesting project for exploring trading rules with historical data. It has real market-data imports, a small set of understandable strategies, an interactive equity curve, detailed run metrics, and a local history—all in one TypeScript codebase that is meant to be read and extended.

There are no accounts, database, hosted service, or live-order execution. The focus is on the essential research loop: choose data, define the rules, run the simulation, and inspect what happened.

> [!IMPORTANT]
> Results are historical simulations, not predictions. A positive backtest does not establish that a strategy will work in the future or under real execution conditions.

## What you get

- Real historical crypto candles from Binance's public market-data API—no key required.
- Optional Alpaca stock-data import with credentials that stay in your local environment.
- CSV import for data from any provider or export.
- Built-in moving-average crossover, RSI mean reversion, and buy-and-hold strategies.
- Configurable strategy presets saved locally in the browser.
- An interactive equity chart, trade log, performance metrics, and research insights.
- A local History view to revisit recent runs without a database or account.
- A concise React, TypeScript, and local Node API codebase.

## Quick start

### Requirements

- [Node.js](https://nodejs.org/) 20 or later
- npm (included with Node.js)

```bash
git clone https://github.com/Miles-Deutscher/Backtesting-Engine.git
cd Backtesting-Engine
npm install
npm run dev
```

Open the local URL printed in the terminal. The development command starts the interface and the small local data gateway together.

For a production build:

```bash
npm run build
npm start
```

## Run your first backtest

1. Open **Backtesting** from the sidebar.
2. Keep **Binance public market data** selected, then choose a symbol, timeframe, and date range. `BTCUSDT` at `1 day` is a good first run.
3. Pick a strategy, set its inputs, starting cash, and fee assumption.
4. Choose **Load data & run backtest**.
5. Explore the result: hover the equity curve, review the performance breakdown, and inspect every completed position in the trade log.
6. Open **History** whenever you want to compare recent runs. Selecting one returns you to the backtesting view.

The results display is intentionally explicit about the simulation: returns, account highs and lows, drawdown, fees, closed trades, win rate, average trade, profit factor, and time in market are shown together so a single headline number never has to tell the whole story.

## Data sources

### Binance public market data

Select **Binance public market data**, choose a spot pair such as `BTCUSDT`, and run. Public historical candles work out of the box and do not require credentials.

If you choose to use a Binance API key for your own setup, place `BINANCE_API_KEY` in a local `.env` file. It is used only by the local server and is never sent to the browser.

### Alpaca stocks (optional)

Alpaca is only needed when you select **Alpaca stocks**. Binance and CSV backtests work without it.

```bash
cp .env.example .env
```

Add your own credentials to `.env`:

```bash
ALPACA_API_KEY=
ALPACA_API_SECRET=
ALPACA_DATA_FEED=iex
```

Restart the app, select **Alpaca stocks**, and enter a symbol such as `AAPL`. The Node server reads these values locally; the browser never receives them.

### CSV import

Select **CSV file** to load candles from another source. Use at least these columns:

```csv
timestamp,open,high,low,close,volume
2025-01-01T00:00:00Z,100,103,99,102,5000
```

`timestamp` may also be named `date` or `time`. Only a timestamp and close price are required; include open, high, low, and volume whenever your export supports them.

## Strategies and presets

| Strategy | Core rule | Useful for |
| --- | --- | --- |
| Moving-average crossover | Buys on a bullish fast/slow SMA cross and sells on the reverse cross. | Testing trend-following ideas. |
| RSI mean reversion | Buys when RSI is below an entry threshold and sells after it rises above an exit threshold. | Testing oversold/mean-reversion ideas. |
| Buy and hold | Buys at the first candle and closes at the last. | A straightforward benchmark. |

Every run is long-only and permits one open position at a time. Fees are applied on both entry and exit. If a position is still open on the final candle, the engine closes it so the result is fully realized.

After adjusting a built-in strategy, choose **Save as custom strategy** to store the configuration as a local preset. Presets remember the rule type, indicator settings, starting capital, and fee assumption, and appear in **My saved strategies**. They live only in your browser, so there is no sign-in or shared database.

## Reading a result

The result view is designed to make both performance and risk easy to inspect.

| Area | What it helps you evaluate |
| --- | --- |
| Net P/L and return | The simulated gain or loss after fees. |
| Ending, peak, and low equity | How the account value developed over the period. |
| Max drawdown | The largest peak-to-trough decline. |
| Closed trades and win rate | How often the strategy traded and how often positions were profitable. |
| Average trade and profit factor | Trade quality and the balance of gross profits to gross losses. |
| Time in market | How much of the tested period was exposed to price movement. |
| Equity curve and trade log | The timing of changes in equity and every completed position behind the metrics. |

Hover the equity curve to inspect values through time. Use the chart, summaries, and individual trades together—metrics are most useful when they agree with the path that produced them.

## Local history

Completed-run summaries are kept in the browser so you can compare recent work from **History**. Nothing is uploaded, and clearing browser storage clears the saved run list. The app retains the latest 50 runs to keep local storage lightweight.

## Project structure

```text
src/
  App.tsx        # interface, navigation, run flow, and local history
  data.ts        # market-data requests and CSV parsing
  backtest.ts    # strategy rules, metrics, and backtest loop
  styles.css     # visual design
server/
  index.ts       # local Binance and Alpaca data gateway
.env.example     # optional local provider configuration
```

## Extend Research Desk

The code is intentionally organized so each new idea has an obvious home.

| If you want to add… | Start here |
| --- | --- |
| A market-data provider | `server/index.ts` |
| A new strategy or signal | `src/backtest.ts` |
| Strategy settings or a UI control | `src/App.tsx` |
| Support for another CSV format | `src/data.ts` |
| Visual refinements | `src/styles.css` |

Good next steps include adding slippage, stop-loss rules, position sizing, shorting, benchmarks, or tests for your strategy logic. Add one assumption at a time and keep the result view honest about what the simulation does—and does not—model.

## Security and privacy

- No API keys, credentials, or private data are included in this repository.
- `.env` is excluded from Git; copy `.env.example` only when you need optional provider credentials.
- Alpaca and optional Binance credentials are read by the local Node process, never by browser code.
- The interface only calls its local `/api` route for provider requests.
- There is no account system, database, telemetry, or hosted service in this project.

Do not add keys to `src/`, `VITE_*` environment variables, browser storage, commits, issues, or screenshots.

## Troubleshooting

**Alpaca reports missing credentials**
This only matters when **Alpaca stocks** is selected. Create `.env` from `.env.example`, add both Alpaca values, then restart `npm run dev`.

**Binance returns no candles**
Confirm that the spot symbol, timeframe, and chosen date range are available. For example, use `BTCUSDT` rather than `BTC / USDT` when entering a custom symbol.

**My CSV will not import**
Check that it has a timestamp column (`timestamp`, `date`, or `time`) and numeric `close` values. Keep timestamps in chronological order.

**The chart or metrics look sparse**
Try a longer date range or a smaller timeframe. A strategy needs enough candles for its indicators and enough market movement to produce trades.

## Use it as a GitHub template

To let others create their own copy, push this repository to GitHub and enable **Settings → General → Template repository**. Contributors can then choose **Use this template** to start with a clean project and their own local configuration.

## Important note

Research Desk is educational software, not investment advice. Historical simulations can be misleading: data quality, transaction costs, slippage, liquidity, survivorship bias, and overfitting all matter. Never treat a backtest as a guarantee of future results.

## License

MIT. See [LICENSE](LICENSE).
