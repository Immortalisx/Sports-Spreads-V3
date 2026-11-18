/**
 * Offline research-only recency study. No network, paid feeds, odds or live weights.
 * Game results are applied AFTER all same-date forecasts have been constructed.
 * Season-form windows reset at season boundaries; prior seasons influence Elo only
 * in the separately evaluated baseline from buildPregameRows.
 */
import {buildPregameRows, brier, logLoss, ece} from './retrospective-model.mjs';
export const RECENCY_VERSION='recency-research-v1';
const LEAGUES=['nfl','nba','nhl'];
const HALFLIVES={nfl:[2,4,8,16],nba:[3,6,12,24],nhl:[3,6,12,24]};
const SHRINK=[4,8,16,32];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-20,20)));
const logit=p=>Math.log(clamp(p,.0001,.9999)/(1-clamp(p,.0001,.9999)));
const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const metric=rows=>({n:rows.length,brier:brier(rows),logLoss:logLoss(rows),ece:ece(rows)});
const key=(r,side)=>r.season+':'+r[side+'Team'];
export function recencySnapshots(games,league,halfLife){
 if(!LEAGUES.includes(league)||!Number.isFinite(halfLife)||halfLife<=0)throw Error('Unsupported recency study');
 const prior=buildPregameRows(games,league);
 const originals=new Map(games.filter(r=>r.league===league).map(r=>[r.gameId,r]));
 const history=new Map(),out=[];
 for(let i=0;i<prior.length;){
  const date=prior[i].gameDate,batch=[];
  while(i<prior.length&&prior[i].gameDate===date)batch.push(prior[i++]);
  for(const r of batch){
   const effective=side=>{
    const h=history.get(key(r,side))||[];
    let wins=0,weight=0;
    for(let j=0;j<h.length;j++){
     const w=Math.pow(.5,(h.length-1-j)/halfLife);
     wins+=h[j]*w;weight+=w;
    }
    return {wins,weight,n:h.length};
   };
   const home=effective('home'),away=effective('away');
   out.push({...r,recency:{home,away},asOfDate:date,
    provenance:'completed results strictly earlier than forecast calendar date'});
  }
  for(const r of batch){
   const original=originals.get(r.gameId);
   if(!original)throw Error('Missing completed game');
   for(const [side,won] of [['home',r.y],['away',1-r.y]]){
    const k=key(r,side),h=history.get(k)||[];
    h.push(won);history.set(k,h);
   }
  }
 }
 return out;
}
function estimate(r,shrink,strength){
 const {home,away}=r.recency;
 const ph=(home.wins+shrink/2)/(home.weight+shrink);
 const pa=(away.wins+shrink/2)/(away.weight+shrink);
 return clamp(sigmoid(logit(r.baseline)+strength*(logit(ph)-logit(pa))),.02,.98);
}
function scored(rows,params){
 return rows.map(r=>({gameId:r.gameId,gameDate:r.gameDate,y:r.y,
  p:estimate(r,params.shrink,params.strength),base:r.baseline}));
}
function blockBootstrap(rows,seed=6119){
 // Resample game dates, not individual same-day fixtures, to avoid overstating precision.
 const groups=new Map();
 for(const r of rows){const a=groups.get(r.gameDate)||[];a.push(r);groups.set(r.gameDate,a);}
 const dates=[...groups.keys()],differences=[];
 let state=seed|0;
 const random=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
 for(let b=0;b<500;b++){
  let sum=0,n=0;
  for(let j=0;j<dates.length;j++){
   const sample=groups.get(dates[Math.floor(random()*dates.length)]);
   for(const r of sample){sum+=(r.base-r.y)**2-(r.p-r.y)**2;n++;}
  }
  differences.push(sum/n);
 }
 differences.sort((a,b)=>a-b);
 return [differences[12],differences[487]];
}
export function validateRecency(games,league){
 if(!LEAGUES.includes(league))throw Error('Supported leagues: nfl, nba, nhl');
 if(!Array.isArray(games)||games.some(r=>r.league===league&&r.simulated===true))
  return {league,status:'invalid_input',promotionAllowed:false};
 const seasons=[...new Set(games.filter(r=>r.league===league).map(r=>Number(r.season)))].sort((a,b)=>a-b);
 const report={league,version:RECENCY_VERSION,seasons,source:'completed historical game results, earlier dates only',
  promotionAllowed:false,notice:'Research only. Not calibrated live betting probabilities or parlay confidence.'};
 if(seasons.length<4)return {...report,status:'insufficient_seasons'};
 const all=new Map(HALFLIVES[league].map(h=>[h,recencySnapshots(games,league,h)]));
 const validationSeason=seasons.at(-2),holdoutSeason=seasons.at(-1);
 const valid=all.get(HALFLIVES[league][0]).filter(r=>Number(r.season)===validationSeason);
 const test=all.get(HALFLIVES[league][0]).filter(r=>Number(r.season)===holdoutSeason);
 const minimum={nfl:125,nba:500,nhl:450}[league];
 if(valid.length<minimum||test.length<minimum)return {...report,status:'insufficient_games',
  counts:{validation:valid.length,holdout:test.length},minimum};
 // Parameter selection is made exclusively on the penultimate season.
 // Strength 0 is the exact existing Elo baseline and is always a candidate.
 const candidates=[];
 for(const halfLife of HALFLIVES[league])for(const shrink of SHRINK)for(const strength of [0,.1,.2,.35,.5]){
  const rows=all.get(halfLife).filter(r=>Number(r.season)===validationSeason);
  const score=metric(scored(rows,{shrink,strength}));
  candidates.push({halfLife,shrink,strength,validation:score});
 }
 candidates.sort((a,b)=>a.validation.brier-b.validation.brier||
  a.validation.logLoss-b.validation.logLoss||a.strength-b.strength);
 const chosen=candidates[0];
 // Additional rolling-origin diagnostic: each eligible season is predicted
 // using a choice tuned only on its immediately preceding season.
 const rolling=[];
 for(let k=2;k<seasons.length;k++){
  const selectionSeason=seasons[k-1],evaluationSeason=seasons[k];
  const priorCandidates=[];
  for(const halfLife of HALFLIVES[league])for(const shrink of SHRINK)for(const strength of [0,.1,.2,.35,.5]){
   const tune=all.get(halfLife).filter(r=>Number(r.season)===selectionSeason);
   if(tune.length<minimum)continue;
   const m=metric(scored(tune,{shrink,strength}));
   priorCandidates.push({halfLife,shrink,strength,brier:m.brier,loss:m.logLoss});
  }
  priorCandidates.sort((a,b)=>a.brier-b.brier||a.loss-b.loss||a.strength-b.strength);
  if(!priorCandidates.length)continue;
  const pick=priorCandidates[0];
  const evaluatedFold=scored(all.get(pick.halfLife).filter(r=>Number(r.season)===evaluationSeason),pick);
  if(evaluatedFold.length<minimum)continue;
  rolling.push({selectedOn:selectionSeason,evaluatedOn:evaluationSeason,n:evaluatedFold.length,
   halfLifeGames:pick.halfLife,priorEquivalentGames:pick.shrink,logOddsStrength:pick.strength,
   baseline:metric(evaluatedFold.map(r=>({p:r.base,y:r.y}))),
   candidate:metric(evaluatedFold)});
 }
 const holdout=all.get(chosen.halfLife).filter(r=>Number(r.season)===holdoutSeason);
 const evaluated=scored(holdout,chosen);
 const baseline=metric(evaluated.map(r=>({p:r.base,y:r.y})));
 const candidate=metric(evaluated);
 const ci=blockBootstrap(evaluated);
 const gain=baseline.brier-candidate.brier;
 return {...report,status:'research_only',validationSeason,holdoutSeason,
  counts:{validation:valid.length,holdout:test.length},rolling,chosen:{
   halfLifeGames:chosen.halfLife,priorEquivalentGames:chosen.shrink,logOddsStrength:chosen.strength,
   validation:chosen.validation},holdout:{baseline,candidate,brierGain:gain,gameDateBlockBootstrap95:ci},
  reviewOnly:gain>=.002&&ci[0]>0&&candidate.ece<=.05&&candidate.logLoss<baseline.logLoss,
  warning:'Selection uses validation season; holdout untouched. Additional rolling seasons, point-in-time sources and prospective verification required before live use.'};
}
