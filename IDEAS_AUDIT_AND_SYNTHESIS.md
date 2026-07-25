# Audit & Synthesis: 4 uploaded indicators vs. the existing noisebot corpus

Source: `ideas.odt` (4 public-style indicator scripts). Same treatment as
the Alpha-Scope indicator: trace the actual boolean logic that would gate
a trade, not the plot/coloring code or the name on the tin, then check it
against everything already registered in `HYPOTHESES.md` before proposing
anything new.

## TL;DR

Of the 4, **two are mechanistically fresh** relative to what's already been
tested here (Capitulation Finder — volume-climax mean reversion; the
Pivot/Livermore structure indicator — swing breakout with failure-swing
invalidation). **Two are close cousins of already-falsified or
already-drafted families** (Ichimoku TK cross, MTF Compass Pro) and are
not recommended as standalone registrations — external evidence for plain
MA/Donchian crossovers is weak, and both overlap mechanically with the
noise-area baseline / E1 / the E15 draft. MTF Compass's multi-horizon
alignment output is still useful, just not as a standalone signal — it's
a well-built **regime classifier**, and regime-conditioning is exactly
where a combination across all 4 ideas earns its keep: use it to decide
*whether* to run the mean-reversion logic or the trend-structure logic,
rather than running either blindly all the time.

Three drafts follow this doc: **E16** (Capitulation Finder), **E17**
(Pivot/Livermore structure), and **E18** (the regime-switched
combination of the two, gated by a simplified MTF-Compass-style
classifier). Per `.claude/skills/register-hypothesis`: these are drafts
for your sign-off, nothing has been run on real data, and per the
E4→E4-v2 precedent, **E18 should not be evaluated until E16 and E17 have
real standalone numbers** — you can't attribute a combined result to
either half otherwise.

## Outcome (2026-07-25 update — this section postdates everything below it)

E16 and E17 were subsequently registered in `noisebot`'s `HYPOTHESES.md`
and evaluated once each, per the plan above. **Both falsified.**

- **E16 (Capitulation Finder): FAIL, 5/6 gates.** n=72 (<100 required),
  PF=0.662 (<1.3), both sample halves negative, all three plateau cells
  negative, bootstrap ruin risk 95.8% (vs. <10% required). Only the
  correlation gate passed — essentially zero correlation with the
  existing trend sleeves (0.02 vs. E4-v2, 0.07 vs. E6), confirming the
  mechanism really is distinct, it's just not profitable on this data.
- **E17 (Livermore pivot-structure): FAIL on kill criterion.** n=47
  and bootstrap ruin risk 74.1% both failed independently, despite
  PF=7.6, both halves positive, all plateau cells strongly positive,
  and Sharpe (1.41) beating buy-hold (0.96) — structurally similar to
  E4's original story before the E4-v2 vol-targeting fix. Not acted on;
  a sizing variant would need its own registration, and E17's
  correlation with E4-v2/E6 (0.72/0.59) suggests it might not add much
  diversification even if it passed.
- Before either result was written permanently, an adversarial audit
  (applying `noisebot`'s own `gate-auditor` persona) independently
  re-derived every number and caught two real issues, both fixed before
  finalizing: the correlation gate had no committed/reproducible script
  (fixed, now lives in `phase2_e16.py`/`phase2_e17.py`), and
  `e16_capitulation.py`'s `run_backtest()` had a genuine fill-timing bug
  where exits captured the full close-to-close return instead of
  stopping at the next bar's open as documented — fixed, verified
  against the test suite, and confirmed not to change the verdict.
- **E15** (Alpha-Scope) and **E18** (the regime-switch) remain drafted
  only, not registered or evaluated, exactly as recommended below.

Full registration entries, verdicts, and "Read" writeups are in
`noisebot`'s `HYPOTHESES.md` (not this repo — this doc predates and
doesn't duplicate that record). This update exists so this document
doesn't read as a live, open recommendation after the question it was
answering has already been settled.

---

## 1. Capitulation Finder

**What it actually computes** (no bugs or dead code found — unlike
Alpha-Scope, this one is internally coherent): RSI(14) at an extreme
(≤30 / ≥70) **AND** price extended beyond a moving average by a %
threshold (SMA(50) ± 5% by default) **AND** volume ≥ 1.2× its 20-period
average — all three required on the *same* bar. A looser variant
(RSI + volume only, no MA-distance requirement) is registered as a
separate, weaker "confirmation" signal.

**Mechanism family**: volume-climax mean reversion — a genuine "buying/
selling exhaustion" signal (RSI + price extension identify *how
stretched* price is, volume identifies *whether a real capitulation
event*, not just drift, produced that stretch). This is **distinct from
E2** (VWAP-stretch mean reversion, falsified: PF 0.79, decisively dead on
MNQ) — E2's trigger was a pure price/VWAP z-score with no volume
condition at all; this is a fundamentally different trigger.

