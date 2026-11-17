import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchNhlSeasonListing} from '../engine/nhl-bulk-history.mjs';
const row=(id,h=3)=>({id,gameType:2,gameDate:'2025-10-08',homeTeamId:10,visitingTeamId:8,
 homeScore:h,visitingScore:2});
test('bulk NHL REST listing parses completed games exactly once',async()=>{
 const calls=[];
 const fetchImpl=async url=>{calls.push(url);return new Response(JSON.stringify({total:2,data:[row(2025020001),row(2025020002)]}),{status:200});};
 const r=await fetchNhlSeasonListing(2025,{fetchImpl,expected:2});
 assert.equal(r.games.length,2);assert.equal(r.games[0].homeTeam,'10');
 assert.equal(r.games[0].awayTeam,'8');assert.equal(r.games[0].homeScore,3);
 assert.equal(r.coverage.complete,true);assert.equal(calls.length,1);
 assert.ok(calls[0].includes('api.nhle.com/stats/rest/en/game'));
});
test('bulk NHL source refuses incomplete samples and fabricated final outcomes',async()=>{
 const fetchImpl=async()=>new Response(JSON.stringify({total:2,data:[row(2025020001),{...row(2025020002),homeScore:null}]}),{status:200});
 await assert.rejects(()=>fetchNhlSeasonListing(2025,{fetchImpl,expected:2}),/coverage/);
});
test('NHL listing refuses schedule rows outside requested season',async()=>{
 const fetchImpl=async()=>new Response(JSON.stringify({data:[row(2024020001)]}),{status:200});
 await assert.rejects(()=>fetchNhlSeasonListing(2025,{fetchImpl,expected:1}),/coverage/);
});
