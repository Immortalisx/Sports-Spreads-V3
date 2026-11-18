# V4 live integration and release gate — 2026-11-18

This is a read-only assessment. **No production deployment, paid-provider refresh, or model promotion was performed.**

## Verified

- Cumulative V4 head `3032d65d`: GitHub Verify, Chromium desktop/mobile/TV smoke, and extended Node 20/22/24 audit all passed.
- Supabase project `nwspnepkmeoytlkbltfe` reported `ACTIVE_HEALTHY`.
- Seven active Edge Functions: sports-feed, nfl-availability, nhl-goalie-form, sportsbook-odds, season-form, daily-tickets, matchup-signals.
- Database read-only inspection confirmed JSON cache rows for NFL availability, NHL goalie form, NFL/NBA/NHL season form, and NFL/NBA/NHL/MLB odds.
- Latest odds-cache rows for all four leagues were fetched 2026-11-17 21:54–21:55 UTC. The only daily-ticket row was for 2026-11-17, generated 22:28 UTC.
- All five relevant Supabase cron jobs are active: odds at 17:00/23:00 UTC, daily tickets 17:15 UTC, season form 17:25 UTC, NHL goalies 17:35 UTC, NFL availability 17:45 UTC. The inspection occurred before the November 18 17:00 UTC refresh, so November 17 cache dates do **not** by themselves prove a failed refresh.\n- November 2026 odds budget row: **4 reserved credits**. The configured cap in `supabase/functions/sportsbook-odds/index.ts` is 400 per UTC month.
- Supabase security advisors returned only INFO notices: seven service-only RLS-enabled tables with no public policies. These should remain inaccessible to public clients; their Edge Functions use server-side access. Performance advisor reported one unused index on `user_tickets` (too early to justify removal).

## Still required before production sign-off

1. Verify the next scheduled cache-refresh cycle generates **current Eastern-date** daily tickets and fresh league snapshots, without spending paid odds credits from public GET requests.
2. Confirm scheduled refresh authentication and server logs. **Do not** run unauthenticated or ad hoc refresh POSTs.
3. Run authenticated/private and anonymous user flows against a staging deployment, not the live production site, including ticket save/load and provider failure states.
4. For NFL and NHL advanced calibration, obtain point-in-time sourced features with pregame timestamps, train/holdout separation, enough coverage, and confidence intervals showing reliable improvement. Prior NFL/NHL backtests have not met promotion thresholds. No validation should be fabricated from the existence of caches or retrospective results alone.
5. Obtain explicit merge/deploy approval. The consolidated PR should be used for cumulative integration review because individual intermediate branches diverged.

## Release decision

**Automated structural integration: PASS. Live cache presence: PASS. Cache freshness / scheduled regeneration: PENDING. NFL/NHL advanced model calibration: NOT APPROVED. Staging end-to-end: PENDING. Production release: HOLD.**

## Additional regression coverage

- Added `tests/v4-point-in-time-calibration-gate.test.mjs`: NFL QB/blitz and NHL goalie feature contracts, pregame snapshot chronology, source provenance, minimum samples, synthetic-data rejection, and insufficient-history no-promotion checks. These fixtures validate **the guardrails**, not real predictive accuracy.
- Confirmed Render production service remains on `main`, auto-deploy enabled, PR preview generation disabled. The integration branches are not a staging environment. Creating a staging service or deploying a branch requires separate explicit approval and workspace selection.
