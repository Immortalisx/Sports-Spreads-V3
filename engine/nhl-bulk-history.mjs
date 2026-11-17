/**
 * Official NHL Stats REST season game listing. 1-2 capped requests/season,
 * avoiding NHL Web's burst-rate-limited 32 club schedule calls.
 * No provider key, no visitor requests and no rehosting source rows.
 */
export async function fetchNhlSeasonListing(season,{fetchImpl=fetch,expected=1312}={}){
 if(!Number.isInteger(season)||season<2021||season>2025)throw Error('Unsupported completed NHL season');
 if(!Number.isInteger(expected)||expected<1||expected>1312)throw Error('Bad expected NHL game count');
 const seasonCode=String(season)+String(season+1),source='https://api.nhle.com/stats/rest/en/game';
 const rows=new Map();
 for(let start=0;start<2000;start+=1500){
  const url=new URL(source);
  url.searchParams.set('start',String(start));
  url.searchParams.set('limit','1500');
  url.searchParams.set('cayenneExp','season='+seasonCode+' and gameType=2');
  const response=await fetchImpl(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('NHL REST game listing HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data?.data))throw Error('NHL REST listing returned no game table');
  for(const r of data.data){
   if(Number(r.gameType)!==2||!String(r.id||'').startsWith(String(season)+'02'))continue;
   const id=Number(r.id),h=Number(r.homeScore),a=Number(r.visitingScore);
   const home=Number(r.homeTeamId),away=Number(r.visitingTeamId),date=String(r.gameDate||'').slice(0,10);
   if(!Number.isSafeInteger(id)||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h===a||
      !Number.isInteger(home)||!Number.isInteger(away)||home===away||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
   const game={gameId:'nhl-'+id,league:'nhl',season,gameDate:date,gameAt:date+'T12:00:00.000Z',
    homeTeam:String(home),awayTeam:String(away),homeScore:h,awayScore:a,
    sourceUrl:source,sourceTier:'official_public',retrospective:true};
   const prev=rows.get(game.gameId);
   if(prev&&JSON.stringify(prev)!==JSON.stringify(game))throw Error('Duplicate NHL listing conflict');
   rows.set(game.gameId,game);
  }
  if(rows.size>=expected)break;
  if(data.data.length<1500)break;
 }
 if(rows.size!==expected)throw Error('NHL Stats REST listing coverage '+rows.size+'/'+expected+' for '+season);
 return {games:[...rows.values()].sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId)),
  coverage:{expected,source:'NHL Stats REST bulk game listing',total:rows.size,complete:true}};
}
