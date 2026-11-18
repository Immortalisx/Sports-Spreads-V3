import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCurrentSeasonSnapshots} from '../supabase/functions/season-form/current-season-rolling.mjs';
const games=[
 {id:'n1',league:'nba',date:'2026-11-01',home:'1',away:'2',homeScore:105,awayScore:99},
 {id:'n2',league:'nba',date:'2026-11-03',home:'2',away:'1',homeScore:100,awayScore:115},
 {id:'n3',league:'nba',date:'2026-11-05',home:'1',away:'3',homeScore:108,awayScore:110},
 {id:'n4',league:'nba',date:'2026-11-07',home:'3',away:'1',homeScore:90,awayScore:96}
];
test('recent game trend is sourced from earlier finalized fixtures only',()=>{
 const r=buildCurrentSeasonSnapshots({league:'nba',season:'2026-27',games,
  fixtures:[{id:'fixture',league:'nba',date:'2026-11-08',home:'1',away:'2'}]});
 assert.equal(r.nextGames,1);
 const t=r.snapshots[0].home;
 assert.equal(t.recentGames.length,4);
 assert.deepEqual(t.recentGames.map(x=>x.win),[true,true,false,true]);
 assert.ok(t.recentGames.every(x=>x.date<'2026-11-08'));
 assert.equal(r.snapshots[0].appliedToForecast,false);
});
test('same-day outcomes cannot leak into form sparkline',()=>{
 const r=buildCurrentSeasonSnapshots({league:'nba',season:'2026-27',games,
  fixtures:[{id:'fixture',league:'nba',date:'2026-11-07',home:'1',away:'3'}]});
 assert.equal(r.snapshots[0].home.recentGames.length,3);
 assert.ok(r.snapshots[0].home.recentGames.every(x=>x.date<'2026-11-07'));
});