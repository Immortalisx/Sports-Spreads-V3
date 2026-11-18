import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePregameParlay} from '../supabase/functions/daily-tickets/pregame-parlay-engine.mjs';
const now=new Date('2026-11-18T20:00:00Z');
const game={id:'nfl-123',league:'nfl',start:'2026-11-18T20:45:00Z'};
const offer=(id,market,price,bookmakerKey='book1')=>({id,gameId:game.id,market,price,bookmakerKey,selection:id,playerId:market.startsWith('player_')?'player-1':undefined,asOf:'2026-11-18T19:58:00Z'});
const legs=[offer('ml','h2h',-110),offer('yards','player_pass_yds',120)];
const model={calibrated:true,prospectiveValidated:true,gameId:game.id,asOf:'2026-11-18T19:59:00Z',version:'holdout-v1',tickets:[{legIds:['ml','yards'],jointProbability:.40}]};
test('pregame refuses outside 60-minute window',()=>{
 assert.equal(evaluatePregameParlay({...game,start:'2026-11-18T21:01:00Z'},legs,{now,model}).reason,'outside_final_hour');
 assert.equal(evaluatePregameParlay({...game,start:'2026-11-18T19:59:00Z'},legs,{now,model}).reason,'outside_final_hour');
});
test('pregame refuses to invent unvalidated joint probability',()=>{
 assert.equal(evaluatePregameParlay(game,legs,{now}).reason,'joint_model_unvalidated');
 assert.equal(evaluatePregameParlay(game,legs,{now,model:{...model,prospectiveValidated:false}}).status,'PASS');
});
test('pregame rejects stale, missing and cross-book player prices',()=>{
 assert.equal(evaluatePregameParlay(game,[legs[0],{...legs[1],asOf:'2026-11-18T19:40:00Z'}],{now,model}).status,'PASS');
 assert.equal(evaluatePregameParlay(game,[legs[0],{...legs[1],bookmakerKey:'book2'}],{now,model}).status,'PASS');
 assert.equal(evaluatePregameParlay(game,[legs[0],{...legs[1],playerId:undefined}],{now,model}).status,'PASS');
});
test('pregame selects only positive edge supported by calibrated joint model',()=>{
 const result=evaluatePregameParlay(game,legs,{now,model});
 assert.equal(result.status,'READY');
 assert.equal(result.legs.length,2);
 assert.ok(result.expectedValue>.05);
 assert.equal(result.bookmakerKey,'book1');
});
test('pregame refuses low or negative edge and unsupported markets',()=>{
 assert.equal(evaluatePregameParlay(game,legs,{now,model:{...model,tickets:[{legIds:['ml','yards'],jointProbability:.20}]}}).status,'PASS');
 assert.equal(evaluatePregameParlay(game,[legs[0],{...legs[1],market:'unverified_prop'}],{now,model}).status,'PASS');
});
