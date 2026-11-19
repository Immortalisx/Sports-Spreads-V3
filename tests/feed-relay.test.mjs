import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const fragment=code.slice(code.indexOf('// Browser-side read-only fallback'),code.indexOf('function getTodayET()'));
function env(fetcher){
 const scope={window:{__STANDALONE_PREVIEW__:true},SS_FEED_CONFIG:{url:'https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/sports-feed'},fetch:fetcher,
 URL,Date,AbortController,setTimeout,clearTimeout,Map,Number,Error,console};
 scope.globalThis=scope;vm.createContext(scope);vm.runInContext(fragment+'\nthis.read=readSportsData;',scope);return scope;
}
const event={id:'11',date:'2026-11-17T23:00Z',status:{type:{state:'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:'1',displayName:'Home',abbreviation:'HOM'},records:[{type:'total',summary:'7-3'}]},{homeAway:'away',team:{id:'2',displayName:'Away',abbreviation:'AWY'},records:[{type:'total',summary:'6-4'}]}]}]};
test('browser game feed uses restricted edge relay and preserves real records',async()=>{
 const requested=[];
 const scope=env(async url=>{requested.push(String(url));return {ok:true,json:async()=>({events:[event]})};});
 const board=await scope.read('/api/scoreboard?league=nba&date=20261117');
 assert.equal(board.games.length,1);assert.equal(board.games[0].home.record,'7-3');
 const u=new URL(requested[0]);assert.equal(u.pathname,'/functions/v1/sports-feed');
 assert.match(u.searchParams.get('path'),/basketball\/nba\/scoreboard\?dates=20261117&limit=100/);
 assert.equal(requested.length,1);
});
test('failed relay attempts browser direct source without displaying fake fixtures',async()=>{
 const requests=[];
 const scope=env(async url=>{requests.push(String(url));if(String(url).includes('supabase.co'))return {ok:false,status:502,json:async()=>({error:'upstream blocked'})};return {ok:true,json:async()=>({events:[event]})};});
 const board=await scope.read('/api/scoreboard?league=nfl&date=20261117');
 assert.equal(board.games.length,1);assert.equal(requests.length,2);assert.ok(requests[1].startsWith('https://site.api.espn.com'));
});
test('no sample teams are silently substituted when all sources fail',()=>{
 assert.doesNotMatch(code,/state\.directory\[league\]=\{teams:\[\.\.\.byId\.values\(\)\]/);
 assert.match(code,/state\.directory\[league\]=\{teams:\[\],error:/);
 assert.match(code,/state\.feed=\{games:\[\],demo:true/);
});
test('grouped NBA injury feed maps team-specific injuries',async()=>{
 const payload={injuries:[{id:'28',injuries:[{athlete:{id:'51',displayName:'Example Player'},status:'Out'}]},{id:'30',injuries:[{athlete:{id:'52',displayName:'Another Player'},status:'Available'}]}]};
 const scope=env(async()=>({ok:true,json:async()=>payload}));
 const report=await scope.read('/api/team/nba/28?view=injuries');
 assert.equal(report.injuries.length,1);
 assert.equal(report.injuries[0].name,'Example Player');
});

test('static hosting bypasses the missing same-origin scoreboard endpoint',async()=>{
 const calls=[];
 const scope=env(async url=>{
  const address=String(url);calls.push(address);
  if(address.startsWith('https://sports-spreads.onrender.com/api/'))return {ok:false,status:404};
  return {ok:true,json:async()=>({events:[event]})};
 });
 // A real static production origin must not be probed before the read-only relay.
 scope.window.location={href:'https://sports-spreads.onrender.com/'};
 const board=await scope.read('/api/scoreboard?league=nfl&date=20261117');
 assert.equal(board.games.length,1);
 assert.equal(calls.length,1);
 assert.match(calls[0],/^https:\/\/[-a-z0-9.]+\.supabase\.co\/functions\/v1\/sports-feed\?/);
});
test('Node hosting prefers its functional same-origin JSON scoreboard',async()=>{
 const calls=[],payload={source:'node test',games:[{id:'local-fixture'}]};
 const scope=env(async url=>{
  calls.push(String(url));
  return {ok:true,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>payload};
 });
 scope.window.__STANDALONE_PREVIEW__=false;
 scope.window.location={href:'https://sports-spreads.example/'};
 const board=await scope.read('/api/scoreboard?league=nfl&date=20261117');
 assert.equal(board,payload);
 assert.deepEqual(calls,['https://sports-spreads.example/api/scoreboard?league=nfl&date=20261117']);
});
test('Node hosting still falls back safely on a mocked API 404',async()=>{
 const calls=[];
 const scope=env(async url=>{
  const address=String(url);calls.push(address);
  if(address.startsWith('https://sports-spreads.example/api/'))return {ok:false,status:404,headers:{get:()=> 'text/plain'}};
  return {ok:true,json:async()=>({events:[event]})};
 });
 scope.window.__STANDALONE_PREVIEW__=false;
 scope.window.location={href:'https://sports-spreads.example/'};
 const board=await scope.read('/api/scoreboard?league=nfl&date=20261117');
 assert.equal(board.games.length,1);
 assert.equal(calls.length,2);
 assert.match(calls[0],/^https:\/\/sports-spreads\.example\/api\/scoreboard\?/);
 assert.match(calls[1],/\.supabase\.co\/functions\/v1\/sports-feed\?/);
});
