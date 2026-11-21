// Daily suggested-ticket research; no provider APIs are called here.
// GET is public cached data. POST requires the private Vault-backed cron token.
import {buildDailySuggestions,DAILY_TICKETS_VERSION} from './generator.mjs';
import {evaluatePregameParlay} from './pregame-parlay-engine.mjs';
import {extractCachedOffers} from './market-normalizer.mjs';
const originAllow=new Set(['https://sports-spreads.onrender.com','https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
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
   // All upcoming fixtures are derived from the existing shared cache.
   // No paid odds calls, speculative player prices or fabricated model records.
   const sources=await api('sports_odds_cache?select=league,snapshot,fetched_at&league=in.(nfl,nba,mlb)&limit=4');
   const now=new Date();
   const perGame=[];
   for(const row of sources||[]){
    const age=now.getTime()-Date.parse(row.fetched_at||'');
    if(!Number.isFinite(age)||age<0||age>8*3600000)continue;
    for(const event of row.snapshot?.events||[]){
     const start=event?.commence_time;
     if(!event||({americanfootball_nfl:"nfl",basketball_nba:"nba",baseball_mlb:"mlb"} as Record<string,string>)[event.sport_key]!==row.league||!event.id||!start||!Number.isFinite(Date.parse(start)))continue;
     const minutes=(Date.parse(start)-now.getTime())/60000;
     if(minutes<=0||minutes>60)continue;
     const game={id:String(event.id),league:row.league,start};
     const normalized=extractCachedOffers(event);
     const result=evaluatePregameParlay(game,normalized.offers,{now});
     perGame.push({gameId:game.id,league:game.league,start,homeTeam:String(event.home_team||'').slice(0,100),
      awayTeam:String(event.away_team||'').slice(0,100),status:result.status,reason:result.reason,legs:[],marketCoverage:normalized.counts});
    }
   }
   const snapshot=rows?.[0]?(rows[0].snapshot?.version===DAILY_TICKETS_VERSION?rows[0].snapshot:buildDailySuggestions(sources||[],{now})):{status:'pending',dateET:date,cards:[]};
   return answer(req,200,{...snapshot,pregame:{asOf:now.toISOString(),games:perGame,modelStatus:'not_validated',source:'shared_odds_cache'}});

  }catch{return answer(req,503,{status:'unavailable',cards:[]});}
 }
 if(!(await authorized(req)))return answer(req,403,{error:'Private daily refresh only'});
 try{
  const existing=await api('sports_daily_tickets?date_et=eq.'+date+'&select=generated_at&limit=1');
  if(existing?.length)return answer(req,200,{status:'already_generated',dateET:date,generatedAt:existing[0].generated_at,note:'Daily cards are generated at most once per Eastern day.'});
  const sourceRows=await api('sports_odds_cache?select=league,snapshot,fetched_at&league=in.(nfl,nba,mlb)&limit=4');
  const snapshot=buildDailySuggestions(sourceRows||[],{now:new Date()});
  // Missing cards are explicitly unavailable. No future fixtures are invented.
  await api('sports_daily_tickets?on_conflict=date_et',{method:'POST',
   headers:{prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify([{date_et:date,generated_at:snapshot.generatedAt,snapshot}])});
  return answer(req,200,{status:'generated',dateET:date,available:snapshot.cards.filter(c=>c.available).map(c=>c.id)});
 }catch{return answer(req,503,{status:'failed',error:'Cannot generate sourced daily tickets from cached odds'});}
});
