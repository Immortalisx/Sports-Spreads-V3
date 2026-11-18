#!/usr/bin/env node
/** One-off verified source probe/backfill, no secrets, no paid provider.
 * Prints a bounded normalized snapshot for owner-controlled database seeding.
 * Never inserts from an unverified source or claims a confirmed QB starter.
 */
import {parseLeagueInjuries,parseQbDepth,buildPregameAvailability} from './nfl-availability-snapshot.mjs';
const origin='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const observedAt=new Date().toISOString(),now=Date.parse(observedAt);
async function get(path,max=11000000){
 const res=await fetch(origin+path,{headers:{accept:'application/json','user-agent':'SportsSpreadsSourceAudit/1.0'},signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error('HTTP '+res.status+' '+path);
 const body=await res.text();
 if(body.length>max)throw Error('Too large '+path+' '+body.length);
 return JSON.parse(body);
}
const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(new Date()).replace('-','');
const scoreboard=await get('/scoreboard?dates='+month+'&limit=100',1200000);
const games=[];
for(const e of scoreboard.events||[]){
 const first=e.competitions?.[0];
 const h=first?.competitors?.find(x=>x.homeAway==='home'),a=first?.competitors?.find(x=>x.homeAway==='away');
 const t=Date.parse(e.date||''),id=String(e.id||'');
 const homeTeamId=String(h?.team?.id||''),awayTeamId=String(a?.team?.id||'');
 if(e.status?.type?.state==='pre'&&/^\d+$/.test(id)&&/^\d+$/.test(homeTeamId)&&/^\d+$/.test(awayTeamId)&&Number.isFinite(t)&&t>now&&t<now+9*86400000)
  games.push({gameId:id,homeTeamId,awayTeamId,start:new Date(t).toISOString()});
}
console.log('PROBE_SCOREBOARD='+JSON.stringify({events:scoreboard.events?.length,fixtures:games.length,
 first:games[0],statusSample:scoreboard.events?.[0]?.status?.type?.state}));
const teams=[...new Set(games.flatMap(x=>[x.homeTeamId,x.awayTeamId]))].slice(0,32);
let injMap=new Map(),injurySourceStatus='unavailable';
try{
 const data=await get('/injuries',11000000);
 console.log('PROBE_INJURIES='+JSON.stringify({rootKeys:Object.keys(data).slice(0,16),
 season:data.season,groups:data.injuries?.length,
 groupKeys:data.injuries?.[0]?Object.keys(data.injuries[0]):[],
 firstTeam:data.injuries?.[0]?.team?.id,groupId:data.injuries?.[0]?.id,displayName:data.injuries?.[0]?.displayName,
 firstInjuries:data.injuries?.[0]?.injuries?.length,
 sample:data.injuries?.[0]?.injuries?.[0] ?{
  keys:Object.keys(data.injuries[0].injuries[0]),
  status:data.injuries[0].injuries[0].status,
  athlete:data.injuries[0].injuries[0].athlete?.id,athleteKeys:Object.keys(data.injuries[0].injuries[0].athlete||{}),athleteRef:data.injuries[0].injuries[0].athlete?.$ref,athleteName:data.injuries[0].injuries[0].athlete?.displayName,athleteTeam:data.injuries[0].injuries[0].athlete?.team?.id,athleteLinks:data.injuries[0].injuries[0].athlete?.links?.slice(0,2)?.map(x=>({href:x.href,rel:x.rel})),
  position:data.injuries[0].injuries[0].athlete?.position?.abbreviation
 }:null}));
 injMap=parseLeagueInjuries(data,{observedAt});
 if(injMap.size)injurySourceStatus='retrieved';
}catch(e){console.log('PROBE_INJURY_ERROR='+String(e.message||e).slice(0,180));}
const charts=new Map(),failed=[];
for(let idx=0;idx<teams.length;idx+=5){
 await Promise.all(teams.slice(idx,idx+5).map(async teamId=>{
  try{
   const data=await get('/teams/'+teamId+'/depthcharts',1000000);
   if(idx===0)console.log('PROBE_CHART='+JSON.stringify({teamId,keys:Object.keys(data),
    chartCount:data.depthCharts?.length,depthchartType:Array.isArray(data.depthchart)?'array':typeof data.depthchart,depthchartKeys:Object.keys(data.depthchart||{}).slice(0,15),qbPositions:(data.depthchart||[]).flatMap(chart=>
  Object.entries(chart.positions||{}).filter(([k,v])=>k.toLowerCase()==='qb'||v?.abbreviation==='QB')
   .map(([key,v])=>({chart:chart.name,key,posKeys:Object.keys(v||{}),
      players:v?.athletes?.slice(0,3)?.map((a,i)=>({keys:Object.keys(a),name:a.displayName,id:a.id,rank:a.rank,index:i}))}))),chartSample:data.depthCharts?.[0]?{
    keys:Object.keys(data.depthCharts[0]),
    positions:Object.keys(data.depthCharts[0].positions||{}).slice(0,5),
    positionSample:Object.values(data.depthCharts[0].positions||{})[0]?{
      keys:Object.keys(Object.values(data.depthCharts[0].positions)[0]),
      athletes:Object.values(data.depthCharts[0].positions)[0]?.athletes?.slice(0,2)?.map(x=>({keys:Object.keys(x),rank:x.rank,player:x.athlete?.id,position:x.athlete?.position?.abbreviation}))
    }:null
   }:null,
   qb:parseQbDepth(data,{observedAt})}));
   if(Array.isArray(data.depthchart)||Array.isArray(data.depthCharts))charts.set(teamId,data);else failed.push(teamId);
  }catch(e){failed.push(teamId);console.log('PROBE_CHART_ERROR='+JSON.stringify({teamId,error:String(e.message||e).slice(0,180)}));}
 }));
}
const result=buildPregameAvailability({fixtures:games,injuries:injMap,depthCharts:charts,observedAt});
const snapshot={...result,injurySourceStatus,depthChartTeams:charts.size,sourceFailures:failed.length,
 sourceType:'ESPN unofficial JSON',noPaidApiRequests:true};
console.log('PROBE_SUMMARY='+JSON.stringify({games:result.games.length,teams:teams.length,
 chartSuccess:charts.size,chartFail:failed.length,injurySourceStatus,
 injuryGroups:injMap.size,projectedQB:result.games.flatMap(g=>[g.home,g.away]).filter(s=>s.projectedQB).length,
 firstSummary:result.games[0]?{id:result.games[0].gameId,home:result.games[0].home.starterStatus,away:result.games[0].away.starterStatus}:null}));
if(games.length&&charts.size+injMap.size>0){
 // Reporting only 6 injury records/team keeps logs reasonably sized.
 for(const game of snapshot.games)for(const side of ['home','away'])game[side].injuries=game[side].injuries.slice(0,6);
 console.log('BACKFILL_JSON='+JSON.stringify(snapshot));
}else console.log('BACKFILL_UNAVAILABLE=No verified, current game and player data');
