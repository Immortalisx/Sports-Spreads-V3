/**
 * Ablation: do real QB-vs-opponent-blitz data improve already available rolling
 * current-season team form? Strict 2022 train -> 2023 selection check ->
 * 2024 calibration -> 2025 untouched test. No deployable coefficients.
 */
import {buildFormStudyRows} from './validate-rolling-form.mjs';
import {scoreForecasts} from './calibrate-record-model.mjs';
export const NFL_BLITZ_ABLATION_VERSION='source-nfl-blitz-ablation-v1';
const BASE=['record','elo','form','momentum','rest'];
const PLUS=[...BASE,'qbBlitz','qbBlitzAvailable'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-25,25)));
const logit=p=>Math.log(clamp(p,.0001,.9999)/(1-clamp(p,.0001,.9999)));
function fit(rows,keys,iterations=500){
 if(rows.length<150)throw Error('Not enough historical games to fit');
 let intercept=0;const weights=Object.fromEntries(keys.map(k=>[k,0]));
 for(let i=0;i<iterations;i++){
  let ga=0;const gs=Object.fromEntries(keys.map(k=>[k,0]));
  for(const r of rows){
   const score=intercept+keys.reduce((s,k)=>s+weights[k]*r.x[k],0);
   const d=sigmoid(score)-r.y;ga+=d;
   for(const k of keys)gs[k]+=d*r.x[k];
  }
  intercept=clamp(intercept-.20*(ga/rows.length+.008*intercept),-2,2);
  for(const k of keys)weights[k]=clamp(weights[k]-.20*(gs[k]/rows.length+.025*weights[k]),-3,3);
 }
 return {intercept,weights};
}
function predict(row,keys,model,cal={intercept:0,slope:1}){
 const x=model.intercept+keys.reduce((s,k)=>s+model.weights[k]*row.x[k],0);
 return clamp(sigmoid(cal.intercept+cal.slope*x),.02,.98);
}
function calibrate(rows,model,keys){
 let a=0,b=1;
 for(let iter=0;iter<400;iter++){
  let ga=0,gb=0;
  for(const r of rows){
   const z=logit(predict(r,keys,model));
   const d=sigmoid(a+b*z)-r.y;ga+=d;gb+=d*z;
  }
  a=clamp(a-.15*(ga/rows.length+.025*a),-.65,.65);
  b=clamp(b-.15*(gb/rows.length+.025*(b-1)),.6,1.5);
 }
 return {intercept:a,slope:b};
}
function interval(rows){
 let state=15719,rand=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 const v=[];
 for(let i=0;i<750;i++){
  let gain=0;
  for(let j=0;j<rows.length;j++){
   const r=rows[Math.floor(rand()*rows.length)];
   gain+=(r.baseline-r.y)**2-(r.augmented-r.y)**2;
  }
  v.push(gain/rows.length);
 }
 v.sort((a,b)=>a-b);return [v[18],v[731]];
}
export function evaluateNflBlitzAblation(input){
 if(!input||!Array.isArray(input.fixtures)||!Array.isArray(input.projectedFeatures)||
  input.version!=='ftn-nfl-pregame-v1')throw Error('Need verified four-year NFL charting inputs');
 const ledger=input.fixtures.map(g=>({gameId:'nfl-'+g.id,gameDate:g.date,league:'nfl',season:g.year,
  homeTeam:g.home,awayTeam:g.away,homeScore:g.homeScore,awayScore:g.awayScore}));
 const pregame=buildFormStudyRows(ledger,'nfl');
 const sourced=new Map(input.projectedFeatures.map(x=>[x.id,x]));
 if(sourced.size!==input.projectedFeatures.length||pregame.length!==sourced.size)
  throw Error('Incomplete or duplicated NFL game/blitz join');
 const rows=pregame.map(r=>{
  const b=sourced.get(r.gameId.slice(4));
  if(!b||b.date!==r.date||b.season!==r.season)throw Error('Fixture source mismatch '+r.gameId);
  const maxAllowed=new Date(Date.parse(r.date+'T00:00:00Z')-3*86400_000).toISOString().slice(0,10);
  if(b.dataThrough&&b.dataThrough>maxAllowed)throw Error('LEAKAGE: charting data published after pregame cutoff');
  const available=b.enoughData===true&&Number.isFinite(b.blitzInteraction);
  return {...r,x:{...r.x,qbBlitz:available?clamp(b.blitzInteraction/1.5,-2,2):0,
   qbBlitzAvailable:available?1:0},sourceAvailable:available};
 });
 const splits={train:rows.filter(x=>x.season===2022),select:rows.filter(x=>x.season===2023),
  calibrate:rows.filter(x=>x.season===2024),holdout:rows.filter(x=>x.season===2025)};
 const counts=Object.fromEntries(Object.entries(splits).map(([k,v])=>[k,v.length]));
 const first={version:NFL_BLITZ_ABLATION_VERSION,status:'insufficient_history',approved:false,
  modelActivated:false,counts,source:'verified FTN charting and nflverse PBP + exact rolling form'};
 if(counts.train<250||counts.select<250||counts.calibrate<250||counts.holdout<250)return first;
 const baselineModel=fit(splits.train,BASE),augmentedModel=fit(splits.train,PLUS);
 const selection={
  baseline:scoreForecasts(splits.select.map(r=>({y:r.y,p:predict(r,BASE,baselineModel)}))),
  augmented:scoreForecasts(splits.select.map(r=>({y:r.y,p:predict(r,PLUS,augmentedModel)})))
 };
 const baseCal=calibrate(splits.calibrate,baselineModel,BASE);
 const augCal=calibrate(splits.calibrate,augmentedModel,PLUS);
 const paired=splits.holdout.map(r=>({y:r.y,
  baseline:predict(r,BASE,baselineModel,baseCal),
  augmented:predict(r,PLUS,augmentedModel,augCal),available:r.sourceAvailable}));
 const baseline=scoreForecasts(paired.map(r=>({p:r.baseline,y:r.y})));
 const augmented=scoreForecasts(paired.map(r=>({p:r.augmented,y:r.y})));
 const coverage=paired.filter(r=>r.available).length/paired.length;
 const gain=baseline.brier-augmented.brier,ci=interval(paired);
 const checks={
  coverage:coverage>=.35,calibration:augmented.ece<=.055&&Math.abs(augmented.bias)<=.045,
  improvement:gain>=.001&&ci[0]>0&&augmented.logLoss<baseline.logLoss};
 const approved=Object.values(checks).every(Boolean);
 return {...first,status:approved?'historical_ablation_passed_live_unapproved':'no_verified_incremental_gain',
  approved,counts,checks,selection:{baselineBrier:selection.baseline.brier,augmentedBrier:selection.augmented.brier},
  holdout:{baseline,augmented,paired95BrierGain:ci,brierGain:gain,availableCoverage:coverage},
  featureWeightsResearchOnly:{qbBlitz:augmentedModel.weights.qbBlitz,available:augmentedModel.weights.qbBlitzAvailable},
  modelActivated:false,
  limitations:'2022-only FTN training, previous-game QB proxy not confirmed starting QB, no historical man/zone or injury snapshot, no validated betting edge. Do not deploy even if historical test passes until replicated prospectively.'};
}