**Practical concern**: requiring all three extremes simultaneously on one
bar is restrictive — true climax bars are rare by construction, so `n≥100`
may require either a long history or a small multi-asset universe (BTC +
ETH, matching E6's per-asset-episode convention) rather than a single
asset over a short window.

**No exit rule is defined in the source** (it's a signal/marker
indicator, not a full strategy) — E16's draft designs one: exit at
reversion-to-MA (the mechanism's own target), with a time-stop and a
fixed hard stop as risk controls, since research below flags that
"oversold" can persist through a real crash.

## 2. Ichimoku TK Crossover

**What it computes**: Tenkan-sen (9-period Donchian midpoint) crossing
Kijun-sen (26-period Donchian midpoint). No volume filter, no volatility
filter, no confirmation of any kind — a raw crossover.

**Mechanism family**: momentum/crossover — mechanically almost
indistinguishable from the noise-area baseline (already falsified, PF
0.98) and E1 (ORB breakout, falsified). It is also collinear with MTF
Compass's own short-horizon leg (EMA(20) vs. price + slope): both are
"is a short/medium-term trend turning" detectors built from different
math on the same underlying idea. Stacking both would repeat E8-R's
audited mistake (dropping a collinear ADX/CMO double filter).

**External evidence** (see Research below): mixed-to-weak. One backtest
source shows a profit, but only by combining Tenkan-Kijun with additional
filters (price-vs-cloud, etc.) — not the pure crossover. Another source
states plainly that long-term Ichimoku backtests lagged buy-and-hold and
that verified track records net of costs are hard to find.

**Recommendation**: not registered standalone. Its economic content is
already covered by MTF Compass's short-horizon leg in E18's regime
classifier.

## 3. MTF Compass Pro

**What it computes**: three independent trend "biases" (short EMA(20),
mid EMA(50), long EMA(200)), each requiring price-vs-EMA direction, a
slope normalized by ATR% (must exceed a minimum, so a flat MA doesn't
count), and RSI(14) confirmation (≥55 bull / ≤45 bear). Aggregates into
"all 3 aligned" / "≥2 aligned" / "disagree" and prints a mode label
(`TREND MODE` / `Trend Bias` / `RANGE MODE: Fade Extremes`). Each single-
horizon bias is a reasonably well-built 3-leg confirmation (level +
slope-strength + momentum), better built than the raw Ichimoku cross —
but building E18's simplified version of this surfaced a real bug: the
slope-normalization formula (`normSlope`) divides a raw price difference
by a percentage NUMBER without converting the numerator to a percentage
first, so the ratio scales with the absolute price level instead of
being a clean multiple of ATR%. Confirmed on synthetic data (price ~100):
the ratio came out in the tens against the default 0.1 threshold, so the
slope condition was satisfied on 99.6% of bars — the "must be sloping
meaningfully" filter was close to vacuous as shipped. Fixed in E18's
regime classifier; see `E18_HYPOTHESIS_DRAFT.md`.

**Mechanism family**: also momentum/trend-alignment — same family as
Ichimoku, the noise-area baseline, E1, and the E15 draft's channel
breakout. Not recommended as a standalone directional signal for the same
reason.

**Where it's actually useful**: not as a signal, but as a **regime
classifier**. Its 3-way alignment output is a genuinely different *kind*
of thing than a directional bet — it's exactly the kind of read a
discretionary trader uses to decide which playbook applies. E18 reuses a
simplified version of this (alignment count only, dropping the RSI leg to
avoid re-adding Capitulation Finder's own RSI condition twice into one
combined system) as the gate between E16 and E17.

## 4. Pivot Levels & Candle Color ("Livermore structure")

The most sophisticated of the four, by a clear margin. Swing pivot
detection (look-left/look-right, with a timeframe-adaptive confirmation
factor that scales with `sqrt(resolution/240min)` — a real attempt to
make the same bar-count parameters behave consistently from 4h to
daily), a significance filter (drop a pivot if a more extreme one exists
nearby), then an explicit trend-state machine: breakout above the last
confirmed pivot high → bullish; track a high-water-mark and a "reaction
low" (lowest point since the breakout); invalidate back to neutral if
price breaks the reaction low (a failure-swing stop-out) **or**, after
enough bars have passed, if the recent range shows no new highs, has
gone tight, and price is hovering near its midpoint (a genuine
three-part *stall/consolidation* detector — distinctly different from a
fixed trailing stop). Mirror logic for bearish.

**Audit findings** (revised after actually building the port — the first
pass at this section undersold one finding and mischaracterized another):
- **A real repaint/lookahead bug, the important one.** A pivot at bar `i`
  needs `pivot_right_bars` bars AFTER `i` to confirm (the right-side
  reversal check) — it isn't actually known until bar `i + right`. The
  source stores it at index `i` and its trend-state loop reads it at that
  SAME index `i` — a classic chart-indicator repaint property (fine for
  looking at a historical chart, fatal for a backtest, since it trades on
  information that wasn't available yet). `e17_pivot_structure.py` fixes
  this by shifting pivot availability forward by `right` bars, verified
  by a dedicated test in addition to the standard no-lookahead check.
- **Not a redundancy after all.** The initial read of this doc called the
  pivot-confirmation-factor check "almost tautological" against the
  separate right-side-max check. A closer trace shows that's wrong: "no
  new high in the right window" (the max check) does NOT imply "at least
  one right-side bar pulled back meaningfully" (the factor check, which
  requires dropping below the pivot by a real, timeframe-scaled margin,
  not just marginally). They jointly enforce two different things —
  correction, not a redundancy, and both are implemented as specified.
- One real engineering issue, not a correctness bug: the reaction-low/
  -high tracker is recomputed by rescanning the *entire* leg on every new
  high-water-mark bar — worst-case O(n²) together with the pivot-
  significance filter's own pairwise comparison. `e17_pivot_structure.py`
  replaces it with an O(1)-amortized accumulator, cross-checked against a
  literal port of the original rescan on synthetic data (0 mismatches
  across 2000 bars) rather than just asserted equivalent.

**Mechanism family**: price-structure breakout with explicit
failure-swing invalidation — related in spirit to E1 (ORB breakout,
falsified) and H3-EXT (SMC/ICT, falsified), so **not obviously a fresh
mechanism either** — registering it demands the same honesty those two
got. But the specific combination (confirmed swing pivots + reaction-low
stop-out + three-part stall detector) is meaningfully more developed than
either falsified relative, and — per the Swing Failure Pattern research
below — this exact class of pattern is known to be regime-dependent in a
way that's directly actionable (see E18).

---

## Research (practitioner evidence, not peer-reviewed — flagged honestly)

Unlike E1/E3/E4/E5's citations (Zarattini/Barbon/Aziz, Baltussen/Da/
Lammers/Martens JFE 2021, Moskowitz/Ooi/Pedersen, Harvey/Mazzoleni/Melone
NBER), nothing found below is peer-reviewed academic literature — it's
practitioner/vendor content. Treat it as directional color for the
economic-rationale field, not as evidence on par with the existing
entries' citations.

- Volume climax / capitulation: well-documented practitioner pattern —
  exhaustion of buying/selling pressure marked by a volume spike (often
  cited as 3-5x normal) plus a rejection wick, targeting reversion to a
  moving average. Explicit, important counter-evidence found in the same
  search: **oversold conditions do not reliably produce a reversal, and
  crypto specifically can stay oversold through extended real declines**
  (cites Bitcoin's Nov 2018 crash below $3,200 as a case where RSI stayed
  pinned at extreme-oversold through the entire decline). This is exactly
  why E16 registers a hard stop, not just an RSI-recovery exit.
  [Volume exhaustion](https://fastercapital.com/content/Volume-exhaustion--Detecting-Price-Reversals-through-Volume-Analysis.html) ·
  [Reversal Bar Patterns: Buying and Selling Climaxes (IBKR Campus)](https://www.interactivebrokers.com/campus/traders-insight/securities/technical-analysis/reversal-bar-patterns-part-3-buying-and-selling-climaxes/) ·
  [What Is Capitulation in Trading?](https://www.tradingsim.com/blog/capitulate) ·
  [What is Capitulation? Historical Bottoms in Crypto (KuCoin)](https://www.kucoin.com/blog/what-is-capitulation)
- Swing Failure Pattern (directly relevant to the Pivot/Livermore
  indicator's failure-swing invalidation leg): a commonly cited (not
  independently verified) figure claims **~74% win rate in consolidation
  vs. ~52% in strong trends** for this pattern family — i.e., a real,
  specific claim that this exact mechanism is regime-dependent, which is
  the direct justification for gating trend-structure trades on a regime
  read in E18.
  [Swing Failure Pattern (Morpher)](https://www.morpher.com/blog/swing-failure-pattern) ·
  [Swing Failure Pattern Strategy (QuantVPS)](https://www.quantvps.com/blog/swing-failure-pattern-strategy) ·
  [In-Depth Exploration of the Swing Failure Pattern (LuxAlgo)](https://www.luxalgo.com/blog/in-depth-exploration-of-the-swing-failure-pattern/)
- Ichimoku TK cross: mixed at best. One source shows a profitable
  backtest but only by combining TK-cross with additional filters, not
  the crossover alone; another states long-term Ichimoku backtests lagged
  buy-and-hold and clean net-of-cost track records are hard to find.
  Reinforces treating it as a cousin of already-falsified crossover
  families rather than a fresh mechanism.
  [Ichimoku Cloud Trading Strategy (QuantifiedStrategies)](https://www.quantifiedstrategies.com/ichimoku-strategy/) ·
  [Does the Ichimoku Indicator work? Backtesting Tenkan-Kijun (YouTube)](https://www.youtube.com/watch?v=sIby06pIPzw) ·
  [Ichimoku Cloud Strategy on Bitcoin: 8 Years of Backtest Results (Coinquant)](https://www.coinquant.ai/blog/ichimoku-cloud-strategy-on-bitcoin-8-years-of-backtest-results)

---

## Recommended sequencing

_(Historical — this was the plan at the time this doc was written. See
"Outcome" above: step 1 is done, both falsified, which makes step 2 moot
by an even stronger version of its own stated precondition — you can't
usefully regime-switch between two falsified strategies.)_

1. Register and run **E16** and **E17** standalone first (both are
   mechanistically fresh enough to deserve their own read, independent of
   each other).
2. Only after both have real numbers, consider **E18** — and only if
   E16 and E17's *daily-return correlation with each other* turns out low
   (if they're already highly correlated, a regime switch between them
   adds complexity without diversification, and that should surface in
   E18's own correlation gate before it's worth running).
3. Ichimoku TK cross and MTF Compass's directional bias: not recommended
   standalone given the family overlap and weak external evidence: MTF
   Compass's alignment logic is reused (simplified) as E18's regime gate
   rather than shelved entirely.
