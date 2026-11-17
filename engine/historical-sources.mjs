/**
 * Public, no-key *research* results importers. Never redistributes raw third-party
 * data or calls these data streams during a visitor's webpage session.
 * Run manually and inspect license/terms before any commercial use.
 *
 * Import costs: NFL one CSV GET; MLB one season schedule GET; NHL 32 club
 * schedule GETs/season, NBA bounded date scans (<=31 days by default).
 */
export const SOURCE_REGISTRY = Object.freeze({
  nfl:{tier:'community_public',name:'nflverse / nfldata games.csv',url:'https://github.com/nflverse/nfldata/blob/master/data/games.csv',requestsPerSeason:1},
  mlb:{tier:'official_public',name:'MLB StatsAPI schedule',url:'https://statsapi.mlb.com/api/v1/schedule',requestsPerSeason:1},
  nhl:{tier:'official_public',name:'NHL Web API club schedules',url:'https://api-web.nhle.com/v1/club-schedule-season/',requestsPerSeason:32},
  nba:{tier:'unofficial',name:'ESPN public website scoreboard',url:'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',requestsPerSeason:'bounded dates'}
});
export const NHL_CLUBS='ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' ');
export function parseCsv(raw){
 if(typeof raw!=='string'||raw.length>20_000_000)throw Error('Unexpected CSV size');
 let rows=[],line=[],cell='',quoted=false;
 for(let i=0;i<raw.length;i++){
  const ch=raw[i];if(ch==='"'){
   if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
  }else if(ch===','&&!quoted){line.push(cell);cell='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&raw[i+1]==='\n')i++;
   line.push(cell);cell='';if(line.some(x=>x!==''))rows.push(line);line=[];
  }else cell+=ch;
 }
 if(quoted)throw Error('Malformed CSV');if(cell||line.length){line.push(cell);rows.push(line);}
 const [header,...body]=rows;
 if(!header?.includes('game_id'))throw Error('Unsupported NFL CSV header');
 return body.map(row=>Object.fromEntries(header.map((column,i)=>[column,row[i]??''])));
}
const dateRx=/^\d{4}-\d{2}-\d{2}$/;
const isoDate=d=>dateRx.test(d||'')?`${d}T12:00:00.000Z`:null;
const clean=(x,max=95)=>String(x??'').slice(0,max);
function normalized({id,league,season,date,start,homeId,awayId,homeScore,awayScore,sourceUrl,homeCoach=null,awayCoach=null}){
 if([homeScore,awayScore].some(v=>v===null||v===undefined||v===''))return null;
 const h=Number(homeScore),a=Number(awayScore);
 if(!id||!league||!dateRx.test(date||'')||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||!homeId||!awayId||homeId===awayId||!/^https:/.test(sourceUrl||''))return null;
 return {gameId:`${league}-${id}`,league,season:Number(season),gameDate:date,gameAt:start||isoDate(date),homeTeam:clean(homeId),awayTeam:clean(awayId),homeScore:h,awayScore:a,homeCoach:homeCoach?clean(homeCoach):null,awayCoach:awayCoach?clean(awayCoach):null,sourceUrl,sourceTier:SOURCE_REGISTRY[league].tier,retrospective:true};
}
export function nflFromCsv(raw,season){
 const source=SOURCE_REGISTRY.nfl.url;
 return parseCsv(raw).filter(r=>Number(r.season)===Number(season)&&r.game_type==='REG'&&r.home_score!==''&&r.away_score!==''&&r.home_score!==r.away_score).map(r=>normalized({id:r.game_id,league:'nfl',season,date:r.gameday,homeId:r.home_team,awayId:r.away_team,homeScore:r.home_score,awayScore:r.away_score,sourceUrl:source,homeCoach:r.home_coach,awayCoach:r.away_coach})).filter(Boolean);
}
export function mlbFromSchedule(payload,season){
 if(!Array.isArray(payload?.dates))throw Error('Invalid MLB schedule response');
 const src=SOURCE_REGISTRY.mlb.url;
 return payload.dates.flatMap(d=>(d.games||[]).filter(g=>g.gameType==='R'&&g.status?.abstractGameState==='Final').map(g=>normalized({id:g.gamePk,league:'mlb',season,date:g.officialDate||d.date,start:g.gameDate,homeId:g.teams?.home?.team?.id,awayId:g.teams?.away?.team?.id,homeScore:g.teams?.home?.score,awayScore:g.teams?.away?.score,sourceUrl:src}))).filter(Boolean);
}
export function nhlFromClubSchedule(payload,season){
 if(!Array.isArray(payload?.games))throw Error('Invalid NHL club schedule response');
 const src=SOURCE_REGISTRY.nhl.url;
 return payload.games.filter(g=>g.gameType===2&&['OFF','FINAL'].includes(g.gameState)&&g.homeTeam?.score!==undefined&&g.awayTeam?.score!==undefined).map(g=>normalized({id:g.id,league:'nhl',season,date:g.gameDate,start:g.startTimeUTC,homeId:g.homeTeam?.abbrev,awayId:g.awayTeam?.abbrev,homeScore:g.homeTeam?.score,awayScore:g.awayTeam?.score,sourceUrl:src})).filter(Boolean);
}
export function nbaFromScoreboard(payload,season){
 if(!Array.isArray(payload?.events))throw Error('Invalid NBA scoreboard response');
 const src=SOURCE_REGISTRY.nba.url;
 return payload.events.filter(g=>g.status?.type?.completed===true).map(g=>{
  const comp=g.competitions?.[0];const home=comp?.competitors?.find(x=>x.homeAway==='home');const away=comp?.competitors?.find(x=>x.homeAway==='away');const date=(g.date||'').slice(0,10);
  return normalized({id:g.id,league:'nba',season,date,start:g.date,homeId:home?.team?.id,awayId:away?.team?.id,homeScore:home?.score,awayScore:away?.score,sourceUrl:src});
 }).filter(Boolean);
}
function dedupe(rows){const ids=new Set();return rows.filter(r=>{if(ids.has(r.gameId))return false;ids.add(r.gameId);return true;}).sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId));}
function dayList(start,end,limit){if(!dateRx.test(start)||!dateRx.test(end)||Date.parse(start)>Date.parse(end))throw Error('Provide chronological --start=YYYY-MM-DD and --end=YYYY-MM-DD');
 const arr=[];for(let ms=Date.parse(start);ms<=Date.parse(end);ms+=86400000){if(arr.length>=limit)throw Error(`NBA date-scanning budget capped at ${limit} days (override explicitly with --maxDays)`);arr.push(new Date(ms).toISOString().slice(0,10));}return arr;}
