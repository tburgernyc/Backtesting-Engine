# Backtesting Program Comparison: Research Desk vs. noisebot

Comparing this repo (`tburgernyc/Backtesting-Engine`, a fork of Miles-Deutscher's
"Research Desk") against `tburgernyc/noisebot`, the Python quant-research
pipeline Tim is actually running toward live prop-firm capital.

## TL;DR

**They're not competitors — they solve different problems, and noisebot is
the one that matters for real money.** Research Desk is a clean, well-built
UI for casually poking at a strategy idea. noisebot is a disciplined
research *process* (pre-registration, walk-forward gates, ruin-risk
simulation, paper-trading verification) that has already produced real
findings: seven falsified strategy families and two crypto trend strategies
(BTC and BTC/ETH/SOL) that cleared every statistical gate and are currently
in a 90-day paper-trading shadow ahead of a prop-firm deployment decision.

Don't replace noisebot's engine with Research Desk's. Don't throw away
Research Desk either — it's the missing visualization layer noisebot has
never had. The recommendation below is to combine them: noisebot stays the
system of record for signals, gates, and the hypothesis ledger; Research
Desk's React components become a read-only dashboard on top of noisebot's
real output.

## 1. What each project actually is

### Research Desk (this repo)
A same-day fork (2026-07-23) of `Miles-Deutscher/Backtesting-Engine`, one
commit, no customization yet. It's "Research Desk": a React 19 + TypeScript
+ Vite + Express single-page app with a tiny Node API gateway. Binance public
klines (no key), optional Alpaca stocks, or CSV import; three built-in
strategies (SMA crossover, RSI mean-reversion, buy-and-hold); an interactive
SVG equity curve, an 8-metric dashboard, a trade log table, and a
browser-localStorage run history / strategy-preset system. ~500 lines of
logic total (`src/backtest.ts`, `src/data.ts`, `server/index.ts`). No
accounts, no database — genuinely local-first, and honestly documented as
"educational... not investment advice."

### noisebot (tburgernyc/noisebot)
A Python research pipeline with no UI at all — CLI scripts, markdown files,
and JSONL logs. Its mission statement (`CLAUDE.md`) is blunt: *"Backtests are
hypotheses, never forward expectancy... the system's entire value over
preset vendors is validation discipline."* It runs on a formal process:

- **Pre-registration** (`HYPOTHESES.md`): no variant is backtested unless it's
  registered first with an economic rationale, fixed rules, and a stated kill
  criterion. Every evaluation happens exactly once. Failures stay on the
  record permanently — no retuning, no "best of a sweep."
- **Statistical gates** (Phase 2): n ≥ 100 trades, profit factor > 1.3, both
  halves of the sample profitable, a parameter *plateau* check (three
  neighboring parameter values must **all** be positive, not just the best
  one), a bootstrap/Monte-Carlo drawdown check, and for futures a "barrier
  Monte Carlo" simulating prop-firm trailing-drawdown ruin risk under
  buffer-aware position sizing.
- **Paper-trading gate** (Phase 4): a strategy that clears Phase 2 still
  doesn't get capital — it runs 90 days of live shadow signals first, checked
  against backtest recomputation, before a deployment decision.
