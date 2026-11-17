import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFormStudyRows,evaluateRollingFormHoldout} from '../engine/validate-rolling-form.mjs';
const row=(id,date,h,a,hs,as,year=2025,league='nfl')=>({
 gameId:id,gameDate:date,homeTeam:h,awayTeam:a,homeScore:hs,awayScore:as,league,season:year
});
test('rolling training rows are pregame snapshots, never final season records',()=>{
 const games=[row('a','2025-09-01','A','B',28,10),
 row('b','2025-09-08','B','A',11,20),
 row('c','2025-09-08','A','B',13,27),
 row('d','2025-09-15','B','A',31,0)];
 const rows=buildFormStudyRows(games,'nfl');
 assert.equal(rows.length,4);
 assert.equal(rows[0].historyThrough,null);
 assert.equal(rows[1].historyThrough,'2025-09-01');
 assert.equal(rows[2].historyThrough,'2025-09-01');
 assert.equal(rows[3].historyThrough,'2025-09-08');
 assert.ok(Number.isFinite(rows[3].x.elo));
});
test('future season and same-day game outcomes cannot influence earlier features',()=>{
 const a=row('a','2025-09-01','A','B',21,7);
 const b=row('b','2025-09-08','B','A',20,24);
 const c=row('c','2025-09-08','A','B',23,24);
 const x=buildFormStudyRows([a,b],'nfl');
 const y=buildFormStudyRows([a,b,c],'nfl');
 assert.deepEqual(x.find(r=>r.gameId==='b').x,y.find(r=>r.gameId==='b').x);
});
test('cannot claim calibrated improvement from missing histories',()=>{
 const report=evaluateRollingFormHoldout([row('a','2025-09-08','A','B',1,0)],'nfl');
 assert.equal(report.status,'insufficient_sample');
 assert.equal(report.approved,false);
 assert.equal(report.modelActivated,false);
 assert.throws(()=>evaluateRollingFormHoldout([],'nba'),/Only NFL and NHL/);
});
test('duplicate historical outcomes rejected',()=>{
 assert.throws(()=>buildFormStudyRows([
  row('dup','2025-09-08','A','B',2,1),row('dup','2025-09-15','A','B',0,1)
 ],'nfl'),/Duplicate historical/);
});
