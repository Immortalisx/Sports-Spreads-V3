# Sports Spreads v3.2 — community beta

Public website: **https://sports-spreads.onrender.com/**

A responsive four-sport scoreboard, team directory, optional player props and manual parlay builder. Compact by default; detail available on tap.

## What works

- Read-only scoreboard, team directories, injury reports, rosters and news via ESPN's **unofficial** public site feed, which may be blocked or change. Clearly marked example fixtures provide an offline UI fallback.
- NFL, NBA, NHL, MLB tabs, search and dates.
- Game-day weather from Open-Meteo: venue/location validation, indoor check, temperature, wind, gusts and precipitation near kickoff; forecast caching and timestamps.
- **Weather context model v1** computes sport-sensitive risk tiers and exposes a versioned feature vector (wind, gusts, temperature, precipitation, roof uncertainty). This is a deterministic heuristic, **not** a validated change to win probability, EV, or confidence. The original Sports Spreads prediction model is not yet connected.
- Player-prop threshold sliders (manual prices), combined-odds/payout math, animated ticker, correlation warnings.
- Local saved ticket snapshots and export.
- Responsive Share button copies the bare website URL for Discord; Feedback button lets a beta tester compose and copy a short note to paste into Discord.
- Optional Supabase browser client for per-user cloud history, with row-level security SQL. **Not activated** until a Supabase project exists.

## $0 architecture

- Render **static website**, GitHub repository, no always-on paid web service.
- Open-Meteo free API for **noncommercial** use, fetched only for outdoor games when a weather-relevant game drawer is opened. See https://open-meteo.com/en/terms.
- Free browser local storage works without email. Optional Supabase Free project is separate and not created yet.
- Respect provider usage, privacy, and the limits of unofficial sources. Do not launch as a commercial or regulated wagering operation without licensing/provider review.

## Run/test/build

```bash
npm test
npm start                  # Node local development
npm run build:static        # multi-file static preview in dist/
npm run build:onefile       # one-file Render deployment in release/index.html
```

Node 20+. No dependency installation required for the current prototype.

The live Render service currently publishes the repository-root `index.html`. For deployment, replace that file with `release/index.html` (single HTML file with inlined JS/CSS). Source code stays in `public/` with tests in `tests/`.

**Cloud-saving walkthrough:** [CLOUD_SETUP.md](CLOUD_SETUP.md). SQL: [supabase/migrations/001_saved_ticket_history.sql](supabase/migrations/001_saved_ticket_history.sql).

## Honest limitations

- Weather information currently influences a *weather-context risk tier*, not real game win probability. A statistically calibrated weather-aware predictive model requires access to the original model, archived forecasts/results and retrospective validation.
- No verified live sportsbook lines, model confidence scores, or real bet execution.
- The team and game feed is not guaranteed for production or commercial use; example games are prominently marked.
- Feedback submissions are **not** stored on the website; users copy them into a Discord discussion. There is no configured Discord channel/invite yet.
- Supabase cloud saving is implemented in code but cannot synchronize until a project, Auth settings and public config are established.