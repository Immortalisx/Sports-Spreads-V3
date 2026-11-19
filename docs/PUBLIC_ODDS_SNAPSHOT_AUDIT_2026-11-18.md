# Public snapshot intake audit — 2026-11-18 (research only)

## Verified source
- Repository: https://github.com/kevbowl/odds-fetcher
- Git commit: `b91cd5c254e56fd5b7d3b527794e23c60b990ff2`
- Commit timestamp: `2026-11-18T18:25:31Z` (used as an **upper-bound audit reference**, not independently proven quote capture time).
- Examined `odds/nfl.json` and `odds/nhl.json` directly via GitHub repository file reads at the pinned commit.
- No LICENSE file was found in the pinned commit's repository tree. Do **not** infer a license for the odds data from code descriptions; confirm reuse rights before copying raw data into the project.

## Coverage from pinned files
| League | Events in file | Future games with qualifying two-way h2h quotes | Supported books | Qualifying bookmaker/game markets | Side quotes |
|---|---:|---:|---:|---:|---:|
| NFL | 29 | 29 | 6 | 142 | 284 |
| NHL | 15 | 15 | 6 | 78 | 156 |

Counting criteria: supported sportsbook keys; two team-named outcomes; valid American odds; market update timestamp not after commit timestamp and no older than 8 hours; game start strictly after commit timestamp. These are **audit counts**, not independently confirmed executable offers. Git commit time is not a verified capture time.

## Limits
- This is one Git revision, not a longitudinal archive or settled ticket dataset.
- The files contain odds for upcoming games, not settled whole-ticket results.
- No independently timestamped historical ticket predictions, sportsbook parlay quotes, or calibrated joint probabilities were established.
- **Verified settled tickets: 0. Historical ROI: not available. Model promotion: forbidden.**
- The offline importer is source-gated and should not be used to ingest third-party raw data into the repository until licensing is established.
- The Odds Gap sample is labeled CC BY-NC 4.0; do not assume permission for commercial use.
- No paid APIs, hosting changes, or production model changes were used for this audit.
