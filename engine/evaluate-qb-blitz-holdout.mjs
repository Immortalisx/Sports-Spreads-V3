/**
 * Batch 2: OUT-OF-TIME actual QB-vs-blitz add-on test to the existing
 * opponent-adjusted recency baseline. Neither weights nor inferred QB identities
 * are ever used in the production site from this research module.
 *
 * 2022 training -> 2023 feature selection -> 2024 probability calibration
 * -> 2025 untouched holdout. Full-slate scoring, no winner-based sample cuts.
 */
import {buildFormStudyRows} from './validate-rolling-form.mjs';
import {scoreForecasts} from './calibrate-record-model.mjs';

export const QB_BLITZ_HOLDOUT_VERSION='nfl-qb-blitz-recency-holdout-v1';
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const sigmoid=z=>1/(1+Math.exp(-clamp(z,-25,25)));
const logit=p=>Math.log(clamp(p,.0001,.9999)/(1-clamp(p,.0001,.9999)));
const BASE=[
 ['record'],['record','elo'],
 ['record','elo','form'],['record','elo','form','momentum'],
 ['record','elo','form','momentum','rest']
];
function modelSets(){
 const enhanced=[];
 for(const base of BASE)for(const extra of [
  ['qbEPA'],['qbExposure'],['qbEPA','qbExposure']
 ])enhanced.push([...base,...extra]);
 return {baseline:BASE,enhanced};
}
const featureValue=(f,k)=>{
 if(k==='qbEPA')return Number.isFinite(f?.qbMatchupEPA)?clamp(f.qbMatchupEPA/1.2,-2,2):0;
 if(k==='qbExposure')return Number.isFinite(f?.qbBlitzExposure)?clamp(f.qbBlitzExposure/0.45,-2,2):0;
 return 0;
};
export function combineFormAndBlitz(games,features){
 if(!Array.isArray(games)||!Array.isArray(features))throw Error('NFL historical games and QB features required');
 const base=buildFormStudyRows(games,'nfl');
 const map=new Map();
 for(const f of features){
  if(!f?.gameId||!/^\d{4}-\d{2}-\d{2}$/.test(f.gameDate||''))throw Error('Undated QB evidence');
  if(map.has(f.gameId))throw Error('Duplicate QB evidence gameId');
  map.set(f.gameId,f);
 }
 return base.map(r=>{
  const f=map.get(r.gameId);
  if(!f)throw Error('QB evidence missing for '+r.gameId);
  if(f.season!==r.season||f.gameDate!==r.date)throw Error('QB evidence does not match original final result '+r.gameId);
  const cutoff=f.sourceDataThrough;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff||'')||cutoff>=r.date)
   throw Error('QB charting publication lookahead at '+r.gameId);
  if(f.available&&(
    !Number.isFinite(f.qbMatchupEPA)||!Number.isFinite(f.qbBlitzExposure)||
    !f.home?.available||!f.away?.available||!f.home?.projectedQb||!f.away?.projectedQb))
   throw Error('Invalid sourced QB matchup at '+r.gameId);
  // Keep uncharted games in the evaluation, with neutralized missing features.
  return {...r,x:{...r.x,qbEPA:featureValue(f,'qbEPA'),
   qbExposure:featureValue(f,'qbExposure')},
   qbAvailable:f.available===true,
   qbRecord:{homeProjectedQb:f.home?.projectedQb||null,
    awayProjectedQb:f.away?.projectedQb||null,
    sourceDataThrough:f.sourceDataThrough}};
 });
}
function fit(rows,keys,rounds=600){
 if(rows.length<100)throw Error('Too few historic training results');
 let intercept=0,weights=keys.map(()=>0);
 for(let t=0;t<rounds;t++){
  let g0=0;const grads=keys.map(()=>0);
  for(const r of rows){
   const z=intercept+weights.reduce((s,w,j)=>s+w*r.x[keys[j]],0);
   const d=sigmoid(z)-r.y;g0+=d;
   for(let j=0;j<keys.length;j++)grads[j]+=d*r.x[keys[j]];
  }
  intercept=clamp(intercept-.22*(g0/rows.length+.008*intercept),-2,2);
  for(let j=0;j<weights.length;j++)
   weights[j]=clamp(weights[j]-.22*(grads[j]/rows.length+.04*weights[j]),-3.5,3.5);
 }
 return {intercept,coefficients:Object.fromEntries(keys.map((k,j)=>[k,weights[j]]))};
}
const predict=(r,m,keys,cal={intercept:0,slope:1})=>{
 const z=m.intercept+keys.reduce((s,k)=>s+m.coefficients[k]*r.x[k],0);
 return clamp(sigmoid(cal.intercept+cal.slope*z),.02,.98);
};
function platt(rows,model,keys){
 let a=0,b=1;
 const zs=rows.map(x=>logit(predict(x,model,keys)));
 for(let t=0;t<450;t++){
  let ga=0,gb=0;
  for(let i=0;i<rows.length;i++){
   const d=sigmoid(a+b*zs[i])-rows[i].y;
   ga+=d;gb+=d*zs[i];
  }
  a=clamp(a-.14*(ga/rows.length+.025*a),-.7,.7);
  b=clamp(b-.14*(gb/rows.length+.025*(b-1)),.6,1.5);
 }
 return {intercept:a,slope:b};
}
function fitSelection(rows,possible,train,select,cal){
 const c=possible.map(keys=>{
  const m=fit(train,keys);
  const val=scoreForecasts(select.map(r=>({p:predict(r,m,keys),y:r.y})));
  return {keys,model:m,selectBrier:val.brier,selectLogLoss:val.logLoss};
 }).sort((a,b)=>a.selectBrier-b.selectBrier||a.keys.length-b.keys.length);
 const chosen=c[0],calibrator=platt(cal,chosen.model,chosen.keys);
 return {model:chosen.model,keys:chosen.keys,calibrator,validation:c.map(x=>({keys:x.keys,brier:x.selectBrier})),
  predict:r=>predict(r,chosen.model,chosen.keys,calibrator)};
}
function pairedBlockCI(rows,iterations=2000){
 // Per-game bootstrap is anti-conservative because weekly NFL outcomes
 // share injury, calendar and coaching information. Resample 7-day blocks.
 const groups=new Map();
 const first=Date.parse(rows[0].date+'T00:00:00Z');
 for(const r of rows){
  const week=Math.floor((Date.parse(r.date+'T00:00:00Z')-first)/(7*86400000));
  const bucket=groups.get(week)||[];bucket.push(r);groups.set(week,bucket);
 }
 const blocks=[...groups.values()];const samples=[];
 let state=55113;
 const next=()=>((state=Math.imul(1664525,state)+1013904223|0)>>>0)/4294967296;
 for(let b=0;b<iterations;b++){
  let sum=0,count=0;
  for(let j=0;j<blocks.length;j++){
   const pick=blocks[Math.floor(next()*blocks.length)];
   for(const r of pick){sum+=(r.baseline-r.y)**2-(r.enhanced-r.y)**2;count++;}
  }
  samples.push(sum/Math.max(1,count));
 }
 samples.sort((a,b)=>a-b);
 return {interval95:[samples[Math.floor(iterations*.025)],samples[Math.floor(iterations*.975)]],
  blocks:blocks.length,method:'paired seven-day block bootstrap'};
}
export function evaluateQbBlitzIncrement(games,features){
 const all=combineFormAndBlitz(games,features);
 const bySeason=year=>all.filter(r=>r.season===year);
 const split={train:bySeason(2022),select:bySeason(2023),
  calibrate:bySeason(2024),holdout:bySeason(2025)};
 const counts=Object.fromEntries(Object.entries(split).map(([k,v])=>[k,v.length]));
 const output={version:QB_BLITZ_HOLDOUT_VERSION,sport:'nfl',counts,
  source:'FTN charting + nflverse PBP with 3-day chart delay; nflverse final results',
  starter:'inferred only from QB taking most charted dropbacks in last eligible team game',
  train:2022,select:2023,calibrate:2024,holdout:2025,
  approved:false,productionWeightsActivated:false};
 if([counts.train,counts.select,counts.calibrate,counts.holdout].some(n=>n<250))
  return {...output,status:'insufficient_historical_data'};
 const {baseline,enhanced}=modelSets();
 const base=fitSelection(all,baseline,split.train,split.select,split.calibrate);
 const plus=fitSelection(all,enhanced,split.train,split.select,split.calibrate);
 const paired=split.holdout.map(r=>({gameId:r.gameId,date:r.date,y:r.y,qbAvailable:r.qbAvailable,
  baseline:base.predict(r),enhanced:plus.predict(r)}));
 const scoreBase=scoreForecasts(paired.map(r=>({p:r.baseline,y:r.y})));
 const scorePlus=scoreForecasts(paired.map(r=>({p:r.enhanced,y:r.y})));
 const gain=scoreBase.brier-scorePlus.brier,bootstrap=pairedBlockCI(paired);
 const countAvailable=paired.filter(r=>r.qbAvailable).length;
 const coverage={
  train:split.train.filter(r=>r.qbAvailable).length/Math.max(1,counts.train),
  select:split.select.filter(r=>r.qbAvailable).length/Math.max(1,counts.select),
  calibrate:split.calibrate.filter(r=>r.qbAvailable).length/Math.max(1,counts.calibrate),
  holdout:countAvailable/counts.holdout,holdoutGamesWithUsableQbSamples:countAvailable
 };
 const checks={
  modelCalibration:scorePlus.ece<=.055&&Math.abs(scorePlus.bias)<=.045,
  enoughTrainingQbSamples:coverage.train>=.50,
  enoughHoldoutQbSamples:coverage.holdout>=.65,
  improvementOverForm:gain>=.001&&bootstrap.interval95[0]>0&&scorePlus.logLoss<scoreBase.logLoss
 };
 const approved=Object.values(checks).every(Boolean);
 return {...output,status:approved?'holdout_passed_pending_prospective_QB_feed':'research_not_promoted',
  approved,checks,sourceCoverage:coverage,selection:{
   recentForm:base.keys,withQBBlitz:plus.keys,
   recentFormValidation:base.validation,withQBValidation:plus.validation},
  metrics:{recentFormOnly:scoreBase,withQBBlitz:scorePlus,
   brierGain:gain,pairedBootstrap:bootstrap},
  proposedModel:approved?{model:plus.model,calibrator:plus.calibrator,keys:plus.keys}:null,
  caveat:'Projected starter from prior games is not a confirmed injury/lineup status; no verified live starter, man/zone, player prop, market edge or parlay success rate'};
}
