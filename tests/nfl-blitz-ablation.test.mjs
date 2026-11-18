import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateNflBlitzAblation} from '../engine/evaluate-nfl-blitz-ablation.mjs';
function fake(){
 const fixtures=[],projectedFeatures=[];
 for(let year=2022;year<=2025;year++){
  for(let week=0;week<20;week++)for(let i=0;i<13;i++){
   const date=new Date(Date.UTC(year,8,1+week*7)).toISOString().slice(0,10);
   const id=year+'_'+String(week+1).padStart(2,'0')+'_H'+i+'_A'+i;
   const homeWin=(week+i+year)%3!==0;
   fixtures.push({id,date,year,home:'H'+i,away:'A'+i,
    homeScore:homeWin?27:17,awayScore:homeWin?17:27});
   const cutoff=week?new Date(Date.UTC(year,8,1+(week-1)*7)).toISOString().slice(0,10):null;
   projectedFeatures.push({id,date,season:year,blitzInteraction:week>=3?((i%3)-1)*.2:null,
    enoughData:week>=3,dataThrough:cutoff,earliestAllowedSourceDate:cutoff,
    qbIdentification:'previous-game QB proxy'});
  }
 }
 return {version:'ftn-nfl-pregame-v1',fixtures,projectedFeatures};
}
test('NHL inputs or invented source versions are not allowed',()=>{
 assert.throws(()=>evaluateNflBlitzAblation({version:'fake',fixtures:[],projectedFeatures:[]}),/verified/);
});
test('independent 2022 train, 2023 selection, 2024 calibration, 2025 holdout produces paired same-fixture comparison',()=>{
 const r=evaluateNflBlitzAblation(fake());
 assert.equal(r.counts.train,260);assert.equal(r.counts.select,260);
 assert.equal(r.counts.calibrate,260);assert.equal(r.counts.holdout,260);
 assert.ok(r.holdout.baseline.n===r.holdout.augmented.n);
 assert.ok(Number.isFinite(r.holdout.brierGain));
 assert.equal(r.modelActivated,false);
 assert.match(r.limitations,/not confirmed starting QB/);
});
test('later published charting must not leak into pregame features',()=>{
 const data=fake();const x=data.projectedFeatures.find(x=>x.dataThrough);
 x.dataThrough=x.date; // using same-day QB performance would be leakage
 assert.throws(()=>evaluateNflBlitzAblation(data),/LEAKAGE/);
});
test('missing charting cannot quietly produce a published betting grade',()=>{
 const d=fake();d.projectedFeatures=d.projectedFeatures.slice(0,200);
 assert.throws(()=>evaluateNflBlitzAblation(d),/Incomplete or duplicated/);
});
