#!/usr/bin/env node
/** Verified free NHL source (8 shared requests, no bookmaker calls). Produces
 * compact game-level summaries; no raw per-game source rows are published.
 */
import {goalieFormFromGameLog,buildNhlGoalieSnapshot} from './nhl-goalie-form.mjs';
const ROOT='https://api-web.nhle.com/v1',generatedAt=new Date().toISOString(),now=Date.parse(generatedAt);
async function get(url){
 const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('NHL public source HTTP '+r.status);
 const t=await r.text();if(t.length>850000)throw Error('NHL public source oversized');
 return JSON.parse(t);
}
const schedule=await get(ROOT+'/schedule/now'),gMap=new Map();
for(const day of schedule.gameWeek||[])for(const g of day.games||[]){
 const id=String(g.id||''),ms=Date.parse(g.startTimeUTC||''),
  homeAbbrev=String(g.homeTeam?.abbrev||''),awayAbbrev=String(g.awayTeam?.abbrev||'');
 if(/^20\d{8}$/.test(id)&&/^[A-Z]{2,4}$/.test(homeAbbrev)&&/^[A-Z]{2,4}$/.test(awayAbbrev)&&
 ms>now&&ms<=now+3.5*86400000&&['FUT','PRE'].includes(g.gameState))
 gMap.set(id,{gameId:id,start:new Date(ms).toISOString(),homeAbbrev,awayAbbrev});
}
const games=[...gMap.values()].sort((a,b)=>a.start.localeCompare(b.start)).slice(0,32);
if(!games.length)throw Error('No upcoming NHL game; do not overwrite cache');
const teams=[...new Set(games.flatMap(g=>[g.homeAbbrev,g.awayAbbrev]))].sort();
const y=Number(games[0].gameId.slice(0,4)),season=String(y)+String(y+1);
const rows=[],seen=new Set();let expected=null,requests=0;
for(let start=0;start<5000;start+=100){
 const url=new URL('https://api.nhle.com/stats/rest/en/goalie/summary');
 url.searchParams.set('isAggregate','false');url.searchParams.set('isGame','true');
 url.searchParams.set('start',String(start));url.searchParams.set('limit','100');
 url.searchParams.set('cayenneExp','seasonId='+season+' and gameTypeId=2');
 const source=await get(url.toString());requests++;
 if(!Array.isArray(source.data)||!Number.isInteger(Number(source.total)))throw Error('Bad NHL goalie stats schema');
 expected=Number(source.total);if(expected>5000)throw Error('Unexpected NHL source size');
 for(const r of source.data){
  const id=String(r.gameId||''),player=Number(r.playerId);
  if(!/^20\d{8}$/.test(id)||!Number.isSafeInteger(player)||!id.startsWith(String(y)))continue;
  const key=id+'|'+player;if(seen.has(key))throw Error('Duplicate NHL goalie game');seen.add(key);rows.push(r);
 }
 if(start+source.data.length>=expected)break;
 if(source.data.length!==100)throw Error('NHL goalie page terminated prematurely');
}
if(rows.length<Math.floor(expected*.93))throw Error('Incomplete NHL bulk goalie coverage');
const grouped=new Map();
for(const r of rows){
 const team=String(r.teamAbbrev||''),id=String(r.playerId);
 if(!teams.includes(team))continue;
 const player=grouped.get(team)||new Map(),a=player.get(id)||[];
 a.push(r);player.set(id,a);grouped.set(team,player);
}
const data=new Map();let supported=0;
for(const team of teams){
 const g=games.find(g=>g.homeAbbrev===team||g.awayAbbrev===team);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.start));
 const summary=[...(grouped.get(team)||new Map()).entries()].map(([playerId,history])=>({
  ...goalieFormFromGameLog({playerId,teamAbbrev:team,logs:history,gameDate:date}),
  name:String(history[0].goalieFullName||history[0].lastName||'Goalie').slice(0,95)
 })).filter(x=>x.latestStart).sort((a,b)=>b.latestStart.localeCompare(a.latestStart)).slice(0,3);
 if(summary.length)supported++;data.set(team,summary);
}
const snapshot={...buildNhlGoalieSnapshot({games,teamGoalies:data,generatedAt}),
 teamCount:teams.length,teamsWithStats:supported,goalieGameRows:rows.length,
 dataSourceFailures:teams.length-supported,showModelConfidence:false,noPaidApiRequests:true};
const ready=games.length>=1&&supported>=Math.ceil(teams.length*.9);
console.log('GOALIE_REFRESH_AUDIT='+JSON.stringify({games:games.length,teams:teams.length,
 supported,gameRows:rows.length,pages:requests,ready,
 matchupCoverage:snapshot.games.filter(g=>g.home.mostRecentStarter&&g.away.mostRecentStarter).length}));
if(!ready)throw Error('Incomplete per-game goalie history; do not publish');
console.log('GOALIE_BACKFILL_JSON='+JSON.stringify(snapshot));
