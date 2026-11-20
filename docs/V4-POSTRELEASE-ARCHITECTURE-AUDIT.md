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


---

## Non-model infrastructure and application audit — 2026-11-18 (follow-up)

**Scope:** Read-only examination of GitHub `main` at `4a0c98bcb54eeac4e1979ce27dddaa0b1a51232a`, three Render static services, build scripts, release workflows, browser smoke/performance harness, frontend state/render/feed adapter, and public Supabase Edge relay/odds-cache implementation. No prediction engine, calibration, model coefficients, migrations, or NHL research PR #49 were changed. This is a source/configuration review, not a completed penetration test or physical-device benchmark.

### Infrastructure inventory (observed)

| Role | Render service ID | Branch | Auto-deploy | Build command |
|---|---|---|---|---|
| Production `sports-spreads` | `srv-dbu9jadckfvc73co8ja0` | `main` | `yes` / `commit` | `mkdir -p public && cp index.html public/index.html` |
| Legacy `sports-spreads-v3` | `srv-dbu9dmmi0phs7395noq0` | `main` | `yes` / `commit` | same copy command |
| Staging `sports-spreads-v4-staging` | `srv-dbuo5v1srm7s73fgc78g` | `v4-batch11-live-integration-audit-2026-11-18` | `no` | `npm run build:static && npm run verify:release` |

The production service's recent Render `deploy_started` events contain a user-trigger payload; no automatic commit-triggered event was established. **Root cause unconfirmed:** GitHub App authorization, event delivery, and Render integration health cannot be inspected or repaired through the current connector permissions. A healthy `autoDeployTrigger: commit` setting does not establish successful webhook delivery. Do not rotate credentials, recreate services, or push empty commits as a diagnostic.

### Ranked findings and evidence

1. **P0 — Unverified GitHub-to-Render event delivery.** Render production config has `autoDeploy=yes` and `autoDeployTrigger=commit`, yet observed deploy events were user/API initiated. **Gate:** an authorized operator checks GitHub Render App installation/repository access and Render Git connection, then observes the *next legitimate main merge* create exactly one automatic production deployment. Verify commit SHA, successful deploy, and public page. No synthetic build.
2. **P0 — Build/deploy artifact parity risk.** `verify.yml` generates `release/index.html` and `dist/` and checks root `index.html` parity, but production Render only copies the checked-in root file. Staging runs a different build command and serves a different artifact. **Gate:** byte-identical generated root/release/public production copy verified in CI; stage a single canonical production build/publish contract before editing Render settings. Never switch `staticPublishPath` to `dist` without browser regression and explicit release approval.
3. **P1 — Duplicate main-following Render service.** `sports-spreads-v3` and `sports-spreads` both follow `main` with auto-deploy enabled. This can consume redundant build capacity if event delivery resumes. **Gate:** confirm whether the legacy URL has active users/dependencies; disable its auto-deploy only after that review. Do not delete or suspend it during the audit.
4. **P1 — Generated artifacts and install-time test side effects.** `npm test` regenerates browser bundles; `postinstall` runs `npm test`; CI separately runs `build:onefile`, `test`, `build:static`. This complicates reproducibility and makes install trigger mutation/test work. **Gate:** a separate draft PR introduces an explicit, reproducible release preflight with no production behavior change; only later consider removing `postinstall` with CI coverage.
5. **P1 — Global DOM rerenders.** `src/app/30-controller.js` replaces `app.innerHTML` whenever markup changes. This may reset focus/selection and cause layout work under refresh. **Gate:** collect event-to-render timings and interaction/focus regressions before scoped updates; preserve desktop/TV/mobile functionality.
6. **P1 — Feed routing/fallback divergence.** `src/app/00-feed.js` supports `/api/` and a static Supabase relay/direct-ESPN fallback; `server.mjs` has a separate Node API path, while production is a static site. **Gate:** document the active route per environment, test relay failure and stale/empty results, and preserve read-only/no-paid-provider behavior.
7. **P2 — Cache freshness and post-deploy perception.** Render static responses have previously served old HTML briefly after successful deployment; verify `/` and cache-busted `/?release=<sha>` separately and inspect cache headers. **Gate:** a read-only production smoke must check the *normal* URL eventually serves the expected release, not just Render's deploy status.
8. **P2 — Security boundary follow-up.** `public/index.html` embeds a Supabase publishable key (expected to be public); `public/cloud-browser.js` uses user-scoped session storage; `supabase/functions/sportsbook-odds/index.ts` advertises public GET/read-only and separately authorized POST refresh. **Gate:** test CORS, RLS, error sanitization, XSS sinks, rate limiting and authorization independently. Do not expose service-role credentials or call paid refresh endpoints in tests.
9. **P2 — Performance baseline is lab-only.** `qa/performance-benchmark.mjs` uses mocked API responses and Chromium emulation, tests mobile/desktop navigation and matchup latency, and estimates Brotli bytes. This does not establish physical-device performance, CDN transfer size, or real-world network timings. **Gate:** add network/CPU-throttled production-equivalent smoke and report results explicitly as emulated.

### Staged repair batches (each a separate draft PR)

- **Batch A — Inventory and operator runbook (this audit PR).** Document service IDs, Git/Render diagnosis, root-cause uncertainty, no-build verification, rollback, and ownership. Documentation only; cannot repair external App permissions through GitHub repository commits.
- **Batch B — Release parity CI.** Harden `verify:release` to check the exact Render-published copy and ensure GitHub CI checks generated artifacts against committed files. No Render setting changes or model changes.
- **Batch C — Frontend/data-loading reliability.** Add narrowly scoped tests for stale responses, focus preservation, loader failures, and cache freshness; refactor only measured bottlenecks.
- **Batch D — Security/performance gates.** Read-only CORS/auth/error tests, Chromium mobile/desktop/TV/4K smoke and no-paid-call assertions. No live provider refresh POST.

### Release/rollback checklist

1. Confirm all draft PRs are independent of NHL PR #49 and contain no model, calibration, odds-credit or migration changes.
2. Run unit/integration, generated-file parity, browser smoke and performance tests on the candidate commit. CI passing is necessary but not sufficient.
3. Confirm staging artifact and browser behavior match intended production artifact before any production Render configuration change.
4. Merge only with explicit release approval, and verify **one** Render deployment at the merged SHA. If auto-deploy does not occur, diagnose Git integration before any manual recovery; avoid duplicate builds.
5. Check production normal URL and cache-busted URL, mobile/desktop/TV, read-only feeds and failure states. If regression occurs, roll back to last verified commit via Render, then verify public content.
6. Keep `sports-spreads-v3` and staging unchanged until legacy dependencies and user traffic are confirmed. Keep NHL PR #49 draft/unmerged and all paid refresh endpoints untouched.

**Current disposition:** findings documented; no integration repair, Render setting change, merge, deploy, or production performance claim has been made.
