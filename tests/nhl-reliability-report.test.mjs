import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runIndependentAudit} from '../engine/audit-nhl-calibration-independent.mjs';
import {buildNhlReliabilityDiagnostics,wilson95} from '../engine/report-nhl-reliability.mjs';
import {runNhlCalibrationResearch} from '../engine/nhl-elo-calibration-research.mjs';

const source=JSON.parse(readFileSync(new URL('./fixtures/nhl-2024-2026-regular-results.json',import.meta.url),'utf8'));
const clone=x=>({...x,rows:x.rows.map(r=>r.slice())});
const report=buildNhlReliabilityDiagnostics();
const primary=runNhlCalibrationResearch();

test('frozen coefficients and all 1312 predictions per season are read-only and time-separated',()=>{
 assert.equal(report.status,'research_only');
 assert.equal(report.promotionAllowed,false);
 assert.equal(report.modelCoefficientsUnchanged,true);
 assert.equal(report.futureProspective20262027,'NOT_LOADED_OR_SCORED');
 assert.equal(report.fitSeason,20232024);
 assert.equal(report.validationSeason,20242025);
 assert.equal(report.inspectedSeason,20252026);
 assert.equal(report.seasons.length,2);
 assert.equal(report.seasons[0].seasonRole,'chronological_validation');
 assert.ok(report.seasons[1].seasonRole.includes('NOT_independent'));
 assert.equal(report.fitReadOnly.intercept,primary.calibration.fit.intercept);
 assert.equal(report.fitReadOnly.slope,primary.calibration.fit.slope);
 assert.equal(report.seasons[0].games,1312);
 assert.equal(report.seasons[1].games,1312);
 assert.equal(runIndependentAudit().rowSets,undefined,'default existing audit has no new payload');
 const {rowSets}=runIndependentAudit({includeRows:true});
 assert.equal(rowSets.validation.length,1312);
 assert.equal(rowSets.diagnostic.length,1312);
 console.log('NHL_RELIABILITY_REPORT '+JSON.stringify(report));
});

test('Wilson intervals handle empty bins, deterministic boundaries and known observed proportions',()=>{
 assert.equal(wilson95(0,0),null);
 const [low1,high1]=wilson95(22,36);
 assert.ok(Math.abs(low1-.4486445909660558)<1e-12);
 assert.ok(Math.abs(high1-.7521512693462867)<1e-12);
 const [low2,high2]=wilson95(0,1);
 assert.equal(low2,0);
 assert.ok(high2>.79&&high2<.8);
 const [low3,high3]=wilson95(1,1);
 assert.ok(low3>.2&&low3<.21);
 assert.ok(Math.abs(high3-1)<1e-14);
 for(const [w,n] of [[-1,3],[4,3],[.5,3],[0,-1]])assert.throws(()=>wilson95(w,n),/invalid_wilson_counts/);
});

test('home-team and favorite-confidence bins independently cover every game with correct outcome orientation',()=>{
 for(const season of report.seasons){
  for(const model of Object.values(season.models)){
   const h=model.homeTeamBins,f=model.favoriteConfidenceBins;
   assert.equal(h.length,10);
   assert.equal(f.length,5);
   assert.equal(h.reduce((s,b)=>s+b.n,0),1312);
   assert.equal(f.reduce((s,b)=>s+b.n,0),1312);
   assert.equal(h.reduce((s,b)=>s+b.successes,0),Math.round(model.actualHomeWinRate*1312));
   assert.equal(f.reduce((s,b)=>s+b.successes,0),model.correct);
   assert.ok(Math.abs(model.eceHome10-h.reduce((s,b)=>s+b.n/1312*(b.absoluteGap||0),0))<1e-14);
   assert.ok(Math.abs(model.eceFavorite5-f.reduce((s,b)=>s+b.n/1312*(b.absoluteGap||0),0))<1e-14);
   for(const b of [...h,...f]){
    if(!b.n){
     assert.equal(b.observed,null);
     assert.equal(b.observedWilson95,null);
     assert.equal(b.averageProbability,null);
     assert.equal(b.sampleFlag,'empty');
    }else{
     assert.ok(b.averageProbability>=b.from-1e-13&&b.averageProbability<=b.to+1e-13);
     assert.ok(b.observedWilson95[0]<=b.observed&&b.observed<=b.observedWilson95[1]);
    }
   }
  }
 }
 const diag=report.seasons[1].models.calibrated;
 assert.equal(diag.homeTeamBins[7].n,36);
 assert.equal(diag.homeTeamBins[7].successes,22);
 assert.ok(Math.abs(diag.homeTeamBins[7].averageProbability-.7205014698867934)<1e-12);
 assert.equal(diag.homeTeamBins[8].n,1);
 assert.equal(diag.favoriteConfidenceBins[0].n,927);
 assert.equal(diag.favoriteConfidenceBins[1].n,342);
 assert.equal(diag.favoriteConfidenceBins[2].n,42);
 assert.equal(diag.favoriteConfidenceBins[3].n,1);
 assert.equal(diag.favoriteConfidenceBins[4].n,0);
 assert.equal(report.seasons[0].models.calibrated.homeTeamBins[7].n,80);
 assert.equal(report.seasons[0].models.calibrated.favoriteConfidenceBins[0].n,784);
});

