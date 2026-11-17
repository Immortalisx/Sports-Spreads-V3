# Sports Spreads — comprehensive release audit
**Date:** November 17, 2026  
**Verdict:** Targeted hardening and iterative testing, **not a full rewrite**.

This audit covers the current repository's source modules, GitHub CI, deployed Render site, Supabase Edge functions and RLS/cache/cron policies. It is not a formal penetration test, a complete device test matrix, a sportsbook integration certification, or a demonstration of betting profitability.

## Inspected components
- `src/app/{00-feed,10-state,20-views,30-controller}.js`; `public/{app,prediction-model,multifactor-engine,odds-browser,auto-ticket,weather,style}.js` or CSS as appropriate, `index.html` and `public/index.html`.
- Build scripts (`scripts/build-app.mjs`, `scripts/build-onefile.mjs`, `scripts/verify-release.mjs`) and unit/browser regression tests.
- Research ingestion, season-separated calibration and historical source manifests under `engine/`; the four independent holdout GitHub workflow reports.
- Supabase odds cache, monthly budget guard, Vault-only refresh token, two daily odds refreshes, new once-daily ticket publisher, RLS and service endpoint auth.

## Findings fixed and checked
1. The initial emailed failed GitHub Actions runs were from intermediate PR changes: old wording assertions and Chrome fixture timing. Subsequent checks use the final release source, not the old PR head.
2. NBA and MLB record-only estimates have now been trained, validation-calibrated, and approved on untouched 2025/2025–26 seasons (see `CALIBRATION_RELEASE_2026-11-17.md`). NFL/NHL lack independent approval. Advanced player/coaching/goalie/lineup factors have no supported live coefficients.
3. The manual builder now warns if individual legs use bookmaker prices from different operators. Automatic builders **require all legs from the same sportsbook**, so they do not advertise a hypothetical payout across incompatible sportsbooks.
4. The provider's US odds region includes offshore bookmakers. Automatic and daily suggestion generators filter to explicitly supported US sportsbook brands, not any available operator; quote provenance and timestamp remain visible. Geographic eligibility still depends on the user's state and actual sportsbook.
5. The shared odds cache is server-side, read-only for visitors and guarded by a maximum of 400 monthly upstream-credit reservations; provider refresh is private and scheduled. Daily ticket generation reads only shared cached odds and spends no provider credits.
6. Once-per-Eastern-day suggested bundles are stored in a private RLS-protected table and served through GET; the owner-authenticated POST refresh uses Supabase Vault. No bet is submitted.
7. Daily suggestion cards are Steady (2 legs), Balanced (3), Upside (3), and 'The Big One' (4 legs where qualifying quotes exist), including a visible payout multiplier and a **market-based risk grade**, explicitly not a calibrated parlay confidence.
8. CI now tests one-file build reproducibility, JavaScript syntax, responsive mobile/TV UI and Chrome ticket interactions. Superseded PR jobs are canceled to reduce redundant failure emails.

## Open limitations
- Neither the new record model nor daily tickets has proven positive edge or outperformance versus historical sportsbook no-vig prices. NBA/MLB passing a constant home-rate baseline does not make it an industry-leading forecasting model.
- NFL and NHL record-only probabilities, and **all** detailed QB-versus-blitz, NBA lineup, NHL goalie and MLB pitcher-hitter factors, remain unvalidated for live prediction use. Do not label them official or show confidence grades from these missing inputs.
- Multiplying game probabilities assumes independence. The resulting parlay probability is *illustrative*, not correlated-joint calibrated. A large multiplier has a low chance of success and can be limited by sportsbooks.
- Free odds are typically cached for hours and may change rapidly before kickoff. Quotes must be rechecked with a legally available sportsbook.
- The ESPN site feed is unofficial and can intermittently return upstream 502. Source availability and redistribution rights need review before a commercial release.
- Independent iPhone Safari testing, load tests, persistent latency/credit monitoring, redacted error telemetry, cross-account cloud saves, and an independent security assessment have not been completed.
- Link-only distribution is **not** a privacy/access-control boundary.

## Recommendation
**Do not rebuild from scratch now.** Existing modular source, RLS, bounded server-side odds cache and reproducible CI are a good foundation. Next work should be data quality and audited expansion of pregame player/lineup features, versioned prospective predictions/quotes/outcomes, benchmark comparisons, device testing and hardening. Only then claim a calibrated multi-factor model, positive edge, or credible confidence tiers on parlays.

References:
- [Calibration evidence](CALIBRATION_RELEASE_2026-11-17.md)
- [Release CI](https://github.com/Immortalisx/Sports-Spreads-V3/actions/workflows/verify.yml)
- [Chrome QA](https://github.com/Immortalisx/Sports-Spreads-V3/actions/workflows/browser-smoke.yml)
- [Maryland legal sportsbook guidance](https://www.mdgaming.com/legal-vs-illegal-online-gaming/)
