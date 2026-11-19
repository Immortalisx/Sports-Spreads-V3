# Deep non-model security and performance review — 2026-11-18

This draft adds tests only. No source behavior, model, provider refresh, production service or billing configuration is modified.

## Source-reviewed findings

1. **P1: shared fallback timeout.** `directJson` in `src/app/00-feed.js` uses one 12-second AbortController across the Supabase relay and direct ESPN attempt. A slow relay can exhaust the entire budget and prevent a useful direct fallback. Next isolated repair should assign per-attempt timeouts while retaining a strict total deadline; use a mocked-fetch regression test and verify no duplicate paid API requests.
2. **P1: whole-app markup replacement.** `render()` in `src/app/30-controller.js` assigns `app.innerHTML` whenever its markup string changes. It avoids identical markup, but can reset focus, selection, scroll position and DOM nodes. Instrument focus/selection and measured render costs on mobile and TV before attempting incremental DOM updates.
3. **P1: XSS boundary.** `esc` in `src/app/10-state.js` escapes ampersands, angle brackets and quotes, and is used extensively for provider text. The new executable test checks representative hostile text. This is **not** an exhaustive XSS proof: audit every dynamic HTML and URL sink, including autocomplete `innerHTML` and any unsanitized links.
4. **P1: Supabase relay path restrictions.** `sports-feed` is GET-only, restricts routes to approved ESPN sports, bounds path and response sizes, uses a 6.5-second upstream timeout, and varies CORS by Origin. The tests verify source contracts only; deployed function configuration and invocation privileges still require separate review.
5. **P1: odds provider spending.** `sportsbook-odds` documents cache-only GET and token-validated POST. The tests guard against accidental browser embedding of server secrets; they cannot prove deployed refresh-token validation, RLS, or provider credit consumption.
6. **P2: emulated performance coverage.** Browser smoke covers 390px mobile, 768px tablet, 1440px desktop, 1920px TV and 3840px 4K. Performance benchmarks use mocked external providers and Chromium emulation, not physical devices, actual CDN transfer or measured real-user latency. Treat budgets as laboratory gates.

## Release conditions
- Run Node 20/22/24, generated artifact parity and Chromium checks on this draft branch.
- Any actual feed/render/security changes require separate small tested repair PRs and updated generated artifacts.
- Review RLS and public Supabase function settings read-only before changing access policies.
- Do not merge, deploy, modify the intelligence engine or PR #49, or make paid API requests.
