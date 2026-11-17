# Sports Spreads v4 — model status

## Live estimates

The live site estimates scheduled game results using **experimental current-season team record form**, Bayesian-style shrinkage and an assumed league-specific home effect. No trained multi-factor coefficients or profitable betting edge are claimed. Weather for outdoor NFL and MLB games adds contextual uncertainty only; directional weather prediction is withheld pending archived **pregame forecasts** and held-out outcome validation.

## Engineered advanced factors — implemented as source-gated features

- **NFL:** quarterback vs blitz, pass efficiency against man/zone and opponent coverage mix, protection versus pass rush, coaches' opposing strategies/head-to-head, roster availability, rest and travel.
- **NBA:** lineup on/off and active status, pace and possession quality, defensive scheme vs offensive shot profile, rim and 3-point interactions, back-to-backs, coaching rotations.
- **NHL:** confirmed starter and goals saved above expected, 5-on-5 xG/chance quality, line deployments, power play vs penalty kill, back-to-backs, coaching systems.
- **MLB:** confirmed starting pitcher vs projected hitter handedness/pitch mix and xwOBA splits, bullpen workload, lineup/platoon data, fielding and park/weather interaction, manager substitutions.

The code now defines per-factor source, sample, timestamp, and opponent-relative input validation in `public/multifactor-engine.js`. **No factor silently receives an invented weight.** Its trained model gate requires a reviewed, time-separated holdout result that improves Brier score and meets calibration thresholds. Without a passing manifest, live probabilities remain the visible record-based baseline.

`engine/walkforward.mjs` and `engine/backtest.mjs` provide train/holdout split, regularized logistic residual fitting, Brier, log loss, calibration ECE and strict rejection of future-dated or synthetic data. Usage: `npm run validate:model -- --input=private/game_snapshots.json --league=nfl --features=rest_travel,coach_adjustments`. The CLI is research-only and cannot auto-publish a winning model.

## Actual retrospective evaluation

See [`docs/NFL_BACKTEST_2023-2025.md`](docs/NFL_BACKTEST_2023-2025.md). The public nflverse archive yielded 815 NFL holdout games for the record-based baseline (Brier **0.22869**). Rest on its comparable 767 games improved Brier from 0.22747 to 0.22741. Coaching had only 100 holdout observations and an ECE of 0.0926. **No advanced coefficient was promoted.** This is a historical reconstruction, not a point-in-time saved forecast ledger; QB/coverage and MLB/NBA/NHL sophisticated historical factors have no validated source-connected rows yet.

## Remaining data / model work

- Integrate vetted, permitted historical feature datasets for player-vs-scheme and personnel; archived **pregame** availability and odds rather than after-the-fact box scores.
- Train and hold out data by complete seasons, benchmark and calibrate by league, check subgroup calibration and injuries/lineups as-of, and measure reliability under live daily snapshots.
- Store immutable model forecasts and compare them with actual outcomes; separately validate player props and same-game correlations before producing confidence or expected value.
- Obtain stable supported data-provider terms prior to broad public or commercial usage. Current ESPN feed is unofficial and could be blocked.

This free community beta is intended for usability feedback and exploratory research; no live verified betting lines or bankroll guidance are provided.
