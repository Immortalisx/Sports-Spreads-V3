import test from 'node:test';import assert from 'node:assert/strict';import {computeCandidateFeature,coachingHeadToHead,SUPPORTED_RESEARCH_FEATURES} from '../engine/advanced-sourced-factors.mjs';
const base={gameId:'game-1',league:'nfl',gameAt:'2026-11-22T18:00:00Z'};
const doc={sourceTier:'official',sourceUrl:'https://nfl.com/',snapshotAt:'2026-11-20T18:00:00Z',dataThrough:'2026-11-18T18:00:00Z',sampleSize:100};
test('NFL QB-versus-blitz is opponent-frequency weighted, not raw career win percentage',()=>{
 const away={qbBlitzEpa:.17,qbCleanEpa:.11,opponentBlitzRate:.35,opponentPressureEpaAllowed:-.03};
 const home={qbBlitzEpa:.24,qbCleanEpa:.14,opponentBlitzRate:.39,opponentPressureEpaAllowed:.04};
 const result=computeCandidateFeature(base,{featureId:'qb_blitz_edge',home,away,...doc,matchup:{quarterbackId:'qb-1'}});
 assert.ok(result.homeMinusAway>0);assert.equal(result.appliedToLiveProbability,false);
 assert.throws(()=>computeCandidateFeature(base,{featureId:'qb_blitz_edge',home,away:{...away,opponentBlitzRate:2},...doc,matchup:{quarterbackId:'qb-1'}}),/Invalid/);
 assert.throws(()=>computeCandidateFeature(base,{featureId:'qb_blitz_edge',home,away,...doc,snapshotAt:'2026-11-23T18:00:00Z',matchup:{quarterbackId:'qb-1'}}),/leakage/);
});
test('NBA defensive scheme is weighted by opposing scheme mix and requires samples',()=>{
 const side={opponentSwitchRate:.35,opponentZoneRate:.15,offenseVsSwitch:1.13,offenseVsZone:1.01,offenseVsOther:1.06};
 const result=computeCandidateFeature({...base,league:'nba'},{featureId:'scheme_edge',home:{...side,offenseVsSwitch:1.25},away:side,...doc,matchup:{}});
 assert.ok(result.homeMinusAway>0);assert.throws(()=>computeCandidateFeature({...base,league:'nba'},{featureId:'scheme_edge',home:side,away:side,...doc,sampleSize:1}),/Insufficient/);
});
test('NHL goalie comparison requires a confirmed starter and verified GSAx',()=>{
 const g={...base,league:'nhl'};
 assert.throws(()=>computeCandidateFeature(g,{featureId:'goalie_gsax',home:{goalieGsaxPer60:.4},away:{goalieGsaxPer60:-.2,confirmedStarterId:'away'},...doc,matchup:{confirmedStarterId:'a'}}),/Confirmed/);
 const result=computeCandidateFeature(g,{featureId:'goalie_gsax',home:{goalieGsaxPer60:.4,confirmedStarterId:'home'},away:{goalieGsaxPer60:-.2,confirmedStarterId:'away'},...doc,matchup:{confirmedStarterId:'a'}});assert.ok(result.homeMinusAway>.5);
});
test('MLB pitcher versus hitter needs starter ID and at least seven projected hitter IDs',()=>{
 const game={...base,league:'mlb'};const lineup=Array(9).fill(0).map((_,i)=>String(i+1));
 const side={opposingStarterId:'pitcher-1',projectedHitterIds:lineup,lineupXwobaAgainstPitchMix:.335};
 const result=computeCandidateFeature(game,{featureId:'pitcher_hitter',home:{...side,lineupXwobaAgainstPitchMix:.365},away:side,...doc,matchup:{startingPitcherId:'pitcher-1',projectedHitterIds:lineup}});
 assert.ok(result.homeMinusAway>.2);assert.equal(result.appliedToLiveProbability,false);
 assert.throws(()=>computeCandidateFeature(game,{featureId:'pitcher_hitter',home:{...side,projectedHitterIds:['1']},away:side,...doc,matchup:{startingPitcherId:'pitcher-1',projectedHitterIds:lineup}}),/lineup/);
});
test('coaching matchups shrink tiny H2H samples, never become automatic model weights',()=>{
 const v=coachingHeadToHead({meetings:1,homeCoachWins:1,homeCoachId:'a',awayCoachId:'b'});assert.ok(v.shrunkHistoricalWinShare<.6);assert.equal(v.notCausal,true);assert.equal(v.appliedToLiveProbability,false);
 assert.ok(SUPPORTED_RESEARCH_FEATURES.nba.includes('scheme_edge'));
});
