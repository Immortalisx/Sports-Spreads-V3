# Sports Spreads v2 — migration strategy

## Principle

Rebuild the UX and adapter layer; **preserve the existing prediction engine** unless independent verification demonstrates that an algorithm is unsound. Keep v1 public while developing and validating v2.

## Release gates (in order)

1. **Inventory v1:** obtain read access to source, API handlers, cron jobs, model calculation code, historical data, current refresh mechanism, Site project and secrets metadata (not raw secret values). Record currently working flows.
2. **Data lineage:** define a canonical Game, Team, Player, Injury, Story, MarketQuote, Forecast, Outcome contract. Every field has source, fetch timestamp, availability status and version. Resolve stable IDs across providers.
3. **Supported feeds:** replace prototype ESPN endpoints with commercial-friendly licensed/supported feeds. Test schedule timezone boundaries, NFL bye weeks, NBA doubleheaders, NHL overtime, MLB postponed/doubleheader games, rookie records and empty league calendars.
4. **Model adapter:** wire v1's actual projections into cards without recalculating them in the browser. Record forecast version, run timestamp, inputs, stale gates and calibration. No model output → show 'unavailable', never fabricate a percentage.
5. **Market data:** retrieve timestamped sportsbook odds from authorized source(s) with market identity and book, and compute implied probability/EV only when the event and market match and inputs are fresh.
6. **Ticket engine:** implement correlation-aware parlays (especially same-game player props), market rules and unsupported-combination validation. Preserve the manual builder until data is trusted. Add player yardage 0–200 and TD 0–5 UI once markets and probability distributions have verified support.
7. **Longitudinal auditing:** store a snapshot before kickoff, never overwrite old forecasts when models refresh. Match final event/player data, mark void/postponed games, and calculate calibration, Brier score, log loss and realized ROI after grading.
8. **Analytics:** instrument PostHog actions (game_opened, team_opened, roster_viewed, injury_report_viewed, player_opened, ticket_leg_added, feed_error) without sending betting slips or personal info unless appropriately consented. Build a short UX funnel dashboard.
9. **Release:** add unit/integration/visual tests and accessibility checks, reconcile v1-v2 side by side for multiple league days, set up staging and rollback. Only switch domain after sign-off.

## Plugin handoffs

- **Firecrawl:** research, external cross-checks and supplementary source inspection; budget 10 credits per task unless approved.
- **Airtable:** versioned prediction audits or administration, ideally with immutable archive in SQL for scale.
- **PostHog:** privacy-aware usage analytics and error insights, not the sports prediction engine.
- **Wolfram:** numerical checks of implied probabilities, parlay math, calibration and simulation consistency.
- **GitHub:** pull-request review, version history, branch protection and CI when linked.

## API contract

- `GET /api/scoreboard?league=nba&date=20261117`
- `GET /api/teams?league=nba`
- `GET /api/team/nba/28?view=profile`
- `GET /api/team/nba/28?view=roster`
- `GET /api/team/nba/28?view=injuries`
- `GET /api/team/nba/28?view=news&name=Toronto%20Raptors`
- `GET /api/status`

Upstream endpoints are unstable; do not confuse this experimental API with a production SLA.
