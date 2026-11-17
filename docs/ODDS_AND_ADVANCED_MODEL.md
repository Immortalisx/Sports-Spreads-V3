# Sports Spreads v6 — Sportsbook sources and opponent-aware model research

**The public website is research-only. It does not accept wagers or provide verified model edges.**

## The Odds API (real bookmaker moneylines, optional, $0)

Provider: **The Odds API**, `https://the-odds-api.com/` (with hyphens). The similar-looking `theoddsapi.com` is not the provider; use the official URL.

- Free plan is 500 credits per month, with selected US books (e.g., DraftKings, FanDuel, BetMGM when offered) for NFL/NBA/NHL/MLB. Availability varies by market/book/date.
- Free plan has **no historical odds** access. It cannot be used to backtest historical betting profitability. Source: `https://the-odds-api.com/historical-odds-data/`.
- **Current implementation:** Public game details read only previously cached moneylines. **No visitor action makes a credit-consuming provider request.** An owner-only, protected POST may fetch one US region + one h2h market and refresh the shared 8-hour league snapshot. Separate unauthenticated public responses expose **only one exact matched game**, not raw sport-wide provider data. Book names and update times are displayed. Players can **copy a quote into a local ticket**; no bet is placed.
- Strict **400 reserved API credits per UTC calendar month** via atomic Postgres RPC; the remaining ~100 credits provide a safety buffer within the free 500. Quota is reserved before calling the provider, including provider failures. Expired cache can be displayed but cannot be copied to tickets.
- Supabase's `sports_odds_cache` and `sports_odds_api_budget` are **server-only**, Row Level Security enabled, and grant no access to anonymous or signed-in website users. The internal quota RPC is invoker-security and executable only by `service_role`.
- A free provider key is **required** before real odds are available. Without a key or owner refresh, the viewer sees `needs_key` or `waiting_refresh`, and manual-odds entry still works. **Guests cannot spend The Odds API credits.** Never publish or paste the key into GitHub, ChatGPT, a Discord message, or browser JavaScript.

### One-time activation

1. Register a **Free ($0)** account at `https://the-odds-api.com/` and obtain your API key from the provider's dashboard. Do not choose a paid tier.
2. Open `https://supabase.com/dashboard/project/nwspnepkmeoytlkbltfe/functions/secrets` and add one function secret: **Name** `THE_ODDS_API_KEY` — **Value** your provider's key. Do not put it in GitHub or in the browser.
3. Add a *second* Supabase Functions secret named `SPORTS_SPREADS_REFRESH_TOKEN` containing a unique random value of **at least 32 characters**. Treat this like a password; never put it in site code, Discord or GitHub.
4. **Only the owner** triggers a snapshot refresh with an authenticated server-side POST (the refresh token stays in a trusted secret manager); a scheduled owner-controlled job can later do this. Browser visitors call GET only and have no way to trigger a refresh. If using an external scheduler, configure its secrets privately and first review its free-tier limits.
5. Open the site and choose a game, then **Compare sportsbook odds**. If an owner-refreshed quote exists, it shows the bookmaker, selected game and a timestamp. Quotes older than 15 minutes are displayed for comparison only and cannot be copied into a ticket. No bet is placed.

### Limitations

No background or visitor-triggered API refresh, no streaming or real-time line movement, no player-prop quotes on this free cache. An owner-controlled refresh must be configured before the first real quote is shown. The API free tier is capped to 400 **reserved** upstream requests per UTC calendar month even if an owner misconfigures the schedule; API-provider outages may still burn a reserved credit. Odds can be delayed and the cache deliberately refreshes no more often than 8h per sport. Free data budgets and provider policies may change.

## Deeper matchup research

`engine/advanced-sourced-factors.mjs` computes opponent-relative **candidate features** when both sides have real, sourced, time-stamped observations:

- NFL: quarterback EPA versus blitz weighted by opponent blitz frequency, clean-pocket passing, opponent pressure defense; separate QB-versus-man/zone weighted by actual opponent coverage mix.
- NBA: offensive efficiency versus switching, zone and other coverage, weighted by the opponent's measured defensive scheme frequencies.
- NHL: named confirmed starting goalies and independently sourced goals saved above expected per 60.
- MLB: lineup-weighted xwOBA versus probable opposing pitch mixes with named starters and at least seven projected batters. The live **official MLB StatsAPI probable starter panel** is informational; probable does **not** equal confirmed.
- NFL head coach H2H is descriptive and shrunk to a prior (small historical samples never become an automatic predictive coefficient).

`engine/pregame-evidence.mjs` rejects mismatched source/game IDs, unsupported providers, insufficient samples, and observations that occurred after kickoff. `public/multifactor-engine.js` does not activate any advanced weights without an independently validated manifest. **These sourced candidate functions are not yet plugged into a licensed live play-by-play/Statcast/lineup feed or calibrated into win probabilities.**

Historical holdout results for NFL/NBA/NHL/MLB in `docs/VALIDATION_SCORECARD_2026-11-17.md` all returned **do_not_promote**. Do not advertise these as a fully calibrated betting algorithm.
