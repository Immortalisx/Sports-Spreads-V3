# NHL fixed-parameter Elo probability calibration — research audit (2026-11-18)

> **Status: research only, PR #49 draft.** Do not deploy or promote calibration coefficients. No provider secrets, external API calls at replay time, paid sports APIs, Render deployment, website changes or production-odds updates.

## Data and strictly separated chronological windows

The official NHL Stats REST game-log source is pinned **offline**, and every season is screened for unique official game IDs, completed non-tied scores, 32 teams and 82 club appearances:

| Window | Season | Games | Allowed usage |
|---|---|---:|---|
| **Elo prior history** | 2022–23 | 1,312 | Initialize historical Elo before fitting |
| **Calibration fitting** | 2023–24 | 1,312 | Fit fixed predeclared regularized Platt adjustment from raw Elo probabilities to completed outcomes |
| **Independent chronological validation relative to fit** | 2024–25 | 1,312 | Evaluate that previously frozen adjustment; no refitting, hyperparameter search or selection from validation outcomes |
| **Later exploratory retrospective evaluation** | 2025–26 | 1,312 | Compare frozen adjustment to identical-history raw Elo; this season was **already inspected** in prior PR #49 work, so NOT an untouched independent holdout |
| **Genuinely future holdout, reserved / not evaluated** | 2026–27, **games after 2026-11-18 only** | **0 scored** | Must archive timestamped forecasts strictly before puck drop, then independently settle games after completion; do not backfill or use to tune |

Two extra official seasons (2022–23 and 2023–24) are pinned in `tests/fixtures/nhl-2022-2024-regular-results.json`; existing 2024–25 and 2025–26 seasons remain in `tests/fixtures/nhl-2024-2026-regular-results.json`. Each file has 2,624 regular-season games. **All four seasons total 5,248 scored games.** The 2022–23 season includes a rescheduled April 14, 2023 final despite its last official game ID having an April 13 date. The older years include Arizona (ARI); the later years include Utah (UTA). The model uses canonical recorded tricodes, meaning a relocated franchise may initialize with a neutral Elo rating when its code changes; this is a known limitation.

The raw Elo model is exactly the existing `buildPregameRows(...,'nhl')`, not replaced or retuned: **+28 home Elo, K=16, offseason shrinkage 0.65**. Each day's games are forecast from **previous-day** state; same-day finals update ratings only after all forecasts for that day.

## Prespecified calibration method

One predeclared ridge-regularized logistic (Platt-style) transformation of raw home-win probability:

`p_cal = sigmoid(intercept + slope * logit(p_elo))`

Penalty targets: intercept = 0 and slope = 1; L2 penalties both **0.03**; deterministic full-batch gradient descent **1,600 iterations** at step **0.25**; intercept limited to [-1.5,1.5], slope to [0.25,2.5]. The fitting code only receives **2023–24** outputs/labels. No 2024–25 validation data or 2025–26 diagnostic data is used to fit or choose hyperparameters.

The resulting frozen coefficients are **intercept +0.0191961656, slope 0.9114685924**, fitted through April 18, 2024. Subsequent holdout results may update the *underlying Elo* on later dates but cannot modify these coefficients.

## True time-separated validation (2024–25)

| Metric | Raw Elo (same four-season chronology) | Frozen Platt adjustment |
|---|---:|---:|
| Games | 1,312 | 1,312 |
| Correct picks | 759 | 768 |
| Accuracy | 57.8506% | 58.5366% |
| Brier (lower better) | **0.239366776** | **0.238853874** |
| Log loss | 0.671426582 | 0.670322002 |
| 10-bin ECE | 0.033810975 | 0.031412896 |

The adjustment improved Brier by **0.000512902** on the separate validation year. These are **not** the in-sample 2023–24 fit metrics.

## Exploratory later evaluation (2025–26, already inspected)

Fair attribution compares calibrated and uncalibrated **identical-history** raw Elo forecasts, with the same prior games and identical updated Elo ratings; the only difference is the frozen probability transform.

| Metric | Raw Elo | Frozen Platt adjustment |
|---|---:|---:|
| Games | 1,312 | 1,312 |
| Correct picks | **704** | **700** |
| Accuracy | **53.6585%** | **53.3537%** |
| Brier (lower better) | **0.249072652** | **0.248519544** |
| Log loss | 0.691597208 | 0.690380478 |
| 10-bin ECE | 0.043937189 | 0.043242824 |

- Absolute Brier improvement: **+0.000553108** (raw minus calibrated; +0.22% relative to raw Brier).
- Paired **game-date-cluster** bootstrap (1,000 deterministic resamples, 167 dates) gives a nominal **95% interval [+0.000102890, +0.000967905]** for Brier improvement.
- Both variants only slightly beat the **0.25** Brier of a 50% constant probability forecast.
- **Winner accuracy got worse by 4 games.** Better Brier does not imply better winner picks, and none of these metrics proves sportsbook value or profitability.
- The original *shorter-history* 2024–25-trained Elo baseline scored **0.248930334** on 2025–26; this is not the matched control for the new calibration, because its Elo initial history differed. Do not attribute the difference from that value to recalibration.
- **No independent future holdout has yet been scored**. Because we previously inspected 2025–26, the nominal bootstrap interval is exploratory and must not be marketed as conclusive proof of a new out-of-sample advantage.

The calibrated model is **NOT eligible for production promotion** until independently archived future pregame forecasts demonstrate better calibration and ideally comparisons to real pregame odds.

## Leakage, integrity, and reproducibility

`tests/nhl-elo-calibration-research.test.mjs` verifies:

1. Official complete season source gates, 32 clubs × 82 games, no duplicate game IDs, impossible dates, tied scores or missing game records.
2. Disjoint 2022–23 history, 2023–24 calibration fit, 2024–25 validation, and previously inspected 2025–26 diagnostic. The future 2026–27 season is **not loaded, fitted or scored**.
3. Changes to **2025–26** outcomes cannot modify calibration coefficients or independent **2024–25** validation.
4. Changes to **2024–25** validation outcomes cannot modify the earlier **2023–24** fitting coefficients.
5. Reversing a game's final cannot change its own raw/calibrated pregame probabilities or those of other games on the same date; later forecasts are permitted to change.
6. Reversing the last 2025–26 final leaves all raw and calibrated pregame probabilities invariant.
7. Accuracy, Brier, log loss, 10-bin ECE, monthly counts and date-cluster bootstrap are computed from individual observed results without leaking future labels.
8. An invalid or incomplete history fails closed with `not_testable` and no calibrated output.

Reproduce offline on the research branch:

```bash
node engine/nhl-elo-calibration-research.mjs
node --test tests/nhl-elo-calibration-research.test.mjs
node engine/nhl-elo-calibration-research.mjs --games > nhl-elo-calibration-full-audit.json
```

The `--games` export includes all 1,312 game IDs, dates, raw probabilities, calibrated probabilities, predicted/actual winners, per-game Brier losses and prior-game evidence dates. CI prints `NHL_ELO_CALIBRATION_REPORT` without network or paid providers.

**Limitations:** This is a date-only reconstruction from official historical final results, not preserved contemporary forecasts with authenticated pregame timestamp proofs. It does not incorporate confirmed goalies, injuries, lineups, historical odds or ROI. Model selection has been kept off the already-examined 2025–26 outcomes. Reserve future 2026–27 fixtures after November 18 for a true prospective evaluation where predictions must be stored before the outcome exists.
