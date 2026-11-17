/* Free-static-host cloud adapter: Supabase publishable keys and per-user RLS only.
 * No service-role or secret credentials are required or accepted here.
 */
(function(root){
 'use strict';
 const tokenKey='ss-cloud-access',refreshKey='ss-cloud-refresh';
 function config(){
  const raw=root.SS_CLOUD_CONFIG||{};
  let url='';try{const parsed=new URL(raw.url||'');if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&parsed.pathname==='/')url=parsed.origin;}catch{}
  const key=typeof raw.publishableKey==='string'?raw.publishableKey:'';
  return {url,key,configured:Boolean(url&&key&&key.startsWith('sb_publishable_'))};
 }
 const storage={get:k=>{try{return root.sessionStorage?.getItem(k)||'';}catch{return'';}},set:(k,v)=>{try{root.sessionStorage?.setItem(k,v);}catch{}},remove:k=>{try{root.sessionStorage?.removeItem(k);}catch{}}};
 function credentials(){return {access:storage.get(tokenKey),refresh:storage.get(refreshKey)};}
 function consumeRedirect(){
  const url=new URL(root.location?.href||'https://sports-spreads.onrender.com/');
  const hash=new URLSearchParams(url.hash.replace(/^#/,''));
  const access=hash.get('access_token'),refresh=hash.get('refresh_token');
  if(access){storage.set(tokenKey,access);if(refresh)storage.set(refreshKey,refresh);
   if(root.history?.replaceState){url.hash='';root.history.replaceState(null,'',url.pathname+url.search);}}
  return Boolean(access);
 }
 async function renew(){
  const c=config(),old=credentials().refresh;if(!c.configured||!old)throw Error('Sign in again to restore cloud access.');
  const response=await root.fetch(`${c.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:c.key,'content-type':'application/json'},body:JSON.stringify({refresh_token:old})});
  if(!response.ok)throw Error('Your cloud session expired. Sign in again.');
  const data=await response.json();if(!data.access_token)throw Error('Could not refresh session.');
  storage.set(tokenKey,data.access_token);if(data.refresh_token)storage.set(refreshKey,data.refresh_token);
  return data.access_token;
 }
 async function request(method,path,body){
  const c=config();if(!c.configured)throw Error('Cloud saving has not been activated.');
  let access=credentials().access;if(!access)throw Error('Sign in before saving tickets.');
  async function go(token){return root.fetch(`${c.url}${path}`,{method,headers:{apikey:c.key,authorization:`Bearer ${token}`,'content-type':'application/json',prefer:'return=representation'},body:body?JSON.stringify(body):undefined});}
  let r=await go(access);if(r.status===401){access=await renew();r=await go(access);}
  if(!r.ok)throw Error(r.status===403?'Access denied. Check database access policies.':`Cloud request failed (${r.status}).`);
  return r.json();
 }
 async function emailLink(email){
  const c=config();if(!c.configured)throw Error('Cloud saving has not been activated.');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Enter a valid email address.');
  const redirect=`${root.location.origin}/`;
  const r=await root.fetch(`${c.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:c.key,'content-type':'application/json'},body:JSON.stringify({email,create_user:true})});
  if(!r.ok)throw Error('Could not send sign-in link. Check email settings and permitted redirect URL.');
  return true;
 }
 async function tickets(){return request('GET','/rest/v1/user_tickets?select=id,label,stake,legs,combined_american_odds,potential_return,odds_source,created_at&order=created_at.desc&limit=50');}
 async function saveTicket(payload){
  if(!Array.isArray(payload.legs)||payload.legs.length<1||payload.legs.length>20)throw Error('Ticket needs 1–20 selections.');
  const stake=Number(payload.stake);if(!Number.isFinite(stake)||stake<=0||stake>1000000)throw Error('Stake must be positive.');
  // Browser-supplied values are user-entered and not official model forecasts.
  const legs=payload.legs.map(l=>({league:String(l.league).slice(0,10),market:String(l.market||'Other').slice(0,55),selection:String(l.selection||'').slice(0,95),notes:String(l.notes||'').slice(0,85),odds:Number(l.odds),gameId:l.gameId||null,playerId:l.playerId||null,teamId:l.teamId||null,enteredAt:l.enteredAt||null}));
  if(legs.some(l=>!['nfl','nba','nhl','mlb'].includes(l.league)||!l.selection||!Number.isInteger(l.odds)||Math.abs(l.odds)<100||Math.abs(l.odds)>100000))throw Error('Invalid selection.');
  const multiplier=legs.reduce((v,l)=>v*(l.odds>0?1+l.odds/100:1+100/Math.abs(l.odds)),1);
  if(!Number.isFinite(multiplier)||multiplier>1e15)throw Error('Payout exceeds supported range.');
  const combined=multiplier>=2?`+${Math.round((multiplier-1)*100)}`:`-${Math.round(100/(multiplier-1))}`;
  return request('POST','/rest/v1/user_tickets',{label:String(payload.label||'Saved ticket').slice(0,95),stake,legs,odds_source:'manual_unverified',combined_american_odds:combined,potential_return:Math.round(stake*multiplier*100)/100});
 }
 async function signOut(){const c=config(),token=credentials().access;
  if(c.configured&&token){try{await root.fetch(`${c.url}/auth/v1/logout`,{method:'POST',headers:{apikey:c.key,authorization:`Bearer ${token}`}});}catch{}}
  storage.remove(tokenKey);storage.remove(refreshKey);
 }
 root.SportsCloud=Object.freeze({config,credentials,consumeRedirect,emailLink,tickets,saveTicket,signOut,renew});
})(globalThis);
