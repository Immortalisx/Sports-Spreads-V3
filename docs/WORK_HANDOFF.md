# Paste into ChatGPT Work after attaching this project ZIP

Implement Sports Spreads v2 from the attached starter, working against the existing Sports Spreads Site project **without publishing changes before reviewing the migration**.

- Inspect the current site's source, project settings, data refresh path and existing model. Build a map of features that must survive.
- Preserve the original prediction engine and historical records. Import or adapt them into the v2 architecture. Do not silently change probability formulas or model scores.
- Replace/extend the starter's demonstration ESPN provider with supported, licensed production data feeds and verified roster, injury, news, player stats and game results. Feed timestamps and failure states are mandatory.
- Keep the main interface simple: sports tabs NFL/NBA/NHL/MLB, compact games and scores, clickable teams and players, expandable injuries/rosters/news/stats and optional model methodology.
- Keep prediction scores unavailable until the preserved engine returns them. Never interpret manually entered odds as a model probability or independently validated market quote.
- Wire the existing update automation and add durable immutable prediction/outcome history. Instrument basic usage analytics only after reviewing privacy settings.
- Run unit, integration, performance and mobile tests, reconcile key predictions against v1, produce a change log and staging preview, then obtain approval before replacing the public live site.

Original public URL: https://george-football-edge.cuddlycob9.chatgpt.site/#board
Original Work Site reference from prior chat: sites-project://appgprj_6af9080c2f4481918c170cceb97a4b27
