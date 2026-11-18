import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runIndependentAudit} from '../engine/audit-nhl-calibration-independent.mjs';
import {runNhlCalibrationResearch} from '../engine/nhl-elo-calibration-research.mjs';
const first=JSON.parse(readFileSync(new URL('./fixtures/nhl-2022-2024-regular-results.json',import.meta.url),'utf8'));
const second=JSON.parse(readFileSync(new URL('./fixtures/nhl-2024-2026-regular-results.json',import.meta.url),'utf8'));
const clone=x=>({...x,rows:x.rows.map(row=>row.slice())});
const audit=runIndependentAudit(),model=runNhlCalibrationResearch();

test('fully independent Elo and frozen Platt calculations match the existing research engine',()=>{
 assert.equal(audit.promotionAllowed,false);
 assert.equal(audit.fixtureIntegrity.games,5248);
 assert.deepEqual(audit.checks.disjointSplit,[20222023,20232024,20242025,20252026]);
 assert.equal(audit.checks.futureProspective2026_27,'NOT_SCORED');
 assert.equal(audit.checks.2025_26PreviouslyInspected,true);
 assert.ok(Math.abs(audit.fit.intercept-model.calibration.fit.intercept)<1e-13);
 assert.ok(Math.abs(audit.fit.slope-model.calibration.fit.slope)<1e-13);
 const pairs=[
  [audit.validation.raw,model.calibration.validationScores.baseline],
  [audit.validation.cal,model.calibration.validationScores.calibrated],
  [audit.exploratory.raw,model.comparison.baseline],
  [audit.exploratory.cal,model.comparison.calibrated]
 ];
 for(const [a,b] of pairs)for(const key of ['n','correct','accuracy','brier','logLoss','ece10','forecastHomeWinRate']){
  const rhs=key==='forecastHomeWinRate'?b.meanForecast:b[key];
  assert.ok(Math.abs(a[key]-rhs)<1e-12,key+': independent='+a[key]+' model='+rhs);
 }
 console.log('NHL_INDEPENDENT_AUDIT '+JSON.stringify(audit));
});

test('validation and exploratory reliability bins partition exact league totals with uncertainty',()=>{
 for(const w of [audit.validation,audit.exploratory]){
  for(const m of [w.raw,w.cal]){
   assert.equal(m.bins.length,10);
   assert.equal(m.bins.reduce((s,b)=>s+b.n,0),1312);
   assert.equal(m.bins.reduce((s,b)=>s+b.homeWins,0),Math.round(m.actualHomeWinRate*1312));
   for(const b of m.bins)if(b.n){
    assert.ok(b.meanForecast>=b.from&&b.meanForecast<=b.to);
    assert.ok(b.observed>=0&&b.observed<=1);
    assert.ok(b.observedWilson95[0]<=b.observed&&b.observed<=b.observedWilson95[1]);
    assert.ok(b.observedWilson95[0]<=b.observedWilson95[1]);
   }else{
    assert.equal(b.observedWilson95,null);
    assert.equal(b.meanForecast,null);
   }
   const fromBins=m.bins.reduce((s,b)=>s+(b.n/1312)*(b.absoluteGap||0),0);
   assert.ok(Math.abs(fromBins-m.ece10)<1e-14);
  }
 }
 const bin70=audit.exploratory.cal.bins[7];
 assert.equal(bin70.n,36);
 assert.equal(bin70.homeWins,22);
 assert.ok(bin70.meanForecast>.72&&bin70.meanForecast<.721);
 assert.equal(audit.exploratory.cal.bins[8].n,1);
 assert.equal(audit.validation.cal.bins[8].n,3);
 assert.equal(audit.validation.cal.bins[7].n,80);
});

test('independent audit protects future holdout and cannot learn from 2025-26 settlement labels',()=>{
 const changed=clone(second);
 for(const r of changed.rows)if(r[1]===20252026)[r[5],r[6]]=[r[6],r[5]];
 const rerun=runIndependentAudit({later:changed});
 assert.deepEqual(rerun.fit,audit.fit);
 assert.deepEqual(rerun.validation,audit.validation);
 assert.notEqual(rerun.exploratory.cal.brier,audit.exploratory.cal.brier);
 assert.equal(rerun.checks.futureProspective2026_27,'NOT_SCORED');
});

test('no 2024-25 outcome can affect 2023-24 frozen fit; invalid history fails closed',()=>{
 const changed=clone(second),r=changed.rows.find(x=>x[1]===20242025);
 [r[5],r[6]]=[r[6],r[5]];
 assert.deepEqual(runIndependentAudit({later:changed}).fit,audit.fit);
 const bad=clone(first);bad.rows[10][0]=bad.rows[9][0];
 assert.throws(()=>runIndependentAudit({earlier:bad}),/INDEPENDENT_AUDIT_INVALID_RECORD/);
 const missing=clone(second);missing.rows.pop();
 assert.throws(()=>runIndependentAudit({later:missing}),/INDEPENDENT_AUDIT_INVALID_LENGTH/);
});
