/**
 * Sports Spreads current-season form feed: cached team research signals.
 * PUBLIC GET NEVER CALLS ESPN OR ANY PAID PROVIDER.
 * PRIVATE POST runs once daily from pg_cron using the existing Vault token.
 * No unvalidated coefficient is applied to forecast probabilities.
 */
import {buildCurrentSeasonSnapshots} from './current-season-rolling.mjs';
const LEAGUES:Record<string,string>={nfl:'football/nfl',nba:'basketball/nba',
 nhl:'hockey/nhl',mlb:'baseball/mlb'};
const ORIGINS=new Set(['https://sports-spreads.onrender.com',
 'https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const DB=Deno.env.get('SUPABASE_URL')||'';
let envSecret='';try{envSecret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||envSecret;
const dbHeaders={'apikey':KEY,'content-type':'application/json',
 ...(KEY.startsWith('sb_secret_')?{}:{authorization:'Bearer '+KEY})};
const monthFormat=(date:Date)=>new Intl.DateTimeFormat('sv-SE',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(date).replace('-','');
const dateET=(date:string)=>new Intl.DateTimeFormat('sv-SE',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const status=(req:Request,http:number,body:unknown)=>new Response(JSON.stringify(body),{
 status:http,headers:{'access-control-allow-origin':ORIGINS.has(req.headers.get('origin')||'')?
 req.headers.get('origin')!:'https://sports-spreads.onrender.com',
 'access-control-allow-methods':'GET,POST,OPTIONS',
 'access-control-allow-headers':'Content-Type,x-refresh-token,apikey,Authorization',
 vary:'Origin','content-type':'application/json; charset=utf-8',
 'cache-control':req.method==='GET'?'public,max-age=300':'no-store',
 'x-content-type-options':'nosniff'}});
async function db(path:string,options:RequestInit={}){
 const resp=await fetch(DB+'/rest/v1/'+path,{...options,
  headers:{...dbHeaders,...options.headers},signal:AbortSignal.timeout(13000)});
 if(!resp.ok)throw Error('Season cache database failed: '+resp.status);
 const body=await resp.text();return body.trim()?JSON.parse(body):null;
}
async function allowed(req:Request){
 const got=req.headers.get('x-refresh-token')||'';
 if(!/^[a-f0-9]{64}$/i.test(got))return false;
 try{return await db('rpc/verify_sports_odds_refresh_token',{
  method:'POST',body:JSON.stringify({p_token:got})})===true;}catch{return false;}
}
function seasonOf(league:string,now:Date){
 const year=Number(dateET(now.toISOString()).slice(0,4)),month=Number(monthFormat(now).slice(4));
 const start=league==='nfl'?9:league==='mlb'?3:10;
 const seasonYear=month<start?year-1:year;
 return {seasonYear,start,season:String(seasonYear)+(league==='nba'||league==='nhl'?
  '-'+String((seasonYear+1)%100).padStart(2,'0'):'')};
}
function calendarMonths(start:number,end:number){
 const out:string[]=[];let y=Math.floor(start/100),m=start%100;
 while(y*100+m<=end){
  out.push(String(y)+String(m).padStart(2,'0'));m++;if(m>12){m=1;y++;}
  if(out.length>13)throw Error('Season-month coverage exceeded safe cap');
 }
 return out;
}
function score(c:any){
 const raw=c?.score?.displayValue??c?.score?.value??c?.score;
 if((typeof raw!=='string'&&typeof raw!=='number')||! /^\d{1,3}$/.test(String(raw).trim()))return null;
 return Number(raw);
}
function parseScoreboard(payload:any,league:string):any[]{
 if(!Array.isArray(payload?.events)||payload.events.length>=1000)
  throw Error('Incomplete provider scoreboard response; refuse truncated season');
 const out:any[]=[];
 for(const e of payload.events){
  if(Number(e?.season?.type)!==2)continue; // never mix preseason or postseason
  const c=e.competitions?.[0],all=c?.competitors||[];
  const home=all.find((x:any)=>x.homeAway==='home'),away=all.find((x:any)=>x.homeAway==='away');
  const gameDate=e.date||c.date,gameId=String(e.id||'');
  if(!home||!away||!gameId||!Number.isFinite(Date.parse(gameDate||'')))continue;
  const h=String(home.team?.id||''),a=String(away.team?.id||'');
  if(!/^\d{1,12}$/.test(h)||!/^\d{1,12}$/.test(a)||h===a)continue;
  const calendarDate=dateET(gameDate);
  const game:any={id:gameId,league,date:calendarDate,
   home:h,away:a,homeName:String(home.team?.displayName||home.team?.name||'').slice(0,90),
   awayName:String(away.team?.displayName||away.team?.name||'').slice(0,90),
   start:gameDate};
  const final=e.status?.type?.state==='post';
  if(final){
   const hs=score(home),as=score(away);
   if(hs===null||as===null||hs===as)continue; // no fabricated completed result
   game.homeScore=hs;game.awayScore=as;game.final=true;
  }else if(e.status?.type?.state==='pre')game.final=false;
  else continue;
  out.push(game);
 }
 return out;
}
async function fetchMonth(league:string,month:string){
 const url='https://site.api.espn.com/apis/site/v2/sports/'+LEAGUES[league]+
  '/scoreboard?dates='+month+'&limit=1000';
 let res=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(14000)});
 if(res.status===403||res.status===429){
  // ESPN's canonical website host sometimes blocks server-side Supabase IPs.
  // Existing Sports Spreads feed uses the separate ESPN website frontend host.
  const alternate=url.replace('https://site.api.espn.com','https://site.web.api.espn.com');
  res=await fetch(alternate,{headers:{accept:'application/json'},signal:AbortSignal.timeout(14000)});
 }
 if(!res.ok)throw Error('Public results feed HTTP '+res.status);
 const raw=await res.text();
 if(raw.length>7500000)throw Error('Scoreboard source oversized');
 return parseScoreboard(JSON.parse(raw),league);
}
async function update(league:string,now:Date){
 const {seasonYear,start,season}=seasonOf(league,now),current=monthFormat(now);
 const first=seasonYear*100+start;
 let months=calendarMonths(first,Number(current));
 // The source lists games near the start/end of a UTC month. When late in a month,
 // also load the next month so upcoming games cross the month boundary.
 const today=Number(dateET(now.toISOString()).slice(8));
 if(today>=25){
  const next=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(4)),6));
  const nextMonth=monthFormat(next);
  if(!months.includes(nextMonth))months.push(nextMonth);
 }
 const rows=await db('sports_form_months?league=eq.'+league+
  '&year_month=in.('+months.join(',')+')&select=year_month,games');
 const existing=new Map((rows||[]).map((r:any)=>[r.year_month,r.games]));
 let networkCalls=0;
 for(const month of months){
  // Recheck the previous month during the first five days to catch late
  // final-score corrections and games ending after midnight Eastern.
  const currentYear=Number(current.slice(0,4)),currentMon=Number(current.slice(4));
  const prev=new Date(Date.UTC(currentYear,currentMon-2,6));
  const previous=monthFormat(prev);
  const mustRefresh=!existing.has(month)||month===current||(month===previous&&today<=5);
  if(!mustRefresh)continue;
  const events=await fetchMonth(league,month);networkCalls++;
  await db('sports_form_months?on_conflict=league,year_month',{method:'POST',
   headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify([{league,year_month:month,games:events,fetched_at:new Date().toISOString()}])});
  existing.set(month,events);
 }
 const all=new Map<string,any>();
 for(const data of existing.values()){
  if(!Array.isArray(data))throw Error('Corrupt cached monthly sports history');
  for(const e of data){
   if(!e?.id||!e.date)continue;
   if(!all.has(e.id))all.set(e.id,e);
   else if(e.final)all.set(e.id,e);
  }
 }
 const games=[...all.values()].filter(e=>e.final&&
  e.date>=String(seasonYear)+'-'+String(start).padStart(2,'0')+'-01');
 const nowMs=now.getTime();
 const fixture=[...all.values()].filter(e=>!e.final&&
  Date.parse(e.start)>nowMs&&Date.parse(e.start)<=nowMs+32*86400000);
 const built=buildCurrentSeasonSnapshots({league,season,games,fixtures:fixture});
 if((league==='nfl'||league==='nba'||league==='nhl')&&
  today>=6&&Number(current.slice(4))>=start&&built.completedGames<5)
  throw Error('Season has unexpectedly few completed games: refuse overwriting valid form snapshot');
 const snapshot={...built,generatedAt:now.toISOString(),
  source:'ESPN website scoreboard · regular season only',snapshotQuality:'research_only',
  limits:'Uses previous calendar dates only. No unsourced injuries, scheme or goalie forecasts.',
  months:months.length};
 await db('sports_form_latest?on_conflict=league',{method:'POST',
  headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify([{league,season,snapshot,updated_at:now.toISOString()}])});
 return {league,season,completed:games.length,upcoming:fixture.length,
  networkCalls,months:months.length};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':ORIGINS.has(req.headers.get('origin')||'')?
   req.headers.get('origin')!:'https://sports-spreads.onrender.com',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'Content-Type,x-refresh-token,apikey,Authorization',
  vary:'Origin'}});
 if(!['GET','POST'].includes(req.method))return status(req,405,{error:'Unsupported method'});
 const u=new URL(req.url),league=u.searchParams.get('league')||'';
 if(!LEAGUES[league]||[...u.searchParams.keys()].some(k=>k!=='league'))
  return status(req,400,{error:'Unsupported sport'});
 if(!KEY||!DB)return status(req,503,{error:'Season form backend not configured'});
 if(req.method==='GET'){
  try{
   const rows=await db('sports_form_latest?league=eq.'+league+'&select=season,snapshot,updated_at&limit=1');
   return status(req,200,rows?.[0]?{status:'cached',...rows[0].snapshot}:
    {status:'pending',league,snapshots:[],note:'Current-season history has not yet been refreshed'});
  }catch{return status(req,503,{status:'unavailable',league,snapshots:[]});}
 }
 if(!(await allowed(req)))return status(req,403,{error:'Private scheduled refresh only'});
 try{return status(req,200,{status:'updated',...(await update(league,new Date()))});}
 catch(e){return status(req,503,{status:'failed',league,error:String(e?.message||e).slice(0,200)});}
});
