import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/app/00-feed.js',import.meta.url),'utf8');
const directSource=source.slice(source.indexOf('async function directJson(url){'),source.indexOf('function mapDirectTeam'));
const upstream='https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';
const relay='https://example.supabase.co/functions/v1/sports-feed';
function harness(respond){
 let now=0,seq=0;
 const timers=new Map(),calls=[];
 const ctx={
  globalThis:{SS_FEED_CONFIG:{url:relay}},AbortController,URL,encodeURIComponent,
  Date:{now:()=>now},
  setTimeout(fn,delay){const id=++seq;timers.set(id,{fn,delay});return id;},
  clearTimeout(id){timers.delete(id);},
  fetch(url,options){calls.push({url,options});return respond(url,options,{advance(ms){now+=ms;},expire(){for(const [id,t] of [...timers]){timers.delete(id);t.fn();}}});}
 };
 vm.createContext(ctx);vm.runInContext(directSource+';globalThis.directJsonTest=directJson;',ctx);
 return {call:()=>ctx.globalThis.directJsonTest(upstream),calls,timers,now:()=>now};
}
const ok=data=>({ok:true,json:async()=>data});
test('healthy relay returns immediately without direct ESPN request',async()=>{
 const h=harness(async()=>ok({events:[{id:'1'}]}));
 assert.equal((await h.call()).events[0].id,'1');assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
});
test('relay HTTP error falls back to direct ESPN with no paid requests',async()=>{
 const h=harness(async(url)=>url.includes('supabase.co')?{ok:false,status:503}:ok({events:[{id:'2'}]}));
 assert.equal((await h.call()).events[0].id,'2');assert.equal(h.calls.length,2);
 assert.ok(h.calls[0].url.includes('sports-feed?path='));
 assert.equal(h.calls[1].url,upstream);
 assert.equal(h.timers.size,0);
});
test('relay abort after its own deadline leaves 5.5 seconds for fallback',async()=>{
 const h=harness((url,options,clock)=>url.includes('supabase.co')?new Promise((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>{clock.advance(6500);reject(Object.assign(new Error('aborted'),{name:'AbortError'}));},{once:true});
  clock.expire();
 }):Promise.resolve(ok({events:[{id:'fallback'}]})));
 assert.equal((await h.call()).events[0].id,'fallback');
 assert.equal(h.calls.length,2);assert.equal(h.now(),6500);assert.equal(h.timers.size,0);
});
test('expired total deadline stops before a second request',async()=>{
 const h=harness(async(url,options,clock)=>{clock.advance(12001);return {ok:false,status:503};});
 await assert.rejects(h.call(),/503/);
 assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
});
test('failed relay and direct source report failure and clear timers',async()=>{
 const h=harness(async()=>{throw new TypeError('Network blocked');});
 await assert.rejects(h.call(),/Network blocked/);
 assert.equal(h.calls.length,2);assert.equal(h.timers.size,0);
});
