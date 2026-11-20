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
async function checkScoreboardRecovery(browser, bigScreen) {
 const page = await browser.newPage({viewport: bigScreen ? {width:1920,height:1080} : {width:390,height:844}});
 const nflRequests = [];
 let recovered = false;
 try {
  await page.route('**/*', async route => {
   const request = new URL(route.request().url());
   if (request.pathname === '/functions/v1/sports-feed') {
    const path = request.searchParams.get('path') || '';
    if (path.includes('/football/nfl/scoreboard')) {
     nflRequests.push(request.href);
     if (!recovered) return route.fulfill({status:502, json:{error:'Fixture outage'}});
    }
    return route.fulfill({json:{events:[]}});
   }
   if (request.origin !== url) return route.fulfill({status:502, json:{error:'Offline fixture'}});
   return route.continue();
  });
  await page.goto(bigScreen ? url+'/?display=tv' : url);
  await page.locator('[data-action="league"][data-league="nfl"]').click();
  const outage = page.getByRole('status').filter({hasText:'Scoreboard unavailable'});
  await outage.waitFor({state:'visible', timeout:10000});
  const empty = page.getByText(bigScreen ? 'No scheduled NFL games on this date.' : 'No games listed', {exact:true});
  assert.equal(await empty.count(), 0, 'A failed feed must not report an empty schedule');
  assert.equal(nflRequests.length, 1);
  recovered = true;
  await page.locator('[data-action="refresh"]:visible').click();
  await empty.waitFor({state:'visible', timeout:10000});
  assert.equal(await outage.count(), 0, 'Refresh should clear the outage message');
  assert.deepEqual(nflRequests, [nflRequests[0], nflRequests[0]], 'Refresh should retry the same league and date');
 } finally {
  await page.close();
 }
}
async function run(){
 await ready();await mkdir('qa/screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  await checkScoreboardRecovery(browser, false);
  await checkScoreboardRecovery(browser, true);
  console.log('PASS: Games and Big Screen recover from an NFL scoreboard 502 after Refresh');
  const router=async route=>{
   const requestUrl=route.request().url();
   if(requestUrl.includes('/functions/v1/sports-feed'))
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(event)});
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
   if(new URL(requestUrl).origin !== url)return route.abort();
   return route.continue();
  };
  const desktop=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];desktop.on('pageerror',e=>errors.push(String(e)));
  await desktop.route('**/*',router);await desktop.goto(url,{waitUntil:'domcontentloaded'});
  try{await desktop.locator('.game').first().waitFor({timeout:15000});}catch(e){console.error('Desktop startup diagnostics:',{errors,body:(await desktop.locator('body').innerText()).slice(0,2000),url:desktop.url()});throw e;}
  assert.match(await desktop.locator('#app').innerText(),/Test Home Team/);
  const premiumCard=desktop.locator('.game-card-v3').first();
  assert.equal(await premiumCard.getAttribute('data-status'),'upcoming');
  assert.equal(await premiumCard.locator('.match-status.upcoming').count(),1);
  assert.equal(await premiumCard.locator('.match-team-row .team-logo').count(),2);
  assert.equal(await premiumCard.locator('.match-v3-foot [data-action="game"]').count(),1);
  assert.equal(await premiumCard.evaluate(el=>getComputedStyle(el).borderTopStyle),'solid');
  assert.equal(await premiumCard.locator('.match-v3-foot .drill').evaluate(el=>getComputedStyle(el).transitionDuration!=='0s'),true,'Desktop hover transition expected');
  const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await reduced.route('**/*',router);await reduced.goto(url,{waitUntil:'domcontentloaded'});
  await reduced.locator('.game-card-v3').first().waitFor({timeout:15000});
  assert.equal(await reduced.locator('.game-card-v3').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s','Reduced motion should disable card transitions');
  await reduced.close();
  assert.equal(await desktop.locator('meta[property="og:url"]').getAttribute('content'),'https://sports-spreads.onrender.com/');
  assert.equal(errors.length,0,'Desktop exceptions: '+errors.join('; '));
  await desktop.screenshot({path:'qa/screenshots/desktop.png'});
  await desktop.locator('nav.nav [data-section="tickets"]').click();
  await desktop.locator('#auto-confidence').waitFor({timeout:5000});
  assert.equal(await desktop.locator('#leg-form').count(),0,'Suggested tickets must not duplicate the manual entry form');
  assert.equal(await desktop.locator('.ux-secondary-matchups').count(),1,'Game-by-game research should be collapsed');
  await desktop.locator('[data-action="ticket-mode"][data-mode="manual"]').click();
  await desktop.locator('#leg-form').waitFor({timeout:5000});
  assert.equal(await desktop.locator('#auto-confidence').count(),0,'Manual builder must not duplicate automatic suggestions');
  await desktop.locator('[data-action="ticket-mode"][data-mode="automatic"]').click();
  await desktop.locator('#auto-confidence').waitFor({timeout:5000});
  await desktop.locator('#auto-confidence').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await desktop.waitForFunction(()=>document.querySelector('#auto-target')?.textContent?.trim()==='65%',null,{timeout:5000}).catch(async()=>{await desktop.locator('#auto-confidence').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});await desktop.waitForFunction(()=>document.querySelector('#auto-target')?.textContent?.trim()==='65%',null,{timeout:5000});});
  assert.equal(await desktop.locator('#auto-target').innerText(),'65%');
  await desktop.locator('[data-action="generate-ticket"]').click();
  await desktop.locator('.ticket-item').first().waitFor({timeout:10000});
  assert.match(await desktop.locator('.ticket-item').first().innerText(),/Test Home Team/);
  assert.match(await desktop.locator('.auto-ticket-status').innerText(),/market-derived/i);
  await desktop.locator('.daily-ticket-card.big-one.big-one-hero').waitFor({timeout:8000});
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
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  await mobile.route('**/*',router);await mobile.goto(url,{waitUntil:'domcontentloaded'});
  await mobile.locator('.game').first().waitFor({timeout:15000});
  assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>window.innerWidth'),false,'Mobile overflow');
  assert.equal(await mobile.locator('.game-card-v3 .match-status.upcoming').count()>0,true);
  assert.equal(await mobile.locator('.game-card-v3').first().evaluate(el=>getComputedStyle(el).transform),'none','Mobile cards should not have hover transforms');
  const mobileNav=mobile.locator('.sidebar .nav');
  assert.equal(await mobileNav.evaluate(el=>getComputedStyle(el).position),'fixed','Mobile bottom nav must remain in place');
  assert.equal(await mobileNav.locator('button').count(),4);
  for(const button of await mobileNav.locator('button').all()){
   assert.ok((await button.boundingBox()).height>=44,'Mobile navigation touch targets must be at least 44px');
   assert.equal(await button.locator('span').isVisible(),true,'Mobile navigation labels should be visible');
  }
  await mobileNav.locator('[data-section="tickets"]').click();
  await mobile.locator('[data-action="ticket-mode"][data-mode="manual"]').click();
  await mobile.locator('#leg-form').waitFor({timeout:5000});
  assert.equal(await mobile.locator('#auto-confidence').count(),0);
  const mobileSummary=mobile.getByRole('region',{name:'Ticket summary'});
  const noBuilderOverflow=async()=>assert.equal(await mobile.evaluate(
   ()=>document.documentElement.scrollWidth>window.innerWidth),false,'Mobile builder overflow');
  assert.equal(await mobileSummary.count(),0);
  await noBuilderOverflow();
  await mobile.locator('#leg-selection').fill('NY');
  await mobile.locator('#leg-odds').fill('+150');
  await mobile.locator('#leg-form button[type="submit"]').tap();
  await mobileSummary.waitFor({state:'visible'});
  assert.match(await mobileSummary.innerText(),/\$25(?:\.00)?\b/);
  assert.match(await mobileSummary.innerText(),/\+150/);
  await noBuilderOverflow();
  await mobile.getByRole('button',{name:'Remove NY',exact:true}).tap();
  await mobileSummary.waitFor({state:'detached'});
  assert.equal(await mobile.locator('.ticket-item').count(),0);
  assert.equal(await mobile.locator('#leg-form').isVisible(),true);
  await noBuilderOverflow();
  console.log('PASS: 390x844 empty ticket, one +150 leg with $25 payout, last leg removed; no builder overflow');
  await mobileNav.locator('[data-section="games"]').click();
  await mobile.locator('.game [data-action="game"]').first().click();
  await mobile.locator('.drawer').waitFor({timeout:5000});
  await mobile.locator('[data-action="close"]').last().click();
  assert.equal(await mobile.locator('.drawer').count(),0);
  await mobile.screenshot({path:'qa/screenshots/mobile.png'});
  const tablet=await browser.newPage({viewport:{width:768,height:1024}});
  await tablet.route('**/*',router);await tablet.goto(url,{waitUntil:'domcontentloaded'});
  await tablet.locator('.game').first().waitFor({timeout:15000});
  assert.equal(await tablet.locator('.sidebar .nav').evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.equal(await tablet.evaluate('document.documentElement.scrollWidth>window.innerWidth'),false,'Tablet overflow');
  await tablet.close();
  const tv=await browser.newPage({viewport:{width:1920,height:1080}});
  await tv.route('**/*',router);await tv.goto(url+'/?display=tv',{waitUntil:'domcontentloaded'});
  await tv.locator('.tv-game-grid .game').first().waitFor({timeout:15000});
  assert.equal(await tv.locator('.tv-game-grid .game').first().locator('.team-logo').count(),2,'TV must retain two team logos');
  await tv.screenshot({path:'qa/screenshots/tv.png'});
  const tv4k=await browser.newPage({viewport:{width:3840,height:2160}});
  await tv4k.route('**/*',router);await tv4k.goto(url+'/?display=tv',{waitUntil:'domcontentloaded'});
  await tv4k.locator('.tv-game-grid .game').first().waitFor({timeout:15000});
  const cols=await tv4k.locator('.tv-game-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
  assert.ok(cols>=4,'4K TV should retain a four-column grid');
  await tv4k.close();
  console.log('PASS: premium card status/logo hierarchy, reduced motion, desktop, mobile/tablet, TV/4K, no overflow');
 }finally{await browser.close();}
}
try{await run();}finally{server.kill('SIGTERM');}
