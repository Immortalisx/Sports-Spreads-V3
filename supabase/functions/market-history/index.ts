/**
 * Public, game-scoped read-only consensus history from the private archive.
 * NEVER contacts The Odds API or returns a league-wide raw provider dataset.
 */
const ORIGINS=new Set(['https://sports-spreads.onrender.com',
 'https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com',
 'http://localhost:4173','http://127.0.0.1:4173']);
const DB=Deno.env.get('SUPABASE_URL')||'';
let fallback='';try{fallback=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||fallback;
const headers={'apikey':KEY,'content-type':'application/json',
 ...(KEY.startsWith('sb_secret_')?{}:{authorization:'Bearer '+KEY})};
function reply(req:Request,status:number,body:unknown){
 const origin=req.headers.get('origin')||'';
 return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://sports-spreads.onrender.com',
  'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'Content-Type',
  'cache-control':'public,max-age=300','x-content-type-options':'nosniff','vary':'Origin'}});
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return reply(req,204,{});
 if(req.method!=='GET')return reply(req,405,{status:'method_not_allowed'});
 const q=new URL(req.url).searchParams,league=q.get('league')||'',eventId=q.get('event_id')||'';
 if(!['nfl','nba','nhl','mlb'].includes(league)||!/^[a-zA-Z0-9_-]{8,80}$/.test(eventId))
  return reply(req,400,{status:'invalid_fixture'});
 if(!DB||!KEY)return reply(req,503,{status:'unavailable'});
 try{
  const path='sports_market_history?select=source_as_of,game_at,home_name,away_name,home_fair,book_count'+
   '&league=eq.'+league+'&event_id=eq.'+eventId+'&order=source_as_of.desc&limit=24';
  const r=await fetch(DB+'/rest/v1/'+path,{headers,signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Archive query failed: '+r.status);
  const rows=await r.json();
  if(!Array.isArray(rows))throw Error('Invalid archive response');
  // Restrict to one verified fixture; do not mix events sharing a provider ID.
  const first=rows[0],points=rows.filter(x=>x.home_name===first?.home_name&&
   x.away_name===first?.away_name&&x.game_at===first?.game_at&&
   Number(x.home_fair)>0&&Number(x.home_fair)<1).reverse()
   .map(x=>({asOf:x.source_as_of,homeNoVig:Number(x.home_fair),books:x.book_count}));
  return reply(req,200,{status:points.length?'cached':'pending',
   league,eventId,home:first?.home_name||null,away:first?.away_name||null,
   points,source:'Archived The Odds API moneyline consensus',
   calibrated:false,appliedToForecast:false,
   note:'Historical bookmaker-implied chances; no model confidence, edge or verified payout.'});
 }catch(e){console.error('Sports market history read failed',String(e).slice(0,160));
  return reply(req,503,{status:'unavailable'});}
});