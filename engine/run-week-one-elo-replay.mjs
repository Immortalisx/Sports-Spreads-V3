/** Research-only retrospective Elo replay. No network and no invented historical records.
 * Uses the real buildPregameRows baseline; excludes target-day outcomes from
 * all training features. Missing source history fails closed per league.
 */
import {readFileSync} from 'node:fs';
import {buildPregameRows} from './retrospective-model.mjs';
const read=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const nfl=read('../tests/fixtures/nfl-2024-2025-regular-results.json');
const targets=read('../tests/fixtures/week-one-2026-results.json');
export function runWeekOneElo({historicalNfl=nfl,fixtures=targets}={}){
 const history=historicalNfl.rows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nfl-'+id,league:'nfl',season,gameDate,homeTeam,awayTeam,homeScore,awayScore,
  sourceUrl:'https://github.com/nflverse/nfldata/blob/master/data/games.csv',sourceTier:'community_public'
 }));
 const result=[];
 for(const target of fixtures){
  const date=target.start.slice(0,10);
  if(target.league!=='nfl'){
   result.push({league:target.league,gameId:target.gameId,status:'not_testable',reason:'missing_verified_prior_season_game_logs',actual:{home:target.homeScore,away:target.awayScore}});
   continue;
  }
  const prior=history.filter(x=>x.gameDate<date);
  const seenHome=prior.some(x=>x.homeTeam===target.home||x.awayTeam===target.home);
  const seenAway=prior.some(x=>x.homeTeam===target.away||x.awayTeam===target.away);
  if(!seenHome||!seenAway||new Set(prior.map(x=>x.season)).size<2){
   result.push({league:target.league,gameId:target.gameId,status:'not_testable',reason:'insufficient_verified_team_history'});
   continue;
  }
  if(prior.some(x=>x.gameDate>=date))throw Error('lookahead data');
  const game={gameId:target.gameId,league:'nfl',season:2026,gameDate:date,homeTeam:target.home,awayTeam:target.away,homeScore:target.homeScore,awayScore:target.awayScore,sourceUrl:target.resultSource,sourceTier:'official_public'};
  const rows=buildPregameRows([...prior,game],'nfl');
  const row=rows.find(x=>x.gameId===game.gameId);
  if(!row)throw Error('target not found');
  const p=row.baseline,y=Number(target.homeScore>target.awayScore);
  result.push({league:'nfl',gameId:target.gameId,status:'retrospective_scored',model:'research-evaluation-v0.1 Elo baseline',trainingGames:prior.length,trainingThrough:prior.at(-1)?.gameDate,
   predictedWinner:p>=.5?target.home:target.away,homeWinProbability:p,actualWinner:y?target.home:target.away,
   correct:(p>=.5)===Boolean(y),brier:(p-y)**2,actual:{home:target.homeScore,away:target.awayScore},promotionAllowed:false});
 }
 const scored=result.filter(x=>x.status==='retrospective_scored');
 return {status:'research_only',promotionAllowed:false,results:result,summary:{scored:scored.length,total:result.length,winnerAccuracy:scored.length?scored.filter(x=>x.correct).length/scored.length:null,brier:scored.length?scored.reduce((s,x)=>s+x.brier,0)/scored.length:null},
  caveat:'Retrospective Elo reconstruction, not an archived pregame prediction; one game cannot establish calibration.'};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)console.log(JSON.stringify(runWeekOneElo(),null,2));
