# Offline settlement source audit (research only)

## Reuse-rights assessment
- **nflverse/nfldata** game results and lines: reported CC BY 4.0 by third-party research documentation. Verify the exact upstream asset license and attribution before ingestion; game-level closing odds do not establish individually timestamped bookmaker quotes or a validated parlay payout.
- **Bet Better closing-price studies** (https://github.com/edushinka/sports-closing-price-studies): workflow documentation describes NFL and NHL game-level no-vig closing probabilities plus final results, data CC BY 4.0, code MIT. These are aggregated closing probabilities, **not individual sportsbook American odds, pregame snapshot timestamps, or whole-ticket model predictions**. Source DOI and attribution required; confirm upstream asset license before reuse.
- **kevbowl/odds-fetcher**: public Git history supplies pregame quote snapshots but repository tree lacked a LICENSE file at the inspected revision; **reuse rights unresolved**. Do not import raw snapshots into the project on this evidence.
- **The Odds Gap sample**: CC BY-NC 4.0; commercial reuse cannot be assumed.
- **NHL official/public results APIs**: public access does not by itself confer a commercial redistribution license.

## Batch outcome
`engine/offline-settlement-match.mjs` accepts **caller-provided licensed and attributed** quote/result objects only. It requires exact game ID, league, normalized teams, compatible start times, pregame quote chronology, final scores, and an explicit market settlement rule. NHL requires full-game including overtime and shootout. It never invents settlement, model probability, combined ticket prices or ROI.

No actual licensed quote/result pairs have been imported in this batch. The deterministic tests use synthetic fixtures and test refusal behavior. **Measured real-world settled whole-ticket count: zero.** No production model promotion.
