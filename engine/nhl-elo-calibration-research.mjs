/**
 * Research-only official NHL time-split probability calibration.
 *
 * Elo history: 2022-23 & 2023-24 (2,624 games).
 * Calibration FIT: 2024-25 (1,312 games).
 * Diagnostic evaluation: 2025-26 (1,312, previously inspected in PR #49).
 * Genuinely untouched prospective holdout: future 2026-27 matches only after
 * predictions are archived strictly before puck drop; NO future logs are loaded.
 *
 * Fixed, predeclared ridge-logistic (Platt) adjustment. No hyperparameter search
 * on evaluation labels, no production changes, network, provider, odds or ROI.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildPregameRows,brier,logLoss,ece} from './retrospective-model.mjs';
import {validateNhlHistory} from './run-nhl-walkforward.mjs';

const load=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const oldDefault=load('../tests/fixtures/nhl-2022-2024-regular-results.json');
const newDefault=load('../tests/fixtures/nhl-2024-2026-regular-results.json');
const expected={
  20222023:['2022-10-07','2023-04-13'],
  20232024:['2023-10-10','2024-04-18']
};
const ARIZONA_ERA_TEAMS='ANA,ARI,BOS,BUF,CAR,CBJ,CGY,CHI,COL,DAL,DET,EDM,FLA,LAK,MIN,MTL,NJD,NSH,NYI,NYR,OTT,PHI,PIT,SEA,SJS,STL,TBL,TOR,VAN,VGK,WPG,WSH'.split(',');
export const CALIBRATION_RULES=Object.freeze({
  method:'predeclared_regularized_platt',
  fitSeason:20242025,holdoutSeason:20252026,
  iterationCount:1600,learningRate:.25,interceptPenalty:.03,slopePenalty:.03,
  minimumFitGames:1312,
  coefficientLimits:[-1.5,1.5],slopeLimits:[.25,2.5],
  freezeBeforeDate:'2025-10-07'
});
const q=(p)=>Math.log(p/(1-p));
const logistic=(z)=>1/(1+Math.exp(-Math.max(-25,Math.min(25,z))));
const mean=a=>a.length?a.reduce((v,x)=>v+x,0)/a.length:null;
const round=(v)=>v===null?null:Number(v.toFixed(6));
const EMPTY={status:'not_testable',promotionAllowed:false,calibration:null,comparison:null,games:[]};

export function validateEarlierNhlHistory(source){
 if(!Array.isArray(source?.rows)||source.rows.length!==2624)return {ok:false,reason:'missing_2022_24_history'};
 const ids=new Set(),seasonMap=new Map();
 for(const r of source.rows){
  if(!Array.isArray(r)||r.length!==7)return {ok:false,reason:'bad_earlier_row'};
  const [id,season,date,home,away,hs,as]=r;
  if(!expected[season]||!Number.isSafeInteger(id)||typeof date!=='string'
   ||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))
   ||new Date(date).toISOString().slice(0,10)!==date
   ||date<expected[season][0]||date>expected[season][1]
   ||!ARIZONA_ERA_TEAMS.includes(home)||!ARIZONA_ERA_TEAMS.includes(away)||home===away
   ||!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||hs===as)
   return {ok:false,reason:'invalid_earlier_game'};
  const prefix=Number(String(season).slice(0,4)+'02');
  const ix=Number(String(id).slice(-4));
  if(Math.floor(id/10000)!==prefix||ix<1||ix>1312||ids.has(id))
   return {ok:false,reason:'earlier_game_id_mismatch'};
  ids.add(id);
  const by=seasonMap.get(season)||{n:0,appearances:new Map(),dates:[]};
  by.n++;by.dates.push(date);
  by.appearances.set(home,(by.appearances.get(home)||0)+1);
  by.appearances.set(away,(by.appearances.get(away)||0)+1);
  seasonMap.set(season,by);
 }
 for(const [season,[first,last]] of Object.entries(expected)){
  const by=seasonMap.get(Number(season));
  if(!by||by.n!==1312||by.appearances.size!==32
   ||ARIZONA_ERA_TEAMS.some(t=>by.appearances.get(t)!==82)
   ||by.dates.reduce((a,b)=>a<b?a:b)!==first
   ||by.dates.reduce((a,b)=>a>b?a:b)!==last)
   return {ok:false,reason:'incomplete_earlier_season'};
  for(let i=1;i<=1312;i++)
   if(!ids.has(Number(season.slice(0,4)+'02'+String(i).padStart(4,'0'))))
    return {ok:false,reason:'missing_earlier_official_game_id'};
 }
 return {ok:true,priorTrainingGames:2624,seasons:[20222023,20232024],priorGamesPerTeam:164};
}

/** Frozen Platt fit on validation season ONLY; intercept/slope priors 0 and 1. */
export function fitFrozenPlatt(validationRows){
 if(!Array.isArray(validationRows)||validationRows.length!==CALIBRATION_RULES.minimumFitGames
   ||validationRows.some(r=>r.season!==20242025||!(r.baseline>0&&r.baseline<1)
     ||![0,1].includes(r.y)))throw Error('Calibration requires complete 2024-25 only');
 const {iterationCount,learningRate,interceptPenalty,slopePenalty,coefficientLimits,slopeLimits}=CALIBRATION_RULES;
 let intercept=0,slope=1;
 // Average penalized cross entropy; no evaluation or holdout data consulted.
 for(let iteration=0;iteration<iterationCount;iteration++){
  let ga=0,gb=0;
  for(const r of validationRows){
   const logOdds=q(r.baseline),p=logistic(intercept+slope*logOdds),e=p-r.y;
   ga+=e;gb+=e*logOdds;
  }
  ga=ga/validationRows.length+interceptPenalty*intercept;
  gb=gb/validationRows.length+slopePenalty*(slope-1);
  intercept=Math.max(coefficientLimits[0],Math.min(coefficientLimits[1],intercept-learningRate*ga));
  slope=Math.max(slopeLimits[0],Math.min(slopeLimits[1],slope-learningRate*gb));
 }
 return {intercept,slope,...CALIBRATION_RULES,fitGames:validationRows.length,fitLastDate:'2025-04-17'};
}
export const applyFrozenPlatt=(raw,fit)=>logistic(fit.intercept+fit.slope*q(raw));

