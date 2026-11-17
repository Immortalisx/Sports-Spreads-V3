# Independent live-record calibration — November 17, 2026

This study reconstructs previous-day W–L records from actual completed-game results. It fits league-specific intercept and slope on earlier seasons, selects record shrinkage using a later validation season, fits a Platt-style calibration on that validation season, and scores an untouched holdout season. Every fixture on the same date is forecast before any result from that date updates records.

**Scope:** records + home advantage only. It does not validate coaching, quarterback defensive pressure, injuries, player props, goalie starts, pitcher-hitter interactions, same-game parlays, or comparison against historical sportsbook prices.

| League | Training seasons | Calibration / validation | Untouched holdout | Holdout N | Candidate Brier | Home-rate Brier | Brier gain 95% paired CI | Holdout ECE | Decision |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| NBA | 2022-23/2023-24 | 2024-25 | 2025-26 | 1,225 | 0.209596 | 0.247106 | +0.037510 [0.028621,0.046447] | 0.02520 | Record-only approved |
| MLB | 2022/2023 | 2024 | 2025 | 2,430 | 0.245446 | 0.248421 | +0.002975 [0.000464,0.005305] | 0.02327 | Record-only approved |
| NFL | 2020–2023 | 2024 | 2025 | 271 | 0.224296 | 0.248532 | +0.024235 [0.006974,0.039523] | 0.06403 | Not approved: >0.06 calibration threshold |
| NHL | 2023-24 | 2024-25 | 2025-26 | 1,312 | 0.248714 | 0.249865 | +0.001151 [-0.002390,0.004390] | 0.04078 | Not approved: no significant >0.002 gain |

The predeclared gate requires ECE <= 0.06, abs bias <= 0.045, minimum sport holdout, candidate Brier gain >= 0.002, strictly positive bootstrap lower CI, and improved log loss. NBA/MLB meet all these criteria **versus the constant historical home-win baseline only**. This is **not** evidence that they beat a good market consensus or an established competitor.

Approved runtime coefficients (not secrets) are embedded in `public/prediction-model.js` and may only be used by NBA and MLB for the live **team-record-only** estimate:
- NBA prior=20, intercept=0.2787507901099391, slope=1.1682948273637834, calibration intercept=-0.10803372226630314, calibration slope=1.1376763909614487.
- MLB prior=32, intercept=0.10807274819406, slope=0.8220924935092405, calibration intercept=-0.005230791554107961, calibration slope=0.8776684524659046.
- NFL/NHL are *not* promoted; any nonmarket estimates must remain clearly labeled as uncalibrated.

Historical source and artifact evidence: [four-sport record calibration job](https://github.com/Immortalisx/Sports-Spreads-V3/actions/runs/44187412724), with all four study reports archived as GitHub Actions artifacts. See `engine/calibrate-record-model.mjs` and `engine/run-record-calibration.mjs` for independent reproducibility.

## Meaning of ticket grades

A daily automatic ticket uses a single bookmaker's cached moneylines. Its `Market Grade` is a **risk label from the product of market-implied per-leg probabilities**, under an assumption that games are independent. It is NOT a model-calibrated parlay win probability; bookmaker availability and payout restrictions must be verified. The daily publisher excludes unrecognized/offshore bookmaker keys by default. High multiplier means increased risk, not guaranteed ROI.

**No experimental claims magically become proven simply by changing their name.** A calibrated record-only NBA/MLB estimate can be labeled as such; advanced factors remain unverified and cannot influence approved probabilities.
