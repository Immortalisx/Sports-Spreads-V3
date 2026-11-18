/**
 * Historical opponent-adjusted matchup factors. Research-only, no network.
 * Only completed-game scoreboards are used. Every same-calendar-day fixture
 * is forecast BEFORE any result from that day updates the state.
 * These are not NFL scheme, NBA lineup/pace or NHL confirmed-goalie features.
 */
import {buildPregameRows} from './retrospective-model.mjs';
export const OPPONENT_VERSION='opponent-history-research-v1';
const LEAGUES=new Set(['nfl','nba','nhl']);
const SCALE={nfl:21,nba:18,nhl:2.5};
const HALF_LIFE={nfl:4,nba:8,nhl:8};
const bounded=(v,a,b)=>Math.max(a,Math.min(b,v));
const teamKey=(r,side)=>String(r.season)+':'+r[side+'Team'];
const shrinkWin=(s)=>(s.wins+4)/(s.games+8);
function weighted(history,halfLife){
 let sum=0,weight=0;
 for(let i=0;i<history.length;i++){
  const w=Math.pow(.5,(history.length-1-i)/halfLife);
  sum+=w*history[i];weight+=w;
 }
 return {mean:weight?sum/weight:0,effectiveGames:weight};
}
export function opponentAdjustedRows(games,league,{halfLife=HALF_LIFE[league]}={}){
 if(!LEAGUES.has(league)||!Number.isFinite(halfLife)||halfLife<=0)throw Error('Unsupported opponent adjustment');
 const rows=buildPregameRows(games,league);
 const byId=new Map(games.filter(x=>x.league===league).map(x=>[x.gameId,x]));
 const seasonRecords=new Map(),adjusted=new Map(),result=[];
 const record=k=>seasonRecords.get(k)||{wins:0,games:0};
 const samples=k=>adjusted.get(k)||{win:[],margin:[],scoring:[]};
 for(let i=0;i<rows.length;){
  const date=rows[i].gameDate,batch=[];
  while(i<rows.length&&rows[i].gameDate===date)batch.push(rows[i++]);
  // Capture opponent records and all features before applying today's finals.
  const pending=[];
  for(const r of batch){
   const h=teamKey(r,'home'),a=teamKey(r,'away');
   const hs=samples(h),as=samples(a);
   const hWin=weighted(hs.win,halfLife),aWin=weighted(as.win,halfLife);
   const hMargin=weighted(hs.margin,halfLife),aMargin=weighted(as.margin,halfLife);
   const hScoring=weighted(hs.scoring,halfLife),aScoring=weighted(as.scoring,halfLife);
   const minGames=Math.min(hs.win.length,as.win.length);
   const coverage={homeGames:hs.win.length,awayGames:as.win.length,minimumGames:minGames};
   result.push({...r,opponentFactors:{
    // Positive means stronger prior schedule-adjusted performance at home.
    opponentAdjustedForm:minGames>=3?bounded((hWin.mean-aWin.mean)*2,-2,2):null,
    // Per-game score margin relative to opponents' pregame win shares.
    opponentAdjustedMargin:minGames>=5?bounded(hMargin.mean-aMargin.mean,-2,2):null,
    // Offense against the opposing team's earlier defensive scoreboard trend;
    // descriptive only, not NBA possessions or NHL xG.
    scoringMatchup:minGames>=5?bounded(hScoring.mean-aScoring.mean,-2,2):null
   },opponentCoverage:coverage,opponentProvenance:{
    method:'prior completed game outcomes and scoreboard margins only',
    asOfDate:date,sourceUrls:[...new Set([r.sourceUrl])],
    advancedUnavailable:['nfl_qb_blitz','nfl_coverage','nba_possessions','nba_verified_lineups','nhl_confirmed_goalie','nhl_xg'],
    modelWeight:null,validated:false}});
   pending.push({r,h,a,homePrior:shrinkWin(record(h)),awayPrior:shrinkWin(record(a))});
  }
  for(const {r,h,a,homePrior,awayPrior} of pending){
   const raw=byId.get(r.gameId);
   if(!raw)throw Error('Missing source game');
   const hWin=r.y,aWin=1-r.y;
   // Expected win probability from the opponent's record BEFORE this date.
   const hExpected=1-awayPrior,aExpected=1-homePrior;
   const homeMargin=bounded((raw.homeScore-raw.awayScore)/SCALE[league],-3,3);
   const homeScore=bounded((raw.homeScore-raw.awayScore)/(2*SCALE[league]),-2,2);
   for(const [k,won,expected,margin,score] of [
    [h,hWin,hExpected,homeMargin,homeScore],
    [a,aWin,aExpected,-homeMargin,-homeScore]]){
    const s=samples(k);s.win.push(won-expected);
    s.margin.push(margin-(expected-.5)*2);
    s.scoring.push(score-(expected-.5));
    adjusted.set(k,s);
    const rec=record(k);rec.wins+=won;rec.games++;seasonRecords.set(k,rec);
   }
  }
 }
 return result;
}

