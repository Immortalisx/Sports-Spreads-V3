import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitFrozenPlatt,applyFrozenPlatt,runNhlCalibrationResearch,validateEarlierNhlHistory,CALIBRATION_RULES} from '../engine/nhl-elo-calibration-research.mjs';
const old=JSON.parse(readFileSync(new URL('./fixtures/nhl-2022-2024-regular-results.json',import.meta.url),'utf8'));
const recent=JSON.parse(readFileSync(new URL('./fixtures/nhl-2024-2026-regular-results.json',import.meta.url),'utf8'));
const copy=s=>({...s,rows:s.rows.map(r=>r.slice())});
const baseline=runNhlCalibrationResearch();
test('two complete prior seasons are required for NHL Elo calibration',()=>{
 const v=validateEarlierNhlHistory(old);
 assert.equal(v.ok,true);
 assert.equal(v.priorTrainingGames,2624);
 assert.deepEqual(v.seasons,[20222023,20232024]);
 assert.equal(v.priorGamesPerTeam,164);
 assert.equal(baseline.status,'research_only');
 assert.equal(baseline.promotionAllowed,false);
 assert.deepEqual(baseline.splits.eloHistoricalTrainingSeasons,[20222023]);
 assert.equal(baseline.splits.eloHistoricalTrainingGames,1312);
 assert.equal(baseline.splits.calibrationFitSeason,20232024);
 assert.equal(baseline.splits.validationSeason,20242025);
 assert.equal(baseline.splits.validationGames,1312);
 assert.equal(baseline.splits.calibrationFitGames,1312);
 assert.equal(baseline.splits.exploratoryEvaluationSeason,20252026);
 assert.equal(baseline.splits.exploratoryEvaluationGames,1312);
 assert.equal(baseline.games.length,1312);
 assert.equal(new Set(baseline.games.map(g=>g.gameId)).size,1312);
 assert.ok(baseline.games.every(g=>g.priorEvidenceThrough===null||g.priorEvidenceThrough<g.date));
 const {games,...compact}=baseline;
 console.log('NHL_ELO_CALIBRATION_REPORT '+JSON.stringify(compact));
});

test('fully predetermined fixed Platt hyperparameters and time-separated fitting',()=>{
 const fit=baseline.calibration.fit;
 assert.equal(fit.method,'predeclared_regularized_platt');
 assert.equal(fit.fitSeason,20232024);
 assert.equal(fit.validationSeason,20242025);
 assert.equal(fit.fitLastDate,'2024-04-18');
 assert.ok(fit.fitLastDate<baseline.splits.validationStartsOn);
 assert.ok(baseline.splits.validationEndsOn<baseline.games[0].date);
 assert.ok(fit.fitLastDate<baseline.games[0].date);
 assert.equal(fit.fitGames,1312);
 assert.equal(fit.iterationCount,CALIBRATION_RULES.iterationCount);
 assert.equal(fit.learningRate,CALIBRATION_RULES.learningRate);
 assert.ok(Number.isFinite(fit.intercept)&&Number.isFinite(fit.slope));
 assert.ok(fit.slope>0);
 assert.ok(applyFrozenPlatt(.5,fit)>0&&applyFrozenPlatt(.5,fit)<1);
 assert.ok(baseline.comparison.status.includes('NOT_independent_holdout'));
 assert.equal(baseline.splits.trulyUntouchedFutureHoldout.status,'reserved_not_scored');
 assert.equal(baseline.splits.trulyUntouchedFutureHoldout.season,20262027);
 assert.equal(baseline.splits.trulyUntouchedFutureHoldout.startsNoEarlierThan,'2026-11-19');
});

test('2025-26 outcomes cannot change the earlier frozen calibration or 2024-25 validation',()=>{
 const altered=copy(recent);
 for(const row of altered.rows)if(row[1]===20252026)[row[5],row[6]]=[row[6],row[5]];
 const replay=runNhlCalibrationResearch({later:altered});
 assert.equal(replay.status,'research_only');
 assert.deepEqual(replay.calibration.fit,baseline.calibration.fit);
 assert.deepEqual(replay.calibration.validationScores,baseline.calibration.validationScores);
 assert.equal(replay.games[0].rawHomeProbability,baseline.games[0].rawHomeProbability);
 assert.equal(replay.games[0].calibratedHomeProbability,baseline.games[0].calibratedHomeProbability);
 assert.notEqual(replay.comparison.calibrated.brier,baseline.comparison.calibrated.brier);
});

