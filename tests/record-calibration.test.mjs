import test from 'node:test';
import assert from 'node:assert/strict';
import {reconstructRecordSnapshots,recordFeature,scoreForecasts,calibrateRecordModel} from '../engine/calibrate-record-model.mjs';
const fake=(id,date,home,away,homeScore,awayScore,season=2024,league='nba')=>({
 gameId:id,gameDate:date,homeTeam:home,awayTeam:away,homeScore,awayScore,league,season
});
test('same-day doubleheaders never peek at earlier game on same date',()=>{
 const games=[fake('a','2024-01-01','H','A',105,99),fake('b','2024-01-01','H','A',90,100),
 fake('c','2024-01-02','H','A',108,99)];
 const r=reconstructRecordSnapshots(games,'nba');
 assert.equal(r[0].homeGames,0);assert.equal(r[1].homeGames,0);
 assert.equal(r[2].homeGames,2);assert.equal(r[2].homeWins,1);
 assert.equal(r[2].awayWins,1);
});
test('season switch resets team records without future leakage',()=>{
 const g=[fake('a','2024-11-01','H','A',3,1,2024,'nhl'),fake('b','2025-11-01','H','A',3,1,2025,'nhl')];
 const r=reconstructRecordSnapshots(g,'nhl');
 assert.equal(r[0].homeGames,0);assert.equal(r[1].homeGames,0);
});
test('record-only features shrink to 50% with no games and are directionally correct',()=>{
 const a={homeWins:0,homeGames:0,awayWins:0,awayGames:0};
 assert.equal(recordFeature(a,12),0);
 assert.ok(recordFeature({...a,homeWins:6,homeGames:7},12)>0);
});
test('Brier calibration scoring penalizes confident mistakes and report refuses insufficient seasons',()=>{
 const worse=scoreForecasts([{p:.95,y:0},{p:.95,y:1}]);
 const better=scoreForecasts([{p:.5,y:0},{p:.5,y:1}]);
 assert.ok(worse.brier>better.brier);
 const r=calibrateRecordModel([fake('a','2024-01-01','X','Y',10,0)],'nba');
 assert.equal(r.approved,false);assert.equal(r.status,'insufficient_seasons');
});
test('rejects unsupported sports and duplicate game IDs',()=>{
 assert.throws(()=>reconstructRecordSnapshots([],'cricket'),/Invalid/);
 assert.throws(()=>reconstructRecordSnapshots([
 fake('dup','2024-01-01','H','A',1,0),fake('dup','2024-01-02','H','A',1,0)
 ],'nba'),/Duplicate/);
});
