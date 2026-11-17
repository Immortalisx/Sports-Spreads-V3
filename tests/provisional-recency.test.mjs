import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const modelSrc=readFileSync(new URL('../public/prediction-model.js',import.meta.url),'utf8');
const appSrc=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const now=Date.now(),start=new Date(now+72*60*60*1000).toISOString();
const etDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
 year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
function game(league='nfl'){
 return {id:'fixture-42',league,status:'scheduled',demo:false,start,
  home:{id:'901',name:'Home',abbr:'HOM',record:league==='nhl'?'9-4-1':'8-4'},
  away:{id:'902',name:'Away',abbr:'AWY',record:league==='nhl'?'7-6-1':'5-7'},
  venueIndoor:true};
}
function snapshot(league='nfl'){
 return {league,gameId:'fixture-42',date:etDate,homeTeamId:'901',awayTeamId:'902',
  appliedToForecast:false,calibrated:false,
  home:{played:9,last5:{games:5}},away:{played:9,last5:{games:5}},
  evidence:{sourceStatus:'adequate_research_samples',
   dateCutoff:'strictly before game calendar date',latestCompletedGame:'2026-11-15'},
  matchup:{opponentAdjustedFormDelta:2,eloDifference:200,rollingMomentumDelta:0.7,restDaysDifference:3}};
}
function context(){
 const c={window:{__STANDALONE_PREVIEW__:true},document:{readyState:'loading',body:{style:{}},
  addEventListener:()=>{},getElementById:()=>null},localStorage:{getItem:()=>null},
  URL,Intl,Date,Math,Number,JSON,Array,Object,Map,Set,console};
 vm.createContext(c);
 vm.runInContext(modelSrc,c);
 vm.runInContext(appSrc+'\nthis.exposed={previewModel,modelPanel,eligibleRecentSnapshot,marketCardLabel,state};',c);
 return c;
}
test('NFL live view uses only exact, fresh, opponent-matched snapshot and shows asterisk',()=>{
 const c=context(),g=game('nfl'),s=snapshot('nfl');
 const original=c.SportsPrediction.project(g);
 c.exposed.state.forms.nfl={league:'nfl',status:'cached',generatedAt:new Date(now-60000).toISOString(),snapshots:[s]};
 const adjusted=c.exposed.previewModel(g);
 assert.equal(adjusted.recencyUsed,true);
 assert.equal(adjusted.preliminary,true);
 assert.equal(adjusted.validated,false);
 assert.ok(adjusted.homeProbability>original.homeProbability);
 assert.ok(adjusted.homeProbability-original.homeProbability<=.0500001);
 assert.match(c.exposed.modelPanel(g),/Preliminary estimate, NOT validated betting confidence/);
 assert.match(c.exposed.modelPanel(g),/win estimate<\/small><strong>\d+%\*/);
});
test('NHL provisional recency must move estimate by at most 2 points, never claim validation',()=>{
 const c=context(),g=game('nhl'),s=snapshot('nhl');
 const original=c.SportsPrediction.project(g);
 c.exposed.state.forms.nhl={league:'nhl',status:'cached',generatedAt:new Date(now-60000).toISOString(),snapshots:[s]};
 const adjusted=c.exposed.previewModel(g);
 assert.equal(adjusted.recencyUsed,true);
 assert.ok(adjusted.homeProbability-original.homeProbability<=.0200001);
 assert.ok(adjusted.homeProbability-original.homeProbability>=0);
 assert.equal(adjusted.validated,false);
 assert.match(c.exposed.modelPanel(g),/Not calibrated\*/);
});
test('rejects stale, cross-team, date-mismatched and future-looking form caches',()=>{
 const c=context(),g=game('nfl'),snap=snapshot('nfl');
 for(const [generatedAt,data] of [
  [new Date(now-49*3600000).toISOString(),snap],
  [new Date(now-60000).toISOString(),{...snap,homeTeamId:'random'}],
  [new Date(now-60000).toISOString(),{...snap,date:'2026-11-01'}],
  [new Date(now-60000).toISOString(),{...snap,evidence:{...snap.evidence,latestCompletedGame:etDate}}],
  [new Date(now-60000).toISOString(),{...snap,home:{...snap.home,played:2}}]
 ]){
  c.exposed.state.forms.nfl={league:'nfl',status:'cached',generatedAt,snapshots:[data]};
  const m=c.exposed.previewModel(g);
  assert.equal(m.recencyUsed,false);
  assert.equal(m.validated,false);
 }
});
test('NBA/MLB holdout-calibrated records remain untouched by NFL/NHL recency',()=>{
 const c=context(),g=game('nba');
 c.exposed.state.forms.nba={league:'nba',status:'cached',
  generatedAt:new Date(now-60000).toISOString(),snapshots:[snapshot('nba')]};
 const m=c.exposed.previewModel(g);
 assert.equal(m.validated,true);assert.equal(m.recencyUsed,false);
 assert.equal(m.preliminary,false);
 assert.doesNotMatch(c.exposed.modelPanel(g),/Preliminary estimate/);
});
test('betting-related daily cards visibly mark unvalidated joint chances but retain exact odds',()=>{
 const s=readFileSync(new URL('../src/app/20-views.js',import.meta.url),'utf8');
 assert.match(s,/\+'%\*<\/strong><small>Independence illustration/);
 assert.match(s,/not validated wagering confidence/);
 assert.match(s,/Bookmaker-implied /);
});
