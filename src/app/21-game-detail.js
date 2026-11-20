function weatherPanel(g){
 const key=SportsWeather.key(g),value=state.weather[key];
 if(g.demo)return `<div class="panel weather-panel"><span class="block-label">GAME-DAY WEATHER</span><strong>Preview only</strong><p>Weather is not attached to example games.</p></div>`;
 if(!value||value.status==='loading')return `<div class="panel weather-panel"><span class="block-label">GAME-DAY WEATHER</span><p>Checking venue conditions…</p></div>`;
 if(value.status==='indoors')return `<div class="panel weather-panel weather-compact" aria-label="Game-day weather: indoor venue"><span class="weather-compact-line">🏟️ <strong>Indoor venue</strong><small>No outdoor weather impact expected</small></span></div>`;
 if(value.status==='forecast')return `<div class="panel weather-panel"><div class="weather-title"><span class="block-label">GAME-DAY WEATHER</span><span class="weather-source">Forecast · ${esc(formatFresh(value.fetchedAt))}</span></div><div class="weather-summary"><span class="weather-icon" aria-hidden="true">${esc(value.icon)}</span><div><strong>${esc(Math.round(value.tempF))}°F · ${esc(value.description)}</strong><div class="person-info">${esc(value.city)} · Near kickoff</div></div></div><div class="weather-grid"><div><small>Wind</small><strong>${esc(Math.round(value.windMph))} mph</strong></div><div><small>Gusts</small><strong>${esc(Math.round(value.gustMph))} mph</strong></div><div><small>Precipitation</small><strong>${esc(Math.round(value.precipChance))}% chance</strong></div></div>${value.flags?.length?`<p class="weather-flag">${esc(value.flags.join(' · '))}</p>`:''}${(() => {const context=globalThis.SportsWeatherModel?.assess(g,value);return context?.available?`<div class="weather-context"><span class="block-label">WEATHER MODEL · ${esc(context.tier)} RISK</span><p>${esc(context.signals.join(' · '))}</p><details><summary>Model inputs & limits</summary><p>Weather features: ${esc(context.features.wind_mph)} mph wind, ${esc(context.features.gust_mph)} mph gusts, ${esc(context.features.precipitation_probability_pct)}% precipitation chance, ${esc(context.features.temperature_f)}°F. These influence contextual risk, not a calibrated win probability. Roof status can change exposure.</p></details></div>`:'';})()}<p class="weather-note">${esc(value.roofNote||'Forecast for the venue area, not an observed stadium reading.')} Weather is included in matchup risk analysis; calibrated prediction confidence is not available. <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo ↗</a></p></div>`;
 return `<div class="panel weather-panel"><div class="weather-title"><span class="block-label">GAME-DAY WEATHER</span><button class="neutral-button small-btn" data-action="weather-retry" data-game="${esc(g.id)}">Retry</button></div><p>${esc(value.message||'Forecast is unavailable for this game.')}</p></div>`;
}
async function loadGameWeather(g,force=false){
 if(!g||g.demo)return;
 const key=SportsWeather.key(g);
 if(!force&&state.weather[key]&&state.weather[key].status!=='unavailable')return;
 state.weather[key]={status:'loading'};
 if(state.drawer?.type==='game'&&state.drawer.game.id===g.id)render();
 try{state.weather[key]=await SportsWeather.get(g,{force});}
 catch(e){state.weather[key]={status:'unavailable',message:e.message||'Weather provider unavailable.'};}
 if(state.drawer?.type==='game'&&state.drawer.game.id===g.id)render();
}
function matchupFactorsPanel(g){
 const advanced=globalThis.SportsMultifactor?.evaluate?.(g,{})||[];
 if(!advanced.length)return '';
 const sourced=advanced.filter(f=>f.ok);
 const missing=advanced.filter(f=>!f.ok);
 const summary=sourced.length?'Advanced matchup research · '+sourced.length+' sourced':
  'Advanced matchup research';
 const status=sourced.length?'<span class="research-status research-status--partial">Research only</span>':
  '<span class="research-status">Not yet verified</span>';
 const ready=sourced.map(f=>'<div class="result-row factor-row"><span>'+esc(f.label)+'</span>'+
  '<small class="muted">Sourced · '+esc(f.sampleSize)+' observations</small></div>').join('');
 const pending=missing.length?'<details class="research-missing"><summary>See '+missing.length+
  ' missing input'+(missing.length===1?'':'s')+'</summary><ul>'+
  missing.map(f=>'<li>'+esc(f.label)+'</li>').join('')+'</ul></details>':'';
 return '<details class="panel data-panel research-panel"><summary class="research-summary">'+
  esc(summary)+status+'</summary>'+
  (sourced.length?'<p>Available research inputs are shown below. They do not alter the prediction without validated model coefficients.</p>'+ready:
  '<p>Scheme, personnel and coaching inputs have not been verified for this matchup. No placeholder ratings are used.</p>')+
  pending+'</details>';
}


