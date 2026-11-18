import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('expired daily snapshots cannot display cached payouts',()=>{
 const s=read('src/app/19-ticket-builder.js');
 assert.match(s,/snapshotFresh/);
 assert.match(s,/d\.loaded&&d\.cards\?\.length&&!snapshotFresh/);
 assert.match(s,/No stale payouts or confidence estimates will be displayed/);
 assert.match(s,/if\(!valid\)return/);
 assert.match(s,/No outdated payouts or probability estimates shown/);
});
test('automatic tickets reject started games, stale prices and duplicate game legs',()=>{
 const s=read('src/app/19-ticket-builder.js');
 assert.match(s,/Date\.parse\(l\.start\)>Date\.now\(\)\+5\*60_000/);
 assert.match(s,/Date\.now\(\)-8\*3600_000/);
 assert.match(s,/new Set\(legs\.map\(l=>String\(l\.gameId\)\)\)\.size===legs\.length/);
 assert.match(s,/new Set\(legs\.map\(l=>String\(l\.bookmaker\)\.toLowerCase\(\)\)\)\.size===1/);
});
test('game cards retain image fallback and lightweight markup',()=>{
 const shell=read('src/app/15-shell.js'),view=read('src/app/20-views.js');
 assert.match(shell,/team-logo-initials/);
 assert.match(shell,/data-fallback/);
 const card=view.slice(view.indexOf('function gameCard('),view.indexOf('function filteredGames('));
 assert.match(card,/game-card-v3/);
 assert.doesNotMatch(card,/marketCardLabel\(game\)/);
});

test('standalone release stays within conservative transfer-size guardrails',()=>{
 const html=read('index.html'),bundle=read('public/app.js'),css=read('public/style.css');
 assert.ok(Buffer.byteLength(html,'utf8')<300_000,'standalone HTML exceeded 300 KB raw budget');
 assert.ok(Buffer.byteLength(bundle,'utf8')<170_000,'JS bundle exceeded 170 KB raw budget');
 assert.ok(Buffer.byteLength(css,'utf8')<90_000,'CSS exceeded 90 KB raw budget');
});
