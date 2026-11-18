/* One-hour pregame parlay gate. Pure, deterministic and provider-credit free.
 * Never infer joint probability by multiplying correlated same-game legs.
 * A calibrated, prospective-validated joint model must supply it.
 */
const validPrice=p=>Number.isInteger(p)&&((p>=100&&p<=100000)||(p<=-100&&p>=-100000));
const decimal=p=>p>0?1+p/100:1+100/-p;
const isISO=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const allowedMarkets=new Set(['h2h','spread','total','player_pass_yds','player_rush_yds','player_rec_yds','player_receptions','player_anytime_td','player_points','player_assists','player_rebounds','player_shots','player_goals']);
const finiteProbability=p=>typeof p==='number'&&Number.isFinite(p)&&p>0&&p<1;
export function evaluatePregameParlay(game,offers,{now=new Date(),model=null}={}){
 const t=now instanceof Date?now.getTime():NaN;
 const start=Date.parse(game?.start||'');
 const minutes=(start-t)/60000;
 const base={gameId:String(game?.id||''),status:'PASS',legs:[],reason:'not_eligible'};
 if(!Number.isFinite(t)||!Number.isFinite(start)||!game?.id||!['nfl','nhl','nba','mlb'].includes(game?.league))return base;
 if(minutes<=0||minutes>60)return {...base,reason:'outside_final_hour'};
 if(!Array.isArray(offers)||offers.length<2)return {...base,reason:'insufficient_priced_legs'};
 const legs=offers.filter(x=>x&&x.gameId===game.id&&typeof x.bookmakerKey==='string'&&x.bookmakerKey.length>0&&
  allowedMarkets.has(x.market)&&validPrice(x.price)&&isISO(x.asOf)&&t-Date.parse(x.asOf)>=0&&t-Date.parse(x.asOf)<=15*60000&&
  typeof x.selection==='string'&&x.selection.length>0&&x.selection.length<=180&&
  (x.market.startsWith('player_')?typeof x.playerId==='string'&&x.playerId.length>0:true));
 if(legs.length<2)return {...base,reason:'missing_fresh_quoted_props'};
 if(!model||model.calibrated!==true||model.prospectiveValidated!==true||model.gameId!==game.id||
   !isISO(model.asOf)||t-Date.parse(model.asOf)<0||t-Date.parse(model.asOf)>15*60000)
  return {...base,reason:'joint_model_unvalidated'};
 const eligible=[];
 for(const ticket of model.tickets||[]){
  if(!Array.isArray(ticket.legIds)||ticket.legIds.length<2||ticket.legIds.length>6||
    new Set(ticket.legIds).size!==ticket.legIds.length||!finiteProbability(ticket.jointProbability))continue;
  const selected=ticket.legIds.map(id=>legs.find(l=>l.id===id));
  if(selected.some(x=>!x)||new Set(selected.map(x=>x.bookmakerKey)).size!==1)continue;
  if(new Set(selected.map(x=>x.market+'|'+x.selection)).size!==selected.length)continue;
  const payout=selected.reduce((p,x)=>p*decimal(x.price),1);
  const edge=ticket.jointProbability*payout-1;
  if(!Number.isFinite(edge)||edge<.05)continue;
  eligible.push({status:'READY',gameId:game.id,bookmakerKey:selected[0].bookmakerKey,
   legs:selected.map(x=>({id:x.id,market:x.market,selection:x.selection,price:x.price,playerId:x.playerId||null})),
   jointProbability:ticket.jointProbability,expectedValue:edge,payoutMultiplier:payout,
   modelVersion:String(model.version||''),modelAsOf:model.asOf,oddsAsOf:selected.reduce((s,x)=>s>x.asOf?x.asOf:s,selected[0].asOf)});
 }
 eligible.sort((a,b)=>b.expectedValue-a.expectedValue||b.jointProbability-a.jointProbability);
 return eligible[0]||{...base,reason:'no_qualified_positive_edge'};
}
