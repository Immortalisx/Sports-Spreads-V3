# Reproducible NFL historical CSV audit — 2026-11-18

## Source and integrity
- Source: nflverse/nfldata `data/games.csv`, identical Git blob listed in its repository tree, SHA-1 `77580b1ff3255acb477153f993954f6e1c60a5c8`.
- Git blob bytes retrieved via GitHub `fetch_blob`, **2,190,574 bytes** (ASCII CSV).
- SHA-256 of retrieved bytes: `3d0703c3a40470351ef2a28257734f30fce5164e876f9a492a4d416c9f525723`.
- CSV structure: 46 columns, **7,548 data rows**.
- 7,426 rows with nonnegative integer home/away scores, 122 rows with missing scores, 0 rows with invalid nonempty scores.
- 5,445 completed rows with both home/away moneyline fields populated; **these are not timestamped book-specific prices**.
- 7,426 completed rows with a spread line.
- Season 2026: 272 scheduled rows from 2026-09-09 to 2027-01-10; 150 with completed scores, 122 future/missing scores, 0 invalid nonempty scores, 150 completed with both moneyline fields.
- Counting used header-indexed fields and basic comma splitting. The audited numeric fields contain no commas, but future independent CSV parser validation is recommended before using any free-text fields.
- Attribution: nflverse contributors, https://github.com/nflverse/nflverse-data ; its schedules release carries CC BY 4.0 license. Verify precise release asset provenance before commercial redistribution.

## Bet Better NFL/NHL
- Licensed dataset landing page: https://data.mendeley.com/datasets/5mygfmbjsj/1 (CC BY 4.0), DOI 10.17632/5mygfmbjsj.1.
- NFL `nfl_2026_closing_prices_vs_results.csv` and NHL `nhl_2026_closing_prices_vs_results.csv` identified; **complete bytes were not accessible** through the available public tools. Source-reported sizes 6.26 KB and 8.37 KB, not independently hashed.
- Published counts: NFL 97, NHL 133; **not independently parsed or validated**.
- Actual cross-source match coverage: **not measurable** without Bet Better file contents. Do not substitute date/teams guesses.
- nflverse rows are a more recent snapshot than the frozen Bet Better study window, so raw 2026 counts cannot be compared directly.

## Safety and next gates
- No matched licensed NFL/NHL pairs validated, no NHL source bytes parsed, no archived Sports Spreads predictions, no bookmaker quote timestamps, no validated ticket ROI.
- No production changes, paid API calls, model promotion or PR merge.
