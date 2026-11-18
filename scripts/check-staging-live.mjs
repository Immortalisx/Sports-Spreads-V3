/** Read-only staging integration check. Never invokes refresh POST or paid odds provider. */
const site='https://sports-spreads-v4-staging.onrender.com';
const api='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1';
const routes=[
 ['sports-feed?path=football%2Fnfl',true],
 ['sportsbook-odds?league=nfl',false],
 ['daily-tickets',false],
 ['season-form?league=nfl',false],
 ['nfl-availability',false],
 ['nhl-goalie-form',false],
 ['matchup-signals',false]
];
let failed=0;
async function check(name,url,expectHtml=false){
 try{
  const r=await fetch(url,{headers:{Origin:site,Accept:expectHtml?'text/html':'application/json'},signal:AbortSignal.timeout(18000),redirect:'follow'});
  const cors=r.headers.get('access-control-allow-origin');
  if(!expectHtml&&cors!==site)throw Error('CORS mismatch: '+cors);
  if(!r.ok)throw Error('HTTP '+r.status);
  const body=await r.text();
  if(expectHtml){if(!body.includes('Sports Spreads')||!body.includes('app.js'))throw Error('Staging HTML missing expected app');}
  else{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object')throw Error('No JSON payload');}
  console.log('PASS '+name+' '+r.status);
 }catch(e){failed++;console.error('FAIL '+name+' '+e.message);}
}
await check('staging index',site+'/',true);
await check('staging app JS',site+'/app.js',true===false);
for(const [route] of routes)await check(route,api+'/'+route);
if(failed)process.exitCode=1;
