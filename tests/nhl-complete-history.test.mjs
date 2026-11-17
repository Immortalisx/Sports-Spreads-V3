import test from 'node:test';
import assert from 'node:assert/strict';
import {completeNhlSeason} from '../engine/nhl-complete-history.mjs';
const game=(id,homeScore=3)=>({id,gameType:2,gameDate:String(id).endsWith('2')?'2025-10-09':'2025-10-08',
 gameState:'OFF',startTimeUTC:'2025-10-09T00:00:00Z',
 homeTeam:{abbrev:'TOR',score:homeScore},
 awayTeam:{abbrev:'MTL',score:1}});
const ok=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
test('NHL weekly fallback recovers only missing verified final games and counts coverage',async()=>{
 const calls=[];
 const fetchImpl=async url=>{
  calls.push(url);
  if(url.includes('club-schedule-season'))return ok({games:[game(2025020001)]});
  if(url.includes('/schedule/'))return ok({gameWeek:[{date:'2025-10-08',games:[game(2025020001),game(2025020002)]}]});
  throw Error('Unexpected NHL provider URL');
 };
 const r=await completeNhlSeason(2025,{fetchImpl,nhlClubs:['TOR'],expected:2,weekStart:'2025-10-07',weekEnd:'2025-10-07'});
 assert.equal(r.games.length,2);
 assert.equal(r.coverage.clubGames,1);
 assert.equal(r.coverage.weeklyRecovered,1);
 assert.equal(calls.length,2);
});
test('NHL weekly fallback rejects conflicting scores rather than inventing results',async()=>{
 const fetchImpl=async url=>ok(url.includes('club-schedule-season')?{games:[game(2025020001)]}:
  {gameWeek:[{games:[game(2025020001,9),game(2025020002)]}]});
 await assert.rejects(()=>completeNhlSeason(2025,{fetchImpl,nhlClubs:['TOR'],expected:2,weekStart:'2025-10-07',weekEnd:'2025-10-07'}),/source conflict/);
});
test('NHL incomplete season fails closed, without calibrated confidence',async()=>{
 const fetchImpl=async url=>ok(url.includes('club-schedule-season')?{games:[game(2025020001)]}:
  {gameWeek:[{games:[game(2025020001)]}]});
 await assert.rejects(()=>completeNhlSeason(2025,{fetchImpl,nhlClubs:['TOR'],expected:2,weekStart:'2025-10-07',weekEnd:'2025-10-07'}),/incomplete/);
});
