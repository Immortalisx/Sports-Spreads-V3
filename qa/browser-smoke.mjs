// Real Chromium browser smoke test. No app runtime dependency or paid service.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const url='http://127.0.0.1:8976';
const server=spawn('python3',['-m','http.server','8976','--bind','127.0.0.1','--directory','.'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<40;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(120);}throw Error('Static preview server did not start');}
const gameStart=new Date(Date.now()+3*60*60*1000).toISOString();
const event={events:[{id:'401999123',date:gameStart,status:{type:{state:'pre',shortDetail:'Scheduled'}},
 competitions:[{competitors:[
 {homeAway:'home',team:{id:'1',displayName:'Test Home Team',shortDisplayName:'Home Team',abbreviation:'HOM'},records:[{type:'total',summary:'8-2'}]},
 {homeAway:'away',team:{id:'2',displayName:'Test Away Team',shortDisplayName:'Away Team',abbreviation:'AWY'},records:[{type:'total',summary:'4-6'}]}
 ],venue:{fullName:'Test Arena',indoor:true,address:{city:'Test City',state:'MD',country:'USA'}}}]}]};
const scoreboard={league:'nba',updatedAt:new Date().toISOString(),games:[{id:'401999123',league:'nba',home:{id:'1',name:'Test Home Team',abbr:'HOM',record:'8-2'},away:{id:'2',name:'Test Away Team',abbr:'AWY',record:'4-6'},start:gameStart,status:'scheduled',statusText:'Scheduled',venue:'Test Arena',venueIndoor:true,demo:false}]};
async function run(){
 await ready();await mkdir('qa/screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const router=async route=>{
   const requestUrl=route.request().url();
   if(requestUrl.includes('/functions/v1/sports-feed')||requestUrl.includes('/api/scoreboard'))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(scoreboard)});
   if(requestUrl.includes('/functions/v1/daily-tickets'))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ready',generatedAt:new Date().toISOString(),
      cards:[{id:'big-one',name:'The Big One',available:true,bookmaker:'Fixture Same Book',bookmakerKey:'fixture',
       legCount:4,marketGrade:'D',marketProbabilityProduct:.13,payoutMultiplier:6.7,returnAt10:67,profitAt10:57,
       legs:Array.from({length:4},(_,i)=>({gameId:'fixture-event-'+i,league:'nba',market:'Moneyline',
        selection:'Test Fixture Home '+i,homeTeam:'Test Fixture Home '+i,awayTeam:'Test Fixture Away '+i,
        bookmaker:'Fixture Same Book',bookmakerKey:'fixture',marketProbability:.61,odds:-150,
        oddsAsOf:new Date().toISOString(),start:gameStart}))}]
    })});
   if(requestUrl.includes('/functions/v1/sportsbook-odds'))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'cached',asOf:new Date().toISOString(),ageMinutes:0,events:[{
        id:'qa-odds-1',sport_key:'basketball_nba',home_team:'Test Home Team',
        away_team:'Test Away Team',commence_time:gameStart,
        bookmakers:[{key:'fanduel',title:'Test Fixture Book',last_update:new Date().toISOString(),
          markets:[{key:'h2h',outcomes:[
            {name:'Test Home Team',price:-300},{name:'Test Away Team',price:260}
          ]}]}]
      }]
    })});
   if(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(requestUrl))return route.abort();
   return route.continue();
  };
  const desktop=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];desktop.on('pageerror',e=>errors.push(String(e)));
  await desktop.route('**/*',router);await desktop.goto(url,{waitUntil:'domcontentloaded'});
  try{await desktop.locator('.game').first().waitFor({timeout:15000});}catch(e){console.error('Desktop startup diagnostics:',{errors,body:(await desktop.locator('body').innerText()).slice(0,2000),url:desktop.url()});throw e;}
  assert.match(await desktop.locator('#app').innerText(),/Test Home Team/);
  assert.equal(await desktop.locator('meta[property="og:url"]').getAttribute('content'),'https://sports-spreads.onrender.com/');
  assert.equal(errors.length,0,'Desktop exceptions: '+errors.join('; '));
  await desktop.screenshot({path:'qa/screenshots/desktop.png'});
  await desktop.locator('nav.nav [data-section="tickets"]').click();
  await desktop.locator('#auto-confidence').waitFor({timeout:5000});
  await desktop.locator('#auto-confidence').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await desktop.waitForFunction(()=>document.querySelector('#auto-target')?.textContent?.trim()==='65%',null,{timeout:5000}).catch(async()=>{await desktop.locator('#auto-confidence').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});await desktop.waitForFunction(()=>document.querySelector('#auto-target')?.textContent?.trim()==='65%',null,{timeout:5000});});
  assert.equal(await desktop.locator('#auto-target').innerText(),'65%');
  await desktop.locator('[data-action="generate-ticket"]').click();
  await desktop.locator('.ticket-item').first().waitFor({timeout:10000});
  assert.match(await desktop.locator('.ticket-item').first().innerText(),/Test Home Team/);
  assert.match(await desktop.locator('.auto-ticket-status').innerText(),/market-derived/i);
  await desktop.locator('.daily-ticket-card.big-one').waitFor({timeout:8000});
  assert.match(await desktop.locator('.daily-ticket-card.big-one').innerText(),/the big one/i);
  await desktop.locator('[data-action="clear-ticket"]').first().click();
  await desktop.locator('.daily-ticket-card.big-one [data-action="daily-ticket-load"]').click();
  assert.equal(await desktop.locator('.ticket-item').count(),4);
  assert.match(await desktop.locator('.auto-ticket-status').innerText(),/market-implied/i);
  await desktop.screenshot({path:'qa/screenshots/ticket-confidence.png'});
  await desktop.locator('nav.nav [data-section="games"]').click();
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
