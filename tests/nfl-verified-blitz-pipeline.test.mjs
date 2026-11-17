import test from 'node:test';
import assert from 'node:assert/strict';
import {joinBlitzPlays,buildBlitzPregameFeatures,injuryAvailabilityForGame} from '../engine/nfl-verified-blitz-pipeline.mjs';
const makePbp=(play_id,date='2025-09-08',epa=.5,passer='q1',receiver='r1')=>({
 game_id:'2025_01_CAR_ATL',play_id,game_date:date,posteam:'ATL',defteam:'CAR',
 passer_player_id:passer,receiver_player_id:receiver,epa,pass_attempt:1,play_type:'pass'
});
const makeFtn=(play,n)=>({nflverse_game_id:'2025_01_CAR_ATL',nflverse_play_id:play,n_blitzers:n});
test('joins ONLY exact same play ID and recorded blitz values, never guesses coverage',()=>{
 const result=joinBlitzPlays({pbp:[makePbp(10),makePbp(11),makePbp(12)],
  ftn:[makeFtn(10,2),makeFtn(11,0),makeFtn(999,1)]});
 assert.equal(result.matched,2);
 assert.deepEqual(result.joined.map(x=>x.blitz),[true,false]);
 assert.equal(result.joined[0].epa,.5);
 assert.equal(result.coverageScheme,'unavailable');
 assert.match(result.notes,/not a verified man\/zone/);
});
test('future/same-day outcomes do not leak to future game QB projections',()=>{
 const plays=Array.from({length:80},(_,i)=>({
  gameId:'g-prior',date:'2025-09-08',offenseTeam:'ATL',defenseTeam:'CAR',quarterbackId:'q1',
  receiverId:'r1',epa:i%2===0?0.45:0.15,blitz:i%2===0
 }));
 const fixture=(gameId,date)=>({gameId,date,homeTeam:'ATL',awayTeam:'CAR',homeQbId:'q1',awayQbId:'q2',homeReceiverId:'r1'});
 const current=buildBlitzPregameFeatures({plays,fixtures:[fixture('sameday','2025-09-08'),fixture('next','2025-09-15')],minQb:15,minDefense:30,minReceiver:12});
 assert.equal(current[0].home.qbEpaVsBlitz,null);
 assert.equal(current[0].home.availability,'insufficient_samples');
 assert.ok(current[1].home.qbEpaVsBlitz>current[1].home.qbEpaVsNonBlitz);
 assert.equal(current[1].home.sourceDataThrough,'2025-09-08');
 assert.equal(current[1].home.receiverVsZone,null);
 assert.equal(current[1].home.receiverVsMan,null);
 assert.equal(current[1].home.receiverBlitzTargets,40);
 assert.equal(current[1].away.availability,'insufficient_samples');
 assert.equal(current[1].blitzEpaInteraction,null);
});
test('injury reports from after kickoff are rejected and missing means UNKNOWN not healthy',()=>{
 const reports=[{playerId:'QB1',reportedAt:'2025-09-14T16:00:00Z',status:'Questionable',source:'official'},
 {playerId:'QB1',reportedAt:'2025-09-14T20:01:00Z',status:'Out',source:'official'},
 {playerId:'QB2',reportedAt:'2025-09-15T01:00:00Z',status:'Out',source:'official'}];
 const result=injuryAvailabilityForGame({reports,gameAt:'2025-09-14T20:00:00Z',playerIds:['QB1','QB2']});
 assert.equal(result[0].status,'Questionable');
 assert.equal(result[1].status,'unknown');
 assert.equal(result[1].assumedAvailable,false);
 assert.equal(result[0].reportedAt,'2025-09-14T16:00:00Z');
});
test('rejects unsupported corrupt play data instead of creating fabricated sample',()=>{
 const joined=joinBlitzPlays({pbp:[{...makePbp(10),epa:100},makePbp(11)],ftn:[{...makeFtn(10,2)},{...makeFtn(11,-2)}]});
 assert.equal(joined.matched,0);
 assert.equal(joined.chartCoverage,0);
 assert.throws(()=>buildBlitzPregameFeatures({plays:[],fixtures:[{date:'invalid'}]}),/date/);
});

test('charting cannot leak from previous day before FTN publication delay',()=>{
 const plays=Array.from({length:100},(_,i)=>({gameId:'prior',date:'2025-09-08',offenseTeam:'ATL',defenseTeam:'CAR',
  quarterbackId:'q1',receiverId:'r1',epa:.2,blitz:i%2===0}));
 const g=(id,date)=>({gameId:id,date,homeTeam:'ATL',awayTeam:'CAR',homeQbId:'q1',awayQbId:'q2',homeReceiverId:'r1'});
 const results=buildBlitzPregameFeatures({plays,fixtures:[g('a','2025-09-09'),g('b','2025-09-11')],minQb:20,minDefense:40});
 assert.equal(results[0].home.qbEpaVsBlitz,null);
 assert.ok(results[1].home.qbEpaVsBlitz!==null);
 assert.throws(()=>buildBlitzPregameFeatures({plays,fixtures:[],publicationLagDays:0}),/availability lag/);
});
