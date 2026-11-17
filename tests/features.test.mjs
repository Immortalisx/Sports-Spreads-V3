import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const scope={state:{ticket:[]},esc:x=>String(x)};
vm.createContext(scope);
const part=script.slice(script.indexOf('function ticketWarnings('),script.indexOf('function ticketView('));
vm.runInContext(part+'\nthis.features={ticketWarnings,propNote,propFields,propInfo};',scope);
const {ticketWarnings,propInfo,propNote,propFields}=scope.features;
test('warns on duplicate and same-game/player overlap without inventing correlation probability',()=>{
 let results=ticketWarnings([{league:'nba',market:'Player points',selection:'A',notes:'Over 20.5',gameId:'g',playerId:'p'},{league:'nba',market:'Player rebounds',selection:'A',notes:'Over 5.5',gameId:'g',playerId:'p'}]);
 assert.ok(results.some(x=>x.kind==='same-game'));
 assert.ok(results.some(x=>x.kind==='player-overlap'));
 assert.ok(!results.some(x=>/probability|%/.test(x.message)));
 results=ticketWarnings([{league:'nfl',market:'Moneyline',selection:'Baltimore to win'},{league:'nfl',market:'Moneyline',selection:'Baltimore to win'}]);
 assert.ok(results.some(x=>x.kind==='duplicate'));
 assert.equal(ticketWarnings([{league:'nhl',market:'Moneyline',selection:'A'},{league:'nba',market:'Player points',selection:'B'}]).length,0);
});
test('sports-specific sliders never substitute sportsbook or model data',()=>{
 assert.equal(propNote('Touchdowns',2),'At least 2 TD');
 assert.equal(propNote('Player yards',50),'Over 50.5 yards');
 assert.equal(propInfo('nhl','Shots on goal')[2],12);
 assert.equal(propInfo('nfl','Touchdowns')[2],5);
 const html=propFields('nba','Player points');
 assert.match(html,/type="range"/);
 assert.match(html,/No live pricing or probability/);
});