test('editing a completed game has no effect on its own or same-date predicted probabilities',()=>{
 const altered=copy(recent),first=altered.rows.find(x=>x[1]===20252026);
 [first[5],first[6]]=[first[6],first[5]];
 const replay=runNhlCalibrationResearch({later:altered});
 const known=new Map(baseline.games.map(g=>[g.gameId,g]));
 const day=first[2];
 for(const g of replay.games.filter(g=>g.date<=day)){
  const prior=known.get(g.gameId);
  assert.equal(g.rawHomeProbability,prior.rawHomeProbability,g.gameId);
  assert.equal(g.calibratedHomeProbability,prior.calibratedHomeProbability,g.gameId);
 }
 const changed=replay.games.find(g=>g.gameId==='nhl-'+first[0]),original=known.get(changed.gameId);
 assert.equal(changed.rawHomeProbability,original.rawHomeProbability);
 assert.equal(changed.calibratedHomeProbability,original.calibratedHomeProbability);
 assert.notEqual(changed.homeWin,original.homeWin);
 assert.notEqual(changed.calibratedBrier,original.calibratedBrier);
 assert.ok(replay.games.some(g=>g.date>day&&g.rawHomeProbability!==known.get(g.gameId).rawHomeProbability));
});

test('reversing a final game outcome leaves all holdout forecasts unchanged',()=>{
 const altered=copy(recent),last=altered.rows.filter(x=>x[1]===20252026).at(-1);
 [last[5],last[6]]=[last[6],last[5]];
 const replay=runNhlCalibrationResearch({later:altered});
 assert.deepEqual(replay.calibration.fit,baseline.calibration.fit);
 for(let i=0;i<baseline.games.length;i++){
  assert.equal(replay.games[i].rawHomeProbability,baseline.games[i].rawHomeProbability);
  assert.equal(replay.games[i].calibratedHomeProbability,baseline.games[i].calibratedHomeProbability);
 }
});

test('calibrated probability Brier, winner accuracy, log loss, and ECE match game-by-game math',()=>{
 const g=baseline.games, c=baseline.comparison;
 for(const [key,metric] of [['rawHomeProbability',c.baseline],['calibratedHomeProbability',c.calibrated]]){
  const x=g.map(r=>r[key]),y=g.map(r=>r.homeWin),b=x.reduce((a,p,i)=>a+(p-y[i])**2,0)/g.length;
  const l=x.reduce((a,p,i)=>a-(y[i]*Math.log(p)+(1-y[i])*Math.log(1-p)),0)/g.length;
  const acc=g.filter(r=>(r[key]>=.5)===Boolean(r.homeWin)).length/g.length;
  assert.ok(Math.abs(metric.brier-b)<1e-14);
  assert.ok(Math.abs(metric.logLoss-l)<1e-14);
  assert.ok(Math.abs(metric.accuracy-acc)<1e-14);
  assert.equal(metric.n,1312);
  assert.ok(metric.ece10>=0&&metric.ece10<=1);
 }
 assert.equal(c.calibrationBins.calibrated.reduce((a,b)=>a+b.n,0),1312);
 assert.equal(c.calibrationBins.baseline.reduce((a,b)=>a+b.n,0),1312);
 assert.equal(c.monthly.reduce((a,b)=>a+b.n,0),1312);
 assert.ok(Math.abs(c.brierGain-(c.baseline.brier-c.calibrated.brier))<1e-14);
 assert.equal(c.uncertainty.replicates,1000);
 assert.ok(c.uncertainty.gameDates>100);
 assert.ok(c.uncertainty.brierGain95CI[0]<=c.uncertainty.brierGain95CI[1]);
});

test('missing history, duplicate IDs and impossible results fail closed without predictions',()=>{
 const samples=[
  {earlier:{rows:old.rows.slice(1)}},
  {earlier:(()=>{const d=copy(old);d.rows[1][0]=d.rows[0][0];return d;})()},
  {earlier:(()=>{const d=copy(old);d.rows[0][5]=d.rows[0][6];return d;})()},
  {earlier:(()=>{const d=copy(old);d.rows[1][3]='ZZZ';return d;})()},
  {later:{rows:recent.rows.slice(1)}},
  {later:(()=>{const d=copy(recent);d.rows[0][1]=20262027;return d;})()}
 ];
 for(const sample of samples){
  const result=runNhlCalibrationResearch(sample);
  assert.equal(result.status,'not_testable');
  assert.equal(result.promotionAllowed,false);
  assert.equal(result.calibration,null);
  assert.equal(result.comparison,null);
  assert.deepEqual(result.games,[]);
 }
});

test('any fit containing post-fit labels or incomplete fit-season rows throws rather than fitting',()=>{
 const invalid=[{season:20252026,baseline:.5,y:1}];
 assert.throws(()=>fitFrozenPlatt(invalid),/complete 2024-25/);
 const mixed=Array.from({length:1312},()=>({season:20232024,baseline:.5,y:1}));
 mixed[0].season=20242025;
 assert.throws(()=>fitFrozenPlatt(mixed),/complete 2024-25/);
});
