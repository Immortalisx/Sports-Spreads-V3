// Required pre-publish checks for a shareable one-file website.
import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [published,built,source,staticHtml]=await Promise.all([
 'index.html','release/index.html','public/index.html','dist/index.html'
].map(p=>readFile(join(root,p),'utf8')));
assert.equal(published,built,'Root deploy artifact differs from the generated standalone release');
assert.match(published,/<meta property="og:url" content="https:\/\/sports-spreads\.onrender\.com\/"/);
assert.match(published,/<meta property="og:title" content="Sports Spreads"/);
assert.match(published,/<meta property="og:description"/);
assert.match(published,/<link rel="canonical" href="https:\/\/sports-spreads\.onrender\.com\/"/);
assert.match(published,/SS_FEED_CONFIG/);
assert.match(published,/SS_CLOUD_CONFIG/);
assert.match(published,/DOMContentLoaded/);
assert.match(published,/name="viewport"/);
assert.match(published,/Big Screen/);
assert.ok(!published.includes('sb_secret_')&&!published.includes('service_role'),'Secret key string in published HTML');
assert.match(staticHtml,/\.\/app\.js/);
assert.match(source,/<div id="app"/);
for(const match of built.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
 if(match[1].trim())new vm.Script(match[1]);
}
console.log('PASS: release matches deployed index, sharing metadata intact, static assets and inline scripts parse.');
