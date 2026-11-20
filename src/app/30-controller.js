async function copyText(value){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}}catch{}try{const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const worked=document.execCommand('copy');field.remove();return worked;}catch{return false;}}
function overlay(){if(!state.drawer)return'';return `<div class="shade" data-action="close" aria-hidden="true"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Details panel">${state.drawer.type==='team'?teamDrawer():state.drawer.type==='player'?playerDrawer():state.drawer.type==='feedback'?feedbackDrawer():gameDrawer()}</aside>`;}
function ticketDock(){
 if(state.section==='tickets'||state.drawer)return '';
 const est=calcTicket();return `<button class="ticket-dock" data-action="nav" data-section="tickets" aria-label="Open parlay builder with ${state.ticket.length} legs"><span class="dock-label"><span class="dock-dot">●</span> MY TICKET <span class="dock-count">${state.ticket.length} legs</span></span><strong>${est?americanCombined(est.multiplier):'Build ticket'} <span aria-hidden="true">↗</span></strong></button>`;
}
function render(){
 const next=state.bigScreen?bigScreenBoard()+overlay():`<div class="layout">${navigation()}<main class="site">${topbar()}${state.section==='games'?board():state.section==='teams'?directoryView():state.section==='tickets'?ticketView():state.section==='history'?historyView():aboutView()}</main></div>${ticketDock()}${overlay()}`;
 // Avoid destroying DOM nodes, input focus and scroll position for unchanged views.
 if(app.__lastMarkup!==next){app.innerHTML=next;app.__lastMarkup=next;}
 document.body.classList?.toggle?.('big-screen-mode',Boolean(state.bigScreen));
 document.body.style.overflow=state.drawer?'hidden':'';
}
function changeBigScreen(){
 if(state.bigScreen){
  state.bigScreen=false;state.section=state.bigScreenReturnSection||'games';
  try{const u=new URL(window.location.href);if(u.searchParams.get('display')==='tv'){u.searchParams.delete('display');window.history?.replaceState?.(null,'',u.pathname+u.search+u.hash);}}catch{}
  try{localStorage.setItem('ss-big-screen','0');}catch{}
  if(document.fullscreenElement&&document.exitFullscreen)void document.exitFullscreen().catch(()=>{});
 }else{
  state.bigScreenReturnSection=state.section;state.section='games';state.search='';state.bigScreen=true;
  try{localStorage.setItem('ss-big-screen','1');}catch{}
  if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
  if(!state.feed||state.feed.league!==state.league)void loadBoard();
 }
 render();
}

