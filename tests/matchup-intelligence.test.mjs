import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/matchup-intelligence.js',import.meta.url),'utf8');
const scope={Date,globalThis:{}};scope.globalThis=scope;
vm.createContext(scope);vm.runInContext(script,scope);
const m=scope.SportsMatchups;
test('all four sports expose scheme and personnel factors without invented inputs',()=>{
 for(const league of ['nfl','nba','nhl','mlb']){
  const v=m.evaluate({league}); assert.ok(v.totalCount>=5);
  assert.equal(v.availableCount,0);assert.equal(v.probabilityAdjustment,null);
  assert.equal(v.advancedModelCalibrated,false);
 }
 assert.ok(m.evaluate({league:'nfl'}).factors.some(x=>x.id==='qb_blitz'));
 assert.ok(m.evaluate({league:'nfl'}).factors.some(x=>x.id==='coaching'));
});
test('partial, invented, or stale evidence never becomes an adjustment',()=>{
 const missing=m.evaluate({league:'nfl'},{qb_blitz:{sampleSize:3,description:'Great against blitz',sourceUrl:'https://example.com',asOf:new Date().toISOString()}});
 assert.equal(missing.availableCount,0);
 const recent=m.evaluate({league:'nfl'},{qb_blitz:{sampleSize:110,description:'Validated tagged-plays sample',sourceUrl:'https://example.com/verified',asOf:new Date().toISOString()}});
 assert.equal(recent.availableCount,1);
 assert.equal(recent.factors[0].modelCoefficient,null);
 assert.equal(recent.probabilityAdjustment,null);
});
