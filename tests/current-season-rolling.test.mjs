import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCurrentSeasonSnapshots,CURRENT_FORM_VERSION} from '../engine/current-season-rolling.mjs';
const match=(id,date,h,a,hs,as,league='nfl')=>({id,date,home:h,away:a,homeScore:hs,awayScore:as,league});
const fixture=(id,date,h='A',a='B',league='nfl')=>({id,date,home:h,away:a,league});
test('recent 3/5/10 game windows and opponent strength reconstruct from current season',()=>{
 const games=[
 match('a1','2026-09-01','A','B',24,10),match('a2','2026-09-08','B','A',14,28),
 match('a3','2026-09-15','A','B',30,16),match('a4','2026-09-22','B','A',21,14),
 match('a5','2026-09-29','A','B',35,28),match('a6','2026-10-06','B','A',10,28),
 match('a7','2026-10-13','A','B',28,24),
 ];
 const result=buildCurrentSeasonSnapshots({league:'nfl',season:'2026',games,fixtures:[fixture('upcoming','2026-10-20')]});
 const x=result.snapshots[0];
 assert.equal(x.version,CURRENT_FORM_VERSION);
 assert.equal(x.home.played,7);
 assert.equal(x.home.last3.games,3);
 assert.equal(x.home.last5.games,5);
 assert.equal(x.home.last10.games,7);
 assert.equal(x.home.last3.winRate,1);
 assert.ok(x.home.last5.opponentAdjustedMargin!==null);
 assert.equal(x.home.dataThrough,'2026-10-13');
 assert.equal(x.appliedToForecast,false);
});
test('same-day finished games MUST NOT influence later kickoff features',()=>{
 const games=[match('pre','2026-09-09','A','B',10,0),
  match('same1','2026-09-10','A','B',40,0)];
 const result=buildCurrentSeasonSnapshots({league:'nfl',season:'2026',games,fixtures:[
  fixture('early','2026-09-10'),fixture('late','2026-09-10'),fixture('tomorrow','2026-09-11')
 ]});
 assert.equal(result.snapshots[0].home.played,1);
 assert.equal(result.snapshots[1].home.played,1);
 assert.equal(result.snapshots[2].home.played,2);
});
test('team history is strictly scoped to current season; duplicate games rejected',()=>{
 const games=[match('old','2025-09-12','A','B',10,0)];
 assert.equal(buildCurrentSeasonSnapshots({league:'nfl',season:'2026',games:[],fixtures:[fixture('new','2026-09-10')]}).snapshots[0].home.played,0);
 assert.throws(()=>buildCurrentSeasonSnapshots({league:'nfl',season:'2026',games:[games[0],games[0]],fixtures:[]}),/Duplicate/);
});
test('rejects unsupported leagues or invalid dates',()=>{
 assert.throws(()=>buildCurrentSeasonSnapshots({league:'bad',season:'2026',games:[]}),/Invalid/);
 const x=buildCurrentSeasonSnapshots({league:'nhl',season:'2026-27',
  games:[match('x','2026-11-01','A','B',2,1,'nhl')],fixtures:[fixture('y','2026-11-04','A','B','nhl')]});
 assert.equal(x.snapshots[0].home.last5.games,1);
 assert.equal(x.snapshots[0].matchup.opponentAdjustedFormDelta,null);
});