/** Cross-league source-derived scouting context, never an estimated game score. */
function recentScoringMatchupPanel(g){
 if(!g||g.demo||g.status!=='scheduled')return '';
 const r=state.forms[g.league]?.snapshots?.find(x=>x.gameId===g.id&&
  x.homeTeamId===String(g.home?.id)&&x.awayTeamId===String(g.away?.id));
 const h=r?.home?.last5,a=r?.away?.last5;
 if(!h||!a||h.games<3||a.games<3||![h.pointsFor,h.pointsAgainst,a.pointsFor,a.pointsAgainst].
  every(x=>typeof x==='number'&&Number.isFinite(x)))return '';
 const unit=g.league==='mlb'?'Runs':g.league==='nhl'?'Goals':'Points';
 const row=(team,offense,opponentAllowed)=>'<div class="scouting-row"><strong>'+esc(team.abbr||team.name)+'</strong>'+
  '<span><b>'+esc(offense.toFixed(1))+'</b><small>'+unit+' scored/game</small></span>'+
  '<span><b>'+esc(opponentAllowed.toFixed(1))+'</b><small>Opponent '+unit.toLowerCase()+' allowed/game</small></span></div>';
 return '<details class="panel scouting-panel"><summary>Offense vs defense · last 5 completed games</summary>'+
  '<p class="muted-sm">Recent scoring against each opponent’s recent allowance. These are observed averages, not predicted scores.</p>'+
  row(g.away,a.pointsFor,h.pointsAgainst)+row(g.home,h.pointsFor,a.pointsAgainst)+
  '<small class="muted-sm">Through '+esc(r.evidence?.latestCompletedGame||'unknown')+
  ' · Matchup research only; opponent quality, lineup and scheme effects have not been calibrated.</small></details>';
}
function nflCoachingPanel(g){
 if(g.league!=='nfl'||g.demo||g.status!=='scheduled')return '';
 const data=state.coaching[g.id],busy=state.coachingLoading[g.id],error=state.coachingErrors[g.id];
 const action='<button class="neutral-button small-btn" data-action="retry-nfl-coaching" data-game="'+esc(g.id)+'"'+(busy?' disabled':'')+'>'+
  (busy?'Checking…':'Refresh cached history')+'</button>';
 if(!data)return '<div class="panel coaching-panel"><span class="block-label">NFL COACHING MATCHUP · RESEARCH ONLY</span><p>'+
  esc(busy?'Checking verified coach game history…':error||'Loading last recorded head-coach matchup data…')+
  '</p><div class="form-actions">'+action+'</div></div>';
 const coach=(side,team)=>{
  const recent=side.recent||{},n=Number(recent.games)||0;
  return '<div class="coach-card"><small class="muted">'+esc(team.abbr||team.name)+'</small>'+
   '<strong>'+esc(side.coach)+'</strong><span class="muted-sm">Last recorded head coach · '+esc(side.lastRecorded||'Unknown date')+'</span>'+
   '<span class="coach-stat">'+(n?esc(recent.wins)+'–'+esc(recent.losses)+' in last '+n+' coached games':'Recent results unavailable')+'</span>'+
   (Number.isFinite(recent.pointsFor)?'<span class="muted-sm">'+esc(recent.pointsFor)+' points scored/game · '+esc(recent.pointsAgainst)+' allowed</span>':'')+
   '</div>';
 };
 const h2h=data.headToHead;
 const meeting=h2h?.meetings?'<div class="coach-h2h"><strong>Head-to-head: '+esc(h2h.homeCoachWins)+'–'+esc(h2h.awayCoachWins)+
  '</strong><span class="muted-sm">Home coach wins – away coach wins · '+esc(h2h.meetings)+' previous meetings</span></div>':
  '<p class="muted-sm">No recorded head-coach head-to-head meetings in the available history.</p>';
 return '<div class="panel coaching-panel"><div class="coaching-heading"><span class="block-label">NFL COACHING MATCHUP</span>'+
  '<span class="research-status research-status--partial">Research only</span></div>'+
  '<div class="details-grid coach-grid">'+coach(data.away,g.away)+coach(data.home,g.home)+'</div>'+
  meeting+'<p class="muted-sm">Results as of '+esc(data.asOf)+
  '. Coach names are from completed games, not a confirmed game-day staff announcement. Historical head-to-head is descriptive, not a prediction or coaching advantage.</p>'+
  '<div class="form-actions"><a class="inline-link" href="https://github.com/nflverse/nfldata/blob/master/data/games.csv" target="_blank" rel="noopener noreferrer">nflverse source ↗</a></div></div>';
}
function pregameStarterPanel(g){
 if(g.league!=='mlb'||g.demo||g.status!=='scheduled')return '';
 const value=state.signals[g.id],loading=state.signalsLoading[g.id];
 const pitcher=x=>x?.name?esc(x.name):'Not confirmed';
 return `<div class="panel starters-panel"><span class="block-label">MLB PROBABLE STARTERS · OFFICIAL SOURCE</span>
 ${value?.status==='ok'?`<div class="odds-pair"><div><small>${esc(g.away.abbr)}</small><strong>${pitcher(value.awayPitcher)}</strong></div><div><small>${esc(g.home.abbr)}</small><strong>${pitcher(value.homePitcher)}</strong></div></div>`:`<p class="muted-sm">${loading?'Checking MLB schedule…':esc(value?.note||'On-demand official starting-pitcher lookup.')}</p>`}
 <div class="form-actions"><button class="neutral-button small-btn" data-action="load-signals" data-game="${esc(g.id)}" ${loading?'disabled':''}>${loading?'Checking…':'Check probable pitchers'}</button></div>
 <small class="muted-sm">MLB StatsAPI. Probable is not confirmed; pitcher-vs-hitter splits are not modeled without verified lineup and pregame samples.</small></div>`;
}

