import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const view=['18-prediction-views','20-views','21-game-detail'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const controller=['26-cached-research','30-controller'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const state=readFileSync(new URL('../src/app/10-state.js',import.meta.url),'utf8');
test('NFL availability is displayed only for matching fixture and team IDs',()=>{
 assert.match(view,/function nflAvailabilityPanel\(g\)/);
 assert.match(view,/x\.gameId===g\.id/);
 assert.match(view,/x\.homeTeamId===String\(g\.home\?\.id\)/);
 assert.match(view,/x\.awayTeamId===String\(g\.away\?\.id\)/);
 assert.match(view,/Date\.parse\(x\.asOf\|\|''\)<Date\.parse\(g\.start\|\|''\)/);
 assert.match(view,/\$\{nflAvailabilityPanel\(g\)\|\|/);
});
test('UI refuses to call projected QB confirmed or change model percentage',()=>{
 assert.match(view,/Depth-chart QB1 is projected, not a confirmed starter/);
 assert.match(view,/No injury impact or starter certainty has been included in win probabilities/);
 assert.match(view,/game\.home/);
 assert.match(state,/nflAvailability:null/);
 assert.match(controller,/async function loadNflAvailability\(force=false\)/);
 assert.match(controller,/void loadNflAvailability\(\)/);
 assert.doesNotMatch(controller,/THE_ODDS_API_KEY/);
});

test('matchup UI exposes source freshness, status indicators and cache-only retry',()=>{
 assert.match(view,/availability-badge--/);
 assert.match(view,/availability-mini-counts/);
 assert.match(view,/availability-source-ok/);
 assert.match(view,/Source check: /);
 assert.match(view,/data-action="retry-nfl-availability"/);
 assert.match(controller,/if\(action==='retry-nfl-availability'\)\{void loadNflAvailability\(true\)/);
 assert.match(view,/This does not mean the roster is healthy/);
});
