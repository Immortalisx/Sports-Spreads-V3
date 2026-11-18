# Sports Spreads V4 — staged rebuild plan

**Status:** Foundation PR; production V3 stays unchanged until reviewed and tested.

## Source of truth and release contract
- The active public URL is https://sports-spreads.onrender.com/.
- The active Render service is `sports-spreads`, a static site that builds by copying the root, generated `index.html` to `public/index.html` and publishes `public/`. It is configured for commit auto-deploy.
- The root `index.html` is a **generated artifact** of `npm run build:onefile`. The human-maintained browser sources are `src/app/*.js`, `public/index.html`, `public/*.js` and `public/style.css`.
- `npm run build:static` generates `dist/` for an alternate static deployment; **it is not the active Render publish path**.
- `src/prediction-model.js` and `server.mjs` are legacy/alternate implementations; do not silently use either as the live prediction or data path. The production prediction implementation is `public/prediction-model.js`.
- Keep generated one-file artifact matching the committed root artifact until the release process is deliberately changed.

## Rebuild batches and acceptance gates
1. **Deployment contract (this PR):** make `render.yaml` match the actual production service and add an automated contract check. No UI/model/API changes.
2. **Single-source browser modules:** separate `src/app/20-views.js` into feature-specific view modules and `src/app/30-controller.js` into event/data controllers. Preserve HTML selectors and action IDs. Verify full generated one-file output, browser interactions and phone/TV layouts.
3. **Data access contracts:** consolidate feed, odds, injuries and goalie clients with schema, provenance, cutoff and stale-state validation. Preserve read-only public access, RLS and the upstream credit budget.
4. **Prediction ledger:** immutable pregame snapshot/version/market quotes, outcome reconciliation, replay and time-based holdouts. No unvalidated probability promotion.
5. **NFL/NHL modeling:** calibrate from real current-season and historical pregame observations, including opponent matchups and availability only where verifiable. Keep provisional asterisks until independent holdouts pass.
6. **Ticket builder and UX:** separate pricing, correlation assumptions, confidence language and ticket persistence. Preserve daily suggestions and The Big One; do not imply sportsbook placement.
7. **Release:** run unit, integration, Chromium, cache/security and data-credit checks on a staging preview; compare V3 and V4 outputs before merging. Do not change the production URL or create a paid service.

## Non-negotiable regression checks
- Existing NFL/NBA/NHL/MLB tabs, Eastern game starts, mobile/TV layouts and cloud/local tickets work.
- Existing bookmaker cache, owner-only refresh, monthly credit reservations and once-daily suggestions are unchanged unless separately tested.
- NBA/MLB calibrated record-only status is not silently replaced; NFL/NHL experimental estimates are never represented as validated.
- Never treat missing source data as zero, a confirmed starter, or a historical pregame fact.
- No automatic deploy from a V4 feature branch to the production site.

## Known limitations
The code audit is not a profitability study or independent security penetration test. UI refactoring cannot establish model accuracy. Production's Render service settings currently override historical repository blueprint drift; blueprint edits should not be applied as an unreviewed new service.
