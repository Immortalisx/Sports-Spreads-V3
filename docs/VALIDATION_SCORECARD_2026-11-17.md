# Sports Spreads — four-sport historical model scorecard
**Date:** 2026-11-17 | **Status:** research-only, no live weight promotion

All studies use completed historical games; pregame *derived* team statistics are reconstructed using only earlier results. They do **not** reproduce archived official pregame injury, lineup, starting goalie, quarterback-vs-blitz, pitcher-vs-hitter, or sportsbook snapshots. Do not present these as verified betting probabilities or profitability.

## Held-out forecast performance

Brier / ECE lower = better. Baseline and candidate share identical *covered* holdout games.

| League | Historical seasons | Completed games | Train / validation / holdout | Candidate-covered holdout | Baseline Brier | Candidate Brier | Brier gain (95% bootstrap interval) | Baseline ECE | Candidate ECE | Decision |
|---|---|---:|---|---:|---:|---:|---|---:|---:|---|
| NFL | 2021–2025 | 1,355 | 812 / 272 / 271 | 188 (69.4%) | 0.222701 | 0.221679 | +0.001022 [-0.000582, 0.002649] | 0.073619 | 0.079626 | DO NOT PROMOTE |
| NBA | 2022–23 to 2025–26 | 4,910 | 2,460 / 1,225 / 1,225 | 1,146 (93.6%) | 0.207709 | 0.207467 | +0.000243 [0.000052, 0.000464] | 0.024145 | 0.024948 | DO NOT PROMOTE |
| NHL | 2023–24 to 2025–26 | 3,842 | 1,312 / 1,312 / 1,218 | 1,129 (92.7%) | 0.251771 | 0.251764 | +0.000008 [-0.000225, 0.000235] | 0.062654 | 0.060618 | DO NOT PROMOTE |
| MLB | 2022–2025 | 9,719 | 4,860 / 2,429 / 2,430 | 2,383 (98.1%) | 0.244979 | 0.244930 | +0.000049 [-0.000017, 0.000121] | 0.022737 | 0.022252 | DO NOT PROMOTE |

Totals: **19,826 games ingested; 4,846 candidate-covered games in independent holdout evaluations.** This is a count of completed matchups, not a prospective real-time betting sample.

**NBA source coverage:** BoxScore Lab CC BY 4.0 publishes two team rows per completed game. Importer rejects unmatched/unverifiable pairs, logs source coverage by season, and permits at most 0.5% unmatched source rows for *research only*. Coverage: 2,460 team rows in 2022–23, 2,460 in 2023–24, and 10 unmatched team rows excluded in each of 2024–25 and 2025–26. No synthetic outcomes or odds are inserted. The NBA bootstrap shows a small positive Brier effect, but ECE worsened and the improvement is below the predeclared promotion criterion.

**NHL source coverage:** 2025–26 results contained 1,218 normalized games versus 1,312 in the 2023–24 and 2024–25 imports. Investigate the data gap before comparing across all clubs or declaring production readiness.

## What was actually tested

- Historical point-in-time data reconstruction from prior completed games; no future final results leak into same-day features.
- League-specific home Elo, prior season form, rolling offensive/defensive scoring interaction, and rest-day differential.
- NFL retrospective coach head-to-head exists where earlier pair history supports it; no unsupported coach-derived weight won the study.
- Independent validation-season candidate selection, Platt-style calibration, later-season holdout, paired bootstrap intervals, Brier/log loss/ECE.
- Gated player-specific feature contracts for NFL QB-vs-blitz/coverage, NBA scheme/lineups, NHL confirmed goalies/xG, and MLB pitcher-hitter/Statcast. These **have no verified trained coefficient in the live site**.

## Source provenance and limitations

1. NFL completed games: [nflverse/nfldata](https://github.com/nflverse/nfldata/blob/master/data/games.csv), community-public source; inspect its license before commercial model redistribution.
2. NBA team-game data: [BoxScore Lab downloads](https://boxscorelab.com/downloads/), CC BY 4.0 (attribution: BoxScore Lab, boxscorelab.com, data published November 16, 2026). Derives from official NBA Stats public data.
3. MLB results: [MLB StatsAPI schedule](https://statsapi.mlb.com/api/v1/schedule), official public API, rights/redistribution not established by public accessibility.
4. NHL results: [NHL Web API](https://api-web.nhle.com/v1/club-schedule-season/), official public API, rights/redistribution not established by public accessibility.

GitHub Actions evidence: [NFL research](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44164394097), [NBA research](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44170624479), [MLB + NHL research](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44169122409). The reports were generated with the reproducible scripts under `engine/`. Artifacts are temporary (7 days for recent jobs); workflow logs and methods remain.

## Accurate release positioning

Website, phone/TV layouts, feed relay, ticket math and Discord sharing: **community beta, working**. Model: **historically evaluated but not promoted/calibrated enough for official confident predictions**. Do not label the model "best free" without prospective comparisons against market-implied and other free-model baselines.

Next steps to become truly strong: licensed pregame starters/injuries/play-by-play/Statcast feeds; matchup-specific opponent adjustments with proper sample shrinkage; multi-year rolling evaluation and calibration bins; prospective prediction ledger; robust market baseline; reliability and drift checks; independent reviews and monitored retraining. No paid subscriptions required for the research prototype, but truly high-grade source fields may require licensed data.
