# Sports Spreads v5 — Big Screen + historical model research

**Live site:** https://sports-spreads.onrender.com/

Fast, mobile-first NFL/NBA/NHL/MLB game explorer with sport-specific matchup detail, game-day weather context, cached **US sportsbook moneyline comparisons** from The Odds API, manual parlay builder, local and optional Supabase saved tickets, and an experimental record-based baseline. Team and player suggestions appear after three characters; select a team to lazily load that team's roster for player-prop entries.

## Source layout

- `src/app/00-feed.js`: browser feed adapter and normalized ESPN results via the restricted Supabase relay.
- `src/app/10-state.js`: state and formatting.
- `src/app/20-views.js`: UI and progressive disclosures.
- `src/app/30-controller.js`: event handlers, keyboard accessible team/player typeahead, local/cloud actions.
- `public/autocomplete.js`: pure matching logic; no request per keystroke.
- `public/multifactor-engine.js`: point-in-time checks for league-specific sourced matchup factors; refuses to apply unvalidated weights.
- `public/prediction-model.js`: currently shown **unvalidated** records-only probability estimate.
- `engine/`: historical walk-forward trainer, Brier, log loss, calibration ECE; refuses to publish its own weights.
- `docs/`: release audit and NFL retrospective research report.
- `supabase/`: database RLS migration; live read-only ESPN Edge relay remains in the connected Supabase project.

## Build and test

```bash
npm test                    # Assemble and run regression suite
npm run build:app           # Assemble UI controller from 4 source modules
npm run build:onefile       # Create release/index.html (Render static site)
npm run build:static        # Create dist/ for multi-file static hosting
npm run validate:model      # Honest 'no_historical_data' without an input dataset
```

Render currently copies root `index.html` to its `public/` publish folder. Release process: generate `release/index.html`, copy it to repository-root `index.html`, assert bytes match, commit and deploy via the connected Render static service.

## Research status and limitations

**This is a community beta, not a validated betting service.** Live scores and team records come from unofficial, potentially blocked ESPN website endpoints. A restricted Supabase Edge proxy caches requests; a restricted The Odds API US moneyline adapter is activated with a server-only key and a 400-reserved-credit monthly guard. Quotes are snapshots, not necessarily live prices. Weather can widen an illustrative uncertainty band but has no trained directional effect. Rest, coaches, NFL QB/blitz and coverage, NBA shot/defense fit, NHL goalies and special teams, MLB pitcher/hitter splits and park/weather are defined as model inputs, not fictitious coefficients. Missing features do not change predictions. Historical NFL study: [docs/NFL_BACKTEST_2023-2025.md](docs/NFL_BACKTEST_2023-2025.md). User-entered odds are not validated or used to infer parlay confidence.

Free Supabase project supports row-private ticket history; unrestricted Discord email logins require SMTP or a configured OAuth provider. The site remains usable without login; feedback is copied to Discord rather than silently collected. Do not add paid services or unlicensed data without reviewing terms.

## Big Screen Mode (TV / laptop / 4K)

Click **▣ Big Screen** in the header, or open **https://sports-spreads.onrender.com/?display=tv**. This is an optional large-font, large-scoreboard view with the same real game data, date and sport selectors, and a persistent Exit button. Browsers that support document fullscreen enter it on click; other browsers get the full-window CSS presentation. Press Escape or Exit big screen to return. Supports reduced-motion preferences.

## Cross-sport model research milestone

Game-result ingestion and a *retrospective* chronological trainer have been added. They deliberately DO NOT write prediction weights to the live site. Read [docs/MODEL_RESEARCH_PIPELINE.md](docs/MODEL_RESEARCH_PIPELINE.md) for public source usage and caveats.

```bash
npm run research:study -- --league=nfl --from=2021 --to=2025 --output=research/nfl-report.json
npm run research:collect -- --league=mlb --season=2025 --output=research/mlb-2025.json
# NHL uses 32 club schedule requests per year; NBA is explicitly date-bounded
```

## v6 — licensed bookmaker quotes and pregame starter signals

See [docs/ODDS_AND_ADVANCED_MODEL.md](docs/ODDS_AND_ADVANCED_MODEL.md) for the $0 key activation, reserved-quota guard, server-only cache, exact-match comparisons, official MLB probable pitchers and strictly gated quarterback/defensive scheme/goalie/pitcher–hitter research inputs. These are not paid bets or validated betting edges.

## v6.2 — Automatic sportsbook numbers and market ticket research

- **Connected and verified 2026-11-17:** The Odds API US h2h moneyline cache initially returned 5 NBA, 29 NFL, 14 NHL and 0 out-of-season MLB events. The price comparison comes from actual book offers; no invented lines.
- **Automatic refresh:** Supabase Vault + pg_cron calls the Edge endpoint at 17:00 and 23:00 UTC, only during each sport's season. The server-only credential is randomly generated in Vault. Visitors may only GET shared cached results, never POST an upstream provider refresh.
- **Free credit ceiling:** One US region and one moneyline market per league, at most 400 credit reservations per UTC calendar month (the provider free plan normally includes 500). The schedule runs at most ~240 refreshes/month across four fully in-season sports, fewer when a league is out of season. No subscription upgrades.
- **Market estimate:** Average bookmaker-implied win chance after normalizing away each bookmaker's two-outcome overround. This is **not a model forecast, a calibrated confidence score, an edge claim, or sportsbook profitability**.
- **Auto Ticket:** User picks a target market-implied percentage (50–95%). The UI obtains the single cached league snapshot, considers future games and source prices not older than eight hours, and chooses up to two different games. It fills market-implied percentages, book names, American odds, and the already-tested payout calculations. It never places a bet and explicitly asks the visitor to verify fresh bookmaker quotes.
- **Experimental form model:** Independent season-record estimates remain labeled experimental. No unvalidated QB scheme, coaching, NBA lineup, NHL goalie, MLB pitcher/hitter, player props or correlated parlays are falsely promoted.
- **Safety:** Quotes can change, some books have restricted markets or regional availability, and a mathematical break-even percentage is not a model confidence. The builder does not calculate a validated joint parlay probability.

Release QA: `npm test`, `npm run build:onefile`, `npm run build:static`, `npm run verify:release`, and the GitHub Chromium smoke workflow. Backend: `supabase/functions/sportsbook-odds/index.ts`, `supabase/migrations/003_scheduled_credit_safe_sportsbook_odds.sql`.

