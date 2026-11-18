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
