/** Sports Spreads: leakage-aware, rolling-origin historical model evaluation.
 * Input MUST consist of point-in-time, provenance-linked records, not current
 * stats joined back onto old results. Synthetic test data is never publishable.
 * No betting ROI claim is possible without contemporaneous sportsbook prices.
 */
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sandbox={Date};sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../public/multifactor-engine.js',import.meta.url),'utf8'),sandbox);
export const featureContract=sandbox.SportsMultifactor.VERSION;
export const catalogue=sandbox.SportsMultifactor.CATALOG;
export const MIN_HOLDOUT={nfl:200,nba:500,nhl:450,mlb:800};
const bounded=(x,a,b)=>Math.min(b,Math.max(a,x));
const logistic=x=>1/(1+Math.exp(-bounded(x,-20,20)));
const logit=p=>Math.log(p/(1-p));
export function brier(rows){return rows.length?rows.reduce((s,r)=>s+(r.p-r.y)**2,0)/rows.length:null;}
export function logLoss(rows){return rows.length?rows.reduce((s,r)=>s-(r.y*Math.log(bounded(r.p,.0001,.9999))+(1-r.y)*Math.log(1-bounded(r.p,.0001,.9999))),0)/rows.length:null;}
export function calibrationError(rows,bins=10){if(!rows.length)return null;let e=0;
 for(let i=0;i<bins;i++){const bucket=rows.filter(r=>Math.min(bins-1,Math.floor(r.p*bins))===i);if(bucket.length){const predicted=bucket.reduce((s,r)=>s+r.p,0)/bucket.length,actual=bucket.reduce((s,r)=>s+r.y,0)/bucket.length;e+=Math.abs(predicted-actual)*bucket.length/rows.length;}}
 return e;}
