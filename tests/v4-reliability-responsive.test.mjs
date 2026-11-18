import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('daily suggested tickets reject stale and unsafe legs before loading',()=>{
 const src=read('src/app/19-ticket-builder.js');
 assert.match(src,/new Set\(legs\.map\(l=>String\(l\.gameId\)\)\)\.size===legs\.length/);
 assert.match(src,/new Set\(legs\.map\(l=>String\(l\.bookmaker\)\.toLowerCase\(\)\)\)\.size===1/);
 assert.match(src,/Date\.parse\(l\.start\)>Date\.now\(\)\+5\*60_000/);
 assert.match(src,/Date\.parse\(l\.oddsAsOf\)>Date\.now\(\)-8\*3600_000/);
});
test('prediction disclosures never describe market odds as calibrated model confidence',()=>{
 const src=read('src/app/19-ticket-builder.js');
 assert.match(src,/Market-derived, not calibrated/);
 assert.match(src,/not validated wagering confidence/);
});
test('responsive game cards cover small phones, tablets, and wide desktop',()=>{
 const css=read('public/style.css');
 assert.match(css,/@media\(max-width:375px\)/);
 assert.match(css,/@media\(min-width:720px\) and \(max-width:1499px\)/);
 assert.match(css,/@media\(min-width:1500px\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('static JavaScript size remains below a basic transfer budget',()=>{
 const js=read('public/app.js');
 assert.ok(Buffer.byteLength(js,'utf8')<350000,'JavaScript bundle exceeds 350 KB before compression');
});
