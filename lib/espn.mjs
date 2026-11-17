/**
 * Sports data adapter. The ESPN site API is an undocumented, best-effort
 * demonstration source and is not guaranteed or licensed for production use.
 * Use a separately licensed feed before public commercialization.
 */
export const LEAGUES = Object.freeze({
  nfl: { label: 'NFL', sport: 'football', league: 'nfl', icon: '🏈' },
  nba: { label: 'NBA', sport: 'basketball', league: 'nba', icon: '🏀' },
  nhl: { label: 'NHL', sport: 'hockey', league: 'nhl', icon: '🏒' },
  mlb: { label: 'MLB', sport: 'baseball', league: 'mlb', icon: '⚾' }
});

const memoryCache = new Map();
const API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports';
const MAX_CACHE_ENTRIES = 200;

export class UpstreamError extends Error {
  constructor(message, status = 502) {super(message);this.status=status;}
}
export function leagueConfig(league) {
  const config=LEAGUES[league];
  if(!config) throw new UpstreamError('Unsupported sport',400);
  return config;
}
function routeBase(league) {
  const c=leagueConfig(league);
  return `${API_ROOT}/${c.sport}/${c.league}`;
}
async function upstream(url, ttl=90000) {
  const now=Date.now();const key=url.toString();const entry=memoryCache.get(key);
  if(entry && entry.expires>now) return {...entry.value, cache:'hit'};
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),7000);
  try {
    const resp=await fetch(url,{headers:{accept:'application/json','user-agent':'SportsSpreadsPrototype/0.1'},signal:controller.signal});
    if(!resp.ok)throw new UpstreamError(`Upstream returned ${resp.status}`,resp.status===404?404:502);
    const data=await resp.json();
    const value={data,fetchedAt:new Date().toISOString(),source:'ESPN site feed (unofficial)',cache:'miss'};
    if(memoryCache.size>=MAX_CACHE_ENTRIES) memoryCache.delete(memoryCache.keys().next().value);
    memoryCache.set(key,{value,expires:now+ttl});
    return value;
  }catch(e){
    if(entry) return {...entry.value,cache:'stale',warning:'Upstream unavailable; using stale cached data'};
    if(e instanceof UpstreamError)throw e;
    throw new UpstreamError(e.name==='AbortError'?'Sports feed timed out':'Sports feed unavailable',503);
  }finally{clearTimeout(timeout);}
}
function score(s) {if(s===null||s===undefined||s==='')return null;if(typeof s==='object')return s.displayValue??s.value??null;return s;}
function mapTeam(team, competitor={}) {
  return {
    id: String(team.id ?? competitor.id ?? ''),
    name: team.displayName ?? team.name ?? team.shortDisplayName ?? 'Unknown team',
    shortName:team.shortDisplayName ?? team.name ?? '',
    abbr: team.abbreviation ?? '',
    logo: team.logo ?? team.logos?.[0]?.href ?? null,
    record: competitor.records?.find(x=>x.type==='total')?.summary ?? competitor.records?.[0]?.summary ?? null,
    score: score(competitor.score),
    homeAway: competitor.homeAway ?? null,
    color: team.color?`#${team.color.replace('#','')}`:null
  };
}
export function normalizeEvent(event,league) {
  const competition=event.competitions?.[0]??{};
  const competitors=competition.competitors??[];
  const homeComp=competitors.find(x=>x.homeAway==='home')??competitors[0]??{};
  const awayComp=competitors.find(x=>x.homeAway==='away')??competitors[1]??{};
  const home=mapTeam(homeComp.team??{},homeComp); const away=mapTeam(awayComp.team??{},awayComp);
  const status=event.status?.type??{};
  const state=status.state??(status.completed?'post':'pre');
  const rawOdds=competition.odds?.[0]??null;
  return {
    id:String(event.id??''),league,home,away,
    start:event.date??competition.date??null,
    status:state==='in'?'live':state==='post'?'final':'scheduled',
    statusText:status.shortDetail??status.detail??(state==='post'?'Final':'Scheduled'),
    venue:competition.venue?.fullName??competition.venue?.name??null,
    venueCity:competition.venue?.address?.city??null,
    venueState:competition.venue?.address?.state??null,
    venueCountry:competition.venue?.address?.country??null,
    venueIndoor:typeof competition.venue?.indoor==='boolean'?competition.venue.indoor:null,
    venueLatitude:competition.venue?.latitude??null,
    venueLongitude:competition.venue?.longitude??null,
    broadcast:(competition.broadcasts??[]).flatMap(b=>(b.names??[])).slice(0,3),
    marketLine:rawOdds?.details??null,
    model:null, // Never invent model output from sportsbook odds or team records.
    demo:false
  };
}
export async function getScoreboard(league,date) {
  leagueConfig(league);
  if(date && !/^\d{8}$/.test(date))throw new UpstreamError('Expected YYYYMMDD date',400);
  const url=new URL(`${routeBase(league)}/scoreboard`);
  if(date)url.searchParams.set('dates',date);
  url.searchParams.set('limit','100');
  const response=await upstream(url,60000);
  return {...meta(response),league,date:date??null,games:(response.data.events??[]).map(x=>normalizeEvent(x,league))};
}
export async function getTeams(league) {
  const url=new URL(`${routeBase(league)}/teams`);url.searchParams.set('limit','100');
  const r=await upstream(url,3600000);
  const raw=r.data.sports?.[0]?.leagues?.[0]?.teams??r.data.teams??[];
  return {...meta(r),teams:raw.map(x=>mapTeam(x.team??x))};
}
export async function getTeam(league,id) {
  validateId(id);
  const r=await upstream(`${routeBase(league)}/teams/${id}`,3600000);
  const team=r.data.team??r.data;
  return {...meta(r),team:{...mapTeam(team),standing:team.standingSummary??null,location:team.location??null,venue:team.franchise?.venue?.fullName??null,officialUrl:team.links?.[0]?.href??null}};
}
export function normalizeRoster(data) {
  const root=data.athletes??data.items??[];
  const groups=Array.isArray(root)?root:[];
  const players=groups.flatMap(g=>Array.isArray(g.items)?g.items:Array.isArray(g.athletes)?g.athletes:[g]);
  return players.filter(x=>x?.id||x?.athlete?.id).map(item=>{
    const p=item.athlete??item;
    return {
      id:String(p.id),name:p.displayName??p.fullName??p.name??'Unknown player',
      position:p.position?.abbreviation??p.position?.name??item.position?.abbreviation??'',
      jersey:p.jersey??'',
      headshot:p.headshot?.href??null,
      age:p.age??null,
      status:p.status?.name??p.status?.type??null,
      profileUrl:p.links?.find(l=>l.rel?.includes('player'))?.href??p.links?.[0]?.href??null
    };
  });
}
export async function getRoster(league,id) {
  validateId(id);
  const r=await upstream(`${routeBase(league)}/teams/${id}/roster`,900000);
  const roster=normalizeRoster(r.data);
  return {...meta(r),roster,unavailable:!roster.length};
}
function injuryPlayer(x) {
  const person=x.athlete??x.player??x;
  return {
    id:String(person.id??x.id??''),name:person.displayName??person.name??'Unknown player',
    status:x.status??x.type?.name??x.details?.status??'Listed',
    detail:x.longComment??x.shortComment??x.details?.detail??x.description??x.type?.description??'',
    injury:x.type?.name??x.injury?.type??x.details?.type??'',
    updated:x.date??x.updated??null
  };
}
export function normalizeInjuries(data,teamId) {
  const teams=data.teams??data.items??data.injuries??[];
  const matches=teams.filter(t=>String(t.id??t.team?.id??t.teamId??t.team?.teamId??'')===String(teamId));
  if(matches.length) return matches.flatMap(t=>t.injuries??t.items??[]).map(injuryPlayer);
  // Alternative ESPN shapes: a top-level list of injuries with a nested team.
  if(Array.isArray(data.injuries)) return data.injuries.filter(x=>String(x.team?.id??x.teamId??'')===String(teamId)).map(injuryPlayer);
  return [];
}
export async function getInjuries(league,id) {
  validateId(id);
  const r=await upstream(`${routeBase(league)}/injuries`,300000);
  return {...meta(r),injuries:normalizeInjuries(r.data,id),note:'Only provider-listed injuries; no listing does not guarantee a healthy roster.'};
}
export function normalizeNews(data,team) {
  const all=(data.articles??data.news??[]).map(a=>({
    id:String(a.id??a.headline??''),headline:a.headline??a.title??'',
    published:a.published??a.lastModified??a.story??null,
    description:a.description??a.summary??'',
    url:a.links?.web?.href??a.links?.[0]?.href??a.link??null,
    image:a.images?.[0]?.url??null,
    category:(a.categories??[]).map(c=>String(c.description??c.type??c.name??''))
  })).filter(x=>x.headline);
  const keys=[team?.name,team?.shortName,team?.abbr].filter(Boolean).map(x=>x.toLowerCase());
  const hits=all.filter(a=>keys.some(k=>(a.headline+' '+a.description+' '+a.category.join(' ')).toLowerCase().includes(k)));
  return {articles:hits.length?hits.slice(0,15):all.slice(0,8),scope:hits.length?'team-related':'league-wide'};
}
export async function getNews(league,id,teamName) {
  validateId(id);
  const r=await upstream(`${routeBase(league)}/news?limit=50`,180000);
  return {...meta(r),...normalizeNews(r.data,{name:teamName})};
}
function meta(r) {return {source:r.source,updatedAt:r.fetchedAt,cache:r.cache,warning:r.warning??null};}
function validateId(id){if(!/^[0-9]{1,12}$/.test(String(id??'')))throw new UpstreamError('Invalid team identifier',400);}
export function americanToDecimal(odds) {
  const value=Number(odds);
  if(!Number.isInteger(value)||value===0||Math.abs(value)<100||Math.abs(value)>100000)return null;
  return value>0?1+value/100:1+100/Math.abs(value);
}
export function ticketEstimate(legs,stake) {
  if(!Array.isArray(legs)||!legs.length)return null;
  const dec=legs.map(x=>americanToDecimal(x.odds));
  if(dec.some(x=>x===null))return null;
  const amount=Number(stake);
  if(!Number.isFinite(amount)||amount<=0||amount>1000000)return null;
  const multiplier=dec.reduce((a,b)=>a*b,1);
  return {multiplier,return:amount*multiplier,profit:amount*(multiplier-1),independentImplied:1/multiplier};
}
