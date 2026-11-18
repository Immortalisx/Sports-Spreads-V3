// Sports Spreads: restricted, cached ESPN-site feed relay.
// Public read-only endpoint, no user data and no secret keys.
const PROVIDER = "https://site.api.espn.com";
const ALLOWED = new Set(["football/nfl", "basketball/nba", "hockey/nhl", "baseball/mlb"]);
const ORIGINS = new Set(["https://sports-spreads.onrender.com","https://sports-spreads-v3.onrender.com","https://sports-spreads-v4-staging.onrender.com","http://localhost:4173","http://127.0.0.1:4173"]);
const cache = new Map<string, {data: string; expires: number}>();
function cors(req: Request): Record<string,string> {
 const origin=req.headers.get("origin")||"";
 return {"access-control-allow-origin":ORIGINS.has(origin)?origin:"https://sports-spreads.onrender.com","access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type","vary":"Origin"};
}
function reply(req: Request, status: number, body: unknown) {
 return new Response(JSON.stringify(body),{status,headers:{...cors(req),"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}
function validatePath(raw: string|null): {url:string,ttl:number}|null {
 if(!raw || raw.length>500 || !raw.startsWith("/apis/site/v2/sports/"))return null;
 let u: URL; try{u=new URL(raw,PROVIDER);}catch{return null;}
 if(u.origin!==PROVIDER)return null;
 const m=u.pathname.match(/^\/apis\/site\/v2\/sports\/(football\/nfl|basketball\/nba|hockey\/nhl|baseball\/mlb)\/(scoreboard|teams|teams\/\d{1,12}|teams\/\d{1,12}\/roster|injuries|news)$/);
 if(!m||!ALLOWED.has(m[1]))return null;
 const query = new URLSearchParams();
 for(const [key,value] of u.searchParams){
  if(key==="dates" && m[2]==="scoreboard" && /^\d{8}$/.test(value)){query.set(key,value);}
  else if(key==="limit" && ["scoreboard","teams","news"].includes(m[2]) && /^\d{1,3}$/.test(value) && +value>=1 && +value<=100){query.set(key,value);}
  else return null;
 }
 const type=m[2], ttl=type==="scoreboard"?75:type==="injuries"?180:type==="news"?300:900;
 return {url:PROVIDER+u.pathname+(query.size?"?"+query:""),ttl};
}
Deno.serve(async(req: Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="GET")return reply(req,405,{error:"Read-only feed"});
 const incoming=new URL(req.url);
 const candidate=validatePath(incoming.searchParams.get("path"));
 if(!candidate)return reply(req,400,{error:"Unsupported sports data route"});
 const cached=cache.get(candidate.url);
 if(cached && cached.expires>Date.now())return new Response(cached.data,{status:200,headers:{...cors(req),"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=30","x-feed-cache":"hit"}});
 try{
  let upstream=await fetch(candidate.url,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(6500)});
  if(upstream.status===403||upstream.status===429){
   const alternate=candidate.url.replace("https://site.api.espn.com","https://site.web.api.espn.com");
   upstream=await fetch(alternate,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(6500)});
  }
  if(!upstream.ok)return reply(req,502,{error:"Sports data provider unavailable",providerStatus:upstream.status});
  const type=upstream.headers.get("content-type")||"";
  if(!type.includes("json"))return reply(req,502,{error:"Sports provider returned a non-JSON response"});
  const data=await upstream.text();
  if(data.length>4_000_000)return reply(req,502,{error:"Sports response exceeds limit"});
  JSON.parse(data);
  if(cache.size>180)cache.clear();
  cache.set(candidate.url,{data,expires:Date.now()+candidate.ttl*1000});
  return new Response(data,{status:200,headers:{...cors(req),"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=30","x-feed-source":"ESPN-unofficial","x-feed-cache":"miss"}});
 }catch(err){return reply(req,502,{error:"Sports provider request failed; live data unavailable"});}
});