test('benchmarks are fixed before each evaluated season and reproduce exact squared-error arithmetic',()=>{
 for(const season of report.seasons){
  const b=season.benchmarks,series=season.models;
  const priorSeason=season.season===20242025?20232024:20242025;
  const fixture=priorSeason===20232024?
    JSON.parse(readFileSync(new URL('./fixtures/nhl-2022-2024-regular-results.json',import.meta.url),'utf8')):
    source;
  const old=fixture.rows.filter(r=>r[1]===priorSeason);
  const homeRate=old.filter(r=>r[5]>r[6]).length/old.length;
  assert.equal(old.length,1312);
  assert.equal(b.always50PercentBrier,.25);
  assert.equal(b.precedingSeasonHomeWinRate,homeRate);
  const n=season.games,observedHome=series.raw.actualHomeWinRate;
  const expectedHomeRateBrier=observedHome*(1-homeRate)**2+(1-observedHome)*homeRate**2;
  assert.ok(Math.abs(b.precedingSeasonHomeRateBrier-expectedHomeRateBrier)<1e-13);
  assert.equal(b.alwaysPickHomeAccuracy,observedHome);
  assert.ok(Math.abs(series.calibrated.brierSkillVsAlways50-(1-series.calibrated.brier/.25))<1e-13);
  assert.ok(Math.abs(series.raw.brierSkillVsPriorHome-
   (1-series.raw.brier/b.precedingSeasonHomeRateBrier))<1e-13);
  assert.equal(season.comparison.correctWinnerDifferenceCalMinusRaw,
   series.calibrated.correct-series.raw.correct);
  assert.ok(Math.abs(season.comparison.brierGainRawMinusCalibrated-
   (series.raw.brier-series.calibrated.brier))<1e-13);
 }
 assert.ok(Math.abs(report.seasons[0].models.calibrated.brier-.23885387420292703)<1e-12);
 assert.ok(Math.abs(report.seasons[1].models.calibrated.brier-.24851954406937185)<1e-12);
});

test('changing already inspected final scores does not refit calibration or rewrite earlier validation',()=>{
 const altered=clone(source);
 for(const r of altered.rows)if(r[1]===20252026)[r[5],r[6]]=[r[6],r[5]];
 const audit=runIndependentAudit({later:altered,includeRows:true});
 const newReport=buildNhlReliabilityDiagnostics({audit,later:altered});
 assert.deepEqual(newReport.fitReadOnly,report.fitReadOnly);
 assert.deepEqual(newReport.seasons[0],report.seasons[0]);
 assert.notEqual(newReport.seasons[1].models.calibrated.brier,report.seasons[1].models.calibrated.brier);
 assert.equal(newReport.futureProspective20262027,'NOT_LOADED_OR_SCORED');
});

test('fail closed if rows, coefficients or fixed prior benchmark data are missing or unsupported',()=>{
 const audit=runIndependentAudit({includeRows:true});
 const mutated={...audit,rowSets:{...audit.rowSets,diagnostic:audit.rowSets.diagnostic.slice(1)}};
 assert.throws(()=>buildNhlReliabilityDiagnostics({audit:mutated}),/missing_verified_season_rows/);
 const promoted={...audit,promotionAllowed:true};
 assert.throws(()=>buildNhlReliabilityDiagnostics({audit:promoted}),/invalid_or_unfrozen_research_audit/);
 const invalid={...source,rows:source.rows.slice(1)};
 assert.throws(()=>buildNhlReliabilityDiagnostics({later:invalid}),/missing_preceding_season_benchmark/);
});
