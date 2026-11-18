import test from 'node:test';
import assert from 'node:assert/strict';
import {combineFormAndBlitz,evaluateQbBlitzIncrement} from '../engine/evaluate-qb-blitz-holdout.mjs';
const game=(id,date,season=2025)=>({
 gameId:id,gameDate:date,season,league:'nfl',homeTeam:'BUF',awayTeam:'MIA',
 homeScore:24,awayScore:17
});
const observed=(id,date,season=2025,other={})=>({
 gameId:id,gameDate:date,season,
 sourceDataThrough:'2025-09-07',available:true,
 home:{available:true,projectedQb:'q-home',blitzSample:22,noBlitzSample:44},
 away:{available:true,projectedQb:'q-away',blitzSample:15,noBlitzSample:50},
 qbMatchupEPA:.26,qbBlitzExposure:.12,...other
});
test('real QB feature rows align to exact fixture ID and calendar date',()=>{
 const games=[game('nfl-A','2025-09-12')];
 const f=observed('nfl-A','2025-09-12');
 const [r]=combineFormAndBlitz(games,[f]);
 assert.equal(r.season,2025);
 assert.equal(r.qbAvailable,true);
 assert.ok(r.x.qbEPA>0);
 assert.ok(r.x.qbExposure>0);
 assert.equal(r.qbRecord.homeProjectedQb,'q-home');
});
test('rejects quarterback charting publication after kickoff',()=>{
 const g=game('nfl-B','2025-09-12');
 assert.throws(()=>combineFormAndBlitz([g],[{...observed('nfl-B','2025-09-12'),sourceDataThrough:'2025-09-12'}]),/lookahead/);
});
test('rejects mismatched and duplicate FTN game identifiers',()=>{
 const g=game('nfl-A','2025-09-12');
 assert.throws(()=>combineFormAndBlitz([g],[observed('nfl-WRONG','2025-09-12')]),/missing/);
 assert.throws(()=>combineFormAndBlitz([g],[observed('nfl-A','2025-09-12'),observed('nfl-A','2025-09-12')]),/Duplicate/);
 assert.throws(()=>combineFormAndBlitz([g],[observed('nfl-A','2025-09-13')]),/does not match/);
});
test('missing matched QB data do not drop the game or invent probabilities',()=>{
 const g=game('nfl-A','2025-09-12');
 const f={...observed('nfl-A','2025-09-12'),available:false,qbMatchupEPA:null,qbBlitzExposure:null};
 const [r]=combineFormAndBlitz([g],[f]);
 assert.equal(r.qbAvailable,false);
 assert.equal(r.x.qbEPA,0);
 assert.equal(r.x.qbExposure,0);
});
test('one season cannot establish a model grade or a historical validation claim',()=>{
 const games=[game('nfl-A','2025-09-12')];
 const r=evaluateQbBlitzIncrement(games,[observed('nfl-A','2025-09-12')]);
 assert.equal(r.status,'insufficient_historical_data');
 assert.equal(r.approved,false);
 assert.equal(r.productionWeightsActivated,false);
});
