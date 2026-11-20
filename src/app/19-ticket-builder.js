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
 const odds=estimate?americanCombined(estimate.multiplier):'—';
 const payout=estimate?money(estimate.return):'—';
 const details=estimate?`<details class="ticket-math"><summary>Ticket details</summary><div>Market break-even: ${(100/estimate.multiplier).toFixed(1)}%</div><div>Model confidence: ${(()=>{const p=globalThis.SportsAutoTicket?.ticketConfidence?.(state.ticket);return p==null?'Not verified':(p*100).toFixed(1)+'%';})()}</div><small>Bookmaker prices are not validated model confidence. Confirm prices before wagering.</small></details>`:'';
 return `<section class="ticket-ticker ticket-ticker-compact" aria-label="Ticket summary">
  <div class="ticker-label">MY TICKET <span class="ticker-legs">${state.ticket.length} ${state.ticket.length===1?'leg':'legs'}</span></div>
  <div class="ticker-values"><div class="ticker-stat"><span class="ticker-name">Potential payout</span><strong>${esc(payout)}</strong></div><div class="ticker-stat"><span class="ticker-name">Combined odds</span><strong>${esc(odds)}</strong></div></div>
  ${ticketWarnings().length?'<div class="ticker-risk">⚠ Review correlated picks</div>':''}${details}
 </section>`;
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
const MARKETS={nfl:['Moneyline','Spread','Total','Passing yards','Rushing yards','Receiving yards','Touchdowns scored','Other'],nba:['Moneyline','Spread','Total','Player points','Player rebounds','Other'],nhl:['Moneyline','Puck line','Total','Shots on goal','Other'],mlb:['Moneyline','Run line','Total','Pitcher strikeouts','Other']};
const PROPS={nfl:[['Passing yards',0,200,1,'yds'],['Rushing yards',0,200,1,'yds'],['Receiving yards',0,200,1,'yds'],['Touchdowns scored',0,5,1,'TD'],['Player yards',0,200,5,'yds'],['Touchdowns',0,5,1,'TD']],nba:[['Player points',0,60,1,'pts'],['Player rebounds',0,25,1,'reb']],nhl:[['Shots on goal',0,12,1,'shots']],mlb:[['Pitcher strikeouts',0,15,1,'K']]};
function propInfo(league,market){return (PROPS[league]||[]).find(x=>x[0]===market)||null;}
function isNflPlayerMarket(market){
 return ['Passing yards','Rushing yards','Receiving yards','Touchdowns scored'].includes(market);
}
function selectedProp(){
 const chosen=state.lookup.chosen,team=state.lookup.selectedTeam;
 if(chosen?.type!=='player'||!team||chosen.teamId!==team.id||chosen.selection!==document.getElementById('leg-selection').value.trim())return null;
 if(state.lookup.roster.filter(p=>p.name===chosen.selection).length!==1)return null;
 return {player:chosen.selection,team:team.name,market:document.getElementById('leg-market').value,target:Number(document.getElementById('prop-line').value)};
}
function clearPropQuote(manual=false){
 const box=document.getElementById('prop-quotes');
 if(!box)return;
 if(box.applied&&!manual)document.getElementById('leg-odds').value='';
 box.applied=null;box.textContent='';box.revision=(box.revision||0)+1;
}
async function lookupPropQuote(){
 clearPropQuote();
 updateLegPreview();
 const box=document.getElementById('prop-quotes'),pick=selectedProp(),revision=box.revision;
 if(!pick){box.textContent='Choose a player from the team roster first.';return;}
 box.textContent='Checking saved prices…';
 try{
  const snapshot=await SportsOdds.getBoard('nfl');
  if(!box.isConnected||box.revision!==revision)return;
  const offers=SportsOdds.propQuotes(snapshot,pick);
  box.textContent=offers.length?'Use a saved price:':'No recent exact quote. Enter your sportsbook’s odds.';
  for(const quote of offers){
   const btn=document.createElement('button');btn.type='button';
   btn.textContent=quote.bookmaker+' '+(quote.price>0?'+':'')+quote.price+' · '+quote.matchup+' · saved '+new Date(quote.asOf).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',timeZoneName:'short'});
   btn.onclick=()=>{
    if(!SportsOdds.propQuotes(snapshot,pick).some(q=>q.bookmaker===quote.bookmaker&&q.price===quote.price)){clearPropQuote();box.textContent='Quote expired. Check again.';updateLegPreview();return;}
    const label=btn.textContent;
    document.getElementById('leg-odds').value=String(quote.price);
    box.applied=quote;box.textContent=label;updateLegPreview();
   };
   box.append(btn);
  }
 }catch{if(box.isConnected&&box.revision===revision)box.textContent='Quote cache unavailable. Enter odds manually.';}
}
function setPropStep(step){
 const form=document.getElementById('leg-form');
 form.dataset.propStep=step;
 const title=form.querySelector('.prop-step-title');
 const selection=document.getElementById('leg-selection');
 title.textContent=step==='player'?'Choose a player':step==='target'?selection.value+' · Choose a target':'Review your leg';
 const next=form.querySelector('[data-action="prop-next"]');
 next.textContent=step==='player'?'Use typed player':'Continue to odds';
 next.disabled=step==='player'&&selection.value.trim().length<2;
 form.querySelector('[type="submit"]').disabled=step!=='price';
 const odds=document.getElementById('leg-odds');
 odds.required=step==='price';
 const focus=step==='player'?selection:step==='target'?document.getElementById('leg-market'):odds;
 focus.focus();
}
function updateLegPreview(){
 const preview=document.getElementById('leg-preview');
 if(!preview)return;
 const market=document.getElementById('leg-market').value;
 const name=document.getElementById('leg-selection').value.trim()||'Choose a player';
 const odds=parseAmerican(document.getElementById('leg-odds').value.trim());
 const line=propNote(market,Number(document.getElementById('prop-line').value));
 preview.textContent=[name,line,odds===null?'Enter sportsbook odds':(odds>0?'+'+odds:String(odds))].join(' · ');
}
function propNote(market,value){
 if(isNflPlayerMarket(market))return (value===0?'Exactly 0':value+'+')+' '+market.toLowerCase();
 return market==='Touchdowns'?(value===0?'0 TD (no meaningful threshold)':`At least ${value} TD`):`Over ${value+0.5} ${({'Player yards':'yards','Player points':'points','Player rebounds':'rebounds','Shots on goal':'shots','Pitcher strikeouts':'strikeouts'})[market]||''}`;}
