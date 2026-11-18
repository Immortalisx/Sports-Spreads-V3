import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/app/20-views.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/app/15-shell.js',import.meta.url),'utf8');
function lab(){
 const ctx={window:{__STANDALONE_PREVIEW__:true},document:{readyState:'loading',addEventListener(){}},
 localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null},URL,Intl,Date,Math,Number,JSON,String,Array,Map,Set,Object,console};
 ctx.globalThis=ctx;vm.createContext(ctx);
 vm.runInContext(app+'\nthis.ui={gameCard,logo};',ctx);
 return ctx.ui;
}
const team=(name,abbr,score=null)=>({id:abbr,name,abbr,record:'8-2',score});
const base={id:'premium-1',league:'nba',status:'scheduled',demo:false,start:'2026-11-19T00:00:00.000Z',
 away:team('Away Team','AWY'),home:team('Home Team','HOM')};
test('matchup cards use explicit consistent visual status and no betting logic changes',()=>{
 const {gameCard}=lab();
 for(const [status,label] of [['scheduled','UPCOMING'],['live','LIVE'],['final','FINAL']]){
  const g={...base,status,away:team('Away Team','AWY',2),home:team('Home Team','HOM',3)};
  const html=gameCard(g);
  assert.match(html,new RegExp('data-status="'+(status==='scheduled'?'upcoming':status)+'"'));
  assert.match(html,new RegExp('class="tag match-status '+(status==='scheduled'?'upcoming':status)+'"'));
  assert.match(html,new RegExp('>'+label+'</span>'));
  assert.match(html,/class="status-indicator" aria-hidden="true"/);
  assert.match(html,/data-side="away"/);assert.match(html,/data-side="home"/);
  assert.equal((html.match(/class="team-logo"/g)||[]).length,2);
  assert.equal((html.match(/data-action="game"/g)||[]).length,1);
  assert.match(html,/7:00 PM EST/);
 }
 const preview=gameCard({...base,demo:true});
 assert.match(preview,/data-status="preview"/);
 assert.match(preview,/PREVIEW/);
});
test('logos retain accessible initials and safe single-retry fallback for each sport',()=>{
 const {logo}=lab();
 for(const league of ['nfl','nba','nhl','mlb']){
  const html=logo({name:'Sample Club',abbr:'TST',logo:'https://invalid.example/test.png'},league);
  assert.match(html,/team-logo-initials/);
  assert.match(html,/data-fallback=/);
  assert.match(html,/loading="lazy" decoding="async"/);
  assert.match(html,/this.hidden=true/);
  assert.match(html,/onload="this.previousElementSibling.hidden=true"/);
 }
 assert.match(shell,/trail blazers/);
 assert.match(shell,/spurs/);
});
test('premium visuals are CSS-only, size-bounded, mobile-safe, and reduced-motion aware',()=>{
 assert.match(css,/UX V8: premium, low-cost visual system/);
 assert.match(css,/\.game-card-v3\[data-status="live"\]/);
 assert.match(css,/\.game-card-v3 \.match-status\.preview/);
 assert.match(css,/\.game-card-v3 \.team-logo img\[hidden\]\{display:none\}/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.game-grid \.game-card-v3,.game-card-v3 \.match-v3-foot \.drill\{transition:none!important;animation:none!important;transform:none!important\}/);
 assert.match(root,/UX V8: premium, low-cost visual system/);
 assert.match(root,/data-status/);
 assert.ok(Buffer.byteLength(root,'utf8')<300000);
 assert.ok(Buffer.byteLength(css,'utf8')<90000);
 assert.ok(Buffer.byteLength(app,'utf8')<170000);
 assert.doesNotMatch(source,/fetch\(|setInterval\(|setTimeout\(/);
 assert.doesNotMatch(css,/@import url\([^)]*premium/i);
});
