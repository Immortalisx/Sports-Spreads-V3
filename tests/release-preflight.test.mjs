import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
test('release generation produces a built preview for fresh CI checkouts',()=>{
 const release=readFileSync(join(root,'release/index.html'),'utf8');
 assert.ok(release.length>10000);
 assert.match(release,/data-action="big-screen"/);
 assert.match(release,/SS_FEED_CONFIG/);
});
test('all share metadata points to the website rather than internal app URLs',()=>{
 const release=readFileSync(join(root,'release/index.html'),'utf8');
 assert.match(release,/og:title/);
 assert.match(release,/og:description/);
 assert.match(release,/https:\/\/sports-spreads\.onrender\.com\//);
 assert.doesNotMatch(release,/chatgpt\.site/);
});
