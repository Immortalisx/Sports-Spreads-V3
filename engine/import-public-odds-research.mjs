/* Offline-only third-party snapshot intake for research.
 * Caller supplies raw bytes, Git commit SHA, and verified capture time.
 * Never fetch live odds, invent settlement, or treat commit time as quote time.
 */
const leagues={americanfootball_nfl:'nfl',icehockey_nhl:'nhl'};
const books=new Set(['draftkings','fanduel','betmgm','betrivers','williamhill_us','fanatics','betparx','ballybet','espnbet']);
const price=p=>Number.isInteger(p)&&Math.abs(p)>=100&&Math.abs(p)<=100000;
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
export function importGitOddsSnapshot(raw,{league,commitSha,capturedAt,license='unverified',rightsVerified=false,source='kevbowl/odds-fetcher'}={}){
 const reject=reason=>({status:'rejected',reason,quotes:[],eligibleSettledTickets:0,promotionAllowed:false});
 if(!['nfl','nhl'].includes(league)||!/^[a-f0-9]{40}$/.test(String(commitSha))||
   !iso(capturedAt)||rightsVerified!==true||license==='unverified'||source!=='kevbowl/odds-fetcher')return reject('unverified_source');
 let events;try{events=typeof raw==='string'?JSON.parse(raw):raw;}catch{return reject('invalid_json');}
 if(!Array.isArray(events))return reject('invalid_snapshot');
 const quotes=[],seen=new Set(),capture=Date.parse(capturedAt);
 for(const event of events){
  if(!event||leagues[event.sport_key]!==league||typeof event.id!=='string'||!event.id||
    !iso(event.commence_time)||Date.parse(event.commence_time)<=capture)continue;
  for(const book of event.bookmakers||[]){
   if(!books.has(book?.key))continue;
   for(const market of book.markets||[]){
    if(market?.key!=='h2h')continue;
    const stamp=market.last_update||book.last_update;
    if(!iso(stamp)||Date.parse(stamp)>capture||capture-Date.parse(stamp)>8*3600000)continue;
    const outcomes=market.outcomes||[];
    // Full-game NHL 2-way moneyline only; no 3-way regulation market.
    if(outcomes.length!==2||!outcomes.every(x=>price(x.price)))continue;
    for(const outcome of outcomes){
     if(![event.home_team,event.away_team].includes(outcome.name))continue;
     const id=[commitSha,event.id,book.key,'h2h',outcome.name].join(':');
     if(seen.has(id))continue;seen.add(id);
     quotes.push({id,league,gameId:event.id,homeTeam:event.home_team,awayTeam:event.away_team,
      start:event.commence_time,selection:outcome.name,odds:outcome.price,
      bookmakerKey:book.key,quotedAt:stamp,source:{repository:source,commitSha,capturedAt,license},
      settlement:null,modelProbability:null});
    }
   }
  }
 }
 return {status:'quotes_only',quotes,quoteCount:quotes.length,eligibleSettledTickets:0,
  promotionAllowed:false,reason:'no_verified_settlement_or_pregame_model_predictions'};
}
export function assessOddsGapSample({license='CC-BY-NC-4.0',commercialUse=true,hasPointInTimeQuotes=false,hasSettlements=false}={}){
 return {source:'theoddsgap/us-sports-betting-odds-sample-week',
  permittedForCommercialImport:license!=='CC-BY-NC-4.0'||commercialUse===false,
  eligibleForTicketBacktest:license!=='CC-BY-NC-4.0'&&hasPointInTimeQuotes&&hasSettlements,
  promotionAllowed:false,reason:license==='CC-BY-NC-4.0'?'noncommercial_license_review_required':'independent_evidence_required'};
}
