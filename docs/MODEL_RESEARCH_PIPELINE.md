# Sports Spreads — Model Research Pipeline v5

**Status:** Engineering and validation infrastructure, **not** a calibrated production betting model. The live game cards still display the clearly labeled experimental season-form estimate. None of the research-trained weights are automatically connected to its displayed probabilities.

## Data collection, source constraints and request budgets

| League | Public research source | Requests | Historical inputs available | Player-level limitations |
|---|---|---|---|---|
| NFL | [nflverse games.csv](https://github.com/nflverse/nfldata/blob/master/data/games.csv) | 1 CSV download for all years | Outcomes, previous team form, scores, prior rest, coach names | No QB vs blitz, pass coverage or pressure splits. No actual pregame weather history. |
| NBA | [ESPN website scoreboard](https://site.web.api.espn.com/) (unofficial) | Max **31 dates** per invocation by default; avoid bulk scraping | Final scores, earlier team records, rest | No possession efficiency, shot charts or lineup scheme evidence in scoreboard. Unofficial feed can block. |
| NHL | [NHL Web API](https://api-web.nhle.com/v1/) | ~32 club schedule requests/year, deduplicated | Final scores, previous team records and rest | No goalie GSAX, confirmed starters, 5v5 xG or line matchups from schedules. |
| MLB | [MLB StatsAPI schedule](https://statsapi.mlb.com/api/v1/schedule) | 1 season schedule request | Final runs, earlier team offense/defense and rest | No verified pitching starter, hitter lineups, pitch mixes or Statcast prior splits from schedule alone. |

Provider terms, redistribution rights, and accuracy must be checked before commercial use. **Do not commit raw third-party data** or schedule automatic bulk imports. All scripts are manual, default-bounded and store results locally under ignored `research/`. NBA's public website feed is particularly fragile; missing sources are recorded as unavailable, not silently replaced by fake results.

## Commands (Node 22+, no npm dependencies)

```bash
# Historical single season, research results only
npm run research:collect -- --league=nfl --season=2025 --output=research/nfl-2025.json
npm run research:collect -- --league=mlb --season=2025 --output=research/mlb-2025.json
npm run research:collect -- --league=nhl --season=2024 --output=research/nhl-2024.json
npm run research:collect -- --league=nba --season=2024 --start=2025-03-01 --end=2025-03-15 --output=research/nba-march.json

# NFL: one download across up to 7 specified years, 3-way chronological test
npm run research:study -- --league=nfl --from=2021 --to=2025 --output=research/nfl-backtest.json
# MLB/NHL: bounded per-season public schedule fetches, 3-year validation minimum
npm run research:study -- --league=mlb --from=2022 --to=2025 --output=research/mlb-backtest.json
npm run research:study -- --league=nhl --from=2022 --to=2025 --output=research/nhl-backtest.json
```

## What happens inside the retrospective evaluator

1. Only **completed** regular-season games with both scores are admitted. Game IDs must be unique.
2. Team ratings and features for a given date are calculated from games on **earlier dates only**. Entire same-day batches are predicted before outcomes are applied, preventing doubleheader and evening-game leakage.
3. Baseline uses transparent past-game Elo with separate, *assumed* home adjustments and season regression; its constants are not claimed to be historically optimized.
4. Candidate residuals: prior-season-form, rolling offense-versus-defense scoring, prior rest, and verified-prior coach encounters when sample supports them. The latter is descriptive/confounded and often unavailable. No fabricated QB-v-blitz or pitcher-v-hitter values.
5. Train on all but the last two seasons, calibrate and choose a model using the second-to-last season, **evaluate the chosen model once** on the last season.
6. Report Brier score, log loss, calibration error, comparable baseline scores, matched data coverage, and a paired bootstrap confidence interval for Brier improvement. No random splits across time.
7. Results are **research only**, even when preliminary gain appears positive. Requires verified point-in-time evidence, independent repeated holdouts, source rights, and a human-reviewed production manifest before upgrading win forecasts.

### Point-in-time advanced factors

The `engine/pregame-evidence.mjs` gate requires game ID, sport, feature ID, published source URL, `sourceTier`, sample size, a verified pregame `snapshotAt`, and `dataThrough` strictly before kickoff. NFL QB-versus-blitz and coverage require QB identity; MLB pitcher-hitter requires named starter and at least seven projected hitters; NHL goalie analysis requires a confirmed starter. This makes it impossible for a post-game QB pressure split or updated lineup to be smuggled into an old forecast. Reconstructed historical schedules **are not equivalent to archived forecasts**.

## Research gate and publishing

The existing `engine/walkforward.mjs` remains the strict production-feature validator and never publishes weights by default. Historical research reports intentionally do not produce a `SS_VALIDATED_MODELS` client manifest. Any candidate must prove gain on independent same-game holdouts and survive failure mode/quality review before promotion. No performance or betting-profit claim should be made without timestamped contemporaneous prices and prospective tracking.

## Reading the status in the UI

**About → Model lab** explains the provenance and constraints without cluttering the main dashboard. **Big Screen** is a separate presentation layout and does not change game estimates.
