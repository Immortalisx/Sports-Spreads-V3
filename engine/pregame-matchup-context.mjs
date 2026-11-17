/**
 * Dated NFL coaching and NHL goalie research inputs. These are descriptive,
 * never calibrated betting probabilities. Missing or uncertain starting goalies
 * are not silently treated as confirmed.
 */
const validDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x));
const avg=xs=>xs.reduce((sum,x)=>sum+x,0)/Math.max(1,xs.length);
export function priorCoachMatchups({historicalGames,gameDate,homeCoachId,awayCoachId}){
 if(!Array.isArray(historicalGames)||!validDate(gameDate)||!homeCoachId||!awayCoachId||homeCoachId===awayCoachId)throw Error('Dated coach IDs and game history required');
 const meetings=historicalGames.filter(x=>validDate(x.date)&&x.date<gameDate&&
  [x.homeCoachId,x.awayCoachId].includes(homeCoachId)&&
  [x.homeCoachId,x.awayCoachId].includes(awayCoachId)&&
  (x.homeCoachId===homeCoachId||x.awayCoachId===homeCoachId)&&
  (x.winningCoachId===x.homeCoachId||x.winningCoachId===x.awayCoachId));
 const homeWins=meetings.filter(x=>x.winningCoachId===homeCoachId).length;
 const n=meetings.length;
 return {games:n,homeCoachWins:homeWins,awayCoachWins:n-homeWins,
  previousMeetings:meetings.map(x=>x.date).sort(),
  shrunkHomeShare:(homeWins+4)/(n+8),isCausal:false,
  asOfGameDate:gameDate,modelWeight:null,
  note:'Head-to-head is historical context; scheme, players, tenure and roster changed.'};
}
export function goaliePregameMatchup({gameDate,gameAt,home,away,goalieLogs,minimumStarts=15}){
 if(!validDate(gameDate)||!Number.isFinite(Date.parse(gameAt||''))||gameAt.slice(0,10)<gameDate||!Array.isArray(goalieLogs)||![home,away].every(x=>x&&x.goalkeeperId&&x.teamId))throw Error('Named NHL teams and goalies required');
 const evaluate=x=>{
  const source=x.confirmation;
  const confirmationValid=source&&source.status==='confirmed'&&
   source.goalkeeperId===x.goalkeeperId&&
   typeof source.asOf==='string'&&Number.isFinite(Date.parse(source.asOf))&&
   Date.parse(source.asOf)<Date.parse(gameAt)&&
   typeof source.url==='string'&&/^https:\/\//.test(source.url);
  if(!confirmationValid)return {goalkeeperId:x.goalkeeperId,status:'not_confirmed',gsaxPer60:null,starts:0};
  const past=goalieLogs.filter(l=>l.goalkeeperId===x.goalkeeperId&&validDate(l.gameDate)&&l.gameDate<gameDate&&
   Number.isFinite(l.gsax)&&Number.isFinite(l.minutes)&&l.minutes>0&&l.minutes<=120);
  // Day before kickoff only, and actual prior goalie appearances not future starts.
  if(past.length<minimumStarts)return {goalkeeperId:x.goalkeeperId,status:'insufficient_goaltender_sample',gsaxPer60:null,starts:past.length};
  const ga=past.reduce((sum,l)=>sum+l.gsax,0),minutes=past.reduce((sum,l)=>sum+l.minutes,0);
  return {goalkeeperId:x.goalkeeperId,status:'sourced_research',starts:past.length,
   gsaxPer60:ga*60/minutes,lastGame:past.map(x=>x.gameDate).sort().at(-1),
   sourceUrl:source.url,licenseStatus:x.licenseStatus||'review_required'};
 };
 const h=evaluate(home),a=evaluate(away);
 return {league:'nhl',gameDate,home:h,away:a,
  gsaxAdvantagePer60:h.gsaxPer60!==null&&a.gsaxPer60!==null?h.gsaxPer60-a.gsaxPer60:null,
  appliedToWinProbability:false,modelValidated:false,
  warning:'Goalie confirmation and game-level GSAx sources require separate permission and independently tested weights.'};
}