function marketHistoryPanel(g){
 if(!g||g.demo||g.status!=='scheduled'||!state.odds[g.league]||!globalThis.SportsOdds)return '';
 const match=SportsOdds.booksForGame(g,state.odds[g.league]);
 if(!match.matched)return '';
 const id=String(g.id),data=state.marketHistory[id],busy=state.marketHistoryLoading[id];
 const points=data?.points||[],error=state.marketHistoryErrors[id];
 const chart=points.length>=2?(()=>{
  const first=points[0],last=points[points.length-1],w=242,h=62;
  const coords=points.map((p,i)=>[8+(i/(points.length-1))*(w-16),
   8+(1-p.homeNoVig)*(h-16)]);
  const d=coords.map(x=>x.map(n=>n.toFixed(1)).join(',')).join(' ');
  return '<div class="odds-history-chart"><svg viewBox="0 0 '+w+' '+h+
   '" role="img" aria-label="Observed market-implied home chance '+Math.round(first.homeNoVig*100)+
   ' percent to '+Math.round(last.homeNoVig*100)+' percent"><polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="'+d+'"/></svg>'+
   '<div class="odds-history-caption"><strong>'+Math.round(first.homeNoVig*100)+'% → '+
   Math.round(last.homeNoVig*100)+'%</strong><small>Home team · no-vig market consensus</small></div></div>';
 })():null;
 const body=chart||'<p class="muted-sm">'+esc(error||(busy?'Checking shared archive…':
  data?'Only one archived quote so far. A line needs two or more distinct refreshes.':
  'Open the free, cached quote history for this matchup.'))+'</p>';
 return '<details class="panel odds-history-panel"'+(busy||data||error?' open':'')+
  '><summary>Market movement · archived quotes</summary>'+body+
  '<div class="form-actions"><button class="neutral-button small-btn" data-action="load-market-history" data-game="'+
  esc(g.id)+'"'+(busy?' disabled':'')+'>'+(busy?'Loading…':data?'Reload archive':'Load price history')+
  '</button></div><small class="muted-sm">The Odds API · historical observations from shared twice-daily moneyline snapshots. Not live, not a calibrated model probability and not a profitability claim.</small></details>';
}
function sportsbookOddsPanel(g){
 const info=state.odds[g.league],busy=state.oddsLoading[g.league],problem=state.oddsError[g.league];
 const valid=info&&['ok','cached','stale','quota_paused'].includes(info.status);
 const rows=valid?SportsOdds.booksForGame(g,info):null;
 const current=info&&Number.isFinite(Date.parse(info.asOf))&&Date.now()-Date.parse(info.asOf)>=0&&Date.now()-Date.parse(info.asOf)<=8*60*60*1000;
 const disabled=!info||!['ok','cached'].includes(info.status)||!rows?.matched||!current;
 const quote=x=>x>0?'+'+x:String(x);
 const buttons=rows?.books?.map((b,i)=>`<div class="odds-book-row"><div class="odds-book-head"><strong>${esc(b.title)}</strong><small>As of ${esc(b.asOf?formatFresh(b.asOf):'unknown')} · no-vig ${Math.round(b.homeFair*100)}% home</small></div><div class="odds-pair"><button type="button" class="neutral-button" data-action="odds-pick" data-game="${esc(g.id)}" data-side="away" data-index="${i}" ${disabled?'disabled':''}>${esc(g.away.abbr||g.away.name)} <strong>${esc(quote(b.awayPrice))}</strong></button><button type="button" class="neutral-button" data-action="odds-pick" data-game="${esc(g.id)}" data-side="home" data-index="${i}" ${disabled?'disabled':''}>${esc(g.home.abbr||g.home.name)} <strong>${esc(quote(b.homePrice))}</strong></button></div></div>`).join('')||'';
 const status=busy?'Checking permitted US sportsbook moneylines…':problem?`Odds unavailable: ${esc(problem)}`:
  !info?'Only loads when requested · Uses a free provider when connected.':info.status==='needs_key'||info.status==='not_configured'?'Sportsbook connection awaiting a provider key. Enter odds manually for now.':info.status==='unavailable'?'Bookmaker prices could not be loaded. No estimated odds are substituted.':info.status==='quota_paused'?'Free-tier limit reached or stale. No prices can be selected.':!rows?.matched?esc(rows?.reason||'No verified prices were matched.'):
  `Bookmaker snapshot ${esc(formatFresh(info.asOf))} · ${info.status==='stale'||!current?'expired — check sportsbook':'reference quote — verify live price'}`;
 return `<div class="panel sportsbook-panel"><div class="odds-panel-heading"><span class="block-label">SPORTSBOOK MONEYLINE COMPARISON</span><span class="tag">US · Provider quotes</span></div><p class="muted-sm">${status}</p>${rows?.matched?`<div class="odds-books">${buttons}</div>`:''}<div class="form-actions"><button class="neutral-button small-btn" data-action="load-odds" data-game="${esc(g.id)}" ${busy?'disabled':''}>${busy?'Checking…':info?'Check cached prices':'Compare sportsbook odds'}</button></div><small class="muted-sm">The Odds API · up to 8-hour cached prices · moneyline only. Prices can change and may be unavailable. This is not live betting or a model confidence score. Quotes may be hours old; always confirm the current book price. Verify the current price directly at the sportsbook.</small></div>`;
}
function gameDrawer(){const d=state.drawer,g=d.game;return `<div class="drawer-head"><div class="drawer-title"><span class="team-logo">${esc(SPORTS[g.league].emoji)}</span><div><div class="eyebrow">${esc(g.league.toUpperCase())} / MATCHUP</div><h2>${esc(g.away.abbr||g.away.name)} @ ${esc(g.home.abbr||g.home.name)}</h2><small>${g.demo?'Example matchup':`${formatDay(g.start)} · ${formatTime(g.start)}`}</small></div></div><button class="drawer-close" data-action="close" aria-label="Close panel">×</button></div>${g.demo?`<div class="error-note">UI example only. Do not treat this as a scheduled game.</div>`:''}${modelPanel(g)}${currentSeasonPanel(g)}${nflCoachingPanel(g)}${recentScoringMatchupPanel(g)}${nflAvailabilityPanel(g)}<div class="panel"><span class="block-label">MATCHUP</span><div class="details-grid"><div>${logo(g.away,g.league)}<div style="margin-top:8px"><strong>${esc(g.away.name)}</strong></div><button class="inline-link" data-action="team" data-game="${esc(g.id)}" data-team="away" style="margin-top:6px">Injuries · Roster · News ↗</button></div><div>${logo(g.home,g.league)}<div style="margin-top:8px"><strong>${esc(g.home.name)}</strong></div><button class="inline-link" data-action="team" data-game="${esc(g.id)}" data-team="home" style="margin-top:6px">Injuries · Roster · News ↗</button></div></div></div><div class="panel"><span class="block-label">GAME DETAILS</span><div class="result-row" style="justify-content:space-between;margin-bottom:12px"><span class="muted">Game status</span><strong>${esc(g.demo?'Example only':g.statusText)}</strong></div><div class="result-row" style="justify-content:space-between;margin-bottom:12px"><span class="muted">Scheduled start (Eastern Time)</span><strong class="drawer-start-time">${esc(g.demo?'Not verified':formatTime(g.start))}</strong></div><div class="result-row" style="justify-content:space-between"><span class="muted">Sportsbook odds</span><strong>See US market quotes below, if connected</strong></div></div>${sportsbookOddsPanel(g)}${marketHistoryPanel(g)}${pregameStarterPanel(g)}${weatherPanel(g)}${matchupFactorsPanel(g)}<div class="panel"><h3>Build a ticket</h3><p>Copy a sourced moneyline quote above, or enter a price manually.</p><button class="btn" data-action="quickpick" data-game="${esc(g.id)}" style="margin-top:13px">Add to ticket ↗</button></div><details class="panel data-panel"><summary>Model roadmap & limits</summary><p>This first transparent baseline uses season W-L form and assumed home advantage. Weather increases the displayed uncertainty range for outdoor games when a forecast is available. A trained Elo model, injury impact, sport-specific player projections, calibrated confidence, independent historical backtests and verified sportsbook prices still require a production data pipeline. A projected winner does not imply a profitable bet.</p></details>`;}
