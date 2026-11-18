import test from 'node:test';
import assert from 'node:assert/strict';
import {goalieFormFromGameLog,buildNhlGoalieSnapshot} from '../engine/nhl-goalie-form.mjs';
const logs=[
 {gameId:2026020302,gameDate:'2026-11-14',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:30,goalsAgainst:3,decision:'W'},
 {gameId:2026020220,gameDate:'2026-11-10',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:20,goalsAgainst:1,decision:'W'},
 {gameId:2026020171,gameDate:'2026-11-06',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:31,goalsAgainst:4,decision:'L'},
 {gameId:2026020119,gameDate:'2026-11-02',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:22,goalsAgainst:2,decision:'L'},
 {gameId:2026020081,gameDate:'2026-10-28',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:17,goalsAgainst:1,decision:'W'},
 {gameId:2026020309,gameDate:'2026-11-17',teamAbbrev:'BOS',gamesStarted:1,shotsAgainst:30,goalsAgainst:20,decision:'L'},
 {gameId:2026020181,gameDate:'2026-11-07',teamAbbrev:'BOS',gamesStarted:0,shotsAgainst:10,goalsAgainst:1,decision:'L'},
 {gameId:2026020221,gameDate:'2026-11-11',teamAbbrev:'NYR',gamesStarted:1,shotsAgainst:29,goalsAgainst:5,decision:'L'}
];
test('save percentage is shot-weighted on last 5 actual starts only',()=>{
 const f=goalieFormFromGameLog({playerId:8475683,teamAbbrev:'BOS',logs,gameDate:'2026-11-17'});
 assert.equal(f.last5.starts,5);
 assert.equal(f.last5.shotsAgainst,120);
 assert.equal(f.last5.goalsAgainst,11);
 assert.equal(f.last5.savePct,.908);
 assert.equal(f.last3.starts,3);
 assert.equal(f.latestStart,'2026-11-14');
 assert.equal(f.minimumSample,true);
 assert.equal(f.confirmedStarter,false);
 assert.equal(f.xGoalsSavedAboveExpected,null);
});
test('same-day results and postgame box score changes never alter pregame stats',()=>{
 const first=goalieFormFromGameLog({playerId:8475683,teamAbbrev:'BOS',logs,gameDate:'2026-11-17'});
 const changed=logs.map(x=>x.gameId===2026020309?{...x,shotsAgainst:80,goalsAgainst:70}:x);
 const next=goalieFormFromGameLog({playerId:8475683,teamAbbrev:'BOS',logs:changed,gameDate:'2026-11-17'});
 assert.deepEqual(first,next);
});
test('latest start is an observation, never a confirmed future starter',()=>{
 const now='2026-11-17T12:00:00Z';
 const goalie=goalieFormFromGameLog({playerId:8475683,teamAbbrev:'BOS',logs,gameDate:'2026-11-18'});
 const snapshot=buildNhlGoalieSnapshot({generatedAt:now,teamGoalies:new Map([['BOS',[goalie]]]),
  games:[{gameId:'2026020400',start:'2026-11-18T23:00:00Z',homeAbbrev:'BOS',awayAbbrev:'NYR'}]});
 const game=snapshot.games[0];
 assert.equal(game.home.mostRecentStarter.playerId,'8475683');
 assert.equal(game.home.starterStatus,'unknown');
 assert.equal(game.home.confirmedStarter,false);
 assert.equal(game.appliedToForecast,false);
 assert.equal(snapshot.xGoalsStatus,'not sourced');
});
test('bad provider data and past fixtures cannot be quietly promoted',()=>{
 assert.throws(()=>goalieFormFromGameLog({playerId:'not-id',teamAbbrev:'BOS',logs,gameDate:'2026-11-18'}));
 const s=buildNhlGoalieSnapshot({generatedAt:'2026-11-17T12:00:00Z',teamGoalies:new Map(),
 games:[{gameId:'2026020400',start:'2026-11-16T23:00:00Z',homeAbbrev:'BOS',awayAbbrev:'NYR'}]});
 assert.equal(s.games.length,0);
});