- **Track record so far**: seven falsified strategy families — always-on
  intraday momentum (Zarattini/Barbon noise-area), ORB breakout+compression,
  VWAP mean-reversion, last-hour order flow, perp funding-rate carry,
  ETHUSDT 15m TEMA trend continuation, and SMC/ICT EURUSD structure — each
  killed for a specific, quantified reason (PF below gate, a negative
  sample-half, cost-dominated attribution, a "top-5-trades are 217% of net
  P&L" lottery signature, etc.). Two strategies passed all gates: **E4-v2**
  (BTC, 28-day trend signal, 15%-vol-targeted sizing — PF 2.84, n=167,
  Sharpe 1.38 vs. 0.96 buy-and-hold, maxDD -26%) and **E6** (BTC/ETH/SOL
  multi-asset trend book — PF 1.94, n=327 episodes, Sharpe 0.97, clearing
  buy-and-hold "by a hair"). Both are now in the 90-day paper-trading shadow
  (started 2026-07-16) feeding a registered FundedNext deployment plan with
  an explicit three-condition buy trigger. **Zero live capital deployed so
  far** — the rigor is real, but proof-in-live-markets is still pending.
- **Engineering guardrails**: a Claude Code `PreToolUse` hook
  (`gate_guard.py`) mechanically blocks broker/execution code until a
  human creates `.gates/phase2_passed` (the AI can never self-approve or
  delete the marker), blocks hardcoded secrets, and gates paid Databento
  data pulls behind a human-approved spend marker. A dedicated
  `gate-auditor` subagent's entire job is to *distrust* reported numbers and
  independently re-derive them, hunting specifically for look-ahead bias,
  optimistic fills, contract-roll contamination, burned-window reuse, and
  "n-laundering." Every signal module ships a no-lookahead unit test (e.g.
  `test_signals.py` corrupts *future* prices and asserts *past* signals
  don't change).

## 2. Head-to-head

| Dimension | Research Desk | noisebot |
|---|---|---|
| Validation methodology | None — any date range/param combo runs instantly, no split enforced | Pre-registration, walk-forward halves, parameter plateau, bootstrap ruin risk, once-only OOS |
| Fill realism | Same bar's close, no slippage | Next-bar open, adverse tick/bps, realistic cost fixtures |
| Statistical gates | None | n≥100, PF>1.3, both-halves, plateau, P(ruin)<10%, Sharpe ≥ buy-hold |
| Position sizing | 100% in/out, flat fee | Vol-targeting (CTA-style), GARCH(1,1) tested head-to-head and *rejected* as not worth its complexity |
| Live-monitoring rules | None | Pre-committed decay rule (auto-offline on WR/DD breach) |
| Test suite | None | Per-strategy no-lookahead tests, synthetic-data pre-verification, adversarial gate-auditor subagent |
| Data sources | Binance klines (free), Alpaca (optional), CSV | Databento (paid, tick-grade CME futures), Binance Vision archives, Yahoo fallback |
| Asset coverage | Crypto + US stocks (generic) | MNQ futures, BTC/ETH/SOL trend + carry, ES/ZN, EURUSD — genuinely cross-asset |
| Strategies | 3 generic templates (SMA cross, RSI reversion, buy-hold) | 2 validated crypto sleeves live in shadow trading; 7 specific documented failures |
| UI / visualization | Interactive equity chart, metrics dashboard, trade log, run history | **None** — console prints + markdown + JSONL logs |
| Track record | Zero backtests run in this account yet | 9 registered hypotheses evaluated, full audit trail |
| Maturity here | 1 commit, forked yesterday | Active daily-driver, real session history since ~mid-2026 |
| Code size/readability | ~500 lines, very approachable | ~40 Python files, dense but well-tested |

## 3. Why noisebot wins on what matters for real capital

The core issue with Research Desk isn't code quality — it's that its
backtest loop lets you do exactly the thing that produces false confidence:
pick any strategy, any date range, any parameters, see a pretty equity curve
immediately, and stop. There's no mechanism stopping you from quietly trying
five parameter sets and keeping the best-looking one (classic overfitting),
no walk-forward split, no penalty for curve-fitting, no slippage, and fills
happen at the same bar's close instead of the next bar's open — all
optimistic simplifications. noisebot's entire design exists specifically to
prevent that failure mode, and its own results log is the proof it works:
most of the strategies that would look "profitable" in a Research-Desk-style
single run (always-on momentum, VWAP reversion, ORB breakouts) were tested
there and killed once real costs, next-bar fills, and sample-half
consistency were enforced.

For the user's stated interest specifically — crypto — noisebot is *already*
further along than a generic tool could be: E4-v2 and E6 are BTC and
BTC/ETH/SOL trend-following strategies, already past Phase 2, already
running in paper-trading, with a real deployment plan. Research Desk's
crypto angle is "pull Binance candles and eyeball an SMA crossover," which
is a fine way to explore an idea, but it's not a validated edge.

## 4. Where Research Desk actually wins

To be fair to it: noisebot has **no visualization whatsoever**. Every result
is a console print statement or a markdown table. There's no equity curve,
no interactive trade log, no way to glance at shadow-trading progress
without reading JSONL logs or STATE.md. Research Desk's UI — the hover
equity chart, the metrics tiles, the trade table, the run-history list — is
a genuinely good, reusable piece of engineering that noisebot's output would
benefit enormously from. Its free Binance/CSV loaders are also a good "quick
look before you spend anything on Databento" tool, and its localStorage
preset pattern is a nice lightweight UX for parameterizing a strategy from a
form instead of editing Python.

## 5. Recommendation: layer them, don't merge them into one blob

1. **noisebot's Python core stays the system of record.** Signal logic,
   the backtest engine, `HYPOTHESES.md`, the gates, the hooks — none of that
   should be diluted or bypassed. It's the hard-won IP.
2. **Build a read-only reporting layer on top, reusing Research Desk's UI
   components.** Concretely: the `EquityChart` component and metrics-tile
   layout from `src/App.tsx`, pointed at noisebot's *actual* output —
   serialize each registered evaluation's trade list + equity series to
   JSON, parse `HYPOTHESES.md` (or maintain a structured sidecar alongside
   the prose) into a searchable table of every hypothesis with its verdict,
   n, PF, and kill criterion, and tail `logs/signals_*.jsonl` for a live
   shadow-tracking view (backtest-recomputation vs. actual signal, day by
   day).
3. **Keep Research Desk's free data loaders as a clearly-labeled "scratch"
   mode**, walled off from the registered pipeline — good for Tim to eyeball
   an idea informally, but any output from it should be flagged
   "exploratory — not a registered evaluation" so it can never be mistaken
   for a gate pass.
4. **Port the process, not the strategies.** The no-lookahead test pattern
   and the adversarial gate-auditor idea are portable practices worth using
   on *any* new strategy code. Research Desk's SMA-crossover/RSI-reversion
   strategies should **not** be dropped into `HYPOTHESES.md` as-is — they're
   instances of families noisebot has already falsified (always-on momentum,
   mean-reversion) without a fresh economic rationale; reusing them without
   re-registration would violate the one rule that makes the whole system
   trustworthy.

## 6. One thing worth flagging

`tburgernyc/noisebot` is currently a **public** GitHub repo containing
specific strategy logic, live PF/Sharpe numbers, and a named prop-firm
deployment plan. Nothing secret is committed (API keys stay in env vars per
its own non-negotiables), but if that's not intentional, it's worth locking
down before any capital actually goes live.

## 7. Suggested next step

This document is the analysis and recommendation. Actually building the
merged dashboard is a separate, multi-day effort with a few open design
questions (where the reporting layer lives — a new package in this repo vs.
a small addition to noisebot; how `HYPOTHESES.md` gets parsed without
becoming another source of truth to keep in sync). Worth scoping explicitly
before starting.
