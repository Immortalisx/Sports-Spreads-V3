import test from 'node:test';
import assert from 'node:assert/strict';
import {recencySnapshots,validateRecency} from '../engine/recency-research.mjs';
function fixture(league,n=150){
 const games=[];
 for(let season=2022;season<=2025;season++)for(let i=0;i<n;i++){
  const day=new Date(Date.UTC(season,0,1+Math.floor(i/3))).toISOString().slice(0,10);
  games.push({league,season,gameId:league+'-'+season+'-'+i,gameDate:day,
   homeTeam:'H'+(i%3),awayTeam:'A'+(i%3),
   homeScore:i%2===0?2:1,awayScore:i%2===0?1:2,
   sourceUrl:'https://example.org/test-fixture',sourceTier:'test_data'});
 }
 return games;
}
test('same-day games cannot change each others pregame recency form',()=>{
 const games=fixture('nfl',6);
 const rows=recencySnapshots(games,'nfl',4);
 const day=rows.filter(r=>r.season===2022&&r.gameDate==='2022-01-01');
 assert.equal(day.length,3);
 for(const r of day){assert.equal(r.recency.home.n,0);assert.equal(r.recency.away.n,0);}
 const next=rows.find(r=>r.season===2022&&r.gameDate==='2022-01-02');
 assert.equal(next.recency.home.n,1);
});
test('season recency resets while Elo baseline can carry historical priors',()=>{
 const rows=recencySnapshots(fixture('nfl',6),'nfl',4);
 for(const season of [2023,2024,2025]){
  const first=rows.find(r=>r.season===season);
  assert.equal(first.recency.home.n,0);
  assert.equal(first.recency.away.n,0);
 }
});
test('all three leagues produce bounded, offline, research-only holdout metrics',()=>{
 for(const [league,n] of [['nfl',150],['nba',510],['nhl',460]]){
  const report=validateRecency(fixture(league,n),league);
  assert.equal(report.status,'research_only');
  assert.equal(report.promotionAllowed,false);
  assert.equal(report.counts.holdout,n);
  assert.equal(report.validationSeason,2024);
  assert.equal(report.holdoutSeason,2025);
  assert.ok(Number.isFinite(report.holdout.candidate.brier));
  assert.equal(report.holdout.gameDateBlockBootstrap95.length,2);
 }
});
test('too little history and explicitly simulated results cannot be promoted',()=>{
 assert.equal(validateRecency(fixture('nfl',20),'nfl').status,'insufficient_games');
 assert.equal(validateRecency([{...fixture('nfl',1)[0],simulated:true}],'nfl').status,'invalid_input');
});
