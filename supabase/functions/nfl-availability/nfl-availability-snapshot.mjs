/**
 * NFL availability research. Depth-chart ranking never equals confirmation.
 * Injury date is not assumed to be the publication timestamp; asOf is when fetched.
 * No model or parlay confidence changes.
 */
export const AVAILABILITY_VERSION='nfl-availability-source-1';
const isId=x=>/^\d{1,12}$/.test(String(x??''));
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const safe=x=>String(x||'').slice(0,110).trim();
export function injuryStatus(value){
 const s=safe(value).toLowerCase().replace(/[-_ ]/g,'');
 if(s==='out'||s==='inactive'||s==='ruledout')return 'out';
 if(s==='doubtful')return 'doubtful';
 if(s==='questionable')return 'questionable';
 if(s==='probable')return 'probable';
 if(s==='injuredreserve'||s==='ir'||s==='reserveinjured')return 'injured_reserve';
 return 'unknown';
}
function verifiedAthleteId(player){
 const athlete=player?.athlete||{};
 if(isId(athlete.id))return String(athlete.id);
 const links=Array.isArray(athlete.links)?athlete.links:[];
 for(const link of links){
  const href=String(link?.href||'');
  const match=/^https:\/\/www\.espn\.com\/nfl\/player\/_\/id\/(\d{1,12})(?:\/|$)/.exec(href);
  if(match)return match[1];
 }
 return null;
}
export function parseLeagueInjuries(payload,{observedAt}={}){
 if(!iso(observedAt)||!Array.isArray(payload?.injuries))throw Error('Dated ESPN league-wide injury source required');
 const out=new Map(),seen=new Set();
 for(const group of payload.injuries){
  // ESPN 2026 uses group.id; earlier versions nested group.team.id.
  const teamId=String(group?.team?.id||group?.id||'');
  if(!isId(teamId)||!Array.isArray(group?.injuries))continue;
  const people=[];
  for(const p of group.injuries){
   const playerId=verifiedAthleteId(p);
   if(!playerId||seen.has(teamId+'-'+playerId))continue;
   // Guard against a stale injury entry belonging to a different club.
   if(isId(p?.athlete?.team?.id)&&String(p.athlete.team.id)!==teamId)continue;
   seen.add(teamId+'-'+playerId);
   const position=safe(p?.athlete?.position?.abbreviation).toUpperCase();
   if(!['QB','WR','TE','RB','OT','LT','RT','G','LG','RG','C','OL','DL','DE','DT','LB','ILB','OLB','CB','S','FS','SS','DB','EDGE'].includes(position))continue;
   people.push({playerId,name:safe(p.athlete?.fullName||p.athlete?.displayName),position,
    status:injuryStatus(p.status),injury:safe(p.type?.description||p.details?.type||p.injury?.description),
    injuryDate:iso(p.date),observedAt,source:'ESPN injury report'});
  }
  out.set(teamId,people.slice(0,40));
 }
 return out;
}
export function parseQbDepth(payload,{observedAt}={}){
 // Current ESPN format is {depthchart:[{name,positions:{qb:{athletes:[{id,displayName},...]}}}]}.
 // Older formats were {depthCharts:[{positions:{quarterback:{athletes:[{rank,athlete}]}}}]}.
 const charts=Array.isArray(payload?.depthchart)?payload.depthchart:
  Array.isArray(payload?.depthCharts)?payload.depthCharts:null;
 if(!iso(observedAt)||!charts)
  return {status:'unknown',qb1:null,qb2:null,observedAt,reason:'No usable current depth-chart data'};
 const candidates=[];
 for(const chart of charts){
  for(const [key,position] of Object.entries(chart?.positions||{})){
   if(key.toLowerCase()!=='qb'&&position?.position?.abbreviation!=='QB'&&position?.abbreviation!=='QB')continue;
   if(!Array.isArray(position.athletes))continue;
   for(let i=0;i<position.athletes.length;i++){
    const row=position.athletes[i],athlete=row.athlete||row;
    if(!isId(athlete.id))continue;
    const rank=row.rank===undefined?i+1:Number(row.rank);
    if(!Number.isInteger(rank)||rank<1)continue;
    candidates.push({id:String(athlete.id),name:safe(athlete.displayName||athlete.fullName),rank});
   }
  }
 }
 const unique=rank=>[...new Map(candidates.filter(x=>x.rank===rank).map(x=>[x.id,x])).values()];
 const qb1=unique(1),qb2=unique(2);
 if(qb1.length!==1||qb2.length>1||qb2[0]?.id===qb1[0]?.id)
  return {status:'unknown',qb1:null,qb2:null,observedAt,reason:'Depth-chart QB ranking missing or conflicting'};
 return {status:'projected',qb1:qb1[0],qb2:qb2[0]||null,observedAt,
  reason:'Depth-chart QB1 is projected, never a confirmed kickoff starter'};
}
export function buildPregameAvailability({fixtures,injuries,depthCharts,observedAt}){
 if(!Array.isArray(fixtures)||!(injuries instanceof Map)||!(depthCharts instanceof Map)||!iso(observedAt))
  throw Error('Dated sources and NFL fixtures required');
 const t=Date.parse(observedAt),out=[],seen=new Set();
 for(const f of fixtures){
  const start=Date.parse(f.start||'');
  if(!isId(f.gameId)||!isId(f.homeTeamId)||!isId(f.awayTeamId)||
   f.homeTeamId===f.awayTeamId||!Number.isFinite(start)||start<=t||start>t+9*86400_000)continue;
  if(seen.has(f.gameId))throw Error('Repeated game ID in availability snapshot');
  seen.add(f.gameId);
  function side(teamId){
   const src=depthCharts.get(teamId)||null;
   const chart=src?parseQbDepth(src,{observedAt}):
    {status:'unknown',qb1:null,qb2:null,observedAt,reason:'Depth-chart source unavailable'};
   const report=injuries.get(teamId)||[];
   const projected=chart.qb1;
   const injury=projected?report.find(p=>p.playerId===projected.id)||null:null;
   const conflict=injury&&['out','injured_reserve','doubtful'].includes(injury.status);
   return {teamId,projectedQB:conflict?null:projected,
    depthChartQB1:projected,backupCandidate:chart.qb2,
    starterStatus:!projected?'unknown':conflict?'uncertain':'projected',
    qbInjury:injury||null,injuries:report.slice(0,14),injuryReportAvailable:injuries.has(teamId),
    depthChartAvailable:!!src,confirmedStarter:false,
    note:conflict?'QB1 appears unavailable on injury report; backup starter NOT confirmed':
      !projected?'No verified QB1 depth-chart projection':'Projected QB1 only; game-day starter not confirmed'};
  }
  out.push({gameId:f.gameId,league:'nfl',start:new Date(start).toISOString(),
   homeTeamId:f.homeTeamId,awayTeamId:f.awayTeamId,
   home:side(f.homeTeamId),away:side(f.awayTeamId),asOf:observedAt,
   source:'ESPN league injuries and team depth chart (unofficial)',
   injuryDateSemantics:'injury date is not publication date; source observed at asOf',
   appliedToForecast:false,calibrated:false,confidenceAdjustment:null});
 }
 return {version:AVAILABILITY_VERSION,generatedAt:observedAt,league:'nfl',games:out,
  caution:'Depth-chart QB1 is not a confirmed starter. Missing injury listing is unknown, not healthy. No forecast adjustments.'};
}
