import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailySuggestions} from '../supabase/functions/daily-tickets/generator.mjs';
import {evaluatePregameParlay} from '../supabase/functions/daily-tickets/pregame-parlay-engine.mjs';

// Offline ticket audit: deterministic fixture; no odds API, Render, or model promotion.
const now=new Date('2026-11-18T18:00:00Z');
const quote=new Date(now.getTime()-5*60_000).toISOString();
const start=new Date(now.getTime()+4*3600_000).toISOString();
const books=['draftkings','fanduel','betmgm'];
const events=Array.from({length:6},(_,i)=>({
 id:'fixture-'+i,sport_key:i%2?'icehockey_nhl':'americanfootball_nfl',
 home_team:'Home '+i,away_team:'Away '+i,commence_time:start,
 bookmakers:books.map(key=>({key,title:key,last_update:quote,markets:[{
  key:'h2h',last_update:quote,outcomes:[{name:'Home '+i,price:-180},{name:'Away '+i,price:155}]
 }]}))
}));
const rows=[{fetched_at:quote,snapshot:{events}}];
test('daily tickets use distinct games, one bookmaker, and exact gross/net stake math',()=>{
 const result=buildDailySuggestions(rows,{now});
 assert.equal(result.status,'market_illustrations_not_model_confidence');
 for(const card of result.cards.filter(x=>x.available)){
  assert.equal(new Set(card.legs.map(l=>l.gameId)).size,card.legCount);
  assert.equal(new Set(card.legs.map(l=>l.bookmakerKey)).size,1);
  const multiplier=card.legs.reduce((v,l)=>v*(l.odds>0?1+l.odds/100:1+100/-l.odds),1);
  assert.ok(Math.abs(card.payoutMultiplier-multiplier)<1e-10);
  assert.equal(card.returnAt10,Math.round(1000*multiplier)/100);
  assert.equal(card.profitAt10,Math.round(1000*(multiplier-1))/100);
  assert.ok(card.marketProbabilityProduct>0&&card.marketProbabilityProduct<1);
  assert.match(card.basis,/NOT historically calibrated/);
  assert.equal(Object.hasOwn(card,'confidence'),false);
  assert.equal(Object.hasOwn(card,'jointProbability'),false);
 }
});
test('The Big One is unavailable rather than inventing odds when fixtures are insufficient',()=>{
 const thin=[{fetched_at:quote,snapshot:{events:events.slice(0,3)}}];
 const big=buildDailySuggestions(thin,{now}).cards.find(x=>x.id==='big-one');
 assert.equal(big.available,false);
});
test('same-game correlated tickets fail closed without a prospective joint model and quoted price',()=>{
 const game={id:'g1',league:'nfl',start:new Date(now.getTime()+30*60_000).toISOString()};
 const offers=[
  {id:'a',gameId:'g1',bookmakerKey:'draftkings',market:'h2h',selection:'Home',price:-120,asOf:quote},
  {id:'b',gameId:'g1',bookmakerKey:'draftkings',market:'player_pass_yds',selection:'Over 250',playerId:'p1',price:110,asOf:quote}
 ];
 assert.equal(evaluatePregameParlay(game,offers,{now}).reason,'joint_model_unvalidated');
 const unvalidated={gameId:'g1',calibrated:true,prospectiveValidated:false,asOf:quote,tickets:[
  {legIds:['a','b'],jointProbability:.5,combinedPrice:250,bookmakerKey:'draftkings',quoteAsOf:quote}
 ]};
 assert.equal(evaluatePregameParlay(game,offers,{now,model:unvalidated}).status,'PASS');
 assert.equal(evaluatePregameParlay(game,offers,{now,model:{...unvalidated,prospectiveValidated:true,tickets:[{...unvalidated.tickets[0],combinedPrice:undefined}]}}).status,'PASS');
});
