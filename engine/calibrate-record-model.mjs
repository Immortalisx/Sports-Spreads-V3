/**
 * STRICT OUT-OF-TIME calibration of the exact RECORD-ONLY feature used in the site.
 * Data: completed historical match results; only game scores from EARLIER dates
 * are used to build pregame records (no same-day leakage or archived odds needed).
 * This does NOT calibrate QB/blitz, injuries, player props, parlays or market edge.
 */
export const RECORD_CAL_VERSION='record-calibration-1.0';
const PRIOR_GRID=[6,12,20,32,48];
const MIN_HOLDOUT={nfl:125,nba:800,nhl:700,mlb:1200};
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const logit=p=>Math.log(clamp(p,.00001,.99999)/(1-clamp(p,.00001,.99999)));
const mean=arr=>arr.reduce((s,x)=>s+x,0)/Math.max(1,arr.length);
const identity=arr=>[...new Set(arr)].sort((a,b)=>a-b);
const key=(r,t)=>r.season+':'+r[t+'Team'];
function valid(r){
 return r&&['nfl','nba','nhl','mlb'].includes(r.league)&&
  Number.isInteger(r.season)&&/^\d{4}-\d{2}-\d{2}$/.test(r.gameDate||'')&&
  Number.isFinite(Date.parse(r.gameDate))&&r.homeTeam&&r.awayTeam&&r.homeTeam!==r.awayTeam&&
  typeof r.gameId==='string'&&r.gameId.length>0&&
  Number.isInteger(r.homeScore)&&Number.isInteger(r.awayScore)&&
  r.homeScore>=0&&r.awayScore>=0&&r.homeScore!==r.awayScore;
}
export function reconstructRecordSnapshots(games,league){
 if(!MIN_HOLDOUT[league]||!Array.isArray(games))throw Error('Invalid historical record study');
 const safe=games.filter(r=>r.league===league&&valid(r))
   .sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId));
 const ids=new Set(),team=new Map(),rows=[];
 for(let pos=0;pos<safe.length;){
  const date=safe[pos].gameDate,batch=[];
  while(pos<safe.length&&safe[pos].gameDate===date){const r=safe[pos++];if(ids.has(r.gameId))throw Error('Duplicate game ID');ids.add(r.gameId);batch.push(r);}
  // Important: collect EVERY forecast for this date before applying any result.
  for(const r of batch){
   const home=team.get(key(r,'home'))||{wins:0,games:0};
   const away=team.get(key(r,'away'))||{wins:0,games:0};
   rows.push({gameId:r.gameId,season:r.season,date:r.gameDate,league,homeTeam:r.homeTeam,awayTeam:r.awayTeam,
    homeWins:home.wins,homeGames:home.games,awayWins:away.wins,awayGames:away.games,
    y:r.homeScore>r.awayScore?1:0,priorDataThrough:home.games+away.games>0?'earlier game dates only':null});
  }
  for(const r of batch){
   const y=r.homeScore>r.awayScore?1:0;
   for(const [side,won] of [['home',y],['away',1-y]]){
    const k=key(r,side),st=team.get(k)||{wins:0,games:0};
    st.wins+=won;st.games+=1;team.set(k,st);
   }
  }
 }
 return rows;
}
export function recordFeature(r,prior){
 const hp=(r.homeWins+prior/2)/(r.homeGames+prior);
 const ap=(r.awayWins+prior/2)/(r.awayGames+prior);
 return logit(hp)-logit(ap);
}
function fitLogit(rows,feature,initial=[0,.65],iterations=600){
 let [a,b]=initial;
 if(!rows.length)throw Error('No model training rows');
 for(let i=0;i<iterations;i++){
  let ga=0,gb=0;
  for(const r of rows){const x=feature(r),diff=sigmoid(a+b*x)-r.y;ga+=diff;gb+=diff*x;}
  const step=.18;
  a=clamp(a-step*(ga/rows.length+.005*a),-2,2);
  b=clamp(b-step*(gb/rows.length+.008*(b-.7)),0,3.5);
 }
 return {intercept:a,slope:b};
}
const pFor=(r,prior,fit,cal={intercept:0,slope:1})=>{
 const raw=sigmoid(fit.intercept+fit.slope*recordFeature(r,prior));
 return clamp(sigmoid(cal.intercept+cal.slope*logit(raw)),.02,.98);
};
export function scoreForecasts(rows,bins=10){
 if(!rows.length)return {n:0,brier:null,logLoss:null,ece:null,bias:null,buckets:[]};
 const brier=mean(rows.map(x=>(x.p-x.y)**2));
 const loss=mean(rows.map(x=>-x.y*Math.log(clamp(x.p,1e-5,1-1e-5))-(1-x.y)*Math.log(clamp(1-x.p,1e-5,1-1e-5))));
 const buckets=[];
 for(let i=0;i<bins;i++){
  const q=rows.filter(r=>Math.min(bins-1,Math.floor(r.p*bins))===i);
  if(q.length)buckets.push({low:i/bins,high:(i+1)/bins,n:q.length,predicted:mean(q.map(x=>x.p)),observed:mean(q.map(x=>x.y))});
 }
 return {n:rows.length,brier,logLoss:loss,ece:buckets.reduce((s,b)=>s+b.n/rows.length*Math.abs(b.predicted-b.observed),0),
  bias:mean(rows.map(x=>x.p-x.y)),buckets};
}
function bootstrapDifference(rows,seed=2405){
 let x=seed;const rand=()=>((x=Math.imul(1664525,x)+1013904223|0)>>>0)/4294967296,means=[];
 for(let k=0;k<800;k++){let sum=0;for(let j=0;j<rows.length;j++){const r=rows[Math.floor(rand()*rows.length)];sum+=(r.homeOnly-r.y)**2-(r.p-r.y)**2;}means.push(sum/rows.length);}
 means.sort((a,b)=>a-b);return [means[19],means[779]];
}
export function calibrateRecordModel(games,league){
 const rows=reconstructRecordSnapshots(games,league),seasons=identity(rows.map(x=>x.season));
 const base={version:RECORD_CAL_VERSION,league,source:'historical completed scores only',games:rows.length,seasons,
  caveat:'Calibrates ONLY prior team W-L records and home advantage; not injuries, starters, opponents, player props, markets or parlays.'};
 if(seasons.length<3)return {...base,status:'insufficient_seasons',approved:false};
 const train=rows.filter(x=>x.season<seasons.at(-2));
 const valid=rows.filter(x=>x.season===seasons.at(-2));
 const holdout=rows.filter(x=>x.season===seasons.at(-1));
 const splits={trainSeasons:seasons.slice(0,-2),validationSeason:seasons.at(-2),holdoutSeason:seasons.at(-1),
  train:train.length,validation:valid.length,holdout:holdout.length};
 if(train.length<MIN_HOLDOUT[league]||valid.length<MIN_HOLDOUT[league]/2||holdout.length<MIN_HOLDOUT[league])
  return {...base,status:'insufficient_sample',approved:false,splits};
 // Hyperparameter selection uses validation only. It NEVER sees the holdout.
 const candidates=PRIOR_GRID.map(prior=>{
  const fit=fitLogit(train,r=>recordFeature(r,prior));
  const metrics=scoreForecasts(valid.map(r=>({p:pFor(r,prior,fit),y:r.y})));
  return {prior,fit,metrics};
 }).sort((a,b)=>a.metrics.brier-b.metrics.brier);
 const choice=candidates[0];
 const preCalibration=valid.map(r=>({y:r.y,z:logit(pFor(r,choice.prior,choice.fit))}));
 let cal=fitLogit(preCalibration,r=>r.z,[0,1],350);
 // Prevent extreme calibration corrections from one season.
 cal={intercept:clamp(cal.intercept,-.65,.65),slope:clamp(cal.slope,.65,1.4)};
 const baselineRate=(train.reduce((s,r)=>s+r.y,0)+4)/(train.length+8);
 const paired=holdout.map(r=>({y:r.y,p:pFor(r,choice.prior,choice.fit,cal),homeOnly:baselineRate}));
 const candidate=scoreForecasts(paired),baseline=scoreForecasts(paired.map(r=>({p:r.homeOnly,y:r.y})));
 const before=scoreForecasts(holdout.map(r=>({p:pFor(r,choice.prior,choice.fit),y:r.y})));
 const ci=bootstrapDifference(paired),gain=baseline.brier-candidate.brier;
 const manifest={league,version:RECORD_CAL_VERSION,trainedThrough:seasons.at(-2),holdoutSeason:seasons.at(-1),
  prior:choice.prior,intercept:choice.fit.intercept,slope:choice.fit.slope,
  calibrator:cal,source:'earlier-game team record W-L',trainedOn:train.length,calibratedOn:valid.length};
 const approved=holdout.length>=MIN_HOLDOUT[league]&&candidate.ece<=.06&&Math.abs(candidate.bias)<=.045&&
  gain>=.002&&ci[0]>0&&candidate.logLoss<baseline.logLoss;
 return {...base,status:approved?'historically_calibrated_record_only':'research_not_promoted',
  approved,splits,hyperparameterSelection:candidates.map(x=>({prior:x.prior,validationBrier:x.metrics.brier})),
  holdout:{baseline,candidate,uncalibrated:before,brierGain:gain,bootstrap95PercentGainInterval:ci},
  manifest:approved?manifest:null,reviewManifest:manifest,
  decision:approved?'PASS: record-only historical holdout calibration; other factors remain unvalidated':
   'FAIL: needs further holdout improvement; do not claim calibrated probabilities'};
}
