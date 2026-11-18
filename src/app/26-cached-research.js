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
async function loadNhlGoalies(force=false){
 if(state.nhlGoaliesLoading||(!force&&state.nhlGoalies))return;
 if(force)state.nhlGoalies=null;
 state.nhlGoaliesLoading=true;state.nhlGoaliesError='';render();
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch('https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/nhl-goalie-form',{
   headers:{accept:'application/json'},signal:ctrl.signal});
  if(!r.ok)throw Error('NHL goalie research cache unavailable');
  const data=await r.json();
  if(data?.status==='cached'&&data.league==='nhl'&&Array.isArray(data.games)&&
   data.games.every(x=>x?.league==='nhl'&&x.appliedToForecast===false&&
    x.calibrated===false&&x.home?.confirmedStarter===false&&x.away?.confirmedStarter===false))
    state.nhlGoalies=data;
  else state.nhlGoaliesError=data.status==='stale'?
   'Previous goalie data is too old to display.':'NHL goalie history has not been published yet.';
 }catch(e){state.nhlGoaliesError=e?.message||'NHL goalie data unavailable';}
 finally{clearTimeout(timeout);state.nhlGoaliesLoading=false;render();}
}
async function loadCurrentSeasonForm(league){
 if(!['nfl','nba','nhl','mlb'].includes(league)||state.formLoading[league]||state.forms[league])return;
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
