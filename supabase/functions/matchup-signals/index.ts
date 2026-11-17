// Sports Spreads limited MLB pregame probable-starter source. No invented pitcher matchups.
// Purely descriptive. No player-level projection or win-probability coefficient.
const ORIGINS=new Set(['https://sports-spreads.onrender.com','https://sports-spreads-v3.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const cache=new Map<string,{expires:number,data:any}>();
function cors(r:Request){const x=r.headers.get('origin')||'';return {'access-control-allow-origin':ORIGINS.has(x)?x:'https://sports-spreads.onrender.com','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type, authorization, apikey','vary':'Origin'};}
function json(r:Request,code:number,data:unknown){return new Response(JSON.stringify(data),{status:code,headers:{...cors(r),'content-type':'application/json','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}});}
function norm(x:string){return x.toLowerCase().replace(/\bst[.]?\b/g,'saint').replace(/\bthe\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=='GET')return json(req,405,{error:'Read-only signals'});
 const u=new URL(req.url),league=u.searchParams.get('league')||'',date=u.searchParams.get('date')||'',home=u.searchParams.get('home')||'',away=u.searchParams.get('away')||'';
 if(league!=='mlb'||!/^20\d\d-\d\d-\d\d$/.test(date)||!/^.{3,95}$/.test(home)||!/^.{3,95}$/.test(away)||[...u.searchParams.keys()].some(x=>!['league','date','home','away'].includes(x)))return json(req,400,{error:'Unsupported matchup'});
 const key=date;let raw=cache.get(key);
 if(!raw||raw.expires<Date.now()){
  try{
   const uri=new URL('https://statsapi.mlb.com/api/v1/schedule');
   uri.searchParams.set('sportId','1');uri.searchParams.set('date',date);uri.searchParams.set('hydrate','probablePitcher,team');
   const r=await fetch(uri.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(8500)});
   if(!r.ok)throw Error('Provider unavailable');const payload=await r.json();
   const games=payload.dates?.flatMap((x:any)=>x.games||[])||[];
   if(!Array.isArray(games))throw Error('Unsupported provider response');
   raw={expires:Date.now()+20*60000,data:games.slice(0,50)};
   if(cache.size>50)cache.clear();cache.set(key,raw);
  }catch{return json(req,200,{status:'unavailable',source:'MLB StatsAPI',homePitcher:null,awayPitcher:null,note:'Official probable-starter feed unavailable'});}
 }
 const matched=raw.data.filter((g:any)=>norm(g.teams?.home?.team?.name||'')===norm(home)&&norm(g.teams?.away?.team?.name||'')===norm(away));
 if(matched.length!==1)return json(req,200,{status:'unmatched',source:'MLB StatsAPI',homePitcher:null,awayPitcher:null,note:'No unambiguous MLB game match'});
 const g=matched[0];
 const pick=(s:any)=>s?.probablePitcher&&Number.isInteger(s.probablePitcher.id)&&typeof s.probablePitcher.fullName==='string'?{id:s.probablePitcher.id,name:s.probablePitcher.fullName.slice(0,90)}:null;
 const homePitcher=pick(g.teams?.home),awayPitcher=pick(g.teams?.away);
 return json(req,200,{status:'ok',source:'MLB StatsAPI · probable starters',gamePk:g.gamePk,updatedAt:new Date().toISOString(),homePitcher,awayPitcher,
  note:'Pregame probable pitchers can change; check the official lineup. No pitcher-versus-hitter model coefficient has been validated.'});
});
