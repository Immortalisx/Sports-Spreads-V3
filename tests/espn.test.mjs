import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent,normalizeRoster,normalizeInjuries,normalizeNews,americanToDecimal,ticketEstimate,leagueConfig,UpstreamError} from '../lib/espn.mjs';
test('only supported leagues are accepted',()=>{assert.equal(leagueConfig('nhl').sport,'hockey');assert.throws(()=>leagueConfig('soccer'),UpstreamError);});
test('normalizes scheduled game without inventing scores or forecasts',()=>{
 const evt=normalizeEvent({id:'123',date:'2026-11-18T00:30:00Z',competitions:[{competitors:[{homeAway:'home',team:{id:'28',displayName:'Toronto Raptors',abbreviation:'TOR'}},{homeAway:'away',team:{id:'18',displayName:'New York Knicks',abbreviation:'NY'}}]}],status:{type:{state:'pre',shortDetail:'7:30 PM EST'}}},'nba');
 assert.equal(evt.home.name,'Toronto Raptors');assert.equal(evt.away.name,'New York Knicks');assert.equal(evt.home.score,null);assert.equal(evt.model,null);assert.equal(evt.status,'scheduled');
});
test('normalizes multiple roster groups',()=>{
 const players=normalizeRoster({athletes:[{position:'G',items:[{id:'77',displayName:'Test Person',position:{abbreviation:'PG'},jersey:'7'}]},{position:'C',items:[{id:'88',displayName:'Other Person'}]}]});
 assert.equal(players.length,2);assert.equal(players[0].position,'PG');
});
test('filters injuries by team',()=>{
 const injuries=normalizeInjuries({teams:[{id:'2',injuries:[{athlete:{id:'1',displayName:'A'},status:'Out'}]},{id:'3',injuries:[{athlete:{id:'2',displayName:'B'},status:'Out'}]}]},'2');
 assert.equal(injuries.length,1);assert.equal(injuries[0].name,'A');
});
test('news labels league-wide fallback accurately',()=>{
 const out=normalizeNews({articles:[{headline:'A league-level update',links:{web:{href:'https://espn.com'}}}]},{name:'Toronto Raptors'});
 assert.equal(out.scope,'league-wide');assert.equal(out.articles.length,1);
});
test('rejects malformed odds and computes only stated payout',()=>{
 assert.equal(americanToDecimal(-110).toFixed(5),'1.90909');
 assert.equal(americanToDecimal(90),null);assert.equal(americanToDecimal('abc'),null);
 assert.equal(ticketEstimate([{odds:+100},{odds:-100}],10).return,40);
 assert.equal(ticketEstimate([{odds:1}],10),null);
});

test('maps current ESPN grouped injuries shape rather than silently returning none',()=>{
 const data={injuries:[{id:'28',injuries:[{athlete:{id:'1',displayName:'Example Guard'},status:'Out'}]},{id:'5',injuries:[{athlete:{id:'2',displayName:'Other'},status:'Questionable'}]}]};
 const injuries=normalizeInjuries(data,'28');
 assert.equal(injuries.length,1);
 assert.equal(injuries[0].name,'Example Guard');
});
