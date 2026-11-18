# Bet Better teaching CSV versus nflverse: offline NFL fixture

Research only. This document is **not** evidence of Sports Spreads model calibration, predicted win probabilities, odds availability, ticket ROI, or sportsbook settlement.

## Inputs and provenance
- User-supplied original file: `betbetter-teaching-dataset-2026.csv`, 390,940 bytes; SHA-256 `bf8fb58dfd31d32d506625095e77715204ea61e0926fc6ad609f1ab998e5ca59`; 4,740 total rows, 95 NFL rows. Teaching CSV is a distinct CC BY 4.0 source, not the original Bet Better closing-price NFL/NHL research CSVs.
- nflverse/nfldata `data/games.csv`, Git blob `77580b1ff3255acb477153f993954f6e1c60a5c8`; SHA-256 `3d0703c3a40470351ef2a28257734f30fce5164e876f9a492a4d416c9f525723`.
- Fixture: `tests/fixtures/betbetter-nflverse-cross-source-2026.json`; regression test: `tests/betbetter-nflverse-cross-source.test.mjs`.

## Corrected comparison
The previous report of 35 exact-date matches and 10 one-day differences was incorrect. Reinspection of both sources gives:
- 37 identical calendar date, home team, away team, and final score records;
- 8 records with the same teams and final scores, but the teaching date exactly one day later;
- 0 final-score conflicts among the 45 matched records;
- 50 excluded teaching NFL rows: 49 preseason games and 1 AFC/NFC Pro Bowl, without corresponding nflverse records in the comparison scope.

The fixture pins all 45 matched records and both **unmodified** source dates. Scores are the same in both sources. NFL team names were normalized to nflverse abbreviations; `LA` represents the Rams and `LAC` the Chargers. The 50 excluded rows are recorded in scope totals rather than reproduced in the matched-games fixture; the test verifies the exclusion arithmetic, **not** those 50 raw records independently.

## One-day offsets requiring investigation
- 2026-01-03 SF vs SEA (teaching: Jan 4)
- 2026-01-04 PIT vs BAL (teaching: Jan 5)
- 2026-01-11 NE vs LAC (teaching: Jan 12)
- 2026-01-12 PIT vs HOU (teaching: Jan 13)
- 2026-09-09 SEA vs NE (teaching: Sep 10)
- 2026-09-10 LA vs SF (teaching: Sep 11)
- 2026-09-13 NYG vs DAL (teaching: Sep 14)
- 2026-09-14 KC vs DEN (teaching: Sep 15)

These offsets are **consistent with**, but do not prove, a UTC/local-time or calendar-day transformation. No kickoff timestamps or dataset date-conversion implementation were verified for these records, so the root cause is **unconfirmed**. Do not silently adjust either source's date; use explicit matchup/score/date-offset classification for research only.

## Guardrails
This fixture is an offline regression artifact, not a production feed or live inference source. No historical ticket returns, calibration, or market probabilities are inferred. Run `node --test tests/betbetter-nflverse-cross-source.test.mjs` and repository CI. Do not deploy or merge this draft PR as part of this research.


## Exclusion coverage improvement
`tests/fixtures/betbetter-nfl-excluded-2026.csv` now pins the 50 individually excluded teaching NFL rows (dates, normalized teams and final scores): 49 August preseason games and the February AFC/NFC Pro Bowl. The test checks every record's schema, 95 combined unique teaching matchup keys, and no overlap with the 45 matched records. This is materially stronger than testing exclusion totals alone.

**Source-byte limitation:** The uploaded original teaching CSV was SHA-256 verified locally (390,940 bytes, digest above). The complete original teaching CSV and complete nflverse CSV are **not** committed into the repository, so GitHub CI cannot independently recompute those two original file digests or reconstruct each normalized record from raw source bytes. The checked-in matched/excluded snapshots are deterministic research fixtures, not proof of byte-level provenance. The test verifies that stored digest identifiers have valid syntax, not that they match files present in CI. Do not misrepresent the fixture tests as independent full-source integrity verification.
