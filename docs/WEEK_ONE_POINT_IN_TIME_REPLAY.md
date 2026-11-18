# Week 1 point-in-time replay (research only)

Three completed 2026 season-opening games are pinned in `tests/fixtures/week-one-2026-results.json`:

| League | Game | Kickoff (ET) | Final (home-away) | Result |
|---|---|---|---|---|
| NFL | New England at Seattle | Sep 9, 8:20 PM | SEA 13–NE 10 | Seattle won |
| NHL | Florida at Carolina | Sep 29, 5:20 PM actual | CAR 0–FLA 1 (OT) | Florida won |
| NBA | Boston at Detroit | Oct 20, 3:00 PM scheduled | DET 121–BOS 113 | Detroit won |

Sources are linked per record (NFL NBC Sports; NHL official game summary; NBA official game recap). Scheduled NBA kickoff is not an independently verified actual tip-off; the harness therefore uses the scheduled boundary conservatively, and a real historical snapshot must be timestamped strictly before it.

The `engine/week-one-point-in-time-replay.mjs` harness calls the **actual** `public/multifactor-engine.js` `SportsMultifactor.estimate` contract. The result score is **never** passed into the model. A prediction is scored only if a separately supplied archived pregame baseline, verified feature timestamps and preexisting validated model manifest pass the model's own checks. A missing or late snapshot fails closed.

**Measured replay availability: 0/3 independently testable.** There are no archived, attributed pre-kickoff baseline/evidence/validated-manifest bundles in this PR for these three games. The harness therefore produces **no** model win picks, probabilities, score forecasts, Brier accuracy or ROI estimates. This is a real data-coverage result, not a prediction failure or model success.

Run: `node --test tests/week-one-point-in-time-replay.test.mjs`. Production, live weights and provider APIs are untouched. Research-only and no paid data.
