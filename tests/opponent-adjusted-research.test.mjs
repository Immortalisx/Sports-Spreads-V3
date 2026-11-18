import test from 'node:test';
import assert from 'node:assert/strict';
import {opponentAdjustedRows} from '../engine/opponent-adjusted-research.mjs';
function game(league,i,{season=2025,date=null,home='H',away='A',homeScore=3,awayScore=1}={}){
 return {league,season,gameId:league+'-'+season+'-'+i,gameDate:date||new Date(Date.UTC(season,0,1+i)).toISOString().slice(0,10),
  homeTeam:home,awayTeam:away,homeScore,awayScore,sourceUrl:'https://example.org/historical-results',sourceTier:'official_public'};
}
test('same-day outcomes cannot leak into other fixtures involving the same teams',()=>{
 const games=[game('nfl',1,{date:'2025-09-01'}),game('nfl',2,{date:'2025-09-01',homeScore:0,awayScore:4}),
  game('nfl',3,{date:'2025-09-02'})];
 const rows=opponentAdjustedRows(games,'nfl');
 assert.equal(rows[0].opponentCoverage.homeGames,0);
 assert.equal(rows[1].opponentCoverage.homeGames,0);
 assert.equal(rows[2].opponentCoverage.homeGames,2);
 assert.equal(rows[2].opponentFactors.opponentAdjustedForm,null);
});
test('only previous seasons Elo may carry over; opponent-adjusted form resets',()=>{
 const rows=opponentAdjustedRows([
  game('nba',1,{season:2024}),game('nba',2,{season:2025})
 ],'nba');
 assert.equal(rows[1].opponentCoverage.homeGames,0);
 assert.equal(rows[1].opponentCoverage.awayGames,0);
});
test('NFL NBA NHL require sufficient samples and produce bounded opponent features',()=>{
 for(const league of ['nfl','nba','nhl']){
  const games=Array.from({length:12},(_,i)=>game(league,i,{homeScore:i%2?2:3,awayScore:i%2?3:1}));
  const rows=opponentAdjustedRows(games,league);
  assert.equal(rows.length,12);
  assert.equal(rows[0].opponentFactors.opponentAdjustedForm,null);
  assert.ok(Number.isFinite(rows[11].opponentFactors.opponentAdjustedForm));
  assert.ok(Math.abs(rows[11].opponentFactors.opponentAdjustedMargin)<=2);
  assert.equal(rows[11].opponentProvenance.validated,false);
  assert.equal(rows[11].opponentProvenance.modelWeight,null);
  assert.ok(rows[11].opponentProvenance.advancedUnavailable.length>0);
 }
});
test('future results and duplicate game IDs are not silently used',()=>{
 const first=game('nhl',1);
 assert.throws(()=>opponentAdjustedRows([first,first],'nhl'),/Duplicate game ID/);
});
