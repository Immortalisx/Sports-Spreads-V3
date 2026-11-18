/**
 * One shared, keyless ESPN source refresh; public GET only reads Postgres cache.
 * PRIVATE POST requires the existing Vault-backed refresh token (same as odds).
 * Neither POST nor GET modifies probabilities, wagers, or provider credit quotas.
 */
import {parseLeagueInjuries,buildPregameAvailability} from './nfl-availability-snapshot.mjs';
const HOST=Deno.env.get('SUPABASE_URL')||'';
let fallback='';try{fallback=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||fallback;
const HEADERS={'apikey':KEY,'content-type':'application/json',
 ...(KEY.startsWith('sb_secret_')?{}:{authorization:'Bearer '+KEY})};
const ORIGINS=new Set(['https://sports-spreads.onrender.com',
 'https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const ESPN='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const MAX_BODY=11_000_000;
function cors(req:Request){
 const origin=req.headers.get('origin')||'';
 return {'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://sports-spreads.onrender.com',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'Content-Type,apikey,Authorization,x-refresh-token',
  'vary':'Origin'};
}
function reply(req:Request,code:number,payload:unknown){
 return new Response(JSON.stringify(payload),{status:code,
  headers:{...cors(req),'content-type':'application/json',
   'cache-control':req.method==='GET'?'public,max-age=300':'no-store',
   'x-content-type-options':'nosniff'}});
}
async function db(path:string,options:RequestInit={}){
 const resp=await fetch(HOST+'/rest/v1/'+path,{...options,
  headers:{...HEADERS,...options.headers},signal:AbortSignal.timeout(13000)});
 if(!resp.ok)throw Error('Cached NFL availability database unavailable '+resp.status);
 const body=await resp.text();return body.trim()?JSON.parse(body):null;
}
async function approved(req:Request){
 const tok=req.headers.get('x-refresh-token')||'';
 if(!/^[a-f0-9]{64}$/i.test(tok))return false;
 try{return await db('rpc/verify_sports_odds_refresh_token',{
  method:'POST',body:JSON.stringify({p_token:tok})})===true;}
 catch{return false;}
}
async function source(path:string,cap=MAX_BODY){
 const response=await fetch(ESPN+path,{headers:{accept:'application/json'},
  signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('ESPN public source HTTP '+response.status);
 const announced=Number(response.headers.get('content-length')||'0');
 if(announced>cap)throw Error('Public source larger than limit');
 const raw=await response.text();
 if(raw.length>cap)throw Error('Public source exceeded size limit');
 return JSON.parse(raw);
}
function upcomingGames(data:any,now:number){
 if(!Array.isArray(data?.events))throw Error('NFL scoreboard source has no event list');
 const gameMap=new Map();
 for(const e of data.events){
  if(e?.status?.type?.state!=='pre')continue;
  const kickoff=Date.parse(e.date||''),id=String(e.id||'');
  const c=e.competitions?.[0]?.competitors||[],
   home=c.find((x:any)=>x.homeAway==='home'),
   away=c.find((x:any)=>x.homeAway==='away');
  const homeTeamId=String(home?.team?.id||''),awayTeamId=String(away?.team?.id||'');
  if(!/^\d{1,12}$/.test(id)||!/^\d{1,12}$/.test(homeTeamId)||
    !/^\d{1,12}$/.test(awayTeamId)||homeTeamId===awayTeamId||
    !Number.isFinite(kickoff)||kickoff<=now||kickoff>now+9*86400_000)continue;
  gameMap.set(id,{gameId:id,start:new Date(kickoff).toISOString(),homeTeamId,awayTeamId});
 }
 return [...gameMap.values()].sort((a,b)=>a.start.localeCompare(b.start)).slice(0,24);
}
async function refresh(){
 const observedAt=new Date().toISOString(),time=Date.parse(observedAt);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit'}).format(new Date(observedAt)).replace('-','');
 const scoreboard=await source('/scoreboard?dates='+month+'&limit=100',1_200_000);
 // Request the following calendar month only near rollover, without year-wide truncation.
 let events=scoreboard.events||[];
 if(Number(month.slice(4))&&Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',day:'2-digit'}).format(new Date(observedAt)))>=25){
  const nextMonth=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(4)),7));
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(nextMonth).replace('-','');
  const more=await source('/scoreboard?dates='+date+'&limit=100',1_200_000);
  events=[...events,...(more.events||[])];
 }
 const fixtures=upcomingGames({events},time);
 if(!fixtures.length)throw Error('No qualifying upcoming NFL fixtures; existing snapshot preserved');
 // Missing ESPN data must remain UNKNOWN, not healthy or confirmed.
 let injuries=new Map(),injurySource='unavailable';
 try{
  const payload=await source('/injuries');
  const seasonYear=Number(payload?.season?.year||0);
  const year=new Date(observedAt).getUTCFullYear();
  if(seasonYear!==year)throw Error('ESPN injury source season mismatch');
  injuries=parseLeagueInjuries(payload,{observedAt});
  if(!injuries.size)throw Error('No valid team groups in injury source');
  injurySource='retrieved';
 }catch{injuries=new Map();injurySource='unavailable';}
 const ids=[...new Set(fixtures.flatMap(f=>[f.homeTeamId,f.awayTeamId]))];
 const charts=new Map(),errorTeams=[];
 for(let i=0;i<ids.length;i+=6){
  await Promise.all(ids.slice(i,i+6).map(async id=>{
   try{
    const payload=await source('/teams/'+id+'/depthcharts',1_000_000);
    if(!Array.isArray(payload?.depthchart)&&!Array.isArray(payload?.depthCharts))throw Error('No usable depth charts');
    charts.set(id,payload);
   }catch{errorTeams.push(id);}
  }));
 }
 const snapshot={...buildPregameAvailability({fixtures,injuries,depthCharts:charts,observedAt}),
  injurySourceStatus:injurySource,depthChartTeams:charts.size,
  sourceFailures:errorTeams.length,sourceType:'ESPN unofficial JSON',
  noPaidApiRequests:true};
 // Refuse to overwrite an existing useful snapshot if ALL sources fail.
 if(charts.size===0&&injurySource==='unavailable')
  throw Error('Both ESPN sources unavailable; old cache preserved');
 await db('sports_nfl_availability_latest?on_conflict=id',{method:'POST',
  headers:{prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify([{id:1,snapshot,updated_at:observedAt}])});
 return {status:'updated',generatedAt:observedAt,games:snapshot.games.length,
  teamsWithChart:charts.size,teamsAttempted:ids.length,injurySourceStatus:injurySource,
  sourceFailures:errorTeams.length,probabilitiesChanged:false};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(!['GET','POST'].includes(req.method))return reply(req,405,{error:'Unsupported method'});
 if(new URL(req.url).search)return reply(req,400,{error:'This function serves one shared NFL snapshot'});
 if(!HOST||!KEY)return reply(req,503,{status:'unavailable',games:[]});
 if(req.method==='GET'){
  try{
   const rows=await db('sports_nfl_availability_latest?id=eq.1&select=snapshot,updated_at&limit=1');
   const row=rows?.[0];
   if(!row)return reply(req,200,{status:'pending',games:[]});
   const age=Date.now()-Date.parse(row.updated_at||'');
   if(!Number.isFinite(age)||age<0||age>36*3600_000)
    return reply(req,200,{status:'stale',games:[],note:'Last source snapshot exceeded 36 hours'});
   return reply(req,200,{status:'cached',...row.snapshot});
  }catch{return reply(req,503,{status:'unavailable',games:[]});}
 }
 if(!(await approved(req)))return reply(req,403,{error:'Private scheduled refresh only'});
 try{return reply(req,200,await refresh());}
 catch(e){return reply(req,503,{status:'failed',error:String(e?.message||e).slice(0,170)});}
});
