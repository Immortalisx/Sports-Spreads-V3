# API-Sports cache (initial integration)

Supabase Edge Function `api-sports-cache` deployed separately to project `nwspnepkmeoytlkbltfe`.

- GET `?league=nfl|nba|nhl|mlb` returns shared cached discovery data without provider requests.
- POST requires `x-refresh-token` validated by `verify_sports_odds_refresh_token` RPC and respects an eight-hour freshness window.
- Current refresh retrieves `/leagues` only. Game schedules, team/player statistics, injuries, model integration, and automated refresh are **not yet implemented**.
- Private cache table `public.api_sports_cache` has RLS enabled and no anon/authenticated access.
- API secret is `API_SPORTS_KEY` stored in Supabase, never in frontend code.

**Important:** Keep provider requests within the verified 100 requests/day per API. No scheduled API-Sports refresh is enabled yet.
