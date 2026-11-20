/* Sports Spreads v3.1 — progressive disclosure, no fabricated model results. */
const MODES={games:'Games',teams:'Teams',tickets:'Builder',history:'Saved',about:'About'};
const SPORTS={nfl:{label:'NFL',emoji:'🏈'},nba:{label:'NBA',emoji:'🏀'},mlb:{label:'MLB',emoji:'⚾'}};
// Browser-side read-only fallback for free static hosting. Unofficial site data, not a licensed odds source.
const ESPN_SPORT={nfl:'football/nfl',nba:'basketball/nba',mlb:'baseball/mlb'};
function directBase(league){if(!ESPN_SPORT[league])throw Error('Unsupported sport');return `https://site.api.espn.com/apis/site/v2/sports/${ESPN_SPORT[league]}`;}
async function directJson(url){
 const relay=globalThis.SS_FEED_CONFIG?.url;
 const origins=[];
 if(typeof relay==='string'&&/^https:\/\/[-a-z0-9.]+\.supabase\.co\/functions\/v1\/sports-feed$/i.test(relay)){
  const parsed=new URL(url);
  if(parsed.hostname==='site.api.espn.com')origins.push(relay+'?path='+encodeURIComponent(parsed.pathname+parsed.search));
 }
 // Read-only fallback. Keep a strict total deadline and reserve time for ESPN if the relay stalls.
 origins.push(url);
 const totalDeadline=Date.now()+12000;
 let failure='Sports feed unavailable';
 for(let i=0;i<origins.length;i++){
  const remaining=totalDeadline-Date.now();
  if(remaining<=0)break;
  // A slow relay cannot consume the entire deadline when direct ESPN is available.
  const timeoutMs=Math.min(remaining,i<origins.length-1?6500:remaining);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
   const r=await fetch(origins[i],{signal:ctrl.signal,headers:{Accept:'application/json'}});
   if(!r.ok){failure='Sports provider returned '+r.status;continue;}
   const data=await r.json();
   if(data?.error){failure=String(data.error);continue;}
   return data;
  }catch(e){failure=e?.name==='AbortError'?'Sports feed timed out':(e?.message||failure);}
  finally{clearTimeout(timer);}
 }
 throw Error(failure);
}
function mapDirectTeam(x,c={}){return {id:String(x.id??c.id??''),name:x.displayName??x.name??x.shortDisplayName??'Unknown team',abbr:x.abbreviation??'',shortName:x.shortDisplayName??x.name??'',record:c.records?.find(y=>y.type==='total')?.summary??c.records?.[0]?.summary??null,logo:x.logo??x.logos?.[0]?.href??null,score:c.score?.displayValue??c.score?.value??c.score??null};}
function mapDirectEvent(e,l){const c=e.competitions?.[0]??{},cs=c.competitors??[],home=cs.find(x=>x.homeAway==='home')??cs[0]??{},away=cs.find(x=>x.homeAway==='away')??cs[1]??{};let status=e.status?.type??{};return {id:String(e.id??''),league:l,home:mapDirectTeam(home.team??{},home),away:mapDirectTeam(away.team??{},away),start:e.date??c.date??null,status:status.state==='in'?'live':status.state==='post'?'final':'scheduled',statusText:status.shortDetail??status.detail??'Scheduled',venue:c.venue?.fullName??c.venue?.name??null,venueCity:c.venue?.address?.city??null,venueState:c.venue?.address?.state??null,venueCountry:c.venue?.address?.country??null,venueIndoor:typeof c.venue?.indoor==='boolean'?c.venue.indoor:null,venueLatitude:c.venue?.latitude??null,venueLongitude:c.venue?.longitude??null,marketLine:null,model:null,demo:false};}
function mapDirectPlayer(item){const p=item.athlete??item;return {id:String(p.id??''),name:p.displayName??p.fullName??p.name??'Player',position:p.position?.abbreviation??item.position?.abbreviation??'',jersey:p.jersey??'',headshot:p.headshot?.href??null,profileUrl:p.links?.[0]?.href??null};}
// Read-only API-Sports daily game cache. This never spends provider credits.
async function apiSportsBoard(league,date){
 const today=new Date().toISOString().slice(0,10);
 if(date&&date!==today.replaceAll('-',''))return null;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
 try{
  const res=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/api-sports-cache?league='+league,{signal:ctrl.signal});
  if(!res.ok)return null;
  const snapshot=await res.json();
  if(!snapshot.cached||snapshot.data?.date!==today||!Array.isArray(snapshot.data?.games))return null;
  const games=snapshot.data.games.map(item=>{
   const game=item.game??item,home=item.teams?.home??{},away=item.teams?.away??item.teams?.visitors??{};
   const start=game.date?.start??game.date?.date??game.date??item.date?.start??item.date;
   const raw=String(game.status?.long??item.status?.long??item.status?.short??'Scheduled');
   const status=/final|finished|ended/i.test(raw)?'final':/live|progress|quarter|period|half/i.test(raw)?'live':'scheduled';
   const team=(t,side)=>({id:String(t.id??''),name:t.name??'',abbr:t.code??'',shortName:t.name??'',logo:t.logo??null,score:item.scores?.[side]?.total??item.scores?.[side]?.points??(side==='away'?item.scores?.visitors?.points??item.scores?.visitors?.total:null)??null});
   return {id:String(game.id??item.id??''),league,home:team(home,'home'),away:team(away,'away'),start:typeof start==='string'?start:null,status,statusText:raw,venue:null,marketLine:null,model:null,demo:false};
  }).filter(g=>g.id&&g.home.id&&g.away.id&&g.start);
  return games.length?{source:'API-Sports daily cache',updatedAt:snapshot.fetched_at,cache:'shared-daily',league,date:date||today.replaceAll('-',''),games}:null;
 }catch{return null;}finally{clearTimeout(timer);}
}
async function directSportsData(route){
 const u=new URL(route,'https://local.invalid'),seg=u.pathname.split('/').filter(Boolean),league=u.searchParams.get('league')||'nba';
 let base=directBase(league),payload;
 const timestamp=new Date().toISOString(),meta={source:'ESPN public website feed (unofficial)',updatedAt:timestamp,cache:'relay-or-direct'};
 if(u.pathname==='/api/scoreboard'){
  const date=u.searchParams.get('date')||'';if(date&&!/^\d{8}$/.test(date))throw Error('Invalid game date');
  if(league==='nba'){const cached=await apiSportsBoard(league,date);if(cached)return cached;}
  payload=await directJson(base+'/scoreboard'+(date?'?dates='+date+'&limit=100':'?limit=100'));
  return {...meta,league,date,games:(payload.events||[]).map(e=>mapDirectEvent(e,league))};
 }
 if(u.pathname==='/api/teams'){
  payload=await directJson(base+'/teams?limit=100');
  return {...meta,teams:(payload.sports?.[0]?.leagues?.[0]?.teams??payload.teams??[]).map(t=>mapDirectTeam(t.team??t))};
 }
 if(seg[0]==='api'&&seg[1]==='team'&&seg.length===4){
  const sport=seg[2],id=seg[3],view=u.searchParams.get('view')||'profile';base=directBase(sport);
  if(!/^\d{1,12}$/.test(id))throw Error('Invalid team ID');
  if(view==='roster'){
   payload=await directJson(`${base}/teams/${id}/roster`);
   const groups=payload.athletes??payload.items??[];
   return {...meta,roster:groups.flatMap(g=>Array.isArray(g.items)?g.items:Array.isArray(g.athletes)?g.athletes:[g]).filter(p=>p.id||p.athlete?.id).map(mapDirectPlayer)};
  }
  if(view==='injuries'){
   payload=await directJson(`${base}/injuries`);const groups=payload.teams??payload.items??payload.injuries??[];
   const match=groups.filter(t=>String(t.id??t.team?.id??t.teamId??'')===id);
   const rows=match.length?match.flatMap(t=>t.injuries??t.items??[]):Array.isArray(payload.injuries)?payload.injuries.filter(x=>String(x.team?.id??x.teamId??'')===id):[];
   return {...meta,injuries:rows.map(x=>({name:x.athlete?.displayName??x.player?.displayName??x.athlete?.name??x.name??'Player',status:x.status??x.type?.name??'Listed',detail:x.longComment??x.shortComment??'',injury:x.type?.name??x.injury?.type??'',updated:x.date??null})),note:'Only provider-listed injuries; absence does not confirm a healthy roster.'};
  }
  if(view==='news'){
   payload=await directJson(`${base}/news?limit=50`);const all=(payload.articles??payload.news??[]).map(a=>({headline:a.headline??a.title??'',description:a.description??a.summary??'',published:a.published??a.lastModified??null,url:a.links?.web?.href??a.links?.[0]?.href??a.link??null})).filter(a=>a.headline);
   const name=(u.searchParams.get('name')||'').toLowerCase();const related=all.filter(a=>(a.headline+' '+a.description).toLowerCase().includes(name));
   return {...meta,articles:(related.length?related:all).slice(0,12),scope:related.length?'team-related':'league-wide'};
  }
  if(view==='profile'){
   payload=await directJson(`${base}/teams/${id}`);const t=payload.team??payload;
   return {...meta,team:{...mapDirectTeam(t),standing:t.standingSummary??null}};
  }
 }
 throw Error('No such data endpoint');
}
async function readSportsData(url){
 // Static hosts cannot serve /api/*; avoid a guaranteed 404 and its console noise.
 // Node-hosted deployments still use their local API, with the existing read-only fallback.
 if(window.__STANDALONE_PREVIEW__===true)return directSportsData(url);
 try{
  const route=new URL(url,window.location.href);
  const r=await fetch(route.href,{headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('Sports feed returned '+r.status);
  const contentType=r.headers?.get?.('content-type')||'';
  if(!contentType.includes('application/json'))throw Error('Sports feed returned non-JSON');
  const v=await r.json();
  if(v?.error)throw Error(String(v.error));
  return v;
 }catch(e){return directSportsData(url);}
}
