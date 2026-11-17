/**
 * Batch 1: evaluate exactly the same current-season 3/5/10, opponent-adjusted
 * and Elo feature transform used by the Sports Spreads season-form Edge Function.
 * Training seasons: NFL 2020–22 / NHL 2021–22, feature selection: 2023,
 * Platt calibration: 2024, untouched test: 2025. No live promotion.
 */
import {buildCurrentSeasonSnapshots} from './current-season-rolling.mjs';
import {calibrateRecordModel,reconstructRecordSnapshots,scoreForecasts} from './calibrate-record-model.mjs';
export const FORM_VALIDATION_VERSION='rolling-form-holdout-v1';
const CONFIG={nfl:{train:500,select:200,cal:200,holdout:250},nhl:{train:1900,select:1200,cal:1200,holdout:1250}};
const MODELS=[
 ['record'],['record','elo'],['record','elo','form'],
 ['record','elo','form','momentum'],['record','elo','form','momentum','rest']
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sig=x=>1/(1+Math.exp(-clamp(x,-25,25)));
const logit=p=>Math.log(clamp(p,.0001,.9999)/(1-clamp(p,.0001,.9999)));
const feature=x=>{
 const h=x.home,a=x.away,m=x.matchup,prior=12;
 const hp=(h.wins+prior/2)/(h.played+prior),ap=(a.wins+prior/2)/(a.played+prior);
 return {record:clamp(logit(hp)-logit(ap),-3,3),
  elo:Number.isFinite(m.eloDifference)?clamp(m.eloDifference/300,-3,3):0,
  form:Number.isFinite(m.opponentAdjustedFormDelta)?clamp(m.opponentAdjustedFormDelta/2,-3,3):0,
  momentum:Number.isFinite(m.rollingMomentumDelta)?clamp(m.rollingMomentumDelta,-2,2):0,
  rest:Number.isFinite(m.restDaysDifference)?clamp(m.restDaysDifference/7,-2,2):0};
};
/** Guarantee: the observed outcome is attached AFTER the pregame snapshot. */
export function buildFormStudyRows(raw,league){
 if(!CONFIG[league]||!Array.isArray(raw))throw Error('NFL/NHL historical games required');
 const seasons=new Map(),ids=new Set();
 for(const g of raw){
  if(g?.league!==league)continue;
  if(!Number.isInteger(g.season)||!/^\d{4}-\d{2}-\d{2}$/.test(g.gameDate||'')||
     !g.gameId||!g.homeTeam||!g.awayTeam||g.homeTeam===g.awayTeam||
     !Number.isInteger(g.homeScore)||!Number.isInteger(g.awayScore)||
     g.homeScore===g.awayScore||g.homeScore<0||g.awayScore<0)continue;
  if(ids.has(g.gameId))throw Error('Duplicate historical ID '+g.gameId);
  ids.add(g.gameId);
  if(!seasons.has(g.season))seasons.set(g.season,[]);
  seasons.get(g.season).push(g);
 }
 const rows=[];
 for(const [season,games] of [...seasons.entries()].sort((a,b)=>a[0]-b[0])){
  const ledger=games.map(g=>({id:String(g.gameId),league,date:g.gameDate,
   home:String(g.homeTeam),away:String(g.awayTeam),homeScore:g.homeScore,awayScore:g.awayScore}));
  const fixtures=ledger.map(({id,league,date,home,away})=>({id,league,date,home,away}));
  const hist=buildCurrentSeasonSnapshots({league,season:String(season),games:ledger,fixtures});
  if(hist.snapshots.length!==games.length)throw Error('Season snapshot coverage mismatch');
  const byId=new Map(hist.snapshots.map(s=>[s.gameId,s]));
  for(const g of games){
   const s=byId.get(String(g.gameId));
   if(!s)throw Error('Missing pregame feature '+g.gameId);
   if(s.evidence.latestCompletedGame&&s.evidence.latestCompletedGame>=g.gameDate)
    throw Error('Same-day or future result leaked into pregame '+g.gameId);
   rows.push({season,gameId:String(g.gameId),date:g.gameDate,
    y:g.homeScore>g.awayScore?1:0,x:feature(s),
    validRecentForm:s.home.last5.games>=3&&s.away.last5.games>=3,
    historyThrough:s.evidence.latestCompletedGame||null});
  }
 }
 return rows.sort((a,b)=>a.season-b.season||a.date.localeCompare(b.date)||a.gameId.localeCompare(b.gameId));
}
function fit(rows,keys,rounds=550){
 let intercept=0,weights=keys.map(()=>0);
 if(rows.length<20)throw Error('Cannot fit tiny training set');
 for(let t=0;t<rounds;t++){
  let grad0=0;const grads=keys.map(()=>0);
  for(const r of rows){
   const z=intercept+weights.reduce((s,w,j)=>s+w*r.x[keys[j]],0);
   const d=sig(z)-r.y;grad0+=d;
   for(let j=0;j<keys.length;j++)grads[j]+=d*r.x[keys[j]];
  }
  intercept=clamp(intercept-.23*(grad0/rows.length+.006*intercept),-2,2);
  for(let j=0;j<keys.length;j++)
   weights[j]=clamp(weights[j]-.23*(grads[j]/rows.length+.03*weights[j]),-3.5,3.5);
 }
 return {intercept,weights:Object.fromEntries(keys.map((k,j)=>[k,weights[j]]))};
}
function predict(r,m,keys,cal={intercept:0,slope:1}){
 const z=m.intercept+keys.reduce((sum,k)=>sum+m.weights[k]*r.x[k],0);
 return clamp(sig(cal.intercept+cal.slope*z),.02,.98);
}
function calibrate(rows,predictions){
 let a=0,b=1;
 if(!rows.length||rows.length!==predictions.length)throw Error('Bad calibrator history');
 for(let k=0;k<500;k++){
  let ga=0,gb=0;
  for(let i=0;i<rows.length;i++){
   const z=logit(predictions[i]),delta=sig(a+b*z)-rows[i].y;
   ga+=delta;gb+=delta*z;
  }
  a=clamp(a-.14*(ga/rows.length+.02*a),-.7,.7);
  b=clamp(b-.14*(gb/rows.length+.02*(b-1)),.6,1.5);
 }
 return {intercept:a,slope:b};
}
function benchmark(x,m){
 const prior=m.prior,hp=(x.homeWins+prior/2)/(x.homeGames+prior);
 const ap=(x.awayWins+prior/2)/(x.awayGames+prior);
 const z=m.intercept+m.slope*(logit(hp)-logit(ap));
 return clamp(sig(m.calibrator.intercept+m.calibrator.slope*z),.02,.98);
}
function bootstrapGain(paired){
 let state=10231;const rand=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 const deltas=[];
 for(let b=0;b<600;b++){
  let sum=0;
  for(let i=0;i<paired.length;i++){
   const r=paired[Math.floor(rand()*paired.length)];
   sum+=(r.reference-r.y)**2-(r.p-r.y)**2;
  }
  deltas.push(sum/paired.length);
 }
 deltas.sort((a,b)=>a-b);return [deltas[14],deltas[585]];
}
export function evaluateRollingFormHoldout(games,league){
 const cfg=CONFIG[league];
 if(!cfg)throw Error('Only NFL and NHL supported');
 const rows=buildFormStudyRows(games,league);
 const groups={train:rows.filter(x=>x.season<=2022),
  select:rows.filter(x=>x.season===2023),cal:rows.filter(x=>x.season===2024),
  holdout:rows.filter(x=>x.season===2025)};
 const counts=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length]));
 const output={league,version:FORM_VALIDATION_VERSION,counts,approved:false,
  modelActivated:false,source:'identical current-season rolling source, completed historical scores only',
  trainThrough:2022,selectionYear:2023,calibrationYear:2024,holdoutYear:2025};
 if(Object.keys(cfg).some(key=>counts[key]<cfg[key]))
  return {...output,status:'insufficient_sample'};
 const candidateSets=MODELS.map(keys=>{
  const model=fit(groups.train,keys);
  const m=scoreForecasts(groups.select.map(r=>({y:r.y,p:predict(r,model,keys)})));
  return {keys,model,selectionBrier:m.brier};
 }).sort((a,b)=>a.selectionBrier-b.selectionBrier||a.keys.length-b.keys.length);
 const chosen=candidateSets[0];
 const cal=calibrate(groups.cal,groups.cal.map(r=>predict(r,chosen.model,chosen.keys)));
 const ref=calibrateRecordModel(games,league).reviewManifest;
 if(!ref)return {...output,status:'missing_record_benchmark'};
 const recordRows=reconstructRecordSnapshots(games,league);
 const byId=new Map(recordRows.filter(x=>x.season===2025).map(x=>[x.gameId,x]));
 const paired=groups.holdout.map(r=>{
  const source=byId.get(r.gameId);if(!source)throw Error('Holdout benchmark mismatch '+r.gameId);
  return {y:r.y,p:predict(r,chosen.model,chosen.keys,cal),reference:benchmark(source,ref)};
 });
 const metric=scoreForecasts(paired);
 const reference=scoreForecasts(paired.map(r=>({y:r.y,p:r.reference})));
 const gain=reference.brier-metric.brier,ci=bootstrapGain(paired);
 const formCoverage=groups.holdout.filter(x=>x.validRecentForm).length/groups.holdout.length;
 const checks={coverage:formCoverage>=.6,calibration:metric.ece<=.055&&Math.abs(metric.bias)<=.045,
  incrementalGain:gain>=.001&&ci[0]>0&&metric.logLoss<reference.logLoss};
 const approved=Object.values(checks).every(Boolean);
 return {...output,status:approved?'holdout_passed_pending_live_gate':'not_promoted',approved,
  selectedFeatures:chosen.keys,modelSelection:candidateSets.map(s=>({keys:s.keys,brier:s.selectionBrier})),
  checks,formCoverage,holdout:{candidate:metric,recordBenchmark:reference,brierGain:gain,paired95GainCI:ci},
  proposedCoefficients:approved?{model:chosen.model,calibrator:cal}:null,
  caveat:'No advanced quarterback/receiver/goalie factors, no sportsbook market baseline and no joint parlay calibration.'};
}
