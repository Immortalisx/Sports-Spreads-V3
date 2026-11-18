import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRow,walkForward,MIN_HOLDOUT} from '../engine/walkforward.mjs';
const kickoff='2026-11-22T18:00:00Z',snapshot='2026-11-21T18:00:00Z',result='2026-11-22T23:00:00Z';
const source='https://example.org/archive/2026-11-21';
const feature=(overrides={})=>({homeMinusAway:0.4,sampleSize:100,sourceUrl:source,dataThrough:'2026-11-20T18:00:00Z',...overrides});
const row=(league,featureId,overrides={})=>({league,sourceTier:'official',gameId:'real-archive-1',gameAt:kickoff,snapshotAt:snapshot,resultKnownAt:result,sourceUrl:source,homeWin:true,baseProbability:0.55,features:{[featureId]:feature()},...overrides});
const ids={nfl:'qb_blitz_edge',nhl:'goalie_gsax'};
for(const league of ['nfl','nhl']){
 const key=ids[league];
 test(league+' accepts only fully sourced pregame research records',()=>{
  const r=row(league,key);
  const check=validateRow(r,league);
  // If the feature catalogue changes, this test must be updated explicitly.
  assert.equal(check.valid,true,JSON.stringify(check));
 });
 test(league+' rejects postgame, unsourced and synthetic feature leakage',()=>{
  const base=row(league,key);
  const bad=[
   {...base,snapshotAt:kickoff},
   {...base,resultKnownAt:kickoff},
   {...base,simulated:true},
   {...base,sourceTier:'unverified'},
   {...base,sourceUrl:'http://example.org/archive'},
   {...base,features:{[key]:feature({dataThrough:kickoff})}},
   {...base,features:{[key]:feature({dataThrough:'2026-11-21T19:00:00Z'})}},
   {...base,features:{[key]:feature({sourceUrl:'not-a-source'})}},
   {...base,features:{[key]:feature({sampleSize:0})}}
  ];
  for(const b of bad)assert.equal(validateRow(b,league).valid,false,JSON.stringify(b));
 });
 test(league+' cannot promote a tiny or synthetic dataset',()=>{
  const tiny=Array.from({length:4},(_,i)=>row(league,key,{gameId:'fixture-'+i}));
  const report=walkForward(tiny,league,[key],{allowPromotion:false});
  assert.notEqual(report.approved,true);
  assert.equal(report.status,'insufficient_sample');
  assert.ok(MIN_HOLDOUT[league]>=200);
 });
}
