// Daily suggested-ticket research; no provider APIs are called here.
// GET is public cached data. POST requires the private Vault-backed cron token.
import {buildDailySuggestions} from './generator.mjs';
const originAllow=new Set(['https://sports-spreads.onrender.com','https://sports-spreads-v3.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const host=Deno.env.get('SUPABASE_URL')||'';
let secret='';
try{secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||secret;
const adminHeaders={'apikey':key,'content-type':'application/json',...(key.startsWith('sb_secret_')?{}:{authorization:'Bearer '+key})};
const dayET=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function cors(req:Request){const origin=req.headers.get('origin')||'';return {'access-control-allow-origin':originAllow.has(origin)?origin:'https://sports-spreads.onrender.com',
 'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type,Authorization,apikey,x-refresh-token','vary':'Origin'};}
function answer(req:Request,status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:{...cors(req),'content-type':'application/json','cache-control':req.method==='GET'?'public,max-age=600':'no-store','x-content-type-options':'nosniff'}});}
async function api(path:string,options:RequestInit={}){
 const res=await fetch(host+'/rest/v1/'+path,{...options,headers:{...adminHeaders,...options.headers},signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('Daily suggestion cache unavailable ('+res.status+')');
 const text=await res.text();return text.trim()?JSON.parse(text):null;
}
async function authorized(req:Request){
 const token=req.headers.get('x-refresh-token')||'';
 if(!/^[a-f0-9]{64}$/i.test(token))return false;
 try{return await api('rpc/verify_sports_odds_refresh_token',{method:'POST',body:JSON.stringify({p_token:token})})===true;}
 catch{return false;}
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(!['GET','POST'].includes(req.method))return answer(req,405,{error:'Unsupported method'});
 if(!host||!key)return answer(req,503,{status:'unavailable',error:'Database configuration incomplete'});
 const u=new URL(req.url);
 if([...u.searchParams.keys()].length)return answer(req,400,{error:'Daily suggestions use the shared date; no custom refresh parameters'});
 const date=dayET();
 if(req.method==='GET'){
  try{
   const rows=await api('sports_daily_tickets?date_et=eq.'+date+'&select=snapshot,generated_at&limit=1');
   return answer(req,200,rows?.[0]?{status:'ready',...rows[0].snapshot}:{status:'pending',dateET:date,cards:[],note:'Daily suggestions are published only after the scheduled refresh. No provider credits were consumed.'});
  }catch{return answer(req,503,{status:'unavailable',cards:[]});}
 }
 if(!(await authorized(req)))return answer(req,403,{error:'Private daily refresh only'});
 try{
  const existing=await api('sports_daily_tickets?date_et=eq.'+date+'&select=generated_at&limit=1');
  if(existing?.length)return answer(req,200,{status:'already_generated',dateET:date,generatedAt:existing[0].generated_at,note:'Daily cards are generated at most once per Eastern day.'});
  const sourceRows=await api('sports_odds_cache?select=league,snapshot,fetched_at&limit=4');
  const snapshot=buildDailySuggestions(sourceRows||[],{now:new Date()});
  // Missing cards are explicitly unavailable. No future fixtures are invented.
  await api('sports_daily_tickets?on_conflict=date_et',{method:'POST',
   headers:{prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify([{date_et:date,generated_at:snapshot.generatedAt,snapshot}])});
  return answer(req,200,{status:'generated',dateET:date,available:snapshot.cards.filter(c=>c.available).map(c=>c.id)});
 }catch{return answer(req,503,{status:'failed',error:'Cannot generate sourced daily tickets from cached odds'});}
});
