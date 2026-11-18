/* Normalize actual cached sportsbook event markets, without inventing players or prices.
 * Provider event-odds h2h feeds often contain no player props. Preserve that fact.
 */
const markets=new Set(['h2h','spreads','totals','player_pass_yds','player_rush_yds','player_rec_yds','player_receptions','player_anytime_td','player_points','player_assists','player_rebounds','player_shots','player_goals']);
const validPrice=p=>Number.isInteger(p)&&(p>=100&&p<=100000||p<=-100&&p>=-100000);
const safe=s=>typeof s==='string'&&s.length>0&&s.length<=180?s:null;
export function extractCachedOffers(event,{playerDirectory={}}={}){
 if(!event||!safe(event.id)||!Array.isArray(event.bookmakers))return {offers:[],counts:{team:0,player:0,unresolvedPlayers:0}};
 const offers=[],counts={team:0,player:0,unresolvedPlayers:0};
 for(const book of event.bookmakers){
  if(!safe(book.key)||!Array.isArray(book.markets))continue;
  for(const market of book.markets){
   if(!markets.has(market.key)||!Array.isArray(market.outcomes))continue;
   const asOf=market.last_update||book.last_update;
   if(!Number.isFinite(Date.parse(asOf||'')))continue;
   for(const outcome of market.outcomes){
    if(!validPrice(outcome.price)||!safe(outcome.name))continue;
    const player=market.key.startsWith('player_');
    const playerName=player?safe(outcome.description):null;
    const playerId=playerName?playerDirectory[playerName]:null;
    if(player&&!safe(playerId)){counts.unresolvedPlayers++;continue;}
    const point=Number.isFinite(outcome.point)?outcome.point:null;
    const selection=player?playerName+' '+outcome.name+(point!==null?' '+point:''):outcome.name+(point!==null?' '+point:'');
    offers.push({id:[event.id,book.key,market.key,playerId||'',outcome.name,point??''].join('|'),
     gameId:event.id,bookmakerKey:book.key,market:market.key==='spreads'?'spread':market.key==='totals'?'total':market.key,
     selection,price:outcome.price,asOf, ...(player?{playerId}:{}),...(point!==null?{point}:{})});
    counts[player?'player':'team']++;
   }
  }
 }
 return {offers,counts};
}
