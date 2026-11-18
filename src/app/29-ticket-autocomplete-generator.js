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
    odds:side==='home'?book.homePrice:book.awayPrice,bookmaker:book.title,bookmakerKey:book.key,oddsAsOf:book.asOf});
  }
 }
 const result=SportsAutoTicket.buildMarket(candidates,{target:state.autoTicket.target,maxLegs:2});
 if(!result.ok){state.autoTicket.status=result.reason;render();return;}
 state.ticket=result.legs;saveTicket();
 state.autoTicket.status=result.legs.length+' market-derived selection'+(result.legs.length===1?'':'s')+' generated. These are bookmaker estimates, NOT validated model picks. Recheck every price.';
 render();
}
