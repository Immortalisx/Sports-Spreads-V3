// Repeatable browser lab benchmark. Chromium mobile emulation is NOT a physical-device test.
// All external APIs are stubbed: no paid sportsbook calls.
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {brotliCompressSync,constants as zlibConstants} from 'node:zlib';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8977';
// Enforce a realistic compressed-document transfer budget separately from raw bytes.
const maxBrotliBytes=150*1024,maxMedianNavMs=200,maxMedianMatchupMs=350;
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
   await page.locator('nav.nav [data-section="games"]').click();
   const matchupStart=Date.now();
   await page.locator('.game [data-action="game"]').first().click();
   await page.locator('.drawer').waitFor({timeout:5000});
   const matchupMs=Date.now()-matchupStart;

   const metrics=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];const paints=performance.getEntriesByType('paint');return {domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),firstContentfulPaintMs:Math.round(paints.find(p=>p.name==='first-contentful-paint')?.startTime||0),heapBytes:performance.memory?.usedJSHeapSize||null,viewportOverflow:document.documentElement.scrollWidth>innerWidth};});
   results.push({device:label,run:n+1,navMs,matchupMs,requests,bytes,...metrics});await context.close();
  }
 }
 const html=await readFile('index.html');
 const brotliBytes=brotliCompressSync(html,{params:{[zlibConstants.BROTLI_PARAM_QUALITY]:5}}).byteLength;
 const medians=Object.fromEntries(['mobile','desktop'].map(device=>{const rows=results.filter(r=>r.device===device);const sorted=rows.map(r=>r.navMs).sort((a,b)=>a-b);return [device,{medianBuilderNavMs:sorted[1],medianMatchupOpenMs:rows.map(r=>r.matchupMs).sort((a,b)=>a-b)[1],medianFirstPaintMs:rows.map(r=>r.firstContentfulPaintMs).sort((a,b)=>a-b)[1]}];}));
 const report={note:'Chromium emulation with mocked providers. Brotli is a build-time compression estimate, NOT confirmed CDN wire transfer or physical-device data.',rawHtmlBytes:html.byteLength,brotliHtmlBytes:brotliBytes,budget:{maxBrotliHtmlBytes:maxBrotliBytes,maxMedianBuilderNavMs:maxMedianNavMs,maxMedianMatchupMs},medians,results};
 await mkdir('qa/reports',{recursive:true});await writeFile('qa/reports/performance-lab.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.ok(brotliBytes<=maxBrotliBytes,`Brotli HTML ${brotliBytes} exceeds ${maxBrotliBytes} byte budget`);
 for(const [device,metrics] of Object.entries(medians))assert.ok(metrics.medianBuilderNavMs<=maxMedianNavMs,`${device} builder navigation exceeds ${maxMedianNavMs}ms`);
 for(const [device,metrics] of Object.entries(medians))assert.ok(metrics.medianMatchupOpenMs<=maxMedianMatchupMs,`${device} matchup opening exceeds ${maxMedianMatchupMs}ms`);
 assert.ok(results.every(r=>!r.viewportOverflow),'Viewport horizontal overflow detected');
 }finally{await browser.close();}}
try{await run();}finally{server.kill('SIGTERM');}
