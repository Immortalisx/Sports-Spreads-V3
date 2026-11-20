import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Extract the template-literal attribute and evaluate its JavaScript escaping.
// HTML pattern is interpreted using the modern Unicode v regex flag in browsers.
const src=readFileSync(new URL('../src/app/19-ticket-builder.js',import.meta.url),'utf8');
const match=src.match(/id="leg-odds"[^>]*pattern="([^"]+)"/);
test('native American odds HTML pattern compiles with the browser Unicode v flag',()=>{
 assert.ok(match,'American odds pattern must be present');
 const pattern=vm.runInNewContext('`'+match[1]+'`');
 const regex=new RegExp('^(?:'+pattern+')$','v');
 for(const valid of ['-110','+135','100','-100000'])assert.equal(regex.test(valid),true,'valid odds '+valid);
 for(const invalid of ['not-odds','--110','++110','1.5','+ 135','+','-',''])assert.equal(regex.test(invalid),false,'invalid odds '+invalid);
 assert.match(src,/id="leg-odds" required/);
});
test('ticket calculation independently rejects malformed and out-of-range odds',()=>{
 const functionSource=src.split('\n').find(line=>line.startsWith('function parseAmerican('));
 assert.ok(functionSource);
 const parse=vm.runInNewContext(functionSource+'\nparseAmerican');
 assert.equal(parse('-110'),-110);
 assert.equal(parse('+135'),135);
 for(const invalid of ['not-odds','1.5','-99','+100001'])assert.equal(parse(invalid),null);
});
