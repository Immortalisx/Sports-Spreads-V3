import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailySuggestions,sourceCandidates} from '../supabase/functions/daily-tickets/generator.mjs';
const now=new Date('2026-11-17T17:15:00Z');
const date=new Date(now.getTime()-10*60*1000).toISOString();
const start=new Date(now.getTime()+5*3600*1000).toISOString();
function event(i,p=.62){
 const away='Visitor '+i,home='Home '+i,oddsHome=p>=.7?-320:-170,oddsAway=p>=.7?265:152;
 return {id:'gid-'+i,sport_key:'basketball_nba',home_team:home,away_team:away,commence_time:start,
  bookmakers:['fanduel','draftkings','betmgm','pointsbet'].map((b,j)=>({
   key:b,title:b,last_update:date,markets:[{key:'h2h',last_update:date,
    outcomes:[{name:home,price:oddsHome+j*2},{name:away,price:oddsAway-j*2}]}]}))};
}
const data={league:'nba',fetched_at:date,snapshot:{events:[
 event(1,.76),event(2,.76),event(3),event(4),event(5),event(6),event(7)
]}};
test('four generated ticket types include The Big One with credible same-book prices',()=>{
 const r=buildDailySuggestions([data],{now});
 assert.equal(r.cards.length,4);
 assert.equal(r.cards.find(x=>x.id==='big-one').name,'The Big One');
 const big=r.cards.find(x=>x.id==='big-one');
 assert.equal(big.available,true);assert.equal(big.legs.length,4);
 assert.ok(big.payoutMultiplier>=4);
 assert.ok(big.marketProbabilityProduct>0&&big.marketProbabilityProduct<.5);
 assert.ok(big.marketGrade==='D'||big.marketGrade==='E'||big.marketGrade==='C');
 assert.equal(new Set(big.legs.map(x=>x.bookmakerKey)).size,1);
 assert.equal(new Set(big.legs.map(x=>x.gameId)).size,4);
 assert.match(big.basis,/NOT historically calibrated/);
 assert.ok(big.returnAt10>10);
});
test('never builds when cached source is stale or lacks 3 independent books',()=>{
 const stale={...data,fetched_at:new Date(now.getTime()-10*3600_000).toISOString()};
 assert.equal(buildDailySuggestions([stale],{now}).cards.every(x=>!x.available),true);
 const thin={...data,snapshot:{events:[{...event(1),bookmakers:event(1).bookmakers.slice(0,2)}]}};
 assert.equal(sourceCandidates([thin],now).size,0);
});
test('does not invent tickets with too few fixtures or already started games',()=>{
 const one={...data,snapshot:{events:[event(1),event(2)]}};
 const r=buildDailySuggestions([one],{now});
 assert.equal(r.cards.find(x=>x.id==='big-one').available,false);
 const past={...data,snapshot:{events:data.snapshot.events.map(x=>({...x,commence_time:'2026-11-17T14:00:00Z'}))}};
 assert.equal(buildDailySuggestions([past],{now}).cards.some(x=>x.available),false);
});
test('Sunday ticket uses NFL Sunday ET games only and explains missing prices',()=>{
 const sunday=new Date('2026-11-22T17:15:00Z');
 const row=structuredClone(data);
 row.league='nfl';
 row.fetched_at=sunday.toISOString();
 for(const e of row.snapshot.events){
  e.sport_key='americanfootball_nfl';
  e.commence_time='2026-11-22T21:05:00Z';
  for(const b of e.bookmakers)b.markets[0].last_update=row.fetched_at;
 }
 const result=rows=>buildDailySuggestions(rows,{now:sunday}).cards.find(c=>c.id==='sunday-nfl');
 assert.equal(result([row]).legs.length,2);
 assert.match(result([]).reason,/recent NFL/);
 row.snapshot.events[0].commence_time='2026-11-23T06:00:00Z';
 assert.equal(result([row]).available,false);
 assert.equal(sourceCandidates([{...row,league:'nhl'}],sunday).size,0);
});
