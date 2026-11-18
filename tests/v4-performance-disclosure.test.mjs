import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('game cards do not surface technical bookmaker probabilities by default',()=>{
 const source=read('src/app/20-views.js');
 const card=source.slice(source.indexOf('function gameCard('),source.indexOf('function filteredGames('));
 assert.doesNotMatch(card,/marketCardLabel\(game\)/);
 assert.match(card,/View matchup/);
 assert.match(card,/data-action="game"/);
});
test('unchanged render does not destroy DOM',()=>{
 const source=read('src/app/30-controller.js');
 assert.match(source,/if\(app\.__lastMarkup!==next\)\{app\.innerHTML=next;app\.__lastMarkup=next;\}/);
});
