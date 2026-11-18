import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const slice=src.slice(src.indexOf('function parseAmerican('),src.indexOf('function ticketView('));
function setup(legs=[],stake='10'){
 const state={ticket:legs,stake};
 const scope={state,esc:x=>String(x),money:x=>'$'+Number(x).toFixed(2)};
 vm.createContext(scope);
 vm.runInContext(slice+ '\nthis.api={calcTicket,americanCombined,ticketTicker};',scope);
 return scope.api;
}
test('live ticker math follows American-odds payout, not fabricated model confidence',()=>{
 const legs=[{odds:150},{odds:-110}];
 const api=setup(legs);
 const result=api.calcTicket();
 assert.ok(Math.abs(result.multiplier-(2.5*(1+100/110)))<1e-10);
 assert.equal(api.americanCombined(result.multiplier),'+377');
 const html=api.ticketTicker(result);
 assert.match(html,/\+377/);
 assert.match(html,/21\.0%/);
 assert.match(html,/\$47\.73/);
 assert.match(html,/Model confidence: Not verified/);
});
test('after removing a leg compact summary updates without fabricated confidence',()=>{
 const legs=[{odds:150},{odds:-110}];
 const api=setup(legs);
 api.ticketTicker(api.calcTicket());
 legs.shift();
 const updated=api.ticketTicker(api.calcTicket());
 assert.doesNotMatch(updated,/ticker-old|ticker-new/);
 assert.match(updated,/-110/);
 assert.match(updated,/52\.4%/);
 assert.match(updated,/\$19\.09/);
});
