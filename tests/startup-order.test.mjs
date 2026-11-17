import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const onefile=readFileSync(new URL('../release/index.html',import.meta.url),'utf8');
test('inline app waits until DOM mount exists instead of blank-screening on startup',()=>{
  const handlers=new Map();let bodyReady=false;const app={innerHTML:''};
  const ctx={window:{__STANDALONE_PREVIEW__:true},document:{readyState:'loading',body:{style:{}},getElementById:id=>bodyReady?(id==='app'?app:{textContent:''}):null,addEventListener:(name,fn)=>handlers.set(name,fn)},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},URL,Intl,Date,Number,Math,JSON,Array,Object,Map,Set,console};
  vm.createContext(ctx);
  assert.doesNotThrow(()=>vm.runInContext(code,ctx));
  assert.equal(app.innerHTML,'');
  assert.ok(handlers.has('DOMContentLoaded'));
  bodyReady=true;
  handlers.get('DOMContentLoaded')();
  assert.match(app.innerHTML,/sports.*spreads|Games/i);
});
test('published one-file build includes startup guard and visible fallback',()=>{
  assert.match(onefile,/DOMContentLoaded',bootSportsSpreads/);
  assert.match(onefile,/Loading Sports Spreads/);
  assert.match(onefile,/<div id="app"/);
});