function notify(s){document.getElementById('announcer').textContent=s;}
async function loadDailySuggestions(force=false){
 const d=state.daily;if(!d||d.loading||(d.loaded&&!force))return;
 d.loading=true;d.error='';render();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const res=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/daily-tickets',
   {headers:{accept:'application/json'},signal:controller.signal});
  if(!res.ok)throw Error('Daily suggestions unavailable');
  const json=await res.json();
  if(!json||!Array.isArray(json.cards))throw Error('Invalid daily suggestion snapshot');
  d.cards=json.cards.filter(card=>!card.legs?.some(leg=>leg.league==='nhl'));d.pregame=json.pregame&&Array.isArray(json.pregame.games)?{...json.pregame,games:json.pregame.games.filter(game=>game.league!=='nhl')}:null;d.generatedAt=json.generatedAt||'';
  d.status=json.status||'pending';d.loaded=true;
 }catch(e){d.error=e?.message||'Daily suggestions unavailable';d.cards=[];}
 finally{
  clearTimeout(timer);d.loading=false;
  // Read shared cache only. No upstream odds credits or per-visitor refresh.
  if(!state.odds[state.league]||Date.now()-Date.parse(state.odds[state.league].asOf||'')>5*60*1000)try{state.odds[state.league]=await SportsOdds.getBoard(state.league);}catch{}
  render();
 }
}
function loadSuggestedTicket(id){
 const card=state.daily?.cards?.find(c=>c.id===id&&c.available===true);
 if(!card||!Array.isArray(card.legs)||!card.legs.length)return;
 if(state.ticket.length){state.autoTicket.status='Clear your current ticket before loading a suggested slate.';render();return;}
 const now=Date.now(),book=card.bookmakerKey,teams=new Set(),games=new Set();
 if(!card.legs.every(l=>l.bookmakerKey===book&&l.market==='Moneyline'&&
  Object.hasOwn(SPORTS,l.league)&&Number.isInteger(l.odds)&&
  Math.abs(l.odds)>=100&&Date.parse(l.start)>now&&
  Number.isFinite(Date.parse(l.oddsAsOf))&&now-Date.parse(l.oddsAsOf)<=8*3600_000&&
  !games.has(l.gameId)&&(games.add(l.gameId),true))) {
  state.autoTicket.status='This suggestion has expired or has unsupported prices.';render();return;
 }
 state.ticket=card.legs.map((l,i)=>({id:'daily-'+id+'-'+i+'-'+Date.now(),league:l.league,market:'Moneyline',
  selection:l.selection+' to win',odds:l.odds,gameId:l.gameId,bookmaker:l.bookmaker,
  oddsAsOf:l.oddsAsOf,modelValidated:false,marketImpliedProbability:l.marketProbability,
  notes:'Market-derived '+card.name+' · assumed independent games · verify prices',
  enteredAt:new Date().toISOString()}));
 saveTicket();
 state.autoTicket.status=card.name+' loaded from one sportsbook. The grade is market-implied, not validated parlay confidence.';
 render();notify('Suggested ticket added locally. No bet placed.');
}
function openTeam(game,side){if(!game)return;const team=game[side];if(!team?.id){notify('This team has no provider identifier.');return;}state.drawer={type:'team',league:game.league,team};state.teamTab='injuries';render();loadTeam('injuries');}
function openDirectoryTeam(id){const team=state.directory[state.league]?.teams?.find(t=>t.id===id);if(team){state.drawer={type:'team',league:state.league,team};state.teamTab='injuries';render();loadTeam('injuries');}}
function getRosterPlayer(id){const key=`${state.drawer.league}-${state.drawer.team.id}-roster`;return state.teamCache[key]?.roster?.find(p=>p.id===id);}
function saveTicket(){try{localStorage.setItem('ss-v2-ticket',JSON.stringify(state.ticket));}catch{notify('Browser storage is not available.');}}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;if(action==='retry-nfl-availability'){void loadNflAvailability(true);return;}if(action==='retry-nfl-coaching'){void loadNflCoaching(getGame(el.dataset.game),true);return;}if(action==='load-market-history'){void loadMarketHistory(getGame(el.dataset.game),true);return;}if(action==='generate-ticket'){await generateAutomaticTicket();return;}if(action==='ticket-mode'){state.ticketMode=el.dataset.mode==='manual'?'manual':'automatic';render();if(state.ticketMode==='automatic')void loadDailySuggestions();return;}if(action==='daily-ticket-load'){loadSuggestedTicket(el.dataset.id);return;}if(action==='autocomplete-select'){await acceptLookup(Number(el.dataset.index));return;}if(action==='big-screen'){changeBigScreen();return;}if(action==='share'){const ok=await copyText(publicShareUrl());notify(ok?'Clean website link copied — paste it in Discord.':'Copy this link: '+publicShareUrl());return;}else if(action==='feedback'){state.drawer={type:'feedback'};render();return;}else if(action==='submit-feedback'){
 const type=document.getElementById('feedback-kind')?.value||'';
 const note=(document.getElementById('feedback-note')?.value||'').trim();
 const website=document.getElementById('feedback-website')?.value||'';
 if(note.length<3){notify('Please enter at least 3 characters.');return;}
 if(note.length>1200){notify('Feedback must be 1200 characters or less.');return;}
 const button=el;button.disabled=true;button.textContent='Sending…';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let res;
  try{res=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/submit-feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:type,message:note,website}),signal:controller.signal});}
  finally{clearTimeout(timer);}
  if(!res.ok){const data=await res.json().catch(()=>({}));throw Error(data.error||'Could not submit feedback');}
  state.drawer=null;render();notify('Feedback submitted. Thank you!');
 }catch(e){notify(e?.message||'Feedback could not be submitted. Please try again.');button.disabled=false;button.textContent='Submit feedback';}
 return;
 }else if(action==='nav'){state.section=el.dataset.section;state.drawer=null;state.draft=null;render();if(state.section==='teams')loadTeams();if(state.section==='tickets'){void loadDailySuggestions();void refreshPregameDashboard();}window.scrollTo({top:0,behavior:'instant'});}else if(action==='league'){state.league=el.dataset.league;state.search='';state.drawer=null;if(state.section==='teams')loadTeams();else loadBoard();}else if(action==='reload-teams'){loadTeams(true);}else if(action==='directory-team'){openDirectoryTeam(el.dataset.teamId);}else if(action==='refresh'){loadBoard();}else if(action==='close'){state.drawer=null;render();}else if(action==='team'){openTeam(getGame(el.dataset.game),el.dataset.team);}else if(action==='game'){const game=getGame(el.dataset.game);if(game){state.drawer={type:'game',game};render();void loadGameWeather(game);void loadSportsbookOdds(game);void loadCurrentSeasonForm(game.league);if(game.league==='nfl'){void loadNflAvailability();void loadNflCoaching(game);}}}else if(action==='load-signals'){void loadPregameSignals(getGame(el.dataset.game));}else if(action==='load-odds'){void loadSportsbookOdds(getGame(el.dataset.game));}else if(action==='odds-pick'){useSportsbookQuote(getGame(el.dataset.game),el.dataset.side,el.dataset.index);}else if(action==='weather-retry'){const game=getGame(el.dataset.game);if(game)void loadGameWeather(game,true);}else if(action==='teamtab'){state.teamTab=el.dataset.tab;loadTeam(state.teamTab);}else if(action==='retry-team'){loadTeam(state.teamTab,true);}else if(action==='player'){const player=getRosterPlayer(el.dataset.player);if(player){const team=state.drawer.team;state.drawer={type:'player',player,league:state.drawer.league,team};render();}}else if(action==='player-prop'){const d=state.drawer;if(d?.type==='player'){state.draft={league:d.league,selection:d.player.name,playerId:d.player.id,teamId:d.team.id,market:(PROPS[d.league]||[])[0]?.[0]||'Other'};state.league=d.league;state.section='tickets';state.ticketMode='manual';state.drawer=null;render();window.scrollTo(0,0);}}else if(action==='back-team'){state.drawer={type:'team',league:state.drawer.league,team:state.drawer.team};state.teamTab='roster';render();}else if(action==='quickpick'){const game=getGame(el.dataset.game);state.draft={league:game.league,selection:`${game.away.name} to win`,gameId:game.demo?null:game.id};state.section='tickets';state.ticketMode='manual';state.drawer=null;render();window.scrollTo(0,0);}else if(action==='remove-leg'){state.ticket.splice(Number(el.dataset.index),1);saveTicket();render();}else if(action==='clear-ticket'){state.ticket=[];saveTicket();render();}else if(action==='archive-ticket'){archiveTicket();}else if(action==='cloud-save'){await saveCloudTicket();}else if(action==='cloud-fetch'){await fetchCloudTickets();}else if(action==='cloud-signout'){await SportsCloud.signOut();state.cloud.token='';state.cloud.tickets=[];state.cloud.status='Signed out.';render();}else if(action==='restore-archive'){const snap=state.history[Number(el.dataset.index)];if(snap){state.ticket=JSON.parse(JSON.stringify(snap.legs));state.stake=String(snap.stake);state.section='tickets';saveTicket();render();notify('Loaded a copy. The saved snapshot is unchanged.');}}else if(action==='export-ticket'){exportTicket();}else if(action==='about'){state.section='about';render();}});
