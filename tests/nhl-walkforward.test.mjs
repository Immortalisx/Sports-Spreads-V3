import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runNhlWalkforward,validateNhlHistory} from '../engine/run-nhl-walkforward.mjs';
import {buildPregameRows} from '../engine/retrospective-model.mjs';
const source=JSON.parse(readFileSync(new URL('./fixtures/nhl-2024-2026-regular-results.json',import.meta.url),'utf8'));
const altered=(fn)=>{
 const x={...source,rows:source.rows.map(r=>r.slice())};
 fn(x.rows);
 return x;
};
const walk=runNhlWalkforward();

test('official complete seasons pass training gate and all 1,312 2025-26 games are evaluated',()=>{
 const v=validateNhlHistory(source);
 assert.equal(v.ok,true);
 assert.equal(v.trainingGames,1312);
 assert.equal(v.holdoutGames,1312);
 assert.equal(v.priorGamesPerTeam,82);
 assert.equal(walk.status,'research_only');
 assert.equal(walk.promotionAllowed,false);
 assert.equal(walk.summary.predictedGames,1312);
 assert.equal(walk.games.length,1312);
 assert.equal(new Set(walk.games.map(g=>g.gameId)).size,1312);
 assert.equal(walk.summary.holdoutStart,'2025-10-07');
 assert.equal(walk.summary.holdoutEnd,'2026-04-16');
 assert.ok(walk.games.every(g=>g.date>='2025-10-07'&&g.date<='2026-04-16'));
 assert.ok(walk.games.every(g=>g.previousTeamGameThrough===null||g.previousTeamGameThrough<g.date));
 assert.ok(walk.games.every(g=>g.homeWinProbability>0&&g.homeWinProbability<1));
 console.log('NHL_WALKFORWARD_REPORT '+JSON.stringify(({games,...report})=>report)(walk));
});

test('reported Brier, accuracy, log loss and calibration have correct definitions',()=>{
 const g=walk.games,s=walk.summary;
 const correct=g.filter(r=>r.correct).length;
 const brier=g.reduce((a,r)=>a+(r.homeWinProbability-r.homeWin)**2,0)/g.length;
 const logLoss=g.reduce((a,r)=>a-(r.homeWin*Math.log(r.homeWinProbability)+(1-r.homeWin)*Math.log(1-r.homeWinProbability)),0)/g.length;
 assert.equal(s.correct,correct);
 assert.equal(s.accuracy,correct/g.length);
 assert.ok(Math.abs(s.brier-brier)<1e-14);
 assert.ok(Math.abs(s.logLoss-logLoss)<1e-14);
 assert.equal(s.baselines.coinFlipBrier,.25);
 assert.equal(s.calibrationBins.reduce((a,b)=>a+b.n,0),1312);
 assert.equal(s.confidenceBins.reduce((a,b)=>a+b.n,0),1312);
 assert.equal(s.months.reduce((a,b)=>a+b.games,0),1312);
 const ece=s.calibrationBins.reduce((a,b)=>a+b.n/1312*(b.n?Math.abs(b.averagePredictedHomeWin-b.observedHomeWin):0),0);
 assert.ok(Math.abs(ece-s.ece10)<1e-14);
 assert.ok(s.brier>=0&&s.brier<=1);
 assert.ok(s.ece10>=0&&s.ece10<=1);
});

test('target outcome edits cannot affect its own or same-date predictions (strictly prior-day updates)',()=>{
 const first=source.rows.find(r=>r[1]===20252026);
 const changed=altered(rows=>{
  const row=rows.find(r=>r[0]===first[0]);
  [row[5],row[6]]=[row[6],row[5]];
 });
 const replay=runNhlWalkforward({historical:changed});
 assert.equal(replay.status,'research_only');
 const before=new Map(walk.games.map(g=>[g.gameId,g]));
 const day=first[2],sameDay=replay.games.filter(g=>g.date===day);
 assert.ok(sameDay.length>=2);
 for(const g of replay.games.filter(g=>g.date<=day))
  assert.equal(g.homeWinProbability,before.get(g.gameId).homeWinProbability,g.gameId);
 const result=before.get('nhl-'+first[0]);
 const flipped=replay.games.find(g=>g.gameId===result.gameId);
 assert.equal(flipped.homeWinProbability,result.homeWinProbability);
 assert.notEqual(flipped.homeWin,result.homeWin);
 assert.notEqual(flipped.brier,result.brier);
 assert.ok(replay.games.filter(g=>g.date>day).some(g=>g.homeWinProbability!==before.get(g.gameId).homeWinProbability),
  'later games should incorporate the changed earlier result');
});

test('future scores must not affect any older forecast even when present in input',()=>{
 const last=source.rows.filter(r=>r[1]===20252026).at(-1);
 const changed=altered(rows=>{
  const row=rows.find(r=>r[0]===last[0]);
  [row[5],row[6]]=[row[6],row[5]];
 });
 const replay=runNhlWalkforward({historical:changed});
 const previous=new Map(walk.games.map(g=>[g.gameId,g]));
 for(const g of replay.games)
  assert.equal(g.homeWinProbability,previous.get(g.gameId).homeWinProbability,g.gameId);
});

test('chronological ordering is enforced by existing Elo model, independent of fixture row ordering',()=>{
 const shuffled=altered(rows=>rows.reverse());
 const replay=runNhlWalkforward({historical:shuffled});
 assert.equal(replay.status,'research_only');
 assert.deepEqual(replay.games,walk.games);
 assert.deepEqual(replay.summary,walk.summary);
});

test('full dataset fails closed for missing scores, duplicates, invalid finals and reduced training',()=>{
 const cases=[
  altered(rows=>rows.pop()),
  altered(rows=>{rows[1][0]=rows[0][0]}),
  altered(rows=>{rows[1][5]=rows[1][6]}),
  altered(rows=>{rows[0][3]='ZZZ'}),
  altered(rows=>{rows[0][2]='2026-11-01'})
 ];
 for(const history of cases){
  const result=runNhlWalkforward({historical:history});
  assert.equal(result.status,'not_testable');
  assert.equal(result.promotionAllowed,false);
  assert.equal(result.summary,null);
  assert.deepEqual(result.games,[]);
 }
});

test('prefix-only chronology has exactly the same early-season probabilities',()=>{
 const input=source.rows.filter(r=>r[1]===20242025||(r[1]===20252026&&r[2]<='2025-10-10')).map(
 ([id,season,gameDate,homeTeam,awayTeam,homeScore,awayScore])=>({
  gameId:'nhl-'+id,league:'nhl',season,gameDate,homeTeam,awayTeam,homeScore,awayScore
 }));
 const early=buildPregameRows(input,'nhl').filter(r=>r.season===20252026);
 const full=new Map(walk.games.map(g=>[g.gameId,g.homeWinProbability]));
 assert.ok(early.length>0);
 for(const row of early)assert.equal(row.baseline,full.get(row.gameId),row.gameId);
});
