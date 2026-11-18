import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ctx={};ctx.globalThis=ctx;
vm.runInNewContext(readFileSync(new URL('../public/auto-ticket.js',import.meta.url),'utf8'),ctx);
const engine=ctx.SportsAutoTicket;
const now=Date.parse('2026-11-17T20:00:00.000Z');
const good={league:'nba',market:'Moneyline',gameId:'111',start:'2026-11-17T23:30:00Z',teamName:'Boston Celtics',modelValidated:true,modelVersion:'validated-v1',probability:.78,odds:+120,bookmaker:'Verified Sportsbook',oddsAsOf:'2026-11-17T19:58:00Z'};
test('confidence target only chooses independently validated and fresh sourced prices',()=>{
 const r=engine.build([good],{target:75,now});assert.equal(r.ok,true);assert.equal(r.legs.length,1);assert.equal(r.legs[0].modelValidated,true);
 assert.equal(r.legs[0].odds,120);assert.equal(engine.grade(90),'A+');
});
test('rejects unvalidated estimates, stale quotes and selections without positive expected margin',()=>{
 assert.equal(engine.build([{...good,modelValidated:false}],{target:75,now}).ok,false);
 assert.equal(engine.build([{...good,oddsAsOf:'2026-11-17T18:00:00Z'}],{target:75,now}).ok,false);
 assert.equal(engine.build([{...good,odds:-600}],{target:75,now}).ok,false);
 assert.equal(engine.build([{...good,probability:.61}],{target:75,now}).ok,false);
});
test('enforces one leg per event and never computes independent joint confidence as model truth',()=>{
 const r=engine.build([good,{...good,teamName:'New York Knicks',probability:.91,odds:-120}],{target:75,now,maxLegs:3});
 assert.equal(r.ok,true);assert.equal(r.legs.length,1);
 assert.equal(engine.ticketConfidence([r.legs[0]]),r.legs[0].modelConfidence);
 assert.equal(engine.ticketConfidence([r.legs[0],r.legs[0]]),null);
});
test('rejects invalid targets and suspicious quotes',()=>{
 assert.throws(()=>engine.build([],{target:98}),/target/);
 assert.equal(engine.eligible({...good,odds:99},now),false);
 assert.equal(engine.eligible({...good,start:'2026-11-17T19:00:00Z'},now),false);
});
test('published UI has a market-derived slider with no fake confidence claim',()=>{
 const html=readFileSync(new URL('../release/index.html',import.meta.url),'utf8');
 assert.match(html,/id="auto-confidence"/);
 assert.match(html,/data-action="generate-ticket"/);
 assert.match(html,/sportsbook-odds/);
 assert.match(html,/bookmaker-implied chance/i);
 assert.match(html,/quick pick/i);
 assert.match(html,/not model confidence/i);
 assert.doesNotMatch(html,/THE_ODDS_API_KEY|SPORTS_SPREADS_REFRESH_TOKEN|sb_secret_/);
});
