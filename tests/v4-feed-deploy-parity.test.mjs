import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../src/app/00-feed.js',import.meta.url),'utf8');
test('static preview bypasses its nonexistent /api route without disabling Node backend',()=>{
 assert.match(src,/if\(window\.__STANDALONE_PREVIEW__===true\)return directSportsData\(url\)/);
 assert.match(src,/async function readSportsData\(url\)/);
 assert.match(src,/const r=await fetch\(route.href/);
});
test('static hosting uses relay once, Node hosting retains local API and relay fallback',async()=>{
 for(const preview of [true,false]){
  const calls=[];
  const sandbox={window:{__STANDALONE_PREVIEW__:preview,location:{href:'https://sports-spreads.onrender.com/',origin:'https://sports-spreads.onrender.com'}},
   globalThis:null,URL,AbortController,setTimeout,clearTimeout,
   fetch:async url=>{calls.push(String(url));if(String(url).startsWith('https://sports-spreads.onrender.com/api/'))return {ok:false,status:404};
    return {ok:true,json:async()=>({events:[]})};}};
  sandbox.globalThis=sandbox;sandbox.SS_FEED_CONFIG={url:'https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1/sports-feed'};
  vm.createContext(sandbox);vm.runInContext(src,sandbox);
  const result=await vm.runInContext("readSportsData('/api/scoreboard?league=nfl&date=20261118')",sandbox);
  assert.equal(result.league,'nfl');
  assert.equal(calls.length,preview?1:2);
  if(preview){
   assert.match(calls[0],/supabase\.co\/functions\/v1\/sports-feed/);
   assert.ok(!calls.some(url=>url.startsWith('https://sports-spreads.onrender.com/api/')));
  }else{
   assert.match(calls[0],/sports-spreads\.onrender\.com\/api\/scoreboard/);
   assert.match(calls[1],/supabase\.co\/functions\/v1\/sports-feed/);
  }
 }
});
