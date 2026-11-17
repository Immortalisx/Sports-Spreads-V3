# Prelaunch code audit – Sports Spreads v3.4

## Decision: targeted refactor; no full rewrite
Keeping the existing UI, model code, ticket builder, weather, and cloud RLS system avoids retesting everything from scratch.

### Fixed in this release
1. ESPN browser-only cross-origin failures now have a restricted, cached Supabase Edge relay. The relay retries the alternate ESPN site hostname after 403/429.
2. Unavailable league/team feeds show an honest empty state rather than sample teams that look like live data.
3. Model architecture includes NFL blitz/coverage/pass rush/coaching, NBA scheme/pace/lineups, NHL goalie/5v5/special teams and MLB pitcher/bullpen/park factors, gated on provenance and samples.
4. Source build includes the matchup module in both standalone and multi-file versions.
5. Regression tests cover fallback and failure-to-empty-state behavior.

### Follow-up engineering work
- Break the 60+KB `public/app.js` into view components, state management, data adapters, and event handlers.
- Pin and document a supported licensed sports feed before a broader public/commercial launch; don't over-poll undocumented endpoints.
- Collect a historical point-in-time feature store (QB blitz, coverage, lineups, coaching) and evaluate with temporal cross-validation; don't use made-up weights.
- Add CI build reproducibility, staged deployments and browser-level end-to-end tests. Automated Node tests do not by themselves prove iPhone/Safari usability.
- Auth email delivery to the Discord community requires configured SMTP or OAuth. Secure cloud saving DB is active, but general Discord member email login is not yet verified.
- Introduce versioned prediction ledger and reliability dashboard to quantify calibration before allowing automated betting recommendations.

### Security
- Client uses Supabase publishable key only, protected by per-user RLS. No service-role secret shipped.
- Public sports relay only supports GET/OPTIONS and fixed ESPN sports paths; URL query values are restricted. CORS permits only the named site origins.
- Notes and feed text are escaped in the UI. No betting transactions are performed.

### Costs
- Additional sports relay runs within Supabase Free plan quotas unless usage grows. Monitor invocations; this is *not* a guarantee of no future rate limits.
