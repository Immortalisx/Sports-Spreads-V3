# Independent NHL calibration review — 2026-11-18

**Scope:** Draft PR #49, research-only. Audit `engine/nhl-elo-calibration-research.mjs`, `engine/retrospective-model.mjs`, official NHL fixtures for 2022–23 through 2025–26, and the existing `docs/NHL_ELO_CALIBRATION_2026_11_18.md`. No weight changes, hyperparameter selection, production or Render deployment, network polling or paid APIs.

## Review verdict

**PASS on arithmetical reproduction and the enforced historical date split; NOT VALIDATED FOR PRODUCTION OR BETTING.**

An independent read-only reimplementation in `engine/audit-nhl-calibration-independent.mjs` uses **no imports from the fitted Elo or calibration engine**. It reconstructs all 5,248 chronological results directly from two committed official-NHL-result fixtures, implements the same fixed predeclared Elo and Platt equations independently, and compares the two periods' scores and full reliability bins. A separate test `tests/nhl-calibration-independent-audit.test.mjs` compares its outputs to the main research engine; the test is CI-only, not website code.

**The four chronological windows remain disjoint by labels:**
- 2022–23: 1,312 Elo prior-history games.
- 2023–24: 1,312 games to fit fixed frozen Platt coefficients (intercept +0.01919616563175669, slope 0.911468592402615).
- 2024–25: 1,312 **chronologically held-out from coefficient fitting** validation games.
- 2025–26: 1,312 **already inspected** research games; *not* an independent or pristine test after this project already examined that season.

Time separation is real, but the model and its settings were devised retrospectively. The review cannot certify that 2024–25 was *prospectively preregistered* or never looked at by an analyst. Reserve genuinely timestamped, frozen future 2026–27 predictions for that claim.

## Exact independently reproduced metrics

| Period / statistic | Uncalibrated Elo | Frozen Platt-calibrated Elo | Difference |
|---|---:|---:|---:|
| **2024–25** correct winners | 759 / 1,312 | 768 / 1,312 | **+9** |
| 2024–25 Brier | 0.239366776 | 0.238853874 | **+0.000512902 Brier improvement** |
| 2024–25 log loss | 0.671426582 | 0.670322002 | improved |
| 2024–25 ECE (10 equal-width bins) | 3.3811% | 3.1413% | improved |
| **2025–26** correct winners | 704 / 1,312 | 700 / 1,312 | **−4** |
| 2025–26 Brier | 0.249072652 | 0.248519544 | **+0.000553108 Brier improvement** |
| 2025–26 log loss | 0.691597208 | 0.690380478 | improved |
| 2025–26 ECE (10 equal-width bins) | 4.3937% | 4.3243% | improved |

**Identical-history comparison:** Both Brier columns for a given season use the same daily Elo history; the ONLY comparison change is the frozen probability transform. Earlier standalone 2025–26 raw Elo 0.248930334 used a shorter historical training window, so using that as the matched calibration baseline would be misleading.

**Strength of claim:** The 2025–26 Brier gain (+0.0005531) is approximately a **0.22% relative reduction** in raw Brier, with a slightly **lower** winner accuracy. Relative to always forecasting 50% (Brier 0.25), the calibrated 2025–26 Brier beats the trivial benchmark by only **0.001480456**, or **0.59%**. There are no verified pregame odds, so neither score demonstrates profitable bets.

The pre-existing report cites a nominal 95% paired, game-date-cluster bootstrap Brier-gain interval of [+0.00010289,+0.00096791] for 2025–26. **It must not be treated as confirmatory evidence**: the season was already examined in prior iterations, there is temporal dependence across dates, and all choices were not demonstrably preregistered before this dataset was reviewed.

## Independent 2024–25 reliability bins

These are **home-team** win probabilities after Platt adjustment, not percentages of correctly chosen favorites. Empty bins convey no calibration evidence.

| Calibrated probability range | N | Mean predicted | Actual home wins | Absolute gap |
|---|---:|---:|---:|---:|
| 20–30% | 18 | 26.87% | 16.67% | 10.20 pp |
| 30–40% | 127 | 36.57% | 46.46% | 9.89 pp |
| 40–50% | 317 | 45.57% | 48.58% | 3.01 pp |
| 50–60% | 467 | 54.86% | 56.10% | 1.24 pp |
| 60–70% | 300 | 64.61% | 67.33% | 2.72 pp |
| 70–80% | 80 | 73.53% | 70.00% | 3.53 pp |
| 80–90% | 3 | 82.65% | 66.67% | 15.99 pp |

The 30–40% bin, with 127 games, is a meaningful warning against describing ECE=3.14% as “fully calibrated.” The extreme buckets have too few observations to claim precision.

## Independent 2025–26 reliability bins — already inspected

