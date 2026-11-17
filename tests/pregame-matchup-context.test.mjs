import test from 'node:test';
import assert from 'node:assert/strict';
import {priorCoachMatchups,goaliePregameMatchup} from '../engine/pregame-matchup-context.mjs';
test('head-coach comparison ignores future head-to-head and shrinks one-game records',()=>{
 const games=[
 {date:'2025-09-01',homeCoachId:'H',awayCoachId:'A',winningCoachId:'H'},
 {date:'2025-10-01',homeCoachId:'H',awayCoachId:'A',winningCoachId:'A'},
 {date:'2026-11-20',homeCoachId:'H',awayCoachId:'A',winningCoachId:'H'}
 ];
 const x=priorCoachMatchups({historicalGames:games,gameDate:'2026-11-17',homeCoachId:'H',awayCoachId:'A'});
 assert.equal(x.games,2);assert.equal(x.homeCoachWins,1);
 assert.equal(x.shrunkHomeShare,.5);assert.equal(x.modelWeight,null);
});
test('NHL goalie features require dated confirmation and at least 15 prior starts',()=>{
 const logs=Array.from({length:16},(_,i)=>({goalkeeperId:'hg',gameDate:'2025-10-'+String(i+1).padStart(2,'0'),
  gsax:.25,minutes:60}));
 const home={teamId:'BOS',goalkeeperId:'hg',confirmation:{status:'confirmed',goalkeeperId:'hg',asOf:'2026-11-17T13:00:00Z',url:'https://example.com/confirmed'}};
 const away={teamId:'NYR',goalkeeperId:'ag',confirmation:{status:'projected',goalkeeperId:'ag',asOf:'2026-11-17T13:00:00Z',url:'https://example.com/projected'}};
 const x=goaliePregameMatchup({gameDate:'2026-11-17',home,away,goalieLogs:logs});
 assert.equal(x.home.status,'sourced_research');
 assert.equal(x.away.status,'not_confirmed');
 assert.equal(x.gsaxAdvantagePer60,null);
 assert.equal(x.modelValidated,false);
});
test('no post-date goalie appearances can inflate expected goaltending output',()=>{
 const logs=Array.from({length:20},(_,i)=>({goalkeeperId:'hg',gameDate:'2026-11-20',gsax:2,minutes:60}));
 const home={teamId:'BOS',goalkeeperId:'hg',confirmation:{status:'confirmed',goalkeeperId:'hg',asOf:'2026-11-17T13:00:00Z',url:'https://example.org'}};
 const away={teamId:'NYR',goalkeeperId:'ag',confirmation:home.confirmation};
 const x=goaliePregameMatchup({gameDate:'2026-11-17',home,away,goalieLogs:logs});
 assert.equal(x.home.status,'insufficient_goaltender_sample');
 assert.equal(x.home.gsaxPer60,null);
});
