import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../engine/nhl-goalie-form.mjs',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/nhl-goalie-form/nhl-goalie-form.mjs',import.meta.url),'utf8');
const service=readFileSync(new URL('../supabase/functions/nhl-goalie-form/index.ts',import.meta.url),'utf8');
const schema=readFileSync(new URL('../supabase/migrations/007_nhl_goalie_form_cache.sql',import.meta.url),'utf8');
const view=['18-prediction-views','20-views','21-game-detail'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const ctrl=readFileSync(new URL('../src/app/30-controller.js',import.meta.url),'utf8');
const state=readFileSync(new URL('../src/app/10-state.js',import.meta.url),'utf8');
test('live edge pipeline bundles identical tested goalie form; no different math in production',()=>{
 assert.equal(root,edge);
});
test('all public visits read the shared cache only, private refresh uses existing owner token',()=>{
 const start=service.indexOf("if(req.method==='GET'){"),
 end=service.indexOf("if(!(await authorized(req)))");
 assert.ok(start>0&&end>start);
 const get=service.slice(start,end);
 assert.match(get,/sports_nhl_goalie_latest/);
 assert.doesNotMatch(get,/nhl\(|refresh\(|api-web\.nhle\.com|THE_ODDS_API_KEY/);
 assert.match(service,/verify_sports_odds_refresh_token/);
 assert.match(service,/noPaidApiRequests:true/);
 assert.match(schema,/enable row level security/);
 assert.match(schema,/revoke all on public\.sports_nhl_goalie_latest from anon,authenticated/);
});
test('latest game log has no predicted/confirmed starter or unsourced xGoals',()=>{
 assert.match(root,/confirmedStarter:false/);
 assert.match(root,/xGoalsSavedAboveExpected:null/);
 assert.match(root,/appliedToForecast:false/);
 assert.match(root,/gameDate>=gameDate/);
 assert.match(root,/gamesStarted!==true/);
});
test('only matched upcoming NHL games show published recent goalie research',()=>{
 assert.match(view,/function nhlGoaliePanel\(g\)/);
 assert.match(view,/x\.homeAbbrev===home/);
 assert.match(view,/x\.awayAbbrev===away/);
 assert.match(view,/Math\.abs\(Date\.parse\(x\.start/);
 assert.match(view,/Starter unconfirmed/);
 assert.match(view,/upcoming starting goalies are NOT confirmed/);
 assert.match(view,/\$\{nhlGoaliePanel\(g\)\}/);
 assert.match(ctrl,/loadNhlGoalies\(force=false\)/);
 assert.match(ctrl,/if\(league==='nhl'&&first\)void loadNhlGoalies\(\)/);
 assert.match(ctrl,/retry-nhl-goalies/);
 assert.match(state,/nhlGoalies:null/);
});
