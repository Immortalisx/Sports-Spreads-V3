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
async function groupedWork<T>(items:T[],n:number,fn:(x:T)=>Promise<void>){
 for(let i=0;i<items.length;i+=n)await Promise.all(items.slice(i,i+n).map(fn));
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
async function refresh(){
 const generatedAt=new Date().toISOString(),now=Date.parse(generatedAt);
 const schedule=await nhl('/schedule/now');
 const games=fixtureList(schedule,now);
 if(!games.length)throw Error('No scheduled NHL games in next 3.5 days; keep prior verified cache');
 const teams=[...new Set(games.flatMap(g=>[g.homeAbbrev,g.awayAbbrev]))].sort();
 const roster=new Map<string,Array<{id:number,name:string}>>(),errors:string[]=[];
 await groupedWork(teams,4,async team=>{
  try{
   const seasonYear=Number(games.find(g=>g.homeAbbrev===team||g.awayAbbrev===team)!.gameId.slice(0,4));
   const source=await nhl('/club-stats/'+team+'/'+seasonYear+(seasonYear+1)+'/2');
   if(!Array.isArray(source.goalies))throw Error('Missing goalie team stats');
   const players=source.goalies.filter((x:any)=>Number.isSafeInteger(Number(x.playerId))&&
    Number(x.gamesStarted)>0).sort((a:any,b:any)=>Number(b.gamesStarted)-Number(a.gamesStarted)).slice(0,3)
    .map((x:any)=>({id:Number(x.playerId),
     name:[x.firstName?.default,x.lastName?.default].filter(Boolean).join(' ').slice(0,95)}));
   if(players.length)roster.set(team,players);else errors.push(team);
  }catch{errors.push(team);}
 });
 const logs=new Map<string,any[]>();
 const wanted=[...roster.entries()].flatMap(([team,players])=>players.map(p=>({team,...p})));
 await groupedWork(wanted,4,async item=>{
  try{
   const seasonYear=Number(games.find(g=>g.homeAbbrev===item.team||g.awayAbbrev===item.team)!.gameId.slice(0,4));
   const data=await nhl('/player/'+item.id+'/game-log/'+seasonYear+(seasonYear+1)+'/2');
   if(!Array.isArray(data?.gameLog))throw Error('Missing NHL player game-log history');
   logs.set(item.team+'|'+item.id,data.gameLog);
  }catch{}
 });
 const goalieData=new Map<string,any[]>();
 for(const team of teams){
  const upcoming=games.filter(g=>g.homeAbbrev===team||g.awayAbbrev===team);
  // This cache stores summaries for the earliest fixture per team; each
  // later fixture will be filtered once more before display by game date.
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',
    month:'2-digit',day:'2-digit'}).format(new Date(upcoming[0].start));
  const playerRows=(roster.get(team)||[]).flatMap(p=>{
   const history=logs.get(team+'|'+p.id);
   if(!history)return [];
   const summary=goalieFormFromGameLog({playerId:p.id,teamAbbrev:team,logs:history,gameDate:day});
   return [{...summary,name:p.name}];
  });
  goalieData.set(team,playerRows);
 }
 const snap={...buildNhlGoalieSnapshot({games,teamGoalies:goalieData,generatedAt}),
  teamCount:teams.length,teamsWithStats:roster.size,goalieLogsRetrieved:logs.size,
  dataSourceFailures:errors.length,showModelConfidence:false,noPaidApiRequests:true};
 if(!snap.games.length||roster.size<Math.ceil(teams.length*.6)||logs.size<Math.ceil(teams.length*.6))
  throw Error('Too few sourced goalie histories; refuse cache overwrite');
 await db('sports_nhl_goalie_latest?on_conflict=id',{method:'POST',
  headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify([{id:1,snapshot:snap,updated_at:generatedAt}])});
 return {status:'updated',games:snap.games.length,teams:teams.length,
  teamsWithStats:roster.size,goalieLogs:logs.size,generatedAt,probabilitiesChanged:false};
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
