async function loadPregameSignals(game){
 if(!game||game.league!=='mlb'||game.demo||state.signalsLoading[game.id])return;
 state.signalsLoading[game.id]=true;render();
 try{state.signals[game.id]=await SportsSignals.get(game);}
 catch(e){state.signals[game.id]={status:'unavailable',note:e?.message||'Official signal feed unavailable'};}
 finally{state.signalsLoading[game.id]=false;render();}
}
async function loadSportsbookOdds(game){
 if(!game||game.demo||game.status!=='scheduled'||!globalThis.SportsOdds)return;
 const league=game.league;
 if(state.oddsLoading[league])return;
 if(state.odds[league]&&Date.now()-Date.parse(state.odds[league].asOf||'')<5*60*1000)return;
 state.oddsLoading[league]=true;state.oddsError[league]='';render();
 try{state.odds[league]=await SportsOdds.getBoard(league);}
 catch(e){state.oddsError[league]=e?.message||'Cached sportsbook quotes unavailable';}
 finally{state.oddsLoading[league]=false;render();}
}
function useSportsbookQuote(game,side,index){
 if(!game||game.demo||game.status!=='scheduled')return;
 const snap=state.odds[game.league];
 if(!snap||!['ok','cached'].includes(snap.status)||!Number.isFinite(Date.parse(snap.asOf))||Date.now()-Date.parse(snap.asOf)>8*60*60*1000)return;
 const match=SportsOdds.booksForGame(game,snap),book=match.books[Number(index)];
 if(!match.matched||!Number.isInteger(Number(index))||!book)return;
 const team=game[side],price=side==='home'?book.homePrice:side==='away'?book.awayPrice:null;
 if(!team||!SportsOdds.validPrice(price))return;
 // Copy quoted price to draft; NEVER auto-submit and NEVER claim a wager was placed.
 state.draft={league:game.league,market:'Moneyline',selection:team.name+' to win',odds:String(price),gameId:game.id,bookmaker:book.title,bookmakerKey:book.key,oddsAsOf:book.asOf};
 state.section='tickets';state.drawer=null;render();notify('Cached bookmaker quote copied. Recheck the live price before placing any wager.');
}
