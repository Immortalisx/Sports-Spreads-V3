async function loadBoard(){
 const league=state.league,date=state.date;
 state.loading=true;state.error='';state.feed=null;
 render();
 try{const json=await readSportsData(`/api/scoreboard?league=${league}&date=${date.replaceAll('-','')}`);if(state.league!==league||state.date!==date)return;state.feed=json;state.error='';}
 catch(e){if(state.league!==league||state.date!==date)return;state.error=e.message||'Provider unavailable';state.feed={games:[],demo:true,updatedAt:null};}
 finally{if(state.league===league&&state.date===date){state.loading=false;render();const first=state.feed?.games?.find(g=>!g.demo&&g.status==='scheduled');if(first&&!state.odds[league])void loadSportsbookOdds(first);if(first)void loadCurrentSeasonForm(league);if(league==='nfl'&&first)void loadNflAvailability();if(league==='nhl'&&first)void loadNhlGoalies();}}
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
