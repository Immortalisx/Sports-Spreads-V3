/**
 * Batch 2: genuine NFL quarterback-vs-blitz / opposing-defense study.
 * Same 2022 training, 2023 selection, 2024 calibration, 2025 untouched holdout
 * for both models. No historical use of actual game's starter as pregame input.
 * FTN aggregates are not considered available until 3+ calendar days after game.
 * Research only; no change to public model or ticket confidence.
 */
import {buildFormStudyRows} from './validate-rolling-form.mjs';
import {scoreForecasts} from './calibrate-record-model.mjs';

export const NFL_BLITZ_HOLDOUT_VERSION='nfl-qb-blitz-incremental-v1';
const baseOptions=[
 ['record'],['record','elo'],['record','elo','form'],
 ['record','elo','form','momentum'],['record','elo','form','momentum','rest']
];
const clip=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const logistic=z=>1/(1+Math.exp(-clip(z,-25,25)));
const logit=p=>Math.log(clip(p,.0001,.9999)/(1-clip(p,.0001,.9999)));
const sum=(items,key)=>items.reduce((v,x)=>v+x[key],0);
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const cutoff=date=>new Date(Date.parse(date+'T00:00:00Z')-3*86400_000).toISOString().slice(0,10);
const baseline=(r,key)=>r.x[key]??0;

