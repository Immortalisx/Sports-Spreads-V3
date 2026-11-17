# NFL and NHL enhanced calibration — November 17, 2026

**Release decision: research improvements committed, no automatic live-model promotion.**
Both historical candidate Brier scores were lower, but neither passed the predeclared
combination of calibration, absolute gain, paired bootstrap and benchmark checks.
The existing NFL/NHL public estimate remains explicitly *uncalibrated*.
This decision is intentional: a visually nicer confidence grade cannot substitute
for evidence of forecast accuracy.

## Exact independent methodology

- Use earlier completed game results only, constructing team Elo, prior-game offensive/defensive scoring, season form and rest days before updating any results for the same calendar date.
- NFL additionally tests coach historical head-to-head (no inferred QB-versus-blitz, coverages or injuries).
- **Four independent time windows:** NFL 2020–22 and NHL 2021–22 train; 2023 chooses candidate features; 2024 fits a separate calibrator; 2025 is the untouched test.
- Evaluate every holdout fixture (no missing advanced-data games silently excluded) against both an independently fitted record-only baseline and historical constant-home baseline.
- Require ECE <= 5.5%, absolute bias <= 4.5%, meaningful Brier/log-loss improvements, plus lower 95% paired bootstrap bounds greater than zero. No candidate may self-promote without live point-in-time inputs covering every trained factor.

| Metric | NFL 2025 | NHL 2025–26 |
|---|---:|---:|
| Train games | 795 | 2,624 |
| Feature-selection games (2023) | 272 | 1,312 |
| Calibration games (2024) | 272 | 1,312 |
| Untouched holdout games | 271 | 1,312 |
| Selected features | Elo, form, offense/defense, rest, coaching H2H | Elo, form, offense/defense, rest |
| Record-only benchmark Brier | 0.224296 | 0.248738 |
| Enhanced Brier | **0.222238** | **0.248266** |
| Enhanced ECE | 6.71% | 3.89% |
| Brier improvement against record model | +0.002058 | +0.000472 |
| Bootstrap 95% gain interval | [-0.004581, +0.008484] | [-0.000828, +0.001687] |
| Pass | **No** — poor calibration and uncertain gain | **No** — gain too small and uncertain |

## NHL source-quality fix (important)

The official NHL Web club schedule import unexpectedly returned fewer than 1,312 games and subsequently HTTP 429 errors during repeated research requests. The primary source is now **the NHL Stats REST season game listing** (`api.nhle.com/stats/rest/en/game`), which returned **exactly 1,312 completed regular-season results** for each season 2021–22 through 2025–26. This requires approximately **one free, public, research-only HTTP request per season**, rather than 32 club requests.

The source code includes a bounded official weekly schedule cross-check fallback and refuses to infer missing scores or issue calibrated metrics from an incomplete season.

## What this does *not* establish

- No verified improvement over sportsbook probabilities or any prospective betting profit.
- No validated effect for quarterbacks against blitzes, injuries, player props, starting-goalie GSAx or coaching causality.
- No validated joint multi-leg parlay probability; **The Big One** remains a high-variance market-illustration ticket, not a confident projection.
- Historical outcomes alone do not supply a licensed live Elo/lineup feature feed. A future prospective (2026 season and beyond) study and matching source are necessary before any enhanced weights can replace the live record model.

**Reproducibility:** `engine/run-enhanced-calibration.mjs --league=nfl` and `--league=nhl`, workflow [NFL & NHL enhanced calibration](https://github.com/Immortalisx/Sports-Spreads-V3/actions/workflows/enhanced-calibration.yml). Results are retained as workflow artifacts. No paid sportsbook, Firecrawl or visitor API credits were consumed.
