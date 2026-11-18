import test from 'node:test';
import assert from 'node:assert/strict';
import {prospectiveScorecard} from '../engine/prospective-scorecard.mjs';

const game=(id,overrides={})=>({
 league:'nba',game_id:String(100000+id),game_date:'2026-11-20',
 model_version:'record-holdout-2025-v1',model_as_of:'2026-11-19T18:00:00Z',
 game_start:'2026-11-20T18:00:00Z',market_as_of:'2026-11-19T17:30:00Z',
 model_home_probability:.6,market_home_probability:.52,book_count:3,
 actual_home_win:1,...overrides
});
test('empty forward ledger never claims validated confidence',()=>{
 const r=prospectiveScorecard([],'nba');
 assert.equal(r.status,'awaiting_final_results');
 assert.equal(r.approved,false);
 assert.equal(r.pairedMarketGames,0);
});
test('pre-forecast price and game start time are strictly enforced',()=>{
 const rows=[
  game(1),game(2,{market_as_of:'2026-11-19T19:00:00Z'}),
  game(3,{market_as_of:'2026-11-19T15:00:00Z'}),
  game(4,{market_as_of:'2026-11-20T19:00:00Z'}),
  game(5,{model_as_of:'2026-11-20T19:00:00Z'})
 ];
 const r=prospectiveScorecard(rows,'nba');
 assert.equal(r.completedGames,4);
 assert.equal(r.pairedMarketGames,1);
 assert.equal(r.invalidMarketRows,3);
 assert.equal(r.rejectedRows,1);
});
test('missing market quotes cannot invent a model edge',()=>{
 const r=prospectiveScorecard([game(1,{market_home_probability:null,market_as_of:null})],'nba');
 assert.equal(r.status,'awaiting_contemporaneous_market');
 assert.equal(r.marketPaired,undefined);
 assert.equal(r.eligibleForManualReview,false);
});
test('deduplication and synthetic rejection prevent inflated sample',()=>{
 const a=game(1),b=game(2,{simulated:true}),c=game(3,{model_version:'unsupported'});
 const r=prospectiveScorecard([a,a,b,c],'nba');
 assert.equal(r.completedGames,1);
 assert.equal(r.duplicateRows,1);
 assert.equal(r.rejectedRows,2);
});
test('scoring uses exactly paired fixtures and keeps strict sample gate',()=>{
 const rows=[game(1),game(2,{market_home_probability:null,market_as_of:null}),
  game(3,{model_home_probability:.9,market_home_probability:.2,actual_home_win:0})];
 const r=prospectiveScorecard(rows,'nba');
 assert.equal(r.status,'insufficient_paired_sample');
 assert.equal(r.modelAllFinals.n,3);
 assert.equal(r.modelPaired.n,2);
 assert.equal(r.marketPaired.n,2);
 assert.equal(r.approved,false);
 assert.ok(Array.isArray(r.bootstrap95PercentGainInterval));
});
test('even a strong-looking short sample is not promoted',()=>{
 const rows=Array.from({length:40},(_,i)=>game(i,{
  game_date:'2026-11-'+String(1+Math.floor(i/2)).padStart(2,'0'),
  model_home_probability:.8,market_home_probability:.5
 }));
 const r=prospectiveScorecard(rows,'nba',{minPairs:10,minSpanDays:90});
 assert.equal(r.status,'insufficient_time_span');
 assert.equal(r.approved,false);
});
test('models never auto-promote even after a long positive paired record',()=>{
 const rows=Array.from({length:120},(_,i)=>{
  const at=new Date(Date.UTC(2026,0,1+i)).toISOString();
  const previous=new Date(Date.UTC(2025,11,31+i)).toISOString();
  const earlier=new Date(Date.UTC(2025,11,31+i)-30*60000).toISOString();
  return game(i,{game_date:at.slice(0,10),game_start:at,model_as_of:previous,market_as_of:earlier,
   model_home_probability:.8,market_home_probability:.5,actual_home_win:i%5===0?0:1});
 });
 const r=prospectiveScorecard(rows,'nba',{minPairs:10,minSpanDays:90,minCoverage:.7});
 assert.equal(r.status,'manual_review_candidate');
 assert.equal(r.eligibleForManualReview,true);
 assert.equal(r.approved,false);
});
test('refuses unsupported leagues and wrong input types',()=>{
 assert.throws(()=>prospectiveScorecard([],'nfl'),/only supports NBA and MLB/);
 assert.throws(()=>prospectiveScorecard({},'nba'),/Expected private/);
});
