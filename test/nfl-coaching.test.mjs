import test from 'node:test';
import assert from 'node:assert/strict';
import {readCsv,buildCoachingSnapshot,coachingForFixture,canonicalTeam} from '../supabase/functions/nfl-coaching/coach-research.mjs';
const teams=Array.from({length:20},(_,i)=>'A'+String.fromCharCode(65+i));
const headers='season,game_type,gameday,home_team,away_team,home_score,away_score,home_coach,away_coach';
const rows=Array.from({length:10},(_,i)=>
 `2026,REG,2026-11-17,${teams[2*i]},${teams[2*i+1]},21,14,Coach ${2*i},Coach ${2*i+1}`);
const csv=headers+'\n2025,REG,2025-10-12,AA,AB,17,14,Coach 0,Coach 1\n'+rows.join('\n')+'\n2026,REG,2026-11-19,AA,AB,0,30,Coach 0,Coach 1\n';
test('CSV reader rejects unsupported schema and handles quote escaping',()=>{
 assert.throws(()=>readCsv('a,b\n1,2'),/schema/);
 const r=readCsv(headers+'\n2026,REG,2026-11-17,AA,AB,21,14,"Coach, A",Coach B');
 assert.equal(r[0].home_coach,'Coach, A');
});
test('Coaching snapshot uses past games, most recent coach and historical H2H only',()=>{
 const snapshot=buildCoachingSnapshot(csv,'2026-11-18');
 assert.equal(snapshot.sourceThrough,'2026-11-17');
 assert.equal(Object.keys(snapshot.teams).length,20);
 assert.equal(snapshot.teams.AA.coach,'Coach 0');
 const matchup=coachingForFixture(snapshot,'AA','AB','2026-11-21');
 assert.equal(matchup.home.coach,'Coach 0');
 assert.equal(matchup.away.recent.games,1);
 assert.equal(matchup.headToHead.meetings,2);
 assert.equal(matchup.headToHead.homeCoachWins,2);
 assert.equal(matchup.calibrated,false);
 assert.equal(matchup.appliedToForecast,false);
 assert.equal(coachingForFixture(snapshot,'AA','AB','2026-11-17'),null);
 assert.equal(coachingForFixture(snapshot,'AA','AZ','2026-11-21'),null);
});
test('Unverified team identifiers are never inferred from opponents',()=>{
 assert.equal(canonicalTeam('WSH'),'WAS');
 assert.equal(canonicalTeam('LA'),'LAR');
 assert.throws(()=>buildCoachingSnapshot(csv,'garbage'),/cutoff/);
});