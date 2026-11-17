import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/odds-browser.js',import.meta.url),'utf8');
const ctx={Date,URL,URLSearchParams,setTimeout,clearTimeout,AbortController};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const o=ctx.SportsOdds;
const game={id:'400010',league:'nba',status:'scheduled',start:'2026-11-17T23:30:00Z',home:{name:'Toronto Raptors',abbr:'TOR'},away:{name:'New York Knicks',abbr:'NY'}};
const event={id:'odds-1',sport_key:'basketball_nba',home_team:'Toronto Raptors',away_team:'New York Knicks',commence_time:'2026-11-17T23:30:00Z',bookmakers:[{key:'draftkings',title:'DraftKings',last_update:'2026-11-17T18:00:00Z',markets:[{key:'h2h',outcomes:[{name:'New York Knicks',price:-115},{name:'Toronto Raptors',price:+105}]}]}]};
test('verified price format, implied chance and no-vig are consistent',()=>{assert.equal(o.implied(-115),115/215);assert.equal(o.implied(105),100/205);assert.equal(o.implied(30),null);const v=o.fairHomePrice(105,-115);assert.ok(Math.abs(v.home+v.away-1)<1e-12);assert.ok(v.overround>0);});
test('never pair flipped, same-nickname, or far-future game to the wrong sportsbook event',()=>{
 assert.equal(o.matchGame(game,[event]).id,'odds-1');assert.equal(o.matchGame({...game,home:{name:'New York Knicks'},away:{name:'Toronto Raptors'}},[event]),null);
 assert.equal(o.matchGame({...game,start:'2026-11-23T23:30:00Z'},[event]),null);
 assert.equal(o.matchGame(game,[event,event]),null);
 assert.equal(o.matchGame({...game,demo:true},[event]),null);
});
test('match-specific book odds retain timestamp and are never a validated confidence estimate',()=>{
 const r=o.booksForGame(game,{events:[event]});assert.equal(r.matched,true);assert.equal(r.books.length,1);assert.equal(r.books[0].awayPrice,-115);assert.equal(r.books[0].homePrice,105);assert.equal(r.books[0].asOf,'2026-11-17T18:00:00Z');assert.equal(Object.hasOwn(r.books[0],'modelProbability'),false);
});
test('unsupported or absent provider configuration never invents sportsbook odds',async()=>{
 assert.equal((await o.get('nba',game)).status,'not_configured');await assert.rejects(o.get('bad',game),/Invalid matchup|Unsupported/);
});
