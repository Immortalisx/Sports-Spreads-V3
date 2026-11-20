import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const appSource=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/app/19-ticket-builder.js',import.meta.url),'utf8');
function renderLab(){
 const mount={innerHTML:''};
 const ctx={
  window:{__STANDALONE_PREVIEW__:true,scrollTo(){}},
  document:{readyState:'loading',body:{style:{}},getElementById:id=>id==='app'?mount:null,addEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){}},
  sessionStorage:{getItem:()=>null},
  URL,Intl,Date,Math,Number,JSON,String,Array,Map,Set,Object,console
 };
 ctx.globalThis=ctx;
 vm.createContext(ctx);
 vm.runInContext(appSource+'\nthis.ux={state,ticketView,gameCard,render};',ctx);
 return {mount,ui:ctx.ux};
}
const sample={
 id:'g-101',league:'nhl',status:'scheduled',demo:false,start:'2026-11-19T00:00:00.000Z',
 away:{id:'1',name:'Away Eagles',abbr:'AE',record:'9-2'},
 home:{id:'2',name:'Home Bears',abbr:'HB',record:'6-5'}
};
test('suggestions are genuinely separate: no manual form or hidden duplicate widgets',()=>{
 const {ui}=renderLab();
 ui.state.ticketMode='automatic';
 let html=ui.ticketView();
 assert.match(html,/Suggested tickets/);
 assert.match(html,/big-one big-one-hero/);
 assert.match(html,/id="auto-confidence"/);
 assert.match(html,/Bookmaker-implied chance/);
 assert.match(html,/ux-secondary-matchups/);
 assert.match(html,/<details class="ux-secondary-matchups">/);
 assert.doesNotMatch(html,/id="leg-form"/);
 assert.doesNotMatch(html,/id="leg-selection"/);
 assert.doesNotMatch(html,/role="combobox"/);
 const current=ui.state.ticket=[{id:'1',selection:'Home Bears to win',market:'Moneyline',league:'nhl',odds:-125}];
 assert.ok(current);
 html=ui.ticketView();
 assert.match(html,/ticket-item/);
 assert.match(html,/data-action="clear-ticket"/);
 assert.doesNotMatch(html,/id="leg-form"/);
});
test('manual builder preserves accessible selection, props and ticket review without automatic slate',()=>{
 const {ui}=renderLab();
 ui.state.ticketMode='manual';ui.state.draft={league:'nfl',market:'Player yards',selection:'Test Runner'};ui.state.ticket=[{id:'leg',selection:'Test Runner',league:'nfl',market:'Player yards',odds:110}];
 const html=ui.ticketView();
 assert.match(html,/id="leg-form"/);
 assert.match(html,/role="combobox"/);
 assert.match(html,/aria-controls="selection-suggestions"/);
 assert.match(html,/id="prop-line"/);
 assert.match(html,/Test Runner/);
 assert.match(html,/id="stake"/);
 assert.doesNotMatch(html,/id="auto-confidence"/);
 assert.doesNotMatch(html,/class="daily-suggestions"/);
 assert.doesNotMatch(html,/ux-secondary-matchups/);
});
test('game card shows Eastern start time, meaningful status and one primary action',()=>{
 const {ui}=renderLab();
 const scheduled=ui.gameCard(sample);
 assert.match(scheduled,/UPCOMING/);
 assert.match(scheduled,/7:00 PM EST/);
 assert.match(scheduled,/data-action="game"/);
 assert.match(scheduled,/View matchup/);
 assert.equal((scheduled.match(/data-action="game"/g)||[]).length,1);
 assert.equal((scheduled.match(/data-action="team"/g)||[]).length,2);
 assert.match(scheduled,/aria-label="View Away Eagles versus Home Bears matchup details"/);
 assert.doesNotMatch(scheduled,/Bookmaker-implied|marketGrade/);
 const live=ui.gameCard({...sample,status:'live',home:{...sample.home,score:2},away:{...sample.away,score:3}});
 assert.match(live,/LIVE/);assert.match(live,/match-team-score">3/);
 const final=ui.gameCard({...sample,status:'final',home:{...sample.home,score:2},away:{...sample.away,score:3}});
 assert.match(final,/FINAL/);assert.match(final,/match-team-score">2/);
});
test('responsive navigation exposes text labels and safe-area space; TV remains separate',()=>{
 assert.match(css,/UX V7: separate suggestion and manual workflows/);
 assert.match(css,/@media\(max-width:830px\)/);
 assert.match(css,/\.sidebar \.nav\{position:fixed/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.sidebar \.nav button span\{display:block/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(css,/\.ticket-dock\{bottom:calc\(65px \+ env\(safe-area-inset-bottom/);
 assert.match(css,/\.ticket-layout\.auto-only\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(root,/big-one big-one-hero/);
 assert.match(root,/Bookmaker-implied chance/);
 assert.match(root,/ux-secondary-matchups/);
 assert.match(root,/View matchup/);
 assert.match(root,/tv-shell/);
 assert.ok(Buffer.byteLength(root,'utf8')<300000);
 assert.ok(Buffer.byteLength(css,'utf8')<90000);
 assert.ok(Buffer.byteLength(appSource,'utf8')<170000);
 assert.doesNotMatch(source,/positive guaranteed return|guaranteed profit/i);
});

for (const mode of ['automatic', 'manual']) {
 test(`empty ${mode} builder starts with mode choices and restores them after the last removal`,()=>{
  const {ui}=renderLab();
  ui.state.ticketMode=mode;
  const empty=ui.ticketView();
  assert.ok(empty.startsWith('<div class="ticket-tabs"'));
  assert.doesNotMatch(empty,/aria-label="Ticket summary"|<h3>My ticket|Nothing added yet|<h2>Build a ticket/);
  assert.match(empty,mode==='manual'?/id="leg-form"/:/big-one-hero/);

  ui.state.ticket.push({league:'nfl',market:'Moneyline',selection:'Test team',odds:150});
  const filled=ui.ticketView();
  assert.match(filled,/aria-label="Ticket summary"/);
  assert.match(filled,/data-action="remove-leg"/);
  assert.match(filled,/Potential return/);
  assert.match(filled,/\+150/);
  ui.state.ticket.pop();
  assert.equal(ui.ticketView(),empty);
 });
}
