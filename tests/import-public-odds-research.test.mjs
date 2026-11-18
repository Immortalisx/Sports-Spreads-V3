import test from 'node:test';
import assert from 'node:assert/strict';
import {importGitOddsSnapshot,assessOddsGapSample} from '../engine/import-public-odds-research.mjs';
const args={league:'nfl',commitSha:'a'.repeat(40),capturedAt:'2026-11-18T18:00:00Z',license:'MIT',rightsVerified:true};
const event={id:'g1',sport_key:'americanfootball_nfl',commence_time:'2026-11-18T22:00:00Z',
 home_team:'Home',away_team:'Away',bookmakers:[{key:'draftkings',last_update:'2026-11-18T17:55:00Z',
 markets:[{key:'h2h',outcomes:[{name:'Home',price:-120},{name:'Away',price:110}]}]}]};
test('offline Git snapshot preserves attributable pregame prices but no fabricated outcomes',()=>{
 const r=importGitOddsSnapshot([event],args);
 assert.equal(r.status,'quotes_only');assert.equal(r.quoteCount,2);
 assert.equal(r.eligibleSettledTickets,0);assert.equal(r.promotionAllowed,false);
 assert.equal(r.quotes[0].settlement,null);assert.equal(r.quotes[0].modelProbability,null);
 assert.equal(r.quotes[0].source.commitSha,args.commitSha);
});
test('source, quote chronology, unsupported markets and NHL three-way fail closed',()=>{
 assert.equal(importGitOddsSnapshot([event],{...args,commitSha:'bad'}).status,'rejected');
 assert.equal(importGitOddsSnapshot([event],{...args,capturedAt:'invalid'}).status,'rejected');
 assert.equal(importGitOddsSnapshot([event],{...args,license:'unverified'}).status,'rejected');
 assert.equal(importGitOddsSnapshot([event],{...args,rightsVerified:false}).status,'rejected');
 assert.equal(importGitOddsSnapshot([{...event,commence_time:'2026-11-18T17:00:00Z'}],args).quoteCount,0);
 assert.equal(importGitOddsSnapshot([{...event,bookmakers:[{...event.bookmakers[0],last_update:'2026-11-18T18:05:00Z'}]}],args).quoteCount,0);
 const nhl={...event,sport_key:'icehockey_nhl',bookmakers:[{...event.bookmakers[0],markets:[{key:'h2h',outcomes:[...event.bookmakers[0].markets[0].outcomes,{name:'Draw',price:250}]}]}]};
 assert.equal(importGitOddsSnapshot([nhl],{...args,league:'nhl'}).quoteCount,0);
});
test('Odds Gap noncommercial license cannot be silently approved for commercial imports',()=>{
 const r=assessOddsGapSample({hasPointInTimeQuotes:true,hasSettlements:true});
 assert.equal(r.permittedForCommercialImport,false);assert.equal(r.eligibleForTicketBacktest,false);
 assert.equal(r.promotionAllowed,false);
});
