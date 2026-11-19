# NHL 2026 opener: official historical score source audit

Research-only, draft PR #49; no paid providers or production changes.

The 2026-09-29 target was Florida at Carolina (Florida 1–0 OT). The completed target result is separately pinned in `tests/fixtures/week-one-2026-results.json`; it is excluded from all Elo training inputs.

Official NHL Stats REST endpoints (free unauthenticated historical data):
- 2024–25: https://api.nhle.com/stats/rest/en/game?cayenneExp=season%3D20242025%20and%20gameType%3D2&limit=-1
- 2025–26: https://api.nhle.com/stats/rest/en/game?cayenneExp=season%3D20252026%20and%20gameType%3D2&limit=-1
- Team ID -> tricode: https://api.nhle.com/stats/rest/en/team?limit=-1

Both league endpoints returned `total: 1312` and 1,312 completed non-tied regular-season results with `gameStateId=7`. All 2,624 game IDs were unique, and each season contained exactly 32 team tricodes appearing 82 times. 2024–25 spans October 4, 2024–April 17, 2025; 2025–26 spans October 7, 2025–April 16, 2026. Both Florida and Carolina have 164 history games across the two seasons. Complete rows are pinned offline in `tests/fixtures/nhl-2024-2026-regular-results.json`.

The existing Elo runner includes only `gameDate < 2026-09-29` and uses target season key 20262027 for the existing offseason shrinkage. It fails closed for incomplete/duplicated/malformed prior-season inputs. Regression tests invert the target score and require the reconstructed probability to remain identical while Brier changes.

Run `node --test tests/week-one-elo-replay.test.mjs` for per-game probabilities and leakage tests, or the normal CI workflow. **Research reconstruction only**, not an archived point-in-time production or calibrated live betting model; no verified 2026 pregame goalie/lineups/odds features.
