# NBA Week 1 retrospective extension

Research-only update. NBA source: [piblop/nba-history-explorer data/nba_games.csv](https://github.com/piblop/nba-history-explorer/blob/main/data/nba_games.csv), whose README attributes the historical scores to FiveThirtyEight and SportsDataverse/ESPN. This branch pins **2,462 completed regular-season games** for NBA seasons 2024-25 (season key 2025) and 2025-26 (season key 2026) as `tests/fixtures/nba-2024-2026-regular-results.json`.

The existing `buildPregameRows` Elo engine forecasts the 2026-10-20 Detroit–Boston fixture using only prior-dated scores, and its 2026-27 game result is withheld until evaluation. The committed test verifies that changing the final result cannot change the forecast. This is a retrospective baseline, not an archived historical prediction or calibrated market edge.

**NHL remains blocked**: a complete, deduplicated and independently verified 2025-26 regular-season score history has not been pinned. Official NHL free schedule API and a 2024-25 community dataset were located, but neither alone establishes a verified 2024-25 **plus 2025-26** training history. No fabricated or stale-only probability will be reported.

Run `node --test tests/week-one-elo-replay.test.mjs`; CI prints `WEEK_ONE_ELO_REPLAY_REPORT` with NFL and NBA exact probabilities, outcomes and Brier scores. No production, API or hosting changes.
