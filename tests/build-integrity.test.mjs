import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const html=readFileSync(new URL('../release/index.html',import.meta.url),'utf8');
test('generated production document embeds all scripts in safe order',()=>{
 assert.match(html,/window\.SS_FEED_CONFIG/);assert.match(html,/window\.SS_CLOUD_CONFIG/);
 assert.ok(html.indexOf('SportsMultifactor=')<html.indexOf('function previewModel('));
 assert.ok(html.indexOf('SportsAutocomplete=')<html.indexOf('function lookupTyping('));
 assert.match(html,/DOMContentLoaded/);
 assert.ok(!html.includes('sb_secret_'));assert.ok(!html.includes('service_role'));
});
test('every production inline script parses before deployment',()=>{
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.ok(scripts.length>=7);
 for(const script of scripts) assert.doesNotThrow(()=>new vm.Script(script));
});
