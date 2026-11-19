# NHL calibration reliability diagnostics — research only

**Status:** research-only analysis within draft PR #49. **No deployment, live model promotion, paid API, changes to Elo ratings, or recalibration.** Input files are the already-pinned official NHL regular-season scores (2022–23 through 2025–26). The diagnostic never loads 2026–27 game results.

## How to reproduce offline

Run:

    node engine/report-nhl-reliability.mjs
    node --test tests/nhl-reliability-report.test.mjs

The CLI emits the machine-readable line **NHL_RELIABILITY_DIAGNOSTICS** followed by JSON with all raw/calibrated bins, counts, Wilson intervals, comparisons and benchmark definitions. This is a command-line research artifact, **not a user-facing sports website feature**. The report consumes the independently verified research audit's **optional read-only game observations**. The audit's default output and all underlying forecasts and coefficients are unchanged.

Data lineage: 2022–23 prior Elo; 2023–24 frozen Platt fitting; 2024–25 held-out-from-fit validation; 2025–26 exploratory diagnostics (previously inspected, NOT a pristine independent holdout). Fixed coefficients: intercept **0.019196165631756693**, slope **0.911468592402615**.

### Explicit reliability definitions

- **Home-team bins** contain the home team's predicted win probability, in ten fixed 10-percentage-point buckets from 0–10% through 90–100%; the observed rate is home-team wins / games in that bucket.
- **Favorite-confidence bins** use the larger of home-win and away-win forecast probabilities, in five fixed buckets from 50–60% through 90–100%; the observed rate is **correct winner picks**, not just home wins.
- **Wilson 95%** is a nominal two-sided *binomial interval around the observed rate*, not an interval for the predicted probability. Counts and interval width must be shown together. Empty bins have null rates/intervals; n < 30 is very small, n < 100 limited.
- **ECE** is the sample-weighted average absolute observed-minus-predicted gap (separate definitions for home 10-bin and favorite 5-bin). An ECE number does not establish reliable extremes.
- **Brier** equals mean squared home-win prediction error; lower is better. **Brier skill** = 1 − (model Brier / benchmark Brier). A positive skill score alone does not imply financial edge.
- **Constant 50% benchmark** is always Brier 0.250000; the **previous completed season's fixed home-win rate** is computed from the season before the evaluation season, never from the evaluation season's own outcomes. Also report always-pick-home *winner accuracy*, not as a probability benchmark.

## Headline results — independently verified

| Metric | 2024–25 raw | 2024–25 calibrated | 2025–26 raw | 2025–26 calibrated |
|---|---:|---:|---:|---:|
| Evaluated games | 1,312 | 1,312 | 1,312 | 1,312 |
| Correct winners | 759 | **768** | **704** | 700 |
| Brier ↓ | 0.239367 | **0.238854** | 0.249073 | **0.248520** |
| Home-bin ECE ↓ | 3.3811% | **3.1413%** | 4.3937% | **4.3243%** |
| Favorite-bin ECE ↓ | 2.2131% | **0.7320%** | 4.3261% | **4.1213%** |
| Prior-season home-win rate | 54.1159% | 54.1159% | 56.2500% | 56.2500% |
| Prior-home-rate Brier | 0.246549 | 0.246549 | 0.251143 | 0.251143 |
| Constant-50% Brier | 0.250000 | 0.250000 | 0.250000 | 0.250000 |

Calibration gains relative to identical-history raw Elo remain small: **0.000512902** Brier on 2024–25 validation, **0.000553108** on already-inspected 2025–26. Correct-winner picks rose by 9 on validation but declined by 4 on exploratory 2025–26.

## 2024–25 validation — frozen calibrated home-team bins

| Predicted range | Games | Home wins | Mean forecast | Observed | Wilson 95% observed |
|---|---:|---:|---:|---:|---|
| 0–20% | 0 | 0 | — | — | — |
| 20–30% | 18 | 3 | 26.87% | 16.67% | 5.84–39.22% |
| 30–40% | 127 | 59 | 36.57% | 46.46% | 38.01–55.11% |
| 40–50% | 317 | 154 | 45.57% | 48.58% | 43.13–54.07% |
| 50–60% | 467 | 262 | 54.86% | 56.10% | 51.57–60.54% |
| 60–70% | 300 | 202 | 64.61% | 67.33% | 61.84–72.39% |
| 70–80% | 80 | 56 | 73.53% | 70.00% | 59.23–78.94% |
| 80–90% | 3 | 2 | 82.65% | 66.67% | 20.77–93.85% |
| 90–100% | 0 | 0 | — | — | — |

