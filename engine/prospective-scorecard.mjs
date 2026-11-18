/**
 * Read-only prospective scorecard for the private sports_model_vs_market_audit view.
 * Does not fetch paid odds, change model weights, or promote a live model.
 * Input: JSON rows exported privately from the audit view AFTER games are final.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {scoreForecasts} from './calibrate-record-model.mjs';

const MIN_PAIRS=Object.freeze({nba:500,mlb:800});
const WINDOW_MS=90*60*1000;
const time=x=>Date.parse(String(x||''));
const probability=x=>Number(x);
const finiteProbability=x=>Number.isFinite(probability(x))&&probability(x)>=.02&&probability(x)<=.98;
const average=values=>values.reduce((s,n)=>s+n,0)/values.length;

function validOutcome(row,league){
 if(!row||row.league!==league||row.simulated===true||row.sourceTier==='synthetic')return false;
 if(!/^[0-9]{6,15}$/.test(String(row.game_id||'')))return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(row.game_date||'')))return false;
 if(row.model_version!=='record-holdout-2025-v1'||![0,1].includes(Number(row.actual_home_win)))return false;
 const start=time(row.game_start),model=time(row.model_as_of);
 return Number.isFinite(start)&&Number.isFinite(model)&&model<start&&finiteProbability(row.model_home_probability);
}
function validMarket(row){
 const model=time(row.model_as_of),market=time(row.market_as_of),start=time(row.game_start);
 return Number.isFinite(market)&&market<=model&&market>=model-WINDOW_MS&&market<start&&
  finiteProbability(row.market_home_probability)&&Number(row.book_count)>=1;
}
function bootstrapPairedGain(rows,iterations=600){
 // Cluster resampling by game date, to avoid treating games on the same night
 // as entirely independent. Fixed seed makes audit results reproducible.
 const byDay=new Map();
 for(const r of rows){
  const date=r.game_date;
  if(!byDay.has(date))byDay.set(date,[]);
  byDay.get(date).push(r);
 }
 const days=[...byDay.values()];let seed=28091;
 const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const gains=[];
 for(let i=0;i<iterations;i++){
  let sum=0,count=0;
  for(let j=0;j<days.length;j++){
   const batch=days[Math.floor(rand()*days.length)];
   for(const r of batch){sum+=(r.market-r.y)**2-(r.model-r.y)**2;count++;}
  }
  gains.push(sum/count);
 }
 gains.sort((a,b)=>a-b);
 return [gains[Math.floor(iterations*.025)],gains[Math.floor(iterations*.975)]];
}

export function prospectiveScorecard(rows,league,options={}){
 if(!Object.hasOwn(MIN_PAIRS,league))throw Error('Prospective model comparison only supports NBA and MLB record estimates');
 if(!Array.isArray(rows))throw Error('Expected private prospective audit rows');
 const unique=new Set(),valid=[],paired=[];
 let rejected=0,duplicates=0,invalidMarket=0;
 for(const r of rows){
  if(r?.league!==league)continue;
  if(!validOutcome(r,league)){rejected++;continue;}
  const id=r.league+':'+r.game_id+':'+r.game_date;
  if(unique.has(id)){duplicates++;continue;}
  unique.add(id);
  const y=Number(r.actual_home_win),model=probability(r.model_home_probability);
  valid.push({p:model,y});
  if(r.market_home_probability!==null&&r.market_home_probability!==undefined){
   if(validMarket(r))paired.push({game_date:r.game_date,game_start:r.game_start,model,market:probability(r.market_home_probability),y});
   else invalidMarket++;
  }
 }
 const sample=scoreForecasts(valid);
 const coverage=valid.length?paired.length/valid.length:0;
 const minimum=options.minPairs??MIN_PAIRS[league];
 const requiredSpanDays=options.minSpanDays??90;
 const requiredCoverage=options.minCoverage??.70;
 const base={league,version:'prospective-record-v1',status:'awaiting_final_results',
  approved:false,eligibleForManualReview:false,completedGames:valid.length,pairedMarketGames:paired.length,
  marketCoverage:coverage,rejectedRows:rejected,duplicateRows:duplicates,invalidMarketRows:invalidMarket,
  modelAllFinals:sample,minimumPairedGames:minimum,requiredSpanDays,
  note:'Only completed, pregame archived NBA/MLB record-only forecasts. Never a verified player-prop, parlay, or betting ROI score.'};
 if(!valid.length)return base;
 if(!paired.length)return {...base,status:'awaiting_contemporaneous_market'};
 const model=scoreForecasts(paired.map(r=>({p:r.model,y:r.y})));
 const market=scoreForecasts(paired.map(r=>({p:r.market,y:r.y})));
 const gain=market.brier-model.brier;
 const dates=paired.map(r=>time(r.game_start));
 const spanDays=(Math.max(...dates)-Math.min(...dates))/86400000;
 const ci=bootstrapPairedGain(paired);
 let status='research_only';
 if(paired.length<minimum)status='insufficient_paired_sample';
 else if(spanDays<requiredSpanDays)status='insufficient_time_span';
 else if(coverage<requiredCoverage)status='insufficient_market_coverage';
 else if(gain>=.002&&ci[0]>0&&model.logLoss<market.logLoss&&model.ece<=.06&&
  Math.abs(model.bias)<=.045)status='manual_review_candidate';
 return {...base,status,eligibleForManualReview:status==='manual_review_candidate',
  modelPaired:model,marketPaired:market,brierGainAgainstMarket:gain,
  bootstrap95PercentGainInterval:ci,spanDays,assessment:'No automatic model promotion. Independent source and statistical review required.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2],league=process.argv[3];
 if(!file||!league){console.error('Usage: node engine/prospective-scorecard.mjs audit.json nba|mlb');process.exitCode=2;}
 else{
  try{console.log(JSON.stringify(prospectiveScorecard(JSON.parse(readFileSync(file,'utf8')),league),null,2));}
  catch(e){console.error(String(e));process.exitCode=1;}
 }
}
