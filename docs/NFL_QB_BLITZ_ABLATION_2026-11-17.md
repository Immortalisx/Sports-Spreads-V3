# Batch 2B — Verified NFL quarterback-versus-blitz ablation (2026-11-17)

## Verdict

**DO NOT PROMOTE** the tested QB-versus-blitz feature to calibrated NFL probabilities.

The 2025 untouched holdout was slightly worse after adding source-verified
quarterback EPA against blitz/nonblitz, weighted by the upcoming opponent's
recent defensive blitz rate.

| Measurement | Rolling-form baseline | Rolling form + QB/opponent blitz |
|---|---:|---:|
| 2025 holdout games | 271 | 271 |
| Brier score (lower is better) | **0.220698** | 0.221305 |
| Brier improvement over baseline | — | -0.000607 |
| 95% paired bootstrap improvement interval | — | **[-0.003261, +0.001763]** |
| Probability calibration ECE | — | 4.80% |
| Holdout games with qualifying charted QB/defense split | — | 73.06% |
| Meets predeclared improvement requirement | — | **No** |

**Splits were not interchanged or tuned using the untouched holdout:** 2022
training (269 games), 2023 model-selection check (272 games), 2024
calibration (272 games), 2025 holdout (271 games).
Only source-available plays from at least **three calendar days** before the
match were eligible to protect against delayed publication.

## Data, cost and limitations

- FTN charting with NFLverse play-by-play matched **19,212 / 19,800 / 19,222 /
  18,735** regular-season passing/sack dropbacks in 2022 / 2023 / 2024 / 2025,
  respectively. Match rates: 99.637%, 99.965%, 99.990%, 99.989%.
- For each game, the projected quarterback was **the team's leading QB by
  dropbacks in its most recent eligible prior game**. This is *not a confirmed
  starter*, so QB changes/injuries materially limit the model.
- The upcoming defense's blitz frequency used its last five eligible games.
  The QB projection requires at least 12 blitz plays and 30 nonblitz plays;
  opposing defense requires at least 65 pass/sack observations. Missing data
  is flagged and imputed at a neutral value with a missing-data indicator.
- This feature does not measure film-charted man/zone, DB alignment, offensive
  line protections, player injury adjustments or verified starter confirmations.
- The testing source is FTN charting via nflverse, FTN CC BY-SA 4.0 and other
  nflverse attribution rules. The research workflow stores no raw play-level
  data artifacts or website feed; only aggregated results are published.
- **Bookmaker and Firecrawl credits used: zero**. All collection occurs offline
  on a bounded GitHub Actions research job, not for site visitors.

## Production treatment

The separate Batch 2A preliminary recency estimate may display with **`*`**
for NFL/NHL. It is explicitly not a confidence grade, verified wagering edge,
or statistically certified forecast. This QB/blitz study **changes no deployed
prediction coefficients**, no parlays and no sportsbook prices.

Follow-on work must use independently verified pregame starters/injury status,
actual coverage-scheme assignments where licensed, and an additional untouched
prospective 2026+ holdout before promotion.

Reproduce: `engine/nfl-qb-blitz-pregame-extract.py`,
`engine/evaluate-nfl-blitz-ablation.mjs`,
`engine/run-nfl-blitz-ablation.mjs` and the GitHub Actions workflow
`nfl-blitz-ablation.yml` (artifact
`nfl-qb-blitz-rolling-form-ablation`).
