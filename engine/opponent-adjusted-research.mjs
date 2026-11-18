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
