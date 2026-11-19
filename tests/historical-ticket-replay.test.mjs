import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHistoricalTicket,replayHistoricalTickets} from '../engine/historical-ticket-replay.mjs';
const leg=(id,game,won,home,away)=>({id,gameId:game,homeTeam:home,awayTeam:away,
 bookmakerKey:'draftkings',odds:100,quotedAt:'2025-10-01T12:00:00Z',won});
const base={id:'ticket-1',league:'nfl',source:{provider:'offline-fixture',snapshotId:'fixture-2025-10-01',attributed:true},
 start:'2025-10-01T20:00:00Z',quotedAt:'2025-10-01T13:00:00Z',
 settledAt:'2025-10-02T01:00:00Z',modelAsOf:'2025-10-01T11:00:00Z',
 pointInTimeVerified:true,independentHoldout:true,
 legs:[leg('l1','g1',true,'A','B'),leg('l2','g2',true,'C','D')],
 won:true,payoutMultiplier:4,predictedJointProbability:.4};
test('valid attributed pregame whole ticket produces correct payout and metrics',()=>{
 assert.equal(validateHistoricalTicket(base).valid,true);
 const rows=[base,{...base,id:'ticket-2',won:false,legs:[{...base.legs[0],won:false},base.legs[1]]}];
 const r=replayHistoricalTickets(rows,{minHoldout:2});
 assert.equal(r.status,'research_only');assert.equal(r.n,2);assert.equal(r.winRate,.5);
 assert.equal(r.roi,1);assert.ok(Math.abs(r.brier-.26)<1e-12);
 assert.ok(Math.abs(r.ece-.1)<1e-12);assert.equal(r.promotionAllowed,false);
});
test('historical replay rejects unattributed, postgame, mismatched or correlated tickets',()=>{
 const variants=[
 {...base,source:{...base.source,attributed:false}},
 {...base,quotedAt:'2025-10-01T21:00:00Z'},
 {...base,modelAsOf:'2025-10-01T14:00:00Z'},
 {...base,won:false},
 {...base,payoutMultiplier:7},
 {...base,legs:[base.legs[0],{...base.legs[1],gameId:'g1'}]},
 {...base,legs:[base.legs[0],{...base.legs[1],homeTeam:'A'}]},
 {...base,legs:[base.legs[0],{...base.legs[1],bookmakerKey:'fanduel'}]}
 ];
 for(const v of variants)assert.equal(replayHistoricalTickets([v],{minHoldout:1}).status,'insufficient_data');
 assert.equal(replayHistoricalTickets([base,base],{minHoldout:2}).reason,'duplicate_ticket');
 assert.equal(replayHistoricalTickets([base],{minHoldout:200}).status,'insufficient_data');
});
test('deterministic offline fixture is not misrepresented as real betting validation',()=>{
 const r=replayHistoricalTickets([base],{minHoldout:1});
 assert.equal(r.promotionAllowed,false);
 assert.match(r.disclaimer,/Historical research only/);
 assert.equal(base.source.provider,'offline-fixture');
});