document.addEventListener('change',e=>{if(e.target.id==='date'){state.date=e.target.value||getTodayET();state.search='';loadBoard();}else if(e.target.id==='stake'){state.stake=e.target.value;render();}else if(e.target.id==='leg-market'||e.target.id==='leg-league'){const league=document.getElementById('leg-league').value;const marketSelect=document.getElementById('leg-market');if(e.target.id==='leg-league'){marketSelect.innerHTML=(MARKETS[league]||[]).map(m=>`<option>${esc(m)}</option>`).join('');}const market=marketSelect.value;state.lookup.chosen=null;if(e.target.id==='leg-league'){state.lookup.selectedTeam=null;state.lookup.roster=[];state.lookup.request++;state.lookup.league=league;state.lookup.query='';}drawLookup();document.getElementById('prop-controls')?.remove();const box=document.createElement('div');box.innerHTML=propFields(league,market);document.getElementById('leg-market').closest('.form-item').insertAdjacentElement('afterend',box.firstElementChild);const form=document.getElementById('leg-form');const control=document.getElementById('prop-line');if(control){const text=propNote(market,Number(control.value));document.getElementById('leg-notes').value=text;}}});
document.addEventListener('input',e=>{if(e.target.id==='auto-confidence'){
 const target=Number(e.target.value);state.autoTicket.target=target;state.autoTicket.status='';
 e.target.style.setProperty('--slider-progress',((target-50)/45*100).toFixed(1)+'%');
 const out=document.getElementById('auto-target'),grade=document.getElementById('auto-grade');
 if(out)out.textContent=target+'%';if(grade)grade.textContent=globalThis.SportsAutoTicket.grade(target);
 return;
 }if(e.target.id==='leg-selection'){lookupTyping(e.target.value);return;}if(e.target.id==='prop-line'){const market=e.target.dataset.market;const text=propNote(market,Number(e.target.value));document.getElementById('prop-line-value').textContent=text;document.getElementById('leg-notes').value=text;}else if(e.target.id==='search'||e.target.id==='team-search'){const inputId=e.target.id;const caret=e.target.selectionStart;state.search=e.target.value;render();const replacement=document.getElementById(inputId);if(replacement){replacement.focus();replacement.setSelectionRange(caret,caret);}}});
