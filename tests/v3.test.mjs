import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const scope={URL,Date,state:{ticket:[],league:'nba',section:'games',drawer:null},SAMPLE:null,window:{},esc:x=>String(x)};
vm.createContext(scope);
const part=script.slice(script.indexOf('// Browser-side read-only fallback'),script.indexOf('function getTodayET()'));
vm.runInContext(part+'\nthis.api={mapDirectEvent,directSportsData,mapDirectTeam};',scope);
const {mapDirectEvent,directSportsData}=scope.api;
test('normalizes an ESPN game without claiming model predictions or real betting prices',()=>{
 const result=mapDirectEvent({id:'123',date:'2026-11-17T21:00:00Z',competitions:[{competitors:[{homeAway:'away',team:{id:'2',displayName:'A',abbreviation:'AAA'}},{homeAway:'home',team:{id:'1',displayName:'B',abbreviation:'BBB'}}]}],status:{type:{state:'pre'}}},'nba');
 assert.equal(result.home.name,'B');assert.equal(result.away.name,'A');assert.equal(result.model,null);assert.equal(result.marketLine,null);
 assert.equal(result.status,'scheduled');assert.equal(result.demo,false);
});
test('direct browser scoreboard maps team data from sample provider response',async()=>{
 scope.fetch=async url=>({ok:true,json:async()=>({events:[{id:'99',date:'2026-11-18T01:00Z',competitions:[{competitors:[{homeAway:'home',team:{id:'1',displayName:'Home'}},{homeAway:'away',team:{id:'2',displayName:'Away'}}]}],status:{type:{state:'in'}}}]})});
 scope.AbortController=AbortController;
 scope.setTimeout=setTimeout;scope.clearTimeout=clearTimeout;
 const data=await directSportsData('/api/scoreboard?league=nba&date=20261117');
 assert.equal(data.games.length,1);assert.equal(data.games[0].status,'live');assert.equal(data.games[0].league,'nba');assert.match(data.source,/unofficial/);
});
test('sport-specific markets do not show unrelated props',()=>{
 const m=/const MARKETS=(\{[^;]+\});/.exec(script);assert.ok(m);
 const list=vm.runInNewContext('('+m[1]+')');
 assert.ok(list.nhl.includes('Shots on goal'));
 assert.ok(!list.nhl.includes('Player yards'));
 assert.ok(list.nba.includes('Player points'));
 assert.ok(!list.nba.includes('Touchdowns'));
});
test('v3 has a floating ticket launcher on browse screens',()=>{
 const frag=script.slice(script.indexOf('function ticketDock(){'),script.indexOf('function render(){'));
 const ctx={state:{section:'games',drawer:null,ticket:[]},calcTicket:()=>null,americanCombined:()=>'',esc:x=>x};
 vm.createContext(ctx);vm.runInContext(frag+'\nthis.dock=ticketDock;',ctx);
 assert.match(ctx.dock(),/data-section="tickets"/);
 ctx.state.section='tickets';assert.equal(ctx.dock(),'');
});
