/**
 * Sports Spreads shared NHL goalie research cache.
 * GET serves only RLS-protected cache, zero external API calls.
 * Private POST uses existing Vault-backed x-refresh-token, requests NHL web
 * scoreboard/club-stat/game logs ONCE per scheduled refresh.
 */
import {goalieFormFromGameLog,buildNhlGoalieSnapshot} from './nhl-goalie-form.mjs';
const ROOT='https://api-web.nhle.com/v1',DB=Deno.env.get('SUPABASE_URL')||'';
let other='';try{other=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||'';}catch{}
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||other;
const HEADERS={'apikey':KEY,'content-type':'application/json',
 ...(KEY.startsWith('sb_secret_')?{}:{authorization:'Bearer '+KEY})};
const ORIGINS=new Set(['https://sports-spreads.onrender.com',
 'https://sports-spreads-v3.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const reply=(req:Request,code:number,payload:unknown)=>new Response(JSON.stringify(payload),{
 status:code,headers:{'content-type':'application/json',
 'access-control-allow-origin':ORIGINS.has(req.headers.get('origin')||'')?
 req.headers.get('origin')!:'https://sports-spreads.onrender.com',
 'access-control-allow-methods':'GET,POST,OPTIONS',
 'access-control-allow-headers':'Content-Type,apikey,Authorization,x-refresh-token',
 'cache-control':req.method==='GET'?'public,max-age=300':'no-store',
 vary:'Origin','x-content-type-options':'nosniff'}});