document.addEventListener('submit',e=>{if(e.target.id==='cloud-login'){e.preventDefault();sendLogin(document.getElementById('cloud-email').value.trim());return;}if(e.target.id!=='leg-form')return;e.preventDefault();const selection=document.getElementById('leg-selection').value.trim();const odds=document.getElementById('leg-odds').value.trim();const number=parseAmerican(odds);const err=document.getElementById('form-error');if(!selection||number===null){err.textContent='Enter a selection and valid American odds (at least +100 or -100).';return;}if(state.ticket.length>=20){err.textContent='Prototype limit: 20 legs per ticket.';return;}state.ticket.push({id:`leg-${Date.now()}-${state.ticket.length}`,league:document.getElementById('leg-league').value,market:document.getElementById('leg-market').value,selection,odds:number,bookmaker:state.draft?.bookmaker||null,oddsAsOf:state.draft?.oddsAsOf||null,notes:document.getElementById('leg-notes').value.trim()||(document.getElementById('prop-line')?propNote(document.getElementById('leg-market').value,Number(document.getElementById('prop-line').value)):'') ,gameId:state.draft?.gameId||null,playerId:(state.lookup.chosen?.type==='player'&&state.lookup.chosen.selection===selection?state.lookup.chosen.id:null)||state.draft?.playerId||null,teamId:(state.lookup.chosen?.selection===selection?state.lookup.chosen.teamId:null)||state.draft?.teamId||null,enteredAt:new Date().toISOString()});saveTicket();state.draft=null;state.lookup.chosen=null;state.lookup.query='';render();notify('Added selection to your local ticket.');});
document.addEventListener('keydown',e=>{
 if(e.target?.id==='leg-selection'){
  if(e.key==='Escape'){state.lookup.query='';state.lookup.rows=[];drawLookup();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   if(!state.lookup.rows.length)return;e.preventDefault();
   state.lookup.active=(state.lookup.active+(e.key==='ArrowDown'?1:-1)+state.lookup.rows.length)%state.lookup.rows.length;drawLookup();return;
  }
  if(e.key==='Enter'&&state.lookup.rows.length&&state.lookup.active>=0){e.preventDefault();void acceptLookup(state.lookup.active);return;}
 }
 if(e.key==='Escape'&&state.drawer){state.drawer=null;render();return;}if(e.key==='Escape'&&state.bigScreen){changeBigScreen();}
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&state.bigScreen&&document.fullscreenEnabled){state.bigScreen=false;try{localStorage.setItem('ss-big-screen','0');}catch{}render();}});
// Final-hour dashboard refresh uses only the shared cached sportsbook endpoint.
let pregameLastChecked=0;
async function refreshPregameDashboard(){
 if(state.section!=='tickets'||document.hidden||!globalThis.SportsOdds)return;
 const now=Date.now();
 if(now-pregameLastChecked<5*60*1000)return;
 pregameLastChecked=now;
 const games=(state.feed?.games||[]).filter(g=>g.league===state.league&&g.status==='scheduled'&&!g.demo);
 if(!games.some(g=>{const m=(Date.parse(g.start)-now)/60000;return m>0&&m<=65;})){render();return;}
 try{
  const snapshot=await SportsOdds.getBoard(state.league);
  if(['ok','cached'].includes(snapshot?.status))state.odds[state.league]=snapshot;
  // Reload server-side per-game eligibility using the same shared cache.
  await loadDailySuggestions(true);
 }catch(e){state.oddsError[state.league]=e?.message||'Shared odds cache unavailable';}
 if(state.section==='tickets')render();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshPregameDashboard();});
if(typeof window.addEventListener==='function')window.addEventListener('focus',()=>void refreshPregameDashboard());
if(typeof setInterval==='function')setInterval(()=>void refreshPregameDashboard(),60*1000);
function bootSportsSpreads(){
 app=document.getElementById('app');
 if(!app){console.error('Sports Spreads startup failed: #app is missing.');return;}
 try{render();loadBoard();loadCloudConfig();}
 catch(err){console.error('Sports Spreads startup error:',err);app.textContent='Sports Spreads could not start. Please reload the page.';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootSportsSpreads,{once:true});
else bootSportsSpreads();
