# NFL retrospective baseline versus rest and coaching — research report

**Historical source:** nflverse `nfldata/data/games.csv` (retrieved November 17, 2026). https://github.com/nflverse/nfldata/blob/master/data/games.csv

**Method:** Completed regular-season games from 2012–2025. Each prediction is constructed in game-date order, using only prior completed games to calculate current-season team win rates, coach records and previous-game rest. The baseline matches the site's version 0.1 record-shrinkage and assumed home advantage parameters. Train residual coefficients through 2022 and evaluate on 2023–2025 results. Retrospectively reconstructed features are NOT archived point-in-time prediction snapshots, and end-of-game weather cannot be treated as a known pregame forecast. This is a *research diagnostic*, not an independently certified prediction engine.

| Model | Train games | Holdout 2023–25 | Brier | Comparable baseline Brier | Calibration ECE |
|---|---:|---:|---:|---:|---:|
| Season-record baseline | 2,835 | 815 | **0.22869** | 0.22869 | 0.0501 |
| + Pregame rest differential | 2,661 | 767 | 0.22741 | 0.22747 | 0.0471 |
| + Prior coach W–L differential | 76 | 100 | 0.24033 | 0.24058 | 0.0926 |
| + Rest and coach | 74 | 98 | 0.24048 | 0.24122 | 0.0492 |

Regular-season completed games (excluding ties) used: **3,650**. The difference in available samples is because coaches require 100 prior games per coach and teams require one prior game for rest; missing features are excluded rather than replaced with zero.

**Decision:** DO NOT PROMOTE any advanced coefficient. Rest provided negligible improvement on comparable samples. Coaching was too sparse, with poor observed calibration. Head-to-head coach history is especially small and confounded by changes in rosters and staff; it remains descriptive. QB-vs-blitz/coverage data were not present in this archive, so there is no validation claim for those factors. The historical dataset contains actual weather (not archived pregame forecasts), so directional weather weights are not trained from it.

The engine and validation runner now support point-in-time provenance and future out-of-time cohorts for NFL, NBA, NHL and MLB. `npm run validate:model` reports missing historical data unless a legitimate dataset is provided. Synthetic tests validate software behavior, *not* predictive performance. Metrics here are not evidence of profitability; no sportsbook odds were used.

**Validation target for promotion:** An independent chronological holdout, adequate samples and feature coverage, Brier improvement over the exact same held-out games, acceptable calibration and a reviewed published manifest. Future changes should require repeated out-of-season holdouts and calibrated uncertainty bands.
