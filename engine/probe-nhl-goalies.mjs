#!/usr/bin/env node
// Source-only schema probe: no scraped pages, secrets, paid APIs or public player dump.
const ROOT='https://api-web.nhle.com/v1';
async function get(path){
 const res=await fetch(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error(path+' HTTP '+res.status);
 const txt=await res.text();if(txt.length>650000)throw Error('Unexpected source size');
 return JSON.parse(txt);
}
const team=await get('/club-stats/TOR/20262027/2');
console.log('GOALIE_CLUB_KEYS='+JSON.stringify(Object.keys(team)));
console.log('GOALIE_CLUB_STATS='+JSON.stringify({goalies:team.goalies?.length,
 sample:team.goalies?.slice(0,2).map(x=>({keys:Object.keys(x),id:x.playerId,
 name:x.firstName?.default+' '+x.lastName?.default,
 games:x.gamesPlayed,saves:x.saves,shotsAgainst:x.shotsAgainst,savePct:x.savePct}))}));
const id=team.goalies?.find(x=>x.gamesPlayed>0)?.playerId;
if(!id)throw Error('No NHL team goalie ID to inspect');
const logs=await get('/player/'+id+'/game-log/20262027/2');
const rows=logs.gameLog||logs.gameLogs||logs.games||[];
console.log('GOALIE_GAMELOG='+JSON.stringify({id,keys:Object.keys(logs),n:rows.length,
 first:rows.slice(0,3).map(x=>({keys:Object.keys(x),gameId:x.gameId,gameDate:x.gameDate,
 shotsAgainst:x.shotsAgainst,saves:x.saves,goalsAgainst:x.goalsAgainst,savePct:x.savePct,
 decision:x.decision,opponentAbbrev:x.opponentAbbrev}))}));
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const slate=await get('/score/'+today);
console.log('GOALIE_NHL_SCHEDULE='+JSON.stringify({date:today,games:slate.games?.length,
 sample:slate.games?.slice(0,2).map(x=>({id:x.id,gameState:x.gameState,away:x.awayTeam?.abbrev,home:x.homeTeam?.abbrev,startTimeUTC:x.startTimeUTC}))}));
const schedule=await get('/schedule/now');
console.log('GOALIE_WEEK_SCHEDULE='+JSON.stringify({keys:Object.keys(schedule),weekDays:schedule.gameWeek?.length,
 day:schedule.gameWeek?.[0]?{date:schedule.gameWeek[0].date,games:schedule.gameWeek[0].games?.length,
 sample:schedule.gameWeek[0].games?.[0]?{id:schedule.gameWeek[0].games[0].id,
 home:schedule.gameWeek[0].games[0].homeTeam?.abbrev,away:schedule.gameWeek[0].games[0].awayTeam?.abbrev,
 state:schedule.gameWeek[0].games[0].gameState}:null}:null}));
console.log('GOALIE_SOURCE_PROBE_COMPLETE='+JSON.stringify({goalieRows:team.goalies?.length,logRows:rows.length,games:slate.games?.length}));
