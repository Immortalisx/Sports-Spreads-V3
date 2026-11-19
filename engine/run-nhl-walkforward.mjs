/**
 * NHL 2025-26 chronological walk-forward — research only.
 *
 * Offline official NHL game-log fixture; prior full 2024-25 season must exist
 * before predicting ANY 2025-26 game. Uses unchanged buildPregameRows Elo
 * pre-date/day-batch ordering; NEVER fit or tune on 2025-26 labels.
 * No providers, browser, secrets, production endpoints or paid APIs.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildPregameRows, brier, logLoss, ece} from './retrospective-model.mjs';

const fixture=JSON.parse(readFileSync(new URL('../tests/fixtures/nhl-2024-2026-regular-results.json',import.meta.url),'utf8'));
const seasons=[20242025,20252026];
const windows={
  20242025:['2024-10-04','2025-04-17'],
  20252026:['2025-10-07','2026-04-16']
};
const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const round=x=>x===null?null:Number(x.toFixed(6));
const flatRows=games=>games.map(g=>({p:g.homeWinProbability,y:g.homeWin}));

export function validateNhlHistory(dataset){
 const fail=reason=>({ok:false,reason});
 if(!Array.isArray(dataset?.rows)||dataset.rows.length!==2624)return fail('require_exact_2624_official_rows');
 const ids=new Set(),teamsBySeason=new Map(),appearanceBySeason=new Map(),datesBySeason=new Map();
 for(const row of dataset.rows){
  if(!Array.isArray(row)||row.length!==7)return fail('bad_row_shape');
  const [id,season,date,home,away,hs,as]=row;
  if(!seasons.includes(season)||!Number.isSafeInteger(id))return fail('invalid_season_or_id');
  const m=String(id).match(/^(2024|2025)02(\d{4})$/);
  if(!m||Number(m[1])!==Math.floor(season/10000)||Number(m[2])<1||Number(m[2])>1312)return fail('invalid_official_game_id');
  if(ids.has(id))return fail('duplicate_official_game_id');ids.add(id);
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)
   ||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date
   ||date<windows[season][0]||date>windows[season][1])return fail('invalid_game_date');
  if(!/^[A-Z]{2,3}$/.test(home)||!/^[A-Z]{2,3}$/.test(away)||home===away)return fail('invalid_team_codes');
  if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||hs===as)return fail('invalid_completed_score');
  const teams=teamsBySeason.get(season)||new Set(),played=appearanceBySeason.get(season)||new Map(),days=datesBySeason.get(season)||[];
  teams.add(home);teams.add(away);
  played.set(home,(played.get(home)||0)+1);played.set(away,(played.get(away)||0)+1);
  days.push(date);
  teamsBySeason.set(season,teams);appearanceBySeason.set(season,played);datesBySeason.set(season,days);
 }
 const first=teamsBySeason.get(seasons[0]),last=teamsBySeason.get(seasons[1]);
 if(!first||!last||first.size!==32||last.size!==32||[...first].some(team=>!last.has(team)))return fail('team_set_mismatch');
 for(const season of seasons){
  const dates=datesBySeason.get(season),played=appearanceBySeason.get(season);
  if(dates.length!==1312||played.size!==32||[...played.values()].some(n=>n!==82)
   ||dates.reduce((a,b)=>a<b?a:b)!==windows[season][0]
   ||dates.reduce((a,b)=>a>b?a:b)!==windows[season][1])
   return fail('incomplete_season_or_team_coverage');
  for(let number=1;number<=1312;number++)if(!ids.has(Number(String(season).slice(0,4)+'02'+String(number).padStart(4,'0'))))return fail('missing_official_game_id');
 }
 return {ok:true,trainingGames:1312,holdoutGames:1312,teams:32,priorGamesPerTeam:82};
}

export function runNhlWalkforward({historical=fixture}={}){
 const check=validateNhlHistory(historical);
 if(!check.ok)return {status:'not_testable',reason:check.reason,promotionAllowed:false,summary:null,games:[]};
 const input=historical.rows.map(([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nhl-'+id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore,league:'nhl',
  sourceUrl:historical.sourceUrls?.[season===20242025?0:1]||'',sourceTier:'official_public'
 }));
 const scored=buildPregameRows(input,'nhl').filter(r=>r.season===20252026);
 if(scored.length!==1312)throw Error('Missing predictions after sufficient training');
 const games=scored.map(r=>{
  if(r.evidence.through!==null&&r.evidence.through>=r.gameDate)throw Error('Same-day or future result leaked');
  const p=r.baseline,y=r.y;
  return {gameId:r.gameId,date:r.gameDate,home:r.homeTeam,away:r.awayTeam,
   homeWinProbability:p,homeWin:y,predictedWinner:p>=.5?r.homeTeam:r.awayTeam,
   actualWinner:y?r.homeTeam:r.awayTeam,correct:(p>=.5)===Boolean(y),
   brier:(p-y)**2,previousTeamGameThrough:r.evidence.through};
 });
 const rows=flatRows(games);
 const prior=input.filter(x=>x.season===20242025);
 const priorHomeWinRate=prior.filter(r=>r.homeScore>r.awayScore).length/prior.length;
 const bins=Array.from({length:10},(_,i)=>{
  const subset=games.filter(g=>Math.min(9,Math.floor(g.homeWinProbability*10))===i);
  return {from:i/10,to:(i+1)/10,n:subset.length,
   averagePredictedHomeWin:avg(subset.map(x=>x.homeWinProbability)),
   observedHomeWin:avg(subset.map(x=>x.homeWin)),
   brier:avg(subset.map(x=>x.brier))};
 });
 const confidenceBins=Array.from({length:5},(_,i)=>{
  const from=.5+i*.1;
  const subset=games.filter(g=>Math.min(4,Math.floor((Math.max(g.homeWinProbability,1-g.homeWinProbability)-.5)*10))===i);
  return {from,to:from+.1,n:subset.length,correct:subset.filter(x=>x.correct).length,
   accuracy:subset.length?subset.filter(x=>x.correct).length/subset.length:null,
   meanConfidence:avg(subset.map(x=>Math.max(x.homeWinProbability,1-x.homeWinProbability)))};
 });
 const months=[...new Set(games.map(g=>g.date.slice(0,7)))].sort().map(month=>{
  const subset=games.filter(g=>g.date.startsWith(month));
  return {month,games:subset.length,correct:subset.filter(g=>g.correct).length,
   accuracy:subset.filter(g=>g.correct).length/subset.length,
   brier:avg(subset.map(g=>g.brier))};
 });
 const wins=games.filter(g=>g.correct).length;
 const summary={
  trainingSeason:20242025,trainingGames:1312,minimumPreviousSeasonGamesPerTeam:82,
  holdoutSeason:20252026,holdoutGames:1312,holdoutStart:'2025-10-07',holdoutEnd:'2026-04-16',
  predictedGames:games.length,correct:wins,accuracy:wins/games.length,
  brier:brier(rows),logLoss:logLoss(rows),ece10:ece(rows,10),
  meanPredictedHomeWin:avg(games.map(g=>g.homeWinProbability)),
  observedHomeWin:avg(games.map(g=>g.homeWin)),
  maximumCalibrationError:Math.max(...bins.filter(b=>b.n).map(b=>Math.abs(b.averagePredictedHomeWin-b.observedHomeWin))),
  baselines:{
   coinFlipBrier:avg(games.map(g=>(.5-g.homeWin)**2)),
   previousSeasonHomeWinRate:priorHomeWinRate,
   previousSeasonHomeRateBrier:avg(games.map(g=>(priorHomeWinRate-g.homeWin)**2))
  },
  calibrationBins:bins,confidenceBins,months,
  method:'fixed NHL Elo +28 home advantage, K=16, 0.65 offseason shrink; all results on game date withheld until following date'
 };
 return {status:'research_only',promotionAllowed:false,source:historical.source,
  sampleValidation:check,summary,games,
  caveat:'Offline retrospective Elo reconstruction, not a timestamped 2025-26 pregame prediction or independently calibrated betting model. No odds, injuries, goalie confirmations or ROI.'};
}

const direct=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(direct){
 const r=runNhlWalkforward();
 if(process.argv.includes('--games'))console.log(JSON.stringify(r,null,2));
 else{
  const {games,...report}=r;
  console.log('NHL_WALKFORWARD_REPORT '+JSON.stringify(report));
 }
}
