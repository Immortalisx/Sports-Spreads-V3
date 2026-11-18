/**
 * NFL coaching-result research from nflverse/nfldata games.csv.
 * Results and coaching identity are descriptive, never tactical play charting
 * or a justified forecast coefficient. Reject future/same-day outcomes.
 */
export const SOURCE_URL='https://github.com/nflverse/nfldata/blob/master/data/games.csv';
export const RAW_SOURCE='https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
export const COACH_VERSION='nfl-coaching-results-v1';
const alias={WSH:'WAS',JAC:'JAX',LA:'LAR',STL:'LAR',SD:'LAC',OAK:'LV'};
export function canonicalTeam(value){const key=String(value||'').trim().toUpperCase();return alias[key]||key;}
const name=x=>String(x||'').trim().replace(/\s+/g,' ').slice(0,90);
const iso=x=>/^20\d\d-\d\d-\d\d$/.test(String(x||''))&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
export function readCsv(csv){
 if(typeof csv!=='string'||csv.length>3_500_000)throw Error('Invalid coaching CSV size');
 const rows=[],cells=[];let cell='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){cells.push(cell);cell='';}
  else if((c==='\r'||c==='\n')&&!quoted){
   if(c==='\r'&&csv[i+1]==='\n')i++;
   cells.push(cell);cell='';if(cells.some(x=>x))rows.push([...cells]);cells.length=0;
  }else cell+=c;
 }
 if(quoted)throw Error('Unterminated CSV quote');
 if(cells.length||cell){cells.push(cell);rows.push(cells);}
 const [header,...data]=rows,required=['season','game_type','gameday','home_team','away_team',
  'home_score','away_score','home_coach','away_coach'];
 if(!header||!required.every(x=>header.includes(x)))throw Error('Unsupported nflverse games schema');
 const ix=Object.fromEntries(required.map(x=>[x,header.indexOf(x)]));
 return data.map(r=>Object.fromEntries(required.map(x=>[x,r[ix[x]]||''])));
}
function pairKey(a,b){return [a,b].sort().join(' :: ');}
function avg(xs){return xs.length?Math.round(xs.reduce((p,n)=>p+n,0)/xs.length*10)/10:null;}
export function buildCoachingSnapshot(raw,asOfDay){
 if(!iso(asOfDay))throw Error('Invalid calendar cutoff');
 const year=Number(asOfDay.slice(0,4)),month=Number(asOfDay.slice(5,7));
 const seasonYear=month>=8?year:year-1;
 const selected=readCsv(raw).filter(r=>{
  if(r.game_type!=='REG'||!iso(r.gameday)||r.gameday>=asOfDay||
   !/^20\d\d$/.test(r.season)||Number(r.season)<2016||
   !name(r.home_coach)||!name(r.away_coach))return false;
  return [r.home_score,r.away_score].every(s=>/^\d{1,3}$/.test(s));
 }).sort((a,b)=>a.gameday.localeCompare(b.gameday));
 if(selected.length<10)throw Error('Not enough verified NFL results');
 const teams={},histories={},pair={},recent={};let sourceThrough='';
 const add=(team,coach,win,forPts,againstPts,r)=>{
  if(Number(r.season)!==seasonYear)return;
  const key=team+':'+coach;
  (recent[key]||=([])).push({date:r.gameday,win,forPts,againstPts});
  if(!teams[team]||teams[team].through<=r.gameday)
   teams[team]={coach,through:r.gameday,team};
 };
 for(const r of selected){
  const h=canonicalTeam(r.home_team),a=canonicalTeam(r.away_team),
   hc=name(r.home_coach),ac=name(r.away_coach),hs=Number(r.home_score),as=Number(r.away_score);
  if(!/^[A-Z]{2,3}$/.test(h)||!/^[A-Z]{2,3}$/.test(a)||h===a||hs===as)continue;
  sourceThrough=r.gameday>sourceThrough?r.gameday:sourceThrough;
  add(h,hc,hs>as,hs,as,r);add(a,ac,as>hs,as,hs,r);
  if(hc!==ac){
   const key=pairKey(hc,ac),p=pair[key]||{coaches:[hc,ac].sort(),wins:{},meetings:0,through:''};
   p.meetings++;p.wins[hs>as?hc:ac]=(p.wins[hs>as?hc:ac]||0)+1;
   p.through=r.gameday>p.through?r.gameday:p.through;pair[key]=p;
  }
 }
 if(Object.keys(teams).length<20)throw Error('Current season coaching coverage incomplete');
 for(const [abbr,t] of Object.entries(teams)){
  const games=(recent[abbr+':'+t.coach]||[]).slice(-8);
  t.recent={games:games.length,wins:games.filter(x=>x.win).length,
   losses:games.filter(x=>!x.win).length,
   pointsFor:avg(games.map(x=>x.forPts)),pointsAgainst:avg(games.map(x=>x.againstPts))};
 }
 return {version:COACH_VERSION,season:seasonYear,sourceThrough,source:SOURCE_URL,teams,pairs:pair,
  rawRowsUsed:selected.length,appliedToForecast:false,calibrated:false};
}
export function coachingForFixture(snapshot,home,away,gameDay){
 const h=canonicalTeam(home),a=canonicalTeam(away);
 if(!snapshot||snapshot.version!==COACH_VERSION||!iso(gameDay)||
  !/^[A-Z]{2,3}$/.test(h)||!/^[A-Z]{2,3}$/.test(a)||h===a||
  !iso(snapshot.sourceThrough)||snapshot.sourceThrough>=gameDay)return null;
 const ht=snapshot.teams?.[h],at=snapshot.teams?.[a];
 if(!ht||!at||!ht.coach||!at.coach)return null;
 const p=snapshot.pairs?.[pairKey(ht.coach,at.coach)]||null;
 return {version:COACH_VERSION,league:'nfl',status:'cached',asOf:snapshot.sourceThrough,
  source:snapshot.source,home:{abbr:h,coach:ht.coach,lastRecorded:ht.through,recent:ht.recent},
  away:{abbr:a,coach:at.coach,lastRecorded:at.through,recent:at.recent},
  headToHead:p?{meetings:p.meetings,homeCoachWins:p.wins[ht.coach]||0,
   awayCoachWins:p.wins[at.coach]||0,through:p.through}:null,
  disclaimer:'Coaches are last recorded, not a verified game-day staff announcement. Results and head-to-head are descriptive; no tactical or prediction adjustment.',
  calibrated:false,appliedToForecast:false};
}