function propFields(league,market){const info=propInfo(league,market);if(!info)return '<div id="prop-controls"></div>';
 if(isNflPlayerMarket(market)){
  const target=market==='Touchdowns scored'?1:50;
  return `<div class="prop-control" id="prop-controls"><label for="prop-line">Target <output id="prop-line-value">${esc(propNote(market,target))}</output></label><input type="range" id="prop-line" data-market="${esc(market)}" min="0" max="${info[2]}" value="${target}" step="1"><output id="leg-preview" aria-live="polite">Choose a player · ${esc(propNote(market,target))} · Enter sportsbook odds</output><button type="button" data-action="check-prop-quote">Check saved prices</button><div id="prop-quotes" aria-live="polite"></div></div>`;
 }
 return `<div class="prop-control" id="prop-controls"><label for="prop-line">Line target <output id="prop-line-value">${esc(propNote(market,market==='Touchdowns'?1:Math.min(info[2],market==='Player yards'?50:10)))}</output></label><input type="range" id="prop-line" data-market="${esc(market)}" min="${info[1]}" max="${info[2]}" value="${market==='Touchdowns'?1:Math.min(info[2],info[0]==='Player yards'?50:10)}" step="${info[3]}"><small class="muted">Line selector only · No live pricing or probability</small></div>`;}
