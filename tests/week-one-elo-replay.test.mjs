import test from 'node:test';
import assert from 'node:assert/strict';
import {runWeekOneElo} from '../engine/run-week-one-elo-replay.mjs';
test('real historical NFL Elo scores and missing NBA NHL histories fail closed',()=>{
 const r=runWeekOneElo();
 console.log('WEEK_ONE_ELO_REPLAY_REPORT '+JSON.stringify(r));
 assert.equal(r.results.length,3);
 assert.equal(r.summary.scored,2);
 assert.equal(r.results[0].status,'retrospective_scored');
 assert.ok(r.results[0].trainingGames>=500);
 assert.ok(r.results[0].homeWinProbability>0&&r.results[0].homeWinProbability<1);
 assert.equal(r.results[0].actualWinner,'SEA');
 assert.equal(r.results[0].brier,(r.results[0].homeWinProbability-1)**2);
 assert.deepEqual(r.results.slice(1).map(x=>x.status),['not_testable','retrospective_scored']);
 assert.equal(r.results[2].actualWinner,'DET');
 assert.equal(r.results[2].trainingGames,2462);
 assert.ok(r.results[2].homeWinProbability>0&&r.results[2].homeWinProbability<1);
 assert.equal(r.promotionAllowed,false);
});
test('target final score cannot influence its own prediction',()=>{
 const original=runWeekOneElo();
 const fixtures=[
 {league:'nfl',gameId:'nfl-2026-09-09-ne-sea',start:'2026-09-09T20:20:00-04:00',home:'SEA',away:'NE',homeScore:10,awayScore:13,resultSource:'https://example.org/verified-final'}
 ];
 const changed=runWeekOneElo({fixtures});
 assert.equal(original.results[0].homeWinProbability,changed.results[0].homeWinProbability);
 assert.notEqual(original.results[0].brier,changed.results[0].brier);
 const nbaFixture={league:'nba',gameId:'nba-2026-10-20-bos-det',start:'2026-10-20T15:00:00-04:00',home:'DET',away:'BOS',homeScore:113,awayScore:121,resultSource:'https://example.org/verified-final'};
 const alteredNba=runWeekOneElo({fixtures:[nbaFixture]});
 assert.equal(original.results[2].homeWinProbability,alteredNba.results[0].homeWinProbability);
 assert.notEqual(original.results[2].brier,alteredNba.results[0].brier);
});
test('no verified history means no probability',()=>{
 const r=runWeekOneElo({historicalNfl:{rows:[]},historicalNba:{rows:[]}});
 assert.equal(r.summary.scored,0);
 assert.equal(r.summary.brier,null);
 assert.equal(r.results[0].status,'not_testable');
});
