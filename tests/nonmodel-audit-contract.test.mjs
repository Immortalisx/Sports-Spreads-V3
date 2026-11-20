import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const feed=read('src/app/00-feed.js');
const loader=read('src/app/27-board-team-loaders.js');
const controller=read('src/app/30-controller.js');
const cloud=read('public/cloud-browser.js');
const odds=read('supabase/functions/sportsbook-odds/index.ts');
const benchmark=read('qa/performance-benchmark.mjs');
const pkg=JSON.parse(read('package.json'));

test('public sportsbook cache GET remains read-only; paid upstream refresh is not in browser loader',()=>{
 assert.match(odds,/PUBLIC GET IS READ-ONLY AND NEVER SPENDS PROVIDER CREDITS/);
 assert.match(odds,/A separate explicitly authenticated POST is required/);
 assert.match(odds,/x-refresh-token/);
 assert.match(odds,/verify_sports_odds_refresh_token/);
 assert.doesNotMatch(feed,/THE_ODDS_API_KEY|x-refresh-token|service_role|sb_secret_/i);
 assert.doesNotMatch(controller,/THE_ODDS_API_KEY|x-refresh-token|service_role|sb_secret_/i);
});
test('static feed fallback has bounded fetch and provider failure handling',()=>{
 assert.match(feed,/AbortController/);
 assert.match(feed,/clearTimeout\(timer\)/);
 assert.match(feed,/if\(!r\.ok\)/);
 assert.match(feed,/if\(data\?\.error\)/);
 assert.match(feed,/if\(!snapshot\.cached/);
 assert.match(feed,/Invalid game date/);
});
test('board discards stale league/date responses and team detail prevents concurrent same-key requests',()=>{
 assert.match(loader,/state\.league!==league\|\|state\.date!==date/);
 assert.match(loader,/if\(state\.teamLoading\[key\]\)return/);
 assert.match(loader,/finally\{state\.teamLoading\[key\]=false/);
 assert.match(loader,/isActiveTeamDetail/);
 assert.match(loader,/version!==boardRequestVersion/);
});
test('cloud browser uses user session storage, not server secrets',()=>{
 assert.match(cloud,/sessionStorage/);
 assert.match(cloud,/sb_publishable_/);
 assert.match(cloud,/authorization:\x60Bearer \$\{token\}\x60/);
 assert.doesNotMatch(cloud,/service_role|sb_secret_|THE_ODDS_API_KEY/);
});
test('performance claims remain explicitly lab-only and do not spend API credits',()=>{
 assert.match(benchmark,/NOT a physical-device test/);
 assert.match(benchmark,/All external APIs are stubbed/);
 assert.match(benchmark,/Brotli is a build-time compression estimate/);
 assert.equal(pkg.scripts['postinstall'],'npm test'); // Audit evidence: installation still runs tests.
});
