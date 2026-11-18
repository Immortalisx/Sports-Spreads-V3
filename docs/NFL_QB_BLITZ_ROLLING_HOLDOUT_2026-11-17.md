# Batch 2 — NFL QB vs blitz on top of rolling form
**Evaluated November 17–18, 2026; full 2025 NFL regular-season holdout.**

## Decision: do not promote the QB/blitz model

The model evaluated **real FTN charting joined to nflverse PBP**, not
hand-entered schemes, invented starter identities or bookmaker-derived odds.
The observed Brier improvement was too small to be statistically credible.

| Measure | Rolling form only | Rolling form + historical QB/blitz exposure |
|---|---:|---:|
| 2025 untouched holdout games | 271 | 271 |
| Brier score (lower better) | 0.2228532151 | **0.2228389888** |
| ECE (lower better) | 6.740442% | **6.740167%** |
| Incremental Brier gain | — | +0.0000142263 |
| 95% paired 7-day block bootstrap Brier gain interval | — | **−0.000049716 to +0.000075909** |

The interval includes zero, the Brier gain is far smaller than the
predeclared 0.001 threshold, and the prediction ECE is over 5.5%.
**No NFL forecast calibration, live prediction weights, confidence grades,
wager projections or ticket outputs were upgraded.**

### Date isolation and provenance

- **Source**: nflverse community NFL 2022–25 final regular-season results;
  FTN charting `n_blitzers` joined to nflverse play-by-play by actual
  `(game_id,play_id)` keys. Bounded downloads performed by the GitHub Action.
- **FTN publication timing**: source observations withheld until at least
  **3 calendar days after the prior game**.
- **QB identity**: the most charted QB from the last *eligible prior game*
  is used as a pregame proxy; actual subsequent starting QB is **never**
  used to choose the historical forecast's QB. An injury/replacement can
  therefore make the proxy wrong.
- **Blitz matchup**: compute the QB's recent EPA against blitz/non-blitz and
  blend using the opposing defense's recent actual blitz rate. Additional
  candidate is sensitivity to opposing blitz-rate exposure.
- **Sample gating**: at least 8 blitzed plays and 20 non-blitzed plays
  for the projected QB, plus at least 50 opponent passing plays from
  the defense; unavailable values are neutralized, not imputed with future data.
- **Game isolation**: all games remain in the evaluated slate;
  the research retains missing-feature games and never drops losses
  opportunistically.
- **Season isolation**: **2022 train; 2023 feature selection; 2024
  probability calibration; 2025 untouched test.** The algorithm
  compares the best rolling-form variant with the best extension
  selected using 2023 only. Both models receive separate 2024 calibration.
- **Statistical uncertainty**: resample 7-day game clusters rather than
  assuming individual NFL games are independent.

| Season | Completed games | Games with both QB/defense samples | Play-level join coverage |
|---|---:|---:|---:|
| 2022 | 269 | 216 (80.3%) | 99.64% |
| 2023 | 272 | 226 (83.1%) | 99.96% |
| 2024 | 272 | 223 (82.0%) | 99.99% |
| 2025 | 271 | 224 (82.7%) | 99.99% |

The form-only model selected `record, elo, form` on the validation
season; the augmented candidate selected those three plus
`qbExposure`. The mere selection of the feature does not demonstrate
meaningful independent predictive power.

### Unresolved before genuine promotion

- Confirmed live pregame QB starter/backup injury status (separate licensed/
  timestamped source); QB proxy based on prior game's attempts is not the
  same as confirmed starting quarterback.
- Verified man/zone defensive scheme and receiver assignment coverage data,
  **not in FTN's released public charting fields**.
- Additional seasons or prospective point-in-time tests with a trustworthy
  contemporaneous sportsbook market baseline. Historical results alone
  cannot establish betting profitability.
- More sensitive value modeling must avoid fitting to the 2025 holdout
  repeatedly. Freeze next candidates and evaluate future seasons
  without looking ahead.

### Reproduce

- `python engine/collect-qb-blitz-holdout.py research/nfl-qb-blitz-history.json`
- `node engine/run-qb-blitz-holdout.mjs --input=research/nfl-qb-blitz-history.json --output=research/nfl-qb-blitz-holdout.json`
- [NFL QB vs blitz + rolling form holdout workflow](https://github.com/Immortalisx/Sports-Spreads-V3/actions/workflows/nfl-qb-blitz-holdout.yml)

Uses only free public research source downloads from GitHub;
**zero sportsbook credits, zero Firecrawl credits, and zero website visitor
requests**. FTN charting license **CC BY-SA 4.0**; source
attribution/share-alike must be honored if derived work is distributed.
This file publishes aggregate evaluation only, not licensed raw play data.
