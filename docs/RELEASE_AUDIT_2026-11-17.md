# Sports Spreads — release audit and model readiness (2026-11-17)

## Status: community beta suitable for usability feedback; not a validated betting predictor

**Public website:** https://sports-spreads.onrender.com/  
**Big Screen:** https://sports-spreads.onrender.com/?display=tv  
**Source:** https://github.com/Immortalisx/Sports-Spreads-V3

### Release verification

- Repaired GitHub Actions test ordering: missing generated `release/index.html` had broken three tests in earlier runs.
- Release suite generated the one-file build before testing, built static assets, compared generated HTML to the root deploy artifact and parsed inline scripts.
- **90 of 90 tests passed locally.**
- [PR #2 CI run](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44166172482): all steps passed.
- [Post-merge main CI run](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44166320763): passed.
- Both public URLs returned HTTP 200 and rendered real NBA games and expected page layouts. Open Graph title, description and canonical URL were checked.

### Dated scoreboard relay checks

The restricted Supabase relay returned HTTP 200 with JSON `leagues` and `events`:
- NFL Nov 22 2026: 11 events.
- NBA Nov 17 2026: 5 events.
- NHL Nov 17 2026: 11 events.
- MLB Aug 14 2026: 14 events (past regular-season date, not a current game count).

These are **dated point-in-time health checks**, not guarantees of persistent upstream access. ESPN website feeds are unofficial; provider terms and redistribution permissions remain to be reviewed before commercial operation.

### Database/security

- Supabase project: `nwspnepkmeoytlkbltfe`.
- Security advisor: **0 lints reported** during this audit.
- Existing private ticket RLS and publishable frontend key preserved.
- Email auth from the free built-in SMTP sender is limited to authorized project-team addresses; outside Discord testers should continue using local tickets unless a permitted email/OAuth provider is configured. No cross-account cloud-save browser test is claimed.

## Genuine historical NFL model validation — why predictions are not yet official

The [historical NFL research workflow](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44164394097) **passed** and published a reproducible research result derived from completed nflverse games.

Study:
- 2021–2025 completed regular-season games, **1,355** games total.
- Training 2021–2023: **812** games.
- Validation 2024: **272** games.
- Holdout 2025: **271** games.
- Selected research candidate: season form + prior scoring offense/defense; **188** of 271 holdout games had complete selected features (69.4% coverage).
- On the **same 188 holdout games**: baseline Brier **0.222701**, candidate Brier **0.221679** (lower is better).
- Brier gain **0.001022**, with paired bootstrap 95% interval **[-0.000582, 0.002649]**, which includes zero.
- Calibration ECE **worsened** from **0.073619** to **0.079626** (lower is better).
- Research decision: **`do_not_promote`**, `promotionAllowed: false`.

**Conclusion:** There is insufficient evidence that the selected candidate produces better calibrated or robust predictions. The model gate is correctly blocking promotion. No real-world sportsbook profitability, validated parlay confidence, or official win-probability claims are supported.

### Advanced player/strategy factors

NFL QB-versus-blitz, coach strategies, NBA scheme/lineup effects, NHL confirmed goalie metrics and MLB pitcher-versus-hitter profiles are feature specifications, **not proven fitted coefficients**. Completed-game scorelines cannot reconstruct these detailed, verified, time-stamped pregame observations.

### Remaining evidence before calling the model calibrated

1. Historical *pregame* feature snapshots with known publish times and permitted data rights.
2. Separate multi-year train/calibrate/holdout evaluation for **each** sport and market.
3. Reliable source/version/freshness stamps, starter and injury verification, calibration plots and subgroup reliability.
4. Independent repeated holdouts with significant Brier/log-loss improvements and sufficient coverage.
5. Immutable prospective prediction tracking and market-odds snapshots for any claims about edge, props, parlay probability or return.

**Public positioning:** A working, polished, research-oriented **community beta**. Share for usability/design feedback. Do not call experimental probabilities fully calibrated or betting recommendations.
