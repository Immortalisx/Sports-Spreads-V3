/**
 * Sports Spreads point-in-time current-season form features, v1.
 * Every game is scored with the PRIOR DAY's knowledge. Same-calendar-day
 * results do not leak. This produces RESEARCH FEATURES, not forecast weights.
 * Input is a single current-season finalized game ledger plus upcoming games.
 */
export const CURRENT_FORM_VERSION='current-season-rolling-v1';
const SCORING_SCALE={nfl:17,nba:15,nhl:2.2,mlb:3.7};
const ELO_K={nfl:22,nba:17,nhl:14,mlb:12};
const ELO_HOME={nfl:55,nba:60,nhl:25,mlb:18};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'));
const average=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
const empty=()=>({wins:0,losses:0,played:0,prior:[],lastGame:null});
const winp=(wins,n)=>(wins+4)/(n+8);
const log10=Math.log(10);
function gameValid(g,league){
 return g&&g.league===league&&validDate(g.date)&&
  typeof g.id==='string'&&g.id.trim()!==''&&
  typeof g.home==='string'&&g.home.trim()!==''&&
  typeof g.away==='string'&&g.away.trim()!==''&&g.home!==g.away&&
  Number.isInteger(g.homeScore)&&Number.isInteger(g.awayScore)&&
  g.homeScore>=0&&g.awayScore>=0&&g.homeScore!==g.awayScore;
}
function asOf(team,day,league){
 const played=team?.played||0,hist=team?.prior||[];
 const slice=(n)=>hist.slice(-n);
 const summary=(n)=>{
  const r=slice(n);
  if(!r.length)return {games:0,winRate:null,pointsFor:null,pointsAgainst:null,
   avgMargin:null,opponentElo:null,opponentAdjustedMargin:null};
  const victories=r.filter(x=>x.win).length,scale=SCORING_SCALE[league];
  return {games:r.length,winRate:victories/r.length,
   pointsFor:average(r.map(x=>x.for)),pointsAgainst:average(r.map(x=>x.against)),
   avgMargin:average(r.map(x=>x.margin)),
   opponentElo:average(r.map(x=>x.oppElo)),
   opponentAdjustedMargin:average(r.map(x=>x.margin/scale+
    (x.oppElo-1500)/400))};
 };
 const three=summary(3),five=summary(5),ten=summary(10);
 return {played,wins:team?.wins||0,losses:team?.losses||0,
  recordStrength:winp(team?.wins||0,played),
  lastGame:team?.lastGame||null,restDays:team?.lastGame?
   Math.max(0,Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(team.lastGame+'T00:00:00Z'))/86400000)):null,
  last3:three,last5:five,last10:ten,
  recentGames:hist.slice(-10).map(x=>({date:x.date,gameId:x.gameId,win:x.win,
   margin:x.margin,opponentElo:Math.round(x.oppElo)})),
  momentum:three.games>=3&&ten.games>=5?clamp(three.winRate-ten.winRate,-1,1):null,
  formCoverage:five.games>=3?'adequate_for_research':'not_enough_prior_games',
  dataThrough:team?.lastGame||null};
}
export function buildCurrentSeasonSnapshots({league,season,games,fixtures=[]}){
 if(!SCORING_SCALE[league]||!Array.isArray(games)||!Array.isArray(fixtures)||!String(season||'').trim())
  throw Error('Invalid current-season snapshot input');
 const seen=new Set();
 const safe=games.filter(g=>gameValid(g,league))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const g of safe){if(seen.has(g.id))throw Error('Duplicate current-season game ID: '+g.id);seen.add(g.id);}
 const planned=[...fixtures].filter(f=>f?.league===league&&validDate(f.date)&&
  typeof f.id==='string'&&f.id&&f.home&&f.away&&f.home!==f.away)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const teams=new Map(),elo=new Map();let gi=0,fi=0;
 const state=id=>teams.get(id)||empty();
 const rating=id=>elo.get(id)??1500;
 const schedule=[];
 while(fi<planned.length){
  const day=planned[fi].date;
  // Process all previous days; outcomes from the fixture day are withheld,
  // regardless of clock time or result availability.
  while(gi<safe.length&&safe[gi].date<day){
   const d=safe[gi].date,batch=[];
   while(gi<safe.length&&safe[gi].date===d)batch.push(safe[gi++]);
   const pending=batch.map(g=>{
    const h=state(g.home),a=state(g.away),hr=rating(g.home),ar=rating(g.away);
    const p=1/(1+Math.exp(-log10*(hr+ELO_HOME[league]-ar)/400));
    const winner=g.homeScore>g.awayScore,delta=ELO_K[league]*((winner?1:0)-p);
    return {g,h,a,hr,ar,winner,delta};
   });
   // Only now apply the day's completed outcomes.
   for(const {g,h,a,hr,ar,winner,delta} of pending){
    const write=(st,forScore,against,win,opponentElo)=>{
     st.wins+=win?1:0;st.losses+=win?0:1;st.played++;
     st.lastGame=g.date;st.prior.push({date:g.date,gameId:g.id,win,
      for:forScore,against,margin:forScore-against,oppElo:opponentElo});
     if(st.prior.length>10)st.prior.shift();
    };
    write(h,g.homeScore,g.awayScore,winner,ar);
    write(a,g.awayScore,g.homeScore,!winner,hr);
    teams.set(g.home,h);teams.set(g.away,a);
    elo.set(g.home,hr+delta);elo.set(g.away,ar-delta);
   }
  }
  while(fi<planned.length&&planned[fi].date===day){
   const f=planned[fi++],home=asOf(state(f.home),day,league),away=asOf(state(f.away),day,league);
   const homeElo=rating(f.home),awayElo=rating(f.away);
   const available=home.played>=3&&away.played>=3;
   schedule.push({version:CURRENT_FORM_VERSION,league,season:String(season),gameId:f.id,
    date:f.date,homeTeamId:f.home,awayTeamId:f.away,home,away,
    matchup:{opponentAdjustedFormDelta:available?
      clamp((home.last5.opponentAdjustedMargin-away.last5.opponentAdjustedMargin),-4,4):null,
     rollingMomentumDelta:home.momentum!==null&&away.momentum!==null?
      clamp(home.momentum-away.momentum,-2,2):null,
     eloDifference:available?homeElo-awayElo:null,
     restDaysDifference:home.restDays!==null&&away.restDays!==null?home.restDays-away.restDays:null},
    evidence:{asOf:day,latestCompletedGame:home.dataThrough>away.dataThrough?home.dataThrough:away.dataThrough,
     dateCutoff:'strictly before game calendar date',gamesUsedByHome:home.played,gamesUsedByAway:away.played,
     sourceStatus:available?'adequate_research_samples':'insufficient_in_season_history'},
    appliedToForecast:false,calibrated:false});
  }
 }
 return {version:CURRENT_FORM_VERSION,league,season:String(season),completedGames:safe.length,
  nextGames:schedule.length,snapshots:schedule};
}
