/**
 * Point-in-time NHL goalie form. Public NHL Web game logs provide *actual past
 * starts*, not reliable upcoming starter confirmations.
 * Research-only: no model probability, parlay or expected-goals coefficient.
 */
export const NHL_GOALIE_VERSION='nhl-goalie-last-five-v1';
const text=x=>String(x??'').trim().slice(0,95);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sum=(arr,key)=>arr.reduce((n,x)=>n+x[key],0);
export function goalieFormFromGameLog({playerId,teamAbbrev,logs,gameDate}){
 if(!/^\d{6,10}$/.test(String(playerId))||!/^[A-Z]{2,4}$/.test(teamAbbrev)||!date(gameDate)||!Array.isArray(logs))
  throw Error('Dated NHL goalie history required');
 const seen=new Set(),starts=[];
 for(const row of logs){
  const id=String(row?.gameId??'');
  if(!/^\d{10}$/.test(id)||seen.has(id))continue;seen.add(id);
  if(!date(row.gameDate)||row.gameDate>=gameDate||row.teamAbbrev!==teamAbbrev)continue;
  if(row.gamesStarted!==true&&row.gamesStarted!==1&&row.gamesStarted!=='1')continue;
  const shots=Number(row.shotsAgainst),against=Number(row.goalsAgainst);
  if(!Number.isInteger(shots)||!Number.isInteger(against)||shots<1||against<0||against>shots)continue;
  starts.push({gameId:id,date:row.gameDate,shotsAgainst:shots,
   goalsAgainst:against,saves:shots-against,decision:['W','L','O'].includes(row.decision)?row.decision:null});
 }
 starts.sort((a,b)=>b.date.localeCompare(a.date)||b.gameId.localeCompare(a.gameId));
 const sample=starts.slice(0,5),p3=starts.slice(0,3);
 const metric=rows=>{const shots=sum(rows,'shotsAgainst');
  return {starts:rows.length,shotsAgainst:shots,goalsAgainst:sum(rows,'goalsAgainst'),
   savePct:shots>=20?Math.round((shots-sum(rows,'goalsAgainst'))/shots*1000)/1000:null,
   avgGoalsAgainst:rows.length?Math.round(sum(rows,'goalsAgainst')/rows.length*100)/100:null};};
 const latest=starts[0]?.date||null;
 return {playerId:String(playerId),latestStart:latest,last3:metric(p3),last5:metric(sample),
  seasonStarts:starts.length,minimumSample:sample.length>=3&&sample.reduce((n,s)=>n+s.shotsAgainst,0)>=60,
  source:'NHL public game-level goalie history',dataThrough:latest,estimatedStarter:false,
  confirmedStarter:false,xGoalsSavedAboveExpected:null,xGoalsStatus:'not licensed or sourced'};
}
export function buildNhlGoalieSnapshot({games,teamGoalies,generatedAt}){
 if(!Array.isArray(games)||!(teamGoalies instanceof Map)||!Number.isFinite(Date.parse(generatedAt||'')))
  throw Error('NHL schedule, historical goalie data, and observed time required');
 const now=Date.parse(generatedAt),out=[],seen=new Set();
 for(const g of games){
  if(!/^\d{10}$/.test(String(g.gameId??''))||!/^[A-Z]{2,4}$/.test(g.homeAbbrev||'')||
   !/^[A-Z]{2,4}$/.test(g.awayAbbrev||'')||g.homeAbbrev===g.awayAbbrev)continue;
  const start=Date.parse(g.start||'');
  if(!Number.isFinite(start)||start<=now||start>now+6*86400000||seen.has(g.gameId))continue;
  seen.add(g.gameId);
  const gameDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
  const side=abbr=>{
   const candidates=(teamGoalies.get(abbr)||[]).filter(x=>x&&x.latestStart&&x.latestStart<gameDate)
    .sort((a,b)=>b.latestStart.localeCompare(a.latestStart)||b.last5.starts-a.last5.starts).slice(0,3);
   return {teamAbbrev:abbr,mostRecentStarter:candidates[0]||null,otherGoalies:candidates.slice(1),
    starterStatus:'unknown',confirmedStarter:false,
    note:'Recent game starts only; upcoming starting goalie not confirmed'};
  };
  out.push({gameId:String(g.gameId),league:'nhl',start:new Date(start).toISOString(),
   homeAbbrev:g.homeAbbrev,awayAbbrev:g.awayAbbrev,home:side(g.homeAbbrev),away:side(g.awayAbbrev),
   asOf:generatedAt,source:'NHL Web club statistics and player game logs',
   status:'research_only',appliedToForecast:false,calibrated:false,
   confidenceAdjustment:null});
 }
 return {version:NHL_GOALIE_VERSION,status:'cached',generatedAt,league:'nhl',
  games:out,source:'NHL public Web API · team goalie game logs',xGoalsStatus:'not sourced',
  caution:'Most recent starter is not a confirmed upcoming starter; no expected-goals or bookmaker-confidence assumptions'};
}
