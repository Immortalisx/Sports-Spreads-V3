# Sports Spreads v4 — refactor, checks, and rollout

## Refactor outcome

The original 60+KB handwritten UI controller is now **generated from four reviewable source modules** in `src/app/` by `npm run build:app`:
- `00-feed.js`: validated sport routing, read-only fetch and normalized ESPN website data
- `10-state.js`: app state, browser persistence, formatting and icons
- `20-views.js`: accessible views, game drilldowns, tickets and the feature-status panel
- `30-controller.js`: event handlers, cloud actions and 3-character autocomplete

Separate browser modules own `autocomplete.js`, `multifactor-engine.js`, `prediction-model.js`, `weather-model.js`, `weather.js`, `matchup-intelligence.js`, and `cloud-browser.js`. The build bundles them as one static HTML file for the existing **$0 Render static service**, avoiding an always-on server and a full framework rewrite. Auth remains in Supabase Free using only the publishable key and per-user RLS.

## Autocomplete behavior

- After **three characters**, suggest matching team names, abbreviations and words in the current sport.
- Lazy-load the league's team directory once; on selecting a team for a player-prop market, fetch **that team's roster once** and begin suggesting its players. This avoids polling dozens of rosters on every keystroke.
- Accessible combobox / listbox with Arrow keys, Enter and Escape; escape source text; cap dropdown to seven items; allow manual names if the unofficial data source fails.
- Selected player/team IDs are captured only when the displayed selection matches the chosen suggestion.

## Model validation

`npm run validate:model` reports `no_historical_data` by default. Real training requires pregame timestamped evidence; point-in-time leakage, too few observations, missing sources and failed holdout calibration halt production promotion. Sports-specific features, thresholds and provenance are enumerated in `public/multifactor-engine.js`.

The NFL historical research report measures weak/insufficient gains from rest and coaching, so **those features remain observational rather than claiming superior predictions**. Pitcher vs hitter, QB vs blitz, coaching matchups and other proposals are designed and visible in the factor UI but not assigned coefficients without verified historical rows.

## Checks / release process

`npm test` runs the Node unit and VM-based UI regression tests. `npm run build:onefile` and `npm run build:static` make the reproducible deploy. `tests/build-integrity.test.mjs` compiles every inline script and tests script order before pushing. In-browser real rendering can be checked by an external live-site verification, since local Chromium may be blocked by platform restrictions.

The GitHub repository root `index.html` must match generated `release/index.html`, which CI enforces; Render publishes root `index.html`. Prefer staging branch plus one promotion commit to avoid repeated free-tier builds. No paid APIs, scheduled jobs, secrets or admin keys are required.

## Beta limits

- ESPN source unofficial: may fail, be incomplete or change. UI must fail clearly, not silently substitute fictional games.
- Public Discord sharing stays a plain HTTPS site link. The feedback composer only copies messages; it does not save to Discord.
- Email cloud saving to non-team members is limited until SMTP or OAuth is properly configured. Local saving remains free.
- Weather is not retrospectively treated as known just because actual conditions exist after kickoff.
