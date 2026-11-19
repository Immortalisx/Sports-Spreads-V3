# Licensed historical NFL/NHL research audit — 2026-11-18

## Verified license and source scope
- nflverse/nflverse-data: CC BY 4.0 in repository LICENSE.md and DESCRIPTION. Schedules release games.csv includes game-level scores and betting lines. Historical closing prices are **not** timestamped bookmaker-specific executable quotes.
- Bet Better (Edward Glush): Mendeley dataset DOI 10.17632/5mygfmbjsj.1, version 1, CC BY 4.0. Published NFL 2026 and NHL 2026-27 CSVs contain `date_utc, week, home_team, away_team, home_no_vig_close_prob, home_won, home_score, away_score, n_books`.
- Bet Better's WorkflowHub listing reports **97 NFL games and 133 NHL games**; these are **publisher-reported coverage**, not locally reproduced counts. Closing probabilities aggregate three or more bookmakers with margin removed. They cannot be used as an individual bookmaker's price or as an independently timestamped pregame model prediction.
- Attribution required: nflverse contributors; Bet Better / Edward Glush and DOI 10.17632/5mygfmbjsj.1. Review any underlying sports-data owner restrictions separately.

## Implementation and measurement
- Added `engine/import-betbetter-closing-research.mjs`, with offline-only CSV parsing and license/DOI, score and source integrity gates.
- Added deterministic tests with **two accepted synthetic rows**, a deliberately inconsistent synthetic result, and malformed CSV. These do **not** count as real historical measurements.
- Actual downloaded dataset rows parsed in this run: **0** (direct release/download access unavailable through current execution environment). Therefore actual licensed quote-to-settlement pairs matched: **0**, actual whole tickets: **0**, ROI: **not measured**.
- Prior separately inspected public odds-fetcher Git snapshot contained 284 NFL and 156 NHL qualifying sides, but reuse rights unresolved and games not settled at capture. No raw third-party odds were imported.

## Next research gate
Retrieve licensed actual CSVs with reproducible hash and source URL; audit row counts and match exact game identities, dates, and outcomes against an independent permitted result feed. Only afterward evaluate market closing-price calibration as a **market baseline**. Point-in-time whole-ticket validation additionally requires pregame timestamped bookmaker quotes, archived predictions, independently settled legs and complete ticket composition. No model promotion.
