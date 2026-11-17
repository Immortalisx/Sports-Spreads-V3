import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/matchup-signals.js',import.meta.url),'utf8');const c={Date,Intl,URLSearchParams,AbortController,setTimeout,clearTimeout};c.globalThis=c;vm.createContext(c);vm.runInContext(src,c);
const g={id:'401',league:'mlb',start:'2026-08-14T18:00:00Z',home:{name:'Chicago Cubs'},away:{name:'St. Louis Cardinals'}};
test('MLB signals require game identities, official server config and date',async()=>{
 await assert.rejects(c.SportsSignals.get({...g,league:'nfl'}),/No supported/);
 await assert.rejects(c.SportsSignals.get(g),/not configured/);
});
