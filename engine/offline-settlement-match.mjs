/* Research-only, offline settlement matching. No provider calls.
 * Caller must provide authorized, attributed records; no price or probability fabrication.
 */
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const normalized=x=>typeof x==='string'?x.trim().toLowerCase().replace(/[^a-z0-9]/g,''):'';
const reject=reason=>({status:'unmatched',reason,settlement:null,promotionAllowed:false});
export function matchSettledMoneyline(quote,result){
 if(!quote||!result)return reject('missing_record');
 if(quote.league!=='nfl'&&quote.league!=='nhl')return reject('unsupported_league');
 if(result.league!==quote.league)return reject('league_mismatch');
 if(!quote.source?.rightsVerified||!result.source?.rightsVerified||
    !quote.source?.attribution||!result.source?.attribution)return reject('unverified_reuse_rights');
 if(!validTime(quote.start)||!validTime(quote.quotedAt)||!validTime(result.start)||
    !validTime(result.finalAt)||Date.parse(quote.quotedAt)>=Date.parse(quote.start)||
    Date.parse(result.finalAt)<=Date.parse(result.start))return reject('invalid_chronology');
 if(quote.gameId!==result.gameId||!quote.gameId)return reject('game_id_mismatch');
 if(Math.abs(Date.parse(quote.start)-Date.parse(result.start))>60*60*1000)return reject('start_time_mismatch');
 if(normalized(quote.homeTeam)!==normalized(result.homeTeam)||
    normalized(quote.awayTeam)!==normalized(result.awayTeam)||
    !normalized(quote.homeTeam)||!normalized(quote.awayTeam))return reject('team_mismatch');
 if(!['final','completed'].includes(result.status)||result.overtimeStatus==='unknown'&&quote.league==='nhl')
    return reject('not_final_or_settlement_ambiguous');
 if(!Number.isInteger(result.homeScore)||!Number.isInteger(result.awayScore)||
    result.homeScore<0||result.awayScore<0||result.homeScore===result.awayScore)return reject('invalid_final_score');
 if(!['full_game_including_overtime','full_game_including_overtime_and_shootout'].includes(quote.settlementRule))
    return reject('unverified_market_settlement_rule');
 if(quote.league==='nhl'&&quote.settlementRule!=='full_game_including_overtime_and_shootout')
    return reject('nhl_settlement_rule_ambiguous');
 const selected=normalized(quote.selection),home=normalized(quote.homeTeam),away=normalized(quote.awayTeam);
 if(selected!==home&&selected!==away)return reject('unknown_selection');
 const winner=result.homeScore>result.awayScore?home:away;
 return {status:'matched',reason:'verified_score_only',settlement:{won:selected===winner,
   settledAt:result.finalAt,gameId:quote.gameId,source:result.source},
   promotionAllowed:false,modelProbability:null,roi:null};
}
export function auditSettlementCoverage(quotes,results){
 if(!Array.isArray(quotes)||!Array.isArray(results))return {status:'invalid_input',matched:0,unmatched:0,promotionAllowed:false};
 const byId=new Map(results.filter(x=>x?.gameId).map(x=>[x.gameId,x]));
 const reasons={},matched=[];
 for(const quote of quotes){
  const r=matchSettledMoneyline(quote,byId.get(quote?.gameId));
  if(r.status==='matched')matched.push(r);
  else reasons[r.reason]=(reasons[r.reason]||0)+1;
 }
 return {status:'research_only',quotes:quotes.length,matched:matched.length,
  unmatched:quotes.length-matched.length,reasons,eligibleWholeTickets:0,
  promotionAllowed:false,roi:null};
}
