function eligibleRecentSnapshot(g){
 if(!g||!['nfl','nhl'].includes(g.league)||g.demo||g.status!=='scheduled')return null;
 const source=state.forms?.[g.league];
 if(source?.status!=='cached'||source?.league!==g.league||!Array.isArray(source.snapshots))return null;
 const stamp=Date.parse(source.generatedAt||'');
 if(!Number.isFinite(stamp)||stamp>Date.now()+5*60*1000||Date.now()-stamp>48*3600*1000)return null;
 const gameAt=Date.parse(g.start||'');
 if(!Number.isFinite(gameAt)||gameAt<=Date.now())return null;
 const gameDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(gameAt));
 const match=source.snapshots.find(x=>x?.gameId===g.id&&x.league===g.league&&
  x.date===gameDate&&x.homeTeamId===String(g.home?.id)&&x.awayTeamId===String(g.away?.id));
 if(!match||match.evidence?.sourceStatus!=='adequate_research_samples'||
  match.evidence?.dateCutoff!=='strictly before game calendar date'||
  !(match.evidence?.latestCompletedGame<gameDate)||
  match.home?.played<3||match.away?.played<3)return null;
 return match;
}
function previewModel(g){
 const recent=eligibleRecentSnapshot(g);
 const baseline=globalThis.SportsPrediction?.project?.(g,{
  weather:state.weather[globalThis.SportsWeather?.key?.(g)],currentForm:recent
 })||{available:false,reason:'Model estimate unavailable.'};
 if(!baseline.available)return baseline;
 const advanced=globalThis.SportsMultifactor?.estimate?.(g,baseline,globalThis.SS_ADVANCED_EVIDENCE?.[g.id]||{},globalThis.SS_VALIDATED_MODELS?.[g.league]||null);
 if(advanced?.adjusted)return {...baseline,homeProbability:advanced.probability,
  awayProbability:1-advanced.probability,advancedModel:advanced,
  version:advanced.modelVersion,validated:!!advanced.validated};
 return {...baseline,advancedModel:advanced||null};
}
function modelLabel(g){
 if(g.demo)return 'Preview only · Not a scheduled fixture';
 const m=previewModel(g);
 if(!m.available)return 'Form estimate unavailable';
 const homeFav=m.homeProbability>=.5;
 const who=homeFav?g.home:g.away,prob=homeFav?m.homeProbability:m.awayProbability;
 return `${m.validated?'Holdout-tested form':m.recencyUsed?'Recency estimate':'Record estimate'} · ${esc(who.abbr||who.name)} ${Math.round(prob*100)}%${m.preliminary?'*':''}`;
}
function nflAvailabilityPanel(g){
 if(!g||g.league!=='nfl'||g.demo||g.status!=='scheduled')return '';
 const snapshot=state.nflAvailability;
 const game=snapshot?.status==='cached'?snapshot.games?.find(x=>x.gameId===g.id&&
  x.homeTeamId===String(g.home?.id)&&x.awayTeamId===String(g.away?.id)&&
  Math.abs(Date.parse(x.start||'')-Date.parse(g.start||''))<3600000&&
  Date.parse(x.asOf||'')<Date.parse(g.start||'')):null;
 const fresh=snapshot?.generatedAt?formatFresh(snapshot.generatedAt):'Not yet verified';
 const heading='<div class="availability-heading"><div><span class="block-label">NFL · STARTING QB & INJURIES</span>'+
  '<div class="availability-timestamp">Source check: '+esc(fresh)+'</div></div>'+
  '<button class="neutral-button availability-retry" data-action="retry-nfl-availability" aria-label="Check cached NFL availability again">'+
  (state.nflAvailabilityLoading?'Checking…':'Check updates')+'</button></div>';
 if(!game){
  const message=state.nflAvailabilityLoading?'Checking the shared NFL availability snapshot…':
   state.nflAvailabilityError||'No verified source snapshot for this upcoming matchup yet. Player availability is unknown.';
  return '<section class="panel availability-panel">'+heading+
   '<div class="availability-empty"><span aria-hidden="true">?</span><div><strong>Availability not verified</strong>'+
   '<p>'+esc(message)+'</p></div></div>'+
   '<p class="availability-disclaimer">Data is published only after its game and team identifiers match this matchup. No guessed starters or injury confidence are used.</p></section>';
 }
 const statusName=x=>String(x||'unknown').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
 const overview=(result)=>{
  const list=(result.injuries||[]).filter(x=>x&&x.status&&x.status!=='unknown');
  const out=list.filter(x=>x.status==='out'||x.status==='injured_reserve').length;
  const questions=list.filter(x=>x.status==='questionable'||x.status==='doubtful').length;
  return {list,out,questions};
 };
 const side=(team,result)=>{
  const qb=result?.depthChartQB1,report=result?.qbInjury,info=overview(result);
  const starter=result?.starterStatus==='projected'?'projected':
   result?.starterStatus==='uncertain'?'uncertain':'unknown';
  const tag=starter==='projected'?'Projected QB1':starter==='uncertain'?'Starter uncertain':'Starter unknown';
  const qbLabel=qb?.name?esc(qb.name):'QB not verified';
  const reportLine=report?'QB injury: '+statusName(report.status):
    'No QB injury status verified';
  const injuries=info.list.slice(0,6);
  const listing=injuries.length?
   '<ul class="availability-injuries">'+injuries.map(p=>'<li><span class="availability-position">'+esc(p.position||'')+'</span>'+
    '<span class="availability-player">'+esc(p.name||'Player')+'</span>'+
    '<span class="availability-status availability-status--'+esc(p.status)+'">'+esc(statusName(p.status))+'</span></li>').join('')+'</ul>':
   '<p class="availability-no-list">No currently listed high-impact injuries in this snapshot. This does not mean the roster is healthy.</p>';
  const counts='<div class="availability-mini-counts"><span>'+info.out+' out / IR listed</span><span>'+
   info.questions+' questionable / doubtful listed</span></div>';
  return '<article class="availability-team">'+
   '<div class="availability-team-head"><strong>'+esc(team?.name||'Team')+'</strong>'+
   '<span class="availability-badge availability-badge--'+starter+'">'+tag+'</span></div>'+
   '<div class="availability-qb">'+qbLabel+'</div>'+
   '<div class="availability-qb-note">'+esc(reportLine)+'</div>'+
   counts+listing+
   '<p class="availability-team-note">'+esc(result?.note||'No confirmed game-day starter')+'</p>'+
   '</article>';
 };
 const sourceState=snapshot.injurySourceStatus==='retrieved'?
  '<span class="availability-source-ok">Injury feed retrieved</span>':
  '<span class="availability-source-missing">Injury feed unavailable</span>';
 return '<section class="panel availability-panel">'+heading+
  '<div class="availability-sourcebar">'+sourceState+
  '<span>Depth charts: '+esc(snapshot.depthChartTeams??0)+' teams</span></div>'+
  '<div class="availability-grid">'+side(g.away,game.away)+side(g.home,game.home)+'</div>'+
  '<p class="availability-disclaimer">ESPN public injury/depth-chart data · observed '+esc(game.asOf)+
  '. <strong>Depth-chart QB1 is projected, not a confirmed starter.</strong> '+
  (snapshot.injurySourceStatus==='unavailable'?'The injury feed could not be verified; injury statuses are unknown. ':'')+
  'No injury impact or starter certainty has been included in win probabilities or ticket confidence.</p></section>';
}
function currentSeasonPanel(g){
 if(!g||g.demo||g.status!=='scheduled')return '';
 const data=state.forms[g.league],loading=state.formLoading[g.league];
 const r=data?.snapshots?.find(x=>x.gameId===g.id&&
  x.homeTeamId===String(g.home?.id)&&x.awayTeamId===String(g.away?.id));
 const heading='<div class="current-form-heading"><span class="block-label">CURRENT SEASON · OPPONENT ADJUSTED</span>'+
  '<small>'+esc(data?.generatedAt?formatFresh(data.generatedAt):loading?'Loading':'Research only')+'</small></div>';
 if(!r){
  if(data?.status==='cached')return '<div class="panel current-form-panel">'+heading+
   '<p class="muted-sm">Current-season form unavailable for this game. No matchup metrics were invented.</p></div>';
  return '<div class="panel current-form-panel">'+heading+
   '<p class="muted-sm">'+esc(loading?'Loading shared current-season scores…':
    state.formErrors[g.league]||'Season history is being published. Regular-season data will appear here.')+'</p></div>';
 }
 const pct=x=>Number.isFinite(x)?Math.round(x*100)+'%':'—';
 const fmt=x=>Number.isFinite(x)?x.toFixed(2):'—';
  const trend=t=>{
  const games=Array.isArray(t?.recentGames)?t.recentGames.filter(x=>
   x&&typeof x.win==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).slice(-10):[];
  if(!games.length)return '';
  const results=games.map(x=>x.win?'W':'L').join(' ');
  return '<div class="form-sparkline" role="img" aria-label="'+esc('Recent games: '+results)+'">'+
   games.map(x=>'<span class="'+(x.win?'trend-win':'trend-loss')+'" title="'+
    esc(x.date+' · '+(x.win?'Win':'Loss')+' · '+(x.margin>=0?'+':'')+x.margin)+'"></span>').join('')+
   '</div><small class="trend-label">Last '+games.length+' results · oldest → newest</small>';
 };
const card=(name,t)=>'<div class="current-form-team"><strong>'+esc(name)+'</strong>'+trend(t)+
   '<span><b>'+pct(t.last5.winRate)+'</b><small>Last 5 win rate</small></span>'+
   '<span><b>'+pct(t.last10.winRate)+'</b><small>Last 10 win rate</small></span>'+
   '<span><b>'+fmt(t.last5.opponentAdjustedMargin)+'</b><small>Opponent-adjusted form index</small></span>'+
   '<span><b>'+esc(t.restDays??'—')+'</b><small>Days since previous game</small></span></div>';
 return '<div class="panel current-form-panel">'+heading+
  '<div class="current-form-grid">'+card(g.away.name,r.away)+card(g.home.name,r.home)+'</div>'+
  '<p class="current-form-disclaimer">Calculated from the most recent completed regular-season games, including prior-opponent strength and scoring margins. Data through '+esc(r.evidence?.latestCompletedGame||'unknown')+
  '. Metrics are informational research signals; they are NOT yet calibrated win probabilities, model confidence or betting edges.</p></div>';
}
function recencyFootnote(m){
 if(!m.preliminary)return '';
 const description=m.recencyUsed?
  'Includes verified current-season form through '+(m.recencyDataThrough||'unknown')+
  ' ('+(m.recencyDeltaPp>=0?'+':'')+Number(m.recencyDeltaPp).toFixed(1)+
  ' percentage-point provisional adjustment). Its improvement has NOT passed independent statistical validation.':
  'No eligible recent-game snapshot; this is the record-only estimate.';
 return '<p class="recency-asterisk" role="note"><strong>* Preliminary estimate, NOT validated betting confidence.</strong> '+
  esc(description)+' No verified wagering edge or parlay success rate is claimed.</p>';
}
function modelPanel(g){
 const m=previewModel(g);
 if(!m.available)return `<div class="model-off"><h3>Model estimate unavailable</h3><p>${esc(m.reason||'Missing team performance data.')}</p></div>`;
 const pct=(x)=>Math.round(x*100)+'%'+(m.preliminary?'*':'');
 const rangePct=(x)=>Math.round(x*100)+'%';
 const weatherLine=m.weatherUncertaintyPp>0?`+${m.weatherUncertaintyPp} percentage points of weather uncertainty (${esc(m.weatherTier)})`:
   g.league==='nfl'||g.league==='mlb'?'No measured weather adjustment yet; forecast and roof status may be unavailable.':'Indoor game · no weather uncertainty adjustment';
 return `<div class="panel experimental-model"><div class="model-head"><span class="block-label">${m.validated?'TEAM-RECORD MODEL · 2025 HOLDOUT':m.recencyUsed?'CURRENT-SEASON RECENCY MODEL*':'RECORD-ONLY MODEL*'}</span><span class="model-flag">${m.validated?'Holdout calibrated · W–L only':'Not calibrated*'}</span></div>
   <div class="model-columns"><div><small>${esc(g.away.abbr||'AWAY')} win estimate</small><strong>${pct(m.awayProbability)}</strong></div><div><small>${esc(g.home.abbr||'HOME')} win estimate</small><strong>${pct(m.homeProbability)}</strong></div></div>
   <div class="model-meter" role="img" aria-label="${m.validated?'Holdout-tested record probability':'Uncalibrated record estimate'}: ${esc(g.away.name)} ${pct(m.awayProbability)}, ${esc(g.home.name)} ${pct(m.homeProbability)}"><span style="width:${pct(m.awayProbability)}"></span></div>
   <p class="model-range">Home sensitivity range ${rangePct(m.low)}–${rangePct(m.high)} · Not a statistical confidence interval</p>
   <p class="model-weather">${esc(weatherLine)}</p>${recencyFootnote(m)}
   <details class="model-method"><summary>How this estimate works</summary>
   <p>Version ${esc(m.version)} · ${esc(m.source)} · W–L records ${esc(m.awayRecord)} vs ${esc(m.homeRecord)}. ${m.validated?'Uses league-specific parameters learned from earlier games and calibrated on a separate season.':'Uses record shrinkage and an assumed home advantage.'} ${esc(m.note)} Injuries, lineup changes, verified quarterback/receiver matchups, sportsbook prices and player prop forecasts are not included. Do not interpret this as a betting edge or validated confidence grade.</p></details></div>`;
}
