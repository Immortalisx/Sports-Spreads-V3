# Sports Spreads — non-model frontend, data, security and performance audit
Date: 2026-11-18. Base: production main `4a0c98bcb54eeac4e1979ce27dddaa0b1a51232a`.

## Scope and confidence
Source review of `src/app/00-feed.js`, `10-state.js`, `27-board-team-loaders.js`, `30-controller.js`, `public/cloud-browser.js`, `supabase/functions/sportsbook-odds/index.ts`, `qa/performance-benchmark.mjs`, `package.json` and existing CI contracts. This PR adds regression assertions for existing security/cost boundaries. It is **not** a completed penetration test, production load test, provider billing audit, or physical-device benchmark. No model, calibration, NHL research, production service, or paid API was modified.

## Prioritized findings

| Severity | Finding | Source evidence | Proposed independent repair |
|---|---|---|---|
| P1 | **Directory request races**: `loadTeams(force)` has no in-flight deduplication or request generation token. Concurrent forced calls for the same league may let an older response overwrite newer data; it also renders after the user navigates away. | `src/app/27-board-team-loaders.js` `loadTeams` | Add per-league generation guard, dedupe non-force loads, and a deferred-promise race regression test. |
| P1 | **Team detail redraws after navigation**: `loadTeam` captures a drawer and cache key, but `finally` renders unconditionally, even if that drawer is no longer open. Cached responses are useful, but unrelated full-app renders can interrupt input focus. | `src/app/27-board-team-loaders.js` `loadTeam`; `src/app/30-controller.js` `render` | Render only if active drawer still matches; test rapid team/tab switches and focus preservation. |
| P1 | **Full markup replacement**: `render` avoids identical-string replacements but otherwise assigns `app.innerHTML=next`, recreating the entire tree on small state changes. | `src/app/30-controller.js` | Instrument and benchmark redraw/focus/scroll before introducing narrowly scoped patching. |
| P1 | **Feed fallback latency**: `directJson` tries a relay then direct ESPN with a single 12-second timeout. A slow relay can consume the entire budget before the fallback. The direct fallback may also be blocked by CORS. | `src/app/00-feed.js` | Test timeout/fallback behavior with mocked requests, and consider bounded per-origin timeouts without new provider calls. |
| P1 | **Non-canonical data paths**: standalone mode uses browser relay/direct ESPN and cached API-Sports snapshots; the separate Node server uses its own routes. Data provenance and error handling can diverge between production static, staging and local server. | `src/app/00-feed.js`, `server.mjs`, `scripts/build-onefile.mjs` | Add parity fixtures and explicit provenance/age labels, never fabricate confidence. |
| P2 | **Install-time side effects**: `postinstall` runs `npm test`, which regenerates bundles. This makes installation slower and may obscure artifact drift. | `package.json` | Separate install/build/test in a future draft PR after CI proves parity. |
| P2 | **Client auth storage**: Supabase tokens are in browser sessionStorage; public publishable key is not a secret. Browser compromise/XSS remains a token-exposure risk; server-side RLS must be independently validated. | `public/cloud-browser.js` | Security test for escaping and user-scoped RLS with isolated fixtures; do not use real user tokens. |
| P2 | **Read-only paid odds boundary**: sportsbook odds public GET is documented as cache-only and paid refresh requires a separate authenticated POST. Source checks alone cannot establish deployed function policy or billing usage. | `supabase/functions/sportsbook-odds/index.ts` | Assert unauthenticated POST is rejected in isolated staging and check actual provider usage out-of-band; no live refresh in CI. |
| P2 | **Performance evidence is emulated**: Chromium fixtures stub all external APIs and Brotli is an estimated compressed payload, not actual CDN transfer. | `qa/performance-benchmark.mjs` | Capture real network waterfalls, long tasks, layout shifts and mobile/TV interaction timings with safe read-only traffic. |

## Existing protective controls
- Board response guard compares captured league/date to current state before committing results.
- Team detail requests dedupe by cache key while in flight.
- Feed calls use AbortController, bounded timeouts, status/error handling and a shared cached NBA/NHL path.
- Browser cloud adapter uses publishable keys and sessionStorage, not service-role secrets.
- Odds GET is documented as read-only; public visitors must not trigger licensed upstream refresh.
- Performance harness explicitly identifies Chromium emulation and mocked providers.

## Staged follow-up repair gates
1. **Frontend race and focus PR**: tests for stale directory responses, rapid drawer navigation, abort/fallback behavior, then minimal source changes; rebuild committed `public/app.js` and standalone root and pass parity CI.
2. **Security and data contract PR**: isolated RLS/CORS/XSS tests, source-to-deployed-function policy review, no refresh POST or user tokens.
3. **Performance PR**: baseline first, then target only measured bottlenecks; mobile, desktop, TV and 4K; preserve model calculations.
4. **Release**: draft until every CI/Chromium check passes. No merges or production deploys without separate approval. PR #49 remains untouched.

**Costs:** no new provider calls, paid APIs, Render deployments or production builds from this audit branch.
