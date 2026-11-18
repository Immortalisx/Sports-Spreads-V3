import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('offline browser preview renders builder, saves immutable snapshot, and restores a copy',()=>{
 const saved=new Map();const app={innerHTML:''};const announcer={textContent:''};
 const ctx={
  window:{__STANDALONE_PREVIEW__:true,scrollTo:()=>{}},
  document:{body:{style:{}},getElementById:id=>id==='app'?app:announcer,addEventListener:()=>{}},
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  console,URL,Intl,Date,Number,Math,Set,Map,JSON,Object,Array,String,
 };
 vm.createContext(ctx);
 vm.runInContext(code+'\nthis.ui={state,ticketView,historyView,archiveTicket,render};',ctx);
 const ui=ctx.ui;
 assert.match(app.innerHTML,/Checking|Examples/);
 ui.state.section='tickets';
 ui.state.ticket=[{id:'a',league:'nfl',market:'Touchdowns',selection:'Example athlete',odds:110,notes:'At least 2 TD'}];
 ui.render();
 assert.match(app.innerHTML,/Save snapshot/);
 assert.match(app.innerHTML,/Model confidence/);
 assert.match(app.innerHTML,/Ticket details|Bookmaker prices are not validated model confidence/);
 const original=ui.archiveTicket();
 assert.equal(ui.state.history.length,1);
 assert.equal(original.potentialReturn,21);
 assert.ok(saved.has('ss-v2-archives'));
 ui.state.ticket[0].selection='Changed after saving';
 assert.equal(ui.state.history[0].legs[0].selection,'Example athlete');
 ui.state.section='history';ui.render();
 assert.match(app.innerHTML,/Saved tickets/);
 assert.match(app.innerHTML,/Example athlete|Ticket ·/);
 assert.match(app.innerHTML,/Copy to builder/);
});
