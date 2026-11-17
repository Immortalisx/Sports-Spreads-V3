import test from 'node:test';import assert from 'node:assert/strict';
import {buildPregameRows,evaluateRetrospective,brier,ece} from '../engine/retrospective-model.mjs';
const fixture=(id,day,season,home,away,hs,as)=>({gameId:id,league:'nfl',season,gameDate:day,homeTeam:home,awayTeam:away,homeScore:hs,awayScore:as,homeCoach:'Coach '+home,awayCoach:'Coach '+away,sourceTier:'community_public',sourceUrl:'https://example.org/real-results'});
test('No same-day outcome leaks into any other fixture on that day',()=>{
 const rows=buildPregameRows([fixture('g1','2022-09-01',2022,'A','B',19,3),fixture('g2','2022-09-01',2022,'A','C',33,9),fixture('g3','2022-09-02',2022,'A','D',19,12)],'nfl');
 assert.equal(rows[0].coverage.homeGames,0);assert.equal(rows[1].coverage.homeGames,0);assert.equal(rows[2].coverage.homeGames,2);assert.equal(rows[0].features.rest_days,null);assert.equal(rows[2].features.rest_days,null);
});
test('Retrospective features are unavailable until previous games support them',()=>{
 const rows=buildPregameRows([fixture('a','2022-09-01',2022,'A','B',18,8),fixture('b','2022-09-10',2022,'B','A',13,17)],'nfl');
 assert.equal(rows[0].features.offense_defense,null);assert.equal(rows[1].features.offense_defense,null);
 assert.equal(rows[1].features.qb_blitz,null);assert.equal(rows[1].features.coach_h2h,null);
 assert.equal(rows[1].features.rest_days,0);
});
test('Results are deterministic regardless of input ordering',()=>{const f=[fixture('a','2022-09-01',2022,'A','B',18,8),fixture('b','2022-09-10',2022,'B','A',13,17)];assert.deepEqual(buildPregameRows(f,'nfl'),buildPregameRows([...f].reverse(),'nfl'));});
test('Duplicate game IDs fail validation instead of inflating backtest',()=>{const f=fixture('a','2022-09-01',2022,'A','B',18,8);assert.throws(()=>buildPregameRows([f,f],'nfl'),/Duplicate/);});
test('Insufficient historical seasons refuse to publish a model',()=>{const result=evaluateRetrospective([fixture('a','2022-09-01',2022,'A','B',24,3)],'nfl');assert.equal(result.status,'insufficient_seasons');assert.equal(result.promotionAllowed,undefined);});
test('Research-only trained and calibrated holdout never allows automatic promotion',()=>{
 const data=[];for(let season=2021;season<=2024;season++){
  for(let week=1;week<=30;week++){
   const date=`${season}-${week>17?'10':'09'}-${String((week-1)%17+1).padStart(2,'0')}`;
   for(let pair=0;pair<12;pair++){
    const home=`T${(pair*2+week)%24}`,away=`T${(pair*2+week+1)%24}`;
    data.push(fixture(`${season}-${week}-${pair}`,date,season,home,away,18+(pair+week)%19,16+(pair*2)%17));
   }
  }
 }
 const x=evaluateRetrospective(data,'nfl',{minHoldout:80});
 assert.equal(x.status,'research_only');assert.equal(x.promotionAllowed,false);assert.equal(x.split.testSeason,2024);assert.ok(x.holdout?.candidate.n>0);assert.ok(Number.isFinite(x.holdout?.candidate.brier));assert.ok(x.candidates?.length>=1);assert.equal(x.advancedAvailability.qb_blitz,0);
});
test('Probability metrics are bounded and penalize bad confidence',()=>{assert.equal(brier([{p:.8,y:1},{p:.2,y:0}]),.039999999999999994);assert.ok(ece([{p:.8,y:1},{p:.2,y:0}])>=0);});
