import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const state=readFileSync(new URL('../src/app/10-state.js',import.meta.url),'utf8');
const views=['20-views','21-game-detail'].map(name=>readFileSync(new URL(`../src/app/${name}.js`,import.meta.url),'utf8')).join('\n');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const formatter=state.split('\n').find(line=>line.startsWith('const formatTime='));
if(!formatter)throw Error('Eastern start-time formatter missing');
const formatTime=vm.runInNewContext(formatter+'\nformatTime',{Intl,Date,Number});
test('explicit game start times show EST in winter and EDT in summer regardless of viewer location',()=>{
 assert.equal(formatTime('2026-11-18T01:15:00.000Z'),'8:15 PM EST');
 assert.equal(formatTime('2026-07-18T00:15:00.000Z'),'8:15 PM EDT');
 assert.equal(formatTime('2026-07-18T15:00:00.000Z'),'11:00 AM EDT');
 assert.equal(formatTime('invalid'),'TBD');
 assert.equal(formatTime(null),'TBD');
});
test('cards show game time once prominently; game details show the same Eastern time',()=>{
 const card=views.slice(views.indexOf('function gameCard(game){'),views.indexOf('function filteredGames(){'));
 assert.match(card,/const time=game.start\?formatTime\(game.start\)/);
 assert.ok(card.includes('class="game-start-time"'));
 assert.match(card,/esc\(time\)/);
 assert.ok(!card.includes('class="game-center-time"'));
 const drawer=views.slice(views.indexOf('function gameDrawer(){'));
 assert.match(drawer,/Scheduled start \(Eastern Time\)/);
 assert.match(drawer,/formatTime\(g\.start\)/);
});
test('when no matchup factors are sourced, do not render a repetitive placeholder table',()=>{
 const factors=views.slice(views.indexOf('function matchupFactorsPanel(g){'),views.indexOf('function pregameStarterPanel(g){'));
 assert.match(factors,/if\(!sourced\.length\)|sourced\.length\?/);
 assert.match(factors,/Advanced matchup research/);
 assert.match(factors,/Not yet verified/);
 assert.match(factors,/See /);
 assert.match(factors,/research-missing/);
 assert.doesNotMatch(factors,/Awaiting verified data/);
 assert.doesNotMatch(factors,/0\/8 sourced/);
});
test('indoor weather is a one-line card, while outdoor forecasts are preserved',()=>{
 const weather=views.slice(views.indexOf('function weatherPanel(g){'),views.indexOf('async function loadGameWeather('));
 assert.match(weather,/weather-compact/);
 assert.match(weather,/Indoor venue/);
 assert.match(weather,/No outdoor weather impact expected/);
 assert.match(weather,/value\.status==='forecast'/);
 assert.match(weather,/weather-grid/);
 assert.match(css,/\.weather-compact/);
 assert.match(css,/\.research-panel/);
});
