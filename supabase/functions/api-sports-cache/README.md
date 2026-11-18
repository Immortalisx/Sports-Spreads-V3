# API-Sports daily games cache

Live Supabase Edge Function: `api-sports-cache` in project `nwspnepkmeoytlkbltfe`.

- GET `?league=nfl|nba|nhl|mlb` reads shared database cache and **never** calls the provider.
- POST requires the existing private `x-refresh-token`, validated with `verify_sports_odds_refresh_token` RPC; freshness guard is eight hours.
- Provider ingestion: `/games?date=YYYY-MM-DD` once per eligible refresh. Filter primary leagues (NFL id 1, NHL id 57, MLB id 1, NBA league standard). These identifiers and filtering must be revalidated as provider formats evolve.
- pg_cron job `sports-spreads-api-sports-daily-games` (id 11) is active, daily at 12:30 UTC. It requests one refresh per league, maximum four upstream calls/day under normal operation.
- Private `public.api_sports_cache` has RLS enabled and no anon/authenticated direct table access. Provider secret `API_SPORTS_KEY` stays in Supabase.
- Verified live date 2026-11-18: NFL 0, NBA 5, NHL 11, MLB 0 cached games after filtering.
- **Not implemented**: frontend presentation, team/player statistics, injuries, model feature integration, calibration, and production-grade confidence validation. Do not treat this cache as betting projections.
- The live function was deployed directly in Supabase; this README is documentation, not its source code. Commit actual function source before relying on repo-based redeploys.
