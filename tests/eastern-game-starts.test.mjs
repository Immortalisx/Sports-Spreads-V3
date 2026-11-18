import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const state=readFileSync(new URL('../src/app/10-state.js',import.meta.url),'utf8');
const views=readFileSync(new URL('../src/app/20-views.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const context={window:{location:{search:''}},localStorage:{getItem:()=>null},
 Date,Intl,URL,URLSearchParams,console,Math,Number,JSON,Object,Array,Map,Set};
vm.createContext(context);
vm.runInContext(state+'\nthis._testTime=formatTime;this._testDay=formatDay;',context);
test('November evening kickoff is labeled EST, never device-local time',()=>{
 assert.equal(context._testTime('2026-11-20T01:15:00.000Z'),'8:15 PM EST');
 assert.equal(context._testDay('2026-11-20T01:15:00.000Z'),'Nov 19');
});
test('summer baseball first pitch uses EDT instead of incorrectly marking EST',()=>{
 assert.equal(context._testTime('2026-07-05T00:20:00.000Z'),'8:20 PM EDT');
});
test('midnight UTC rolls back to prior Eastern date correctly',()=>{
 assert.equal(context._testTime('2026-12-01T00:30:00Z'),'7:30 PM EST');
 assert.equal(context._testDay('2026-12-01T00:30:00Z'),'Nov 30');
});
test('missing and invalid event dates render TBD instead of false kickoff time',()=>{
 assert.equal(context._testTime(null),'TBD');
 assert.equal(context._testTime('not-a-date'),'TBD');
});
test('all game cards and details prominently show sourced Eastern starts',()=>{
 assert.match(views,/const startName=\{nfl:'Kickoff',nba:'Tipoff',nhl:'Puck drop',mlb:'First pitch'\}/);
 assert.match(views,/class="game-start-time"/);
 assert.match(views,/class="game-center-time"/);
 assert.match(views,/Scheduled start \(Eastern Time\)/);
 assert.match(views,/drawer-start-time/);
 assert.match(css,/\.game-start-time strong/);
 assert.match(css,/@media\(max-width:620px\)/);
});
