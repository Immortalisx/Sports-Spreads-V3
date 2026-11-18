# Premium UX refinement — visual-only release gate

Draft PR #51. Production and the NHL research PR #49 remain untouched.

## Design changes
- **Premium styling:** refined dark surface gradients, quieter borders, clearer typography, restrained hover elevation, and improved contrast without downloading images, icon packs, animation libraries or additional fonts.
- **Matchup cards:** consistent away/home rows, compact team records, Eastern start times, one primary matchup action, and a single visual language for UPCOMING / LIVE / FINAL / PREVIEW. Status dots supplement visible text rather than replacing it with color alone.
- **Team logos:** same existing provider logo → ESPN logo → visible team initials fallback, now with uniform 51px desktop / 45px mobile logo frames, consistent padding, image containment and hidden-image rules. No new network calls or invented team identifiers.
- **Motion:** 150–180ms hover/press transitions on desktop, no hover elevation on touch screens, and no animation/transition under `prefers-reduced-motion: reduce`.
- **TV:** scoreboard keeps its dedicated existing full-screen layout; CSS refinements target `.game-card-v3` while TV keeps its own responsive grid and large logo styles.

## Verification
- `tests/premium-visual-ux.test.mjs`: game state semantics, two team logos, primary CTA, Eastern time, safe logo fallback, CSS-only implementation, reduced-motion and byte budgets.
- `qa/browser-smoke.mjs`: 1440×900 desktop visual/card status/hover, 390×844 phone, 768×1024 tablet, 1920×1080 TV, 3840×2160 TV, plus a reduced-motion desktop run. Fixtures and external provider calls are mocked; no paid data usage.
- Existing regression suite and generated standalone root remain mandatory.
- Keep PR draft until all CI jobs pass. No merge or Render deploy without a separate release gate.

## Performance and data integrity
- No new JavaScript dependency, image asset, API endpoint, model change, scheduled task, paid provider, or Render configuration.
- All new appearance and motion work is CSS only. Existing `public/app.js` and standalone `index.html` are regenerated from `src/app` and `public/style.css`.
- Real-device speed and production CDN measurements are not established by emulated Chromium browser tests.