/**
 * Validation-season tuning only. Scores an untouched later-season holdout.
 * Reconstructed prior-game scoreboard evidence is not an archived live feed.
 */
export function evaluateOpponentFactors(games,league){
 if(!LEAGUES.has(league))throw Error('Unsupported league');
 const supported=new Set(['official_public','community_public','official','licensed','independently_verified','attributed_public']);
 const relevant=games.filter(r=>r.league===league);
 const verified=relevant.length>0&&relevant.every(r=>supported.has(r.sourceTier)&&
  /^https:\/\//.test(r.sourceUrl||'')&&r.simulated!==true);
 const out={league,version:OPPONENT_VERSION,status:'research_only',promotionAllowed:false,
  verifiedSourceMetadata:verified,notice:'Only reconstructed prior completed scoreboards; no archived pregame starters, defensive scheme, pace or goalie confirmation.'};
 if(!verified)return {...out,status:'unverified_source_metadata'};
 const seasons=[...new Set(relevant.map(r=>Number(r.season)))].sort((a,b)=>a-b);
 if(seasons.length<4)return {...out,status:'insufficient_seasons',seasons};
 const rows=opponentAdjustedRows(relevant,league);
 const validationSeason=seasons.at(-2),holdoutSeason=seasons.at(-1);
 const validation=rows.filter(r=>Number(r.season)===validationSeason);
 const holdout=rows.filter(r=>Number(r.season)===holdoutSeason);
 const min={nfl:125,nba:500,nhl:450}[league];
 if(validation.length<min||holdout.length<min)return {...out,status:'insufficient_games',validationGames:validation.length,holdoutGames:holdout.length};
 const candidates=[];
 const probability=(r,feature,strength)=>{
  const raw=r.opponentFactors[feature];
  if(raw===null||strength===0)return r.baseline;
  const p=bounded(r.baseline,.02,.98);
  const z=Math.log(p/(1-p))+strength*raw;
  return bounded(1/(1+Math.exp(-z)),.02,.98);
 };
 const measure=(set,feature,strength)=>{
  const scored=set.map(r=>({p:probability(r,feature,strength),y:r.y}));
  const brier=scored.reduce((s,r)=>s+(r.p-r.y)**2,0)/scored.length;
  const logLoss=scored.reduce((s,r)=>s-r.y*Math.log(r.p)-(1-r.y)*Math.log(1-r.p),0)/scored.length;
  return {n:scored.length,brier,logLoss,featureCoverage:set.filter(r=>r.opponentFactors[feature]!==null).length/set.length};
 };
 for(const feature of ['opponentAdjustedForm','opponentAdjustedMargin','scoringMatchup']){
  for(const strength of [0,.1,.2,.35]){
   const metrics=measure(validation,feature,strength);
   candidates.push({feature,strength,validation:metrics});
  }
 }
 candidates.sort((a,b)=>a.validation.brier-b.validation.brier||
  a.validation.logLoss-b.validation.logLoss||a.strength-b.strength);
 const selected=candidates[0];
 const baseline=measure(holdout,selected.feature,0);
 const candidate=measure(holdout,selected.feature,selected.strength);
 return {...out,validationSeason,holdoutSeason,selected,holdout:{baseline,candidate,
  brierGain:baseline.brier-candidate.brier},
  reviewOnly:false,reason:'Historical evaluation only; paired uncertainty and prospective source equivalence still required.'};
}
