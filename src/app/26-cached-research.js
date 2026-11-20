async function loadNflAvailability(force=false){
 if(state.nflAvailabilityLoading||(!force&&state.nflAvailability))return;
 if(force)state.nflAvailability=null;
 state.nflAvailabilityLoading=true;state.nflAvailabilityError='';render();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nfl-availability',{
   headers:{accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('NFL injury snapshot currently unavailable');
  const data=await response.json();
  if(data?.status==='cached'&&data.league==='nfl'&&Array.isArray(data.games)&&
   data.games.every(x=>x.league==='nfl'&&x.appliedToForecast===false&&x.calibrated===false)){
   state.nflAvailability=data;
  }else state.nflAvailabilityError=data.status==='stale'?
    'QB/injury snapshot is stale; no old reports displayed.':'NFL QB/injury refresh not published yet.';
 }catch(e){state.nflAvailabilityError=e?.message||'NFL availability source unavailable';}
 finally{clearTimeout(timeout);state.nflAvailabilityLoading=false;render();}
}
async function loadCurrentSeasonForm(league){
 if(!['nfl','nba','mlb'].includes(league)||state.formLoading[league]||state.forms[league])return;
 state.formLoading[league]=true;delete state.formErrors[league];
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/season-form?league='+league,{
   headers:{accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error('Current-season results cache unavailable');
  const source=await response.json();
  if(!Array.isArray(source.snapshots))throw Error('Incomplete current-season form snapshot');
  if(source.status==='cached'&&source.league===league&&
   source.snapshots.every(x=>x?.league===league&&x.appliedToForecast===false)){
   state.forms[league]=source;
  }else state.formErrors[league]='Current-season history not yet published.';
 }catch(e){state.formErrors[league]=e?.message||'Form history unavailable';}
 finally{clearTimeout(timeout);state.formLoading[league]=false;render();}
}


/** One cached, game-scoped GET; no visitor-triggered nflverse imports. */
async function loadNflCoaching(game,force=false){
 if(game?.league!=='nfl'||game.demo||game.status!=='scheduled'||!game.start)return;
 const id=String(game.id),day=new Intl.DateTimeFormat('sv-SE',
  {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(game.start));
 if(state.coachingLoading[id]||(!force&&state.coaching[id]))return;
 state.coachingLoading[id]=true;delete state.coachingErrors[id];render();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const params=new URLSearchParams({home:game.home?.abbr||'',away:game.away?.abbr||'',date:day});
  const r=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nfl-coaching?'+params,
   {headers:{accept:'application/json'},signal:ctrl.signal});
  if(!r.ok)throw Error('Cached NFL coaching history unavailable');
  const data=await r.json();
  if(data?.status==='cached'&&data.league==='nfl'&&data.calibrated===false&&
   data.appliedToForecast===false&&data.home?.coach&&data.away?.coach&&
   data.asOf<day)state.coaching[id]=data;
  else state.coachingErrors[id]='No eligible pregame coach history is available for this matchup.';
 }catch(e){state.coachingErrors[id]=e?.message||'NFL coaching history unavailable';}
 finally{clearTimeout(timer);state.coachingLoading[id]=false;render();}
}


/** Only loads when someone requests game-scoped price history; no Odds API calls. */
async function loadMarketHistory(game,force=false){
 if(!game||game.demo||game.status!=='scheduled'||!globalThis.SportsOdds)return;
 const id=String(game.id),matched=SportsOdds.booksForGame(game,state.odds[game.league]);
 const eventId=String(matched?.eventId||'');
 if(!matched.matched||!/^[a-zA-Z0-9_-]{8,80}$/.test(eventId))return;
 if(state.marketHistoryLoading[id]||(!force&&state.marketHistory[id]))return;
 state.marketHistoryLoading[id]=true;delete state.marketHistoryErrors[id];render();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const q=new URLSearchParams({league:game.league,event_id:eventId});
  const r=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/market-history?'+q,{
   headers:{accept:'application/json'},signal:ctrl.signal});
  if(!r.ok)throw Error('Archived market history unavailable');
  const data=await r.json();
  if(!['cached','pending'].includes(data.status)||data.league!==game.league||
    data.eventId!==eventId||!Array.isArray(data.points)||data.points.length>24||
    data.calibrated!==false||data.appliedToForecast!==false||
    data.points.some(x=>!Number.isFinite(x.homeNoVig)||x.homeNoVig<=0||
     x.homeNoVig>=1||!Number.isFinite(Date.parse(x.asOf))||
     Date.parse(x.asOf)>=Date.parse(game.start)))
   throw Error('Unverified or mismatched market history');
  state.marketHistory[id]=data;
 }catch(e){state.marketHistoryErrors[id]=e?.message||'Market history unavailable';}
 finally{clearTimeout(timer);state.marketHistoryLoading[id]=false;render();}
}
