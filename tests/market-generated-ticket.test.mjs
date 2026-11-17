import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const oddsSrc=readFileSync(new URL('../public/odds-browser.js',import.meta.url),'utf8');
const ticketSrc=readFileSync(new URL('../public/auto-ticket.js',import.meta.url),'utf8');
const oddsContext={};vm.runInNewContext(oddsSrc,oddsContext);
const ticketContext={};vm.runInNewContext(ticketSrc,ticketContext);
const odds=oddsContext.SportsOdds, tickets=ticketContext.SportsAutoTicket;
const future=new Date(Date.now()+3*3600_000).toISOString(),fresh=new Date(Date.now()-60_000).toISOString();
function game(){return {id:'g1',league:'nba',start:future,status:'scheduled',home:{name:'Toronto Raptors',abbr:'TOR'},away:{name:'New York Knicks',abbr:'NYK'}};}
function snap(){return {status:'cached',asOf:fresh,events:[{id:'odds1',sport_key:'basketball_nba',commence_time:future,home_team:'Toronto Raptors',away_team:'New York Knicks',bookmakers:[
 {key:'fan',title:'FanDuel',last_update:fresh,markets:[{key:'h2h',outcomes:[{name:'New York Knicks',price:-176},{name:'Toronto Raptors',price:148}]}]},
 {key:'book2',title:'Book 2',last_update:fresh,markets:[{key:'h2h',outcomes:[{name:'New York Knicks',price:-170},{name:'Toronto Raptors',price:145}]}]}
 ]}]};}
test('Sportsbook consensus is calculated from actual no-vig book quotes',()=>{
 const m=odds.marketConsensus(game(),snap());
 assert.equal(m.bookCount,2);
 const fair=odds.fairHomePrice(148,-176);
 assert.ok(Math.abs(m.homeProbability-fair.home)<0.02);
 assert.equal(m.bestHome.homePrice,148);
 assert.equal(m.bestAway.awayPrice,-170);
 assert.equal(odds.marketConsensus({...game(),home:{name:'Invalid team'}},snap()),null);
});
test('Market auto-ticket uses sourced odds, future games, unique matches, never labels model validated',()=>{
 const m=odds.marketConsensus(game(),snap());
 const c=[
 {league:'nba',market:'Moneyline',gameId:'g1',start:future,teamName:'New York Knicks',probability:m.awayProbability,odds:m.bestAway.awayPrice,bookmaker:m.bestAway.title,oddsAsOf:fresh},
 {league:'nba',market:'Moneyline',gameId:'g1',start:future,teamName:'Toronto Raptors',probability:m.homeProbability,odds:m.bestHome.homePrice,bookmaker:m.bestHome.title,oddsAsOf:fresh}
 ];
 const r=tickets.buildMarket(c,{target:50,maxLegs:2});
 assert.equal(r.ok,true);assert.equal(r.legs.length,1);
 assert.equal(r.legs[0].modelValidated,false);
 assert.equal(typeof r.legs[0].marketImpliedProbability,'number');
 assert.equal(tickets.ticketConfidence(r.legs),null);
 assert.equal(tickets.buildMarket(c,{target:95}).ok,false);
 assert.equal(tickets.buildMarket(c.map(x=>({...x,oddsAsOf:new Date(Date.now()-9*3600_000).toISOString()})),{target:50}).ok,false);
});
test('Cached board reads cannot trigger credit-spending POST upstream',()=>{
 assert.match(oddsSrc,/mode:'board'/);
 assert.match(oddsSrc,/getBoard/);
 assert.doesNotMatch(oddsSrc,/method:\s*'POST'/);
});


test('auto builder never joins quotes from separate sportsbook accounts into one payout',()=>{
 const now=Date.now(),future=new Date(now+2*3600_000).toISOString(),fresh=new Date(now-120_000).toISOString();
 const base={league:'nba',market:'Moneyline',start:future,teamName:'Home Team',probability:.73,odds:-220,oddsAsOf:fresh};
 const across=tickets.buildMarket([{...base,gameId:'g1',bookmaker:'Book A'},{...base,gameId:'g2',bookmaker:'Book B'}],{target:70,maxLegs:2,now});
 assert.equal(across.ok,true);assert.equal(across.legs.length,1);
 const same=tickets.buildMarket([{...base,gameId:'g1',bookmaker:'Book A'},{...base,gameId:'g2',bookmaker:'Book A'}],{target:70,maxLegs:2,now});
 assert.equal(same.ok,true);assert.equal(same.legs.length,2);
 assert.equal(new Set(same.legs.map(l=>l.bookmaker)).size,1);
});