| Calibrated probability range | N | Mean predicted | Actual home wins | Absolute gap |
|---|---:|---:|---:|---:|
| 20–30% | 6 | 28.28% | 16.67% | 11.61 pp |
| 30–40% | 62 | 36.51% | 35.48% | 1.02 pp |
| 40–50% | 337 | 45.99% | 51.04% | 5.05 pp |
| 50–60% | 590 | 54.77% | 51.53% | 3.25 pp |
| 60–70% | 280 | 63.74% | 58.57% | 5.17 pp |
| 70–80% | 36 | 72.05% | **61.11% (22/36)** | **10.94 pp** |
| 80–90% | 1 | 81.81% | 0% | uninformative |

For the 70–80% 2025–26 bucket, a simple binomial Wilson 95% interval for actual home-win frequency is approximately **44.86%–75.22%**. It INCLUDES the mean 72.05% forecast: evidence of instability, **not** proof of statistical miscalibration. The 80–90% bin contains only **one** game. Re-bin or attach visible uncertainty in analysis; NEVER use that one outcome to change model coefficients.

Across years, calibrated mean home forecast was **53.89%** versus **56.25%** observed in 2024–25, and **53.94%** versus **52.21%** observed in 2025–26. That changing base rate helps explain why the intercept does not generalize perfectly.

## Code-level issues and research priority

| Priority | Evidence / issue | Safe next research step, **without changing current fitted model** |
|---|---|---|
| **P0** | No archived point-in-time 2026–27 pregame predictions. 2025–26 evaluated repeatedly. | Freeze current research algorithm, params, source version and date selection; write immutable, timestamped forecasts **before** game start; settle separately after final; keep future results inaccessible to training during evaluation. |
| **P0** | Tiny improvement relative to 50% probability benchmark; no betting odds; accuracy decreases by 4 on 2025–26. | Keep `promotionAllowed:false`; require independent future Brier/log-loss/calibration and paired comparisons with naive baselines before any confidence grade or automated ticket recommendation. |
| **P1** | 2025–26 70–80% home bin contains only 36 games; 80–90% bin only 1; ECE can mask local gaps. | Publish sample sizes, Wilson intervals and wider equal-count/adaptive *reporting-only* reliability groups. Do not tune current predictions from these bins. Separately report favorite-confidence calibration as well as home-win calibration. |
| **P1** | Franchise tricode continuity: 2022–24 data includes **ARI**, 2024–26 includes **UTA**. Current Elo keys are tricodes so Utah starts at neutral rather than carrying Arizona's Elo. | Research an official, effective-dated franchise-ID canonical map and test against earlier history; specify mapping and evaluation before touching any future holdout. Do not silently rewrite the existing benchmark. |
| **P1** | Engine uses win/loss-only Elo; regulation, overtime and shootout outcomes are treated equivalently. No verified historical starting goalie or injuries. | Design *separate* ablation hypotheses using older training/validation and time-stamped sources; require independent coverage and opponent-strength checks. Do not retrospectively invent goalies or injuries. |
| **P1** | Current score history is date-only, with batch updates at day's end, not game-puck-drop timestamp snapshots. | Explicitly record league-local scheduled/actual start times, fetch timestamps, cache freshness and result-embargo boundaries; fail closed if source timing is missing. |
| **P2** | Official data are pinned but upstream content hashes, source fetch timestamps and team ID mapping are not independently verified on each replay. | Maintain an offline provenance manifest (official URLs, retrieval time, checksums, schema, team IDs, season counts) for future reproducibility; no network required in CI. |
| **P2** | Game-date-cluster bootstrap treats dates as resampling units but does not capture multi-day/team serial dependence, and 2025–26 was previously inspected. | Pre-register blocked-week or season-level uncertainty analysis for future untouched data; report results as descriptive, not promotion evidence. |
| **P2** | 2024–25 validation reliability has nontrivial 30–40% bucket discrepancy (127 games). | Explain calibration metrics by both home-side and predicted-favorite confidence, plus log loss, Brier, seasonal breakdown and coverage. Do not adjust bins or coefficient based on the already inspected 2025–26. |

## Reproduction / CI

```bash
node engine/audit-nhl-calibration-independent.mjs
node --test tests/nhl-calibration-independent-audit.test.mjs
node engine/nhl-elo-calibration-research.mjs
```

The independent script **does not import** the original research Elo/calibration implementation; the test verifies **exact** fitted coefficient, Brier, log loss, 10-bin ECE and correct-pick reproduction across both seasons. It validates all four 1,312-game seasons and reports observed-bin Wilson intervals and fixed-50% Brier skill. Source records are already committed; no new scraping or provider credits are needed.

**Decision:** document findings and keep PR #49 **draft, unmerged, research-only, no calibration deployment**. Next legitimate advancement is prospective 2026–27 locked pregame predictions—not recalibration from this already-examined 2025–26 dataset.
