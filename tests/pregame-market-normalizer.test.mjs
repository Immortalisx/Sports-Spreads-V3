import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCachedOffers} from '../supabase/functions/daily-tickets/market-normalizer.mjs';
const event={id:'event-1',bookmakers:[{key:'draftkings',last_update:'2026-11-18T20:00:00Z',markets:[
 {key:'h2h',outcomes:[{name:'Home',price:-110},{name:'Away',price:100}]},
 {key:'player_pass_yds',outcomes:[{name:'Over',description:'Example QB',point:245.5,price:-115},{name:'Under',description:'Example QB',point:245.5,price:-105}]}
]}]};
test('normalizer counts real priced team markets and withholds unresolved player identities',()=>{
 const result=extractCachedOffers(event);
 assert.equal(result.counts.team,2);
 assert.equal(result.counts.player,0);
 assert.equal(result.counts.unresolvedPlayers,2);
 assert.equal(result.offers.length,2);
});
test('normalizer accepts verified player directory matches and preserves sportsbook quote',()=>{
 const result=extractCachedOffers(event,{playerDirectory:{'Example QB':'nfl-player-1'}});
 assert.equal(result.counts.player,2);
 assert.equal(result.offers.find(x=>x.market==='player_pass_yds').playerId,'nfl-player-1');
 assert.ok(result.offers.every(x=>x.bookmakerKey==='draftkings'));
});
test('normalizer rejects unknown markets and invalid prices',()=>{
 const bad={...event,bookmakers:[{key:'book',last_update:'2026-11-18T20:00:00Z',markets:[
 {key:'player_unknown',outcomes:[{name:'Over',price:100}]},
 {key:'h2h',outcomes:[{name:'Home',price:99}]}
 ]}]};
 assert.equal(extractCachedOffers(bad).offers.length,0);
});