function metrics(rows,key){
 const x=rows.map(r=>({p:r[key],y:r.homeWin}));
 const wins=rows.filter(r=>(r[key]>=.5)===Boolean(r.homeWin)).length;
 return {n:rows.length,correct:wins,accuracy:wins/rows.length,
  brier:brier(x),logLoss:logLoss(x),ece10:ece(x,10),
  meanForecast:mean(rows.map(r=>r[key])),actualHomeWins:mean(rows.map(r=>r.homeWin))};
}
function bins(rows,key){
 return Array.from({length:10},(_,i)=>{
  const xs=rows.filter(r=>Math.min(9,Math.floor(r[key]*10))===i);
  const forecast=mean(xs.map(r=>r[key])),observed=mean(xs.map(r=>r.homeWin));
  return {from:i/10,to:(i+1)/10,n:xs.length,meanForecast:forecast,observedHomeWin:observed,
   absoluteGap:forecast===null?null:Math.abs(forecast-observed)};
 });
}
/** Paired date-cluster bootstrap; uncertainty, not proof of an edge. */
function dayBootstrap(rows,iterations=1000,seed=20261118){
 const byDate=new Map();
 for(const r of rows){
  const bucket=byDate.get(r.date)||{n:0,delta:0};
  bucket.n++;bucket.delta+=(r.rawHomeProbability-r.homeWin)**2-(r.calibratedHomeProbability-r.homeWin)**2;
  byDate.set(r.date,bucket);
 }
 const clusters=[...byDate.values()],n=clusters.length,values=[];
 let state=seed|0;
 function uniform(){state=(Math.imul(1664525,state)+1013904223)|0;return (state>>>0)/4294967296;}
 for(let i=0;i<iterations;i++){
  let count=0,sum=0;
  for(let j=0;j<n;j++){
   const x=clusters[Math.floor(uniform()*n)];count+=x.n;sum+=x.delta;
  }
  values.push(sum/count);
 }
 values.sort((a,b)=>a-b);
 return {method:'paired_game_date_cluster_bootstrap',replicates:iterations,gameDates:n,
  brierGain95CI:[values[Math.floor(.025*iterations)],values[Math.floor(.975*iterations)]]};
}
function toGames(source,sourceTag){
 return source.rows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nhl-'+id,league:'nhl',season,gameDate,homeTeam,awayTeam,homeScore,awayScore,
  sourceUrl:source.sourceUrls?.[(season===20222023||season===20242025)?0:1]||'',
  sourceTier:'official_public',dataset:sourceTag
 }));
}
export function runNhlCalibrationResearch({earlier=oldDefault,later=newDefault}={}){
 const historical=validateEarlierNhlHistory(earlier),recent=validateNhlHistory(later);
 if(!historical.ok||!recent.ok)return {...EMPTY,reason:!historical.ok?historical.reason:recent.reason};
 const games=[...toGames(earlier,'historical_training'),...toGames(later,'calibration_and_diagnostic')];
 const all=buildPregameRows(games,'nhl');
 const fitRows=all.filter(r=>r.season===20242025);
 const evaluation=all.filter(r=>r.season===20252026);
 if(fitRows.length!==1312||evaluation.length!==1312)throw Error('missing calibration/evaluation games');
 if(fitRows.some(r=>r.gameDate>=CALIBRATION_RULES.freezeBeforeDate)
   ||evaluation.some(r=>r.gameDate<CALIBRATION_RULES.freezeBeforeDate))throw Error('time split violation');
 const fit=fitFrozenPlatt(fitRows);
 const rows=evaluation.map(r=>{
  if(r.evidence.through!==null&&r.evidence.through>=r.gameDate)throw Error('same-day leakage');
  const raw=r.baseline,calibrated=applyFrozenPlatt(raw,fit);
  return {gameId:r.gameId,date:r.gameDate,home:r.homeTeam,away:r.awayTeam,
   rawHomeProbability:raw,calibratedHomeProbability:calibrated,
   homeWin:r.y,rawPredictedWinner:raw>=.5?r.homeTeam:r.awayTeam,
   calibratedPredictedWinner:calibrated>=.5?r.homeTeam:r.awayTeam,
   actualWinner:r.y?r.homeTeam:r.awayTeam,
   rawCorrect:(raw>=.5)===Boolean(r.y),calibratedCorrect:(calibrated>=.5)===Boolean(r.y),
   rawBrier:(raw-r.y)**2,calibratedBrier:(calibrated-r.y)**2,
   priorEvidenceThrough:r.evidence.through};
 });
 const baseline=metrics(rows,'rawHomeProbability'),candidate=metrics(rows,'calibratedHomeProbability');
 const fitValidation=fitRows.map(r=>({homeWin:r.y,rawHomeProbability:r.baseline,
  calibratedHomeProbability:applyFrozenPlatt(r.baseline,fit)}));
 const validationScores={
  baseline:metrics(fitValidation,'rawHomeProbability'),
  calibrated:metrics(fitValidation,'calibratedHomeProbability')
 };
 const improvement=baseline.brier-candidate.brier;
 const ci=dayBootstrap(rows);
 const comparison={
  status:'already_inspected_2025_26_exploratory_diagnostic_NOT_independent_holdout',
  evaluationSeason:20252026,
  evaluationGames:rows.length,baseline,calibrated:candidate,
  brierGain:improvement,brierGainRelative:improvement/baseline.brier,
  accuracyGain:candidate.accuracy-baseline.accuracy,
  uncertainty:ci,
  calibrationBins:{baseline:bins(rows,'rawHomeProbability'),calibrated:bins(rows,'calibratedHomeProbability')},
  monthly:[...new Set(rows.map(r=>r.date.slice(0,7)))].sort().map(month=>{
   const group=rows.filter(r=>r.date.startsWith(month));
   return {month,n:group.length,baselineBrier:mean(group.map(x=>x.rawBrier)),
    calibratedBrier:mean(group.map(x=>x.calibratedBrier)),
    rawCorrect:group.filter(x=>x.rawCorrect).length,
    calibratedCorrect:group.filter(x=>x.calibratedCorrect).length};
  }),
  originalTwoSeasonEloBrierFromEarlierAudit:0.24893033405119727
 };
 return {status:'research_only',promotionAllowed:false,source:'Official NHL Stats REST pinned offline scores',
  splits:{eloHistoricalTrainingSeasons:[20222023,20232024],eloHistoricalTrainingGames:2624,
   calibrationFitSeason:20242025,calibrationFitGames:fitRows.length,
   calibrationFitLastDate:fit.fitLastDate,exploratoryEvaluationSeason:20252026,
   exploratoryEvaluationGames:rows.length,
   trulyUntouchedFutureHoldout:{season:20262027,startsNoEarlierThan:'2026-11-19',
    status:'reserved_not_scored',requirement:'Archived, timestamped forecast created before game start, with future outcomes separately appended only AFTER completion'}},
  calibration:{fit,validationScores},comparison,games:rows,
  limitations:'2025-26 already inspected in a previous baseline audit. Reusing it is exploratory, not a pristine independent holdout. No future 2026-27 data, goalie history, injury snapshots, prices, or ROI. Retrospective game-final data reconstructs, but does not prove, actual historical pregame forecasts.'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const result=runNhlCalibrationResearch();
 if(process.argv.includes('--games'))console.log(JSON.stringify(result,null,2));
 else{
  const {games,...summary}=result;
  console.log('NHL_ELO_CALIBRATION_REPORT '+JSON.stringify(summary));
 }
}
