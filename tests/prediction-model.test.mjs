import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const raw=readFileSync(new URL('../public/prediction-model.js',import.meta.url),'utf8');
const {SportsPrediction:model}=(()=>{const ctx={};vm.createContext(ctx);vm.runInContext(raw,ctx);return ctx;})();
const game=(home='9-5',away='6-8',league='nba')=>({id:'123',league,status:'scheduled',demo:false,home:{name:'Home',record:home},away:{name:'Away',record:away},venueIndoor:league==='nba'});
test('probabilities are derived only from valid current records with transparent version',()=>{
 const x=model.project(game());assert.equal(x.available,true);assert.equal(x.validated,true);assert.ok(x.homeProbability>0.5);assert.equal(x.homeProbability+x.awayProbability,1);assert.match(x.version,/holdout/);assert.match(x.note,/independent 2025 season holdout/);assert.ok(x.low<x.homeProbability&&x.high>x.homeProbability);
});
test('only independently approved leagues have calibrated record outputs',()=>{
 const nba=model.project(game('14-4','4-14','nba'));
 const mlb=model.project(game('30-20','21-29','mlb'));
 const nfl=model.project(game('8-3','4-7','nfl'));
 const nhl=model.project(game('10-5-2','7-9-1','nhl'));
 assert.equal(nba.validated,true);assert.equal(mlb.validated,true);
 assert.equal(nfl.validated,false);assert.equal(nhl.validated,false);
 assert.ok(nba.holdoutGames>=1200);assert.ok(mlb.holdoutGames>=2400);
 assert.ok(nba.holdoutECE<.06);assert.ok(mlb.holdoutECE<.06);
 assert.equal(nfl.holdoutBrier,null);
});
test('no predictions without valid records or on final, live, demo',()=>{
 assert.equal(model.project(game('', '1-2')).available,false);
 assert.equal(model.project({...game(),status:'final'}).available,false);
 assert.equal(model.project({...game(),status:'live'}).available,false);
 assert.equal(model.project({...game(),demo:true}).available,false);
 assert.equal(model.project(game('0-0','0-0')).available,false);
});
test('league record parsing handles NFL ties and NHL overtime losses',()=>{
 assert.equal(model.parseRecord('7-5-2','nfl').effectiveWins,8);
 assert.equal(model.parseRecord('7-5-2','nhl').effectiveWins,7);
 assert.equal(model.parseRecord('INVALID','nba'),null);
});
test('windy outdoor forecast broadens uncertainty without fabricating a directional weather edge',()=>{
 const ctx={};vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('../public/weather-model.js',import.meta.url),'utf8')+'\n'+raw,ctx);
 const g=game('8-5','6-7','nfl');g.venueIndoor=false;
 const base=ctx.SportsPrediction.project(g);
 const adjusted=ctx.SportsPrediction.project(g,{weather:{status:'forecast',tempF:20,windMph:28,gustMph:48,precipChance:75}});
 assert.equal(adjusted.homeProbability,base.homeProbability);
 assert.ok(adjusted.uncertaintyPp>base.uncertaintyPp);
 assert.equal(adjusted.weatherTier,'High');
 assert.equal(adjusted.weatherUncertaintyPp,7);
 const indoors=ctx.SportsPrediction.project({...g,venueIndoor:true},{weather:{status:'forecast',tempF:20,windMph:28,gustMph:48,precipChance:75}});
 assert.equal(indoors.weatherUncertaintyPp,0);
});
test('high win-rate advantage is shrunk away from extreme certainty by the prior',()=>{
 const x=model.project(game('12-0','0-12','nfl'));
 assert.ok(x.homeProbability<.90);
 assert.ok(x.homeProbability>.5);
});
test('matchup UI distinguishes historically calibrated record estimates from uncalibrated previews',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const context={window:{__STANDALONE_PREVIEW__:true},document:{readyState:'loading',body:{style:{}},addEventListener:()=>{},getElementById:()=>null},localStorage:{getItem:()=>null},URL,Intl,Date,Number,Math,JSON,Array,Object,Map,Set,console};
 vm.createContext(context);
 vm.runInContext(raw,context);
 vm.runInContext(source+'\nthis.exposed={gameCard,modelPanel,state};',context);
 const g=game('9-5','6-8');
 let card=context.exposed.gameCard(g);
 assert.match(card,/Holdout-tested form/);
 let drawer=context.exposed.modelPanel(g);
 assert.match(drawer,/TEAM-RECORD MODEL/);
 assert.match(drawer,/Holdout calibrated/);
 assert.match(drawer,/not account for injuries/i);
 assert.doesNotMatch(drawer,/guaranteed profit/i);
 const nhlDrawer=context.exposed.modelPanel(game('9-5-1','7-6-1','nhl'));
 assert.match(nhlDrawer,/Not calibrated/);
});
