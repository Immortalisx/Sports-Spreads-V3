import test from 'node:test';
import assert from 'node:assert/strict';
import {walkForward} from '../engine/walkforward.mjs';

const iso=ms=>new Date(ms).toISOString();
const DAY=86400000;
const start=Date.parse('2024-01-01T18:00:00Z');
const rows=Array.from({length:100},(_,i)=>{
 const kickoff=start+i*5*DAY;
 return {
  league:'nfl',sourceTier:'official',simulated:false,gameId:'fixture-'+i,
  gameAt:iso(kickoff),snapshotAt:iso(kickoff-DAY),
  resultKnownAt:iso(kickoff+5*3600000),sourceUrl:'https://example.org/archive',
  homeWin:i%2===0,baseProbability:.52,
  features:{rest_travel:{homeMinusAway:i%2===0?.2:-.2,sampleSize:10,
   sourceUrl:'https://example.org/fixture',dataThrough:iso(kickoff-2*DAY)}}
 };
});
test('rolling-origin training excludes outcomes only known after holdout begins',()=>{
 const cutoff=Date.parse(rows[70].gameAt);
 const withLate=rows.map((r,i)=>i===69?{...r,resultKnownAt:iso(cutoff+DAY)}:r);
 const report=walkForward(withLate,'nfl',['rest_travel'],{minHoldout:20,allowPromotion:false});
 assert.equal(report.status,'research_only');
 assert.equal(report.excludedLateResults,1);
 assert.equal(report.trainingRows,69);
 assert.equal(report.metrics.count,30);
 assert.equal(report.trainedThrough,rows[68].gameAt);
});
test('a normal settled historical sample keeps all eligible training rows',()=>{
 const report=walkForward(rows,'nfl',['rest_travel'],{minHoldout:20,allowPromotion:false});
 assert.equal(report.status,'research_only');
 assert.equal(report.excludedLateResults,0);
 assert.equal(report.trainingRows,70);
});
test('NHL and NBA obey the same late-outcome embargo',()=>{
 for(const league of ['nhl','nba']){
  const feature=league==='nhl'?'rest_travel':'rest_travel';
  const data=rows.map((r,i)=>({...r,league,gameId:league+'-'+i,
   resultKnownAt:i===69?iso(Date.parse(rows[70].gameAt)+DAY):r.resultKnownAt}));
  const report=walkForward(data,league,[feature],{minHoldout:20,allowPromotion:false});
  assert.equal(report.excludedLateResults,1);
  assert.equal(report.trainingRows,69);
  assert.equal(report.status,'research_only');
 }
});
