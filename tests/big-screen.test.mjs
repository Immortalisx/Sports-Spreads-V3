import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const standalone=readFileSync(new URL('../release/index.html',import.meta.url),'utf8');
function start({remembered=false,fullscreenAvailable=false,query=""}={}){
 const stored=new Map(remembered?[['ss-big-screen','1']]:[]),listeners=new Map();
 const app={innerHTML:''},body={style:{},classList:{toggle:(name,value)=>{body.className=value?name:'';}}};
 const root={requestFullscreen:fullscreenAvailable?()=>Promise.resolve():undefined};
 const document={body,documentElement:root,fullscreenElement:null,readyState:'complete',addEventListener:(name,fn)=>listeners.set(name,fn),getElementById:(id)=>id==='app'?app:{textContent:''}};
 const ctx={window:{__STANDALONE_PREVIEW__:true,location:{search:query,href:"https://sports-spreads.onrender.com/"+query}},document,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},sessionStorage:{getItem:()=>null},URL,URLSearchParams,Intl,Date,Number,Math,JSON,Object,Array,Map,Set,console};
 vm.createContext(ctx); vm.runInContext(source+'\nthis.bigScreenApi={state,changeBigScreen,render,bigScreenBoard}',ctx);
 return {app,body,document,stored,listeners,ui:ctx.bigScreenApi};
}
test('Big Screen is optional and normal dashboard remains default',()=>{
 const {app,ui,body}=start();assert.equal(ui.state.bigScreen,false);assert.match(app.innerHTML,/Big Screen/);assert.match(app.innerHTML,/class="sidebar"/);assert.ok(!body.className);
});
test('Big Screen has a clear exit and scales existing real-game cards',()=>{
 const {app,ui,stored,body}=start();ui.state.loading=false;ui.state.feed={league:"nba",demo:false,updatedAt:new Date().toISOString(),games:[{id:"g1",league:"nba",status:"scheduled",start:new Date().toISOString(),home:{name:"Home Team",abbr:"HOM",record:"1-0"},away:{name:"Away Team",abbr:"AWY",record:"0-1"}}]};ui.changeBigScreen();assert.equal(ui.state.bigScreen,true);assert.equal(stored.get('ss-big-screen'),'1');assert.match(body.className,/big-screen-mode/);assert.match(app.innerHTML,/Big Screen scoreboard/);assert.match(app.innerHTML,/Exit big screen/);assert.match(app.innerHTML,/tv-game-grid/);assert.doesNotMatch(app.innerHTML,/class="sidebar"/);ui.changeBigScreen();assert.equal(ui.state.bigScreen,false);assert.match(app.innerHTML,/class="sidebar"/);
});
test('TV mode survives reload and works when browser fullscreen is unsupported',()=>{
 const {app,ui}=start({remembered:true});assert.equal(ui.state.bigScreen,true);assert.match(app.innerHTML,/tv-shell/);ui.changeBigScreen();assert.equal(ui.state.bigScreen,false);
});
test('TV layout provides 4K grid, reduced-motion and large lettering with mobile fallback',()=>{
 assert.match(css,/@media\s*\(min-width:2400px\)/);assert.match(css,/tv-game-grid\s*\{grid-template-columns:repeat\(4/);assert.match(css,/\.tv-game-grid \.team-logo/);assert.match(css,/@media\s*\(max-width:670px\)/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(standalone,/tv-shell/);assert.match(standalone,/data-action="big-screen"/);
});

test('TV-only link enables presentation without requiring a prior browser preference',()=>{
 const {app,ui}=start({query:'?display=tv'});assert.equal(ui.state.bigScreen,true);assert.match(app.innerHTML,/Big Screen scoreboard/);
});
