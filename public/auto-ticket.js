/* Sports Spreads: confidence-targeted ticket generation requires validated model
 * probabilities AND fresh, quoted bookmaker prices. Never fabricate a pick.
 */
(function(root){
 'use strict';
 const VERSION='confidence-ticket-gate-v0.1';
 function priceOk(p){return Number.isInteger(p)&&Math.abs(p)>=100&&Math.abs(p)<=100000;}
 function implied(p){if(!priceOk(p))return null;return p>0?100/(p+100):-p/(-p+100);}
 function grade(pct){return pct>=90?'A+':pct>=85?'A':pct>=75?'B':pct>=65?'C':'D';}
 function eligible(input,now=Date.now()){
  if(!input||input.modelValidated!==true||typeof input.modelVersion!=='string'||!input.modelVersion.trim())return false;
  const p=input.probability,price=input.odds,time=Date.parse(input.oddsAsOf||''),start=Date.parse(input.start||'');
  return Number.isFinite(p)&&p>0&&p<1&&priceOk(price)&&typeof input.gameId==='string'&&input.gameId.length>0&&
   ['nfl','nba','nhl','mlb'].includes(input.league)&&input.market==='Moneyline'&&
   typeof input.teamName==='string'&&input.teamName.length>1&&typeof input.bookmaker==='string'&&input.bookmaker.length>0&&
   Number.isFinite(time)&&time<=now&&now-time<=15*60*1000&&Number.isFinite(start)&&start>now;
 }
 function sameBookCandidates(candidates,maxLegs){
  const groups=new Map();
  for(const x of candidates){const key=String(x.bookmakerKey||x.bookmaker||'').toLowerCase().trim();
   if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
  let chosen=[];
  for(const options of groups.values()){
   const accepted=[],seen=new Set();
   for(const x of options){const id=x.league+':'+x.gameId;if(seen.has(id))continue;
    seen.add(id);accepted.push(x);if(accepted.length===maxLegs)break;}
   if(accepted.length>chosen.length||(accepted.length===chosen.length&&
     accepted.reduce((n,x)=>n+x.probability,0)>chosen.reduce((n,x)=>n+x.probability,0)))chosen=accepted;
  }
  return chosen;
 }
 function build(candidates,{target=75,maxLegs=2,now=Date.now(),minEdge=.025}={}){
  if(!Number.isInteger(target)||target<50||target>95||target%5!==0||!Number.isInteger(maxLegs)||maxLegs<1||maxLegs>3)
   throw Error('Invalid ticket confidence target');
  if(!Array.isArray(candidates))return {ok:false,legs:[],reason:'Candidate list unavailable.'};
  const scored=candidates.filter(x=>eligible(x,now)).map(x=>({...x,edge:x.probability-implied(x.odds)}))
   .filter(x=>x.probability>=target/100&&x.edge>=minEdge)
   .sort((a,b)=>b.edge-a.edge||b.probability-a.probability||a.gameId.localeCompare(b.gameId));
  const accepted=[];
  for(const x of sameBookCandidates(scored,maxLegs)){
   accepted.push({id:'auto-'+x.league+'-'+x.gameId+'-'+accepted.length,league:x.league,market:'Moneyline',selection:x.teamName+' to win',odds:x.odds,
    gameId:x.gameId,bookmaker:x.bookmaker,bookmakerKey:x.bookmakerKey||null,oddsAsOf:x.oddsAsOf,modelConfidence:x.probability,modelValidated:true,
    modelVersion:x.modelVersion,notes:'Validated model candidate · verify book price',enteredAt:new Date(now).toISOString()});
   if(accepted.length===maxLegs)break;
  }
  if(!accepted.length)return {ok:false,legs:[],reason:'No calibrated picks with fresh bookmaker quotes meet this target.'};
  return {ok:true,legs:accepted,target,warning:'Review all odds directly with the bookmaker. Separate game probabilities are not a validated joint parlay probability.'};
 }
 // A single independently calibrated leg may display its own model probability;
 // multiple legs need a separately validated dependence/joint model.
 
/** Builds moneyline research tickets using sourced bookmaker-implied estimates.
 * These are NOT calibrated model predictions, confidence grades or edge claims.
 */
function marketEligible(x,now=Date.now()){
 if(!x||!priceOk(x.odds)||!Number.isFinite(x.probability)||x.probability<=0||x.probability>=1)return false;
 const asOf=Date.parse(x.oddsAsOf||''),start=Date.parse(x.start||'');
 return Number.isFinite(asOf)&&asOf<=now&&now-asOf<=8*60*60*1000&&
  Number.isFinite(start)&&start>now &&
  typeof x.gameId==='string'&&x.gameId.length>0 &&
  ['nfl','nba','nhl','mlb'].includes(x.league)&&x.market==='Moneyline'&&
  typeof x.teamName==='string'&&x.teamName.length>1&&
  typeof x.bookmaker==='string'&&x.bookmaker.length>0;
}
function buildMarket(candidates,{target=75,maxLegs=2,now=Date.now()}={}){
 if(!Number.isInteger(target)||target<50||target>95||target%5!==0||!Number.isInteger(maxLegs)||maxLegs<1||maxLegs>3)
  throw Error('Invalid market target');
 if(!Array.isArray(candidates))return {ok:false,legs:[],reason:'No bookmaker information available.'};
 const available=candidates.filter(x=>marketEligible(x,now)&&x.probability>=target/100)
  .sort((a,b)=>b.probability-a.probability||a.gameId.localeCompare(b.gameId));
 const selected=[];
 for(const x of sameBookCandidates(available,maxLegs)){
  selected.push({id:'market-'+x.league+'-'+x.gameId+'-'+selected.length,
   league:x.league,market:'Moneyline',selection:x.teamName+' to win',odds:x.odds,
   gameId:x.gameId,bookmaker:x.bookmaker,bookmakerKey:x.bookmakerKey||null,oddsAsOf:x.oddsAsOf,
   marketImpliedProbability:x.probability,marketType:'No-vig bookmaker consensus',
   modelValidated:false,notes:'Market-implied estimate only; verify the current bookmaker quote',
   enteredAt:new Date(now).toISOString()});
  if(selected.length===maxLegs)break;
 }
 if(!selected.length)return {ok:false,legs:[],reason:'No future games with recent sportsbook quotes meet this market probability target.'};
 return {ok:true,legs:selected,target,kind:'market-derived',
  warning:'Market probabilities are not model confidence, edge or validated parlay probabilities. Check bookmaker prices.'};
}

function ticketConfidence(legs){
  if(!Array.isArray(legs)||legs.length!==1)return null;
  const [leg]=legs;
  return leg.modelValidated===true&&Number.isFinite(leg.modelConfidence)&&leg.modelConfidence>0&&leg.modelConfidence<1&&
   typeof leg.modelVersion==='string'&&leg.modelVersion.length>0?leg.modelConfidence:null;
 }
 root.SportsAutoTicket=Object.freeze({VERSION,grade,implied,eligible,build,marketEligible,buildMarket,ticketConfidence});
})(globalThis);
