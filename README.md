# Sports Spreads v5 — Big Screen + historical model research

**Live site:** https://sports-spreads.onrender.com/

Fast, mobile-first NFL/NBA/NHL/MLB game explorer with sport-specific matchup detail, game-day weather context, manual parlay builder, local and optional Supabase saved tickets, and an experimental record-based baseline. Team and player suggestions appear after three characters; select a team to lazily load that team's roster for player-prop entries.

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

**This is a community beta, not a validated betting service.** Live scores and team records come from unofficial, potentially blocked ESPN website endpoints. A restricted Supabase Edge proxy caches requests; no sportsbook odds API is attached. Weather can widen an illustrative uncertainty band but has no trained directional effect. Rest, coaches, NFL QB/blitz and coverage, NBA shot/defense fit, NHL goalies and special teams, MLB pitcher/hitter splits and park/weather are defined as model inputs, not fictitious coefficients. Missing features do not change predictions. Historical NFL study: [docs/NFL_BACKTEST_2023-2025.md](docs/NFL_BACKTEST_2023-2025.md). User-entered odds are not validated or used to infer parlay confidence.

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
