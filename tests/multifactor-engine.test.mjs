import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {walkForward,brier,calibrationError,validateRow} from '../engine/walkforward.mjs';
const sandbox={Date,Math};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../public/multifactor-engine.js',import.meta.url),'utf8'),sandbox);
const M=sandbox.SportsMultifactor;
const game={league:'nfl',status:'scheduled',start:'2026-11-22T18:00:00Z'};
const item={homeMinusAway:.3,sampleSize:110,sourceUrl:'https://www.nfl.com/stats/ngs/trends',dataThrough:'2026-11-15T18:00:00Z',asOf:'2026-11-16T20:00:00Z'};
test('multifactor catalogue covers all four sports, including QB blitz and pitcher-hitter and coach H2H',()=>{
 for(const league of ['nfl','nba','nhl','mlb'])assert.ok(M.CATALOG[league].length>=6);
 assert.ok(M.CATALOG.nfl.some(x=>x[0]==='qb_blitz_edge'));
 assert.ok(M.CATALOG.nfl.some(x=>x[0]==='coach_h2h'));
 assert.ok(M.CATALOG.mlb.some(x=>x[0]==='pitcher_hitter'));
 assert.ok(M.CATALOG.nba.some(x=>x[0]==='scheme_edge'));
 assert.ok(M.CATALOG.nhl.some(x=>x[0]==='goalie_gsax'));
});
test('point-in-time evidence is rejected if stale/future or under-sampled',()=>{
 assert.equal(M.eligible(game,'qb_blitz_edge',item).ok,true);
 assert.equal(M.eligible(game,'qb_blitz_edge',{...item,sampleSize:8}).ok,false);
 assert.equal(M.eligible(game,'qb_blitz_edge',{...item,asOf:'2026-11-23T00:00:00Z'}).ok,false);
 assert.equal(M.eligible(game,'qb_blitz_edge',{...item,dataThrough:'2026-11-23T00:00:00Z'}).ok,false);
});
test('advanced factors cannot move public predictions without passing holdout gate',()=>{
 const base={available:true,homeProbability:.60};
 const result=M.estimate(game,base,{qb_blitz_edge:item});
 assert.equal(result.adjusted,false);assert.equal(result.probability,null);
});
test('missing registered features never silently become zero',()=>{
 const baseline={available:true,homeProbability:.54};
 const manifest={status:'validated',league:'nfl',featureContract:M.VERSION,metrics:{count:250,brier:.19,baselineBrier:.23,ece:.02},trainedThrough:'2026-10-01T00:00:00Z',weights:{qb_blitz_edge:.3,coverage_edge:.1},version:'test-only'};
 const x=M.estimate(game,baseline,{qb_blitz_edge:item},manifest);assert.equal(x.adjusted,false);
 const y=M.estimate(game,baseline,{qb_blitz_edge:item,coverage_edge:item},manifest);assert.equal(y.adjusted,true);assert.ok(y.probability>baseline.homeProbability);
});
test('historical runner rejects future feature data and synthetic fixtures',()=>{
 const row={league:'nfl',sourceTier:'official',sourceUrl:'https://example.org/game',gameId:'x',gameAt:game.start,snapshotAt:'2026-11-20T18:00:00Z',resultKnownAt:'2026-11-23T18:00:00Z',homeWin:true,baseProbability:.55,features:{qb_blitz_edge:item}};
 assert.equal(validateRow(row,'nfl').valid,true);
 assert.equal(validateRow({...row,simulated:true},'nfl').valid,false);
 assert.equal(validateRow({...row,snapshotAt:'2026-11-23T00:00:00Z'},'nfl').valid,false);
 assert.equal(validateRow({...row,features:{qb_blitz_edge:{...item,dataThrough:'2026-12-01T00:00:00Z'}}},'nfl').valid,false);
});
test('walk-forward refuses to advertise validation from insufficient real history',()=>{
 const x=walkForward([], 'mlb', ['pitcher_hitter']);assert.equal(x.status,'insufficient_historical_data');
 assert.ok(Math.abs(brier([{p:.8,y:1},{p:.2,y:0}])-.04)<1e-10);
 assert.ok(calibrationError([{p:.6,y:1},{p:.6,y:0}])>=0);
});
