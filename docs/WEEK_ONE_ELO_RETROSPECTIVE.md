# Week 1 Elo retrospective replay (research only)

Run `node engine/run-week-one-elo-replay.mjs` or `node --test tests/week-one-elo-replay.test.mjs`.

This runs the actual `buildPregameRows` Elo implementation in `engine/retrospective-model.mjs` and reconstructs probabilities for three completed 2026 opening-week games from prior-dated scores only. Same-day games are evaluated before same-day results are applied; each target final is used only to score the forecast.

- **NFL:** 543 verified 2024–25 regular-season games from pinned nflverse data. Seattle–New England, September 9.
- **NHL:** 2,624 **official NHL** regular-season results, with 1,312 from 2024–25 and 1,312 from 2025–26. The full snapshot is `tests/fixtures/nhl-2024-2026-regular-results.json`. Both seasons passed final-state, unique-ID, non-tied score, 32-team, and 82-games-per-team audits. Official team IDs were mapped to official NHL tricodes. Florida–Carolina, September 29, is reconstructed with all games ending before September 29 and target season 20262027 for proper Elo offseason shrinkage.
- **NBA:** 2,462 verified 2024–25 and 2025–26 regular-season games from the source documented in `docs/WEEK_ONE_NBA_EXTENSION.md`. Boston–Detroit, October 20.

CI prints `WEEK_ONE_ELO_REPLAY_REPORT` with exact probabilities, predicted winners, outcomes and Brier scores. Tests verify that changing each evaluated final cannot alter the predicted probability, and incomplete NHL data fails closed.

**No claim of live forecasting accuracy:** These are reconstructed research Elo baselines, not archived pregame production predictions; three games cannot establish calibration. The multifactor point-in-time replay in `docs/WEEK_ONE_POINT_IN_TIME_REPLAY.md` remains separately untestable without archived baseline/feature manifests. No production changes, deployments, live weights or paid APIs.
