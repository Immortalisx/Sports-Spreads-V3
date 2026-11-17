# Sports Spreads — model and daily ticket status (November 17, 2026)

## Live estimates

**NBA and MLB team-record win estimates passed independent 2025-season holdout calibration** and use learned, validated record-only coefficients. **NFL and NHL have not passed the promotion gate** and retain uncalibrated estimates. No trained advanced player/lineup/scheme coefficients, validated parlay joint probabilities, or profitable betting edge are claimed. Weather for outdoor NFL and MLB games adds contextual uncertainty only; directional weather prediction is withheld pending archived **pregame forecasts** and held-out outcome validation.

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

## v5 cross-sport research pipeline (not an active advanced production model)

The model research module can fetch publicly accessible, completed-game histories for all four sports with explicit quotas: NFL community games CSV (one request), MLB official schedule (one per season), NHL official club schedules (one per club per season), and NBA unofficial ESPN daily scoreboard (bounded to 31 requested dates by default). Validation separately trains residual feature weights on earlier seasons, calibrates on the next, and compares held-out Brier/log loss on the last; it also reports a paired-bootstrap interval. **Research coefficients are not auto-promoted.** NBA and MLB record-only models were manually reviewed and promoted following their independent holdout tests; NFL/NHL and advanced factors are still research-only.

NFL QB-vs-blitz, defense-vs-offense scheme, NBA lineup/shot profiles, NHL confirmed goalies and MLB pitcher-vs-hitter observations require separate stamped, verified pregame evidence. `engine/pregame-evidence.mjs` rejects unsourced, late, mismatched or under-sampled evidence. Completed-game scorelines do NOT supply those player factors. See `docs/MODEL_RESEARCH_PIPELINE.md`.

## November 17, 2026 — calibrated records and daily tickets

- NBA record-only 2025–26 holdout: N=1,225, Brier 0.209596, ECE 0.02520; approved for this exact feature scope.
- MLB record-only 2025 holdout: N=2,430, Brier 0.245446, ECE 0.02327; approved for this exact feature scope.
- NFL record-only: holdout ECE 0.06403 exceeded preregistered .06 gate; not approved.
- NHL record-only: out-of-time Brier gain 0.001151 with interval crossing zero; not approved.
- The **Suggested Tickets** tab publishes Steady, Balanced, Upside and **The Big One**, once daily via a private cached-odds backend. All generated parlays use one supported sportsbook and source-dated moneyline prices. Market grades reflect illustrative independent-market probability products, **not calibrated multi-leg forecasts**. These are research tickets; nothing places wagers.
- The separate automatic market-target slider creates an optional same-book ticket from current cached offers; never label it a validated model edge.

Full evidence: [Calibration release](docs/CALIBRATION_RELEASE_2026-11-17.md), [Code audit](docs/CODE_AUDIT_2026-11-17.md), [GitHub Actions holdout](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44187412724).
