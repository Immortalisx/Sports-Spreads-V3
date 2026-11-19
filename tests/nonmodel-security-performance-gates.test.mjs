import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const state=read('src/app/10-state.js');
const feed=read('src/app/00-feed.js');
const relay=read('supabase/functions/sports-feed/index.ts');
const odds=read('supabase/functions/sportsbook-odds/index.ts');
const browser=read('qa/browser-smoke.mjs');
const benchmark=read('qa/performance-benchmark.mjs');

test('HTML escaping neutralizes provider text in text and attribute contexts',()=>{
 const code=state.slice(state.indexOf('const esc='),state.indexOf('const safeUrl='));
 const ctx={};vm.createContext(ctx);vm.runInContext(code+';globalThis.escapeForTest=esc;',ctx);
 assert.equal(ctx.escapeForTest('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
 assert.equal(ctx.escapeForTest("A&B 'quoted'"),'A&amp;B &#39;quoted&#39;');
 assert.equal(ctx.escapeForTest(null),'');
});
test('feed relay enforces read-only allowlisted ESPN paths and bounded upstream',()=>{
 assert.match(relay,/if\(req\.method!=="GET"\)return reply\(req,405/);
 assert.match(relay,/if\(u\.origin!==PROVIDER\)return null/);
 assert.match(relay,/raw\.length>500/);
 assert.match(relay,/if\(!m\|\|!ALLOWED\.has\(m\[1\]\)\)return null/);
 assert.match(relay,/AbortSignal\.timeout\(6500\)/);
 assert.match(relay,/data\.length>4_000_000/);
 assert.match(relay,/"vary":"Origin"/);
});
test('paid odds refresh stays behind authenticated POST; public GET remains cache only',()=>{
 assert.match(odds,/verify_sports_odds_refresh_token/);
 assert.match(odds,/x-refresh-token/);
 assert.match(odds,/PUBLIC GET IS READ-ONLY AND NEVER SPENDS PROVIDER CREDITS/);
 assert.doesNotMatch(feed,/THE_ODDS_API_KEY|service_role|sb_secret_/i);
});
test('browser smoke includes mobile, tablet, desktop, TV and 4K layouts',()=>{
 for(const size of ['1440,height:900','390,height:844','768,height:1024','1920,height:1080','3840,height:2160'])assert.ok(browser.includes(size),size);
});
test('performance results distinguish mocked emulation from real devices and bound budgets',()=>{
 assert.match(benchmark,/Chromium emulation with mocked providers/);
 assert.match(benchmark,/NOT confirmed CDN wire transfer or physical-device data/);
 assert.match(benchmark,/Viewport horizontal overflow detected/);
 assert.match(benchmark,/medianBuilderNavMs/);
 assert.match(benchmark,/medianMatchupOpenMs/);
});
test('feed fallback reserves a bounded window after a slow relay',()=>{
 assert.match(feed,/totalDeadline=Date\.now\(\)\+12000/);
 assert.match(feed,/i<origins\.length-1\?6500:remaining/);
 assert.match(feed,/for\(let i=0;i<origins\.length;i\+\+\)/);
 assert.match(feed,/finally\{clearTimeout\(timer\);\}/);
});
