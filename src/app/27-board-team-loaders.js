async function loadBoard(){
 const league=state.league,date=state.date;
 state.loading=true;state.error='';state.feed=null;
 render();
 try{const json=await readSportsData(`/api/scoreboard?league=${league}&date=${date.replaceAll('-','')}`);if(state.league!==league||state.date!==date)return;state.feed=json;state.error='';}
 catch(e){if(state.league!==league||state.date!==date)return;state.error=e.message||'Provider unavailable';state.feed={games:[],demo:true,updatedAt:null};}
 finally{if(state.league===league&&state.date===date){state.loading=false;render();// Detail-only feeds (odds, form, injuries, goalies) are intentionally fetched
 // only when a user opens a matchup. This keeps the schedule lightweight.
}}
}
// Version each directory request so late responses cannot replace a newer forced refresh.
const directoryRequestVersions=Object.create(null);
async function loadTeams(force=false){
 const league=state.league;
 if(state.directory[league]&&!force){if(state.section==='teams')render();return;}
 if(state.directoryLoading[league]&&!force)return;
 const version=(directoryRequestVersions[league]||0)+1;
 directoryRequestVersions[league]=version;
 state.directoryLoading[league]=true;
 if(state.section==='teams'&&state.league===league)render();
 try{
  const json=await readSportsData(`/api/teams?league=${league}`);
  if(directoryRequestVersions[league]===version)state.directory[league]={...json,demo:false};
 }catch(e){
  if(directoryRequestVersions[league]===version)state.directory[league]={teams:[],error:e.message||'Feed unavailable',demo:true};
 }finally{
  if(directoryRequestVersions[league]===version){
   state.directoryLoading[league]=false;
   if(state.league===league&&state.section==='teams')render();
  }
 }
}
function teamCacheKey(d,tab){return `${d.league}-${d.team.id}-${tab}`;}
function isActiveTeamDetail(d,tab){const active=state.drawer;return active?.type==='team'&&active.league===d.league&&String(active.team?.id)===String(d.team.id)&&state.teamTab===tab;}
async function loadTeam(tab,force=false){
 if(state.drawer?.type!=='team')return;const d=state.drawer,key=teamCacheKey(d,tab);
 if(state.teamCache[key]&&!force){if(isActiveTeamDetail(d,tab))render();return;}if(state.teamLoading[key])return;state.teamLoading[key]=true;delete state.teamErrors[key];if(isActiveTeamDetail(d,tab))render();
 try{const json=await readSportsData(`/api/team/${d.league}/${encodeURIComponent(d.team.id)}?view=${tab}&name=${encodeURIComponent(d.team.name)}`);state.teamCache[key]=json;}
 catch(e){state.teamErrors[key]=e.message||'Team feed unavailable';}
 finally{state.teamLoading[key]=false;if(isActiveTeamDetail(d,tab))render();}
}
