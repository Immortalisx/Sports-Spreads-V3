async function copyText(value){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}}catch{}try{const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const worked=document.execCommand('copy');field.remove();return worked;}catch{return false;}}
function overlay(){if(!state.drawer)return'';return `<div class="shade" data-action="close" aria-hidden="true"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Details panel">${state.drawer.type==='team'?teamDrawer():state.drawer.type==='player'?playerDrawer():state.drawer.type==='feedback'?feedbackDrawer():gameDrawer()}</aside>`;}
function ticketDock(){
 if(state.section==='tickets'||state.drawer)return '';
 const est=calcTicket();return `<button class="ticket-dock" data-action="nav" data-section="tickets" aria-label="Open parlay builder with ${state.ticket.length} legs"><span class="dock-label"><span class="dock-dot">●</span> MY TICKET <span class="dock-count">${state.ticket.length} legs</span></span><strong>${est?americanCombined(est.multiplier):'Build ticket'} <span aria-hidden="true">↗</span></strong></button>`;
}
function render(){
 document.body.classList?.toggle?.('big-screen-mode',Boolean(state.bigScreen));
 app.innerHTML=state.bigScreen?bigScreenBoard()+overlay():`<div class="layout">${navigation()}<main class="site">${topbar()}${state.section==='games'?board():state.section==='teams'?directoryView():state.section==='tickets'?ticketView():state.section==='history'?historyView():aboutView()}</main></div>${ticketDock()}${overlay()}`;
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
  d.cards=json.cards;d.generatedAt=json.generatedAt||'';
  d.status=json.status||'pending';d.loaded=true;
 }catch(e){d.error=e?.message||'Daily suggestions unavailable';d.cards=[];}
 finally{clearTimeout(timer);d.loading=false;render();}
}
function loadSuggestedTicket(id){
 const card=state.daily?.cards?.find(c=>c.id===id&&c.available===true);
 if(!card||!Array.isArray(card.legs)||!card.legs.length)return;
 if(state.ticket.length){state.autoTicket.status='Clear your current ticket before loading a suggested slate.';render();return;}
 const now=Date.now(),book=card.bookmakerKey,teams=new Set(),games=new Set();
 if(!card.legs.every(l=>l.bookmakerKey===book&&l.market==='Moneyline'&&
  ['nfl','nba','nhl','mlb'].includes(l.league)&&Number.isInteger(l.odds)&&
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
async function loadBoard(){
 const league=state.league,date=state.date;
 state.loading=true;state.error='';state.feed=null;
 render();
 try{const json=await readSportsData(`/api/scoreboard?league=${league}&date=${date.replaceAll('-','')}`);if(state.league!==league||state.date!==date)return;state.feed=json;state.error='';}
 catch(e){if(state.league!==league||state.date!==date)return;state.error=e.message||'Provider unavailable';state.feed={games:[],demo:true,updatedAt:null};}
 finally{if(state.league===league&&state.date===date){state.loading=false;render();const first=state.feed?.games?.find(g=>!g.demo&&g.status==='scheduled');if(first&&!state.odds[league])void loadSportsbookOdds(first);}}
}
async function loadTeams(force=false){
 const league=state.league;if(state.directory[league]&&!force){render();return;}state.directoryLoading[league]=true;render();
 try{const json=await readSportsData(`/api/teams?league=${league}`);state.directory[league]={...json,demo:false};}
 catch(e){state.directory[league]={teams:[],error:e.message||'Feed unavailable',demo:true};}
 finally{state.directoryLoading[league]=false;render();}
}
function teamCacheKey(d,tab){return `${d.league}-${d.team.id}-${tab}`;}
async function loadTeam(tab,force=false){
 if(state.drawer?.type!=='team')return;const d=state.drawer,key=teamCacheKey(d,tab);
 if(state.teamCache[key]&&!force){render();return;}if(state.teamLoading[key])return;state.teamLoading[key]=true;delete state.teamErrors[key];render();
 try{const json=await readSportsData(`/api/team/${d.league}/${encodeURIComponent(d.team.id)}?view=${tab}&name=${encodeURIComponent(d.team.name)}`);state.teamCache[key]=json;}
 catch(e){state.teamErrors[key]=e.message||'Team feed unavailable';}
 finally{state.teamLoading[key]=false;render();}
}
async function loadPregameSignals(game){
 if(!game||game.league!=='mlb'||game.demo||state.signalsLoading[game.id])return;
 state.signalsLoading[game.id]=true;render();
 try{state.signals[game.id]=await SportsSignals.get(game);}
 catch(e){state.signals[game.id]={status:'unavailable',note:e?.message||'Official signal feed unavailable'};}
 finally{state.signalsLoading[game.id]=false;render();}
}
async function loadSportsbookOdds(game){
 if(!game||game.demo||game.status!=='scheduled'||!globalThis.SportsOdds)return;
 const league=game.league;
 if(state.oddsLoading[league])return;
 if(state.odds[league]&&Date.now()-Date.parse(state.odds[league].asOf||'')<5*60*1000)return;
 state.oddsLoading[league]=true;state.oddsError[league]='';render();
 try{state.odds[league]=await SportsOdds.getBoard(league);}
 catch(e){state.oddsError[league]=e?.message||'Cached sportsbook quotes unavailable';}
 finally{state.oddsLoading[league]=false;render();}
}
function useSportsbookQuote(game,side,index){
 if(!game||game.demo||game.status!=='scheduled')return;
 const snap=state.odds[game.league];
 if(!snap||!['ok','cached'].includes(snap.status)||!Number.isFinite(Date.parse(snap.asOf))||Date.now()-Date.parse(snap.asOf)>8*60*60*1000)return;
 const match=SportsOdds.booksForGame(game,snap),book=match.books[Number(index)];
 if(!match.matched||!Number.isInteger(Number(index))||!book)return;
 const team=game[side],price=side==='home'?book.homePrice:side==='away'?book.awayPrice:null;
 if(!team||!SportsOdds.validPrice(price))return;
 // Copy quoted price to draft; NEVER auto-submit and NEVER claim a wager was placed.
 state.draft={league:game.league,market:'Moneyline',selection:team.name+' to win',odds:String(price),gameId:game.id,bookmaker:book.title,oddsAsOf:book.asOf};
 state.section='tickets';state.drawer=null;render();notify('Cached bookmaker quote copied. Recheck the live price before placing any wager.');
}
function openTeam(game,side){if(!game)return;const team=game[side];if(!team?.id){notify('This team has no provider identifier.');return;}state.drawer={type:'team',league:game.league,team};state.teamTab='injuries';render();loadTeam('injuries');}
function openDirectoryTeam(id){const team=state.directory[state.league]?.teams?.find(t=>t.id===id);if(team){state.drawer={type:'team',league:state.league,team};state.teamTab='injuries';render();loadTeam('injuries');}}
function getRosterPlayer(id){const key=`${state.drawer.league}-${state.drawer.team.id}-roster`;return state.teamCache[key]?.roster?.find(p=>p.id===id);}
function saveTicket(){try{localStorage.setItem('ss-v2-ticket',JSON.stringify(state.ticket));}catch{notify('Browser storage is not available.');}}
async function loadCloudConfig(){
 if(!globalThis.SportsCloud)return;
 const c=SportsCloud.config();state.cloud.configured=c.configured;state.cloud.url=c.url;state.cloud.key=c.key;
 if(!c.configured)return;
 const newLogin=SportsCloud.consumeRedirect();state.cloud.token=SportsCloud.credentials().access;
 if(newLogin)state.cloud.status='Signed in securely for this tab.';
 if(state.cloud.token)await fetchCloudTickets();else render();
}
async function fetchCloudTickets(){
 if(!state.cloud.configured||!SportsCloud.credentials().access)return;
 try{state.cloud.tickets=await SportsCloud.tickets();state.cloud.token=SportsCloud.credentials().access;state.cloud.status=`${state.cloud.tickets.length} cloud snapshots loaded.`;}
 catch(e){state.cloud.status=e.message||'Cloud history unavailable.';}render();
}
async function sendLogin(email){
 try{await SportsCloud.emailLink(email);state.cloud.status='Check your email for the secure sign-in link.';}
 catch(e){state.cloud.status=e.message||'Sign-in failed.';}render();
}
async function saveCloudTicket(){
 const c=state.cloud;if(!c.configured||!SportsCloud.credentials().access)return;
 const estimate=calcTicket();if(!estimate){c.status='Enter valid odds and stake first.';render();return;}
 try{await SportsCloud.saveTicket({label:`Ticket · ${new Date().toLocaleDateString()}`,stake:Number(state.stake),legs:state.ticket});c.status='Saved securely to your account.';await fetchCloudTickets();}
 catch(e){c.status=e.message||'Cloud save failed.';render();}
}
function exportTicket(){const payload={format:'sports-spreads-v2-ticket',exportedAt:new Date().toISOString(),source:'user-entered',disclaimer:'No bet was placed; odds are not verified; model probabilities are not calculated.',legs:state.ticket,stake:state.stake};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sports-spreads-ticket.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Progressive autocomplete: one bounded directory fetch per league, optional
// roster fetch only after selecting a team, no API request per typed letter.
let suggestionTimer=null;
function lookupLeague(){return document.getElementById('leg-league')?.value||state.league;}
function lookupIsProp(){const league=lookupLeague(),market=document.getElementById('leg-market')?.value||'';return Boolean(propInfo(league,market));}
function lookupOptions(){
 const league=lookupLeague();
 const teams=state.directory[league]?.teams||[];
 const players=state.lookup.selectedTeam&&state.lookup.league===league?state.lookup.roster:[];
 return SportsAutocomplete.match(state.lookup.query,teams,players,7);
}
function drawLookup(){
 const box=document.getElementById('selection-suggestions'),input=document.getElementById('leg-selection'),hint=document.getElementById('suggestion-hint');
 if(!box||!input)return;
 const query=SportsAutocomplete.normalize(state.lookup.query);
 const matches=query.length>=3?lookupOptions():[];
 state.lookup.rows=matches;
 box.hidden=!matches.length;
 input.setAttribute('aria-expanded',String(matches.length>0));
 if(hint)hint.textContent=state.lookup.loading?'Checking team roster…':state.lookup.status||(query.length<3?'Start typing 3 letters to see matching teams and players.':state.lookup.selectedTeam?'Search your chosen team’s players or select a different team.':'Choose a team; then player suggestions are available for that roster.');
 box.innerHTML=matches.map((x,i)=>`<button type="button" class="suggest-option ${i===state.lookup.active?'active':''}" role="option" aria-selected="${i===state.lookup.active}" id="suggestion-${i}" data-action="autocomplete-select" data-index="${i}"><span class="suggest-name">${esc(x.name)}</span><span class="suggest-meta">${x.type==='team'?'Team':esc(x.teamName||'Player')} ${esc(x.abbr)}</span></button>`).join('');
 input.setAttribute('aria-activedescendant',matches.length&&state.lookup.active>=0?`suggestion-${state.lookup.active}`:'');
}
async function ensureLookupTeams(league){
 if(state.directory[league]?.teams?.length){drawLookup();return;}
 const request=++state.lookup.request;
 state.lookup.loading=true;state.lookup.status='';drawLookup();
 try{const response=await readSportsData(`/api/teams?league=${league}`);
  if(response.teams?.length)state.directory[league]={...response,demo:false};
  else state.lookup.status='Team list is temporarily unavailable; manual entries still work.';
 }catch{state.lookup.status='Team suggestions unavailable; manual entries still work.';}
 finally{if(state.lookup.request===request&&lookupLeague()===league){state.lookup.loading=false;drawLookup();}}
}
async function ensureLookupRoster(team,league){
 const request=++state.lookup.request,key=`${league}-${team.id}-roster`;
 state.lookup.loading=true;state.lookup.status='';drawLookup();
 try{let json=state.teamCache[key];
  if(!json){json=await readSportsData(`/api/team/${league}/${encodeURIComponent(team.id)}?view=roster`);state.teamCache[key]=json;}
  if(state.lookup.request!==request||state.lookup.selectedTeam?.id!==team.id)return;
  state.lookup.roster=(json.roster||[]).map(p=>({...p,teamId:team.id,teamName:team.name}));
  if(!state.lookup.roster.length)state.lookup.status='Roster unavailable; player name can still be entered manually.';
 }catch{state.lookup.status='Roster temporarily unavailable; enter a player manually.';}
 finally{if(state.lookup.request===request){state.lookup.loading=false;drawLookup();}}
}
async function acceptLookup(index){
 const item=state.lookup.rows[index],input=document.getElementById('leg-selection');if(!item||!input)return;
 const league=lookupLeague();state.lookup.rows=[];state.lookup.active=-1;state.lookup.league=league;
 if(item.type==='team'){
  const team=state.directory[league]?.teams?.find(t=>String(t.id)===item.id);
  if(!team)return;
  state.lookup.selectedTeam=team;state.lookup.roster=[];
  const isProp=lookupIsProp();
  input.value=isProp?'':`${team.name}${document.getElementById('leg-market')?.value==='Moneyline'?' to win':''}`;
  state.lookup.chosen={type:'team',id:team.id,teamId:team.id,selection:input.value};
  state.lookup.query='';drawLookup();
  if(isProp){input.focus();void ensureLookupRoster(team,league);}else state.lookup.status='Team selected. Choose a player prop market to search this roster.';
 }else{
  input.value=item.name;state.lookup.chosen={type:'player',id:item.id,teamId:item.teamId,selection:item.name};
  state.lookup.query='';state.lookup.status=`${item.teamName} player selected.`;drawLookup();input.focus();
 }
}
function lookupTyping(value){
 state.lookup.query=value;state.lookup.chosen=null;state.lookup.active=-1;state.lookup.league=lookupLeague();
 clearTimeout(suggestionTimer);drawLookup();
 if(SportsAutocomplete.normalize(value).length<3)return;
 suggestionTimer=setTimeout(()=>void ensureLookupTeams(lookupLeague()),160);
}
async function generateAutomaticTicket(){
 if(state.ticket.length){state.autoTicket.status='Clear your current ticket to generate new selections.';render();return;}
 const games=(state.feed?.games||[]).filter(g=>!g.demo&&g.status==='scheduled'&&Date.parse(g.start)>Date.now());
 if(!games.length){state.autoTicket.status='No upcoming games on this date. Select a game day with scheduled matchups.';render();return;}
 state.autoTicket.status='Checking shared sportsbook snapshots…';render();
 let odds=state.odds[state.league];
 try{
  if(!odds||!['ok','cached','stale'].includes(odds.status)){
   odds=await SportsOdds.getBoard(state.league);
   state.odds[state.league]=odds;
  }
 }catch(e){state.autoTicket.status=e?.message||'No sportsbook prices available';render();return;}
 if(!['ok','cached'].includes(odds?.status)){
  state.autoTicket.status=odds?.status==='needs_key'?'Sportsbook key is not configured.':'No recent cached sportsbook lines. Try again when the next scheduled refresh completes.';
  render();return;
 }
 const candidates=[];
 for(const game of games){
  const market=SportsOdds.marketConsensus(game,odds);
  if(!market)continue;
  for(const side of ['home','away']){
   const book=side==='home'?market.bestHome:market.bestAway;
   if(!book)continue;
   candidates.push({league:game.league,market:'Moneyline',gameId:game.id,start:game.start,
    teamName:game[side].name,probability:side==='home'?market.homeProbability:market.awayProbability,
    odds:side==='home'?book.homePrice:book.awayPrice,bookmaker:book.title,oddsAsOf:book.asOf});
  }
 }
 const result=SportsAutoTicket.buildMarket(candidates,{target:state.autoTicket.target,maxLegs:2});
 if(!result.ok){state.autoTicket.status=result.reason;render();return;}
 state.ticket=result.legs;saveTicket();
 state.autoTicket.status=result.legs.length+' market-derived selection'+(result.legs.length===1?'':'s')+' generated. These are bookmaker estimates, NOT validated model picks. Recheck every price.';
 render();
}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;if(action==='generate-ticket'){await generateAutomaticTicket();return;}if(action==='ticket-mode'){state.ticketMode=el.dataset.mode==='manual'?'manual':'automatic';render();if(state.ticketMode==='automatic')void loadDailySuggestions();return;}if(action==='daily-ticket-load'){loadSuggestedTicket(el.dataset.id);return;}if(action==='autocomplete-select'){await acceptLookup(Number(el.dataset.index));return;}if(action==='big-screen'){changeBigScreen();return;}if(action==='share'){const ok=await copyText(publicShareUrl());notify(ok?'Clean website link copied — paste it in Discord.':'Copy this link: '+publicShareUrl());return;}else if(action==='feedback'){state.drawer={type:'feedback'};render();return;}else if(action==='copy-feedback'){const type=document.getElementById('feedback-kind')?.value||'Feedback';const note=(document.getElementById('feedback-note')?.value||'').trim();if(!note){notify('Enter your feedback first.');return;}const report=`Sports Spreads beta feedback\n${type}\n${note}`;const ok=await copyText(report);notify(ok?'Feedback copied — paste it in Discord.':'Copy the feedback text into Discord.');if(ok){state.drawer=null;render();}return;}else if(action==='nav'){state.section=el.dataset.section;state.drawer=null;state.draft=null;render();if(state.section==='teams')loadTeams();if(state.section==='tickets')void loadDailySuggestions();window.scrollTo({top:0,behavior:'instant'});}else if(action==='league'){state.league=el.dataset.league;state.search='';state.drawer=null;if(state.section==='teams')loadTeams();else loadBoard();}else if(action==='reload-teams'){loadTeams(true);}else if(action==='directory-team'){openDirectoryTeam(el.dataset.teamId);}else if(action==='refresh'){loadBoard();}else if(action==='close'){state.drawer=null;render();}else if(action==='team'){openTeam(getGame(el.dataset.game),el.dataset.team);}else if(action==='game'){const game=getGame(el.dataset.game);if(game){state.drawer={type:'game',game};render();void loadGameWeather(game);void loadSportsbookOdds(game);}}else if(action==='load-signals'){void loadPregameSignals(getGame(el.dataset.game));}else if(action==='load-odds'){void loadSportsbookOdds(getGame(el.dataset.game));}else if(action==='odds-pick'){useSportsbookQuote(getGame(el.dataset.game),el.dataset.side,el.dataset.index);}else if(action==='weather-retry'){const game=getGame(el.dataset.game);if(game)void loadGameWeather(game,true);}else if(action==='teamtab'){state.teamTab=el.dataset.tab;loadTeam(state.teamTab);}else if(action==='retry-team'){loadTeam(state.teamTab,true);}else if(action==='player'){const player=getRosterPlayer(el.dataset.player);if(player){const team=state.drawer.team;state.drawer={type:'player',player,league:state.drawer.league,team};render();}}else if(action==='player-prop'){const d=state.drawer;if(d?.type==='player'){state.draft={league:d.league,selection:d.player.name,playerId:d.player.id,teamId:d.team.id,market:(PROPS[d.league]||[])[0]?.[0]||'Other'};state.league=d.league;state.section='tickets';state.drawer=null;render();window.scrollTo(0,0);}}else if(action==='back-team'){state.drawer={type:'team',league:state.drawer.league,team:state.drawer.team};state.teamTab='roster';render();}else if(action==='quickpick'){const game=getGame(el.dataset.game);state.draft={league:game.league,selection:`${game.away.name} to win`,gameId:game.demo?null:game.id};state.section='tickets';state.drawer=null;render();window.scrollTo(0,0);}else if(action==='remove-leg'){state.ticket.splice(Number(el.dataset.index),1);saveTicket();render();}else if(action==='clear-ticket'){state.ticket=[];saveTicket();render();}else if(action==='archive-ticket'){archiveTicket();}else if(action==='cloud-save'){await saveCloudTicket();}else if(action==='cloud-fetch'){await fetchCloudTickets();}else if(action==='cloud-signout'){await SportsCloud.signOut();state.cloud.token='';state.cloud.tickets=[];state.cloud.status='Signed out.';render();}else if(action==='restore-archive'){const snap=state.history[Number(el.dataset.index)];if(snap){state.ticket=JSON.parse(JSON.stringify(snap.legs));state.stake=String(snap.stake);state.section='tickets';saveTicket();render();notify('Loaded a copy. The saved snapshot is unchanged.');}}else if(action==='export-ticket'){exportTicket();}else if(action==='about'){state.section='about';render();}});
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
function bootSportsSpreads(){
 app=document.getElementById('app');
 if(!app){console.error('Sports Spreads startup failed: #app is missing.');return;}
 try{render();loadBoard();loadCloudConfig();}
 catch(err){console.error('Sports Spreads startup error:',err);app.textContent='Sports Spreads could not start. Please reload the page.';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootSportsSpreads,{once:true});
else bootSportsSpreads();