function featureForMatchup({team,opponent,priorGames,latestDate}){
 const history=priorGames.get(team)||[];
 const latest=history.at(-1);
 const qbEntry=latest?.qbs?.slice().sort((a,b)=>
  (b.blitzN+b.cleanN)-(a.blitzN+a.cleanN))[0];
 const quarterbackId=qbEntry?.qb||null;
 if(!quarterbackId)return {available:false,projectedQB:null,through:latestDate,
  reason:'No previous eligible passing-game starter'};
 const recent=history.slice(-8).flatMap(g=>g.qbs).filter(x=>x.qb===quarterbackId);
 const blz=sum(recent,'blitzN'),clean=sum(recent,'cleanN'),
  blzEPA=sum(recent,'blitzEpaSum'),cleanEPA=sum(recent,'cleanEpaSum');
 const defence=(priorGames.get(opponent)||[]).slice(-8).map(g=>g.defence).filter(Boolean);
 const total=sum(defence,'n'),passBlitz=sum(defence,'blitzN');
 const enough=blz>=12&&clean>=20&&total>=100;
 const qbB=blz?(blzEPA/(blz+20)):null; // 20 neutral prior reps = shrinkage
 const qbN=clean?(cleanEPA/(clean+25)):null;
 const rate=total?passBlitz/total:null;
 return {available:enough,projectedQB:quarterbackId,through:latestDate,
  games:recent.length,qbBlitzPlays:blz,qbNonBlitzPlays:clean,opponentPassPlays:total,
  qbEPAblitz:enough?qbB:null,qbEPAnonBlitz:enough?qbN:null,
  opponentBlitzRate:enough?rate:null,
  expectedEPA:enough?qbB*rate+qbN*(1-rate):null,
  interaction:enough?(qbB-qbN)*(rate-.27):null};
}
export function buildPregameBlitzStudyRows(data){
 if(!Array.isArray(data?.games)||!Array.isArray(data?.qbs)||!Array.isArray(data?.defenses))
  throw Error('Completed game ledger and real play-level aggregate sources required');
 const games=data.games.filter(x=>x.league==='nfl').sort((a,b)=>
  a.season-b.season||a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId));
 if(new Set(games.map(x=>x.gameId)).size!==games.length)throw Error('Duplicate NFL game result');
 const form=buildFormStudyRows(games,'nfl');
 const formMap=new Map(form.map(x=>[x.gameId,x]));
 const qbs=new Map(),defs=new Map();
 for(const q of data.qbs){
  if(!iso(q.date)||typeof q.qb!=='string'||!q.qb||!Number.isInteger(q.blitzN)||
   !Number.isInteger(q.cleanN)||q.blitzN<0||q.cleanN<0||
   !Number.isFinite(q.blitzEpaSum)||!Number.isFinite(q.cleanEpaSum))throw Error('Corrupt FTN QB aggregate');
  const k=q.gameId+'|'+q.team,arr=qbs.get(k)||[];
  arr.push(q);qbs.set(k,arr);
 }
 for(const d of data.defenses){
  if(!iso(d.date)||!Number.isInteger(d.n)||!Number.isInteger(d.blitzN)||
   d.n<0||d.blitzN<0||d.blitzN>d.n)throw Error('Corrupt FTN defense aggregate');
  const k=d.gameId+'|'+d.team;
  if(defs.has(k))throw Error('Duplicate FTN defense aggregate');
  defs.set(k,d);
 }
 const grouped=new Map();
 for(const g of games){
  const arr=grouped.get(g.season)||[];arr.push(g);grouped.set(g.season,arr);
 }
 const all=[];
 for(const [season,seasonGames] of grouped){
  const prior=new Map();
  let lastUpdate=null,cursor=0;
  const append=(team,info)=>{
   const arr=prior.get(team)||[];arr.push(info);prior.set(team,arr);
  };
  for(const game of seasonGames){
   const cap=cutoff(game.gameDate);
   while(cursor<seasonGames.length&&seasonGames[cursor].gameDate<=cap){
    const finished=seasonGames[cursor++];
    for(const team of [finished.homeTeam,finished.awayTeam]){
     append(team,{date:finished.gameDate,qbs:qbs.get(finished.gameId+'|'+team)||[],
      defence:defs.get(finished.gameId+'|'+team)||null});
    }
    lastUpdate=finished.gameDate;
   }
   const h=featureForMatchup({team:game.homeTeam,opponent:game.awayTeam,priorGames:prior,latestDate:lastUpdate});
   const a=featureForMatchup({team:game.awayTeam,opponent:game.homeTeam,priorGames:prior,latestDate:lastUpdate});
   const usable=h.available&&a.available;
   const f=formMap.get(game.gameId);
   if(!f)throw Error('Missing matched rolling-form game '+game.gameId);
   if(lastUpdate&&lastUpdate>=game.gameDate)throw Error('Postgame charting leakage');
   const actual=(team)=>{
    const arr=qbs.get(game.gameId+'|'+team)||[];
    return arr.length?arr.slice().sort((x,y)=>
      (y.blitzN+y.cleanN)-(x.blitzN+x.cleanN))[0].qb:null;
   };
   all.push({...f,
    x:{...f.x,
     qbBlitzInteraction:usable?clip(h.interaction-a.interaction,-1.8,1.8):0,
     qbEPAExpectation:usable?clip(h.expectedEPA-a.expectedEPA,-2,2):0},
    blitz:{available:usable,home:h,away:a,
     homeProjectedQbCorrect:h.projectedQB?actual(game.homeTeam)===h.projectedQB:null,
     awayProjectedQbCorrect:a.projectedQB?actual(game.awayTeam)===a.projectedQB:null,
     maxDataDate:lastUpdate,releaseCutoff:cap},
   });
  }
 }
 return all;
}
function fit(rows,keys){
 let intercept=0,weights=keys.map(()=>0);
 if(rows.length<200)throw Error('At least 200 training games required');
 for(let t=0;t<530;t++){
  let g0=0;const gs=keys.map(()=>0);
  for(const r of rows){
   const error=logistic(intercept+keys.reduce((s,k,j)=>s+weights[j]*baseline(r,k),0))-r.y;
   g0+=error;for(let j=0;j<keys.length;j++)gs[j]+=error*baseline(r,keys[j]);
  }
  intercept=clip(intercept-.20*(g0/rows.length+.007*intercept),-2,2);
  for(let j=0;j<keys.length;j++)weights[j]=clip(weights[j]-.20*(gs[j]/rows.length+.032*weights[j]),-4,4);
 }
 return {intercept,weights:Object.fromEntries(keys.map((k,j)=>[k,weights[j]]))};
}
function guess(r,model,keys,cal={intercept:0,slope:1}){
 const z=model.intercept+keys.reduce((acc,k)=>acc+model.weights[k]*baseline(r,k),0);
 return clip(logistic(cal.intercept+cal.slope*z),.02,.98);
}
function calibrate(rows,p){
 if(!rows.length||rows.length!==p.length)throw Error('Invalid calibration slice');
 let intercept=0,slope=1;
 for(let t=0;t<430;t++){
  let gi=0,gs=0;
  for(let i=0;i<rows.length;i++){
   const z=logit(p[i]),e=logistic(intercept+slope*z)-rows[i].y;
   gi+=e;gs+=e*z;
  }
  intercept=clip(intercept-.15*(gi/rows.length+.025*intercept),-.7,.7);
  slope=clip(slope-.15*(gs/rows.length+.025*(slope-1)),.6,1.5);
 }
 return {intercept,slope};
}
function choose(train,select,options){
 return options.map(keys=>{
  const model=fit(train,keys),score=scoreForecasts(select.map(r=>({p:guess(r,model,keys),y:r.y})));
  return {keys,model,selectionBrier:score.brier};
 }).sort((a,b)=>a.selectionBrier-b.selectionBrier||a.keys.length-b.keys.length)[0];
}
function pairedInterval(rows){
 let state=8421;const rand=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 const delta=[];
 for(let k=0;k<800;k++){
  let d=0;
  for(let n=0;n<rows.length;n++){
   const x=rows[Math.floor(rand()*rows.length)];
   d+=(x.base-x.y)**2-(x.extra-x.y)**2;
  }
  delta.push(d/rows.length);
 }
 delta.sort((a,b)=>a-b);return [delta[19],delta[779]];
}
export function evaluateQbBlitzHoldout(data){
 const rows=buildPregameBlitzStudyRows(data);
 const stages={train:rows.filter(r=>r.season===2022),
  selection:rows.filter(r=>r.season===2023),
  calibration:rows.filter(r=>r.season===2024),
  holdout:rows.filter(r=>r.season===2025)};
 const counts=Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,v.length]));
 const output={version:NFL_BLITZ_HOLDOUT_VERSION,league:'nfl',counts,
  trainingSeason:2022,selectionSeason:2023,calibrationSeason:2024,holdoutSeason:2025,
  publicModelModified:false,approved:false,
  source:'Actual nflverse play-by-play + FTN charted blitz plays (3-day source lag)',
  limitations:'QB is inferred from last available team game, not a verified upcoming starter. No verified man/zone coverages or injuries.'};
 if(Object.values(counts).some(n=>n<250))return {...output,status:'insufficient_completed_games'};
 const base=choose(stages.train,stages.selection,baseOptions);
 const extraOptions=[
  [...base.keys,'qbBlitzInteraction'],
  [...base.keys,'qbEPAExpectation'],
  [...base.keys,'qbBlitzInteraction','qbEPAExpectation']
 ];
 const advanced=choose(stages.train,stages.selection,extraOptions);
 const baseCal=calibrate(stages.calibration,stages.calibration.map(r=>guess(r,base.model,base.keys)));
 const extraCal=calibrate(stages.calibration,stages.calibration.map(r=>guess(r,advanced.model,advanced.keys)));
 const paired=stages.holdout.map(r=>({y:r.y,
  base:guess(r,base.model,base.keys,baseCal),
  extra:guess(r,advanced.model,advanced.keys,extraCal)}));
 const baseScore=scoreForecasts(paired.map(x=>({p:x.base,y:x.y})));
 const extraScore=scoreForecasts(paired.map(x=>({p:x.extra,y:x.y})));
 const gain=baseScore.brier-extraScore.brier,ci=pairedInterval(paired);
 const projections=stages.holdout.flatMap(r=>[
  r.blitz.homeProjectedQbCorrect,r.blitz.awayProjectedQbCorrect]).filter(x=>x!==null);
 const correct=projections.length?projections.filter(Boolean).length/projections.length:0;
 const coverage=stages.holdout.filter(r=>r.blitz.available).length/stages.holdout.length;
 const checks={sample:stages.holdout.length>=250,chartCoverage:coverage>=.5,
  projectedQuarterbackAccuracy:projections.length>=250&&correct>=.7,
  calibration:extraScore.ece<=.055&&Math.abs(extraScore.bias)<=.045,
  improvedBrier:gain>=.001&&ci[0]>0,
  improvedLogLoss:extraScore.logLoss<baseScore.logLoss};
 const approved=Object.values(checks).every(Boolean);
 return {...output,status:approved?'passed_research_only':'not_promoted',approved,
  selectedBaseFeatures:base.keys,selectedAdditionalFeatures:advanced.keys.filter(x=>!base.keys.includes(x)),
  sourceCoverage:{completeHoldoutGames:stages.holdout.length,
   qbsProjected:projections.length,qbProjectionAccuracy:correct,usableMatchups:coverage,
   joinBySeason:data.audit},
  holdout:{base:baseScore,enhanced:extraScore,brierGain:gain,bootstrap95GainCI:ci},
  checks,reviewWeights:approved?{base:base.model,advanced:advanced.model,calibration:extraCal}:null,
  note:'Research success does not permit deployment until current-season upstream QB/blitz feed and pregame starter confirmations are replicated and licensed.'};
}
