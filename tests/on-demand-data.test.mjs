import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('schedule fetch does not automatically request heavyweight matchup research',()=>{
 const code=read('src/app/27-board-team-loaders.js');
 const schedule=code.slice(code.indexOf('async function loadBoard()'),code.indexOf('async function loadTeams('));
 for(const fn of ['loadSportsbookOdds','loadCurrentSeasonForm','loadNflAvailability','loadNhlGoalies'])assert.doesNotMatch(schedule,new RegExp('\\b'+fn+'\\s*\\('));
});
test('matchup detail still requests research when explicitly opened',()=>{
 const code=read('src/app/30-controller.js');
 const detail=code.slice(code.indexOf("else if(action==='game')"),code.indexOf("else if(action==='load-signals')"));
 assert.match(detail,/loadSportsbookOdds\(game\)/);
 assert.match(detail,/loadCurrentSeasonForm\(game.league\)/);
});
