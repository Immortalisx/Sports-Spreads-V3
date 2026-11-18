import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
function page(){
 const ids={},events={};const mk=id=>ids[id]||=({id,value:'',innerHTML:'',textContent:'',hidden:false,attributes:{},style:{},setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;}});
 const doc={readyState:'loading',body:{style:{}},getElementById:mk,addEventListener:(name,fn)=>{events[name]=fn;}};
 const ctx={document:doc,window:{__STANDALONE_PREVIEW__:true,scrollTo:()=>{}},location:{origin:'https://sports-spreads.onrender.com'},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},console,URL,Intl,Date,Number,Math,Set,Map,JSON,Object,Array,String,setTimeout:()=>1,clearTimeout:()=>{}};
 ctx.globalThis=ctx;
 vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('../public/autocomplete.js',import.meta.url),'utf8'),ctx);
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8')+'\nthis.testUI={state,drawLookup,acceptLookup,ensureLookupRoster,lookupTyping,ticketView};',ctx);
 return {ids,events,ctx,ui:ctx.testUI,mk};
}
test('three-letter team suggestions appear in builder, no network needed for cached directory',async()=>{
 const {ui,mk}=page();mk('leg-league').value='nba';mk('leg-market').value='Moneyline';
 ui.state.directory.nba={teams:[{id:'10',name:'New York Knicks',abbr:'NYK'},{id:'11',name:'Brooklyn Nets',abbr:'BKN'}]};
 mk('leg-selection').value='kni';ui.lookupTyping('kni');
 assert.match(mk('selection-suggestions').innerHTML,/Knicks/);assert.equal(mk('leg-selection').attributes['aria-expanded'],'true');
 await ui.acceptLookup(0);assert.equal(mk('leg-selection').value,'New York Knicks to win');assert.equal(ui.state.lookup.selectedTeam.id,'10');
});
test('player suggestions use selected team roster, never invented names',async()=>{
 const {ui,mk}=page();mk('leg-league').value='nba';mk('leg-market').value='Player points';
 const t={id:'10',name:'New York Knicks',abbr:'NYK'};
 ui.state.directory.nba={teams:[t]};ui.state.teamCache['nba-10-roster']={roster:[{id:'123',name:'Jalen Brunson',position:'PG'}]};
 ui.lookupTyping('kni');await ui.acceptLookup(0);
 // Roster lookup is async; give the function a microtask to settle.
 await Promise.resolve();await Promise.resolve();
 ui.lookupTyping('jal');assert.match(mk('selection-suggestions').innerHTML,/Jalen Brunson/);
 await ui.acceptLookup(0);assert.equal(mk('leg-selection').value,'Jalen Brunson');assert.equal(ui.state.lookup.chosen.id,'123');
});
test('builder exposes an accessible combobox and shows its source limitation',()=>{
 const {ui}=page();ui.state.section='tickets';ui.state.ticketMode='manual';let html=ui.ticketView();
 assert.match(html,/role="combobox"/);assert.match(html,/aria-controls="selection-suggestions"/);assert.match(html,/Type 3 letters/);
});
