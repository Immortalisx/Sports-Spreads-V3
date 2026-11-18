#!/usr/bin/env node
const url=new URL('https://api.nhle.com/stats/rest/en/goalie/summary');
url.searchParams.set('isAggregate','false');url.searchParams.set('isGame','true');
url.searchParams.set('start','0');url.searchParams.set('limit','3000');
url.searchParams.set('cayenneExp','seasonId=20262027 and gameTypeId=2');
const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(40000)});
if(!r.ok)throw Error('NHL goalie REST bulk HTTP '+r.status);
const raw=await r.text();if(raw.length>3000000)throw Error('bulk goalie rows too large');
const d=JSON.parse(raw);
console.log('GOALIE_BULK_SCHEMA='+JSON.stringify({keys:Object.keys(d),total:d.total,
 rows:d.data?.length,first:d.data?.slice(0,2).map(x=>({keys:Object.keys(x),
 gameId:x.gameId,gameDate:x.gameDate,playerId:x.playerId,goalieFullName:x.goalieFullName,
 teamAbbrev:x.teamAbbrev,teamId:x.teamId,shotsAgainst:x.shotsAgainst,
 saves:x.saves,goalsAgainst:x.goalsAgainst,savePct:x.savePct,goalieStarted:x.gamesStarted,
 wins:x.wins,losses:x.losses}))}));
