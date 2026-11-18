# Sports Spreads V4 — post-release architecture audit (2026-11-18)

## Decision
**Targeted modernization, not a ground-up rebuild.** The V4 refactor meaningfully improved separation of responsibilities and test coverage, but a complete rebuild is not justified by current evidence. Performance and production-browser behavior need measured baselines before any further architecture migration.

## Verified evidence
- `src/app/` has 13 ordered feature/controller modules, assembled by `scripts/build-app.mjs` into `public/app.js` (~109 KB). `tests/v4-cross-module-contract.test.mjs` verifies source-to-bundle parity and singleton critical loader definitions.
- `public/style.css` remains ~55 KB; `src/app/20-views.js` ~22 KB and `src/app/30-controller.js` ~16 KB are still large and coupled through shared global `state` and full `app.innerHTML` rerenders.
- `scripts/build-onefile.mjs` inlines all JavaScript and CSS into `release/index.html` / root `index.html`; production Render build command copies root `index.html` into `public/index.html`. This is a distinct deployment path from `dist/` and staging's `public/index.html` multi-file path.
- The generated production standalone sets `window.__STANDALONE_PREVIEW__=true`. `readSportsData` uses `directSportsData` in this mode; `directJson` tries the configured Supabase sports-feed relay first, then attempts direct ESPN if the relay fails. This fallback is intentional, but browser/relay behavior differs from the normal `readSportsData` path.
- `src/prediction-model.js` is an older preview implementation and `public/prediction-model.js` contains approved NBA/MLB record calibration manifests. Treat `public/prediction-model.js` as authoritative until model source generation is unified. Copying `src/` over it would regress calibration.
- NFL/NHL advanced factors are research-only because historical point-in-time data and out-of-sample promotion criteria have not been met. No claim of validated player props or parlay probabilities is warranted.
- GitHub release verification, compatibility, browser smoke, and read-only staging integration passed on the V4 release candidate. Render production deployment `dep-dbuobagae00c73f53ti0` reported live at commit `f3fb3b3`.

## Priority fixes
1. **P0: Production-equivalent smoke coverage.** Run a live production read-only browser test that exercises the standalone artifact, sports feed, team details, builder, mobile and TV. Keep paid odds refresh private.
2. **P1: Unify deploy outputs.** Choose one canonical production artifact, then update Render and CI together under a staging rollout. Do not casually switch Render publish path; it currently publishes the one-file root copy.
3. **P1: Eliminate model source drift.** Move approved NBA/MLB calibration configuration to a single source of truth and test generated output against the deployed version.
4. **P2: Isolate state/rendering.** Break up the large view/controller files, replace whole-app redraws on every small asynchronous update with scoped updates, and add browser performance benchmarks.
5. **P2: Quantify before rewriting.** Record JS payload sizes, first render, layout shifts, API requests per navigation, memory/CPU on mobile, and fallback usage. Only approve a ground-up rewrite if measured costs exceed targeted refactor costs.

## Release guardrails
No production betting model promotion without point-in-time provenance, sufficient disjoint holdout samples, confidence intervals, and approved calibration gates. No additional sportsbook provider calls from public browsing. Keep static hosting and avoid unnecessary paid services.

## Conclusion
The code is **structurally cleaner** than before the modularization, but **not fully optimized or proven faster**. Another full rebuild would currently increase regression risk and duplicate work; the next engineering step is a focused deployment-unification and source-drift remediation with production-equivalent browser testing.
