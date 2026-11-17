/**
 * Out-of-time NFL/NHL game-result model with genuine pregame opponent features.
 * Stage separation: training (<=2022), model selection (2023),
 * calibration only (2024), untouched test (2025).
 * No paid API or visitor requests. NEVER promotes coefficients to the live site:
 * an equivalent snapshot source and a positive untouched holdout are required.
 */
import {buildPregameRows} from './retrospective-model.mjs';
import {calibrateRecordModel,reconstructRecordSnapshots,scoreForecasts} from './calibrate-record-model.mjs';
export const ENHANCED_VERSION='nfl-nhl-elo-calibration-v1';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-25,25)));
const logit=p=>Math.log(clamp(p,.00001,.99999)/(1-clamp(p,.00001,.99999)));
const avg=xs=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const YEAR={nfl:{trainUntil:2022,select:2023,calibrate:2024,holdout:2025,minTest:250},
 nhl:{trainUntil:2022,select:2023,calibrate:2024,holdout:2025,minTest:1000}};
const FEATURES={
 elo:['elo'],
 elo_form:['elo','form'],
 elo_scoring:['elo','scoring'],
 elo_form_scoring:['elo','form','scoring'],
 elo_form_rest:['elo','form','rest'],
 elo_form_scoring_rest:['elo','form','scoring','rest'],
 nfl_coaching:['elo','form','scoring','rest','coach']
};
function rowX(row){
 const f=row.features||{};
 const raw=x=>typeof x==='number'&&Number.isFinite(x)?x:0;
 return {elo:clamp(logit(row.baseline||.5)/1.5,-3,3),
  form:clamp(raw(f.season_form),-2,2),
  scoring:clamp(raw(f.offense_defense),-2,2),
  rest:clamp(raw(f.rest_days),-2,2),
  coach:clamp(raw(f.coach_h2h),-1,1)};
}
function logisticRegression(rows,features,{iterations=750,lambda=.03}={}){
 if(!rows.length)throw Error('Insufficient training history');
 const weights=features.map(()=>0);let intercept=0;
 for(let k=0;k<iterations;k++){
  let g0=0,gr=features.map(()=>0);
  for(const r of rows){
   const d=sigmoid(intercept+weights.reduce((acc,w,j)=>acc+w*r.x[features[j]],0))-r.y;
   g0+=d;for(let j=0;j<features.length;j++)gr[j]+=d*r.x[features[j]];
  }
  const step=.26,den=rows.length;
  intercept=clamp(intercept-step*(g0/den+.005*intercept),-2,2);
  for(let j=0;j<features.length;j++)weights[j]=clamp(weights[j]-step*(gr[j]/den+lambda*weights[j]),-4,4);
 }
 return {intercept,weights:Object.fromEntries(features.map((f,i)=>[f,weights[i]]))};
}
function predict(r,fit,features,cal={intercept:0,slope:1}){
 const lp=fit.intercept+features.reduce((s,k)=>s+fit.weights[k]*r.x[k],0);
 return clamp(sigmoid(cal.intercept+cal.slope*lp),.02,.98);
}
function fitCalibration(rows,predictions){
 if(!rows.length||rows.length!==predictions.length)throw Error('Insufficient calibration slice');
 let intercept=0,slope=1;
 for(let k=0;k<650;k++){
  let gi=0,gs=0;
  for(let i=0;i<rows.length;i++){
   const x=logit(predictions[i]),d=sigmoid(intercept+slope*x)-rows[i].y;
   gi+=d;gs+=d*x;
  }
  intercept=clamp(intercept-.16*(gi/rows.length+.025*intercept),-.8,.8);
  slope=clamp(slope-.16*(gs/rows.length+.025*(slope-1)),.5,1.65);
 }
 return {intercept,slope};
}
function bootstrapPaired(rows,field='ref',seed=4687){
 let state=seed|0;
 const random=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 const scores=[];
 for(let i=0;i<1000;i++){
  let sum=0;
  for(let j=0;j<rows.length;j++){
   const x=rows[Math.floor(random()*rows.length)];
   sum+=(x[field]-x.y)**2-(x.p-x.y)**2;
  }
  scores.push(sum/rows.length);
 }
 scores.sort((a,b)=>a-b);return [scores[24],scores[974]];
}
function refProbability(row,params){
 const prior=params.prior;
 const ph=(row.homeWins+prior/2)/(row.homeGames+prior);
 const pa=(row.awayWins+prior/2)/(row.awayGames+prior);
 const z=params.intercept+params.slope*(logit(ph)-logit(pa));
 return clamp(sigmoid(params.calibrator.intercept+params.calibrator.slope*z),.02,.98);
}
export function evaluateEnhancedGames(games,league){
 if(!YEAR[league])throw Error('Only NFL and NHL are currently supported');
 const cfg=YEAR[league],rows=buildPregameRows(games,league)
  .map(r=>({...r,x:rowX(r)}));
 const split={
  train:rows.filter(r=>r.season<=cfg.trainUntil),
  select:rows.filter(r=>r.season===cfg.select),
  calibration:rows.filter(r=>r.season===cfg.calibrate),
  holdout:rows.filter(r=>r.season===cfg.holdout)
 };
 const counts=Object.fromEntries(Object.entries(split).map(([k,v])=>[k,v.length]));
 const base={league,version:ENHANCED_VERSION,counts,featureAvailability:{
  form:rows.filter(r=>r.features.season_form!==null).length,
  scoring:rows.filter(r=>r.features.offense_defense!==null).length,
  rest:rows.filter(r=>r.features.rest_days!==null).length,
  coaching:rows.filter(r=>r.features.coach_h2h!==null).length
 },dataProvenance:'historical completed game scores only; previous-day Elo, offense/defense and rest history; no archived player or bookmaker snapshots'};
 if(counts.train<cfg.minTest*2||counts.select<cfg.minTest*.8||counts.calibration<cfg.minTest*.8||counts.holdout<cfg.minTest)
  return {...base,status:'insufficient_data',approved:false};
 const selections=Object.entries(FEATURES).filter(([name])=>league==='nfl'||name!=='nfl_coaching')
  .map(([name,features])=>{
   const fit=logisticRegression(split.train,features);
   const val=scoreForecasts(split.select.map(r=>({y:r.y,p:predict(r,fit,features)})));
   return {name,features,fit,selectBrier:val.brier,selectECE:val.ece};
  }).sort((a,b)=>a.selectBrier-b.selectBrier||a.features.length-b.features.length);
 const chosen=selections[0];
 // Selection never uses the calibration season or the holdout.
 const fit=chosen.fit,featureNames=chosen.features;
 const cal=fitCalibration(split.calibration,split.calibration.map(r=>predict(r,fit,featureNames)));
 const scored=split.holdout.map(r=>({gameId:r.gameId,y:r.y,p:predict(r,fit,featureNames,cal),
  ref:0.5,constant:0.5}));
 const reference=calibrateRecordModel(games,league);
 if(!reference.reviewManifest)return {...base,status:'no_reference',approved:false};
 const m=reference.reviewManifest,records=reconstructRecordSnapshots(games,league);
 const byId=new Map(records.filter(r=>r.season===cfg.holdout).map(r=>[r.gameId,r]));
 const h0=avg(split.train.map(r=>r.y));
 for(const x of scored){
  const record=byId.get(x.gameId);
  if(!record)throw Error('Reference mismatch: missing game '+x.gameId);
  x.ref=refProbability(record,m);
  x.constant=h0;
 }
 const final=scoreForecasts(scored);
 const ref=scoreForecasts(scored.map(x=>({p:x.ref,y:x.y})));
 const home=scoreForecasts(scored.map(x=>({p:x.constant,y:x.y})));
 const gainOverRecord=ref.brier-final.brier;
 const gainOverConstant=home.brier-final.brier;
 const ciRecord=bootstrapPaired(scored,'ref');
 const ciConstant=bootstrapPaired(scored,'constant');
 const checks={
  holdoutCoverage:scored.length>=cfg.minTest,
  absoluteCalibration:final.ece<=.055&&Math.abs(final.bias)<=.045,
  beatConstant:gainOverConstant>=.002&&ciConstant[0]>0&&final.logLoss<home.logLoss,
  beatRecord:gainOverRecord>=.001&&ciRecord[0]>0&&final.logLoss<ref.logLoss
 };
 const approved=Object.values(checks).every(Boolean);
 const params={league,version:ENHANCED_VERSION,selectedOn:cfg.select,calibratedOn:cfg.calibrate,
  testedOn:cfg.holdout,features:featureNames,fit,calibrator:cal,
  requiresLive:['previous-day Elo based on prior completed games','previous-day season form',
   'previous-day scoring matchup','verified prior dates for rest'],liveSupported:false};
 return {...base,status:approved?'historically_passed_pending_live_features':'research_not_promoted',
  approved,checks,selection:selections.map(({name,features,selectBrier,selectECE})=>({name,features,selectBrier,selectECE})),
  chosen:chosen.name,calibration:cal,
  holdout:{candidate:final,recordReference:ref,constantHome:home,gainOverRecord,gainOverConstant,
   bootstrap95GainOverRecord:ciRecord,bootstrap95GainOverConstant:ciConstant},
  reviewManifest:params,
  notice:'Even a passing historical test cannot be deployed until a free daily source reproduces each exact pregame feature. Never claim calibrated injury, QB/blitz, confirmed goalies, or parlay confidence.'};
}