const days=d=>Date.parse(d);
export function validateRow(row,league){
 if(!row||row.league!==league||!['official','licensed','independently_verified'].includes(row.sourceTier))return {valid:false,reason:'Unverified data source'};
 if(row.simulated===true)return {valid:false,reason:'Synthetic game'};
 const kickoff=days(row.gameAt),captured=days(row.snapshotAt),resultKnown=days(row.resultKnownAt);
 if(!Number.isFinite(kickoff)||!Number.isFinite(captured)||captured>=kickoff||!Number.isFinite(resultKnown)||resultKnown<=kickoff)return {valid:false,reason:'Time leakage or missing timestamps'};
 if(!/^https:\/\//.test(row.sourceUrl||'')||!row.gameId)return {valid:false,reason:'No source provenance or game ID'};
 if(typeof row.homeWin!=='boolean'||!Number.isFinite(row.baseProbability)||row.baseProbability<.02||row.baseProbability>.98)return {valid:false,reason:'Missing outcome or baseline estimate'};
 if(!row.features||typeof row.features!=='object')return {valid:false,reason:'Missing matchup features'};
 const available=[];
 for(const [id,_label,minN] of catalogue[league]||[]){
  const f=row.features[id];if(!f)continue;
  if(!Number.isFinite(f.homeMinusAway)||Math.abs(f.homeMinusAway)>5||!Number.isInteger(f.sampleSize)||f.sampleSize<minN)return {valid:false,reason:`Invalid ${id}`};
  if(!/^https:\/\//.test(f.sourceUrl||'')||!Number.isFinite(days(f.dataThrough))||days(f.dataThrough)>=kickoff||days(f.dataThrough)>captured)return {valid:false,reason:`Future/unsourced ${id}`};
  available.push(id);
 }
 return {valid:true,available,gameTime:kickoff};
}
function fit(data,features,{iters=350,lambda=.018,rate=.11}={}){
 const w=Object.fromEntries(features.map(x=>[x,0]));
 if(!data.length)return w;
 // Base estimate is an offset; only train residual effects, not a new unlabeled
 // intercept that could absorb posthoc changes in the training league.
 for(let i=0;i<iters;i++){
  const grad=Object.fromEntries(features.map(x=>[x,0]));
  for(const r of data){let score=logit(r.baseProbability);for(const id of features)score+=w[id]*r.features[id].homeMinusAway;
   const delta=logistic(score)-(r.homeWin?1:0);
   for(const id of features)grad[id]+=delta*r.features[id].homeMinusAway;
  }
  for(const id of features)w[id]=bounded(w[id]-rate*(grad[id]/data.length+lambda*w[id]),-1.5,1.5);
 }
 return w;
}
function evaluateSet(rows,weights,features){return rows.map(r=>{
 let score=logit(r.baseProbability);for(const id of features)score+=weights[id]*r.features[id].homeMinusAway;
 return {p:logistic(score),base:r.baseProbability,y:r.homeWin?1:0};
});}
const timeSpan=rows=>{const a=days(rows[0]?.gameAt),b=days(rows.at(-1)?.gameAt);return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):0;};
export function walkForward(data,league,features,options={}){
 const allowed=new Set((catalogue[league]||[]).map(x=>x[0]));
 if(!allowed.size)return {status:'unsupported_league',league};
 if(!Array.isArray(data)||!Array.isArray(features)||!features.length||features.some(f=>!allowed.has(f)))return {status:'invalid_features',league};
 const examined=data.map(r=>({r,check:validateRow(r,league)}));
 const failed=examined.filter(x=>!x.check.valid);
 const eligible=examined.filter(x=>x.check.valid).map(x=>x.r).filter(r=>features.every(id=>r.features[id])).sort((a,b)=>days(a.gameAt)-days(b.gameAt));
 const n=eligible.length;
 const min=options.minHoldout??MIN_HOLDOUT[league];
 const meta={league,features,featureContract,eligible:n,discardedInvalid:failed.length,discardedMissing:examined.length-failed.length-n,inputRows:data.length,spanDays:timeSpan(eligible)};
 if(n<Math.max(min*2,80))return {...meta,status:'insufficient_historical_data',requiredRows:Math.max(min*2,80)};
 if(meta.spanDays<360)return {...meta,status:'insufficient_time_span',requiredDays:360};
 // Walk-forward: evaluate on the last 30%, after an earlier tuning/training
 // window. Never random-shuffle time-ordered sports events.
 const cut=Math.floor(n*.70);
 const cutAt=days(eligible[cut].gameAt);
 const train=eligible.filter(r=>days(r.gameAt)<cutAt&&days(r.resultKnownAt)<cutAt);
 const excludedLateResults=eligible.filter(r=>days(r.gameAt)<cutAt&&days(r.resultKnownAt)>=cutAt).length;
 const holdout=eligible.filter(r=>days(r.gameAt)>=cutAt);
 if(holdout.length<min||!train.length)return {...meta,status:'insufficient_holdout',requiredHoldout:min,holdout:holdout.length};
 // Disjoint unique game IDs; duplicate records could inflate scores.
 const ids=new Set();if(eligible.some(x=>ids.has(x.gameId)||!ids.add(x.gameId)))return {...meta,status:'duplicate_game_ids'};
 const weights=fit(train,features);
 const evaluated=evaluateSet(holdout,weights,features),baseline=evaluated.map(x=>({p:x.base,y:x.y}));
 const bm=brier(evaluated),bb=brier(baseline),ece=calibrationError(evaluated);
 const metrics={count:holdout.length,brier:bm,baselineBrier:bb,logLoss:logLoss(evaluated),baselineLogLoss:logLoss(baseline),ece};
 // Transparent strict gate. Improvement may simply be sampling noise, so
 // production should later include repeated annual holdouts and confidence intervals.
 const validated=holdout.length>=min&&bm<bb-.002&&ece<=.045&&meta.spanDays>=360&&options.allowPromotion===true;
 return {...meta,excludedLateResults,trainingRows:train.length,status:validated?'validated':'research_only',weights,metrics,
  trainedThrough:train.at(-1).gameAt,validatedFrom:holdout[0].gameAt,validatedThrough:holdout.at(-1).gameAt,
  reason:validated?'Meets preliminary promotion criteria; still requires human review.':'Insufficient calibration gain, sample reliability, or promotion not approved.',
  version:`multifactor-${league}-candidate-v0.2`};
}
