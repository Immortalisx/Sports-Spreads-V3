// Real Chromium browser smoke test. No app runtime dependency or paid service.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const url='http://127.0.0.1:8976';
const server=spawn('python3',['-m','http.server','8976','--bind','127.0.0.1','--directory','.'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<40;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(120);}throw Error('Static preview server did not start');}
const event={events:[{id:'401999123',date:'2026-11-17T23:30:00Z',status:{type:{state:'pre',shortDetail:'Scheduled'}},
 competitions:[{competitors:[
 {homeAway:'home',team:{id:'1',displayName:'Test Home Team',shortDisplayName:'Home Team',abbreviation:'HOM'},records:[{type:'total',summary:'8-2'}]},
 {homeAway:'away',team:{id:'2',displayName:'Test Away Team',shortDisplayName:'Away Team',abbreviation:'AWY'},records:[{type:'total',summary:'4-6'}]}
 ],venue:{fullName:'Test Arena',indoor:true,address:{city:'Test City',state:'MD',country:'USA'}}}]}]};
async function run(){
 await ready();await mkdir('qa/screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const router=async route=>{
   const requestUrl=route.request().url();
   if(requestUrl.includes('/functions/v1/sports-feed')||requestUrl.includes('/api/scoreboard'))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(event)});
   if(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(requestUrl))return route.abort();
   return route.continue();
  };
  const desktop=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];desktop.on('pageerror',e=>errors.push(String(e)));
  await desktop.route('**/*',router);await desktop.goto(url,{waitUntil:'domcontentloaded'});
  await desktop.locator('.game').first().waitFor({timeout:15000});
  assert.match(await desktop.locator('#app').innerText(),/Test Home Team/);
  assert.equal(await desktop.locator('meta[property="og:url"]').getAttribute('content'),'https://sports-spreads.onrender.com/');
  assert.equal(errors.length,0,'Desktop exceptions: '+errors.join('; '));
  await desktop.screenshot({path:'qa/screenshots/desktop.png'});
  await desktop.locator('[data-action="nav"][data-section="tickets"]').click();
  await desktop.locator('#auto-confidence').waitFor({timeout:5000});
  await desktop.locator('#auto-confidence').evaluate(el=>{el.value='90';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await desktop.locator('#auto-target').innerText(),'90%');
  await desktop.locator('[data-action="generate-ticket"]').click();
  assert.match(await desktop.locator('.auto-ticket-status').innerText(),/No calibrated picks/);
  await desktop.screenshot({path:'qa/screenshots/ticket-confidence.png'});
  await desktop.locator('[data-action="nav"][data-section="games"]').click();
  await desktop.locator('[data-action="big-screen"]').first().click();
  await desktop.locator('.tv-shell').waitFor({timeout:5000});
  await desktop.locator('[aria-label="Exit Big Screen Mode"]').click();
  assert.equal(await desktop.locator('.tv-shell').count(),0);
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.route('**/*',router);await mobile.goto(url,{waitUntil:'domcontentloaded'});
  await mobile.locator('.game').first().waitFor({timeout:15000});
  assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>window.innerWidth'),false,'Mobile overflow');
  await mobile.screenshot({path:'qa/screenshots/mobile.png'});
  const tv=await browser.newPage({viewport:{width:1920,height:1080}});
  await tv.route('**/*',router);await tv.goto(url+'/?display=tv',{waitUntil:'domcontentloaded'});
  await tv.locator('.tv-game-grid .game').first().waitFor({timeout:15000});
  await tv.screenshot({path:'qa/screenshots/tv.png'});
  console.log('PASS: desktop startup, schedule, clean share preview, mobile fit, TV enter/exit and direct TV URL');
 }finally{await browser.close();}
}
try{await run();}finally{server.kill('SIGTERM');}
