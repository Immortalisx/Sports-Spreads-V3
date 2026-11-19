# NHL 2025–26 chronological Elo walk-forward audit

> **Research only — draft PR #49.** Official completed-game scores reconstructed sequentially. Not an archived 2025–26 pregame forecast, not a validated betting model, and **not a production promotion**. No paid API, Render deployment, site code, live weights, or sportsbook assumptions.

## Inputs, eligibility, chronology

- **Source:** committed `tests/fixtures/nhl-2024-2026-regular-results.json`, derived from the two **official NHL Stats REST** regular-season feeds documented in `docs/WEEK_ONE_NHL_EXTENSION.md`.
- **Training:** all 1,312 regular-season finals in 2024–25 (Oct 4, 2024–Apr 17, 2025). All **32 clubs have 82 games** before the test season begins. No 2025–26 result used to select Elo hyperparameters or fit a calibrator.
- **Out-of-sample forward replay:** **all 1,312** 2025–26 regular-season games, Oct 7, 2025–Apr 16, 2026. Predictions are generated with prior-day Elo values; updates occur after **all games on the same calendar date** have been predicted. Subsequent dates may use earlier completed 2025–26 games, as they would in a live sequential model.
- **Unchanged actual engine:** `buildPregameRows(..., 'nhl')` in `engine/retrospective-model.mjs`, fixed +28 Elo home edge, K-factor 16, and offseason rating shrinkage 0.65. This is **raw Elo**, no validation-fitted logistic recalibration and no goalie/injury/odds features.
- **Source gates:** 2,624 unique official season game IDs, precisely 1,312 per season, 32 team codes with exactly 82 appearances each season, legal non-tied final scores and date windows. Malformed/incomplete input returns **not_testable** with no probabilities.

## Verified holdout summary — 2025–26

| Metric | Result |
|---|---:|
| Games evaluated | **1,312 / 1,312** |
| Correct winner picks | **703** |
| Winner accuracy | **53.5823%** |
| Brier score (lower better) | **0.2489303341** |
| Log loss (lower better) | **0.6912798572** |
| ECE, 10 equal-width home-win bins (lower better) | **0.0452690701** (4.5269 percentage points) |
| Mean predicted home-win probability | 53.7971% |
| Actual home-win frequency | 52.2104% |
| Brier: always predict 50% | **0.2500000000** |
| Brier: fixed prior-season home-win rate (56.25%) | **0.2511432927** |
| Absolute Brier improvement vs 50% | **0.0010696659** |
| Winner accuracy of always picking home | 52.2104% (for perspective, not a probability model) |

**Interpretation:** The Brier improvement over a trivial 50% benchmark is **extremely small**. An accuracy result above 50% is not proof of predictive value, and no profitability can be inferred without genuine pregame prices. These tests do **not** justify exposing NHL probabilities as production-calibrated confidence grades. High-confidence predictions particularly warrant more evaluation.

## Monthly performance

| Month | Games | Correct | Accuracy | Brier |
|---|---:|---:|---:|---:|
| October 2025 | 180 | 91 | 50.56% | 0.251719 |
| November 2025 | 225 | 108 | 48.00% | 0.256346 |
| December 2025 | 226 | 114 | 50.44% | 0.253095 |
| January 2026 | 240 | 128 | 53.33% | 0.248875 |
| February 2026 | 74 | 50 | 67.57% | 0.216407 |
| March 2026 | 242 | 140 | 57.85% | 0.250129 |
| April 2026 | 125 | 72 | 57.60% | 0.241078 |
| **All** | **1,312** | **703** | **53.58%** | **0.248930** |

## Reliability diagram data (home team win probability, 10 equal-width bins)

| Forecast range | Games | Mean forecast | Actual home wins |
|---|---:|---:|---:|
| 0–20% | 0 | — | — |
| 20–30% | 6 | 26.56% | 16.67% |
| 30–40% | 78 | 36.17% | 34.62% |
| 40–50% | 340 | 45.80% | 51.47% |
| 50–60% | 566 | 54.80% | 51.94% |
| 60–70% | 273 | 63.95% | 58.24% |
| 70–80% | 48 | 72.33% | 60.42% |
| 80–90% | 1 | 83.54% | 0% |
| 90–100% | 0 | — | — |

ECE is sample-weighted absolute mean calibration error; low-count extremes are inherently unstable. The **single** 80–90% case lost, producing a misleadingly large maximum per-bin error; don't treat that one observation as a stable calibration estimate.

Favorite-confidence bins (predicted winner, not only home): 50–60% confidence = **459/906 (50.66%)**, 60–70% = **210/351 (59.83%)**, 70–80% = **34/54 (62.96%)**, 80–90% = **0/1**, above 90% = **0 games**. That pattern is not evidence of adequate favorite calibration.

## Leakage and integrity regression tests (CI)

1. The first 2025–26 prediction is not eligible unless **all 1,312** preceding-season games and all 82 previous-season games per club are present.
2. All **1,312** holdout matches are scored once, with unique IDs and probability in (0,1). Every available prior-game evidence date is **strictly earlier** than the fixture date.
3. **Flip the first 2025–26 game's final**: its own probability and all same-day probabilities are **unchanged**; its outcome/Brier changes, and future-day forecasts are allowed to change.
4. **Flip the final 2025–26 game's final**: no earlier prediction, nor its same-day predictions, changes.
5. **Remove future games from an independent replay**: all remaining earlier predictions match the full-history replay exactly.
6. Reverse the input row order: historical chronological sorting produces identical probabilities and summary.
7. Delete one game, duplicate an ID, create a tied/incomplete final, invent a team or move a source date outside the season: **not_testable**, no probability output.
8. Verify Brier, accuracy, log loss, ECE and monthly/bin aggregations directly from all 1,312 individual probabilities; no unverified or manufactured data.

## Reproduction and complete game-level report

```bash
node engine/run-nhl-walkforward.mjs
node --test tests/nhl-walkforward.test.mjs
node engine/run-nhl-walkforward.mjs --games > nhl-walkforward-2025-26.json
```

`--games` exports **every** date, team, game ID, home probability, predicted winner, observed winner, correctness, Brier contribution and prior-team evidence cutoff alongside the scorecard. The default prints compact `NHL_WALKFORWARD_REPORT` in CI logs. No HTTP requests or paid providers are used.

The retrospective date-only (not timestamp-archived) reconstruction deliberately delays all same-date scores until the next date. It does not represent demonstrated historical production outputs and lacks historical closing odds, time-stamped goalie confirmations, lineups and injury data. Model promotion requires independent subsequent holdouts and an evidence-backed probability/market calibration audit.
