# Sports Spreads — experimental model promotion criteria

**The public site is a usability beta. None of the advanced four-sport prediction coefficients have passed promotion.**

## Research standards before declaring a calibrated probability model

1. **Legal and durable sources.** Document each field's origin and license before ingesting its historical snapshots or redistributing derived predictions. ESPN website endpoints may be blocked or change.
2. **Pregame evidence only.** Every feature has an observation time and the information publicly available *before* a game, without completed-game labels, last-minute lineup hindsight, or leakage from same-day results.
3. **Chronological train–calibrate–test separation.** Separate seasons for training, validation/calibration and independent holdout; repeat on subsequent seasons. No feature selection or calibration fitting on the holdout.
4. **Comparable whole-schedule evaluation.** Benchmark calibrated Elo/home edge, season form, the new factor model and a bookmaker-implied no-vig baseline where historical market lines may legally be obtained. Report sample coverage and missingness by team, month and sport.
5. **Metrics and intervals.** Brier score, log loss, calibration error and reliability buckets plus paired uncertainty bands. An attractive accuracy % alone is not enough.
6. **Deployment gates.** Candidate must outperform comparable baselines across sufficiently broad out-of-time games and avoid worsening calibration; independently review trained weights before promotion. Never permit UI-provided unverified factors to change official probability.
7. **Player / coaching factors.** NFL quarterback versus blitz/coverage, NBA lineup and shot profiles, NHL confirmed goalie and 5v5 xG, MLB pitcher–hitter pitch-mix and bullpen availability need *separate verified pregame data*. A scoreline or historical coach head-to-head record cannot identify these effects causally.
8. **Prospective logging.** Archive every model version's prediction, source timestamps, expected starter conditions and outcome so a real forward test can be audited. Verify pricing/market timestamp before edge or parlay-confidence claims.

## Current evidence

NFL 2021–2025 historical study: research candidate season form + scoring matchups had a minor Brier gain on 188/271 eligible 2025 holdout games. The paired 95% interval included zero and calibration ECE worsened. **DO NOT PROMOTE**.

MLB and NHL research diagnostic workflows are runnable through GitHub Actions: `.github/workflows/cross-sport-research.yml`. Both use historical completed game data and never change the live site. They do not establish lineup, goalie or pitcher matchup calibration.

NBA research is blocked pending a permitted, complete historical dataset with consistent team IDs and season/date definitions; the app should not silently scrape hundreds of ESPN daily endpoints.

## Free-tier boundaries

No paid betting data subscription, paid model-hosting service or new public authentication feature is needed for this research phase. Public share link remains https://sports-spreads.onrender.com/ and local ticket saving works without registration.
