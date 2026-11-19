import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayWeekOne} from '../engine/week-one-point-in-time-replay.mjs';
const games=JSON.parse(readFileSync(new URL('./fixtures/week-one-2026-results.json',import.meta.url),'utf8'));
test('three real Week 1 outcomes do not generate fictional predictions',()=>{
 const rows=replayWeekOne(games);
 assert.deepEqual(rows.map(x=>x.status),Array(3).fill('not_independently_testable'));
 assert.ok(rows.every(x=>x.prediction===null&&x.promotionAllowed===false));
 assert.deepEqual(rows.map(x=>x.outcome.homeWon),[true,false,true]);
});
test('postkickoff snapshots and absent model manifest fail closed',()=>{
 const g=games[0],snapshot={gameId:g.gameId,snapshotAt:'2026-09-09T20:21:00-04:00',sourceUrl:'https://example.org/archive',baseline:{available:true,homeProbability:.7}};
 assert.equal(replayWeekOne([g],[snapshot])[0].reason,'invalid_snapshot_provenance_or_time');
 snapshot.snapshotAt='2026-09-09T19:00:00-04:00';
 assert.equal(replayWeekOne([g],[snapshot])[0].status,'not_independently_testable');
 assert.equal(replayWeekOne([g],[snapshot])[0].reason,'no_validated_pregame_model_manifest_or_features');
});
test('invalid scores and duplicate fixtures are rejected',()=>{
 assert.throws(()=>replayWeekOne([games[0],games[0]]),/duplicate/);
 assert.throws(()=>replayWeekOne([{...games[0],homeScore:-1}]),/invalid result/);
});