async function db(path:string,options:RequestInit={}){
 const r=await fetch(DB+'/rest/v1/'+path,{...options,headers:{...HEADERS,...options.headers},
  signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('NHL cache database HTTP '+r.status);
 const t=await r.text();return t.trim()?JSON.parse(t):null;
}
async function authorized(req:Request){
 const token=req.headers.get('x-refresh-token')||'';
 if(!/^[a-f0-9]{64}$/i.test(token))return false;
 try{return await db('rpc/verify_sports_odds_refresh_token',{method:'POST',
  body:JSON.stringify({p_token:token})})===true;}catch{return false;}
}
async function nhl(path:string){
 const r=await fetch(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(19000)});
 if(!r.ok)throw Error('NHL source HTTP '+r.status+' '+path.split('/').slice(0,3).join('/'));
 const size=Number(r.headers.get('content-length')||'0');if(size>950000)throw Error('NHL source unexpectedly large');
 const body=await r.text();if(body.length>950000)throw Error('NHL source oversized');
 return JSON.parse(body);
}
function fixtureList(payload:any,now:number){
 if(!Array.isArray(payload?.gameWeek))throw Error('NHL week schedule missing');
 const all=new Map<string,any>();
 for(const day of payload.gameWeek)for(const game of day.games||[]){
  const id=String(game.id||''),start=Date.parse(game.startTimeUTC||'');
  const homeAbbrev=String(game.homeTeam?.abbrev||''),awayAbbrev=String(game.awayTeam?.abbrev||'');
  if(!/^20\d{8}$/.test(id)||!/^[A-Z]{2,4}$/.test(homeAbbrev)||
   !/^[A-Z]{2,4}$/.test(awayAbbrev)||homeAbbrev===awayAbbrev||
   !Number.isFinite(start)||start<=now||start>now+3.5*86400000||
   !['FUT','PRE'].includes(game.gameState))continue;
  all.set(id,{gameId:id,start:new Date(start).toISOString(),homeAbbrev,awayAbbrev});
 }
 return [...all.values()].sort((a,b)=>a.start.localeCompare(b.start)).slice(0,32);
}
async function goalieGameRows(seasonYear:number){
 // The official NHL Stats REST service caps each query at 100 rows regardless
 // of requested limit. Page in order; 2026 through mid-November ~700 rows.
 const rows:any[]=[],seen=new Set<string>();
 const season=String(seasonYear)+String(seasonYear+1);
 for(let start=0;start<5000;start+=100){
  const url=new URL('https://api.nhle.com/stats/rest/en/goalie/summary');
  url.searchParams.set('isAggregate','false');url.searchParams.set('isGame','true');
  url.searchParams.set('start',String(start));url.searchParams.set('limit','100');
  url.searchParams.set('cayenneExp','seasonId='+season+' and gameTypeId=2');
  const response=await fetch(url.toString(),{headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(24000)});
  if(!response.ok)throw Error('NHL goalie game summary HTTP '+response.status);
  const body=await response.text();if(body.length>850000)throw Error('NHL goalie page too large');
  const payload=JSON.parse(body);
  if(!Array.isArray(payload?.data)||!Number.isInteger(Number(payload.total)))
   throw Error('NHL goalie game summary schema missing');
  const total=Number(payload.total);
  if(total<0||total>5000)throw Error('NHL goalie source size outside verified limits');
  for(const r of payload.data){
   const playerId=Number(r.playerId),gameId=String(r.gameId||'');
   if(!Number.isSafeInteger(playerId)||!/^20\d{8}$/.test(gameId)||!gameId.startsWith(String(seasonYear))||
    !/^[A-Z]{2,4}$/.test(String(r.teamAbbrev||'')))continue;
   const key=String(playerId)+'|'+gameId;
   if(seen.has(key))throw Error('Duplicate game-level goalie stats from NHL REST');
   seen.add(key);rows.push(r);
  }
  if(start+payload.data.length>=total){
   if(rows.length<Math.floor(total*.93))throw Error('NHL goalie game stats insufficient verified coverage');
   break;
  }
  if(payload.data.length!==100)throw Error('NHL goalie page truncated before total');
 }
 return rows;
}
async function refresh(){
 const generatedAt=new Date().toISOString(),now=Date.parse(generatedAt);
 const schedule=await nhl('/schedule/now'),games=fixtureList(schedule,now);
 if(!games.length)throw Error('No scheduled NHL games in next 3.5 days; preserve prior cache');
 const teams=[...new Set(games.flatMap(g=>[g.homeAbbrev,g.awayAbbrev]))].sort();
 const seasonYear=Number(games[0].gameId.slice(0,4));
 if(games.some(g=>Number(g.gameId.slice(0,4))!==seasonYear))throw Error('Multiple seasons in NHL slate');
 const rows=await goalieGameRows(seasonYear);
 if(rows.length<20)throw Error('NHL goalie stats source has too few completed games');
 const grouped=new Map<string,Map<string,any[]>>();
 for(const row of rows){
  const team=String(row.teamAbbrev),id=String(row.playerId);
  if(!teams.includes(team))continue;
  const goalie=grouped.get(team)||new Map<string,any[]>(),list=goalie.get(id)||[];
  list.push({...row,gameId:row.gameId,teamAbbrev:team,
   gamesStarted:row.gamesStarted,shotsAgainst:row.shotsAgainst,goalsAgainst:row.goalsAgainst});
  goalie.set(id,list);grouped.set(team,goalie);
 }
 const teamGoalies=new Map<string,any[]>();let supportedTeams=0;
 for(const team of teams){
  const fixture=games.find(g=>g.homeAbbrev===team||g.awayAbbrev===team)!;
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
   year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(fixture.start));
  const options=[...(grouped.get(team)||new Map()).entries()].map(([playerId,history])=>{
   const stats=goalieFormFromGameLog({playerId,teamAbbrev:team,logs:history,gameDate:date});
   return {...stats,name:String(history[0]?.goalieFullName||history[0]?.lastName||'Goalie').slice(0,95)};
  }).filter(x=>x.latestStart).sort((a,b)=>b.latestStart.localeCompare(a.latestStart)||
   b.last5.starts-a.last5.starts).slice(0,3);
  if(options.length)supportedTeams++;
  teamGoalies.set(team,options);
 }
 const snapshot={...buildNhlGoalieSnapshot({games,teamGoalies,generatedAt}),
  teamCount:teams.length,teamsWithStats:supportedTeams,goalieGameRows:rows.length,
  dataSourceFailures:teams.length-supportedTeams,showModelConfidence:false,
  noPaidApiRequests:true};
 if(!snapshot.games.length||supportedTeams<Math.ceil(teams.length*.9))
  throw Error('Verified goalie coverage insufficient; preserve existing cached research');
 await db('sports_nhl_goalie_latest?on_conflict=id',{method:'POST',
  headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify([{id:1,snapshot,updated_at:generatedAt}])});
 return {status:'updated',games:snapshot.games.length,teams:teams.length,
  teamsWithStats:supportedTeams,gameRows:rows.length,
  generatedAt,probabilitiesChanged:false};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':ORIGINS.has(req.headers.get('origin')||'')?
  req.headers.get('origin')!:'https://sports-spreads.onrender.com',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'Content-Type,apikey,Authorization,x-refresh-token'}});
 if(!['GET','POST'].includes(req.method))return reply(req,405,{error:'Unsupported method'});
 if(new URL(req.url).search)return reply(req,400,{error:'Shared NHL cache only'});
 if(!DB||!KEY)return reply(req,503,{status:'unavailable',games:[]});
 if(req.method==='GET'){
  try{
   const rows=await db('sports_nhl_goalie_latest?id=eq.1&select=snapshot,updated_at&limit=1');
   if(!rows?.[0])return reply(req,200,{status:'pending',games:[]});
   const age=Date.now()-Date.parse(rows[0].updated_at||'');
   if(!Number.isFinite(age)||age<0||age>36*3600000)
    return reply(req,200,{status:'stale',games:[],note:'NHL goalie cache not refreshed recently'});
   return reply(req,200,rows[0].snapshot);
  }catch{return reply(req,503,{status:'unavailable',games:[]});}
 }
 if(!(await authorized(req)))return reply(req,403,{error:'Owner-only refresh'});
 try{return reply(req,200,await refresh());}
 catch(e){return reply(req,503,{status:'failed',error:String(e?.message||e).slice(0,180)});}
});
