#!/usr/bin/env node
/** One-time owner verification/backfill. Reuses exactly the server's goalie
 * metrics; bounded NHL web requests, no raw game logs retained or paid keys.
 */
import {goalieFormFromGameLog,buildNhlGoalieSnapshot} from './nhl-goalie-form.mjs';
const ROOT='https://api-web.nhle.com/v1',generatedAt=new Date().toISOString(),now=Date.parse(generatedAt);
async function fetchNhl(path){
 const r=await fetch(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('NHL source HTTP '+r.status+' '+path.split('/').slice(0,3).join('/'));
 const txt=await r.text();if(txt.length>950000)throw Error('NHL source too large');
 return JSON.parse(txt);
}
async function batch(xs,fn){for(let i=0;i<xs.length;i+=4)await Promise.all(xs.slice(i,i+4).map(fn));}
const schedule=await fetchNhl('/schedule/now'),all=new Map();
for(const day of schedule.gameWeek||[])for(const g of day.games||[]){
 const id=String(g.id||''),when=Date.parse(g.startTimeUTC||''),
  homeAbbrev=String(g.homeTeam?.abbrev||''),awayAbbrev=String(g.awayTeam?.abbrev||'');
 if(/^20\d{8}$/.test(id)&&/^[A-Z]{2,4}$/.test(homeAbbrev)&&/^[A-Z]{2,4}$/.test(awayAbbrev)&&
 when>now&&when<=now+3.5*86400000&&['FUT','PRE'].includes(g.gameState))
  all.set(id,{gameId:id,homeAbbrev,awayAbbrev,start:new Date(when).toISOString()});
}
const games=[...all.values()].sort((a,b)=>a.start.localeCompare(b.start)).slice(0,32);
if(!games.length)throw Error('Upcoming NHL slate empty; no cache overwrite');
const teams=[...new Set(games.flatMap(g=>[g.homeAbbrev,g.awayAbbrev]))].sort();
const roster=new Map(),failed=[];
await batch(teams,async team=>{
 try{
  const y=Number(games.find(g=>g.homeAbbrev===team||g.awayAbbrev===team).gameId.slice(0,4));
  const src=await fetchNhl('/club-stats/'+team+'/'+y+(y+1)+'/2');
  if(!Array.isArray(src.goalies))throw Error('No goalie team list');
  const rows=src.goalies.filter(x=>Number.isSafeInteger(Number(x.playerId))&&Number(x.gamesStarted)>0)
   .sort((a,b)=>Number(b.gamesStarted)-Number(a.gamesStarted)).slice(0,3)
   .map(p=>({id:Number(p.playerId),name:[p.firstName?.default,p.lastName?.default].filter(Boolean).join(' ').slice(0,95)}));
  if(rows.length)roster.set(team,rows);else failed.push(team);
 }catch{failed.push(team);}
});
const source=new Map(),wanted=[...roster.entries()].flatMap(([team,players])=>players.map(p=>({team,...p})));
await batch(wanted,async p=>{
 try{
  const y=Number(games.find(g=>g.homeAbbrev===p.team||g.awayAbbrev===p.team).gameId.slice(0,4));
  const raw=await fetchNhl('/player/'+p.id+'/game-log/'+y+(y+1)+'/2');
  if(!Array.isArray(raw?.gameLog))throw Error('No game log');
  source.set(p.team+'|'+p.id,raw.gameLog);
 }catch{}
});
const teamGoalies=new Map();
for(const team of teams){
 const game=games.find(g=>g.homeAbbrev===team||g.awayAbbrev===team);
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(game.start));
 const rows=(roster.get(team)||[]).flatMap(p=>{
  const logs=source.get(team+'|'+p.id);
  if(!logs)return [];
  return [{...goalieFormFromGameLog({playerId:p.id,teamAbbrev:team,logs,gameDate:day}),name:p.name}];
 });
 teamGoalies.set(team,rows);
}
const snapshot={...buildNhlGoalieSnapshot({games,teamGoalies,generatedAt}),
 teamCount:teams.length,teamsWithStats:roster.size,
 goalieLogsRetrieved:source.size,dataSourceFailures:failed.length,
 showModelConfidence:false,noPaidApiRequests:true};
const ready=snapshot.games.length>=1&&roster.size>=Math.ceil(teams.length*.6)&&
 source.size>=Math.ceil(teams.length*.6);
console.log('GOALIE_REFRESH_AUDIT='+JSON.stringify({games:games.length,teams:teams.length,
 stats:roster.size,logs:source.size,failed:failed.length,ready,
 example: snapshot.games[0]?{gameId:snapshot.games[0].gameId,home:snapshot.games[0].homeAbbrev,
 away:snapshot.games[0].awayAbbrev,homeLast:snapshot.games[0].home.mostRecentStarter?.last5,
 awayLast:snapshot.games[0].away.mostRecentStarter?.last5}:null}));
if(!ready)throw Error('Not enough real goalie history; refuse cache seeding');
console.log('GOALIE_BACKFILL_JSON='+JSON.stringify(snapshot));
