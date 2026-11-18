/**
 * Free, owner-refreshed NFL coaching history cache. Public GET is game-scoped:
 * it NEVER fetches nflverse and cannot consume third-party request credits.
 * A separate privileged daily cron supplies one compact derived snapshot.
 */
import {buildCoachingSnapshot,coachingForFixture,RAW_SOURCE} from './coach-research.mjs';
const PROJECT='nwspnepkmeoytlkbltfe';
const ORIGINS=new Set(['https://sports-spreads.onrender.com',
 'https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com',
 'http://localhost:4173','http://127.0.0.1:4173']);
const DB=Deno.env.get('SUPABASE_URL')||'';
let fallback='';try{fallback=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||fallback;
const headers={'apikey':KEY,'content-type':'application/json',
 ...(KEY.startsWith('sb_secret_')?{}:{authorization:'Bearer '+KEY})};
function answer(req:Request,http:number,data:unknown){
 const origin=req.headers.get('origin')||'';
 return new Response(JSON.stringify(data),{status:http,headers:{
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://sports-spreads.onrender.com',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'content-type,x-refresh-token,apikey,authorization',
  'cache-control':req.method==='GET'?'public,max-age=300':'no-store',
  'x-content-type-options':'nosniff','vary':'Origin'}});
}
async function db(path:string,options:RequestInit={}){
 if(!DB||!KEY)throw Error('Unavailable internal DB credentials');
 const r=await fetch(DB+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers},
  signal:AbortSignal.timeout(14000)});
 if(!r.ok)throw Error('Protected coaching cache DB '+r.status);
 const t=await r.text();return t?JSON.parse(t):null;
}
async function authorized(req:Request){
 const value=req.headers.get('x-refresh-token')||'';
 if(!/^[a-f0-9]{64}$/i.test(value))return false;
 try{return await db('rpc/verify_sports_odds_refresh_token',
  {method:'POST',body:JSON.stringify({p_token:value})})===true;}
 catch{return false;}
}
function todayET(){return new Intl.DateTimeFormat('sv-SE',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return answer(req,204,{});
 if(req.method!=='GET'&&req.method!=='POST')return answer(req,405,{status:'method_not_allowed'});
 try{
  if(req.method==='GET'){
   const u=new URL(req.url),home=u.searchParams.get('home')||'',
    away=u.searchParams.get('away')||'',day=u.searchParams.get('date')||'';
   if(!/^[A-Z]{2,3}$/i.test(home)||!/^[A-Z]{2,3}$/i.test(away)||!/^20\d\d-\d\d-\d\d$/.test(day))
    return answer(req,400,{status:'invalid_fixture'});
   const cache=await db('sports_coaching_latest?id=eq.1&select=snapshot,updated_at&limit=1');
   if(!cache?.length)return answer(req,200,{status:'pending',league:'nfl'});
   const result=coachingForFixture(cache[0].snapshot,home,away,day);
   return answer(req,200,result?
    {...result,updatedAt:cache[0].updated_at}:
    {status:'unavailable',league:'nfl',note:'No verified pregame coaching history for this fixture.'});
  }
  if(!await authorized(req))return answer(req,403,{status:'forbidden'});
  const upstream=await fetch(RAW_SOURCE,{headers:{accept:'text/csv'},signal:AbortSignal.timeout(20000)});
  if(!upstream.ok)throw Error('NFL coaching source HTTP '+upstream.status);
  const raw=await upstream.text();
  const snapshot=buildCoachingSnapshot(raw,todayET());
  await db('sports_coaching_latest?on_conflict=id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates'},
   body:JSON.stringify({id:1,snapshot,updated_at:new Date().toISOString()})});
  return answer(req,200,{status:'updated',league:'nfl',sourceThrough:snapshot.sourceThrough,
   teams:Object.keys(snapshot.teams).length,rows:snapshot.rawRowsUsed});
 }catch(e){console.error('NFL coaching refresh or cache error',String(e).slice(0,180));
  return answer(req,503,{status:'unavailable',league:'nfl',note:'Verified coaching source or cache unavailable'});}
});