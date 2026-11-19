/* Smart Ticket Engine V2 — research only. No provider calls, no deployment,
 * no live model promotion, and no fabricated ticket confidence.
 */
const validP=p=>typeof p==='number'&&Number.isFinite(p)&&p>0&&p<1;
const validPrice=p=>Number.isInteger(p)&&Math.abs(p)>=100&&Math.abs(p)<=100000;
const decimal=p=>p>0?1+p/100:1+100/-p;
const fresh=(asOf,now,maxAgeMs)=>typeof asOf==='string'&&Number.isFinite(Date.parse(asOf))&&now-Date.parse(asOf)>=0&&now-Date.parse(asOf)<=maxAgeMs;
const norm=s=>String(s||'').trim().toLowerCase();
export const SMART_TICKET_RESEARCH_VERSION='smart-ticket-v2-research-1';
export function confidenceGrade(evidence,{now=new Date()}={}){
 const t=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(t)||!evidence||evidence.prospectiveValidated!==true||
   evidence.calibrated!==true||!validP(evidence.probability)||
   !Number.isInteger(evidence.holdoutCount)||evidence.holdoutCount<200||
   !Number.isInteger(evidence.calibrationBins)||evidence.calibrationBins<5||
   typeof evidence.ece!=='number'||!Number.isFinite(evidence.ece)||evidence.ece<0||evidence.ece>.05||
   !fresh(evidence.asOf,t,24*3600_000)||!evidence.pointInTimeVerified)
  return {grade:null,status:'unvalidated',reason:'insufficient_independent_calibration'};
 // Grades are conservative evidence-quality categories, not odds of winning.
 const grade=evidence.ece<=.015&&evidence.holdoutCount>=1000?'A':
   evidence.ece<=.025&&evidence.holdoutCount>=500?'B':
   evidence.ece<=.04?'C':'D';
 return {grade,status:'validated_evidence_quality',reason:'independent_holdout_calibration'};
}
export function auditTicket(ticket,{now=new Date(),evidence=null}={}){
 const t=now instanceof Date?now.getTime():NaN;
 const reject=reason=>({eligible:false,reason,confidence:{grade:null,status:'unvalidated'}});
 if(!Number.isFinite(t)||!Array.isArray(ticket?.legs)||ticket.legs.length<2||ticket.legs.length>8)
  return reject('invalid_ticket');
 const games=new Set(),teams=new Set(),legIds=new Set(),books=new Set();
 let multiplier=1;
 for(const leg of ticket.legs){
  if(!leg||!leg.gameId||!leg.id||!leg.bookmakerKey||!validPrice(leg.odds)||
    !fresh(leg.oddsAsOf,t,15*60000)||!Number.isFinite(Date.parse(leg.start))||Date.parse(leg.start)<=t)
   return reject('invalid_or_stale_quote');
  if(legIds.has(leg.id))return reject('duplicate_leg');
  legIds.add(leg.id);books.add(leg.bookmakerKey);
  // No same-game ticket without a separate, validated joint model and executable SGP quote.
  if(games.has(leg.gameId))return reject('correlated_same_game');
  games.add(leg.gameId);
  const involved=[norm(leg.homeTeam),norm(leg.awayTeam)].filter(Boolean);
  if(involved.some(x=>teams.has(x)))return reject('shared_team_exposure');
  involved.forEach(x=>teams.add(x));
  multiplier*=decimal(leg.odds);
 }
 if(books.size!==1)return reject('mixed_bookmaker');
 if(!Number.isFinite(multiplier))return reject('invalid_payout');
 const grade=confidenceGrade(evidence,{now});
 return {eligible:true,reason:'research_only',payoutMultiplier:multiplier,
   returnAt10:Math.round(multiplier*1000)/100,profitAt10:Math.round((multiplier-1)*1000)/100,
   confidence:grade,rankingEligible:grade.status==='validated_evidence_quality'};
}
export function rankResearchTickets(tickets,{now=new Date(),evidenceById={}}={}){
 if(!Array.isArray(tickets))throw Error('Expected ticket array');
 return tickets.map(ticket=>({id:ticket?.id,audit:auditTicket(ticket,{now,evidence:evidenceById[ticket?.id]})}))
  .sort((a,b)=>Number(b.audit.rankingEligible)-Number(a.audit.rankingEligible)||
    Number(b.audit.eligible)-Number(a.audit.eligible)||String(a.id).localeCompare(String(b.id)));
}
/* Whole-ticket chronological backtest. Each historical row must carry a quoted
 * ticket, known outcome, and independently timestamped pregame evidence.
 * Refuse to compute return metrics from missing, postgame or unverified quotes.
 */
export function backtestWholeTickets(rows,{stake=10}={}){
 if(!Array.isArray(rows)||!rows.length||!Number.isFinite(stake)||stake<=0)
  return {status:'insufficient_data',n:0};
 const ids=new Set();let wins=0,totalReturn=0,loss=0,calibrationSum=0;
 for(const row of rows){
  if(!row||!row.id||ids.has(row.id)||!Number.isFinite(Date.parse(row.start))||
    !Number.isFinite(Date.parse(row.quotedAt))||Date.parse(row.quotedAt)>=Date.parse(row.start)||
    row.pointInTimeVerified!==true||row.settled!==true||typeof row.won!=='boolean'||
    !Number.isFinite(row.payoutMultiplier)||row.payoutMultiplier<=1||
    !validP(row.predictedJointProbability)||row.independentHoldout!==true)
   return {status:'insufficient_data',n:0,reason:'missing_or_leaky_ticket_history'};
  ids.add(row.id);wins+=Number(row.won);
  totalReturn+=row.won?stake*row.payoutMultiplier:0;
  loss+=(row.predictedJointProbability-Number(row.won))**2;
  calibrationSum+=row.predictedJointProbability;
 }
 return {status:'research_only',n:rows.length,winRate:wins/rows.length,
  roi:(totalReturn-stake*rows.length)/(stake*rows.length),
  brier:loss/rows.length,meanPredictedJointProbability:calibrationSum/rows.length,
  promotionAllowed:false};
}
