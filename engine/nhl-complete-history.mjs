/**
 * Reliable, bounded, free NHL completed-season recovery.
 * Official club schedule endpoints can omit games for some previous seasons.
 * A second official weekly NHL schedule index is used only if coverage is short.
 * No invented fixtures, outcome fills, or client-side requests.
 */
import {collectHistorical,nhlFromClubSchedule} from './historical-sources.mjs';
const iso=d=>new Date(d).toISOString().slice(0,10);
export async function completeNhlSeason(season,{
 fetchImpl=fetch,expected=1312,nhlClubs,weekStart,weekEnd,onProgress=()=>{}
}={}){
 if(!Number.isInteger(season)||season<2021||season>2025)throw Error('Only completed standard 82-game NHL seasons 2021–2025 supported');
 if(!Number.isInteger(expected)||expected<1||expected>1312)throw Error('Invalid expected season coverage');
 const existing=await collectHistorical({league:'nhl',season,fetchImpl,onProgress,
  ...(nhlClubs?{nhlClubs}:{})});
 const byId=new Map(existing.map(x=>[x.gameId,x]));
 if(byId.size>=expected){
  if(byId.size>expected)throw Error('Unexpected NHL season count exceeds expected games');
  return {games:[...byId.values()].sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId)),
   coverage:{expected,clubGames:existing.length,weeklyRecovered:0,total:byId.size,complete:true}};
 }
 const first=weekStart||season+'-10-01',last=weekEnd||(season+1)+'-04-23';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(first)||!/^\d{4}-\d{2}-\d{2}$/.test(last))throw Error('Bad NHL weekly schedule window');
 let recovered=0,fetches=0;
 for(let t=Date.parse(first);t<=Date.parse(last);t+=7*86400_000){
  fetches++;if(fetches>35)throw Error('NHL recovery capped to 35 official schedule calls');
  const day=iso(t),url='https://api-web.nhle.com/v1/schedule/'+day;
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(16000),headers:{accept:'application/json'}});
  if(!response.ok)throw Error('NHL official weekly source HTTP '+response.status);
  const text=await response.text();if(text.length>1800000)throw Error('NHL weekly response exceeded cap');
  const data=JSON.parse(text),days=data.gameWeek;
  if(!Array.isArray(days))throw Error('NHL weekly schedule lacked gameWeek');
  const games=nhlFromClubSchedule({games:days.flatMap(x=>Array.isArray(x.games)?x.games:[])},season);
  for(const r of games){
   // Guard against a provider incorrectly returning another season's fixture.
   if(!String(r.gameId).startsWith('nhl-'+season+'02'))continue;
   const prior=byId.get(r.gameId);
   if(prior){
    if(prior.homeTeam!==r.homeTeam||prior.awayTeam!==r.awayTeam||
       prior.homeScore!==r.homeScore||prior.awayScore!==r.awayScore)
     throw Error('NHL source conflict in game '+r.gameId);
   }else{byId.set(r.gameId,r);recovered++;}
  }
  if(onProgress)onProgress({type:'week',date:day,recovered,total:byId.size,expected});
 }
 if(byId.size!==expected)throw Error('NHL season '+season+' incomplete after weekly recovery: '+byId.size+'/'+expected);
 return {games:[...byId.values()].sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId)),
  coverage:{expected,clubGames:existing.length,weeklyRecovered:recovered,weeklyCalls:fetches,
   total:byId.size,complete:true}};
}
