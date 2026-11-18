# Sports Spreads — Source-gated matchup intelligence and prospective market audit
Date: 2026-11-18

## Shipped implementation, in priority order

1. **NFL coaching matchup research:** The private \`sports_coaching_latest\` table receives a daily, seasonal refresh of nflverse/nfldata regular-season coach histories via the existing Vault-owned refresh token. Public \`nfl-coaching\` GET is restricted to one upcoming fixture; it does not call upstream. The game details display last-recorded head coaches, their coached-team recent results, and descriptive head-coach head-to-head only. No scheme, fourth-down, blitz or betting probability is inferred from game outcomes. Source names can lag actual staffing changes. When fixture date is not after the source's last completed game, the server fails closed.
2. **Current season trends:** Extend the previously private, once-daily \`season-form\` snapshots with up to 10 strictly past-date results per team, displayed as compact W/L glyphs on the game details screen. No extra request at webpage launch.
3. **Cross-sport scouting comparisons:** For NFL/NBA/NHL/MLB, a collapsed offense-vs-opponent-defense panel compares actual recent scoring and conceded scoring using the existing sourced last-five snapshots. This is not an expected score, win forecast or calibrated model component. The previously implemented NHL recent goalie, NFL injury and MLB probable pitcher panels remain supported.
4. **Performance budgets:** Extend the existing no-provider-credit Chromium mobile and desktop lab to measure game detail opening alongside compressed document size, builder navigation and horizontal overflow. These are emulated browsers, NOT physical-device benchmarks.
5. **Visual changes and market movement:** Add compact coaching cards, sourced W/L trends and a lazy archived moneyline consensus chart. It only appears after a visitor explicitly requests market history for an exact sourced event. The \`market-history\` public function is game-scoped; neither visitors nor the public database role can dump the underlying source table.
6. **Prospective audit foundation:** The private \`sports_market_history\` table stores immutable, normalized bookmaker no-vig home probabilities and timestamps from the existing shared cached US h2h data, with one row per event and snapshot. A database function archives them after the existing 17:00 and 23:00 UTC odds refreshes. It consumes **zero extra Odds API credits** and preserves historical pregame prices for future proper outcome/model testing. It does NOT yet validate model performance or profitability.

## Cost & protection guarantees

- No new paid data subscriptions or provider API keys.
- NFL coaching import: at most one free public CSV fetch per day during football months; only the privately authorized cron can invoke it. All visitor requests are cache reads.
- Sportsbook archive: runs inside the existing Supabase DB and reads **only** the cached provider quotes; no upstream refresh or paid credit reservations.
- Current-season history: one existing scheduled owner refresh per active league. No additional upstream source query per visitor.
- New browser requests occur **only when a game is opened or the price-history control is selected**.
- Keep \`sports_coaching_latest\` and \`sports_market_history\` RLS enabled and deny public table grants. Edge functions expose a single matchup/event summary and no credentials.
- Reuse GitHub CI for verification; no heavy frontend chart libraries, recurrent CSS animation, new Render background workers or paid analytics instrumentation.

## What remains deliberately unverified

- nflverse game result records do not reveal blitz, coverage, fourth-down or in-game coaching strategies. Head-to-head is confounded by roster, opponent strength, game situation and team changes. No causal coaching importance weight is trained.
- Last-five team scoring and results are descriptive without verified injury-adjusted, possession-adjusted or odds-anchored improvements.
- Market-consensus curves are observed bookmaker no-vig expectations, not win probabilities from a calibrated betting model. Two or more archived timestamps are necessary to render movement.
- The new immutable archive must accumulate **future observations and then verified results** before performing a season-separated, point-in-time model-versus-market validation. It cannot retroactively prove edges from missing historical prices.
- Genuine physical iOS/Android performance telemetry through Cloudflare Web Analytics needs an account-specific site token, a privacy review, and opt-in; it has not been silently enabled.
- No new paid providers, automated wagering, or confidence uplift has been installed.

## Release verification

\`npm test\`, \`npm run build:onefile\`, \`npm run build:static\`, \`npm run verify:release\`, Chromium browser smoke checks and the expanded emulated-device performance benchmark must pass before advancing the site. Keep inline release HTML in sync with modular source.
