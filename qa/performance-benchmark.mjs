// Repeatable browser lab benchmark. Chromium mobile emulation is NOT a physical-device test.
// All external APIs are stubbed: no paid sportsbook calls.
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:8977';
const server=spawn('python3',['-m','http.server','8977','--bind','127.0.0.1','--directory','.'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<60;i++){try{if((await fetch(base)).ok)return;}catch{}await sleep(100);}throw Error('Server not ready');}
const sample={events:[{id:'401999123',date:new Date(Date.now()+3600000).toISOString(),status:{type:{state:'pre',shortDetail:'Scheduled'}},competitions:[{competitors:[{homeAway:'home',team:{id:'1',displayName:'Home Team',abbreviation:'HOM'},records:[{type:'total',summary:'8-2'}]},{homeAway:'away',team:{id:'2',displayName:'Away Team',abbreviation:'AWY'},records:[{type:'total',summary:'4-6'}]}],venue:{indoor:true,address:{city:'Baltimore',state:'MD',country:'USA'}}}]}]};
const scoreboard={league:'nba',updatedAt:new Date().toISOString(),games:[{id:'401999123',league:'nba',home:{id:'1',name:'Home Team',abbr:'HOM',record:'8-2'},away:{id:'2',name:'Away Team',abbr:'AWY',record:'4-6'},start:new Date(Date.now()+3600000).toISOString(),status:'scheduled',statusText:'Scheduled',demo:false}]};
async function run(){await ready();const browser=await chromium.launch({headless:true});const results=[];try{
 for(const [label,options] of [['mobile',devices['iPhone 13']],['desktop',{viewport:{width:1440,height:900}}]]){
  for(let n=0;n<3;n++){
   const context=await browser.newContext(options);const page=await context.newPage();let bytes=0,requests=0;
   await page.route('**/*',async route=>{const u=route.request().url();if(u.includes('/api/')||u.includes('supabase.co/functions/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.includes('daily-tickets')?{status:'pending',cards:[]}:scoreboard)});if(!u.startsWith(base))return route.abort();return route.continue();});
   page.on('response',async response=>{if(response.url().startsWith(base)){requests++;const length=Number(response.headers()['content-length']);if(Number.isFinite(length))bytes+=length;}});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.game').first().waitFor({timeout:15000});
   const start=Date.now();await page.locator('nav.nav [data-section="tickets"]').click();await page.locator('#auto-confidence').waitFor({timeout:5000});const navMs=Date.now()-start;
   const metrics=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];const paints=performance.getEntriesByType('paint');return {domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),firstContentfulPaintMs:Math.round(paints.find(p=>p.name==='first-contentful-paint')?.startTime||0),heapBytes:performance.memory?.usedJSHeapSize||null,viewportOverflow:document.documentElement.scrollWidth>innerWidth};});
   results.push({device:label,run:n+1,navMs,requests,bytes,...metrics});await context.close();
  }
 }
 await mkdir('qa/reports',{recursive:true});await writeFile('qa/reports/performance-lab.json',JSON.stringify({note:'Chromium emulation; mocked providers; not field INP/LCP or physical-device measurement',results},null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}}
try{await run();}finally{server.kill('SIGTERM');}
