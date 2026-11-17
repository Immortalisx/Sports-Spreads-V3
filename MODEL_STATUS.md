# Sports Spreads — Experimental matchup model v0.1

## Connected in community beta
- Current team season W–L records from the site's unofficial ESPN feed.
- League-specific Bayesian shrinkage, with a disclosed assumed home advantage.
- Tentative pregame win estimates and broad illustrative sensitivity ranges.
- Open-Meteo weather affects the uncertainty range for outdoor NFL and MLB games when a forecast and reliable location are available.
- No paid services are used for the model: computation runs in the browser.

## Not yet connected or verified
- Original trained Elo engine and historical feature pipeline have not been recovered from the earlier ChatGPT site.
- No trained injury-importance coefficients or player projections.
- No out-of-sample calibration, Brier scores, performance backtest, or value/ROI claims.
- No sportsbook pricing feed.
- Heuristic home advantage and uncertainty values should not be interpreted as calibrated sports probabilities.

## Production model roadmap
Recover original Elo source, train and validate on chronological historical game data, add injuries/lineups/venue/weather to training, calibrate by sport, document performance and preserve immutable daily prediction history. Only then show model confidence grades, sportsbook EV and correlated parlay probabilities.

## Hosting
The public web app remains a single-file static site, now with experimental model code bundled into index.html; no backend model bill. See tests/prediction-model.test.mjs for regression checks.