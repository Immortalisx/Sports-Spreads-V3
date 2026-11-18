/* Pure, no-network plan for a future private, opt-in event-prop collector.
 * Each event-market/region query can cost credits. This module NEVER calls a provider.
 */
const keys={nfl:['player_pass_yds','player_rush_yds','player_rec_yds','player_anytime_td'],nba:['player_points','player_rebounds','player_assists'],nhl:['player_shots','player_goals'],mlb:[]};
const sport={nfl:'americanfootball_nfl',nba:'basketball_nba',nhl:'icehockey_nhl',mlb:'baseball_mlb'};
export function planPregamePropRefresh(cache,{now=new Date(),monthlyRemaining=0,maxCreditsPerRun=0,enabled=false}={}){
 const time=now instanceof Date?now.getTime():NaN;
 const base={status:'disabled',estimatedCredits:0,requests:[],reason:'explicit_opt_in_required'};
 if(!enabled)return base;
 if(!Number.isFinite(time))return {...base,status:'blocked',reason:'invalid_clock'};
 if(!Number.isSafeInteger(monthlyRemaining)||monthlyRemaining<0||!Number.isSafeInteger(maxCreditsPerRun)||maxCreditsPerRun<0)return {...base,status:'blocked',reason:'invalid_budget'};
 const seen=new Set(),requests=[];
 for(const row of Array.isArray(cache)?cache:[]){
  if(!sport[row?.league]||!keys[row.league].length)continue;
  const fetched=Date.parse(row.fetched_at||'');
  if(!Number.isFinite(fetched)||time-fetched<0||time-fetched>8*3600000)continue;
  for(const event of row.snapshot?.events||[]){
   const start=Date.parse(event?.commence_time||'');
   const minutes=(start-time)/60000;
   if(!Number.isFinite(minutes)||minutes<=0||minutes>60||! /^[a-f0-9]{32}$/i.test(event?.id||''))continue;
   const identity=row.league+'|'+event.id;
   if(seen.has(identity))continue;
   seen.add(identity);
   requests.push({league:row.league,sportKey:sport[row.league],eventId:event.id,markets:keys[row.league],regions:['us'],estimatedCredits:keys[row.league].length,minutesToStart:Math.ceil(minutes)});
  }
 }
 requests.sort((a,b)=>a.minutesToStart-b.minutesToStart||a.eventId.localeCompare(b.eventId));
 const total=requests.reduce((sum,r)=>sum+r.estimatedCredits,0);
 if(!requests.length)return {...base,status:'empty',reason:'no_final_hour_games'};
 if(total>monthlyRemaining||total>maxCreditsPerRun)return {...base,status:'blocked',reason:'budget_exceeded',estimatedCredits:total,requests:[]};
 return {status:'planned',estimatedCredits:total,requests,reason:'owner_only_not_executed'};
}
