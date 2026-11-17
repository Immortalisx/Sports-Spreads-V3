/**
 * Cross-sport *retrospective research* using finished-game results only.
 * Derived pregame signals are built from strictly EARLIER calendar dates.
 * Actual historical pregame lineup/weather/odds snapshots remain unavailable.
 * No feature trained here can be deployed to the public betting interface.
 */
export const RESEARCH_VERSION='research-evaluation-v0.1';
const scales={nfl:23,nba:112,nhl:3.1,mlb:4.6};
const homeElo={nfl:55,nba:63,nhl:28,mlb:20};
const kFactor={nfl:25,nba:19,nhl:16,mlb:14};
const holdoutMinimum={nfl:125,nba:400,nhl:400,mlb:900};
const clamp=(x,l,h)=>Math.min(h,Math.max(l,x));
const sigmoid=z=>1/(1+Math.exp(-clamp(z,-25,25)));
const logit=p=>Math.log(clamp(p,.001,.999)/(1-clamp(p,.001,.999)));
const teamKey=(r,side)=>`${r.league}:${r[`${side}Team`]}`;
const seasonKey=(r,side)=>`${r.league}:${r.season}:${r[`${side}Team`]}`;
const coachKey=(a,b)=>[a,b].sort().join('::');
const seasonOf=r=>Number(r.season);
const freshState=()=>({w:0,n:0,forPoints:[],againstPoints:[],lastGame:null});
const average=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const dedup=p=>[...new Set(p)];
const validGame=r=>r&&['nfl','nba','nhl','mlb'].includes(r.league)&&Number.isInteger(Number(r.season))&&/^\d{4}-\d{2}-\d{2}$/.test(r.gameDate||'')&&r.gameId&&r.homeTeam&&r.awayTeam&&r.homeTeam!==r.awayTeam&&Number.isInteger(r.homeScore)&&Number.isInteger(r.awayScore)&&r.homeScore>=0&&r.awayScore>=0&&r.homeScore!==r.awayScore;
function winp(x){return (x.w+4)/(x.n+8);}
function addGame(stat,ptsFor,ptsAgainst,date,win){stat.w+=win;stat.n++;stat.lastGame=date;stat.forPoints.push(ptsFor);stat.againstPoints.push(ptsAgainst);if(stat.forPoints.length>12)stat.forPoints.shift();if(stat.againstPoints.length>12)stat.againstPoints.shift();}
export function buildPregameRows(games,league){
 if(!scales[league])throw Error('Unsupported sport');if(!Array.isArray(games))throw Error('Expected game records');
 const seen=new Set();const safe=games.filter(r=>validGame(r)&&r.league===league).sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||String(a.gameId).localeCompare(String(b.gameId)));
 for(const r of safe){if(seen.has(r.gameId))throw Error(`Duplicate game ID ${r.gameId}`);seen.add(r.gameId);}
 const elo=new Map(),seasonStats=new Map(),h2h=new Map();let currentSeason=null;
 function teamElo(key){return elo.get(key)??1500;}
 function history(key){return seasonStats.get(key)||freshState();}
 const output=[];
 for(let i=0;i<safe.length;){
  const day=safe[i].gameDate;const batch=[];while(i<safe.length&&safe[i].gameDate===day)batch.push(safe[i++]);
  // Entire batch is forecast with the previous day's state: no same-day
  // outcomes can leak into doubleheaders, evening games or injury proxies.
  if(currentSeason!==null&&currentSeason!==seasonOf(batch[0])){
   for(const [key,rating] of elo)elo.set(key,1500+(rating-1500)*.65);
  }
  currentSeason=seasonOf(batch[0]);
  const pending=[];
  for(const r of batch){
   const home=history(seasonKey(r,'home')),away=history(seasonKey(r,'away'));
   const homeE=teamElo(teamKey(r,'home')),awayE=teamElo(teamKey(r,'away'));
   const base=sigmoid(Math.log(10)*(homeE+homeElo[league]-awayE)/400);
   const homed=home.lastGame?(Date.parse(day)-Date.parse(home.lastGame))/86400000:null;
   const awayd=away.lastGame?(Date.parse(day)-Date.parse(away.lastGame))/86400000:null;
   const head=r.homeCoach&&r.awayCoach?h2h.get(coachKey(r.homeCoach,r.awayCoach)):null;
   const h2hValue=head&&head.n>=4?(2*(head.wins.get(r.homeCoach)||0)/head.n-1):null;
   let matchup=null;
   if(home.n>=5&&away.n>=5){
    const hpf=average(home.forPoints),hpa=average(home.againstPoints),apf=average(away.forPoints),apa=average(away.againstPoints);
    matchup=clamp(((hpf+apa)-(apf+hpa))/(2*scales[league]),-2,2);
   }
   const features={
    season_form:home.n>=3&&away.n>=3?clamp((winp(home)-winp(away))*2,-1,1):null,
    offense_defense:matchup,
    rest_days:homed!==null&&awayd!==null?clamp((Math.min(15,homed)-Math.min(15,awayd))/7,-2,2):null,
    coach_h2h:h2hValue,
    // These require separate verified pregame data. NEVER invent them.
    qb_blitz:null,coverage:null,verified_lineups:null,confirmed_goalie:null,pitcher_hitter:null
   };
   const snapshotThrough=home.lastGame&&away.lastGame?(home.lastGame>away.lastGame?home.lastGame:away.lastGame):home.lastGame||away.lastGame||null;
   const candidate={gameId:r.gameId,league,season:r.season,gameDate:day,homeTeam:r.homeTeam,awayTeam:r.awayTeam,sourceUrl:r.sourceUrl||'',sourceTier:r.sourceTier||'unknown',
    y:r.homeScore>r.awayScore?1:0,baseline:clamp(base,.02,.98),features,coverage:{homeGames:home.n,awayGames:away.n,coachPriorMeetings:head?.n||0},
    evidence:{method:'retrospective game-log reconstruction',through:snapshotThrough,retrospective:true}};
   output.push(candidate);pending.push({r,homeE,awayE,baseline:base});
  }
  for(const {r,homeE,awayE,baseline} of pending){
   const y=r.homeScore>r.awayScore?1:0;const delta=kFactor[league]*(y-baseline);
   elo.set(teamKey(r,'home'),homeE+delta);elo.set(teamKey(r,'away'),awayE-delta);
   const hkey=seasonKey(r,'home'),akey=seasonKey(r,'away');const h=history(hkey),a=history(akey);
   addGame(h,r.homeScore,r.awayScore,day,y);addGame(a,r.awayScore,r.homeScore,day,1-y);
   seasonStats.set(hkey,h);seasonStats.set(akey,a);
   if(r.homeCoach&&r.awayCoach){const key=coachKey(r.homeCoach,r.awayCoach);const previous=h2h.get(key)||{n:0,wins:new Map()};previous.n++;const winner=y?r.homeCoach:r.awayCoach;previous.wins.set(winner,(previous.wins.get(winner)||0)+1);h2h.set(key,previous);}
  }
 }
 return output;
}
export function brier(rows){return rows.length?rows.reduce((s,r)=>s+(r.p-r.y)**2,0)/rows.length:null;}
export function logLoss(rows){return rows.length?rows.reduce((s,r)=>s-(r.y*Math.log(clamp(r.p,.00001,.99999))+(1-r.y)*Math.log(clamp(1-r.p,.00001,.99999))),0)/rows.length:null;}
export function ece(rows,bins=10){if(!rows.length)return null;let sum=0;for(let i=0;i<bins;i++){const q=rows.filter(r=>Math.min(bins-1,Math.floor(r.p*bins))===i);if(q.length)sum+=q.length/rows.length*Math.abs(average(q.map(r=>r.p))-average(q.map(r=>r.y)));}return sum;}
function fitResidual(rows,features,lambda=.05){const weights=Array(features.length).fill(0);if(!rows.length)return weights;
 for(let i=0;i<300;i++){const grad=weights.map(()=>0);for(const r of rows){const x=features.map(k=>r.features[k]);const p=sigmoid(logit(r.baseline)+weights.reduce((s,w,j)=>s+w*x[j],0));for(let j=0;j<weights.length;j++)grad[j]+=(p-r.y)*x[j];}
  for(let j=0;j<weights.length;j++)weights[j]=clamp(weights[j]-.15*(grad[j]/rows.length+lambda*weights[j]),-2,2);
 }return weights;
}
function pWith(r,features,weights){return sigmoid(logit(r.baseline)+weights.reduce((s,w,j)=>s+w*r.features[features[j]],0));}
function fitCalibrator(rows){
 // Platt-style validation-only adjustment, with regularized intercept/slope.
 let a=0,b=1;for(let i=0;i<260;i++){
  let ga=0,gb=0;for(const r of rows){const x=logit(r.p),d=sigmoid(a+b*x)-r.y;ga+=d;gb+=d*x;}
  a=clamp(a-.08*(ga/rows.length+.015*a),-2,2);b=clamp(b-.08*(gb/rows.length+.015*(b-1)),.3,2.5);
 }return {intercept:a,slope:b};
}
const applyCalibration=(r,cal)=>({...r,p:sigmoid(cal.intercept+cal.slope*logit(r.p))});
function metrics(rows){return {n:rows.length,brier:brier(rows),logLoss:logLoss(rows),ece:ece(rows)};}
function confidenceIntervalPaired(rows,seed=5){let x=seed;const rand=()=>((x=Math.imul(1664525,x)+1013904223|0)>>>0)/4294967296;const means=[];
 for(let i=0;i<500;i++){let sum=0;for(let j=0;j<rows.length;j++){const r=rows[Math.floor(rand()*rows.length)];sum+=(r.base-r.y)**2-(r.p-r.y)**2;}means.push(sum/rows.length);}means.sort((a,b)=>a-b);return [means[12],means[487]];
}
export function evaluateRetrospective(games,league,{minHoldout=holdoutMinimum[league]}={}){
 const rows=buildPregameRows(games,league);const seasons=dedup(rows.map(r=>r.season)).sort((a,b)=>a-b);
 const out={version:RESEARCH_VERSION,league,status:'research_only',games:rows.length,seasons,sourceTiers:dedup(rows.map(r=>r.sourceTier)),
  advancedAvailability:{qb_blitz:0,coverage:0,confirmed_goalie:0,pitcher_hitter:0,verified_lineups:0},
  notice:'Retrospectively reconstructed from earlier final results; no archived pregame snapshots, sportsbook prices, official coaching effectiveness or player-vs-scheme data. Never publish these as validated betting probabilities.'};
 if(seasons.length<3)return {...out,status:'insufficient_seasons',required:3};
 const testSeason=seasons.at(-1),validationSeason=seasons.at(-2);
 const train=rows.filter(r=>r.season<validationSeason),valid=rows.filter(r=>r.season===validationSeason),test=rows.filter(r=>r.season===testSeason);
 out.split={trainSeasons:seasons.slice(0,-2),validationSeason,testSeason,train:train.length,validation:valid.length,holdout:test.length};
 if(train.length<minHoldout||valid.length<Math.ceil(minHoldout*.5)||test.length<minHoldout)return {...out,status:'insufficient_sample',requiredHoldout:minHoldout};
 const models=[['season_form'],['season_form','offense_defense'],['season_form','offense_defense','rest_days'],['season_form','offense_defense','rest_days','coach_h2h']];
 let candidates=[];
 for(const features of models){
  const trainSet=train.filter(r=>features.every(k=>r.features[k]!==null)),validationSet=valid.filter(r=>features.every(k=>r.features[k]!==null)),testSet=test.filter(r=>features.every(k=>r.features[k]!==null));
  if(trainSet.length<minHoldout||validationSet.length<Math.ceil(minHoldout*.25)||testSet.length<Math.ceil(minHoldout*.25))continue;
  const weights=fitResidual(trainSet,features);
  const validationPredict=validationSet.map(r=>({p:pWith(r,features,weights),y:r.y}));
  const baselineCal=fitCalibrator(validationSet.map(r=>({p:r.baseline,y:r.y})));
  const candidateCal=fitCalibrator(validationPredict);
  const valBaseline=metrics(validationSet.map(r=>applyCalibration({p:r.baseline,y:r.y},baselineCal)));
  const valCandidate=metrics(validationPredict.map(r=>applyCalibration(r,candidateCal)));
  candidates.push({features,weights,coverage:{train:trainSet.length,validation:validationSet.length,holdout:testSet.length,holdoutFraction:testSet.length/test.length},validationBrier:valCandidate.brier,validationBaselineBrier:valBaseline.brier,candidateCal,baselineCal});
 }
 out.candidates=candidates.map(x=>({features:x.features,coverage:x.coverage,validationBrier:x.validationBrier,validationBaselineBrier:x.validationBaselineBrier}));
 if(!candidates.length)return {...out,status:'insufficient_feature_coverage'};
 // Choose candidate based ONLY on validation performance; evaluate test once.
 candidates.sort((a,b)=>(a.validationBrier-a.validationBaselineBrier)-(b.validationBrier-b.validationBaselineBrier));
 const winner=candidates[0];const covered=test.filter(r=>winner.features.every(k=>r.features[k]!==null));
 const baseline=covered.map(r=>applyCalibration({p:r.baseline,y:r.y},winner.baselineCal));
 const predicted=covered.map(r=>applyCalibration({p:pWith(r,winner.features,winner.weights),y:r.y},winner.candidateCal));
 const paired=predicted.map((r,i)=>({...r,base:baseline[i].p}));const ci=confidenceIntervalPaired(paired);
 const baseMetrics=metrics(baseline),proposedMetrics=metrics(predicted);const gain=baseMetrics.brier-proposedMetrics.brier;
 return {...out,status:'research_only',selectedFeatures:winner.features,weights:winner.weights,
  coverage:winner.coverage,holdout:{baseline:baseMetrics,candidate:proposedMetrics,brierGain:gain,bootstrap95PercentGainInterval:ci},
  decision:gain>.002&&ci[0]>0&&proposedMetrics.ece<.05&&winner.coverage.holdoutFraction>=.75?'eligible_for_independent_review_only':'do_not_promote',
  promotionAllowed:false};
}
