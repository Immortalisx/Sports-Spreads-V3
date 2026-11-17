# Sports Spreads — NFL/NHL advanced matchup factor path (2026-11-17)

## Direct answer: what currently feeds the predictions?

**The live NFL/NHL win percentages do not yet include QB-vs-blitz, WR-vs-coverage,
confirmed injury replacement effects or NHL goalie GSAx.** Coaching history, prior
scoring, strength and rest have been trained in chronological research runs, but
the NFL and NHL 2025 holdouts did not meet strict upgrade requirements. Adding
hand-chosen weights would make a worse product, not a calibrated model.

**New data work in this branch:** `engine/nfl-verified-blitz-pipeline.mjs` joins
FTN's **real** `n_blitzers` to the NFLverse play-by-play records by
`(game_id,play_id)`, yielding recorded QB and receiver-target EPA versus blitz
and an actual opposing defense's prior blitz frequency. All rates are calculated
from **strictly earlier dates with a conservative three-day charting publication lag**, with sample thresholds and missing-data
rejections. `engine/pregame-matchup-context.mjs` adds dated coach H2H summaries
and NHL named-goalie GSAx from previously completed appearances ONLY when a
properly sourced confirmation is provided. Neither file fabricates missing data
or touches the public prediction coefficients.

## Real sources and status

| Requested input | Candidate data | Supported today | Critical caveat |
|---|---|---|---|
| QB vs blitz | FTN charting via NFLverse + nflverse PBP (EPA) | Play-level source/parse and research join **implemented** | Needs actual import coverage study and independent holdout |
| Receiver targets vs blitz | Same player ID + charted plays | Source/parse and research join **implemented** | Targets, not route participation; sample sizes need suppression |
| QB / receiver vs man/zone | Licensed film / tracking or separately verified coverage labels | **Not provided by FTN's 29-column public charting feed** | No fabricated coverage assignment |
| Defensive blitz usage | Opponent FTN n_blitzers / passing charted snaps | Prior-game rate **implemented** | Not identical to pressure or coverage |
| Head-coach H2H | Historical NFL game and dated coach roster | Descriptive and shrinkage implemented | Not causal; needs team, staff and player controls |
| Injuries | Timestamped official NFL report, depth chart, snap share | Date/identity eligibility gate implemented | Missing listing != healthy; questionable != out |
| NHL goalie xG/GSAx | MoneyPuck official download CSV (or separately licensed equivalent) | Name/confirmation/sample gate implemented | MoneyPuck terms are free for **non-commercial** use only; clear rights before monetizing |
| NHL starting goalie | Team or league verified named confirmation, captured before game | Strict confirmation guard implemented | Projected != confirmed; no historical archive claimed |
| NHL line/pairing and 5v5 xG | Verified shot and shift data | Research source needed | Needs full shift history and lineup point-in-time snapshots |

Sources: https://nflreadr.nflverse.com/reference/load_ftn_charting.html ;
https://nflreadr.nflverse.com/articles/dictionary_ftn_charting.html ;
https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html ;
https://moneypuck.com/data.htm .

**Licensing:** FTN charting via NFLverse is CC BY-SA 4.0 (including applicable
attribution and share-alike for derivatives). NFLverse's other data is typically
CC BY 4.0, with provider-specific exceptions. MoneyPuck is free for
noncommercial use and requires attribution; check commercial license if
Sports Spreads eventually becomes paid. No raw FTN/MoneyPuck feed is hosted
in the site; the proof-of-source job publishes aggregated coverage only.


## Measured four-season NFL source coverage (GitHub Actions audit, 2026-11-17)

The public release CSVs were downloaded, validated for required headers, and joined
by exact game/play identifiers. Results contain **real, source-joined plays**, not
synthetic matchup statistics:

| NFL season | FTN charted plays | Matched dropbacks | PBP joining coverage | Blitz frequency | QBs / targeted receivers |
|---|---:|---:|---:|---:|---:|
| 2022 | 41,643 | 20,381 | 99.62% | 24.08% | 113 / 511 |
| 2023 | 48,225 | 20,790 | 99.97% | 27.72% | 120 / 490 |
| 2024 | 48,031 | 20,080 | 99.99% | 29.00% | 113 / 497 |
| 2025 | 47,316 | 19,817 | 99.99% | 29.54% | 105 / 509 |
| **Total** | **185,215** | **81,068** | — | — | — |

Each year's audit includes both **regular season and postseason games**; any
NFL model holdout must explicitly isolate the regular season or define
the postseason separately. The audit confirms reliable identifier matching.
It **does not establish** that any QB, receiver, coordinator, or injury feature
has demonstrated incremental predictive power after controlling for opponent,
time and player changes. Charting coverage is about passing/sack observations
that survived quality filters, NOT a claim that every offensive snap is covered.

Workflow:
https://github.com/Immortalisx/Sports-Spreads-V3/actions/workflows/audit-nfl-ftn-sources.yml

## Reproducible, credit-free source inspection

`engine/audit-nfl-ftn-sources.py 2025` downloads precisely two public,
year-bounded CSV files (FTN charting and nflverse PBP), with a byte cap and
schema checks. It reports actual QB/WR join coverage, distinct player samples,
and charted blitz share. Run the GitHub Actions workflow
`audit-nfl-ftn-sources.yml` on demand or on this PR. It never uses Firecrawl,
The Odds API or public visitor API credits.

## Required steps for *real* validation

1. **Source integrity:** run the full historical 2022–2025 NFL FTN joins;
   measure source matching, names/ID coverage, dated injury and actual route/
   receiver splits. Don't replace missing coverage labels with guessing.
2. **Frozen pregame features:** store with game ID, player ID, last-game-through
   timestamp, source URL, source license, confirmation state, number of
   observed plays and validation hash. Apply injuries at the actual report timestamp.
3. **Training/validation/holdout:** use older completed seasons for training,
   then distinct model-selection and probability-calibration windows, finally
   an untouched later season (and prospective 2026 results where available).
   Baseline should include both the **approved record-only estimates** and,
   when contemporaneous prices are available legally, the **no-vig sportsbook
   consensus**. Do not confuse beating a constant home-team baseline with
   demonstrating profitable betting edge.
4. **Measure:** Brier, log loss, ECE, reliability diagrams, coverage, calibration
   by subgroup (blitz share, QB change, injury status, goalie confirmation).
   Evaluate optional player factors through a clear ablation study;
   publish confidence only for actually tested buckets and do not tune to
   the holdout.
5. **Deploy only with matching pregame feeds:** if source unavailable, suppress
   advanced confidence rather than silently using stale data, 0 injury
   effects, phantom starters or unsupported man/zone classifications.
6. **Daily refresh:** preprocess historical/finalized data server-side and
   update one cached feature snapshot per slate, not one paid request per
   visitor. The Odds API's free tier is **not** a free historical odds feed.
   Historical research plus prospective snapshot collection must respect
   source terms and quotas.

Existing NFL/NHL multi-year 2025 holdouts:
- NFL enhanced Brier 0.222238 versus record 0.224296, ECE 6.71%;
  paired gain CI includes zero. **Not approved.**
- NHL enhanced Brier 0.248266 versus record 0.248738, ECE 3.89%;
  paired gain CI includes zero. **Not approved.**

This branch **does not** change production model coefficients or present
market ticket labels as independent statistical parlay confidence.
