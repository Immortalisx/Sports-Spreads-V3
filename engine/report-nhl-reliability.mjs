/**
 * Research-only NHL reliability report. This is a deterministic READ-ONLY view
 * of pinned 2022-26 official scores and an independently checked frozen model.
 * No API calls, model fitting, production imports, paid providers or deployment.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runIndependentAudit} from './audit-nhl-calibration-independent.mjs';

const read=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const old=read('../tests/fixtures/nhl-2022-2024-regular-results.json');
const newer=read('../tests/fixtures/nhl-2024-2026-regular-results.json');
const sum=items=>items.reduce((acc,x)=>acc+x,0);
const mean=items=>items.length?sum(items)/items.length:null;
const close=(a,b)=>Math.abs(a-b)<=1e-11;

/** Wilson interval for an observed binary rate, not a forecast confidence interval. */
export function wilson95(wins,n){
 if(!Number.isInteger(n)||n<0||!Number.isInteger(wins)||wins<0||wins>n)
  throw Error('invalid_wilson_counts');
 if(!n)return null;
 const z=1.95996398454,p=wins/n,z2=z*z,denom=1+z2/n;
 const center=(p+z2/(2*n))/denom;
 const half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/denom;
 return [Math.max(0,center-half),Math.min(1,center+half)];
}
const sampleFlag=n=>n===0?'empty':n<30?'very_small':n<100?'limited':'moderate_or_larger';
function assertRows(rows,season){
 if(!Array.isArray(rows)||rows.length!==1312)throw Error('missing_verified_season_rows');
 const ids=new Set();
 for(const r of rows){
  if(r.season!==season||!Number.isSafeInteger(r.id)||ids.has(r.id)
   ||typeof r.date!=='string'||typeof r.home!=='string'
   ||typeof r.away!=='string'||r.home===r.away
   ||![0,1].includes(r.y)||!(r.p>0&&r.p<1)||!(r.cal>0&&r.cal<1))
   throw Error('invalid_research_probability_rows');
  ids.add(r.id);
 }
}
function binRows(rows,key,perspective){
 const length=perspective==='home'?10:5;
 return Array.from({length},(_,i)=>{
  const from=(perspective==='home'?0:.5)+.1*i,to=from+.1;
  const subset=rows.filter(r=>{
   const probability=perspective==='home'?r[key]:Math.max(r[key],1-r[key]);
   return perspective==='home'?
    Math.min(9,Math.floor(probability*10))===i:
    Math.min(4,Math.max(0,Math.floor((probability-.5)*10)))===i;
  });
  const n=subset.length;
  const successes=sum(subset.map(r=>perspective==='home'?r.y:
   r[key]>=.5?r.y:1-r.y));
  const probabilities=subset.map(r=>perspective==='home'?r[key]:Math.max(r[key],1-r[key]));
  const averageProbability=mean(probabilities),observed=n?successes/n:null;
  return {from,to,n,successes,averageProbability,observed,
   absoluteGap:n?Math.abs(averageProbability-observed):null,
   observedWilson95:wilson95(successes,n),sampleFlag:sampleFlag(n)};
 });
}
const brier=(rows,fn)=>mean(rows.map(r=>(fn(r)-r.y)**2));
function describeYear(rows,season,priorRate,auditWindow){
 assertRows(rows,season);
 if(!(priorRate>=0&&priorRate<=1))throw Error('invalid_prior_home_rate');
 const benchmarks={
  always50PercentBrier:brier(rows,()=>.5),
  precedingSeasonHomeWinRate:priorRate,
  precedingSeasonHomeRateBrier:brier(rows,()=>priorRate),
  alwaysPickHomeAccuracy:mean(rows.map(r=>r.y)),
  provenance:'preceding complete regular season only, fixed BEFORE evaluation season'
 };
 const models={};
 for(const [name,key] of [['raw','p'],['calibrated','cal']]){
  const homeTeamBins=binRows(rows,key,'home'),favoriteConfidenceBins=binRows(rows,key,'favorite');
  const n=rows.length,correct=sum(rows.map(r=>Number((r[key]>=.5)===Boolean(r.y))));
  const bs=brier(rows,r=>r[key]);
  const eceHome10=sum(homeTeamBins.map(b=>b.n/n*(b.absoluteGap||0)));
  const eceFavorite5=sum(favoriteConfidenceBins.map(b=>b.n/n*(b.absoluteGap||0)));
  models[name]={
   n,correct,accuracy:correct/n,brier:bs,eceHome10,eceFavorite5,
   averagePredictedHomeWin:mean(rows.map(r=>r[key])),
   actualHomeWinRate:mean(rows.map(r=>r.y)),
   brierSkillVsAlways50:1-bs/benchmarks.always50PercentBrier,
   brierSkillVsPriorHome:1-bs/benchmarks.precedingSeasonHomeRateBrier,
   homeTeamBins,favoriteConfidenceBins
  };
  const original=auditWindow[name==='raw'?'raw':'cal'];
  if(!close(bs,original.brier)||!close(eceHome10,original.ece10)||correct!==original.correct)
   throw Error('independent_audit_crosscheck_failed');
 }
 return {
  season,seasonRole:season===20242025?'chronological_validation':'previously_inspected_exploratory_NOT_independent',
  games:rows.length,benchmarks,models,
  comparison:{
   brierGainRawMinusCalibrated:models.raw.brier-models.calibrated.brier,
   correctWinnerDifferenceCalMinusRaw:models.calibrated.correct-models.raw.correct
  }
 };
}
export function buildNhlReliabilityDiagnostics({
 audit=runIndependentAudit({includeRows:true}),
 older=old,later=newer
}={}){
 if(audit?.status!=='research_only_independent_audit'||audit.promotionAllowed!==false
  ||audit.checks?.futureProspective2026_27!=='NOT_SCORED'
  ||audit.checks?.previouslyInspected2025_26!==true
  ||audit.fit?.fitSeason!==20232024||audit.fit?.fitN!==1312)
  throw Error('invalid_or_unfrozen_research_audit');
 assertRows(audit.rowSets?.validation,20242025);
 assertRows(audit.rowSets?.diagnostic,20252026);
 const precedingHomeRate=(fixture,year)=>{
  const games=fixture?.rows?.filter(r=>r[1]===year);
  if(!games||games.length!==1312||games.some(r=>r[5]===r[6]))
   throw Error('missing_preceding_season_benchmark');
  return games.filter(r=>r[5]>r[6]).length/1312;
 };
 const seasons=[
  describeYear(audit.rowSets.validation,20242025,precedingHomeRate(older,20232024),audit.validation),
  describeYear(audit.rowSets.diagnostic,20252026,precedingHomeRate(later,20242025),audit.exploratory)
 ];
 return {
  status:'research_only',promotionAllowed:false,modelCoefficientsUnchanged:true,
  source:'pinned official 2022-26 NHL final scores; independent read-only Elo/Platt replay',
  trainSeason:20222023,fitSeason:20232024,
  validationSeason:20242025,inspectedSeason:20252026,
  futureProspective20262027:'NOT_LOADED_OR_SCORED',
  fitReadOnly:{intercept:audit.fit.intercept,slope:audit.fit.slope},
  definitions:{
   homeBins:'10 fixed-width home-team forecast probability bins from 0% to 100%',
   favoriteBins:'5 fixed-width bins for the model-predicted winner confidence, from 50% to 100%',
   observedWilson95:'Nominal two-sided 95% Wilson confidence interval of observed win fraction, NOT confidence in the forecast',
   eceHome10:'Sum(n/N * absolute average forecast minus observed rate) over home bins',
   eceFavorite5:'Analogous descriptive favorite-confidence ECE on 5 favorite bins',
   brierSkill:'1 - model Brier / benchmark Brier; higher is better',
   note:'Reporting only; no new fit, tuned bins, live odds, or prospective forecasts. The 2025-26 outcomes were examined earlier.'
  },
  seasons
 };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])
 console.log('NHL_RELIABILITY_DIAGNOSTICS '+JSON.stringify(buildNhlReliabilityDiagnostics()));
