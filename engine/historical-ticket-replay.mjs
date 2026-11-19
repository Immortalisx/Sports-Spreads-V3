/* Point-in-time whole-ticket replay, research only.
 * Input: explicitly attributed cached historical quotes and independently
 * recorded settlement. No network, model promotion or provider API calls.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const parse=s=>typeof s==='string'?Date.parse(s):NaN;
const decimal=p=>p>0?1+p/100:1+100/-p;
const price=p=>Number.isInteger(p)&&((p>=100&&p<=100000)||(p<=-100&&p>=-100000));
export function validateHistoricalTicket(row){
 const reject=reason=>({valid:false,reason});
 if(!row||typeof row.id!=='string'||!row.id||!['nfl','nhl','nba','mlb'].includes(row.league))
  return reject('invalid_identity');
 if(!row.source||typeof row.source.provider!=='string'||!row.source.provider.trim()||
   typeof row.source.snapshotId!=='string'||!row.source.snapshotId.trim()||
   row.source.attributed!==true)return reject('unattributed_snapshot');
 const start=parse(row.start),quoted=parse(row.quotedAt),settled=parse(row.settledAt);
 if(![start,quoted,settled].every(Number.isFinite)||quoted>=start||settled<=start)
  return reject('chronology_violation');
 if(row.pointInTimeVerified!==true||row.independentHoldout!==true)
  return reject('unverified_holdout');
 if(!Array.isArray(row.legs)||row.legs.length<2||row.legs.length>8)
  return reject('invalid_legs');
 const ids=new Set(),games=new Set(),teams=new Set(),books=new Set();let payout=1;
 for(const leg of row.legs){
  if(!leg||typeof leg.id!=='string'||!leg.id||ids.has(leg.id)||
   typeof leg.gameId!=='string'||!leg.gameId||games.has(leg.gameId)||
   typeof leg.bookmakerKey!=='string'||!leg.bookmakerKey||!price(leg.odds)||
   !Number.isFinite(parse(leg.quotedAt))||parse(leg.quotedAt)>quoted||
   typeof leg.won!=='boolean')return reject('invalid_leg_or_correlated_game');
  ids.add(leg.id);games.add(leg.gameId);books.add(leg.bookmakerKey);
  for(const team of [leg.homeTeam,leg.awayTeam]){
   const normalized=String(team||'').trim().toLowerCase();
   if(normalized&&teams.has(normalized))return reject('shared_team_exposure');
   if(normalized)teams.add(normalized);
  }
  payout*=decimal(leg.odds);
 }
 if(books.size!==1)return reject('mixed_bookmaker');
 if(!finite(row.payoutMultiplier)||Math.abs(row.payoutMultiplier-payout)>1e-8)
  return reject('unverified_payout');
 if(typeof row.won!=='boolean'||row.won!==row.legs.every(x=>x.won))
  return reject('settlement_mismatch');
 if(!finite(row.predictedJointProbability)||row.predictedJointProbability<=0||row.predictedJointProbability>=1||
   !Number.isFinite(parse(row.modelAsOf))||parse(row.modelAsOf)>quoted||
   parse(row.modelAsOf)>=start)return reject('leaky_or_missing_prediction');
 return {valid:true,payoutMultiplier:payout};
}
export function replayHistoricalTickets(rows,{stake=10,minHoldout=200}={}){
 const insufficient=reason=>({status:'insufficient_data',reason,n:0,promotionAllowed:false});
 if(!Array.isArray(rows)||!rows.length||!finite(stake)||stake<=0||
  !Number.isInteger(minHoldout)||minHoldout<1)return insufficient('invalid_input');
 const ids=new Set(),ordered=[...rows].sort((a,b)=>parse(a?.start)-parse(b?.start));
 let gross=0,wins=0,brier=0;
 const bins=Array.from({length:10},()=>({n:0,expected:0,observed:0}));
 for(const row of ordered){
  const v=validateHistoricalTicket(row);
  if(!v.valid)return insufficient(v.reason);
  if(ids.has(row.id))return insufficient('duplicate_ticket');
  ids.add(row.id);
  const y=Number(row.won),p=row.predictedJointProbability;
  wins+=y;gross+=y*stake*v.payoutMultiplier;brier+=(p-y)**2;
  const bin=bins[Math.min(9,Math.floor(p*10))];bin.n++;bin.expected+=p;bin.observed+=y;
 }
 const n=ordered.length;
 const ece=bins.reduce((sum,b)=>b.n?sum+(b.n/n)*Math.abs(b.expected/b.n-b.observed/b.n):sum,0);
 const report={status:n>=minHoldout?'research_only':'insufficient_data',
  reason:n>=minHoldout?'offline_historical_holdout':'holdout_below_minimum',
  n,wins,winRate:wins/n,roi:(gross-stake*n)/(stake*n),brier:brier/n,ece,
  stake,totalStaked:stake*n,grossReturn:gross,promotionAllowed:false,
  disclaimer:'Historical research only; no transaction costs, limits or prospective profitability validation.'};
 return report;
}