## 2025–26 (previously inspected) — frozen calibrated home-team bins

| Predicted range | Games | Home wins | Mean forecast | Observed | Wilson 95% observed |
|---|---:|---:|---:|---:|---|
| 0–20% | 0 | 0 | — | — | — |
| 20–30% | 6 | 1 | 28.28% | 16.67% | 3.01–56.35% |
| 30–40% | 62 | 22 | 36.51% | 35.48% | 24.74–47.92% |
| 40–50% | 337 | 172 | 45.99% | 51.04% | 45.72–56.33% |
| 50–60% | 590 | 304 | 54.77% | 51.53% | 47.50–55.54% |
| 60–70% | 280 | 164 | 63.74% | 58.57% | 52.72–64.19% |
| 70–80% | 36 | 22 | 72.05% | 61.11% | 44.86–75.22% |
| 80–90% | 1 | 0 | 81.81% | 0.00% | 0.00–79.35% |
| 90–100% | 0 | 0 | — | — | — |

**Reading the 70–80% bin:** the observed 61.11% frequency is lower than the 72.05% mean forecast, but the Wilson interval includes 72.05%; this is NOT statistical proof of systematic overconfidence. The 80–90% bin has only one case and is not interpretable as a stable win rate.

## 2024–25 validation — frozen calibrated predicted-favorite confidence

| Favorite confidence | Games | Correct winners | Mean confidence | Actual correct rate | Wilson 95% |
|---|---:|---:|---:|---:|---|
| 50–60% | 784 | 425 | 54.69% | 54.21% | 50.71–57.67% |
| 60–70% | 427 | 270 | 64.26% | 63.23% | 58.56–67.67% |
| 70–80% | 98 | 71 | 73.45% | 72.45% | 62.88–80.32% |
| 80–90% | 3 | 2 | 82.65% | 66.67% | 20.77–93.85% |
| 90–100% | 0 | 0 | — | — | — |

## 2025–26 (previously inspected) — frozen calibrated predicted-favorite confidence

| Favorite confidence | Games | Correct winners | Mean confidence | Actual correct rate | Wilson 95% |
|---|---:|---:|---:|---:|---|
| 50–60% | 927 | 469 | 54.50% | 50.59% | 47.38–53.80% |
| 60–70% | 342 | 204 | 63.69% | 59.65% | 54.37–64.71% |
| 70–80% | 42 | 27 | 72.00% | 64.29% | 49.17–77.01% |
| 80–90% | 1 | 0 | 81.81% | 0.00% | 0.00–79.35% |
| 90–100% | 0 | 0 | — | — | — |

The **favorite bins differ from home-team bins by design**: a predicted away-team favorite still counts as a forecasted winner. Favoring a team 55% does not imply that team was the home team.

## Tests and preservation guarantees

- 1,312 unique rows in each window; the home and favorite bin counts independently sum to 1,312 in each model; correct-favorite counts sum to exactly the model's winning picks.
- Wilson math verifies known rates (including 22/36), empty bins, 0/1 and 1/1 edges, and rejects invalid successes or counts.
- Every reliability bin correctly matches its fixed interval, Wilson endpoints surround observed fractions, and weighted bin errors reproduce ECE.
- Both probability series reproduce original independent research Brier, ECE and winner counts without re-fitting anything.
- The 2024–25 benchmark derives solely from completed **2023–24** results; the 2025–26 benchmark derives solely from completed **2024–25** results.
- A changed 2025–26 final alters only downstream retrospective results: frozen Platt coefficients and 2024–25 validation output are unchanged.
- Incomplete research rows, altered promotion status or incomplete prior-season benchmark inputs **fail closed**.

This is a standalone, auditable **research diagnostics** module. No website UI is being changed, and no new model coefficients, feature weights, calibrated betting probabilities or historical odds are produced.

**Decision: keep PR #49 draft and research-only.** The already-inspected 2025–26 reliability bins must NEVER be used to tune this model. For any claim of future accuracy or betting value, first archive independent, timestamped forecasts before each 2026–27 game and settle the results afterward.
