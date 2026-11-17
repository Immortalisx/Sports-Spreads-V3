/* Read-only, no-key, sourced pregame matchup facts. Never modifies live model probabilities. */
(function(root){
'use strict';
async function get(game){
 if(game?.league!=='mlb'||!game?.start||!game?.home?.name||!game?.away?.name||game.demo)throw Error('No supported pregame signals for this matchup');
 const base=root.SS_SIGNALS_CONFIG?.url;
 if(typeof base!=='string'||!/^https:\/\/[-a-z0-9]+\.supabase\.co\/functions\/v1\/matchup-signals$/i.test(base))throw Error('Pregame signal provider not configured');
 const date=new Date(game.start);if(!Number.isFinite(date.getTime()))throw Error('Unrecognized game date');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const gameDate=`${parts.year}-${parts.month}-${parts.day}`;
 const params=new URLSearchParams({league:'mlb',date:gameDate,home:game.home.name,away:game.away.name});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{const res=await fetch(base+'?'+params,{signal:ctrl.signal,headers:{Accept:'application/json'}});const data=await res.json();if(!res.ok)throw Error(String(data.error||'Pregame provider unavailable'));return data;}
 finally{clearTimeout(timer);}
}
root.SportsSignals=Object.freeze({get});
})(globalThis);
