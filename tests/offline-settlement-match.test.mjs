import test from 'node:test';
import assert from 'node:assert/strict';
import {matchSettledMoneyline,auditSettlementCoverage} from '../engine/offline-settlement-match.mjs';
const source={rightsVerified:true,attribution:'licensed-offline-fixture'};
const quote={league:'nfl',gameId:'g1',homeTeam:'Home',awayTeam:'Away',
 start:'2025-10-05T20:00:00Z',quotedAt:'2025-10-05T19:00:00Z',
 selection:'Home',settlementRule:'full_game_including_overtime',source};
const result={league:'nfl',gameId:'g1',homeTeam:'Home',awayTeam:'Away',
 start:'2025-10-05T20:00:00Z',finalAt:'2025-10-06T00:00:00Z',
 homeScore:20,awayScore:17,status:'final',source};
test('matches fully attributed synthetic moneyline result, never computes ROI',()=>{
 const r=matchSettledMoneyline(quote,result);
 assert.equal(r.status,'matched');assert.equal(r.settlement.won,true);
 assert.equal(r.roi,null);assert.equal(r.modelProbability,null);assert.equal(r.promotionAllowed,false);
});
test('rejects mismatched teams, future quotes, missing rights, ambiguous NHL settlement',()=>{
 const cases=[
 [quote,{...result,awayTeam:'Other'}],
 [{...quote,quotedAt:'2025-10-05T21:00:00Z'},result],
 [{...quote,source:{rightsVerified:false,attribution:'fixture'}},result],
 [{...quote,selection:'Draw'},result],
 [{...quote,gameId:'g2'},result],
 [{...quote,league:'nhl',settlementRule:'full_game_including_overtime'}, {...result,league:'nhl'}],
 [quote,{...result,status:'scheduled'}],
 [quote,{...result,homeScore:17,awayScore:17}]
 ];
 for(const [q,r] of cases)assert.equal(matchSettledMoneyline(q,r).status,'unmatched');
});
test('coverage reports matched quotes without pretending to validate whole tickets',()=>{
 const a=auditSettlementCoverage([quote,{...quote,gameId:'missing'}],[result]);
 assert.equal(a.matched,1);assert.equal(a.unmatched,1);
 assert.equal(a.eligibleWholeTickets,0);assert.equal(a.roi,null);
});
