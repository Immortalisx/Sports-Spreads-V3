function navigation(){return `<aside class="sidebar"><div class="brand-wrap"><div class="brand"><span class="brand-symbol">↗</span><span>sports<span>spreads</span></span></div><div class="beta">THE EDGE, SIMPLIFIED</div></div><nav class="nav" aria-label="Primary navigation">${[['games','grid','Games'],['teams','teams','Teams'],['tickets','ticket','Builder'],['history','history','Saved']].map(([id,svg,label])=>`<button data-action="nav" data-section="${id}" class="${state.section===id?'active':''}" aria-current="${state.section===id?'page':'false'}">${icon(svg)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><button class="nav-settings" data-action="about">⚙  About & sources</button></div><div class="sidebar-foot">SPORTS SPREADS / V3</div></aside>`;}
function topbar(){
 const titles={games:['Games','Scores, schedules & team details'],teams:['Teams','Rosters, injuries & news'],tickets:['Build a parlay','Odds in. Numbers out.'],history:['Saved tickets','Your snapshots, on this device'],about:['Sources & settings','What is connected, and what is not']};
 const [h,sub]=titles[state.section];
 return `<div class="topbar"><div class="hero"><div class="eyebrow">THE GAME, AT A GLANCE</div><h1>${esc(h)}</h1><p>${esc(sub)}</p></div><div class="top-actions"><button class="header-action big-screen-launch" data-action="big-screen" aria-label="Enter big screen mode" title="TV / big screen display">▣ Big Screen</button><button class="header-action" data-action="share" aria-label="Copy clean website link">↗ Share</button><button class="header-action header-feedback" data-action="feedback" aria-label="Give feedback">Feedback</button><div class="status ${state.error?'warning':''}" title="${esc(state.error?'Live feed unavailable — examples shown':state.loading?'Checking sports feed':state.feed?.demo?'Sample preview':'Sports feed connected')}"><i></i>${state.loading?'Checking':state.error?'Examples':'Feed ready'}</div><button class="icon-button about-trigger" data-action="about" aria-label="About data sources" title="About sources">ⓘ</button></div></div>`;
}
function leaguebar(){return `<div class="leaguebar" role="tablist" aria-label="League">${Object.entries(SPORTS).map(([id,s])=>`<button role="tab" aria-selected="${state.league===id}" class="league ${state.league===id?'active':''}" data-action="league" data-league="${id}"><span class="emoji">${s.emoji}</span> ${s.label}</button>`).join('')}</div>`;}
function logo(team,league){const url=safeUrl(team.logo);return `<span class="team-logo" aria-hidden="true">${url?`<img alt="" src="${esc(url)}" loading="lazy" onerror="this.remove();this.parentElement.textContent='${esc(SPORTS[league]?.emoji||'●')}'">`:esc(SPORTS[league]?.emoji||'●')}</span>`;}
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
 const card=(name,t)=>'<div class="current-form-team"><strong>'+esc(name)+'</strong>'+
   '<span><b>'+pct(t.last5.winRate)+'</b><small>Last 5 win rate</small></span>'+
   '<span><b>'+pct(t.last10.winRate)+'</b><small>Last 10 win rate</small></span>'+
   '<span><b>'+fmt(t.last5.opponentAdjustedMargin)+'</b><small>Opponent-adjusted form index</small></span>'+
   '<span><b>'+esc(t.restDays??'—')+'</b><small>Days since previous game</small></span></div>';
 return '<div class="panel current-form-panel">'+heading+
  '<div class="current-form-grid">'+card(g.away.name,r.away)+card(g.home.name,r.home)+'</div>'+
  '<p class="current-form-disclaimer">Calculated from the most recent completed regular-season games, including prior-opponent strength and scoring margins. Data through '+esc(r.evidence?.latestCompletedGame||'unknown')+
  '. Metrics are informational research signals; they are NOT yet calibrated win probabilities, model confidence or betting edges.</p></div>';
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
   <p class="model-weather">${esc(weatherLine)}</p>
   <details class="model-method"><summary>How this estimate works</summary>
   <p>Version ${esc(m.version)} · ${esc(m.source)} · W–L records ${esc(m.awayRecord)} vs ${esc(m.homeRecord)}. ${m.validated?'Uses league-specific parameters learned from earlier games and calibrated on a separate season.':'Uses record shrinkage and an assumed home advantage.'} ${esc(m.note)} Injuries, lineup changes, true Elo history, sportsbook prices and player prop forecasts are not included. Do not interpret this as a betting edge or validated confidence grade.</p></details></div>`;
}
function marketCardLabel(game){
 const market=globalThis.SportsOdds?.marketConsensus?.(game,state.odds[game.league]);
 if(!market||game.status!=='scheduled')return modelLabel(game);
 const homeFav=market.homeProbability>=market.awayProbability;
 const favorite=homeFav?game.home:game.away;
 const p=homeFav?market.homeProbability:market.awayProbability;
 return 'Market '+esc(favorite.abbr||favorite.shortName||favorite.name)+' '+Math.round(p*100)+'% · '+market.bookCount+' books';
}
function gameCard(game){const teams=game.status==='final' || game.status==='live';const middle=teams&&game.away.score!==null&&game.home.score!==null?`<span class="score">${esc(game.away.score)}–${esc(game.home.score)}</span>`:`<span class="versus">VS</span><small>${game.demo?(game.start?formatTime(game.start):'Sample'):formatTime(game.start)}</small>`;return `<article class="game"><div class="game-top"><span class="game-date">${game.demo?'SAMPLE MATCHUP':esc(formatDay(game.start))} ${!game.demo?'· '+esc(formatTime(game.start)):''}</span><span class="tag ${game.demo?'demo':game.status==='live'?'live':game.status==='final'?'final':''}">${game.demo?'Demo':esc(game.status)}</span></div><div class="teams"><div class="team-col">${logo(game.away,game.league)}<button data-action="team" data-team="away" data-game="${esc(game.id)}" title="View ${esc(game.away.name)} team report">${esc(game.away.name)}</button><span class="record">${esc(game.away.record||game.away.abbr||'')}</span></div><div class="match-center">${middle}</div><div class="team-col">${logo(game.home,game.league)}<button data-action="team" data-team="home" data-game="${esc(game.id)}" title="View ${esc(game.home.name)} team report">${esc(game.home.name)}</button><span class="record">${esc(game.home.record||game.home.abbr||'')}</span></div></div><div class="game-foot"><span>${marketCardLabel(game)}</span><button class="drill" data-action="game" data-game="${esc(game.id)}">Game details ↗</button></div></article>`;}
function filteredGames(){const games=state.feed?.games??[];const q=state.search.trim().toLowerCase();return q?games.filter(x=>(x.home.name+' '+x.away.name+' '+x.home.abbr+' '+x.away.abbr).toLowerCase().includes(q)):games;}
/** Dedicated viewing mode: no sidebar or betting widgets, full-screen compatible. */
function bigScreenBoard(){
 const games=filteredGames();
 const official=state.feed&&!state.feed.demo;
 return `<div class="tv-shell" role="region" aria-label="Big Screen scoreboard">
 <header class="tv-header">
  <div class="tv-identity"><span class="tv-mark" aria-hidden="true">↗</span><div><strong>SPORTS <span>SPREADS</span></strong><small>GAME DAY · LIVE BOARD</small></div></div>
  <div class="tv-header-controls"><button type="button" class="tv-button" data-action="refresh" aria-label="Refresh scores">${icon('refresh')} <span>Refresh</span></button><button type="button" class="tv-button tv-exit" data-action="big-screen" aria-label="Exit Big Screen Mode">✕ <span>Exit big screen</span></button></div>
 </header>
 <div class="tv-toolbar"><div class="tv-leagues" role="tablist" aria-label="Sport">${Object.entries(SPORTS).map(([id,s])=>`<button role="tab" aria-selected="${state.league===id}" class="tv-league ${state.league===id?'active':''}" data-action="league" data-league="${id}">${s.emoji} ${esc(s.label)}</button>`).join('')}</div><label class="tv-date">Game date <input type="date" id="date" aria-label="Big screen game date" value="${esc(state.date)}"/></label></div>
 <div class="tv-headline"><div><span class="tv-kicker">${esc(SPORTS[state.league]?.label||'SPORTS')} / MATCHUPS</span><h1>${esc(SPORTS[state.league]?.label||'Sports')} scoreboard</h1></div><div class="tv-data-status"><span class="small-pip ${official?'pip-green':''}"></span>${state.loading?'Updating…':official?`${state.feed.games.length} games · ${esc(formatFresh(state.feed.updatedAt))}`:'Feed unavailable'}</div></div>
 ${state.error?`<div class="tv-error" role="status">Live feed unavailable. Displaying no unverified results. Select Refresh.</div>`:''}
 ${state.loading?`<div class="tv-empty">Loading matchups…</div>`:games.length?`<section class="tv-game-grid" aria-label="${esc(SPORTS[state.league]?.label)} matchups">${games.map(gameCard).join('')}</section>`:`<div class="tv-empty">No scheduled ${esc(SPORTS[state.league]?.label)} games on this date.</div>`}
 <footer class="tv-footer"><span>SPORTS SPREADS • COMMUNITY BETA</span><span>NBA/MLB record model holdout-tested · NFL/NHL research-only</span></footer>
 </div>`;
}
function directoryView(){const d=state.directory[state.league];const teams=d?.teams??[];const q=state.search.trim().toLowerCase();const filtered=q?teams.filter(t=>(t.name+' '+t.abbr).toLowerCase().includes(q)):teams;return `${leaguebar()}<div class="tools"><div class="datebox"><span>TEAM DIRECTORY</span><span class="tag">${esc(SPORTS[state.league].label)}</span></div><div class="tools-right"><input id="team-search" class="search" type="search" aria-label="Search league teams" placeholder="Find a team..." value="${esc(state.search)}" /><button class="neutral-button" data-action="reload-teams">${icon('refresh')} Refresh</button></div></div>${d?.error?`<div class="error-note"><strong>Preview:</strong> ${esc(d.error)}. No example teams are substituted. Try refreshing once the provider recovers.</div>`:''}<div class="section-header"><div><h2>Team directory</h2><p>${state.directoryLoading[state.league]?'Loading…':`${filtered.length} teams · Select one to open its report`}</p></div></div>${state.directoryLoading[state.league]?`<div class="empty"><h3>Loading teams…</h3></div>`:filtered.length?`<div class="game-grid">${filtered.map(t=>`<article class="game" style="padding:16px 19px"><div class="teams" style="justify-content:flex-start">${logo(t,state.league)}<div style="flex:1;min-width:0"><button data-action="directory-team" data-team-id="${esc(t.id)}" style="border:0;color:var(--text);font-weight:800;background:transparent;text-align:left;font-size:15px;padding:3px 0">${esc(t.name)} ↗</button><div class="person-info">${esc(t.abbr||state.league.toUpperCase())}${d.demo?' · Example directory':''}</div></div><button data-action="directory-team" data-team-id="${esc(t.id)}" class="neutral-button small-btn">Report</button></div></article>`).join('')}</div>`:`<div class="empty"><h3>No teams found</h3><p>${q?'Try a different name.':'The team feed did not return a directory.'}</p></div>`}`;}
function board(){
 const games=filteredGames(),official=state.feed&&!state.feed.demo;
 return `${leaguebar()}<div class="tools"><div class="datebox"><span>DATE</span><input id="date" type="date" aria-label="Game date" value="${esc(state.date)}" /></div><div class="tools-right"><input class="search" id="search" type="search" placeholder="Search teams…" aria-label="Search teams" value="${esc(state.search)}"/><button class="neutral-button compact-refresh" data-action="refresh">${icon('refresh')} Refresh</button></div></div>
 ${state.error?`<div class="error-note"><strong>Example mode.</strong> ${esc(state.error)}. No unverified sample games are shown. Try Refresh.</div>`:''}
 <div class="quick-status"><div><span class="small-pip ${official?'pip-green':''}"></span><strong>${state.loading?'Checking feed…':official?`${state.feed.games.length} listed matchups`:'Preview fixtures'}</strong></div><div class="muted-sm">${official?`Updated ${esc(formatFresh(state.feed.updatedAt))}`:'No verified picks or odds'}</div></div>
 <div class="section-header"><div><h2>${esc(SPORTS[state.league].label)} matchups</h2></div><span class="legend">Tap a team for details</span></div>
 ${state.loading?`<div class="empty"><h3>Loading games…</h3></div>`:games.length?`<section class="game-grid">${games.map(gameCard).join('')}</section>`:`<div class="empty"><h3>${state.search?'No matching teams':'No games listed'}</h3><p>${state.search?'Try another team name.':'Nothing scheduled for this league and date, or the feed has no results.'}</p></div>`}
 <details class="source-foot"><summary>Data & model status</summary><p>${official?'Sports schedules and results come from an unofficial ESPN website feed.':'This is an interface preview. Unverified sample games are marked.'} NBA/MLB record-only probabilities passed historical 2025 holdout checks. NFL/NHL estimates and deeper player models have not. Moneyline quotes are cached, not live betting guarantees. Verify data with primary sources.</p></details>`;
}
function parseAmerican(x){const v=Number(x);return Number.isInteger(v)&&Math.abs(v)>=100&&Math.abs(v)<=100000?v:null;}
function calcTicket(){if(!state.ticket.length)return null;let multiplier=1;for(const leg of state.ticket){const x=parseAmerican(leg.odds);if(x===null)return null;multiplier*=x>0?1+x/100:1+100/Math.abs(x);}const stake=Number(state.stake);if(!Number.isFinite(stake)||stake<=0||stake>1000000)return null;return {multiplier,return:multiplier*stake,profit:(multiplier-1)*stake};}
// The ticker uses independent transitions: the previous value fades away as the updated value settles.
// Combined odds and breakeven % are sportsbook-price mathematics, NOT a model prediction.
let previousTickerValues=null;
function americanCombined(multiplier){
 if(!Number.isFinite(multiplier)||multiplier<=1)return '—';
 const value=multiplier>=2?Math.round((multiplier-1)*100):-Math.round(100/(multiplier-1));
 return `${value>0?'+':''}${value}`;
}
function tickerAmount(key,value){
 const old=previousTickerValues?.[key];
 if(old!==undefined&&old!==value){
  return `<span class="ticker-change" aria-label="${esc(value)}"><span class="ticker-old" aria-hidden="true">${esc(old)}</span><span class="ticker-new">${esc(value)}</span></span>`;
 }
 return `<span class="ticker-fixed">${esc(value)}</span>`;
}
function ticketTicker(estimate){
 const numbers={
  odds:estimate?americanCombined(estimate.multiplier):'—',
  implied:estimate?`${(100/estimate.multiplier).toFixed(1)}%`:'—',
  model:(()=>{const p=globalThis.SportsAutoTicket?.ticketConfidence?.(state.ticket);return p===null||p===undefined?'—':`${(p*100).toFixed(1)}%`;})(), // Only a single validated leg; no guessed parlay joint confidence.
  return:estimate?money(estimate.return):'—',
 };
 const markup=`<section class="ticket-ticker" aria-label="Live ticket summary">
  <div class="ticker-label"><span class="ticker-indicator" aria-hidden="true"></span> TICKET LIVE <span class="ticker-legs">${state.ticket.length} ${state.ticket.length===1?'leg':'legs'}</span></div>
  <div class="ticker-values">
   <div class="ticker-stat"><span class="ticker-name">Combined odds</span><strong>${tickerAmount('odds',numbers.odds)}</strong></div>
   <div class="ticker-stat"><span class="ticker-name">Market break-even</span><strong>${tickerAmount('implied',numbers.implied)}</strong></div>
   <div class="ticker-stat"><span class="ticker-name">Model confidence</span><strong>${tickerAmount('model',numbers.model)}</strong></div>
   <div class="ticker-stat"><span class="ticker-name">Potential return</span><strong>${tickerAmount('return',numbers.return)}</strong></div>
  </div>
  ${ticketWarnings().length?'<div class="ticker-risk">⚠ Correlation review</div>':''}<div class="ticker-disclaimer">Manual or sourced moneyline prices · Verify before any wager · Confidence awaits verified model</div>
 </section>`;
 previousTickerValues=numbers;
 return markup;
}
function ticketWarnings(legs=state.ticket){
 const warnings=[];
 const seen=new Map(), byGame=new Map(), byPlayer=new Map();
 for(const leg of legs){
  const key=[leg.league,leg.market,String(leg.selection).trim().toLowerCase(),String(leg.notes||'').trim().toLowerCase()].join('|');
  if(seen.has(key))warnings.push({kind:'duplicate',message:`Repeated selection: ${leg.selection}`});
  else seen.set(key,true);
  if(leg.gameId){const group=byGame.get(leg.gameId)||[];if(group.length && !group.some(x=>x.market===leg.market&&x.selection===leg.selection))warnings.push({kind:'same-game',message:`Multiple legs from one game may be correlated or restricted by the sportsbook.`});group.push(leg);byGame.set(leg.gameId,group);}
  if(leg.playerId){const group=byPlayer.get(`${leg.league}/${leg.playerId}`)||[];if(group.length && !group.some(x=>x.market===leg.market&&x.selection===leg.selection))warnings.push({kind:'player-overlap',message:`Multiple props on one player may be correlated.`});group.push(leg);byPlayer.set(`${leg.league}/${leg.playerId}`,group);}
 }
 const quotedBooks=[...new Set(legs.map(x=>String(x.bookmaker||'').trim().toLowerCase()).filter(Boolean))];
 if(quotedBooks.length>1)warnings.push({kind:'multiple-books',message:'These odds come from different sportsbooks and may not be combinable on one ticket at the displayed payout.'});
 return warnings.filter((w,i,a)=>a.findIndex(x=>x.kind===w.kind&&x.message===w.message)===i);
}
const MARKETS={nfl:['Moneyline','Spread','Total','Player yards','Touchdowns','Other'],nba:['Moneyline','Spread','Total','Player points','Player rebounds','Other'],nhl:['Moneyline','Puck line','Total','Shots on goal','Other'],mlb:['Moneyline','Run line','Total','Pitcher strikeouts','Other']};
const PROPS={nfl:[['Player yards',0,200,5,'yds'],['Touchdowns',0,5,1,'TD']],nba:[['Player points',0,60,1,'pts'],['Player rebounds',0,25,1,'reb']],nhl:[['Shots on goal',0,12,1,'shots']],mlb:[['Pitcher strikeouts',0,15,1,'K']]};
function propInfo(league,market){return (PROPS[league]||[]).find(x=>x[0]===market)||null;}
function propNote(market,value){return market==='Touchdowns'?(value===0?'0 TD (no meaningful threshold)':`At least ${value} TD`):`Over ${value+0.5} ${({'Player yards':'yards','Player points':'points','Player rebounds':'rebounds','Shots on goal':'shots','Pitcher strikeouts':'strikeouts'})[market]||''}`;}
function propFields(league,market){const info=propInfo(league,market);if(!info)return '<div id="prop-controls"></div>';return `<div class="prop-control" id="prop-controls"><label for="prop-line">Line target <output id="prop-line-value">${esc(propNote(market,market==='Touchdowns'?1:Math.min(info[2],market==='Player yards'?50:10)))}</output></label><input type="range" id="prop-line" data-market="${esc(market)}" min="${info[1]}" max="${info[2]}" value="${market==='Touchdowns'?1:Math.min(info[2],info[0]==='Player yards'?50:10)}" step="${info[3]}"><small class="muted">Line selector only · No live pricing or probability</small></div>`;}
function autoTicketPanel(){
 const target=state.autoTicket.target;
 return `<section class="auto-ticket-card" aria-label="Confidence target ticket generator">
 <div class="auto-ticket-top"><div><div class="block-label">AUTO TICKET · MARKET RESEARCH</div><h3>Choose a market probability</h3></div><div class="auto-target-badge" aria-label="Market-implied probability target, not model confidence"><small>MARKET TARGET</small><strong id="auto-target">${target}%</strong><span id="auto-grade">NO-VIG</span></div></div>
 <label class="auto-slider-label" for="auto-confidence">Bookmaker-implied chance <span class="muted-sm">50–95%</span></label>
 <input type="range" id="auto-confidence" min="50" max="95" step="5" value="${target}" style="--slider-progress:${((target-50)/45*100).toFixed(1)}%" aria-describedby="auto-helper"/>
 <div class="auto-ticket-bottom"><p id="auto-helper">Auto-fills from cached bookmaker lines · not model confidence.</p><button class="btn auto-build" type="button" data-action="generate-ticket">Generate ticket ↗</button></div>
 ${state.autoTicket.status?`<p class="auto-ticket-status" role="status">${esc(state.autoTicket.status)}</p>`:''}
 <details class="auto-ticket-why"><summary>How does this work?</summary><p>Uses the average bookmaker-implied chance after removing the margin, then selects up to two different games above your threshold. No calibrated model confidence or betting edge is claimed; quotes may change.</p></details>
 </section>`;
}
function ticketModeTabs(){
 const active=state.ticketMode==='automatic'?'automatic':'manual';
 return '<div class="ticket-tabs" role="tablist" aria-label="Ticket mode">'+
  ['automatic','manual'].map(mode=>'<button type="button" role="tab" data-action="ticket-mode" data-mode="'+mode+'" aria-selected="'+(active===mode)+'" class="'+(active===mode?'active':'')+'">'+
   (mode==='automatic'?'Suggested tickets':'Manual builder')+'</button>').join('')+'</div>';
}
function dailySuggestionsPanel(){
 const d=state.daily||{},stamp=d.generatedAt?formatFresh(d.generatedAt):'Not generated';
 let contents;
 if(d.loading&&!d.loaded)contents='<div class="daily-empty">Loading cached daily tickets…</div>';
 else if(d.error)contents='<div class="daily-empty">Suggestions unavailable. You can still use the manual ticket builder.</div>';
 else if(!d.loaded||!d.cards?.length)contents='<div class="daily-empty">No daily slate published yet. Cards appear after the scheduled shared-odds refresh.</div>';
 else contents='<div class="daily-ticket-grid">'+d.cards.map(c=>{
  if(!c.available)return '<article class="daily-ticket-card '+(c.id==='big-one'?'big-one':'')+'"><div class="daily-card-title"><strong>'+esc(c.name)+'</strong><span>NO SLATE</span></div><p class="muted-sm">'+esc(c.reason||'Insufficient verified games')+'</p></article>';
  const valid=c.legs?.every(l=>Date.parse(l.oddsAsOf)>Date.now()-8*3600_000&&Date.parse(l.start)>Date.now());
  const canLoad=valid&&!state.ticket.length;
  const label=!valid?'Quotes expired':state.ticket.length?'Clear ticket first':'Load research ticket';
  return '<article class="daily-ticket-card '+(c.id==='big-one'?'big-one':'')+'">'+
   '<div class="daily-card-title"><strong>'+esc(c.name)+'</strong><span>MARKET GRADE '+esc(c.marketGrade||'—')+'</span></div>'+
   '<div class="daily-card-sub">'+esc(c.bookmaker)+' · '+esc(c.legCount)+' different games</div>'+
   '<div class="daily-card-metrics"><div><strong>'+Math.round(100*(c.marketProbabilityProduct||0))+'%</strong><small>Independence illustration</small></div>'+
   '<div><strong>'+Number(c.payoutMultiplier||0).toFixed(2)+'×</strong><small>Potential multiplier</small></div></div>'+
   '<div class="daily-price">Per $10: possible return <strong>'+money(c.returnAt10)+'</strong></div>'+
   '<div class="daily-picks">'+(c.legs||[]).map(l=>'<span>'+esc(l.selection)+' <b>'+(Number(l.odds)>0?'+':'')+esc(l.odds)+'</b></span>').join('')+'</div>'+
   '<button type="button" class="neutral-button daily-load" data-action="daily-ticket-load" data-id="'+esc(c.id)+'" '+(!canLoad?'disabled':'')+'>'+esc(label)+'</button></article>';
 }).join('')+'</div>';
 return '<section class="daily-suggestions" aria-label="Daily suggested automatic tickets">'+
 '<div class="daily-section-head"><div><div class="block-label">ONCE DAILY · SAME-BOOK PRICES</div><h3>Suggested tickets</h3></div><small>Updated '+esc(stamp)+'</small></div>'+contents+
 '<p class="daily-disclaimer">Grades reflect bookmaker-implied probability only. Combined chances assume independent games and have not been calibrated as parlays. No guaranteed profit. Confirm every quote before wagering.</p>'+
 '</section>';
}
function ticketView(){const estimate=calcTicket();const draft=state.draft||{};return `<div class="section-top section-header"><div><h2>Ticket builder</h2><p>Your selections. Your sportsbook prices.</p></div></div>${ticketTicker(estimate)}${ticketModeTabs()}${state.ticketMode==='automatic'?autoTicketPanel()+dailySuggestionsPanel():''}<div class="ticket-layout ${state.ticketMode==='automatic'?'auto-only':''}"><div class="form-card"><h3>Add selection</h3><p>Enter odds from your sportsbook.</p><form id="leg-form"><div class="form-grid"><div class="form-item"><label for="leg-league">Sport</label><select id="leg-league">${Object.entries(SPORTS).map(([id,s])=>`<option value="${id}" ${id===(draft.league||state.league)?'selected':''}>${s.label}</option>`).join('')}</select></div><div class="form-item"><label for="leg-market">Market</label><select id="leg-market">${(MARKETS[draft.league||state.league]||MARKETS.nba).map(m=>`<option ${m===(draft.market||'Moneyline')?'selected':''}>${m}</option>`).join('')}</select></div>${propFields(draft.league||state.league,draft.market||'Moneyline')}<div class="form-item wide"><label for="leg-selection">Team or player · selection</label><input type="text" id="leg-selection" required maxlength="95" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="selection-suggestions" placeholder="Type 3+ letters for teams or players" value="${esc(draft.selection||'')}"><div id="selection-suggestions" role="listbox" aria-label="Matching teams and players" class="suggest-menu" hidden></div><p id="suggestion-hint" class="muted-sm">Type 3 letters to find a team. Select a team to search its roster.</p></div><div class="form-item"><label for="leg-odds">American odds</label><input type="text" id="leg-odds" required placeholder="e.g. -110 or +135" pattern="[+-]?[0-9]+" value="${esc(draft.odds??'')}" /></div><div class="form-item"><label for="leg-notes">Line / notes</label><input type="text" id="leg-notes" maxlength="85" placeholder="e.g. Over 25.5 points" /></div></div><div class="form-actions"><button type="submit" class="btn">+ Add leg</button></div><div id="form-error" class="notice" role="alert"></div></form></div><div class="form-card"><h3>My ticket <span class="muted">(${state.ticket.length})</span></h3><p>Saved on this device. No bets placed.</p>${state.ticket.length?`<div class="ticket-items">${state.ticket.map((t,i)=>`<div class="ticket-item"><div class="ticket-head"><strong>${esc(t.selection)}</strong><button data-action="remove-leg" data-index="${i}" title="Remove leg" aria-label="Remove ${esc(t.selection)}">×</button></div><small>${esc(t.league.toUpperCase())} / ${esc(t.market)} ${t.notes?'· '+esc(t.notes):''}</small><small>${t.bookmaker?esc(t.bookmaker)+' quote · ':'Entered odds · '}${Number(t.odds)>0?'+':''}${esc(t.odds)}</small></div>`).join('')}</div>${ticketWarnings().length?`<div class="correlation-warning" role="status"><strong>⚠ Review this combination</strong><ul>${ticketWarnings().map(w=>`<li>${esc(w.message)}</li>`).join('')}</ul><small>Advisory only; no correlation-adjusted confidence is calculated.</small></div>`:''}<div class="ticket-totals"><div class="result-row"><span class="muted">Stake</span><input type="number" id="stake" min="0.01" max="1000000" step="0.01" value="${esc(state.stake)}" style="width:100px;text-align:right"></div><div class="result-row"><span class="muted">Decimal multiplier</span><strong>${estimate?estimate.multiplier.toFixed(2)+'×':'—'}</strong></div><div class="result-row"><span class="muted">Potential return</span><strong class="accent">${estimate?money(estimate.return):'—'}</strong></div><div class="result-row"><span class="muted">Potential profit</span><strong>${estimate?money(estimate.profit):'—'}</strong></div></div><div class="footlinks"><button class="btn small-btn" data-action="archive-ticket">Save snapshot</button>${state.cloud.configured&&state.cloud.token?`<button data-action="cloud-save">Save to cloud</button>`:``}<button data-action="export-ticket">Export JSON</button><button data-action="clear-ticket">Clear ticket</button></div>`:`<div class="empty" style="padding:24px"><h3>Nothing added yet</h3><p>Add a leg to get started.</p></div>`}<p class="notice">Illustrative payout; your sportsbook may restrict combinations or change prices.</p></div></div>`;}
function historyView(){return `<section class="section-top"><div class="section-header"><div><h2>Saved tickets</h2><p>Local snapshots, not placed bets or verified model forecasts.</p></div></div>${state.history.length?`<div class="archive-list">${state.history.map((t,i)=>`<article class="form-card archive-card"><div><div class="eyebrow">${esc(new Date(t.savedAt).toLocaleString())} · ${esc(t.source||'manual odds')}</div><h3>${esc(t.label||`Ticket ${state.history.length-i}`)}</h3><p>${t.legs.length} ${t.legs.length===1?'leg':'legs'} · Stake ${esc(money(t.stake))} · ${esc(t.americanOdds||'—')} combined · Return ${esc(t.potentialReturn===null?'Uncomputed':money(t.potentialReturn))}</p><small class="muted">Not graded · Confidence unavailable · Snapshot cannot be edited</small></div><button class="neutral-button small-btn" data-action="restore-archive" data-index="${i}">Copy to builder</button></article>`).join('')}</div>`:`<div class="empty"><h3>No saved tickets yet</h3><p>Save a ticket snapshot to keep a record of the odds and selections you entered.</p><button class="btn" data-action="nav" data-section="tickets">Build a ticket</button></div>`}<details class="panel data-panel section-top"><summary>Cloud sync · optional</summary>${state.cloud.configured?`${state.cloud.token?`<p>Signed in for this browser session. Snapshots can be synchronized to your account.</p><div class="footlinks"><button data-action="cloud-fetch">Refresh cloud history</button><button data-action="cloud-signout">Sign out</button></div>${state.cloud.tickets.length?`<div class="archive-list">${state.cloud.tickets.map(t=>`<div class="archive-card"><strong>${esc(t.label)}</strong><div class="muted-sm">${esc(new Date(t.created_at).toLocaleString())} · ${t.legs.length} legs · ${esc(t.combined_american_odds)} · Not graded</div></div>`).join('')}</div>`:''}`:`<p>Sign in by email to keep saved tickets across devices. Configure your site URL as an allowed Auth redirect in Supabase.</p><form id="cloud-login"><label for="cloud-email">Email</label><input type="email" id="cloud-email" autocomplete="email" required placeholder="you@example.com"/><button class="btn small-btn" type="submit">Email sign-in link</button></form>`}`:'<p>Cloud storage is not configured yet. Local ticket snapshots work without an account.</p>'}<p class="notice" role="status">${esc(state.cloud.status)}</p></details><details class="panel data-panel section-top"><summary>Prediction accountability (next integration)</summary><p>The original model is not connected yet. Accurate ROI, calibration and Brier-score tracking require immutable, timestamped model forecasts and confirmed game results. These manual tickets are not evidence of model performance.</p></details></section>`;}
function archiveTicket(){const result=calcTicket();if(!result||state.ticket.length===0){notify('Enter valid odds and a positive stake before saving.');return;}
 const stamp=new Date().toISOString();const snapshot={id:`snapshot-${Date.now()}`,savedAt:stamp,source:'manually entered / unverified',label:`Ticket · ${new Date().toLocaleDateString()}`,stake:Number(state.stake),legs:JSON.parse(JSON.stringify(state.ticket)),americanOdds:americanCombined(result.multiplier),potentialReturn:Math.round(result.return*100)/100,modelProbability:null,result:'ungraded'};
 state.history.unshift(snapshot);state.history=state.history.slice(0,100);try{localStorage.setItem('ss-v2-archives',JSON.stringify(state.history));}catch{notify('Local storage unavailable — unable to save.');return;}
 notify('Snapshot saved locally.');render();return snapshot;
}
function aboutView(){return `<section class="section-top"><div class="section-header"><div><h2>System & sources</h2><p>What is connected, and what is still experimental.</p></div></div>
<div class="arch-grid"><div class="feature"><div class="feature-icon">⌁</div><h3>Game feeds</h3><p>Unofficial ESPN site-feed through a rate-limited relay. It may be delayed or unavailable. Verify results with league sources.</p></div>
<div class="feature"><div class="feature-icon">∑</div><h3>Matchup model</h3><p>NBA/MLB team-record probabilities passed held-out calibration. NFL/NHL remain research-only. Injuries, starters and advanced tactical factors do not yet enter verified predictions.</p></div>
<div class="feature"><div class="feature-icon">▦</div><h3>Saved tickets</h3><p>${state.cloud.configured?'Supabase cloud storage is connected; email sign-in depends on configured Auth providers.':'Local saving is available; cloud sync is not configured.'} Manually entered odds are not verified sportsbook prices.</p></div></div>
<details class="panel data-panel section-top"><summary>Model lab · historical validation</summary><p>Sports Spreads now includes a separate, manually run four-sport historical results pipeline and walk-forward research evaluator. NFL team history, NBA form, NHL goalies and MLB pitcher–hitter factors each require their own point-in-time sources. Results-based form, offense/defense and rest signals can be reconstructed from earlier completed games; player-versus-scheme, confirmed starters and coaching tactics cannot be inferred from outcomes alone.</p><p>Training, calibration and a later holdout season are kept separate. Experimental coefficients remain off the public predictions unless reliable pregame evidence improves independently held-out results. No model ROI or player-prop confidence claims are made.</p><p>Documentation: <a href="https://github.com/Immortalisx/Sports-Spreads-V3/blob/main/docs/MODEL_RESEARCH_PIPELINE.md" target="_blank" rel="noopener noreferrer">Research methods ↗</a></p></details>
<details class="panel data-panel"><summary>Big Screen / TV view</summary><p>Choose Big Screen at the top of Games, or open <a href="https://sports-spreads.onrender.com/?display=tv" target="_blank" rel="noopener noreferrer">TV view ↗</a> on a laptop or TV browser. Fullscreen is optional; choose Exit big screen to return.</p></details>
</section>`;}

function getGame(id){return (state.feed?.games??[]).find(x=>x.id===id);}
function getTeamCacheKey(){const d=state.drawer;if(!d||d.type!=='team')return'';return `${d.league}-${d.team.id}-${state.teamTab}`;}
function dataMeta(result){return `<div class="data-meta">${result?.source?`Source: <span>${esc(result.source)}</span> · `:''}${result?.updatedAt?`Checked ${esc(formatFresh(result.updatedAt))}`:'No source timestamp'}${result?.cache==='stale'?' · STALE CACHE':''}</div>`;}
function teamContent(){const key=getTeamCacheKey();const data=state.teamCache[key];if(state.teamLoading[key])return `<div class="loading-pulse">Loading ${esc(state.teamTab)}…</div>`;if(state.teamErrors[key])return `<div class="panel"><h3>Data unavailable</h3><p>${esc(state.teamErrors[key])} This section doesn't display unverified substitutes.</p><button class="neutral-button small-btn" style="margin-top:14px" data-action="retry-team">Retry</button></div>`;if(!data)return `<div class="loading-pulse">Select a team information tab.</div>`;
 if(state.teamTab==='roster')return `${dataMeta(data)}${data.roster?.length?`<div class="panel"><span class="block-label">${data.roster.length} roster entries · select any player</span><div class="list-rows">${data.roster.map(p=>`<div class="person-row"><span class="avatar" style="display:grid;place-items:center">${safeUrl(p.headshot)?`<img class="avatar" alt="" src="${esc(safeUrl(p.headshot))}" loading="lazy" />`:'◉'}</span><div><button class="person-name" data-action="player" data-player="${esc(p.id)}">${esc(p.name)}</button><div class="person-info">${esc(p.position||'Player')} ${p.jersey?'· #'+esc(p.jersey):''}</div></div><span class="push-right muted-sm">↗</span></div>`).join('')}</div></div>`:`<div class="panel"><h3>No roster entries returned</h3><p>This feed didn't supply a usable roster for the selected team.</p></div>`}`;
 if(state.teamTab==='injuries')return `${dataMeta(data)}${data.injuries?.length?`<div class="panel"><span class="block-label">${data.injuries.length} reported entries</span><div class="list-rows">${data.injuries.map(p=>`<div class="person-row"><div style="flex:1"><strong>${esc(p.name)}</strong><div class="person-info">${esc(p.injury||p.detail||'Injury listed')}</div></div><span class="injury-status">${esc(typeof p.status==='object'?(p.status.name||'Listed'):p.status)}</span></div>`).join('')}</div></div>`:`<div class="panel"><h3>No injuries listed by provider</h3><p>This doesn't prove everyone is healthy. Check the official team report before making a decision.</p></div>`}<div class="data-meta">${esc(data.note||'Statuses can change before a game.')}</div>`;
 if(state.teamTab==='news')return `${dataMeta(data)}<div class="panel"><span class="block-label">${data.scope==='team-related'?'Team-related reports':'League news (not necessarily team-specific)'}</span>${data.articles?.length?data.articles.map(a=>`<div class="news-item">${safeUrl(a.url)?`<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.headline)} ↗</a>`:`<strong>${esc(a.headline)}</strong>`}${a.description?`<p>${esc(a.description.slice(0,180))}${a.description.length>180?'…':''}</p>`:''}<div class="person-info">${a.published?esc(formatDay(a.published)):''}</div></div>`).join(''):`<p>No articles returned.</p>`}</div>`;
 if(state.teamTab==='players')return `<div class="panel"><h3>Player details</h3><p>Use the roster tab to open a player card.</p></div>`;
 return `${dataMeta(data)}<div class="panel"><h3>${esc(data.team?.name||state.drawer.team.name)}</h3><p>${esc(data.team?.standing||'Team details and standing are provided by the connected feed when available.')}</p></div>`;
}
function teamDrawer(){const d=state.drawer,t=d.team;return `<div class="drawer-head"><div class="drawer-title">${logo(t,d.league)}<div><div class="eyebrow">${esc(d.league.toUpperCase())} / TEAM REPORT</div><h2>${esc(t.name)}</h2><small>${esc(t.abbr||'')} ${t.record?'· '+esc(t.record):''}</small></div></div><button class="drawer-close" data-action="close" aria-label="Close panel">×</button></div><div class="drawer-tabs" role="tablist" aria-label="Team information">${[['injuries','Injuries'],['roster','Roster'],['news','News'],['profile','Overview']].map(([id,label])=>`<button data-action="teamtab" data-tab="${id}" role="tab" aria-selected="${state.teamTab===id}" class="${state.teamTab===id?'active':''}">${label}</button>`).join('')}</div>${teamContent()}<details class="panel data-panel"><summary>How is this data sourced?</summary><p>Sports data is fetched through an unofficial ESPN website endpoint and may be delayed or unavailable. No injury or article text is presented as verified unless the source was successfully reached. Commercial release requires a licensed, supported provider.</p></details>`;}
function weatherPanel(g){
 const key=SportsWeather.key(g),value=state.weather[key];
 if(g.demo)return `<div class="panel weather-panel"><span class="block-label">GAME-DAY WEATHER</span><strong>Preview only</strong><p>Weather is not attached to example games.</p></div>`;
 if(!value||value.status==='loading')return `<div class="panel weather-panel"><span class="block-label">GAME-DAY WEATHER</span><p>Checking venue conditions…</p></div>`;
 if(value.status==='indoors')return `<div class="panel weather-panel"><span class="block-label">GAME-DAY WEATHER</span><div class="weather-summary">🏟️ <strong>Indoors</strong></div><p>${esc(value.note||'Outdoor conditions are not expected to affect play.')}</p></div>`;
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
 const count=advanced.filter(f=>f.ok).length;
 const rows=advanced.map(f=>`<div class="result-row factor-row"><span>${esc(f.label)}</span><small class="muted">${f.ok?'Sourced · '+esc(f.sampleSize)+' observations':'Awaiting verified data'}</small></div>`).join('');
 return `<details class="panel data-panel"><summary>Matchup factors · ${count}/${advanced.length} sourced</summary>
   <p class="muted-sm factor-intro">${esc(g.league.toUpperCase())} scheme, personnel and coaching factors are tracked individually. Sources and point-in-time samples are required before anything changes a prediction.</p>${rows}
   <p class="muted-sm">The current on-screen estimate uses season records only. No unsourced blitz, coaching, pitcher-hitter or lineup rating is substituted. Advanced coefficients require a passing historical holdout test.</p></details>`;
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
function gameDrawer(){const d=state.drawer,g=d.game;return `<div class="drawer-head"><div class="drawer-title"><span class="team-logo">${esc(SPORTS[g.league].emoji)}</span><div><div class="eyebrow">${esc(g.league.toUpperCase())} / MATCHUP</div><h2>${esc(g.away.abbr||g.away.name)} @ ${esc(g.home.abbr||g.home.name)}</h2><small>${g.demo?'Example matchup':`${formatDay(g.start)} · ${formatTime(g.start)}`}</small></div></div><button class="drawer-close" data-action="close" aria-label="Close panel">×</button></div>${g.demo?`<div class="error-note">UI example only. Do not treat this as a scheduled game.</div>`:''}${modelPanel(g)}${currentSeasonPanel(g)}<div class="panel"><span class="block-label">MATCHUP</span><div class="details-grid"><div>${logo(g.away,g.league)}<div style="margin-top:8px"><strong>${esc(g.away.name)}</strong></div><button class="inline-link" data-action="team" data-game="${esc(g.id)}" data-team="away" style="margin-top:6px">Injuries · Roster · News ↗</button></div><div>${logo(g.home,g.league)}<div style="margin-top:8px"><strong>${esc(g.home.name)}</strong></div><button class="inline-link" data-action="team" data-game="${esc(g.id)}" data-team="home" style="margin-top:6px">Injuries · Roster · News ↗</button></div></div></div><div class="panel"><span class="block-label">GAME DETAILS</span><div class="result-row" style="justify-content:space-between;margin-bottom:12px"><span class="muted">Game status</span><strong>${esc(g.demo?'Example only':g.statusText)}</strong></div><div class="result-row" style="justify-content:space-between;margin-bottom:12px"><span class="muted">Scheduled</span><strong>${esc(g.demo?'Not verified':formatTime(g.start))}</strong></div><div class="result-row" style="justify-content:space-between"><span class="muted">Sportsbook odds</span><strong>See US market quotes below, if connected</strong></div></div>${sportsbookOddsPanel(g)}${pregameStarterPanel(g)}${weatherPanel(g)}${matchupFactorsPanel(g)}<div class="panel"><h3>Build a ticket</h3><p>Copy a sourced moneyline quote above, or enter a price manually.</p><button class="btn" data-action="quickpick" data-game="${esc(g.id)}" style="margin-top:13px">Add to ticket ↗</button></div><details class="panel data-panel"><summary>Model roadmap & limits</summary><p>This first transparent baseline uses season W-L form and assumed home advantage. Weather increases the displayed uncertainty range for outdoor games when a forecast is available. A trained Elo model, injury impact, sport-specific player projections, calibrated confidence, independent historical backtests and verified sportsbook prices still require a production data pipeline. A projected winner does not imply a profitable bet.</p></details>`;}
function playerDrawer(){const {player,league,team}=state.drawer;return `<div class="drawer-head"><div class="drawer-title"><span class="team-logo">${esc(SPORTS[league].emoji)}</span><div><div class="eyebrow">${esc(league.toUpperCase())} / PLAYER</div><h2>${esc(player.name)}</h2><small>${esc(team.name)} · ${esc(player.position||'Player')}${player.jersey?' · #'+esc(player.jersey):''}</small></div></div><button class="drawer-close" data-action="back-team" aria-label="Back to team">←</button></div><div class="panel"><h3>Player profile</h3><p>Full game logs and player prop projections will appear here after the production statistics adapter and prediction engine are connected.</p>${safeUrl(player.profileUrl)?`<p style="margin-top:14px"><a class="inline-link" href="${esc(safeUrl(player.profileUrl))}" target="_blank" rel="noopener noreferrer">View player source ↗</a></p>`:''}</div><div class="form-actions"><button class="btn" data-action="player-prop">+ Build player prop</button></div><button class="neutral-button" data-action="back-team">← Back to ${esc(team.name)}</button>`;}
function feedbackDrawer(){return `<div class="drawer-head"><div class="drawer-title"><span class="team-logo">✦</span><div><div class="eyebrow">BETA FEEDBACK</div><h2>Make it better</h2><small>Short feedback, no sign-in.</small></div></div><button class="drawer-close" data-action="close" aria-label="Close">×</button></div><div class="panel"><label class="feedback-label" for="feedback-kind">What's on your mind?</label><select id="feedback-kind"><option>Something works well</option><option>Something feels confusing</option><option>Bug or broken feature</option><option>Feature suggestion</option></select><label class="feedback-label" for="feedback-note">Your feedback</label><textarea id="feedback-note" rows="5" maxlength="1200" placeholder="What should we improve?"></textarea><div class="form-actions"><button class="btn" data-action="copy-feedback">Copy feedback for Discord</button></div><p class="weather-note">Paste your feedback into the Sports Spreads discussion in Discord. No account details are collected here.</p></div>`;}
function publicShareUrl(){const origin=globalThis.location?.origin;return /^https:\/\/[-a-z0-9.]+\.onrender\.com$/i.test(origin||'')?origin+'/':'https://sports-spreads.onrender.com/';}
