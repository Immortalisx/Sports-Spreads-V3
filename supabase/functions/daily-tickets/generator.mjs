/* Source-only shared daily suggested tickets.
 * Neither market no-vig probabilities nor products of legs are validated parlay
 * models. No guaranteed returns, betting advice or bookmaker orders.
 */
export const DAILY_TICKETS_VERSION='daily-market-research-v1';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const americanToDecimal=p=>p>0?1+p/100:1+100/-p;
const implied=p=>1/americanToDecimal(p);
const validPrice=p=>Number.isInteger(p)&&Math.abs(p)>=100&&Math.abs(p)<=100000;
const four=new Set(['nfl','nba','nhl','mlb']);
const kLeague={americanfootball_nfl:'nfl',basketball_nba:'nba',icehockey_nhl:'nhl',baseball_mlb:'mlb'};
const normal=s=>String(s||'').trim().toLowerCase();
export function sourceCandidates(rows,now=new Date()){
 const time=now.getTime(),candidateByBook=new Map(),seenIds=new Set();
 if(!Array.isArray(rows))throw Error('Malformed shared cache data');
 for(const row of rows){
  const age=time-Date.parse(row.fetched_at||''),snapshot=row.snapshot;
  if(!Number.isFinite(age)||age<0||age>8*3600_000||!snapshot||!Array.isArray(snapshot.events))continue;
  for(const e of snapshot.events){
   if(!e||!kLeague[e.sport_key]||!four.has(kLeague[e.sport_key]))continue;
   const start=Date.parse(e.commence_time||'');
   if(!Number.isFinite(start)||start<=time||start>time+36*3600_000)continue;
   const eventId=kLeague[e.sport_key]+':'+String(e.id||'').slice(0,110);
   if(seenIds.has(eventId))continue;seenIds.add(eventId);
   const books=[];
   for(const book of e.bookmakers||[]){
    const market=(book.markets||[]).find(m=>m.key==='h2h');
    const outcomes=market?.outcomes||[],home=outcomes.find(o=>normal(o.name)===normal(e.home_team)),
      away=outcomes.find(o=>normal(o.name)===normal(e.away_team));
    if(!home||!away||!validPrice(home.price)||!validPrice(away.price))continue;
    const updated=Date.parse(market?.last_update||book.last_update||'');
    if(!Number.isFinite(updated)||updated>time+60_000||time-updated>8*3600_000)continue;
    const h=implied(home.price),a=implied(away.price),total=h+a;
    if(!Number.isFinite(total)||total<=.99||total>1.30)continue;
    books.push({key:String(book.key||'').slice(0,55),title:String(book.title||'').slice(0,100),
      homePrice:home.price,awayPrice:away.price,homeP:h/total,updatedAt:new Date(updated).toISOString()});
   }
   const keys=new Set(books.map(b=>b.key));if(keys.size<3)continue; // Avoid thin/ambiguous markets.
   const avg=books.reduce((a,b)=>a+b.homeP,0)/books.length;
   for(const b of books){
    if(!b.key)continue;
    if(!candidateByBook.has(b.key))candidateByBook.set(b.key,[]);
    const cand=candidateByBook.get(b.key);
    for(const side of ['home','away']){
     const p=side==='home'?avg:1-avg,price=side==='home'?b.homePrice:b.awayPrice;
     cand.push({gameId:eventId,league:kLeague[e.sport_key],homeTeam:e.home_team,awayTeam:e.away_team,
       start:new Date(start).toISOString(),selection:side==='home'?e.home_team:e.away_team,
       side,marketProbability:p,odds:price,bookmaker:b.title,bookmakerKey:b.key,
       oddsAsOf:b.updatedAt,sourceBooks:keys.size,market:'Moneyline'});
    }
   }
  }
 }
 return candidateByBook;
}
function marketGrade(p){
 if(p>=.6)return 'A';if(p>=.4)return 'B';if(p>=.25)return 'C';if(p>=.12)return 'D';return 'E';
}
const MODES=[
 {id:'steady',name:'Steady',legs:2,minP:.67,maxP:.95,targetP:.78},
 {id:'balanced',name:'Balanced',legs:3,minP:.60,maxP:.85,targetP:.68},
 {id:'upside',name:'Upside',legs:3,minP:.53,maxP:.75,targetP:.62},
 {id:'big-one',name:'The Big One',legs:4,minP:.54,maxP:.78,targetP:.64}
];
function ticketFor(mode,byBook,now){
 const options=[];
 for(const [bookKey,candidates] of byBook){
  const ordered=candidates.filter(x=>x.marketProbability>=mode.minP&&x.marketProbability<=mode.maxP)
   .sort((a,b)=>Math.abs(a.marketProbability-mode.targetP)-Math.abs(b.marketProbability-mode.targetP)||
      b.sourceBooks-a.sourceBooks||a.gameId.localeCompare(b.gameId));
  const selected=[],games=new Set(),teams=new Set();
  for(const c of ordered){
   if(games.has(c.gameId)||teams.has(normal(c.homeTeam))||teams.has(normal(c.awayTeam)))continue;
   games.add(c.gameId);teams.add(normal(c.homeTeam));teams.add(normal(c.awayTeam));
   selected.push(c);if(selected.length>=mode.legs)break;
  }
  if(selected.length!==mode.legs)continue;
  const factor=selected.reduce((p,x)=>p*americanToDecimal(x.odds),1);
  const assumedP=selected.reduce((p,x)=>p*x.marketProbability,1);
  if(!Number.isFinite(factor)||!Number.isFinite(assumedP))continue;
  if(mode.id==='big-one'&&(factor<4||factor>50||assumedP<.055))continue;
  const averageBooks=selected.reduce((s,x)=>s+x.sourceBooks,0)/selected.length;
  options.push({id:mode.id,name:mode.name,bookmaker:selected[0].bookmaker,
   bookmakerKey:bookKey,legs:selected,legCount:selected.length,marketGrade:marketGrade(assumedP),
   marketProbabilityProduct:assumedP,payoutMultiplier:factor,returnAt10:Math.round(1000*factor)/100,
   profitAt10:Math.round(1000*(factor-1))/100,
   basis:'Same-book sourced moneylines; product of per-game no-vig market estimates assumes independence and is NOT historically calibrated for parlays.',
   generatedAt:now.toISOString(),averageSourceBooks:averageBooks});
 }
 if(!options.length)return {id:mode.id,name:mode.name,available:false,
  reason:'Not enough qualifying, unexpired same-book games for this ticket today.'};
 options.sort((a,b)=>(b.averageSourceBooks-a.averageSourceBooks)||
  (mode.id==='big-one'?b.payoutMultiplier-a.payoutMultiplier:b.marketProbabilityProduct-a.marketProbabilityProduct));
 return {available:true,...options[0]};
}
export function buildDailySuggestions(rows,{now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid generation time');
 const candidateByBook=sourceCandidates(rows,now);
 const dateET=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return {version:DAILY_TICKETS_VERSION,dateET,generatedAt:now.toISOString(),
  status:'market_illustrations_not_model_confidence',source:'The Odds API shared US h2h cache',
  disclaimer:'No joint probability or parlay confidence has been independently calibrated. Bookmaker quotes are snapshots, parlays may be restricted, and no wager is placed.',
  cards:MODES.map(m=>ticketFor(m,candidateByBook,now))};
}
