# Current season rolling matchup form (November 17, 2026)

## Verified production backfill

The protected server-only season-form refresh successfully cached **149 NFL, 205 NBA, and 324 NHL regular-season completed games**, plus scheduled upcoming fixtures, on November 17, 2026. MLB is offseason and not refreshed.

The source is the ESPN public website scoreboard. The standard year-wide query silently truncates NBA/NHL/MLB at 1,000 events, so the private server uses calendar **monthly** query slices, rejects 1,000-event responses, filters season type 2 (regular season), excludes unfinished or tied results, and merges by the original ESPN game ID. The primary hostname returned HTTP 403 from Supabase; the existing ESPN alternate website host worked. Completed months are stored and only the current month (plus prior month at month rollover) is rechecked.

## Actual features

The shared reusable rolling-form calculation constructs prior-date state for each upcoming game: each side's last 3, 5 and 10 win rates; average offense and defense scores; score margins normalized for the league; rest days; prior-opponent Elo measured before each previously completed game; and opponent-adjusted recent form. It does NOT peek at another result on the same calendar date. Team history resets for the new season.

**Release distinction:** current form is source-backed and displayed in matchup research, but its weights have not yet passed independent calibration. It does not alter NBA/MLB validated team-record estimates, NFL/NHL unapproved estimates, or parlay confidence grades.

## Credit and security design

A shared server-side schedule refreshes once daily at 17:25 UTC during each league's season. Visitors only GET cached results, causing zero provider refreshes, zero bookmaker API credits, and no credential exposure. Two Supabase RLS tables have no anon or authenticated permissions; only private, Vault-authorized POST refreshes can call the upstream scoreboard. A failed refresh preserves the last known good snapshot.

## Next model validation

Reconstruct the exact features for previous seasons. Train, select recency-window/decay, and calibrate on distinct chronological periods, then score an untouched later-season holdout and prospective 2026–27 games. Report Brier, log loss, ECE, and coverage, compared with the existing record model and historical pregame moneyline where available. No artificial confidence grades, no postgame injury or goalie information, and no statistical claims unsupported by holdout results.

Sources: engine/current-season-rolling.mjs; supabase/functions/season-form; migration 005_current_season_rolling_form.sql; tests/current-season-rolling.test.mjs and tests/season-form-source.test.mjs.