async function controlledFetch(url,{timeoutMs=15000,bytesLimit=12000000,fetchImpl=fetch}={}){
 const signal=AbortSignal.timeout(timeoutMs);const response=await fetchImpl(url,{signal,headers:{Accept:'application/json, text/plain, */*'}});
 if(!response.ok)throw Error(`Provider returned HTTP ${response.status} for ${new URL(url).host}`);
 const text=await response.text();if(text.length>bytesLimit)throw Error('Provider response exceeds safety limit');return text;
}
export async function collectHistorical({league,season,start=null,end=null,maxDays=31,nhlClubs=NHL_CLUBS,fetchImpl=fetch,onProgress=()=>{}}){
 if(!SOURCE_REGISTRY[league])throw Error('Unsupported league');if(!Number.isInteger(Number(season))||season<2010||season>2035)throw Error('Invalid season');
 if(league==='nfl'){const text=await controlledFetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',{fetchImpl});return dedupe(nflFromCsv(text,season));}
 if(league==='mlb'){const url=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&gameType=R`;return dedupe(mlbFromSchedule(JSON.parse(await controlledFetch(url,{fetchImpl})),season));}
 if(league==='nhl'){
  const rows=[];const seasonCode=`${season}${Number(season)+1}`;const clubs=nhlClubs.filter(c=>/^[A-Z]{3}$/.test(c)).slice(0,32);
  for(let i=0;i<clubs.length;i++){
   const url=`https://api-web.nhle.com/v1/club-schedule-season/${clubs[i]}/${seasonCode}`;
   try{rows.push(...nhlFromClubSchedule(JSON.parse(await controlledFetch(url,{fetchImpl})),season));}
   catch(e){onProgress({league,club:clubs[i],error:e.message});}
   onProgress({league,done:i+1,total:clubs.length});
  }
  return dedupe(rows);
 }
 if(!start||!end)throw Error('NBA research import requires explicit --start and --end; no unlimited API scraping');
 const dates=dayList(start,end,maxDays);const rows=[];
 for(let i=0;i<dates.length;i++){
  const date=dates[i].replaceAll('-','');const url=`https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}&limit=100`;
  try{rows.push(...nbaFromScoreboard(JSON.parse(await controlledFetch(url,{fetchImpl})),season));}
  catch(e){onProgress({league,date:dates[i],error:e.message});}
  onProgress({league,done:i+1,total:dates.length});
 }
 return dedupe(rows);
}
