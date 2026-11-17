# Sports Spreads — live community beta model status

_Last audited: November 17, 2026._

## Working today
- A verified live ESPN-site feed is now reached through a restricted Supabase Edge relay, with an alternate ESPN hostname when the primary returns 403/429. Browser direct lookup is a last-resort fallback.
- League scoreboards, NBA rosters and grouped injury reports have been checked. Feed data is **unofficial and may be unavailable**.
- Experimental **Season Form v0.1** computes pregame home/away win estimates from team W-L records, league-specific shrinkage and an assumed home advantage when both records exist.
- For outdoor NFL/MLB games, actual weather features are collected and can widen an **illustrative sensitivity range**. This is not a backtested directional probability adjustment.
- The UI has a hidden-by-default **Matchup intelligence** section for each league. It tracks data availability, not guessed metrics.
- Cloud ticket snapshots use Supabase per-user Row Level Security. Odds are entered by the user and are not verified sportsbook feeds.

## Advanced matchup factors — in the model data contract, not yet scored
| Sport | Important future inputs |
| --- | --- |
| NFL | QB EPA/success under blitz vs defense blitz tendency; man/zone coverage vs QB; offensive protection vs pass rush; verified injuries, rest/travel, coaching tendencies. Coaching head-to-head is descriptive until adjusted for confounding and sample size. |
| NBA | Pace and possession efficiency; switch/drop/zone scheme vs shot profile; lineups/on-off, rest, travel and coaching rotations. |
| NHL | Confirmed goalies, five-on-five expected goals, special teams, rest and coaching systems. |
| MLB | Starting pitcher pitch mix and splits, opponent lineup, bullpen fatigue, fielding, stadium/weather and managerial decisions. |

**Crucial:** These advanced metrics currently have no live trustworthy provider, do **not** change win estimates, and do **not** produce a confidence grade. A factor becomes a numeric model input only after timestamped data, sample validation, historical fitting and holdout calibration. Do not confuse the implemented feature contract with a trained model.

## Code audit — targeted refactor, not a full rebuild
- The site is small and fast as a single published static HTML bundle. Keep it for community UI testing.
- Its source has separate weather, prediction, cloud and matchup modules, but `public/app.js` is still a >60KB view/data monolith. Split it before a broader production release.
- The repository's deployed `index.html` is the verified public source. The modular source and tests are in the downloadable audited project bundle; they should be synced into GitHub and automated in CI.
- Fixed feed fallbacks to show honest empty states rather than unverified teams; fixed grouped NBA injuries.
- The test suite has **49 passing Node tests**, including regression checks. This does not equal a full cross-browser or historical prediction backtest.
- Public sharing link: https://sports-spreads.onrender.com/ (no ChatGPT wrapper).

## Release blockers for genuine production prediction service
1. Licensed / supported multi-sport live data and terms review.
2. Source-of-truth historical point-in-time event and player feature store.
3. Ablation studies and out-of-time Brier / log-loss calibration, especially for scheme and weather factors.
4. Verified live odds feed before EV claims; player-prop projection and within-game correlated probability model.
5. Full iOS/Android browser tests, accessible focus and reduced motion, feedback triage.
