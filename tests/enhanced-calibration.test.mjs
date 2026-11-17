import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEnhancedGames} from '../engine/calibrate-elo-model.mjs';
import {buildPregameRows} from '../engine/retrospective-model.mjs';
function synthetic(league){
 const seasons=league==='nfl'?[2020,2021,2022,2023,2024,2025]:[2021,2022,2023,2024,2025];
 const rows=[];
 for(const season of seasons)for(let week=1;week<=28;week++)for(let j=0;j<12;j++){
  const date=new Date(Date.UTC(season,league==='nfl'?8:9,1+Math.floor((week-1)*5)));
  const winner=(j+week+season)%3!==0;
  rows.push({gameId:league+'-'+season+'-'+week+'-'+j,season,league,
   gameDate:date.toISOString().slice(0,10),homeTeam:'H'+j,awayTeam:'A'+j,
   homeScore:winner?3:1,awayScore:winner?1:3,homeCoach:null,awayCoach:null,
   sourceUrl:'https://example.org/synthetic',sourceTier:'test_data'});
 }
 return rows;
}
test('NFL model selects features in 2023, calibrates in 2024, untouched tests in 2025',()=>{
 const result=evaluateEnhancedGames(synthetic('nfl'),'nfl');
 assert.equal(result.counts.holdout,336);
 assert.equal(result.counts.select,336);
 assert.equal(result.counts.calibration,336);
 assert.ok(result.selection?.length>=4);
 assert.equal(result.reviewManifest?.selectedOn,2023);
 assert.equal(result.reviewManifest?.calibratedOn,2024);
 assert.equal(result.reviewManifest?.testedOn,2025);
 assert.equal(result.reviewManifest?.liveSupported,false);
 assert.ok(Number.isFinite(result.holdout.candidate.brier));
});
test('NHL retains distinct historical time splits without automatic live model promotion',()=>{
 const result=evaluateEnhancedGames(synthetic('nhl'),'nhl');
 assert.equal(result.status,'insufficient_data'); // 336 holdout is below real NHL minimum 1,000.
 assert.equal(result.approved,false);
});
test('NFL and NHL pregame histories do not include same-day scores in odds',()=>{
 const data=synthetic('nfl').slice(0,2);
 const rows=buildPregameRows(data,'nfl');
 assert.equal(rows[0].features.season_form,null);
 assert.equal(rows[1].features.season_form,null);
});
test('unsupported sports are rejected',()=>assert.throws(()=>evaluateEnhancedGames([],'nba'),/Only NFL/));
