// Server-side bookmaker odds cache. PUBLIC GET IS READ-ONLY AND NEVER SPENDS PROVIDER CREDITS.
// A separate explicitly authenticated POST is required to refresh cached odds.
// Free-plan guard: 1 US region * 1 market (h2h) = 1 credit per upstream request;
// 8h per-league cache, 400 max reserved credits per UTC month (free tier has 500).
const LEAGUES:Record<string,string>={nfl:'americanfootball_nfl',nba:'basketball_nba',nhl:'icehockey_nhl',mlb:'baseball_mlb'};
const ORIGINS=new Set(['https://sports-spreads.onrender.com','https://sports-spreads-v3.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const CACHE_MS=8*60*60*1000;const MAX_PER_MONTH=400;
const MAX_BOOKS=35,MAX_EVENTS=120;
function cors(req:Request){const origin=req.headers.get('origin')||'';return {'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://sports-spreads.onrender.com','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'apikey, authorization, content-type','vary':'Origin'};}
function out(req:Request,status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':req.method==='GET'?'public,max-age=300':'no-store','x-content-type-options':'nosniff'}});}
const serviceUrl=Deno.env.get('SUPABASE_URL')||'';
let currentSecret='';
try{currentSecret=(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default)||'';}catch{}
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||currentSecret;
const adminHeaders={'apikey':serviceKey,'content-type':'application/json',...(serviceKey.startsWith('sb_secret_')?{}:{'authorization':'Bearer '+serviceKey})};
async function api(path:string,options:RequestInit={}){
 const res=await fetch(serviceUrl+'/rest/v1/'+path,{...options,headers:{...adminHeaders,...options.headers},signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw Error('Cache provider unavailable ('+res.status+')');
 return res.status===204?null:await res.json();
}
function safeData(x:unknown,league:string){
 if(!Array.isArray(x))throw Error('Unexpected sportsbook event data');
 return x.slice(0,MAX_EVENTS).filter(e=>e&&typeof e==='object'&&e.sport_key===LEAGUES[league]&&typeof e.home_team==='string'&&typeof e.away_team==='string').map(e=>({
  id:String(e.id||'').slice(0,100),sport_key:e.sport_key,
  commence_time:String(e.commence_time||'').slice(0,50),home_team:e.home_team.slice(0,100),away_team:e.away_team.slice(0,100),
  bookmakers:Array.isArray(e.bookmakers)?e.bookmakers.slice(0,MAX_BOOKS).map((b:Record<string,unknown>)=>({key:String(b.key||'').slice(0,55),title:String(b.title||'').slice(0,100),last_update:String(b.last_update||'').slice(0,50),markets:Array.isArray(b.markets)?b.markets.filter((m:Record<string,unknown>)=>m.key==='h2h').slice(0,1).map((m:Record<string,unknown>)=>({key:'h2h',last_update:String(m.last_update||'').slice(0,50),outcomes:Array.isArray(m.outcomes)?m.outcomes.filter((o:Record<string,unknown>)=>typeof o.name==='string'&&Number.isInteger(o.price)&&Math.abs(o.price)>=100&&Math.abs(o.price)<=100000).slice(0,3).map((o:Record<string,unknown>)=>({name:String(o.name).slice(0,100),price:o.price})):[]})):[]})):[]
 }));
}
// Visitors can never trigger a licensed API request. They read only the shared cache.
// The owner can later configure THE_ODDS_API_KEY and a long, private
// SPORTS_SPREADS_REFRESH_TOKEN, then run an administrative refresh remotely.
function normalizeName(x:string){return String(x||'').normalize('NFKD').toLowerCase().replace(/\bst[.]?\b/g,'saint').replace(/\bthe\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
const ALIASES:Record<string,string>={'la clippers':'los angeles clippers','la lakers':'los angeles lakers','ny knicks':'new york knicks','ny rangers':'new york rangers','ny islanders':'new york islanders','nj devils':'new jersey devils','tb lightning':'tampa bay lightning','sf giants':'san francisco giants','sd padres':'san diego padres','kc royals':'kansas city royals','st louis cardinals':'st louis cardinals','st louis blues':'st louis blues','oakland athletics':'athletics'};
const canonical=(s:string)=>ALIASES[normalizeName(s)]||normalizeName(s);
async function cachedLeague(league:string){const rows=await api('sports_odds_cache?league=eq.'+league+'&select=snapshot,fetched_at&limit=1');return rows?.[0]||null;}
function snapshotRow(cached:any,status='cached'){
 const age=Date.now()-Date.parse(cached.fetched_at);
 return {...cached.snapshot,status,asOf:cached.fetched_at,ageMinutes:Math.max(0,Math.floor(age/60000)),source:'The Odds API · cached US moneylines'};
}
function filtered(snapshot:any,home:string,away:string,start:string){
 const matches=(snapshot.events||[]).filter((e:any)=>canonical(e.home_team)===canonical(home)&&canonical(e.away_team)===canonical(away)&&Math.abs(Date.parse(e.commence_time)-Date.parse(start))<=36*3600*1000);
 return {...snapshot,events:matches.length===1?matches:[],note:matches.length===1?'One sourced match. Verify current price directly with the sportsbook.':'No unambiguous game and sportsbook matchup; no prices were inferred.'};
}
function administrative(req:Request){
 const expect=Deno.env.get('SPORTS_SPREADS_REFRESH_TOKEN')||'';
 const got=req.headers.get('x-refresh-token')||'';
 // Never enable administrative mode without an owner-configured long random token.
 return expect.length>=32 && got.length>=32 && got===expect;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(!['GET','POST'].includes(req.method))return out(req,405,{error:'Read-only public odds; owner refresh only'});
 const u=new URL(req.url),league=u.searchParams.get('league')||'';
 if(!Object.hasOwn(LEAGUES,league))return out(req,400,{error:'Unsupported sports league'});
 if(!serviceUrl||!serviceKey)return out(req,503,{status:'unavailable',events:[],error:'Sportsbook cache unavailable'});
 if(req.method==='POST'){
  if(!administrative(req))return out(req,403,{error:'Owner authorization required'});
  if([...u.searchParams.keys()].some(k=>k!=='league'))return out(req,400,{error:'Unexpected refresh parameters'});
  const key=Deno.env.get('THE_ODDS_API_KEY');
  if(!key)return out(req,503,{status:'needs_key',error:'Free odds provider key not configured'});
  let old:any=null;
  try{old=await cachedLeague(league);}catch{return out(req,503,{error:'Cache unavailable'});}
  if(old&&Date.now()-Date.parse(old.fetched_at)<CACHE_MS)return out(req,200,{status:'cached',asOf:old.fetched_at,refreshAfter:new Date(Date.parse(old.fetched_at)+CACHE_MS).toISOString(),note:'No API credits consumed'});
  const period=new Date().toISOString().slice(0,7);
  let reserve:any=null;
  try{reserve=await api('rpc/reserve_sports_odds_credit',{method:'POST',body:JSON.stringify({p_period:period,p_cost:1,p_ceiling:MAX_PER_MONTH})});}
  catch{return out(req,503,{status:'unavailable',error:'Monthly credit limit guard unavailable'});}
  if(reserve===null)return out(req,200,{status:'quota_paused',note:'Owner budget reached: no paid request was made'});
  try{
   const upstream=new URL(`https://api.the-odds-api.com/v4/sports/${LEAGUES[league]}/odds/`);
   upstream.searchParams.set('apiKey',key);upstream.searchParams.set('regions','us');upstream.searchParams.set('markets','h2h');upstream.searchParams.set('oddsFormat','american');
   const response=await fetch(upstream.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8500)});
   if(!response.ok)throw Error('Odds provider not available');
   const events=safeData(await response.json(),league);
   const asOf=new Date().toISOString();
   const next={status:'ok',league,events,asOf,source:'The Odds API · US moneyline snapshot',warning:'Prices change. Verify at the sportsbook.'};
   await api('sports_odds_cache?on_conflict=league',{method:'POST',headers:{'prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{league,snapshot:next,fetched_at:asOf}])});
   return out(req,200,{status:'refreshed',league,eventCount:events.length,asOf,reservedMonthlyCredits:reserve});
  }catch{return out(req,502,{status:'provider_failed',error:'Upstream request failed; earlier cache has not been changed'});}
 }
 // PUBLIC: zero upstream calls, no quota reservation and no provider key access.
 const home=u.searchParams.get('home')||'',away=u.searchParams.get('away')||'',start=u.searchParams.get('start')||'';
 if([...u.searchParams.keys()].some(x=>!['league','home','away','start'].includes(x))||!/^.{3,100}$/.test(home)||!/^.{3,100}$/.test(away)||!Number.isFinite(Date.parse(start)))return out(req,400,{error:'Invalid matchup'});
 let row:any=null;
 try{row=await cachedLeague(league);}catch{return out(req,503,{status:'unavailable',events:[],error:'Shared bookmaker cache unavailable'});}
 if(!row)return out(req,200,{status:Deno.env.get('THE_ODDS_API_KEY')?'waiting_refresh':'needs_key',events:[],note:'No admin-refreshed bookmaker snapshot. Visitors never spend provider credits.'});
 const age=Date.now()-Date.parse(row.fetched_at);
 const valid=Number.isFinite(age)&&age>=0&&age<CACHE_MS;
 return out(req,200,filtered(snapshotRow(row,valid?'cached':'stale'),home,away,start));
});
