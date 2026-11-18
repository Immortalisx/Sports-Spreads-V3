# Sports Spreads UX review and staged redesign — November 18, 2026

> **Draft PR #50, UI-only; no production deployment, merge, model reweighting, new paid API, or Render change.** Based on direct review of current `main` sources and newly committed branch changes. This is a source-informed UX audit and automated-browser check, **not** a real-user usability study or a physical-device performance benchmark.

## Audit and priorities

| Priority | Problem observed in the prior source | Implemented in the UX branch | Acceptance check |
|---|---|---|---|
| P0 | Automatic ticket view rendered **Daily Suggestions + every-game research + Quick Pick + manual Add Selection form + My Ticket**, all at once. Too much competing information for a first-time visitor. | **Suggested tickets** and **Build my own** are separate modes. Automatic shows prominent verified daily slate, optional market-target Quick Pick, collapsed game-by-game research, and ticket review; manual shows odds/selection form and ticket review, without repeated auto widgets. | Automatic DOM has **no** `#leg-form` / selection combobox; manual DOM has them and no `#auto-confidence`. Browser tests switch both modes. |
| P0 | The Big One hero treatment previously applied to the empty state but not all valid populated cards. | Reuse `big-one-hero` class consistently for available, unavailable and expired Big One states. Preserve freshness, bookmaker and leg validation. | Valid fixture Big One has hero treatment and remains loadable only with fresh same-book legs. |
| P0 | Mobile navbar was a thin header row of icon-only buttons without labels; ticket dock could overlap content. | Existing four actions (**Games, Teams, Builder, Saved**) become a fixed, labeled, safe-area-aware bottom nav at viewport widths ≤830px. Ticket dock moves above bar; main content gains bottom space. | Chromium 390px phone + 768px tablet: computed position fixed; four visible labels; ≥44px targets; zero horizontal overflow. |
| P1 | Game cards repeated generic phrases, had a subtle call to action and provider-centric status text. | Keep logos and existing initials fallback, explicit Eastern start (`EST` / `EDT`), scores and concise **UPCOMING / LIVE / FINAL** status; one prominent **View matchup** button. Team names remain secondary, accessible report links. | Scheduled/live/final VM render tests, one primary `data-action="game"`, two correctly labeled team-report actions; browser matchup drawer opens. |
| P1 | Users can confuse market implied targets with calibrated model confidence. | Label Quick Pick slider **Bookmaker-implied chance · not a win prediction**. Keep daily cards market-grade disclosure, **no** fabricated confidence or positive edge claims. | Existing sportsbook safety tests remain; new UX checks require explicit market wording. |
| P1 | Mobile top header competed with controls and could wrap awkwardly. | Hide Share and Big Screen *shortcuts* only on narrow phone topbar (≤620px); retain accessible About/sources and TV-mode route. Keep desktop controls. | Mobile smoke verifies navigation; 1920px TV and 3840px 4K scoreboard remain intact. |
| P2 | UX regression risk from visually large, long-lived one-file app: generated root and generated app may drift. | Keep `src/app` as source of truth; regenerate `public/app.js` and standalone root `index.html` exactly as build scripts. Preserve transfer budgets. | Build-integrity, startup, root parity and size tests; CI and browser smoke on PR before merge. |

## Workflow after UX change

1. **Games:** Choose league/date, scan matchup cards with team logos, status, East Coast start time or live/final score. Select **View matchup** for research; team names open dedicated team reports.
2. **Builder → Suggested tickets:** `The Big One` appears as a featured card only when data is verified. A separate optional Quick Pick uses *bookmaker-implied market targets*, not NHL model calibration. Game-by-game research is collapsed by default. The user can load and review a ticket while retaining duplicate-game, correlation, expiration and same-book warnings.
3. **Builder → Build my own:** User chooses league, market, athlete/team, line and sportsbook odds; player-yard/TD sliders remain in place. Ticket review remains visible. Direct team/player Quick Picks navigate straight to this mode instead of arriving in a form hidden by Suggested mode.
4. **Saved:** Local snapshots retained; no ticket is actually placed on a sportsbook.
5. **Mobile:** Bottom nav uses visible icon + text labels and safe-area spacing. On TVs, no bottom nav renders because Big Screen has its dedicated full-screen shell.

## Accessibility and data integrity

- Existing keyboard focus styles, dialogs and reduced-motion safeguards remain. Added button aria labels describing matchup and teams.
- Existing team-logo fallback continues: initials are available when an external logo fails.
- Explicit Eastern start time is retained by `formatTime()`, including EST/EDT seasonal distinction; no invented start times.
- No betting logic, confidence math, historical model calibration, sportsbook API endpoints, odds freshness gates, Render services, Supabase functions, or production secrets are changed.
- No extra image, font, tracking, paid provider, network polling, or JavaScript library introduced.
- Existing API mocked fixtures in browser tests keep test credit consumption zero.

## Test and preview scope

`tests/ux-redesign.test.mjs` checks mode isolation, accessible manual form, ticket review, populated game card and status, Eastern time, mobile safe areas, TV markup, generated root and conservative size limits.

`qa/browser-smoke.mjs` tests the actual built site in **headless Chromium** at desktop **1440×900**, mobile **390×844**, tablet **768×1024**, TV **1920×1080**, plus a **3840×2160** grid probe; it exercises ticket mode switching, slider, generating and loading a mocked fresh Big One, 44px bottom-nav targets, matching drawer navigation and zero horizontal overflow. These are **emulated viewports**, not real phones/TVs or verified real-device performance numbers.

### Known remaining UX opportunities, deliberately not conflated with this batch

- Audit actual phone and tablet performance under slow network and lower-end hardware; current browser smoke is functional, not real-device telemetry.
- Gather five-user moderated walkthroughs of **Games → Matchup → Builder → Save**, recording first-click success, time to first correct action, mistaken model-confidence interpretations and abandonment points. The current audit does not invent these metrics.
- Consider a dedicated preferences menu and copy/leg reorder interaction in a later batch, subject to real user testing.
- Consider polishing imagery or provider logo mapping independently; no unsourced team logo substitutions should be shown.
- Consider conditional visibility for unavailable player props with explanatory messaging rather than promising unsupported ticket generation. Keep all eligibility and pricing safety gates intact.

**Rollout gate:** keep [PR #50](https://github.com/Immortalisx/Sports-Spreads-V3/pull/50) draft and production unchanged until all automated tests, browser smoke, performance checks and a deliberate deployment review pass. Research [PR #49](https://github.com/Immortalisx/Sports-Spreads-V3/pull/49) remains untouched and separate.
