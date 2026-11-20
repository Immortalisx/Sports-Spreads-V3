/* Sports Spreads — optional sportsbook odds display, never a betting order.
 * Upstream keys stay server-side. Moneyline is independent of the experimental model.
 */
(function(root){
'use strict';
const VERSION='sportsbook-odds-v0.1';
const MATCH_MAX_MS=36*60*60*1000;
const names={
 'la clippers':'los angeles clippers','la lakers':'los angeles lakers',
 'ny knicks':'new york knicks','ny rangers':'new york rangers','ny islanders':'new york islanders',
 'nj devils':'new jersey devils','tb lightning':'tampa bay lightning',
 'sf giants':'san francisco giants','sd padres':'san diego padres',
 'kc royals':'kansas city royals','st louis cardinals':'st louis cardinals',
 'st louis blues':'st louis blues','arizona diamondbacks':'arizona diamondbacks',
 'washington commanders':'washington commanders','washington football team':'washington commanders',
 'oakland athletics':'athletics','sacramento athletics':'athletics'
};
const safe=x=>String(x||'').normalize('NFKD').toLowerCase().replace(/\bst[.]?\b/g,'saint').replace(/\bthe\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function canonical(x){let s=safe(x);return names[s]||s;}
function validPrice(x){return Number.isInteger(x)&&Math.abs(x)>=100&&Math.abs(x)<=100000;}
function implied(price){if(!validPrice(price))return null;return price>0?100/(price+100):(-price)/((-price)+100);}
function fairHomePrice(home,away){const h=implied(home),a=implied(away);if(h===null||a===null||h+a<=0)return null;return {home:h/(h+a),away:a/(h+a),overround:h+a-1};}
function matchGame(game,events){
 if(!game||game.demo||!game.start||!Array.isArray(events))return null;
 const start=Date.parse(game.start),home=canonical(game.home?.name),away=canonical(game.away?.name);
 if(!Number.isFinite(start)||!home||!away||home===away)return null;
 const candidates=events.filter(e=>e&&canonical(e.home_team)===home&&canonical(e.away_team)===away&&Math.abs(Date.parse(e.commence_time)-start)<=MATCH_MAX_MS);
 return candidates.length===1?candidates[0]:null; // never map an ambiguous event
}
const SUPPORTED_BOOKS=new Set(['draftkings','fanduel','betmgm','betrivers','williamhill_us','fanatics','betparx','ballybet','espnbet']);
function booksForGame(game,response){
 const event=matchGame(game,response?.events);
 if(!event)return {matched:false,books:[],reason:'No exact, time-compatible sportsbook matchup found. Prices were not guessed.'};
 const results=[];
 for(const book of (event.bookmakers||[])){
  if(!SUPPORTED_BOOKS.has(String(book.key||'').toLowerCase()))continue;
  const h2h=(book.markets||[]).find(x=>x.key==='h2h');if(!h2h)continue;
  const home=h2h.outcomes?.find(x=>canonical(x.name)===canonical(event.home_team));
  const away=h2h.outcomes?.find(x=>canonical(x.name)===canonical(event.away_team));
  if(!home||!away||!validPrice(home.price)||!validPrice(away.price))continue;
  const fair=fairHomePrice(home.price,away.price);
  if(!fair)continue;
  results.push({key:String(book.key||''),title:String(book.title||book.key||'Sportsbook').slice(0,45),homePrice:home.price,awayPrice:away.price,
   homeFair:fair.home,awayFair:fair.away,overround:fair.overround,asOf:book.last_update||h2h.last_update||response.asOf||null,
   eventId:String(event.id||''),source:'The Odds API'});
 }
 results.sort((a,b)=>a.title.localeCompare(b.title));
 return {matched:results.length>0,books:results,eventId:event.id,reason:results.length?'':'No moneyline offers available for this matchup.'};
}
async function get(league,game){
 const url=root.SS_ODDS_CONFIG?.url;
 if(!['nfl','nba','mlb'].includes(league)||!game?.start||!game?.home?.name||!game?.away?.name)throw Error('Invalid matchup');
 if(typeof url!=='string'||!/^https:\/\/[-a-z0-9]+\.supabase\.co\/functions\/v1\/sportsbook-odds$/i.test(url))return {status:'not_configured',events:[]};
 const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),9000);
 try{
  const response=await fetch(url+'?'+new URLSearchParams({league,home:game.home.name,away:game.away.name,start:game.start}),{headers:{Accept:'application/json'},signal:ctrl.signal});
  const body=await response.json();
  if(!response.ok)throw Error(String(body.error||'Sportsbook feed unavailable'));
  if(!body||!Array.isArray(body.events))throw Error('Sportsbook feed returned an invalid response');
  return body;
 }finally{clearTimeout(tm);}
}

/* One cached league snapshot serves every visitor and every matchup on a board.
 * GET cannot call the licensed upstream provider or reserve credits. */
async function getBoard(league){
 const endpoint=root.SS_ODDS_CONFIG?.url;
 if(!['nfl','nba','mlb'].includes(league))throw Error('Unsupported league');
 if(typeof endpoint!=='string'||!/^https:\/\/[-a-z0-9]+\.supabase\.co\/functions\/v1\/sportsbook-odds$/i.test(endpoint))
  return {status:'not_configured',events:[]};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(endpoint+'?'+new URLSearchParams({league,mode:'board'}),{
   headers:{Accept:'application/json'},signal:controller.signal
  });
  const result=await response.json();
  if(!response.ok)throw Error(String(result.error||'Bookmaker cache unavailable'));
  if(!Array.isArray(result.events))throw Error('Invalid sportsbook snapshot');
  return result;
 }finally{clearTimeout(timer);}
}
/* Consensus is bookmaker implied probability with overround removed, NOT
 * a trained win forecast, confidence grade or betting edge. */
function marketConsensus(game,snapshot){
 if(!snapshot||!['ok','cached','stale'].includes(snapshot.status))return null;
 const matched=booksForGame(game,snapshot);
 if(!matched.matched)return null;
 const books=matched.books.filter(b=>Number.isFinite(Date.parse(b.asOf||''))&&
  Date.parse(b.asOf)<=Date.now()+60000);
 if(!books.length)return null;
 const average=books.reduce((sum,b)=>sum+b.homeFair,0)/books.length;
 const decimal=p=>p>0?1+p/100:1+100/-p;
 const bestHome=books.reduce((best,b)=>!best||decimal(b.homePrice)>decimal(best.homePrice)?b:best,null);
 const bestAway=books.reduce((best,b)=>!best||decimal(b.awayPrice)>decimal(best.awayPrice)?b:best,null);
 return {homeProbability:average,awayProbability:1-average,bookCount:books.length,
  bestHome,bestAway,asOf:snapshot.asOf,status:snapshot.status,source:'Bookmaker no-vig consensus'};
}

root.SportsOdds=Object.freeze({VERSION,canonical,validPrice,implied,fairHomePrice,matchGame,booksForGame,marketConsensus,get,getBoard});
})(globalThis);
