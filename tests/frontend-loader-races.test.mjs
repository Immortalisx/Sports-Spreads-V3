import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/app/27-board-team-loaders.js',import.meta.url),'utf8');
function harness(){
 const requests=[],renders=[];
 const state={league:'nba',date:'2026-11-18',section:'teams',directory:{},directoryLoading:{},drawer:null,teamTab:'injuries',teamCache:{},teamLoading:{},teamErrors:{},feed:null};
 const ctx={state,render:()=>renders.push({league:state.league,section:state.section,drawer:state.drawer?.team?.id}),readSportsData:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject}))};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,state,requests,renders};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('same-league non-force directory calls share one in-flight request',async()=>{
 const h=harness(),a=h.ctx.loadTeams(),b=h.ctx.loadTeams();
 assert.equal(h.requests.length,1);
 h.requests[0].resolve({teams:[{id:'1'}]});await Promise.all([a,b]);
 assert.equal(h.state.directory.nba.teams[0].id,'1');assert.equal(h.state.directoryLoading.nba,false);
});
test('older directory response cannot overwrite newer forced refresh',async()=>{
 const h=harness(),a=h.ctx.loadTeams(),b=h.ctx.loadTeams(true);
 assert.equal(h.requests.length,2);
 h.requests[1].resolve({teams:[{id:'new'}]});await b;
 h.requests[0].resolve({teams:[{id:'old'}]});await a;
 assert.equal(h.state.directory.nba.teams[0].id,'new');
 assert.equal(h.state.directoryLoading.nba,false);
});
test('older failed request cannot replace newer successful directory',async()=>{
 const h=harness(),a=h.ctx.loadTeams(),b=h.ctx.loadTeams(true);
 h.requests[1].resolve({teams:[{id:'new'}]});await b;
 h.requests[0].reject(new Error('stale outage'));await a;
 assert.equal(h.state.directory.nba.teams[0].id,'new');
});
test('directory completion after navigating away does not redraw',async()=>{
 const h=harness(),a=h.ctx.loadTeams();const count=h.renders.length;
 h.state.section='games';h.state.league='nhl';
 h.requests[0].resolve({teams:[{id:'1'}]});await a;
 assert.equal(h.renders.length,count);
 assert.equal(h.state.directory.nba.teams[0].id,'1');
});
test('team response caches data but does not redraw after drawer closes',async()=>{
 const h=harness();h.state.drawer={type:'team',league:'nba',team:{id:'7',name:'Example'}};h.state.teamTab='injuries';
 const a=h.ctx.loadTeam('injuries');const count=h.renders.length;
 h.state.drawer=null;h.requests[0].resolve({injuries:[]});await a;
 assert.equal(h.renders.length,count);assert.ok(h.state.teamCache['nba-7-injuries']);
});
test('team response does not redraw another team or inactive tab',async()=>{
 const h=harness();h.state.drawer={type:'team',league:'nba',team:{id:'7',name:'Example'}};h.state.teamTab='injuries';
 const a=h.ctx.loadTeam('injuries');const count=h.renders.length;
 h.state.drawer={type:'team',league:'nba',team:{id:'8',name:'Another'}};h.state.teamTab='roster';
 h.requests[0].resolve({injuries:[]});await a;assert.equal(h.renders.length,count);
});
