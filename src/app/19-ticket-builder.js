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
   '<div class="daily-card-metrics"><div><strong>'+Math.round(100*(c.marketProbabilityProduct||0))+'%*</strong><small>Independence illustration</small></div>'+
   '<div><strong>'+Number(c.payoutMultiplier||0).toFixed(2)+'×</strong><small>Potential multiplier</small></div></div>'+
   '<div class="daily-price">Per $10: possible return <strong>'+money(c.returnAt10)+'</strong></div>'+
   '<div class="daily-picks">'+(c.legs||[]).map(l=>'<span>'+esc(l.selection)+' <b>'+(Number(l.odds)>0?'+':'')+esc(l.odds)+'</b></span>').join('')+'</div>'+
   '<button type="button" class="neutral-button daily-load" data-action="daily-ticket-load" data-id="'+esc(c.id)+'" '+(!canLoad?'disabled':'')+'>'+esc(label)+'</button></article>';
 }).join('')+'</div>';
 return '<section class="daily-suggestions" aria-label="Daily suggested automatic tickets">'+
 '<div class="daily-section-head"><div><div class="block-label">ONCE DAILY · SAME-BOOK PRICES</div><h3>Suggested tickets</h3></div><small>Updated '+esc(stamp)+'</small></div>'+contents+
 '<p class="daily-disclaimer">* Ticket percentage assumes independent games and is not validated wagering confidence. Grades reflect bookmaker-implied probability only. Combined chances assume independent games and have not been calibrated as parlays. No guaranteed profit. Confirm every quote before wagering.</p>'+
 '</section>';
}
function ticketView(){const estimate=calcTicket();const draft=state.draft||{};return `<div class="section-top section-header"><div><h2>Ticket builder</h2><p>Your selections. Your sportsbook prices.</p></div></div>${ticketTicker(estimate)}${ticketModeTabs()}${state.ticketMode==='automatic'?autoTicketPanel()+dailySuggestionsPanel():''}<div class="ticket-layout ${state.ticketMode==='automatic'?'auto-only':''}"><div class="form-card"><h3>Add selection</h3><p>Enter odds from your sportsbook.</p><form id="leg-form"><div class="form-grid"><div class="form-item"><label for="leg-league">Sport</label><select id="leg-league">${Object.entries(SPORTS).map(([id,s])=>`<option value="${id}" ${id===(draft.league||state.league)?'selected':''}>${s.label}</option>`).join('')}</select></div><div class="form-item"><label for="leg-market">Market</label><select id="leg-market">${(MARKETS[draft.league||state.league]||MARKETS.nba).map(m=>`<option ${m===(draft.market||'Moneyline')?'selected':''}>${m}</option>`).join('')}</select></div>${propFields(draft.league||state.league,draft.market||'Moneyline')}<div class="form-item wide"><label for="leg-selection">Team or player · selection</label><input type="text" id="leg-selection" required maxlength="95" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="selection-suggestions" placeholder="Type 3+ letters for teams or players" value="${esc(draft.selection||'')}"><div id="selection-suggestions" role="listbox" aria-label="Matching teams and players" class="suggest-menu" hidden></div><p id="suggestion-hint" class="muted-sm">Type 3 letters to find a team. Select a team to search its roster.</p></div><div class="form-item"><label for="leg-odds">American odds</label><input type="text" id="leg-odds" required placeholder="e.g. -110 or +135" pattern="[+-]?[0-9]+" value="${esc(draft.odds??'')}" /></div><div class="form-item"><label for="leg-notes">Line / notes</label><input type="text" id="leg-notes" maxlength="85" placeholder="e.g. Over 25.5 points" /></div></div><div class="form-actions"><button type="submit" class="btn">+ Add leg</button></div><div id="form-error" class="notice" role="alert"></div></form></div><div class="form-card"><h3>My ticket <span class="muted">(${state.ticket.length})</span></h3><p>Saved on this device. No bets placed.</p>${state.ticket.length?`<div class="ticket-items">${state.ticket.map((t,i)=>`<div class="ticket-item"><div class="ticket-head"><strong>${esc(t.selection)}</strong><button data-action="remove-leg" data-index="${i}" title="Remove leg" aria-label="Remove ${esc(t.selection)}">×</button></div><small>${esc(t.league.toUpperCase())} / ${esc(t.market)} ${t.notes?'· '+esc(t.notes):''}</small><small>${t.bookmaker?esc(t.bookmaker)+' quote · ':'Entered odds · '}${Number(t.odds)>0?'+':''}${esc(t.odds)}</small></div>`).join('')}</div>${ticketWarnings().length?`<div class="correlation-warning" role="status"><strong>⚠ Review this combination</strong><ul>${ticketWarnings().map(w=>`<li>${esc(w.message)}</li>`).join('')}</ul><small>Advisory only; no correlation-adjusted confidence is calculated.</small></div>`:''}<div class="ticket-totals"><div class="result-row"><span class="muted">Stake</span><input type="number" id="stake" min="0.01" max="1000000" step="0.01" value="${esc(state.stake)}" style="width:100px;text-align:right"></div><div class="result-row"><span class="muted">Decimal multiplier</span><strong>${estimate?estimate.multiplier.toFixed(2)+'×':'—'}</strong></div><div class="result-row"><span class="muted">Potential return</span><strong class="accent">${estimate?money(estimate.return):'—'}</strong></div><div class="result-row"><span class="muted">Potential profit</span><strong>${estimate?money(estimate.profit):'—'}</strong></div></div><div class="footlinks"><button class="btn small-btn" data-action="archive-ticket">Save snapshot</button>${state.cloud.configured&&state.cloud.token?`<button data-action="cloud-save">Save to cloud</button>`:``}<button data-action="export-ticket">Export JSON</button><button data-action="clear-ticket">Clear ticket</button></div>`:`<div class="empty" style="padding:24px"><h3>Nothing added yet</h3><p>Add a leg to get started.</p></div>`}<p class="notice">Illustrative payout; your sportsbook may restrict combinations or change prices.</p></div></div>`;}
