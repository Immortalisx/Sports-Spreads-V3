/* Optional, server-side, user-scoped Supabase Data API adapter.
 * No service-role/secret key is used. Supabase RLS enforces ownership.
 */
export class CloudError extends Error {
  constructor(message,status=503){super(message);this.status=status;}
}
export function cloudConfig(env=process.env){
  const key=env.SUPABASE_PUBLISHABLE_KEY||'';
  let url='';
  try{const target=new URL(env.SUPABASE_URL||'');if(target.protocol==='https:' && target.username==='' && target.password==='')url=target.origin; }catch{}
  return {configured:Boolean(url&&key),url,key};
}
function bearerToken(auth){
  const found=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(auth||'');
  if(!found||found[1].length>3500)throw new CloudError('Sign in to access saved tickets.',401);
  return found[1];
}
export function validateSnapshot(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new CloudError('Invalid ticket.',400);
  if(!Array.isArray(body.legs)||body.legs.length<1||body.legs.length>20)throw new CloudError('A ticket needs 1–20 legs.',400);
  const stake=Number(body.stake);
  if(!Number.isFinite(stake)||stake<=0||stake>1000000)throw new CloudError('Stake must be between $0.01 and $1,000,000.',400);
  if(!body.legs.every(x=>x&&typeof x.selection==='string'&&x.selection.length<=95&&x.selection.length>0&&['nba','nfl','nhl','mlb'].includes(x.league)&&Number.isInteger(Number(x.odds))&&Math.abs(Number(x.odds))>=100&&Math.abs(Number(x.odds))<=100000))throw new CloudError('Ticket contains an invalid selection.',400);
  const legs=body.legs.map(l=>({league:l.league,market:String(l.market||'Other').slice(0,55),selection:l.selection.slice(0,95),notes:String(l.notes||'').slice(0,85),odds:Number(l.odds),gameId:l.gameId||null,playerId:l.playerId||null,teamId:l.teamId||null,enteredAt:l.enteredAt||null}));
  let factor=1;for(const l of legs)factor*=l.odds>0?1+l.odds/100:1+100/Math.abs(l.odds);
  if(!Number.isFinite(factor)||factor>1e15)throw new CloudError('Ticket payout is too large.',400);
  const combinedAmericanOdds=factor>=2?`+${Math.round((factor-1)*100)}`:`-${Math.round(100/(factor-1))}`;
  return {label:String(body.label||'Saved ticket').slice(0,95),stake,legs,odds_source:'manual_unverified',combined_american_odds:combinedAmericanOdds,potential_return:Math.round(stake*factor*100)/100};
}
export async function cloudTickets({method,auth,body,env=process.env,fetcher=globalThis.fetch}){
  const cfg=cloudConfig(env);if(!cfg.configured)throw new CloudError('Cloud storage is not configured.',503);
  const token=bearerToken(auth);
  const url=new URL('/rest/v1/user_tickets',cfg.url);
  if(method==='GET')url.search='?select=id,label,stake,legs,combined_american_odds,potential_return,odds_source,created_at&order=created_at.desc&limit=50';
  else if(method!=='POST')throw new CloudError('Method not allowed.',405);
  const data=method==='POST'?validateSnapshot(body):null;
  let result;
  try{result=await fetcher(url.toString(),{method,headers:{apikey:cfg.key,authorization:`Bearer ${token}`,'content-type':'application/json',prefer:'return=representation'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(8000)});}
  catch{throw new CloudError('Ticket storage service is temporarily unreachable.',502);}
  if(result.status===401||result.status===403)throw new CloudError('Session expired or access denied.',result.status);
  if(!result.ok)throw new CloudError('Cloud storage request failed.',502);
  let rows;try{rows=await result.json();}catch{throw new CloudError('Unexpected cloud response.',502);}
  if(!Array.isArray(rows))throw new CloudError('Unexpected cloud response.',502);
  return rows;
}
