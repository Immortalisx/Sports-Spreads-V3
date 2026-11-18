import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../supabase/functions/season-form/index.ts',import.meta.url),'utf8');
const core=readFileSync(new URL('../engine/current-season-rolling.mjs',import.meta.url),'utf8');
const deployed=readFileSync(new URL('../supabase/functions/season-form/current-season-rolling.mjs',import.meta.url),'utf8');
const view=['18-prediction-views','20-views'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const ctrl=['26-cached-research','30-controller'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const schema=readFileSync(new URL('../supabase/migrations/005_current_season_rolling_form.sql',import.meta.url),'utf8');
test('source-proven current-form computation matches the packaged Edge module',()=>{
 assert.equal(core,deployed);
});
test('website GET only reads shared cache and never spends provider credits',()=>{
 const publicHandler=src.slice(src.indexOf("if(req.method==='GET'){"),src.indexOf("if(!(await allowed(req)))"));
 assert.match(publicHandler,/sports_form_latest/);
 assert.doesNotMatch(publicHandler,/fetchMonth|update\(|api\.espn\.com|THE_ODDS_API_KEY/);
 assert.match(src,/if\(!\(await allowed\(req\)\)\)/);
 assert.match(schema,/enable row level security/g);
 assert.match(schema,/revoke all on public\.sports_form_months/);
 assert.match(schema,/revoke all on public\.sports_form_latest/);
 assert.match(src,/payload\.events\.length>=1000/);
 assert.match(src,/Number\(e\?\.season\?\.type\)!==2/);
});
test('rolling recent-form displays only when a sourced snapshot matches the event and team IDs',()=>{
 assert.match(view,/currentSeasonPanel\(g\)/);
 assert.match(view,/x\.homeTeamId===String\(g\.home\?\.id\)/);
 assert.match(view,/opponentAdjustedMargin/);
 assert.match(view,/NOT yet calibrated win probabilities/);
 assert.match(ctrl,/loadCurrentSeasonForm\(league\)/);
 assert.match(ctrl,/state\.forms\[league\]=source/);
});
