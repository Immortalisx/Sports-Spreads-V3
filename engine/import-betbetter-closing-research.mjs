/* Offline research-only adapter for CC BY 4.0 Bet Better closing-price CSVs.
 * Closing no-vig probabilities are NOT sportsbook quotes or model predictions.
 * Never turn these into parlay returns or point-in-time forecasts.
 */
const fields=['date_utc','home_team','away_team','home_no_vig_close_prob','home_won','home_score','away_score','n_books'];
function parseCSV(input){
 if(typeof input!=='string')throw Error('CSV text required');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(cell);cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
export function auditBetBetterClosingCSV(csv,{league,sourceLicense='CC-BY-4.0',sourceDOI}={}){
 const fail=reason=>({status:'rejected',reason,acceptedGames:0,rows:[],eligibleWholeTickets:0,promotionAllowed:false,roi:null});
 if(!['nfl','nhl'].includes(league)||sourceLicense!=='CC-BY-4.0'||!/^10\.(17632|5281)\//.test(String(sourceDOI)))return fail('source_attribution_required');
 let parsed;try{parsed=parseCSV(csv)}catch{return fail('invalid_csv')}
 if(parsed.length<2)return fail('empty_dataset');
 const headers=parsed[0].map(x=>x.trim().replace(/^\uFEFF/,''));
 if(!fields.every(x=>headers.includes(x)))return fail('missing_columns');
 const rows=[];let rejected=0;
 for(const cells of parsed.slice(1)){
  if(cells.length!==headers.length){rejected++;continue}
  const obj=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));
  const p=Number(obj.home_no_vig_close_prob),h=Number(obj.home_score),a=Number(obj.away_score),n=Number(obj.n_books);
  if(!/^20\d\d-\d\d-\d\d/.test(obj.date_utc)||!obj.home_team||!obj.away_team||
   !Number.isFinite(p)||p<=0||p>=1||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||
   !Number.isInteger(n)||n<3||!['0','1'].includes(obj.home_won)||h===a||
   Number(obj.home_won)!==Number(h>a)){rejected++;continue}
  rows.push({league,date:obj.date_utc,homeTeam:obj.home_team,awayTeam:obj.away_team,
   marketClosingHomeProbability:p,homeWon:h>a,homeScore:h,awayScore:a,nBooks:n,
   source:{license:sourceLicense,doi:sourceDOI},quoteTimestamp:null,bookmakerOdds:null,modelProbability:null});
 }
 return {status:'closing_market_benchmark_only',acceptedGames:rows.length,rejectedRows:rejected,rows,
  eligibleWholeTickets:0,promotionAllowed:false,roi:null,
  reason:'no_timestamped_sportsbook_quotes_or_joint_model_predictions'};
}
