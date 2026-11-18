import test from 'node:test';
import assert from 'node:assert/strict';
import {injuryStatus,parseLeagueInjuries,parseQbDepth,buildPregameAvailability} from '../engine/nfl-availability-snapshot.mjs';
const now='2026-11-17T17:00:00.000Z';
const injuries={season:{year:2026},injuries:[
 {team:{id:'33'},injuries:[
  {athlete:{id:'101',fullName:'QB One',position:{abbreviation:'QB'}},status:'Questionable',type:{description:'Shoulder'},date:'2026-11-16T14:00:00Z'},
  {athlete:{id:'102',fullName:'Receiver',position:{abbreviation:'WR'}},status:'Out',date:'2026-11-17T09:00:00Z'}]},
 {team:{id:'2'},injuries:[]}]};
const depth=(id='101')=>({depthCharts:[{positions:{quarterback:{
 position:{abbreviation:'QB'},athletes:[
 {rank:1,athlete:{id,displayName:'QB One'}},
 {rank:2,athlete:{id:'202',displayName:'QB Backup'}}]}}}]});
const games=[{gameId:'401',homeTeamId:'33',awayTeamId:'2',start:'2026-11-19T01:15:00Z'}];
test('NFL injury statuses are explicit; unknown and absent never mean healthy',()=>{
 assert.equal(injuryStatus('Questionable'),'questionable');
 assert.equal(injuryStatus('Out'),'out');
 assert.equal(injuryStatus('Reserve-Injured'),'injured_reserve');
 assert.equal(injuryStatus('Active'),'unknown');
 assert.equal(injuryStatus('day-to-day'),'unknown');
 const map=parseLeagueInjuries(injuries,{observedAt:now});
 assert.equal(map.get('33')[0].observedAt,now);
 assert.equal(map.get('33')[1].status,'out');
 assert.deepEqual(map.get('2'),[]);
});
test('current depth chart QB1 means projected and never confirmed',()=>{
 const result=parseQbDepth(depth(),{observedAt:now});
 assert.equal(result.status,'projected');assert.equal(result.qb1.id,'101');
 assert.match(result.reason,/never a confirmed/i);
 assert.equal(parseQbDepth({}, {observedAt:now}).status,'unknown');
});
test('injured projected QB1 makes starter uncertain, backup remains candidate',()=>{
 const report={...injuries,injuries:[{team:{id:'33'},injuries:[
  {athlete:{id:'101',fullName:'QB One',position:{abbreviation:'QB'}},status:'Out'}]}]};
 const a=buildPregameAvailability({fixtures:games,
  injuries:parseLeagueInjuries(report,{observedAt:now}),
  depthCharts:new Map([['33',depth()]]),observedAt:now});
 assert.equal(a.games.length,1);
 assert.equal(a.games[0].home.starterStatus,'uncertain');
 assert.equal(a.games[0].home.projectedQB,null);
 assert.equal(a.games[0].home.backupCandidate.id,'202');
 assert.equal(a.games[0].away.starterStatus,'unknown');
 assert.equal(a.games[0].home.confirmedStarter,false);
 assert.equal(a.games[0].confidenceAdjustment,null);
});
test('questionable QB stays projected but visibly uncertain, not declared out',()=>{
 const a=buildPregameAvailability({fixtures:games,
  injuries:parseLeagueInjuries(injuries,{observedAt:now}),
  depthCharts:new Map([['33',depth()]]),observedAt:now});
 assert.equal(a.games[0].home.projectedQB.id,'101');
 assert.equal(a.games[0].home.qbInjury.status,'questionable');
 assert.equal(a.games[0].home.confirmedStarter,false);
 assert.equal(a.games[0].appliedToForecast,false);
});
test('ambiguous QB depth chart and post-kickoff fixtures are not invented',()=>{
 const ambiguous=depth();ambiguous.depthCharts[0].positions.quarterback.athletes.push({
  rank:1,athlete:{id:'103',displayName:'Another QB'}});
 assert.equal(parseQbDepth(ambiguous,{observedAt:now}).status,'unknown');
 assert.equal(buildPregameAvailability({fixtures:[{...games[0],start:'2026-11-17T16:59:00Z'}],
  injuries:new Map(),depthCharts:new Map(),observedAt:now}).games.length,0);
 assert.throws(()=>buildPregameAvailability({fixtures:[...games,...games],
  injuries:new Map(),depthCharts:new Map(),observedAt:now}),/Repeated game/);
});

test('accepts current 2026 ESPN injury-group IDs and verified athlete player links',()=>{
 const data={injuries:[{id:'22',displayName:'Arizona Cardinals',injuries:[
  {status:'Injured Reserve',date:'2026-11-14T18:00:00Z',
   athlete:{displayName:'Sample Safety',team:{id:'22'},position:{abbreviation:'S'},
    links:[{href:'https://www.espn.com/nfl/player/_/id/3918331/sample-safety'}]}},
  {status:'Questionable',athlete:{displayName:'Other Club',team:{id:'34'},
   position:{abbreviation:'QB'},links:[{href:'https://www.espn.com/nfl/player/_/id/3917792/other'}]}}
 ]}]};
 const got=parseLeagueInjuries(data,{observedAt:now});
 assert.equal(got.get('22').length,1);
 assert.equal(got.get('22')[0].playerId,'3918331');
 assert.equal(got.get('22')[0].status,'injured_reserve');
 assert.equal(got.get('22')[0].observedAt,now);
});
test('current singular depthchart format uses ordered QB entries as projections, NOT confirmations',()=>{
 const payload={depthchart:[{name:'3WR 1TE',positions:{
 qb:{position:{abbreviation:'QB'},athletes:[
  {id:'4432577',displayName:'First QB'},
  {id:'4242546',displayName:'Backup QB'}]}}}]};
 const r=parseQbDepth(payload,{observedAt:now});
 assert.equal(r.status,'projected');
 assert.equal(r.qb1.id,'4432577');
 assert.equal(r.qb2.id,'4242546');
 assert.match(r.reason,/never a confirmed kickoff starter/);
});
test('multiple conflicting 2026 offensive depth charts do not invent a starter',()=>{
 const payload={depthchart:[
 {name:'Offense A',positions:{qb:{athletes:[{id:'11',displayName:'A'}]}}},
 {name:'Offense B',positions:{qb:{athletes:[{id:'12',displayName:'B'}]}}}
 ]};
 assert.equal(parseQbDepth(payload,{observedAt:now}).status,'unknown');
});
