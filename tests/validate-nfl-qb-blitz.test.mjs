import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPregameBlitzStudyRows,evaluateQbBlitzHoldout} from '../engine/validate-nfl-qb-blitz.mjs';
const result=(id,date,home='A',away='B',hs=21,as=10)=>({
 gameId:id,season:2025,gameDate:date,homeTeam:home,awayTeam:away,
 homeScore:hs,awayScore:as,league:'nfl'});
const qb=(id,date,team,who,blitzN=20,cleanN=40)=>
 ({gameId:id,season:2025,date,team,qb:who,blitzN,cleanN,
   blitzEpaSum:blitzN*.25,cleanEpaSum:cleanN*.1});
const def=(id,date,team,n=100,b=32)=>({gameId:id,season:2025,date,team,n,blitzN:b});
function history(){
 return {games:[result('game1','2025-09-01'),result('game2','2025-09-04','B','A'),
   result('game3','2025-09-07'),result('game4','2025-09-11')],
  qbs:[
   qb('game1','2025-09-01','A','QBA'),qb('game1','2025-09-01','B','QBB'),
   qb('game2','2025-09-04','B','QBNEW'),qb('game2','2025-09-04','A','QBA'),
   qb('game3','2025-09-07','A','QBA'),qb('game3','2025-09-07','B','QBNEW'),
   qb('game4','2025-09-11','A','QBA'),qb('game4','2025-09-11','B','QBNEW')],
  defenses:['game1','game2','game3','game4'].flatMap((id,i)=>
    [def(id,['2025-09-01','2025-09-04','2025-09-07','2025-09-11'][i],'A'),
     def(id,['2025-09-01','2025-09-04','2025-09-07','2025-09-11'][i],'B')])};
}
test('never uses actual starter as pregame input or 2-day-old unpublished charting',()=>{
 const data=history(),r=buildPregameBlitzStudyRows(data);
 assert.equal(r[0].blitz.home.projectedQB,null);
 assert.equal(r[1].blitz.home.projectedQB,null);
 assert.equal(r[2].blitz.home.projectedQB,'QBA');
 assert.equal(r[2].blitz.away.projectedQB,'QBB'); // actual current QBNEW not known from game2, which is delayed
 assert.equal(r[2].blitz.awayProjectedQbCorrect,false);
 assert.equal(r[3].blitz.away.projectedQB,'QBNEW');
 assert.equal(r[3].blitz.maxDataDate,'2025-09-07');
});
test('later outcomes cannot leak into earlier matchup features',()=>{
 const data=history(),before=buildPregameBlitzStudyRows(data);
 const changed=history();
 changed.qbs.find(x=>x.gameId==='game4'&&x.team==='B').blitzEpaSum=99;
 changed.games.find(x=>x.gameId==='game4').homeScore=0;
 const after=buildPregameBlitzStudyRows(changed);
 const one=r=>r.find(x=>x.gameId==='game3');
 assert.deepEqual(one(before).x,one(after).x);
 assert.deepEqual(one(before).blitz.home,one(after).blitz.home);
});
test('missing QB or defensive samples yield zero interaction and cannot fake coverage',()=>{
 const data=history();data.qbs=data.qbs.filter(x=>x.team==='A');
 const rows=buildPregameBlitzStudyRows(data);
 assert.equal(rows[3].x.qbBlitzInteraction,0);
 assert.equal(rows[3].blitz.available,false);
 assert.equal(rows[3].blitz.away.projectedQB,null);
});
test('duplicate and invalid source data are rejected',()=>{
 const d=history();
 assert.throws(()=>buildPregameBlitzStudyRows({...d,games:[...d.games,d.games[0]]}),/Duplicate NFL game/);
 assert.throws(()=>buildPregameBlitzStudyRows({...d,qbs:[{...d.qbs[0],blitzN:-1},...d.qbs.slice(1)]}),/Corrupt FTN QB/);
});
test('small historical dataset returns not-approved, never an invented score',()=>{
 const output=evaluateQbBlitzHoldout(history());
 assert.equal(output.approved,false);
 assert.equal(output.status,'insufficient_completed_games');
 assert.equal(output.publicModelModified,false);
 assert.equal(output.holdout,undefined);
});
