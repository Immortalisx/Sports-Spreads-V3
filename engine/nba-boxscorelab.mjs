/** BoxScore Lab team-game CSV research importer (CC BY 4.0 + attribution).
 * Final scores only; NOT archived pregame player or market snapshots.
 */
const BASE='https://boxscorelab.com/downloads/';
const SEASON=/^20\d{2}-\d{2}$/;
const DATE=/^20\d{2}-\d{2}-\d{2}$/;
const TEAM=/^[A-Z]{2,4}$/;
const MAX_BYTES=1_200_000;
function csvCells(line){
 const cells=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){cells.push(value);value='';}
  else value+=c;
 }
 if(quoted)throw Error('Unterminated CSV quote');
 cells.push(value);return cells;
}
function asInteger(x){if(!/^\d+$/.test(String(x)))return null;const n=Number(x);return Number.isSafeInteger(n)?n:null;}
export function parseBoxscoreLabGames(csv,season){
 if(!SEASON.test(season))throw Error('Invalid NBA season');
 if(typeof csv!=='string'||csv.length<50||csv.length>MAX_BYTES)throw Error('NBA CSV size invalid');
 const lines=csv.trim().split(/\r?\n/).filter(Boolean);
 const header=csvCells(lines.shift());
 const required=['season','team','game_date','opponent','home','points','opponent_points'];
 if(!required.every(x=>header.includes(x)))throw Error('NBA CSV missing essential columns');
 const records=new Map(),homeRows=[];
 for(const line of lines){
  const vals=csvCells(line);if(vals.length!==header.length)throw Error('NBA CSV malformed row');
  const r=Object.fromEntries(header.map((key,i)=>[key,vals[i]]));
  if(r.season!==season||!DATE.test(r.game_date)||!TEAM.test(r.team)||!TEAM.test(r.opponent)||r.team===r.opponent)throw Error('Invalid NBA game row');
  if(!['True','False','true','false'].includes(r.home))throw Error('Unknown NBA home field');
  const pts=asInteger(r.points),opp=asInteger(r.opponent_points);
  if(pts===null||opp===null||pts>250||opp>250||pts===opp)throw Error('Invalid NBA final score');
  const key=r.game_date+':'+r.team;
  if(records.has(key))throw Error('Duplicate NBA team-date row');
  records.set(key,r);if(r.home.toLowerCase()==='true')homeRows.push(r);
 }
 const games=[],year=Number(season.slice(0,4));
 for(const h of homeRows){
  const away=records.get(h.game_date+':'+h.opponent);
  if(!away||away.home.toLowerCase()!=='false'||away.opponent!==h.team||away.points!==h.opponent_points||away.opponent_points!==h.points)throw Error('Incomplete or inconsistent NBA home/away record pair');
  games.push({gameId:'nba-bsl-'+season+'-'+h.game_date+'-'+h.team+'-'+away.team,league:'nba',season:year,gameDate:h.game_date,
   gameAt:h.game_date+'T12:00:00.000Z',homeTeam:h.team,awayTeam:away.team,homeScore:Number(h.points),awayScore:Number(away.points),
   homeCoach:null,awayCoach:null,sourceUrl:BASE+season+'-team-game-results.csv',sourceTier:'cc_by_4_public',retrospective:true});
 }
 const rejectedTeamRows=lines.length-games.length*2;
 if(rejectedTeamRows<0||rejectedTeamRows/lines.length>0.005)throw Error('NBA paired-game coverage inconsistent: '+rejectedTeamRows+'/'+lines.length+' incomplete team rows');
 const result=games.sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.gameId.localeCompare(b.gameId));
 Object.defineProperty(result,'rejectedTeamRows',{value:rejectedTeamRows});
 Object.defineProperty(result,'totalTeamRows',{value:lines.length});
 return result;
}
export async function collectNbaResearch(seasons,{fetchImpl=fetch,timeoutMs=20000}={}){
 if(!Array.isArray(seasons)||seasons.length<3||seasons.length>5)throw Error('NBA historical research requires 3–5 bounded seasons');
 const games=[],coverageBySeason=[];
 for(const season of seasons){
  if(!SEASON.test(season))throw Error('Invalid season label');
  const url=BASE+season+'-team-game-results.csv';
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs),headers:{accept:'text/csv'}});
  if(!response.ok)throw Error('NBA research data unavailable ('+response.status+')');
  const csv=await response.text();const parsed=parseBoxscoreLabGames(csv,season);
  coverageBySeason.push({season,teamRows:parsed.totalTeamRows,completeGames:parsed.length,rejectedTeamRows:parsed.rejectedTeamRows});
  games.push(...parsed);
 }
 Object.defineProperty(games,'coverageBySeason',{value:coverageBySeason});
 return games;
}
