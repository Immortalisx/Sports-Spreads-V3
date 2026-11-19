/**
 * INDEPENDENT, READ-ONLY NHL calibration audit.
 * Reimplements the scoring arithmetic directly against four pinned official
 * game-log seasons; deliberately imports NEITHER retrospective-model nor
 * nhl-elo-calibration-research. No network, tuning, production, or paid APIs.
 *
 * 2022-23 prior history; 2023-24 Platt fit; 2024-25 separated validation;
 * 2025-26 ALREADY EXAMINED exploratory diagnosis (NOT pristine).
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const load=u=>JSON.parse(readFileSync(new URL(u,import.meta.url),'utf8'));
const old=load('../tests/fixtures/nhl-2022-2024-regular-results.json');
const recent=load('../tests/fixtures/nhl-2024-2026-regular-results.json');
const seasons=[20222023,20232024,20242025,20252026];
const sigmoid=z=>1/(1+Math.exp(-Math.max(-25,Math.min(25,z))));
const logit=p=>Math.log(p/(1-p));
const mean=a=>a.length?a.reduce((sum,x)=>sum+x,0)/a.length:null;
const round=x=>x===null?null:Number(x.toFixed(8));
function verifyFixture(rows){
 if(!Array.isArray(rows)||rows.length!==5248)throw Error('INDEPENDENT_AUDIT_INVALID_LENGTH');
 const seen=new Set();
 const counts=new Map(),appear=new Map();
 for(const [id,s,date,h,a,hs,as] of rows){
  if(!seasons.includes(s)||seen.has(id)||!Number.isInteger(id)||
   !/^\d{4}-\d{2}-\d{2}$/.test(date)||h===a||!Number.isInteger(hs)||
   !Number.isInteger(as)||hs<0||as<0||hs===as)
   throw Error('INDEPENDENT_AUDIT_INVALID_RECORD');
  seen.add(id);counts.set(s,(counts.get(s)||0)+1);
  const teams=appear.get(s)||new Map();
  teams.set(h,(teams.get(h)||0)+1);
  teams.set(a,(teams.get(a)||0)+1);
  appear.set(s,teams);
 }
 for(const s of seasons){
  if(counts.get(s)!==1312||appear.get(s).size!==32||[...appear.get(s).values()].some(n=>n!==82))
   throw Error('INDEPENDENT_AUDIT_INCOMPLETE_SEASON');
 }
 return {games:rows.length,bySeason:Object.fromEntries([...counts]),teamAppearances:82};
}
function replayChronologically(records){
 const ratings=new Map(),forecasts=[];
 let priorSeason=null,index=0;
 while(index<records.length){
  const date=records[index][2],batch=[];
  while(index<records.length&&records[index][2]===date)batch.push(records[index++]);
  const season=batch[0][1];
  if(priorSeason!==null&&season!==priorSeason)
   for(const [team,elo] of ratings)ratings.set(team,1500+(elo-1500)*.65);
  priorSeason=season;
  const pending=batch.map(([id,s,gameDate,home,away,hs,as])=>{
   const rh=ratings.get(home)??1500,ra=ratings.get(away)??1500;
   const p=sigmoid(Math.log(10)*(rh+28-ra)/400);
   return {id,season:s,date:gameDate,home,away,y:Number(hs>as),rh,ra,p};
  });
  forecasts.push(...pending.map(({id,season,date,home,away,y,p})=>({id,season,date,home,away,y,p})));
  // ALL same-day games forecast BEFORE ANY same-day result updates Elo
  for(const row of pending){
   const delta=16*(row.y-row.p);
   ratings.set(row.home,row.rh+delta);
   ratings.set(row.away,row.ra-delta);
  }
 }
 return forecasts;
}
function fitOnly202324(forecasts){
 const fit=forecasts.filter(g=>g.season===20232024);
 if(fit.length!==1312||fit.some(g=>!(g.p>0&&g.p<1)))throw Error('INDEPENDENT_AUDIT_BAD_FIT');
 let intercept=0,slope=1;
 for(let step=0;step<1600;step++){
  let da=0,db=0;
  for(const {p,y} of fit){
   const x=logit(p),error=sigmoid(intercept+slope*x)-y;
   da+=error;db+=error*x;
  }
  intercept=Math.max(-1.5,Math.min(1.5,intercept-.25*(da/fit.length+.03*intercept)));
  slope=Math.max(.25,Math.min(2.5,slope-.25*(db/fit.length+.03*(slope-1))));
 }
 return {intercept,slope,fitSeason:20232024,fitN:fit.length};
}
const wilson=(success,n)=>{
 if(!n)return null;
 const z=1.95996398454,p=success/n,k=1+z*z/n;
 const mid=(p+z*z/(2*n))/k;
 const half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/k;
 return [Math.max(0,mid-half),Math.min(1,mid+half)];
};
function buckets(gameRows,key){
 return Array.from({length:10},(_,i)=>{
  const xs=gameRows.filter(g=>Math.min(9,Math.floor(g[key]*10))===i);
  const observed=mean(xs.map(g=>g.y)),forecast=mean(xs.map(g=>g[key]));
  return {from:i/10,to:(i+1)/10,n:xs.length,homeWins:xs.reduce((s,g)=>s+g.y,0),
   meanForecast:forecast,observed,absoluteGap:xs.length?Math.abs(observed-forecast):null,
   observedWilson95:wilson(xs.reduce((s,g)=>s+g.y,0),xs.length)};
 });
}
function metrics(rows,key){
 const n=rows.length,bins=buckets(rows,key),correct=rows.filter(r=>(r[key]>=.5)===!!r.y).length;
 return {n,correct,accuracy:correct/n,
  brier:mean(rows.map(r=>(r[key]-r.y)**2)),
  logLoss:mean(rows.map(r=>-(r.y*Math.log(r[key])+(1-r.y)*Math.log(1-r[key])))),
  ece10:bins.reduce((s,b)=>s+(b.n/n)*(b.absoluteGap??0),0),
  forecastHomeWinRate:mean(rows.map(r=>r[key])),
  actualHomeWinRate:mean(rows.map(r=>r.y)),
  bins};
}
export function runIndependentAudit({earlier=old,later=recent,includeRows=false}={}){
 const rows=[...earlier.rows,...later.rows];
 const integrity=verifyFixture(rows);
 const sorted=rows.slice().sort((a,b)=>a[2].localeCompare(b[2])||String(a[0]).localeCompare(String(b[0])));
 const pre=replayChronologically(sorted);
 const fit=fitOnly202324(pre);
 const check=season=>{
  const gameRows=pre.filter(r=>r.season===season).map(r=>({...r,cal:sigmoid(fit.intercept+fit.slope*logit(r.p))}));
  const raw=metrics(gameRows,'p'),cal=metrics(gameRows,'cal');
  return {season,n:gameRows.length,raw,cal,
   deltaBrier:raw.brier-cal.brier,
   deltaCorrect:cal.correct-raw.correct,
   fixed50Brier:.25,
   homePickAccuracy:raw.actualHomeWinRate,
   fixed50SkillRaw:(.25-raw.brier)/.25,
   fixed50SkillCal:(.25-cal.brier)/.25,
   topCalibratedBins:cal.bins.filter(b=>b.from>=.5&&b.n),
   homeTeamContinuityAlert:gameRows.filter(g=>g.home==='UTA'||g.away==='UTA').length,
   gameRows};
 };
 const validation=check(20242025),exploratory=check(20252026);
 const exportWindow=w=>{const {gameRows,...summary}=w;return summary;};
 return {status:'research_only_independent_audit',promotionAllowed:false,
  fixtureIntegrity:integrity,fit,validation:exportWindow(validation),
  exploratory:exportWindow(exploratory),
  // Optional research-only observation feed; default report output stays unchanged.
  // Raw and calibrated forecasts are computed by this same untouched audit.
  ...(includeRows?{rowSets:{
   validation:validation.gameRows.map(({id,season,date,home,away,y,p,cal})=>({id,season,date,home,away,y,p,cal})),
   diagnostic:exploratory.gameRows.map(({id,season,date,home,away,y,p,cal})=>({id,season,date,home,away,y,p,cal}))
  }}:{}),
  checks:{noFutureHoldoutLoaded:seasons.every(s=>s<=20252026),
   disjointSplit:[20222023,20232024,20242025,20252026],
   futureProspective2026_27:'NOT_SCORED',
   previouslyInspected2025_26:true,
   validation2024_25StrictlyLaterThanFit:true,
   noHyperparameterOptimizationInThisAudit:true,
   homeElo:28,kFactor:16,offseasonShrink:.65},
  caution:'Replicated fixed historic calculation only. 2025-26 has already been inspected. Small bins have wide sampling uncertainty; binned ECE alone does not validate pricing or betting confidence. Goalies/ARI->UTA continuity and actual pregame timestamps are not represented.'};
}
const direct=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(direct)console.log('NHL_INDEPENDENT_CALIBRATION_AUDIT '+JSON.stringify(runIndependentAudit()));