function autoTicketPanel(){
 const target=state.autoTicket.target;
 return `<section class="auto-ticket-card" aria-label="Confidence target ticket generator">
 <div class="auto-ticket-top"><div><h3>Quick pick</h3></div><div class="auto-target-badge" aria-label="Market-implied probability target, not model confidence"><strong id="auto-target">${target}%</strong></div></div>
 <label class="auto-slider-label" for="auto-confidence">Bookmaker-implied chance <span class="muted-sm">per leg</span></label>
 <input type="range" id="auto-confidence" min="50" max="95" step="5" value="${target}" style="--slider-progress:${((target-50)/45*100).toFixed(1)}%" aria-describedby="auto-helper"/>
 <div class="auto-ticket-bottom"><p id="auto-helper">Based on saved odds.</p><button class="btn auto-build" type="button" data-action="generate-ticket">Generate ticket</button></div>
 ${state.autoTicket.status?`<p class="auto-ticket-status" role="status">${esc(state.autoTicket.status)}</p>`:''}
 <details class="auto-ticket-why"><summary>How it works</summary><p>Uses the average bookmaker-implied chance after removing the margin, then selects up to two different games above your threshold. No calibrated model confidence or betting edge is claimed; quotes may change.</p></details>
 </section>`;
}
function ticketModeTabs(){
 const active=state.ticketMode==='automatic'?'automatic':'manual';
 return '<div class="ticket-tabs" role="tablist" aria-label="Ticket mode">'+
  ['automatic','manual'].map(mode=>'<button type="button" role="tab" data-action="ticket-mode" data-mode="'+mode+'" aria-selected="'+(active===mode)+'" class="'+(active===mode?'active':'')+'">'+
   (mode==='automatic'?'Suggested tickets':'Build my own')+'</button>').join('')+'</div>';
}
// Compact pregame research board: never invent player props, joint confidence or an edge.
function pregameGameTickets(){
 const games=(state.feed?.games||[]).filter(g=>!g.demo&&g.status==='scheduled'&&Date.parse(g.start)>Date.now());
 if(!games.length)return '<section class="daily-suggestions"><h3>Game tickets</h3><p class="muted-sm">No upcoming games on this selected date.</p></section>';
 const odds=state.odds[state.league];
 const serverGames=(state.daily?.pregame?.games||[]).filter(g=>g.league===state.league);
 const cards=games.map(g=>{
  const until=Math.ceil((Date.parse(g.start)-Date.now())/60000);
  const eligible=until<=60&&until>0;
  const market=odds&&['ok','cached'].includes(odds.status)?SportsOdds.marketConsensus(g,odds):null;
  const sides=market?['home','away'].map(side=>{
   const quote=side==='home'?market.bestHome:market.bestAway;
   const probability=side==='home'?market.homeProbability:market.awayProbability;
   return quote&&Number.isFinite(probability)?{side,quote,probability}:null;
  }).filter(Boolean):[];
  sides.sort((a,b)=>b.probability-a.probability);
  const best=sides[0];
  const quoteAge=best?Date.now()-Date.parse(best.quote.asOf||''):NaN;
  const fresh=Number.isFinite(quoteAge)&&quoteAge>=0&&quoteAge<=8*3600000;
  // Market favorite alone cannot establish positive expected value or an optimal wager.
  const server=serverGames.find(x=>x.gameId===String(g.id));
  const status=!eligible?'T−60m pending':server?.status==='READY'?'MODEL RESULT PENDING REVIEW':!best||!fresh?'PASS · no verified line':'PASS · no validated edge';
  const favorite=eligible&&best&&fresh?'<div class="daily-card-sub">Market favorite: '+esc(g[best.side].name)+' · '+Math.round(best.probability*100)+'% implied*</div>':'';
  return '<article class="daily-ticket-card"><div class="daily-card-title"><strong>'+esc(g.away.name)+' @ '+esc(g.home.name)+'</strong><span>'+ (until<=90?until+'m to start':'Upcoming')+'</span></div><div class="daily-picks"><strong>'+status+'</strong></div>'+favorite+'<div class="daily-card-sub">'+(server?'Server checked · ':'')+'Team + player SGP: no verified prop prices or joint model</div></article>';
 }).join('');
 return '<section class="daily-suggestions" aria-label="Per-game pregame tickets"><div class="daily-section-head"><h3>Every game</h3><small>Automatic · research only</small></div><div class="daily-ticket-grid">'+cards+'</div><details class="daily-disclaimer"><summary>Why PASS?</summary><p>* Market favorite probability is not an edge or validated model confidence. An optimal parlay needs independently calibrated probabilities, current player prices and a correlation-aware joint model. Unavailable data means PASS.</p></details></section>';
}
function dailySuggestionsPanel(){
 const d=state.daily||{},stamp=d.generatedAt?formatFresh(d.generatedAt):'Not generated';
 const snapshotTime=Date.parse(d.generatedAt||'');
 const snapshotFresh=Number.isFinite(snapshotTime)&&snapshotTime<=Date.now()+60_000&&snapshotTime>Date.now()-24*3600_000;
 let contents;
 if(d.loading&&!d.loaded)contents='<div class="daily-empty">Loading tickets…</div>';
 else if(d.error)contents='<div class="daily-empty">Suggestions unavailable. Try Build my own.</div>';
 else if(d.loaded&&d.cards?.length&&!snapshotFresh)contents='<div class="daily-empty">Quotes expired. Waiting for the next refresh.</div>';
 else if(!d.loaded||!d.cards?.length)contents='<article class="daily-ticket-card big-one big-one-hero"><div class="daily-card-title"><strong>✦ THE BIG ONE</strong></div><p class="muted-sm">Waiting for eligible games and fresh odds.</p></article>';
 else contents='<div class="daily-ticket-grid">'+[...d.cards].sort((a,b)=>(a.id==='big-one'?-1:0)-(b.id==='big-one'?-1:0)).map(c=>{
  if(!c.available)return '<article class="daily-ticket-card '+(c.id==='big-one'?'big-one big-one-hero':'')+'"><div class="daily-card-title"><strong>'+esc(c.name)+'</strong><span>NO SLATE</span></div><p class="muted-sm">'+esc(c.reason||'Insufficient verified games')+'</p></article>';
  const legs=Array.isArray(c.legs)?c.legs:[];
  const valid=legs.length>=2&&legs.length===Number(c.legCount)&&
   legs.every(l=>Number.isFinite(Date.parse(l.oddsAsOf))&&Date.parse(l.oddsAsOf)<=Date.now()&&Date.parse(l.oddsAsOf)>Date.now()-8*3600_000&&Date.parse(l.start)>Date.now()+5*60_000&&l.gameId&&l.selection&&l.bookmaker)&&
   new Set(legs.map(l=>String(l.gameId))).size===legs.length&&
   new Set(legs.map(l=>String(l.bookmaker).toLowerCase())).size===1&&
   (!d.generatedAt||(Number.isFinite(Date.parse(d.generatedAt))&&Date.parse(d.generatedAt)>Date.now()-24*3600_000));

  if(!valid)return '<article class="daily-ticket-card '+(c.id==='big-one'?'big-one big-one-hero':'')+'"><div class="daily-card-title"><strong>'+esc(c.id==='big-one'?'THE BIG ONE':c.name)+'</strong><span>PRICES EXPIRED</span></div><p class="muted-sm">Waiting for updated odds or game times.</p></article>';
  const canLoad=valid&&!state.ticket.length;
  const label=!valid?'Recheck prices / slate':state.ticket.length?'Clear ticket first':'Use ticket';
  return '<article class="daily-ticket-card '+(c.id==='big-one'?'big-one big-one-hero':'')+'">'+
   '<div class="daily-card-title"><strong>'+(c.id==='big-one'?'✦ THE BIG ONE':esc(c.name))+'</strong><span>MARKET GRADE '+esc(c.marketGrade||'—')+'</span></div>'+
   '<div class="daily-card-sub">'+esc(c.bookmaker)+' · '+esc(c.legCount)+' games</div>'+
   '<details><summary>Market estimates</summary><div class="daily-card-metrics"><div><strong>'+Math.round(100*(c.marketProbabilityProduct||0))+'%*</strong><small>Independence illustration · Market-derived, not calibrated</small></div>'+
   '<div><strong>'+Number(c.payoutMultiplier||0).toFixed(2)+'×</strong><small>Payout multiplier</small></div></div></details>'+
   '<div class="daily-price">Estimated $10 return <strong>'+money(c.returnAt10)+'</strong></div>'+
   '<div class="daily-picks">'+(c.legs||[]).map(l=>'<span>'+esc(l.selection)+' <b>'+(Number(l.odds)>0?'+':'')+esc(l.odds)+'</b></span>').join('')+'</div>'+
   '<button type="button" class="neutral-button daily-load" data-action="daily-ticket-load" data-id="'+esc(c.id)+'" '+(!canLoad?'disabled':'')+'>'+esc(label)+'</button></article>';
 }).join('')+'</div>';
 return '<section class="daily-suggestions" aria-label="Daily suggested automatic tickets">'+
 '<div class="daily-section-head"><div><h3>Today’s tickets</h3></div><small>'+(d.generatedAt?'Updated '+esc(stamp):'')+'</small></div>'+contents+
 '<details class="daily-disclaimer"><summary>About these estimates</summary><p>* Percentages assume independent games and are not validated wagering confidence. Grades reflect bookmaker-implied probabilities. Confirm all odds before wagering.</p></details>'+
 '</section>';
}
function ticketView(){
 const estimate=calcTicket();
 const draft=state.draft||{};
 const hasLegs=state.ticket.length>0;
 const automatic=state.ticketMode==='automatic';
 const header=ticketModeTabs()+(hasLegs?ticketTicker(estimate):'');
 const suggestions=automatic?dailySuggestionsPanel()+autoTicketPanel()+'<details class="ux-secondary-matchups"><summary>Game research</summary>'+pregameGameTickets()+'</details>':'';
 if(automatic&&!hasLegs)return header+suggestions;

 const form=automatic?'':`<div class="form-card"><h3>Add selection</h3><button type="button" data-action="nfl-player-prop">NFL player prop</button><form id="leg-form"><div class="prop-guide"><button type="button" data-action="prop-back">Back</button><strong class="prop-step-title" aria-live="polite"></strong></div><div class="form-grid"><div class="form-item"><label for="leg-league">Sport</label><select id="leg-league">${Object.entries(SPORTS).map(([id,s])=>`<option value="${id}" ${id===(draft.league||state.league)?'selected':''}>${s.label}</option>`).join('')}</select></div><div class="form-item"><label for="leg-market">Market</label><select id="leg-market">${(MARKETS[draft.league||state.league]||MARKETS.nba).map(m=>`<option ${m===(draft.market||'Moneyline')?'selected':''}>${m}</option>`).join('')}</select></div>${propFields(draft.league||state.league,draft.market||'Moneyline')}<div class="form-item wide"><label for="leg-selection">Team or player</label><input type="text" id="leg-selection" required maxlength="95" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="selection-suggestions" placeholder="Search by name" value="${esc(draft.selection||'')}"><div id="selection-suggestions" role="listbox" aria-label="Matching teams and players" class="suggest-menu" hidden></div><p id="suggestion-hint" class="muted-sm">Type 3 letters to find a team or player.</p></div><div class="form-item"><label for="leg-odds">American odds</label><input type="text" id="leg-odds" required placeholder="e.g. -110 or +135" pattern="(?:\\+|-)?[0-9]+" value="${esc(draft.odds??'')}" /></div><div class="form-item"><label for="leg-notes">Line / notes</label><input type="text" id="leg-notes" maxlength="85" placeholder="e.g. Over 25.5 points" /></div></div><div class="form-actions"><button type="button" class="btn" data-action="prop-next">Continue</button><button type="submit" class="btn">+ Add leg</button></div><div id="form-error" class="notice" role="alert"></div></form></div>`;
 const review=hasLegs?`<div class="form-card"><h3>My ticket <span class="muted">(${state.ticket.length})</span></h3><p>Saved on this device.</p><div class="ticket-items">${state.ticket.map((t,i)=>`<div class="ticket-item"><div class="ticket-head"><strong>${esc(t.selection)}</strong><button data-action="remove-leg" data-index="${i}" title="Remove leg" aria-label="Remove ${esc(t.selection)}">×</button></div><small>${esc(t.league.toUpperCase())} / ${esc(t.market)} ${t.notes?'· '+esc(t.notes):''}</small><small>${t.bookmaker?esc(t.bookmaker)+' quote · ':'Entered odds · '}${Number(t.odds)>0?'+':''}${esc(t.odds)}</small></div>`).join('')}</div>${ticketWarnings().length?`<div class="correlation-warning" role="status"><strong>⚠ Review this combination</strong><ul>${ticketWarnings().map(w=>`<li>${esc(w.message)}</li>`).join('')}</ul><small>Advisory only; no correlation-adjusted confidence is calculated.</small></div>`:''}<div class="ticket-totals"><div class="result-row"><span class="muted">Stake</span><input type="number" id="stake" min="0.01" max="1000000" step="0.01" value="${esc(state.stake)}" style="width:100px;text-align:right"></div><div class="result-row"><span class="muted">Decimal multiplier</span><strong>${estimate?estimate.multiplier.toFixed(2)+'×':'—'}</strong></div><div class="result-row"><span class="muted">Potential return</span><strong class="accent">${estimate?money(estimate.return):'—'}</strong></div><div class="result-row"><span class="muted">Potential profit</span><strong>${estimate?money(estimate.profit):'—'}</strong></div></div><div class="footlinks"><button class="btn small-btn" data-action="archive-ticket">Save snapshot</button>${state.cloud.configured&&state.cloud.token?`<button data-action="cloud-save">Save to cloud</button>`:``}<button data-action="export-ticket">Export JSON</button><button data-action="clear-ticket">Clear ticket</button></div><p class="notice">Estimated payout. Confirm at your sportsbook.</p></div>`:'';
 return header+suggestions+`<div class="ticket-layout ${automatic?'auto-only':''}">${form}${review}</div>`;
}
