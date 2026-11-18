/** Research-only retrospective Elo replay. No network and no invented historical records.
 * Uses the real buildPregameRows baseline; excludes target-day outcomes from
 * all training features. Missing source history fails closed per league.
 */
import {readFileSync} from 'node:fs';
import {buildPregameRows} from './retrospective-model.mjs';
const read=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const nfl=read('../tests/fixtures/nfl-2024-2025-regular-results.json');
const nba=read('../tests/fixtures/nba-2024-2026-regular-results.json');
const nhl=read('../tests/fixtures/nhl-2024-2026-regular-results.json');
const targets=read('../tests/fixtures/week-one-2026-results.json');
export function runWeekOneElo({historicalNfl=nfl,historicalNba=nba,historicalNhl=nhl,fixtures=targets}={}){
 const history=historicalNfl.rows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nfl-'+id,league:'nfl',season,gameDate,homeTeam,awayTeam,homeScore,awayScore,
  sourceUrl:'https://github.com/nflverse/nfldata/blob/master/data/games.csv',sourceTier:'community_public'
 }));
 const nbaHistory=historicalNba.rows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({gameId:'nba-'+id,league:'nba',season,gameDate,homeTeam,awayTeam,homeScore,awayScore,sourceUrl:historicalNba.sourceUrl,sourceTier:'community_public'}));
 const nhlRows=Array.isArray(historicalNhl?.rows)?historicalNhl.rows:[];
 const nhlVerified=nhlRows.length===2624 && [20242025,20252026].every(season=>nhlRows.filter(r=>r[1]===season).length===1312)
  && new Set(nhlRows.map(r=>r[0])).size===2624
  && nhlRows.every(r=>r.length===7 && /^202[45]-\d{2}-\d{2}$/.test(r[2])
   && Number.isInteger(r[5]) && Number.isInteger(r[6]) && r[5]>=0 && r[6]>=0
   && r[5]!==r[6] && r[3]!==r[4] && /^[A-Z]{2,4}$/.test(r[3]) && /^[A-Z]{2,4}$/.test(r[4]));
 const nhlHistory=nhlVerified?nhlRows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nhl-'+id,league:'nhl',season,gameDate,homeTeam,awayTeam,homeScore,awayScore,
  sourceUrl:historicalNhl.sourceUrls?.[0]||'',sourceTier:'official_public'
 })):[];
 const result=[];
 for(const target of fixtures){
  const date=target.start.slice(0,10);
  if(target.league==='nhl'&&!nhlVerified){
   result.push({league:target.league,gameId:target.gameId,status:'not_testable',reason:'incomplete_or_invalid_official_nhl_history',actual:{home:target.homeScore,away:target.awayScore}});
   continue;
  }
  const prior=(target.league==='nba'?nbaHistory:target.league==='nhl'?nhlHistory:history).filter(x=>x.gameDate<date);
  const seenHome=prior.some(x=>x.homeTeam===target.home||x.awayTeam===target.home);
  const seenAway=prior.some(x=>x.homeTeam===target.away||x.awayTeam===target.away);
  if(!seenHome||!seenAway||new Set(prior.map(x=>x.season)).size<2){
   result.push({league:target.league,gameId:target.gameId,status:'not_testable',reason:'insufficient_verified_team_history'});
   continue;
  }
  if(prior.some(x=>x.gameDate>=date))throw Error('lookahead data');
  const game={gameId:target.gameId,league:target.league,season:target.league==='nba'?2027:target.league==='nhl'?20262027:2026,gameDate:date,homeTeam:target.home,awayTeam:target.away,homeScore:target.homeScore,awayScore:target.awayScore,sourceUrl:target.resultSource,sourceTier:'official_public'};
  const rows=buildPregameRows([...prior,game],target.league);
  const row=rows.find(x=>x.gameId===game.gameId);
  if(!row)throw Error('target not found');
  const p=row.baseline,y=Number(target.homeScore>target.awayScore);
  result.push({league:target.league,gameId:target.gameId,status:'retrospective_scored',model:'research-evaluation-v0.1 Elo baseline',trainingGames:prior.length,trainingThrough:prior.at(-1)?.gameDate,
   predictedWinner:p>=.5?target.home:target.away,homeWinProbability:p,actualWinner:y?target.home:target.away,
   correct:(p>=.5)===Boolean(y),brier:(p-y)**2,actual:{home:target.homeScore,away:target.awayScore},promotionAllowed:false});
 }
 const scored=result.filter(x=>x.status==='retrospective_scored');
 return {status:'research_only',promotionAllowed:false,results:result,summary:{scored:scored.length,total:result.length,winnerAccuracy:scored.length?scored.filter(x=>x.correct).length/scored.length:null,brier:scored.length?scored.reduce((s,x)=>s+x.brier,0)/scored.length:null},
  caveat:'Retrospective Elo reconstruction, not an archived pregame prediction; one game cannot establish calibration.'};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)console.log(JSON.stringify(runWeekOneElo(),null,2));
