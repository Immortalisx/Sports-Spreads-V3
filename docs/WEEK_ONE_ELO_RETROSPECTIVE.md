# Week 1 Elo retrospective simulation (research only)

Run `node engine/run-week-one-elo-replay.mjs` or `node --test tests/week-one-elo-replay.test.mjs`.

This executes the existing `buildPregameRows` implementation from `engine/retrospective-model.mjs`, not a fabricated replacement. It predicts the Seattle-New England 2026 Week 1 result using 543 completed non-tied **2024–25 NFL regular-season** games from the pinned nflverse `data/games.csv` blob `77580b1ff3255acb477153f993954f6e1c60a5c8`. The 2026 target result is appended only as the evaluation label; its score cannot change the predicted probability. Earlier-season Elo ratings carry forward with the model's existing 0.65 offseason shrinkage and fixed home advantage. Same-day scoreboards are batched before update by the model.

The prior 2024–25 NFL game log snapshot is committed as `tests/fixtures/nfl-2024-2025-regular-results.json`. The three targets and independent result citations remain in `tests/fixtures/week-one-2026-results.json`. **NBA and NHL are explicitly not scored** because this branch does not contain equivalent verified 2024–25 game histories. Do not substitute unverified team ratings, generate synthetic outcomes or claim 3/3 accuracy.

CI test logs emit a `WEEK_ONE_ELO_REPLAY_REPORT` line with exact results, home win probability, predicted winner, correctness and Brier score. A single game is illustrative, not a calibrated model validation. No archived pregame snapshots, odds, injuries, lineup features, advanced multifactor manifest, or prospective accuracy are established. No production code, live weights, or paid APIs are changed.
